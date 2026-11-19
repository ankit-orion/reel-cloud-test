import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Platform } from 'react-native';

import type { Move, Outcome } from '../../shared/rules';

/** Length of one beat of the "Rock... Paper... Scissors..." countdown. */
const BEAT_MS = 330;
/** How long a revealed round stays on screen before play moves on. */
const HOLD_MS = 1500;
export const COUNTDOWN_BEATS = 3;

const useNativeDriver = Platform.OS !== 'web';

export interface RoundView {
  you: Move;
  opponent: Move;
  outcome: Outcome;
}

interface PlaybackState {
  phase: 'idle' | 'countdown' | 'reveal';
  /** Which countdown beat is showing, 0-based. */
  beat: number;
  /** The round being counted down or shown. */
  round: RoundView | null;
}

const IDLE: PlaybackState = { phase: 'idle', beat: 0, round: null };

/**
 * Plays one round on screen: fists pump for three beats, both moves are shown,
 * and after a pause the stage clears. Used the same way for computer and friend matches.
 */
export function useRoundPlayback() {
  const [state, setState] = useState<PlaybackState>(IDLE);
  // Animated values live in state (never set again) so they are created once and safe to read in render.
  const [shake] = useState(() => new Animated.Value(0));
  const [pop] = useState(() => new Animated.Value(1));
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const pump = useRef<Animated.CompositeAnimation | null>(null);
  const reduceMotion = useRef(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        reduceMotion.current = enabled;
      })
      .catch(() => {});
  }, []);

  const stop = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    pump.current?.stop();
    shake.setValue(0);
    pop.setValue(1);
  }, [pop, shake]);

  useEffect(() => stop, [stop]);

  const reset = useCallback(() => {
    stop();
    setState(IDLE);
  }, [stop]);

  const play = useCallback(
    (round: RoundView, on: { reveal?: () => void; done?: () => void } = {}) => {
      stop();
      setState({ phase: 'countdown', beat: 0, round });

      if (!reduceMotion.current) {
        pump.current = Animated.loop(
          Animated.sequence([
            Animated.timing(shake, { toValue: 1, duration: BEAT_MS / 2, useNativeDriver }),
            Animated.timing(shake, { toValue: 0, duration: BEAT_MS / 2, useNativeDriver }),
          ]),
          { iterations: COUNTDOWN_BEATS },
        );
        pump.current.start();
      }

      const at = (ms: number, run: () => void) => timers.current.push(setTimeout(run, ms));
      for (let beat = 1; beat < COUNTDOWN_BEATS; beat++) {
        at(BEAT_MS * beat, () => setState({ phase: 'countdown', beat, round }));
      }
      at(BEAT_MS * COUNTDOWN_BEATS, () => {
        setState({ phase: 'reveal', beat: 0, round });
        if (!reduceMotion.current) {
          pop.setValue(0.7);
          Animated.spring(pop, { toValue: 1, friction: 5, tension: 140, useNativeDriver }).start();
        }
        on.reveal?.();
      });
      at(BEAT_MS * COUNTDOWN_BEATS + HOLD_MS, () => {
        setState(IDLE);
        on.done?.();
      });
    },
    [pop, shake, stop],
  );

  return { ...state, shake, pop, play, reset };
}

export type RoundPlayback = ReturnType<typeof useRoundPlayback>;
