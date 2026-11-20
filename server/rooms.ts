import { randomInt } from 'node:crypto';

import { ROOM_CODE_LENGTH, type RoomPlayer, type RoomSnapshot, type ServerMessage } from '../shared/protocol.ts';
import { WINS_TO_TAKE_MATCH, judge, type Move } from '../shared/rules.ts';
import { scoreAfterMatch } from '../shared/tiers.ts';
import type { Store } from './store.ts';

/** Who is sitting down: read from the store by the caller, just before they take a seat. */
export interface RoomEntrant {
  id: string;
  name: string;
  score: number;
}

interface ScoreChange {
  before: number;
  after: number;
}

// No 0/O, 1/I/L: codes get read aloud and typed on phones.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export interface RoomTimings {
  /** How long a player may stay disconnected mid-match before they forfeit. */
  forfeitGraceMs: number;
  /** How long an invite stays open with nobody joining. */
  waitingRoomTtlMs: number;
  /** How long a finished room lingers for a rematch. */
  finishedRoomTtlMs: number;
}

interface Seat {
  playerId: string;
  name: string;
  /**
   * The player's score. Only matches change score and a player sits in one room at a time, so
   * while they are here this copy stays right and the room never has to wait on the database.
   */
  score: number;
  pick: Move | null;
  roundWins: number;
  wantsRematch: boolean;
  /** Left for good (or forfeited by staying away); the seat stays so the opponent still sees the result. */
  gone: boolean;
  forfeitTimer: ReturnType<typeof setTimeout> | null;
}

interface Room {
  code: string;
  status: RoomSnapshot['status'];
  matchNumber: number;
  seats: Seat[];
  rounds: [Move, Move][];
  result: { winner: number; reason: 'score' | 'forfeit'; scores: [ScoreChange, ScoreChange] } | null;
  ttlTimer: ReturnType<typeof setTimeout> | null;
}

export class RoomError extends Error {}

/**
 * Live friend matches. Rooms belong to players, not to sockets: a dropped
 * connection keeps its seat and gets the full room state again on reconnect.
 *
 * Everything here happens in memory and at once; finished matches are written
 * to the store in the background, in order.
 */
export class Rooms {
  private rooms = new Map<string, Room>();
  private roomOfPlayer = new Map<string, Room>();
  private writes: Promise<void> = Promise.resolve();
  private store: Store;
  private timings: RoomTimings;
  private isConnected: (playerId: string) => boolean;
  private send: (playerId: string, message: ServerMessage) => void;

  constructor(
    store: Store,
    timings: RoomTimings,
    isConnected: (playerId: string) => boolean,
    send: (playerId: string, message: ServerMessage) => void,
  ) {
    this.store = store;
    this.timings = timings;
    this.isConnected = isConnected;
    this.send = send;
  }

  close() {
    for (const room of this.rooms.values()) this.clearTimers(room);
    this.rooms.clear();
    this.roomOfPlayer.clear();
  }

  /** Resolves once every finished match so far has been written to the store. */
  settled(): Promise<void> {
    return this.writes;
  }

  // ---- connection lifecycle ----

  playerConnected(playerId: string) {
    const room = this.roomOfPlayer.get(playerId);
    if (!room) return this.send(playerId, { t: 'room', room: null });
    const seat = this.seatOf(room, playerId);
    if (seat.forfeitTimer) {
      clearTimeout(seat.forfeitTimer);
      seat.forfeitTimer = null;
    }
    this.broadcast(room);
  }

  playerDisconnected(playerId: string) {
    const room = this.roomOfPlayer.get(playerId);
    if (!room) return;
    if (room.status === 'playing') {
      const seat = this.seatOf(room, playerId);
      seat.forfeitTimer ??= setTimeout(() => {
        seat.forfeitTimer = null;
        this.forfeit(room, seat);
      }, this.timings.forfeitGraceMs);
    }
    this.broadcast(room);
  }

  // ---- player actions ----

  create(player: RoomEntrant) {
    const playerId = player.id;
    this.leaveForNewRoom(playerId);
    const room: Room = {
      code: this.freshCode(),
      status: 'waiting',
      matchNumber: 0,
      seats: [this.newSeat(player)],
      rounds: [],
      result: null,
      ttlTimer: null,
    };
    this.rooms.set(room.code, room);
    this.roomOfPlayer.set(playerId, room);
    this.expireAfter(room, this.timings.waitingRoomTtlMs);
    this.broadcast(room);
  }

  join(player: RoomEntrant, rawCode: string) {
    const playerId = player.id;
    const code = rawCode.trim().toUpperCase();
    const room = this.rooms.get(code);
    if (!room) throw new RoomError('No room with that code');
    if (room.seats[0].playerId === playerId && room.status === 'waiting') {
      throw new RoomError('That is your own room. Share the code with a friend');
    }
    if (room.status !== 'waiting') throw new RoomError('That room is already full');
    this.leaveForNewRoom(playerId);

    room.seats.push(this.newSeat(player));
    this.roomOfPlayer.set(playerId, room);
    this.startMatch(room);
    // The inviter may have dropped while the share sheet was open; hold them to the same grace period.
    for (const seat of room.seats) {
      if (!this.isConnected(seat.playerId)) this.playerDisconnected(seat.playerId);
    }
    this.broadcast(room);
  }

  pick(playerId: string, move: Move) {
    const room = this.roomOfPlayer.get(playerId);
    if (!room || room.status !== 'playing') throw new RoomError('No match in progress');
    const seat = this.seatOf(room, playerId);
    if (seat.pick) throw new RoomError('You already picked this round');
    seat.pick = move;

    const [a, b] = room.seats;
    if (a.pick && b.pick) {
      const outcome = judge(a.pick, b.pick);
      room.rounds.push([a.pick, b.pick]);
      a.pick = b.pick = null;
      if (outcome === 'win') a.roundWins++;
      if (outcome === 'lose') b.roundWins++;
      const winner = room.seats.findIndex((s) => s.roundWins >= WINS_TO_TAKE_MATCH);
      if (winner !== -1) return this.finish(room, winner, 'score');
    }
    this.broadcast(room);
  }

  rematch(playerId: string) {
    const room = this.roomOfPlayer.get(playerId);
    if (!room || room.status !== 'over') throw new RoomError('No finished match to replay');
    if (room.seats.some((seat) => seat.gone)) throw new RoomError('Your opponent has left');
    this.seatOf(room, playerId).wantsRematch = true;
    if (room.seats.every((seat) => seat.wantsRematch)) {
      this.startMatch(room);
      for (const seat of room.seats) {
        if (!this.isConnected(seat.playerId)) this.playerDisconnected(seat.playerId);
      }
    }
    this.broadcast(room);
  }

  leave(playerId: string) {
    const room = this.roomOfPlayer.get(playerId);
    if (!room) return this.send(playerId, { t: 'room', room: null });
    const seat = this.seatOf(room, playerId);
    if (room.status === 'playing') {
      this.forfeit(room, seat);
    } else {
      this.vacate(room, seat);
      this.broadcast(room);
    }
    this.send(playerId, { t: 'room', room: null });
  }

  // ---- internals ----

  private newSeat(player: RoomEntrant): Seat {
    return {
      playerId: player.id,
      name: player.name,
      score: player.score,
      pick: null,
      roundWins: 0,
      wantsRematch: false,
      gone: false,
      forfeitTimer: null,
    };
  }

  private seatOf(room: Room, playerId: string): Seat {
    return room.seats.find((seat) => seat.playerId === playerId && !seat.gone)!;
  }

  private freshCode(): string {
    for (;;) {
      let code = '';
      for (let i = 0; i < ROOM_CODE_LENGTH; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
      if (!this.rooms.has(code)) return code;
    }
  }

  /** A player can only be in one room; starting another walks out of an idle one. */
  private leaveForNewRoom(playerId: string) {
    const current = this.roomOfPlayer.get(playerId);
    if (!current) return;
    if (current.status === 'playing') throw new RoomError('Finish your current match first');
    this.vacate(current, this.seatOf(current, playerId));
    this.broadcast(current);
  }

  private startMatch(room: Room) {
    room.status = 'playing';
    room.matchNumber++;
    room.rounds = [];
    room.result = null;
    for (const seat of room.seats) {
      seat.pick = null;
      seat.roundWins = 0;
      seat.wantsRematch = false;
    }
    if (room.ttlTimer) clearTimeout(room.ttlTimer);
    room.ttlTimer = null;
  }

  private forfeit(room: Room, loser: Seat) {
    if (room.status !== 'playing') return;
    this.finish(room, room.seats.indexOf(loser) === 0 ? 1 : 0, 'forfeit');
    this.vacate(room, loser);
    this.broadcast(room);
    this.send(loser.playerId, { t: 'room', room: null });
  }

  private finish(room: Room, winner: number, reason: 'score' | 'forfeit') {
    room.status = 'over';
    const scores = room.seats.map((seat, index): ScoreChange => {
      const before = seat.score;
      seat.score = scoreAfterMatch(before, index === winner);
      return { before, after: seat.score };
    });
    room.result = { winner, reason, scores: [scores[0], scores[1]] };
    for (const seat of room.seats) {
      seat.pick = null;
      if (seat.forfeitTimer) clearTimeout(seat.forfeitTimer);
      seat.forfeitTimer = null;
    }
    this.expireAfter(room, this.timings.finishedRoomTtlMs);
    this.broadcast(room);
    this.save(room.seats[winner].playerId, room.seats[winner === 0 ? 1 : 0].playerId);
  }

  /** Writes a finished match to the store, then sends both players their updated records. */
  private save(winnerId: string, loserId: string) {
    this.writes = this.writes
      .then(async () => {
        await this.store.recordPvpMatch(winnerId, loserId);
        for (const playerId of [winnerId, loserId]) {
          this.send(playerId, { t: 'profile', profile: await this.store.profile(playerId) });
        }
      })
      .catch((error) => {
        console.error('Could not save a finished match:', error);
        for (const playerId of [winnerId, loserId]) {
          this.send(playerId, { t: 'error', message: 'This result could not be saved' });
        }
      });
  }

  /** Takes a player out of a room that is not mid-match, deleting the room once nobody is left. */
  private vacate(room: Room, seat: Seat) {
    seat.gone = true;
    seat.wantsRematch = false;
    if (this.roomOfPlayer.get(seat.playerId) === room) this.roomOfPlayer.delete(seat.playerId);
    if (room.seats.every((s) => s.gone)) this.destroy(room);
  }

  private expireAfter(room: Room, ms: number) {
    if (room.ttlTimer) clearTimeout(room.ttlTimer);
    room.ttlTimer = setTimeout(() => {
      const players = room.seats.filter((seat) => !seat.gone).map((seat) => seat.playerId);
      this.destroy(room);
      for (const playerId of players) this.send(playerId, { t: 'room', room: null });
    }, ms);
  }

  private clearTimers(room: Room) {
    if (room.ttlTimer) clearTimeout(room.ttlTimer);
    for (const seat of room.seats) if (seat.forfeitTimer) clearTimeout(seat.forfeitTimer);
  }

  private destroy(room: Room) {
    this.clearTimers(room);
    this.rooms.delete(room.code);
    for (const seat of room.seats) {
      if (this.roomOfPlayer.get(seat.playerId) === room) this.roomOfPlayer.delete(seat.playerId);
    }
  }

  private broadcast(room: Room) {
    if (!this.rooms.has(room.code)) return;
    room.seats.forEach((seat, index) => {
      if (!seat.gone) this.send(seat.playerId, { t: 'room', room: this.snapshot(room, index) });
    });
  }

  private snapshot(room: Room, index: number): RoomSnapshot {
    const other = index === 0 ? 1 : 0;
    const view = (seatIndex: number): RoomPlayer => {
      const seat = room.seats[seatIndex];
      return {
        name: seat.name,
        score: seat.score,
        roundWins: seat.roundWins,
        picked: seat.pick !== null,
        connected: !seat.gone && this.isConnected(seat.playerId),
        wantsRematch: seat.wantsRematch,
      };
    };
    return {
      code: room.code,
      status: room.status,
      matchNumber: room.matchNumber,
      you: view(index),
      opponent: room.seats[other] ? view(other) : null,
      rounds: room.rounds.map((moves) => ({
        you: moves[index],
        opponent: moves[other],
        outcome: judge(moves[index], moves[other]),
      })),
      result: room.result && {
        youWon: room.result.winner === index,
        reason: room.result.reason,
        scoreBefore: room.result.scores[index].before,
        scoreAfter: room.result.scores[index].after,
      },
    };
  }
}
