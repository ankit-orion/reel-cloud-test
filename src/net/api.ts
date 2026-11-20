import type { LeaderboardResponse, Profile, RegisterResponse } from '../../shared/protocol';
import { getServerUrl } from './config';

const TIMEOUT_MS = 8000;

export class ApiError extends Error {
  /** HTTP status, or 0 when the server could not be reached at all. */
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(method: 'GET' | 'POST', path: string, token?: string, body?: unknown): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(getServerUrl() + path, {
      method,
      signal: controller.signal,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    // A free-hosted server sleeps when idle and takes about a minute to wake on the first request.
    throw new ApiError(0, 'Cannot reach the server. It may be waking up: try again in a minute.');
  } finally {
    clearTimeout(timer);
  }
  const data = (await response.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!response.ok || data === null) {
    throw new ApiError(response.status, data?.error ?? 'Something went wrong');
  }
  return data;
}

export const api = {
  register: (name: string) => request<RegisterResponse>('POST', '/api/register', undefined, { name }),
  me: (token: string) => request<{ profile: Profile }>('GET', '/api/me', token),
  leaderboard: () => request<LeaderboardResponse>('GET', '/api/leaderboard'),
  reportCpuMatches: (token: string, wins: number, losses: number) =>
    request<{ profile: Profile }>('POST', '/api/cpu-matches', token, { wins, losses }),
};
