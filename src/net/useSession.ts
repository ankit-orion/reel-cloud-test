import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import type { Profile } from '../../shared/protocol';
import { ApiError, api } from './api';
import { DEFAULT_SERVER_URL, loadServerUrl, saveServerUrl } from './config';

const STORAGE_KEY = 'rps.session.v1';

interface CpuTally {
  wins: number;
  losses: number;
}

interface SignedIn {
  token: string;
  profile: Profile;
  /** Computer matches finished on this device that the server has not acknowledged yet. */
  pendingCpu: CpuTally;
}

export type Session =
  | { status: 'loading' }
  | { status: 'signedOut'; notice: string | null }
  | ({ status: 'signedIn' } & SignedIn);

async function load(): Promise<SignedIn | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const saved = raw ? (JSON.parse(raw) as Partial<SignedIn>) : null;
    if (!saved || typeof saved.token !== 'string' || !saved.profile) return null;
    return {
      token: saved.token,
      profile: saved.profile,
      pendingCpu: { wins: saved.pendingCpu?.wins ?? 0, losses: saved.pendingCpu?.losses ?? 0 },
    };
  } catch {
    return null;
  }
}

/** The player signed in on this device: who they are, their record, and keeping both in sync. */
export function useSession() {
  const [session, setSession] = useState<Session>({ status: 'loading' });
  const [serverUrl, setServerUrl] = useState(DEFAULT_SERVER_URL);
  // The committed session, for callbacks that run later and must not see a stale one.
  const current = useRef(session);
  useLayoutEffect(() => {
    current.current = session;
  });
  const flushing = useRef(false);

  const update = useCallback((change: (signedIn: SignedIn) => Partial<SignedIn>) => {
    setSession((previous) => (previous.status === 'signedIn' ? { ...previous, ...change(previous) } : previous));
  }, []);

  const signOut = useCallback((notice: string | null = null) => {
    setSession({ status: 'signedOut', notice });
  }, []);

  /** Sends computer-match results the server has not seen yet. Safe to call at any time. */
  const flushCpu = useCallback(async () => {
    const now = current.current;
    if (now.status !== 'signedIn' || flushing.current) return;
    const { wins, losses } = now.pendingCpu;
    if (wins + losses === 0) return;
    flushing.current = true;
    try {
      const { profile } = await api.reportCpuMatches(now.token, wins, losses);
      // Subtract what was sent rather than zeroing: another match may have ended meanwhile.
      update((signedIn) => ({
        profile,
        pendingCpu: { wins: signedIn.pendingCpu.wins - wins, losses: signedIn.pendingCpu.losses - losses },
      }));
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) signOut('Your player was not found. Pick a name again.');
      // Anything else: stay pending and try again later.
    } finally {
      flushing.current = false;
    }
  }, [signOut, update]);

  const refresh = useCallback(async () => {
    const now = current.current;
    if (now.status !== 'signedIn') return;
    try {
      const { profile } = await api.me(now.token);
      update(() => ({ profile }));
      void flushCpu();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) signOut('Your player was not found. Pick a name again.');
    }
  }, [flushCpu, signOut, update]);

  // Restore the server address first (so nothing talks to the wrong server), then the saved
  // player; the record is brought up to date in the background.
  useEffect(() => {
    void loadServerUrl()
      .then(setServerUrl)
      .then(load)
      .then((saved) => {
        setSession(saved ? { status: 'signedIn', ...saved } : { status: 'signedOut', notice: null });
      });
  }, []);

  const signedInToken = session.status === 'signedIn' ? session.token : null;
  useEffect(() => {
    if (signedInToken) void refresh();
  }, [signedInToken, refresh]);

  // Whenever unsent computer results appear (a match just ended, or an earlier send left some
  // behind), try to send them. A failed send waits for the next refresh instead of looping.
  const unsent = session.status === 'signedIn' ? session.pendingCpu.wins + session.pendingCpu.losses : 0;
  useEffect(() => {
    if (unsent > 0) void flushCpu();
  }, [unsent, flushCpu]);

  // Persist every change, so a pending result survives the app being closed.
  useEffect(() => {
    if (session.status === 'loading') return;
    const { token, profile, pendingCpu } = session as Partial<SignedIn>;
    const write =
      session.status === 'signedIn'
        ? AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ token, profile, pendingCpu }))
        : AsyncStorage.removeItem(STORAGE_KEY);
    write.catch(() => {});
  }, [session]);

  /** Creates this device's player. Rejects with an ApiError the caller can show. */
  const register = useCallback(async (name: string) => {
    const { token, profile } = await api.register(name);
    setSession({ status: 'signedIn', token, profile, pendingCpu: { wins: 0, losses: 0 } });
  }, []);

  const setProfile = useCallback((profile: Profile) => update(() => ({ profile })), [update]);

  const recordCpuMatch = useCallback(
    (won: boolean) => {
      update((signedIn) => ({
        pendingCpu: {
          wins: signedIn.pendingCpu.wins + (won ? 1 : 0),
          losses: signedIn.pendingCpu.losses + (won ? 0 : 1),
        },
      }));
    },
    [update],
  );

  /**
   * Points the app at a different game server. A signed-in player is kept; if the new server
   * turns out not to know them, the refresh signs them out with an explanation.
   */
  const changeServer = useCallback(
    async (url: string) => {
      await saveServerUrl(url);
      setServerUrl(url);
      void refresh();
    },
    [refresh],
  );

  return { session, serverUrl, register, setProfile, recordCpuMatch, refresh, signOut, changeServer };
}

/** A profile with not-yet-synced computer matches included, which is what the player should see. */
export function visibleProfile(session: SignedIn): Profile {
  return {
    ...session.profile,
    cpuWins: session.profile.cpuWins + session.pendingCpu.wins,
    cpuLosses: session.profile.cpuLosses + session.pendingCpu.losses,
  };
}
