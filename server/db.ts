import pg from 'pg';

/** The little the server needs from a database: run one SQL statement, get rows back. */
export interface Db {
  query<T>(sql: string, params?: unknown[]): Promise<T[]>;
  close(): Promise<void>;
}

/** A hosted Postgres database, reached by connection string (for example from Neon). */
export function openPostgres(connectionString: string): Db {
  const pool = new pg.Pool({ connectionString, max: 5 });
  // Hosted databases drop idle connections when they go to sleep. The pool replaces them on the
  // next query; without this handler the dropped connection would crash the server instead.
  pool.on('error', (error) => console.error('Database connection dropped:', error.message));
  return {
    query: async <T>(sql: string, params: unknown[] = []) => (await pool.query(sql, params)).rows as T[],
    close: () => pool.end(),
  };
}

/**
 * Postgres running inside this process, for development and tests: nothing to install or sign
 * up for. `dataDir` is where it keeps its files; null keeps everything in memory.
 */
export async function openEmbedded(dataDir: string | null): Promise<Db> {
  // Loaded on demand so a server using a hosted database never pays for it.
  const { PGlite } = await import('@electric-sql/pglite');
  const database = await PGlite.create(dataDir ?? undefined);
  return {
    query: async <T>(sql: string, params: unknown[] = []) => (await database.query<T>(sql, params)).rows,
    close: () => database.close(),
  };
}
