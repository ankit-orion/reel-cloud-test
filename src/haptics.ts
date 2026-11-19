import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import type { Outcome } from '../shared/rules';

const enabled = Platform.OS === 'ios' || Platform.OS === 'android';

// Haptics are decoration: a device without a vibration motor must not surface errors.
const quietly = (effect: Promise<void>) => void effect.catch(() => {});

export function tapHaptic() {
  if (enabled) quietly(Haptics.selectionAsync());
}

export function outcomeHaptic(outcome: Outcome) {
  if (!enabled) return;
  if (outcome === 'win') quietly(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
  else if (outcome === 'lose') quietly(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
  else quietly(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}
