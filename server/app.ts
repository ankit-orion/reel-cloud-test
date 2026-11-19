import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { WebSocketServer, type WebSocket } from 'ws';

import { nameProblem, type ClientMessage, type ServerMessage } from '../shared/protocol.ts';
import { isMove } from '../shared/rules.ts';
import { RoomError, Rooms, type RoomTimings } from './rooms.ts';
import { NameTakenError, Store } from './store.ts';

export interface ServerOptions extends Partial<RoomTimings> {
  port: number;
  /** SQLite file path, or ':memory:'. */
  dbPath: string;
  /** How often connections are pinged; one missed ping drops the connection. */
  heartbeatMs?: number;
}

const LEADERBOARD_SIZE = 50;
const MAX_BODY_BYTES = 4096;
/** Upper bound on computer matches accepted in one report, so a profile can't be inflated in one call. */
const MAX_CPU_MATCHES_PER_REPORT = 200;

// Close codes the app understands.
const CLOSE_BAD_TOKEN = 4003;
const CLOSE_REPLACED = 4001;

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function readJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw new HttpError(413, 'Request too large');
    chunks.push(chunk);
  }
  try {
    const body: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (typeof body === 'object' && body !== null) return body as Record<string, unknown>;
  } catch {
    // fall through
  }
  throw new HttpError(400, 'Expected a JSON object');
}

const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0;

export async function startServer(options: ServerOptions) {
  const store = new Store(options.dbPath);
  const sockets = new Map<string, WebSocket>();

  const sendTo = (playerId: string, message: ServerMessage) => {
    const socket = sockets.get(playerId);
    if (socket?.readyState === socket?.OPEN) socket?.send(JSON.stringify(message));
  };

  const rooms = new Rooms(
    store,
    {
      forfeitGraceMs: options.forfeitGraceMs ?? 30_000,
      waitingRoomTtlMs: options.waitingRoomTtlMs ?? 15 * 60_000,
      finishedRoomTtlMs: options.finishedRoomTtlMs ?? 10 * 60_000,
    },
    (playerId) => sockets.has(playerId),
    sendTo,
  );

  // ---- HTTP: registration, profile, leaderboard, computer-match reports ----

  const authenticate = (request: IncomingMessage): string => {
    const header = request.headers.authorization ?? '';
    const id = header.startsWith('Bearer ') ? store.idForToken(header.slice(7)) : null;
    if (!id) throw new HttpError(401, 'Sign in again');
    return id;
  };

  const route = async (request: IncomingMessage): Promise<unknown> => {
    const path = new URL(request.url ?? '/', 'http://localhost').pathname;
    const key = `${request.method} ${path}`;

    if (key === 'GET /health') return { ok: true };

    if (key === 'POST /api/register') {
      const body = await readJson(request);
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      const problem = nameProblem(name);
      if (problem) throw new HttpError(400, problem);
      try {
        const { token, id } = store.register(name);
        return { token, profile: store.profile(id) };
      } catch (error) {
        if (error instanceof NameTakenError) throw new HttpError(409, 'That name is taken');
        throw error;
      }
    }

    if (key === 'GET /api/me') return { profile: store.profile(authenticate(request)) };

    if (key === 'GET /api/leaderboard') return { entries: store.leaderboard(LEADERBOARD_SIZE) };

    if (key === 'POST /api/cpu-matches') {
      const id = authenticate(request);
      const { wins, losses } = await readJson(request);
      if (!isCount(wins) || !isCount(losses) || wins + losses > MAX_CPU_MATCHES_PER_REPORT) {
        throw new HttpError(400, 'Invalid match counts');
      }
      store.recordCpuMatches(id, wins, losses);
      return { profile: store.profile(id) };
    }

    throw new HttpError(404, 'Not found');
  };

  const handle = async (request: IncomingMessage, response: ServerResponse) => {
    // The app has no cookies or ambient credentials; every call carries its own token.
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    if (request.method === 'OPTIONS') return response.writeHead(204).end();

    let status = 200;
    let body: unknown;
    try {
      body = await route(request);
    } catch (error) {
      if (error instanceof HttpError) {
        status = error.status;
        body = { error: error.message };
      } else {
        console.error(error);
        status = 500;
        body = { error: 'Something went wrong' };
      }
    }
    response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    response.end(JSON.stringify(body));
  };

  const http = createServer((request, response) => void handle(request, response));

  // ---- WebSocket: live friend matches ----

  const wss = new WebSocketServer({ server: http, path: '/ws', maxPayload: MAX_BODY_BYTES });
  const alive = new WeakSet<WebSocket>();

  const act = (playerId: string, message: ClientMessage) => {
    switch (message.t) {
      case 'create':
        return rooms.create(playerId);
      case 'join':
        if (typeof message.code !== 'string') throw new RoomError('Enter a room code');
        return rooms.join(playerId, message.code);
      case 'pick':
        if (!isMove(message.move)) throw new RoomError('Unknown move');
        return rooms.pick(playerId, message.move);
      case 'rematch':
        return rooms.rematch(playerId);
      case 'leave':
        return rooms.leave(playerId);
      default:
        throw new RoomError('Unknown message');
    }
  };

  wss.on('connection', (socket) => {
    let playerId: string | null = null;
    const reply = (message: ServerMessage) => socket.send(JSON.stringify(message));
    alive.add(socket);
    socket.on('pong', () => alive.add(socket));

    socket.on('message', (data) => {
      let message: ClientMessage;
      try {
        message = JSON.parse(String(data));
        if (typeof message !== 'object' || message === null) throw new Error();
      } catch {
        return reply({ t: 'error', message: 'Malformed message' });
      }

      if (playerId === null) {
        const id = message.t === 'hello' && typeof message.token === 'string' ? store.idForToken(message.token) : null;
        if (!id) return socket.close(CLOSE_BAD_TOKEN, 'Sign in again');
        // One live connection per player: the newest device wins.
        sockets.get(id)?.close(CLOSE_REPLACED, 'Signed in elsewhere');
        playerId = id;
        sockets.set(id, socket);
        reply({ t: 'profile', profile: store.profile(id) });
        return rooms.playerConnected(id);
      }

      try {
        act(playerId, message);
      } catch (error) {
        if (error instanceof RoomError) return reply({ t: 'error', message: error.message });
        console.error(error);
        reply({ t: 'error', message: 'Something went wrong' });
      }
    });

    socket.on('close', () => {
      if (playerId !== null && sockets.get(playerId) === socket) {
        sockets.delete(playerId);
        rooms.playerDisconnected(playerId);
      }
    });
    socket.on('error', () => socket.terminate());
  });

  // Phones drop off networks without saying goodbye; pings find those dead connections.
  const heartbeat = setInterval(() => {
    for (const socket of wss.clients) {
      if (!alive.has(socket)) {
        socket.terminate();
        continue;
      }
      alive.delete(socket);
      socket.ping();
    }
  }, options.heartbeatMs ?? 10_000);

  await new Promise<void>((resolve) => http.listen(options.port, resolve));

  return {
    port: (http.address() as AddressInfo).port,
    async close() {
      clearInterval(heartbeat);
      rooms.close();
      for (const socket of wss.clients) socket.terminate();
      await new Promise((resolve) => wss.close(resolve));
      await new Promise((resolve) => http.close(resolve));
      store.close();
    },
  };
}
