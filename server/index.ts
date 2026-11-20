import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { startServer } from './app.ts';
import { openEmbedded, openPostgres } from './db.ts';

const port = Number(process.env.PORT ?? 8787);

// On a host, DATABASE_URL points at a hosted Postgres database (for example Neon), so player
// records survive the host wiping its disk. Without it the server keeps its own database in
// DATA_DIR, which is all local development needs.
const databaseUrl = process.env.DATABASE_URL;
let storage: string;
let db;
if (databaseUrl) {
  db = openPostgres(databaseUrl);
  storage = 'hosted database';
} else {
  const dataDir = process.env.DATA_DIR ?? join(import.meta.dirname, 'data');
  mkdirSync(dataDir, { recursive: true });
  db = await openEmbedded(join(dataDir, 'pg'));
  storage = `local database in ${dataDir}`;
}

const server = await startServer({ port, db });
console.log(`Rock Paper Scissors server listening on port ${server.port} (${storage})`);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => void server.close().then(() => process.exit(0)));
}
