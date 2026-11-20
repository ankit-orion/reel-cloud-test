import { useEffect } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import type { Profile } from '../../shared/protocol';
import { LOSS_POINTS, TIERS, WIN_POINTS, tierProgress } from '../../shared/tiers';
import { SkyScene } from '../pixel/scenes';
import { TIER_COLORS, tierGem } from '../pixel/sprites';
import { Sprite } from '../pixel/Sprite';
import { Panel, PixelFrame, PixelText, palette } from '../pixel/ui';
import { Header } from './Header';
import { ServerSetting } from './ServerSetting';

interface Props {
  profile: Profile;
  /** Ask the server for the latest record. */
  onRefresh: () => void;
  onBack: () => void;
  serverUrl: string;
  onChangeServer: (url: string) => Promise<void>;
}

export function ProfileScreen({ profile, onRefresh, onBack, serverUrl, onChangeServer }: Props) {
  useEffect(() => {
    onRefresh();
  }, [onRefresh]);
  const { tier, next, pointsToNext, fraction } = tierProgress(profile.score);

  return (
    <SkyScene>
      <ScrollView contentContainerStyle={styles.content}>
        <Header title="PROFILE" onBack={onBack} />

        <Panel contentStyle={styles.hero}>
          <Sprite sprite={tierGem(tier.id)} scale={6} />
          <PixelText size={16} center numberOfLines={1} testID="profile-name">
            {profile.name.toUpperCase()}
          </PixelText>
          <PixelText size={12} color={TIER_COLORS[tier.id].A} center testID="profile-tier">
            {tier.name.toUpperCase()}
          </PixelText>
          <PixelText size={10} center testID="profile-score">
            {`${profile.score} PTS`}
          </PixelText>
          <PixelFrame face={palette.creamDark} style={styles.bar}>
            <View
              style={[styles.barFill, { width: `${Math.round(fraction * 100)}%`, backgroundColor: TIER_COLORS[tier.id].a }]}
            />
          </PixelFrame>
          <PixelText size={9} color={palette.muted} center testID="profile-next">
            {next ? `${pointsToNext} PTS TO ${next.name.toUpperCase()}` : 'TOP TIER REACHED'}
          </PixelText>
          <PixelText size={9} color={palette.muted} center testID="profile-rank">
            {profile.rank === null ? 'NOT RANKED YET' : `LEADERBOARD RANK #${profile.rank}`}
          </PixelText>
        </Panel>

        <View style={styles.records}>
          <Record title="VS PLAYERS" wins={profile.pvpWins} losses={profile.pvpLosses} testID="record-pvp" />
          <Record title="VS COMPUTER" wins={profile.cpuWins} losses={profile.cpuLosses} testID="record-cpu" />
        </View>

        <Panel>
          <PixelText size={12} center>
            TIERS
          </PixelText>
          {TIERS.map((step) => (
            <View key={step.id} style={styles.tierRow}>
              <Sprite sprite={tierGem(step.id)} scale={2} />
              <PixelText size={10} style={styles.tierName} color={step.id === tier.id ? palette.ink : palette.muted}>
                {step.name.toUpperCase()}
              </PixelText>
              <PixelText size={10} color={step.id === tier.id ? palette.ink : palette.muted}>
                {`${step.minScore}+`}
              </PixelText>
            </View>
          ))}
          <PixelText size={8} color={palette.muted} center>
            {`BEAT A REAL PLAYER: +${WIN_POINTS}. LOSE TO ONE: -${LOSS_POINTS}. COMPUTER MATCHES NEVER CHANGE YOUR SCORE.`}
          </PixelText>
        </Panel>

        <ServerSetting serverUrl={serverUrl} onChange={onChangeServer} />
      </ScrollView>
    </SkyScene>
  );
}

function Record({ title, wins, losses, testID }: { title: string; wins: number; losses: number; testID: string }) {
  return (
    <Panel style={styles.record} contentStyle={styles.recordContent}>
      <PixelText size={9} color={palette.muted} center>
        {title}
      </PixelText>
      <PixelText size={18} color={palette.win} center testID={`${testID}-wins`}>
        {wins}
      </PixelText>
      <PixelText size={9} center>
        {wins === 1 ? 'WIN' : 'WINS'}
      </PixelText>
      <PixelText size={9} color={palette.muted} center testID={`${testID}-losses`}>
        {`${losses} ${losses === 1 ? 'LOSS' : 'LOSSES'}`}
      </PixelText>
    </Panel>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: 20, gap: 16, width: '100%', maxWidth: 420, alignSelf: 'center' },
  hero: { alignItems: 'center', gap: 10 },
  bar: { alignSelf: 'stretch' },
  barFill: { height: 12 },
  records: { flexDirection: 'row', gap: 12 },
  record: { flex: 1 },
  recordContent: { gap: 8, paddingHorizontal: 8 },
  tierRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tierName: { flex: 1 },
});
