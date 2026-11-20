import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import type { ClientMessage, Profile, RoomSnapshot, ServerMessage } from '../../shared/protocol';
import type { Move } from '../../shared/rules';
import { socketUrlFor } from './config';

// Close codes sent by the server.
const CLOSE_REPLACED = 4001;
const CLOSE_BAD_TOKEN = 4003;

/** 'replaced' means this player signed in somewhere else; we stop reconnecting so the two don't fight. */
export type ConnectionStatus = 'connecting' | 'online' | 'replaced';

interface Handlers {
  onProfile: (profile: Profile) => void;
  /** The server no longer knows this device's player. */
  onAuthLost: () => void;
}

/**
 * The live connection used for friend matches. Reconnects on its own; the
 * server re-sends the full room on every connect, so nothing is lost by a drop.
 */
export function useRoom(token: string | null, serverUrl: string, handlers: Handlers) {
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [room, setRoom] = useState<RoomSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef(handlers);
  useLayoutEffect(() => {
    latest.current = handlers;
  });
  const link = useRef<{ send: (message: ClientMessage) => void; reconnect: () => void } | null>(null);

  useEffect(() => {
    if (!token) return;
    let socket: WebSocket | null = null;
    let disposed = false;
    let replaced = false;
    let attempt = 0;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    const connect = () => {
      clearTimeout(retryTimer);
      replaced = false;
      setStatus('connecting');
      const ws = new WebSocket(socketUrlFor(serverUrl));
      socket = ws;
      ws.onopen = () => ws.send(JSON.stringify({ t: 'hello', token } satisfies ClientMessage));
      ws.onmessage = (event) => {
        if (socket !== ws) return;
        const message = JSON.parse(String(event.data)) as ServerMessage;
        if (message.t === 'profile') {
          // The first profile message doubles as "you are signed in".
          attempt = 0;
          setStatus('online');
          latest.current.onProfile(message.profile);
        } else if (message.t === 'room') {
          setRoom(message.room);
        } else if (message.t === 'error') {
          setError(message.message);
        }
      };
      ws.onclose = (event) => {
        if (socket !== ws || disposed) return;
        socket = null;
        if (event.code === CLOSE_BAD_TOKEN) return latest.current.onAuthLost();
        if (event.code === CLOSE_REPLACED) {
          replaced = true;
          return setStatus('replaced');
        }
        setStatus('connecting');
        retryTimer = setTimeout(connect, Math.min(8000, 500 * 2 ** attempt++));
      };
    };

    connect();
    // Coming back to the app: don't wait out a backoff timer.
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && !socket && !replaced) connect();
    });
    link.current = {
      send: (message) => {
        if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
        else setError('Not connected. Trying again...');
      },
      reconnect: connect,
    };

    return () => {
      disposed = true;
      clearTimeout(retryTimer);
      subscription.remove();
      socket?.close();
      link.current = null;
      setRoom(null);
      setError(null);
    };
  }, [token, serverUrl]);

  const send = useCallback((message: ClientMessage) => {
    setError(null);
    link.current?.send(message);
  }, []);

  return {
    status,
    room,
    error,
    clearError: useCallback(() => setError(null), []),
    reconnect: useCallback(() => link.current?.reconnect(), []),
    create: useCallback(() => send({ t: 'create' }), [send]),
    join: useCallback((code: string) => send({ t: 'join', code }), [send]),
    pick: useCallback((move: Move) => send({ t: 'pick', move }), [send]),
    rematch: useCallback(() => send({ t: 'rematch' }), [send]),
    leave: useCallback(() => send({ t: 'leave' }), [send]),
  };
}

export type RoomLink = ReturnType<typeof useRoom>;
