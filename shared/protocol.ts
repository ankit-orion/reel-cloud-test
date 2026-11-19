// Wire format between the app and the server: JSON over HTTP for profiles and
// the leaderboard, JSON over one WebSocket for live friend matches.

import type { Move, Outcome } from './rules.ts';

export const NAME_MIN_LENGTH = 3;
export const NAME_MAX_LENGTH = 12;
/** Letters, digits and underscores only, so names stay readable in the pixel font. */
export const NAME_PATTERN = /^[A-Za-z0-9_]+$/;
export const ROOM_CODE_LENGTH = 5;

export function nameProblem(name: string): string | null {
  if (name.length < NAME_MIN_LENGTH) return `Use at least ${NAME_MIN_LENGTH} characters`;
  if (name.length > NAME_MAX_LENGTH) return `Use at most ${NAME_MAX_LENGTH} characters`;
  if (!NAME_PATTERN.test(name)) return 'Use letters, numbers and _ only';
  return null;
}

export interface Profile {
  id: string;
  name: string;
  /** Leaderboard score. Only matches against real players change it. */
  score: number;
  pvpWins: number;
  pvpLosses: number;
  /** Matches against the computer: shown on the profile, never scored. */
  cpuWins: number;
  cpuLosses: number;
  /** 1-based leaderboard position, or null before the first match against a real player. */
  rank: number | null;
}

export interface LeaderboardEntry {
  rank: number;
  id: string;
  name: string;
  score: number;
  wins: number;
  losses: number;
}

export interface RegisterResponse {
  /** Secret that identifies this device's player. Shown to nobody else. */
  token: string;
  profile: Profile;
}

export interface LeaderboardResponse {
  entries: LeaderboardEntry[];
}

export interface ApiError {
  error: string;
}

// ---- WebSocket ----

export interface RoomPlayer {
  name: string;
  score: number;
  /** Rounds won in the current match. */
  roundWins: number;
  /** Has locked in a move for the current round. The move itself stays secret until both have. */
  picked: boolean;
  connected: boolean;
  wantsRematch: boolean;
}

export interface RoomRound {
  you: Move;
  opponent: Move;
  outcome: Outcome;
}

export interface RoomResult {
  youWon: boolean;
  /** 'forfeit' when the loser left or stayed disconnected too long. */
  reason: 'score' | 'forfeit';
  scoreBefore: number;
  scoreAfter: number;
}

/** Everything one player may know about their room, re-sent in full on every change. */
export interface RoomSnapshot {
  code: string;
  status: 'waiting' | 'playing' | 'over';
  /** Counts up with each rematch, so the app can tell a fresh match from the last one. */
  matchNumber: number;
  you: RoomPlayer;
  opponent: RoomPlayer | null;
  /** Completed rounds of the current match, oldest first. */
  rounds: RoomRound[];
  result: RoomResult | null;
}

export type ClientMessage =
  | { t: 'hello'; token: string }
  | { t: 'create' }
  | { t: 'join'; code: string }
  | { t: 'pick'; move: Move }
  | { t: 'rematch' }
  | { t: 'leave' };

export type ServerMessage =
  /** Sent after a valid hello, and again whenever the player's own record changes. */
  | { t: 'profile'; profile: Profile }
  /** `room` is null when the player is not in a room. */
  | { t: 'room'; room: RoomSnapshot | null }
  | { t: 'error'; message: string };
