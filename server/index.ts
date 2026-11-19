import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { startServer } from './app.ts';

const port = Number(process.env.PORT ?? 8787);
// Player records live in this folder. On a host, point it at a persistent disk.
const dataDir = process.env.DATA_DIR ?? join(import.meta.dirname, 'data');
mkdirSync(dataDir, { recursive: true });

const server = await startServer({ port, dbPath: join(dataDir, 'rps.sqlite') });
console.log(`Rock Paper Scissors server listening on port ${server.port} (data in ${dataDir})`);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => void server.close().then(() => process.exit(0)));
}
