import type { LeaderboardResponse, Profile, RegisterResponse } from '../../shared/protocol';
import { SERVER_URL } from './config';

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
    response = await fetch(SERVER_URL + path, {
      method,
      signal: controller.signal,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Cannot reach the server');
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
