import { createHash, randomBytes, randomUUID } from 'node:crypto';

import type { LeaderboardEntry, Profile } from '../shared/protocol.ts';
import { LOSS_POINTS, WIN_POINTS } from '../shared/tiers.ts';
import type { Db } from './db.ts';

interface PlayerRow {
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

// Only players with at least one match against a real player are ranked.
const RANKED = 'pvp_wins + pvp_losses > 0';
// Leaderboard order: score, then wins, then whoever registered first.
const BOARD_ORDER = 'score DESC, pvp_wins DESC, seq ASC';

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

/** All persistent state: players, their records and their scores. */
export class Store {
  private db: Db;

  private constructor(db: Db) {
    this.db = db;
  }

  /** Wraps a database, creating the table on first use. */
  static async open(db: Db): Promise<Store> {
    await db.query(`
      CREATE TABLE IF NOT EXISTS players (
        seq SERIAL PRIMARY KEY,
        id TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        name_key TEXT NOT NULL UNIQUE,
        token_hash TEXT NOT NULL UNIQUE,
        score INTEGER NOT NULL DEFAULT 0,
        pvp_wins INTEGER NOT NULL DEFAULT 0,
        pvp_losses INTEGER NOT NULL DEFAULT 0,
        cpu_wins INTEGER NOT NULL DEFAULT 0,
        cpu_losses INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`);
    await db.query(`CREATE INDEX IF NOT EXISTS players_by_score ON players (${BOARD_ORDER})`);
    return new Store(db);
  }

  close() {
    return this.db.close();
  }

  /** Creates a player and returns the secret token their device signs in with. */
  async register(name: string): Promise<{ token: string; id: string }> {
    const key = name.toLowerCase();
    if (RESERVED_NAMES.has(key)) throw new NameTakenError();
    const id = randomUUID();
    const token = randomBytes(32).toString('hex');
    const created = await this.db.query(
      `INSERT INTO players (id, name, name_key, token_hash) VALUES ($1, $2, $3, $4)
       ON CONFLICT (name_key) DO NOTHING RETURNING id`,
      [id, name, key, hashToken(token)],
    );
    if (created.length === 0) throw new NameTakenError();
    return { token, id };
  }

  async idForToken(token: string): Promise<string | null> {
    const rows = await this.db.query<{ id: string }>('SELECT id FROM players WHERE token_hash = $1', [
      hashToken(token),
    ]);
    return rows[0]?.id ?? null;
  }

  async profile(id: string): Promise<Profile> {
    const rows = await this.db.query<PlayerRow & { rank: number | null }>(
      `SELECT p.*,
         CASE WHEN p.pvp_wins + p.pvp_losses > 0 THEN (
           SELECT COUNT(*)::int + 1 FROM players o
           WHERE o.pvp_wins + o.pvp_losses > 0
             AND (o.score > p.score
               OR (o.score = p.score AND o.pvp_wins > p.pvp_wins)
               OR (o.score = p.score AND o.pvp_wins = p.pvp_wins AND o.seq < p.seq))
         ) END AS rank
       FROM players p WHERE p.id = $1`,
      [id],
    );
    const row = rows[0];
    if (!row) throw new Error(`Unknown player ${id}`);
    return {
      id: row.id,
      name: row.name,
      score: row.score,
      pvpWins: row.pvp_wins,
      pvpLosses: row.pvp_losses,
      cpuWins: row.cpu_wins,
      cpuLosses: row.cpu_losses,
      rank: row.rank,
    };
  }

  /** Top players by score. */
  async leaderboard(limit: number): Promise<LeaderboardEntry[]> {
    const rows = await this.db.query<PlayerRow>(
      `SELECT * FROM players WHERE ${RANKED} ORDER BY ${BOARD_ORDER} LIMIT $1`,
      [limit],
    );
    return rows.map((row, index) => ({
      rank: index + 1,
      id: row.id,
      name: row.name,
      score: row.score,
      wins: row.pvp_wins,
      losses: row.pvp_losses,
    }));
  }

  /**
   * Records a finished match between two real players. The only place score changes, and one
   * statement, so both players' records move together or not at all.
   */
  async recordPvpMatch(winnerId: string, loserId: string): Promise<void> {
    await this.db.query(
      `UPDATE players SET
         score = CASE WHEN id = $1 THEN score + $3 ELSE GREATEST(0, score - $4) END,
         pvp_wins = pvp_wins + CASE WHEN id = $1 THEN 1 ELSE 0 END,
         pvp_losses = pvp_losses + CASE WHEN id = $2 THEN 1 ELSE 0 END
       WHERE id IN ($1, $2)`,
      [winnerId, loserId, WIN_POINTS, LOSS_POINTS],
    );
  }

  /** Adds matches against the computer to a profile. Never touches score. */
  async recordCpuMatches(id: string, wins: number, losses: number): Promise<void> {
    await this.db.query('UPDATE players SET cpu_wins = cpu_wins + $2, cpu_losses = cpu_losses + $3 WHERE id = $1', [
      id,
      wins,
      losses,
    ]);
  }
}
