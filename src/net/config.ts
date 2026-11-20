import AsyncStorage from '@react-native-async-storage/async-storage';

// Where the game server lives. The address built into the app comes from EXPO_PUBLIC_SERVER_URL;
// the player can point the app somewhere else from inside it (see ServerSetting), which is what
// makes one installed build usable with a server on a home network or one hosted later.
const STORAGE_KEY = 'rps.server.v1';
const CHECK_TIMEOUT_MS = 5000;

// scheme://host[:port], where host is a name, an IPv4 address or a bracketed IPv6 address.
const ADDRESS = /^(https?):\/\/([a-z0-9.-]+|\[[0-9a-f:]+\])(:\d{1,5})?$/i;

/**
 * Tidies what a person typed into a server address, or returns null if it cannot be one.
 * A bare "192.168.1.20:8787" is taken to mean http://.
 */
export function normalizeServerUrl(input: string): string | null {
  let text = input.trim().replace(/\/+$/, '');
  if (!text) return null;
  if (!/^[a-z]+:\/\//i.test(text)) text = `http://${text}`;
  return ADDRESS.test(text) ? text.toLowerCase() : null;
}

export const DEFAULT_SERVER_URL =
  normalizeServerUrl(process.env.EXPO_PUBLIC_SERVER_URL ?? '') ?? 'http://localhost:8787';

let serverUrl = DEFAULT_SERVER_URL;

export const getServerUrl = () => serverUrl;

export const socketUrlFor = (url: string) => `${url.replace(/^http/, 'ws')}/ws`;

/** Reads the address the player chose, if any. Call once before anything talks to the server. */
export async function loadServerUrl(): Promise<string> {
  try {
    const saved = normalizeServerUrl((await AsyncStorage.getItem(STORAGE_KEY)) ?? '');
    if (saved) serverUrl = saved;
  } catch {
    // Keep the built-in address.
  }
  return serverUrl;
}

export async function saveServerUrl(url: string): Promise<void> {
  serverUrl = url;
  await AsyncStorage.setItem(STORAGE_KEY, url).catch(() => {});
}

/** True if a game server answers at this address. */
export async function isGameServer(url: string): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);
  try {
    const response = await fetch(`${url}/health`, { signal: controller.signal });
    const body = (await response.json()) as { ok?: unknown };
    return response.ok && body.ok === true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
