import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

import type { LeaderboardEntry, Profile } from '../shared/protocol.ts';
import { scoreAfterMatch } from '../shared/tiers.ts';

interface PlayerRow {
  seq: number;
  id: string;
  name: string;
  score: number;
  pvp_wins: number;
  pvp_losses: number;
  cpu_wins: number;
  cpu_losses: number;
}

export class NameTakenError extends Error {}

/** Names nobody may register, so no player can pose as the computer opponent. */
const RESERVED_NAMES = new Set(['cpu', 'computer']);

// Leaderboard order: score, then wins, then whoever registered first.
const AHEAD_OF = `
  (score > :score
    OR (score = :score AND pvp_wins > :wins)
    OR (score = :score AND pvp_wins = :wins AND seq < :seq))`;

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export interface ScoreChange {
  before: number;
  after: number;
}

/** All persistent state: players, their records and their scores. */
export class Store {
  private db: DatabaseSync;

  constructor(path: string) {
    this.db = new DatabaseSync(path);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS players (
        seq INTEGER PRIMARY KEY AUTOINCREMENT,
        id TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        name_key TEXT NOT NULL UNIQUE,
        token_hash TEXT NOT NULL UNIQUE,
        score INTEGER NOT NULL DEFAULT 0,
        pvp_wins INTEGER NOT NULL DEFAULT 0,
        pvp_losses INTEGER NOT NULL DEFAULT 0,
        cpu_wins INTEGER NOT NULL DEFAULT 0,
        cpu_losses INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS players_by_score ON players (score DESC, pvp_wins DESC, seq ASC);
    `);
  }

  close() {
    this.db.close();
  }

  /** Creates a player and returns the secret token their device signs in with. */
  register(name: string): { token: string; id: string } {
    const key = name.toLowerCase();
    if (RESERVED_NAMES.has(key)) throw new NameTakenError();
    const id = randomUUID();
    const token = randomBytes(32).toString('hex');
    try {
      this.db
        .prepare('INSERT INTO players (id, name, name_key, token_hash, created_at) VALUES (?, ?, ?, ?, ?)')
        .run(id, name, key, hashToken(token), Date.now());
    } catch (error) {
      if (String(error).includes('players.name_key')) throw new NameTakenError();
      throw error;
    }
    return { token, id };
  }

  idForToken(token: string): string | null {
    const row = this.db.prepare('SELECT id FROM players WHERE token_hash = ?').get(hashToken(token)) as
      | { id: string }
      | undefined;
    return row?.id ?? null;
  }

  private row(id: string): PlayerRow {
    const row = this.db.prepare('SELECT * FROM players WHERE id = ?').get(id) as PlayerRow | undefined;
    if (!row) throw new Error(`Unknown player ${id}`);
    return row;
  }

  profile(id: string): Profile {
    const row = this.row(id);
    let rank: number | null = null;
    if (row.pvp_wins + row.pvp_losses > 0) {
      const ahead = this.db
        .prepare(`SELECT COUNT(*) AS n FROM players WHERE pvp_wins + pvp_losses > 0 AND ${AHEAD_OF}`)
        .get({ score: row.score, wins: row.pvp_wins, seq: row.seq }) as { n: number };
      rank = ahead.n + 1;
    }
    return {
      id: row.id,
      name: row.name,
      score: row.score,
      pvpWins: row.pvp_wins,
      pvpLosses: row.pvp_losses,
      cpuWins: row.cpu_wins,
      cpuLosses: row.cpu_losses,
      rank,
    };
  }

  /** Top players by score. Only players with at least one match against a real player appear. */
  leaderboard(limit: number): LeaderboardEntry[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM players WHERE pvp_wins + pvp_losses > 0
         ORDER BY score DESC, pvp_wins DESC, seq ASC LIMIT ?`,
      )
      .all(limit) as unknown as PlayerRow[];
    return rows.map((row, index) => ({
      rank: index + 1,
      id: row.id,
      name: row.name,
      score: row.score,
      wins: row.pvp_wins,
      losses: row.pvp_losses,
    }));
  }

  /** Records a finished match between two real players. The only place score changes. */
  recordPvpMatch(winnerId: string, loserId: string): { winner: ScoreChange; loser: ScoreChange } {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const winner = this.row(winnerId);
      const loser = this.row(loserId);
      const change = {
        winner: { before: winner.score, after: scoreAfterMatch(winner.score, true) },
        loser: { before: loser.score, after: scoreAfterMatch(loser.score, false) },
      };
      this.db
        .prepare('UPDATE players SET score = ?, pvp_wins = pvp_wins + 1 WHERE id = ?')
        .run(change.winner.after, winnerId);
      this.db
        .prepare('UPDATE players SET score = ?, pvp_losses = pvp_losses + 1 WHERE id = ?')
        .run(change.loser.after, loserId);
      this.db.exec('COMMIT');
      return change;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  /** Adds matches against the computer to a profile. Never touches score. */
  recordCpuMatches(id: string, wins: number, losses: number) {
    this.db
      .prepare('UPDATE players SET cpu_wins = cpu_wins + ?, cpu_losses = cpu_losses + ? WHERE id = ?')
      .run(wins, losses, id);
  }
}
