import { View } from 'react-native';

import { tierForScore } from '../../shared/tiers';
import { tierGem } from '../pixel/sprites';
import { Sprite } from '../pixel/Sprite';

/** The gem for whatever tier a score falls in. */
export function TierBadge({ score, scale = 2 }: { score: number; scale?: number }) {
  const tier = tierForScore(score);
  return (
    <View accessible accessibilityLabel={`${tier.name} tier`}>
      <Sprite sprite={tierGem(tier.id)} scale={scale} />
    </View>
  );
}
