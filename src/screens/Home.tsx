import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import type { Profile } from '../../shared/protocol';
import { tierForScore } from '../../shared/tiers';
import { SkyScene } from '../pixel/scenes';
import { PixelButton, PixelFrame, PixelText, palette } from '../pixel/ui';
import { TierBadge } from './TierBadge';
import { Title } from './Title';

interface Props {
  profile: Profile;
  onPlayFriend: () => void;
  onPlayComputer: () => void;
  onLeaderboard: () => void;
  onProfile: () => void;
}

export function Home({ profile, onPlayFriend, onPlayComputer, onLeaderboard, onProfile }: Props) {
  const tier = tierForScore(profile.score);
  return (
    <SkyScene ground>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Pressable
          testID="player-chip"
          accessibilityRole="button"
          accessibilityLabel={`${profile.name}, ${tier.name}, ${profile.score} points. Open profile`}
          onPress={onProfile}
          style={styles.chip}
        >
          <PixelFrame face={palette.cream} contentStyle={styles.chipContent}>
            <TierBadge score={profile.score} scale={2} />
            <View style={styles.chipText}>
              <PixelText size={10} numberOfLines={1} testID="chip-name">
                {profile.name.toUpperCase()}
              </PixelText>
              <PixelText size={8} color={palette.muted} testID="chip-score">
                {`${tier.name.toUpperCase()} ${profile.score} PTS`}
              </PixelText>
            </View>
          </PixelFrame>
        </Pressable>

        <Title />

        <View style={styles.menu}>
          <PixelButton label="PLAY A FRIEND" testID="play-friend" onPress={onPlayFriend} />
          <PixelButton label="PLAY COMPUTER" testID="play-computer" onPress={onPlayComputer} />
          <PixelButton label="LEADERBOARD" color="green" testID="open-leaderboard" onPress={onLeaderboard} />
          <PixelButton label="PROFILE" color="grey" testID="open-profile" onPress={onProfile} />
        </View>
      </ScrollView>
    </SkyScene>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: 20, gap: 24, justifyContent: 'space-between' },
  chip: { alignSelf: 'flex-start', maxWidth: '100%' },
  chipContent: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 10 },
  chipText: { gap: 4, flexShrink: 1 },
  menu: { gap: 12, width: '100%', maxWidth: 320, alignSelf: 'center' },
});
