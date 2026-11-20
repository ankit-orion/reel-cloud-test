import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { setTimeout as sleep } from 'node:timers/promises';

import type {
  ClientMessage,
  LeaderboardResponse,
  Profile,
  RegisterResponse,
  RoomSnapshot,
  ServerMessage,
} from '../shared/protocol.ts';
import type { Move } from '../shared/rules.ts';
import { LOSS_POINTS, WIN_POINTS } from '../shared/tiers.ts';
import { startServer } from './app.ts';
import { openEmbedded, openPostgres } from './db.ts';

const FORFEIT_GRACE_MS = 300;

let server: Awaited<ReturnType<typeof startServer>>;
let base: string;

before(async () => {
  // By default the tests use the embedded database. Set TEST_DATABASE_URL to run the same tests
  // against a real Postgres server; its players table is dropped first.
  const url = process.env.TEST_DATABASE_URL;
  const db = url ? openPostgres(url) : await openEmbedded(null);
  if (url) await db.query('DROP TABLE IF EXISTS players');
  server = await startServer({ port: 0, db, forfeitGraceMs: FORFEIT_GRACE_MS });
  base = `http://127.0.0.1:${server.port}`;
});
after(() => server.close());

async function api<T>(method: string, path: string, token?: string, body?: unknown) {
  const response = await fetch(base + path, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, body: (await response.json()) as T & { error?: string } };
}

let nameCounter = 0;
async function register(prefix = 'player') {
  const { status, body } = await api<RegisterResponse>('POST', '/api/register', undefined, {
    name: `${prefix}_${++nameCounter}`,
  });
  assert.equal(status, 200);
  return body;
}

const me = async (token: string) => (await api<{ profile: Profile }>('GET', '/api/me', token)).body.profile;

/** A WebSocket client that records every message and lets tests wait for the one they need. */
class Client {
  socket: WebSocket;
  messages: ServerMessage[] = [];
  closed: Promise<number>;
  private waiters: (() => void)[] = [];

  constructor(token: string) {
    this.socket = new WebSocket(`ws://127.0.0.1:${server.port}/ws`);
    this.socket.onopen = () => this.send({ t: 'hello', token });
    this.socket.onmessage = (event) => {
      this.messages.push(JSON.parse(String(event.data)));
      for (const wake of this.waiters.splice(0)) wake();
    };
    this.closed = new Promise((resolve) => {
      this.socket.onclose = (event) => resolve(event.code);
    });
  }

  send(message: ClientMessage) {
    this.socket.send(JSON.stringify(message));
  }

  /** Resolves with the first message (seen from now on, or already buffered) that `match` accepts. */
  async next<T>(match: (message: ServerMessage) => T | null | undefined | false, timeoutMs = 2000): Promise<T> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      while (this.messages.length > 0) {
        const found = match(this.messages.shift()!);
        if (found) return found;
      }
      const remaining = deadline - Date.now();
      if (remaining <= 0) throw new Error('Timed out waiting for a server message');
      await Promise.race([new Promise<void>((resolve) => this.waiters.push(resolve)), sleep(remaining)]);
    }
  }

  room(match: (room: RoomSnapshot) => boolean = () => true) {
    return this.next((m) => m.t === 'room' && m.room !== null && match(m.room) && m.room);
  }

  noRoom() {
    return this.next((m) => m.t === 'room' && m.room === null);
  }

  error() {
    return this.next((m) => m.t === 'error' && m.message);
  }

  /** The record the server sends once a finished match has been written to the database. */
  savedProfile() {
    return this.next((m) => m.t === 'profile' && m.profile);
  }

  close() {
    this.socket.close();
    return this.closed;
  }
}

/** Two registered players sitting in a freshly started match. */
async function startMatch() {
  const [a, b] = [await register(), await register()];
  const [alice, bob] = [new Client(a.token), new Client(b.token)];
  await alice.noRoom();
  await bob.noRoom();
  alice.send({ t: 'create' });
  const { code } = await alice.room((room) => room.status === 'waiting');
  bob.send({ t: 'join', code: code.toLowerCase() });
  await alice.room((room) => room.status === 'playing');
  await bob.room((room) => room.status === 'playing');
  return { a, b, alice, bob, code };
}

async function playRound(alice: Client, bob: Client, aliceMove: Move, bobMove: Move, roundNumber: number) {
  alice.send({ t: 'pick', move: aliceMove });
  bob.send({ t: 'pick', move: bobMove });
  const done = (room: RoomSnapshot) => room.rounds.length === roundNumber || room.status === 'over';
  return [await alice.room(done), await bob.room(done)] as const;
}

test('registration validates and reserves names', async () => {
  const taken = await register('Dupe');
  const again = await api('POST', '/api/register', undefined, { name: taken.profile.name.toUpperCase() });
  assert.equal(again.status, 409);

  for (const name of ['ab', 'way_too_long_name', 'bad name!', 'CPU', '']) {
    const { status } = await api('POST', '/api/register', undefined, { name });
    assert.ok(status === 400 || status === 409, `${JSON.stringify(name)} should be rejected, got ${status}`);
  }
  assert.deepEqual(taken.profile, {
    id: taken.profile.id,
    name: taken.profile.name,
    score: 0,
    pvpWins: 0,
    pvpLosses: 0,
    cpuWins: 0,
    cpuLosses: 0,
    rank: null,
  });
});

test('a friend match is scored, ranked and keeps picks secret', async () => {
  const { a, b, alice, bob } = await startMatch();

  // One player locking in reveals that they picked, never what they picked.
  alice.send({ t: 'pick', move: 'rock' });
  const waiting = await bob.room((room) => room.opponent!.picked);
  assert.equal(waiting.rounds.length, 0);
  assert.ok(!JSON.stringify(waiting).includes('rock'));
  alice.send({ t: 'pick', move: 'paper' });
  assert.equal(await alice.error(), 'You already picked this round');

  bob.send({ t: 'pick', move: 'scissors' });
  const first = await bob.room((room) => room.rounds.length === 1);
  assert.deepEqual(first.rounds[0], { you: 'scissors', opponent: 'rock', outcome: 'lose' });
  assert.equal(first.opponent!.roundWins, 1);
  assert.equal(first.you.picked, false);

  const [draw] = await playRound(alice, bob, 'paper', 'paper', 2);
  assert.equal(draw.rounds[1].outcome, 'draw');
  assert.equal(draw.you.roundWins, 1);

  await playRound(alice, bob, 'paper', 'rock', 3);
  const [aliceEnd, bobEnd] = await playRound(alice, bob, 'scissors', 'paper', 4);

  assert.equal(aliceEnd.status, 'over');
  assert.deepEqual(aliceEnd.result, { youWon: true, reason: 'score', scoreBefore: 0, scoreAfter: WIN_POINTS });
  assert.deepEqual(bobEnd.result, { youWon: false, reason: 'score', scoreBefore: 0, scoreAfter: 0 });
  assert.equal(aliceEnd.rounds.length, 4);

  // Each player is sent their new record once it is saved, and it matches what the API reports.
  const [pushedToWinner, pushedToLoser] = [await alice.savedProfile(), await bob.savedProfile()];
  const [winner, loser] = [await me(a.token), await me(b.token)];
  assert.deepEqual(pushedToWinner, winner);
  assert.deepEqual(pushedToLoser, loser);
  assert.deepEqual([winner.score, winner.pvpWins, winner.pvpLosses], [WIN_POINTS, 1, 0]);
  assert.deepEqual([loser.score, loser.pvpWins, loser.pvpLosses], [0, 0, 1]);
  assert.ok(winner.rank! < loser.rank!);

  const board = (await api<LeaderboardResponse>('GET', '/api/leaderboard')).body.entries;
  const names = board.map((entry) => entry.name);
  assert.ok(names.indexOf(a.profile.name) < names.indexOf(b.profile.name));
  assert.deepEqual(
    board.map((entry) => entry.rank),
    board.map((_, index) => index + 1),
  );
  await Promise.all([alice.close(), bob.close()]);
});

test('computer matches show on the profile but never on the leaderboard', async () => {
  const solo = await register('solo');
  const report = await api<{ profile: Profile }>('POST', '/api/cpu-matches', solo.token, { wins: 3, losses: 1 });
  assert.equal(report.status, 200);
  assert.deepEqual(
    [report.body.profile.cpuWins, report.body.profile.cpuLosses, report.body.profile.score, report.body.profile.rank],
    [3, 1, 0, null],
  );
  const board = (await api<LeaderboardResponse>('GET', '/api/leaderboard')).body.entries;
  assert.ok(!board.some((entry) => entry.id === solo.profile.id));

  assert.equal((await api('POST', '/api/cpu-matches', undefined, { wins: 1, losses: 0 })).status, 401);
  for (const body of [{ wins: -1, losses: 0 }, { wins: 1.5, losses: 0 }, { wins: 1 }, { wins: 5000, losses: 0 }]) {
    assert.equal((await api('POST', '/api/cpu-matches', solo.token, body)).status, 400);
  }
  assert.equal((await me(solo.token)).cpuWins, 3);
});

test('a rematch needs both players and starts a fresh match', async () => {
  const { alice, bob } = await startMatch();
  for (let round = 1; round <= 3; round++) await playRound(alice, bob, 'rock', 'scissors', round);

  alice.send({ t: 'rematch' });
  const asked = await bob.room((room) => room.opponent!.wantsRematch);
  assert.equal(asked.status, 'over');
  bob.send({ t: 'rematch' });
  const fresh = await alice.room((room) => room.status === 'playing');
  assert.deepEqual([fresh.matchNumber, fresh.rounds.length, fresh.you.roundWins, fresh.result], [2, 0, 0, null]);
  assert.equal(fresh.you.score, WIN_POINTS);
  await Promise.all([alice.close(), bob.close()]);
});

test('leaving mid-match forfeits it', async () => {
  const { a, b, alice, bob } = await startMatch();
  bob.send({ t: 'leave' });
  await bob.noRoom();
  const end = await alice.room((room) => room.status === 'over');
  assert.deepEqual([end.result!.youWon, end.result!.reason], [true, 'forfeit']);
  const afterLeave = await alice.room((room) => !room.opponent!.connected);
  assert.equal(afterLeave.status, 'over');

  await alice.savedProfile();
  alice.send({ t: 'rematch' });
  assert.equal(await alice.error(), 'Your opponent has left');
  assert.equal((await me(a.token)).pvpWins, 1);
  assert.equal((await me(b.token)).pvpLosses, 1);
  await Promise.all([alice.close(), bob.close()]);
});

test('a dropped player can come back within the grace period', async () => {
  const { b, alice, bob } = await startMatch();
  await playRound(alice, bob, 'rock', 'scissors', 1);

  await bob.close();
  const dropped = await alice.room((room) => !room.opponent!.connected);
  assert.equal(dropped.status, 'playing');

  const bobAgain = new Client(b.token);
  const resumed = await bobAgain.room();
  assert.deepEqual([resumed.status, resumed.rounds.length, resumed.opponent!.roundWins], ['playing', 1, 1]);
  await alice.room((room) => room.opponent!.connected);

  await sleep(FORFEIT_GRACE_MS * 1.5);
  const [, still] = await playRound(alice, bobAgain, 'paper', 'scissors', 2);
  assert.equal(still.status, 'playing');
  await Promise.all([alice.close(), bobAgain.close()]);
});

test('staying disconnected past the grace period forfeits', async () => {
  const { a, b, alice, bob } = await startMatch();
  await bob.close();
  const end = await alice.room((room) => room.status === 'over');
  assert.deepEqual([end.result!.youWon, end.result!.reason], [true, 'forfeit']);
  await alice.savedProfile();
  assert.equal((await me(a.token)).score, WIN_POINTS);
  assert.equal((await me(b.token)).pvpLosses, 1);

  // The loser comes back to no room, with the loss already on their profile.
  const bobAgain = new Client(b.token);
  await bobAgain.noRoom();
  await Promise.all([alice.close(), bobAgain.close()]);
});

test('an invite survives the inviter dropping while they share the code', async () => {
  const [a, b] = [await register(), await register()];
  const alice = new Client(a.token);
  await alice.noRoom();
  alice.send({ t: 'create' });
  const { code } = await alice.room();
  await alice.close();

  const aliceAgain = new Client(a.token);
  assert.equal((await aliceAgain.room()).code, code);
  const bob = new Client(b.token);
  await bob.noRoom();
  bob.send({ t: 'join', code });
  assert.equal((await aliceAgain.room((room) => room.status === 'playing')).opponent!.name, b.profile.name);
  await Promise.all([aliceAgain.close(), bob.close()]);
});

test('room errors are reported, and score never drops below zero', async () => {
  const { a, alice, bob, code } = await startMatch();
  const c = await register();
  const carol = new Client(c.token);
  await carol.noRoom();

  carol.send({ t: 'join', code: 'ZZZZZ' });
  assert.equal(await carol.error(), 'No room with that code');
  carol.send({ t: 'join', code });
  assert.equal(await carol.error(), 'That room is already full');
  alice.send({ t: 'create' });
  assert.equal(await alice.error(), 'Finish your current match first');
  carol.send({ t: 'pick', move: 'rock' });
  assert.equal(await carol.error(), 'No match in progress');
  carol.send({ t: 'create' });
  const own = await carol.room();
  carol.send({ t: 'join', code: own.code });
  assert.equal(await carol.error(), 'That is your own room. Share the code with a friend');
  carol.send({ t: 'pick', move: 'lizard' as Move });
  assert.equal(await carol.error(), 'Unknown move');

  // Alice loses a match while on zero: still zero, and a later win starts from there.
  for (let round = 1; round <= 3; round++) await playRound(alice, bob, 'scissors', 'rock', round);
  await alice.savedProfile();
  assert.equal((await me(a.token)).score, 0);
  alice.send({ t: 'rematch' });
  bob.send({ t: 'rematch' });
  await alice.room((room) => room.status === 'playing');
  await bob.room((room) => room.status === 'playing');
  for (let round = 1; round <= 3; round++) await playRound(alice, bob, 'rock', 'scissors', round);
  await alice.savedProfile();
  assert.equal((await me(a.token)).score, WIN_POINTS);
  assert.equal(WIN_POINTS > LOSS_POINTS, true);
  await Promise.all([alice.close(), bob.close(), carol.close()]);
});

test('a bad token is turned away, and a second device replaces the first', async () => {
  const stranger = new Client('not-a-real-token');
  assert.equal(await stranger.closed, 4003);

  const player = await register();
  const phone = new Client(player.token);
  await phone.noRoom();
  const tablet = new Client(player.token);
  await tablet.noRoom();
  assert.equal(await phone.closed, 4001);
  await tablet.close();
});
