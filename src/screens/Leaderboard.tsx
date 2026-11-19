import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import type { LeaderboardEntry, Profile } from '../../shared/protocol';
import { ApiError, api } from '../net/api';
import { SkyScene } from '../pixel/scenes';
import { Panel, PixelButton, PixelFrame, PixelText, palette } from '../pixel/ui';
import { Header } from './Header';
import { TierBadge } from './TierBadge';

type Load = { state: 'loading' } | { state: 'failed'; message: string } | { state: 'ready'; entries: LeaderboardEntry[] };

interface Props {
  profile: Profile;
  onBack: () => void;
}

/** Top players by score. Only matches against real players earn score, so only those players appear. */
export function Leaderboard({ profile, onBack }: Props) {
  const [load, setLoad] = useState<Load>({ state: 'loading' });

  const fetchBoard = useCallback(
    () =>
      api
        .leaderboard()
        .then(({ entries }) => setLoad({ state: 'ready', entries }))
        .catch((error) =>
          setLoad({ state: 'failed', message: error instanceof ApiError ? error.message : 'Something went wrong' }),
        ),
    [],
  );
  useEffect(() => {
    void fetchBoard();
  }, [fetchBoard]);
  const retry = () => {
    setLoad({ state: 'loading' });
    void fetchBoard();
  };

  const listed = load.state === 'ready' && load.entries.some((entry) => entry.id === profile.id);

  return (
    <SkyScene>
      <ScrollView contentContainerStyle={styles.content}>
        <Header title="LEADERBOARD" onBack={onBack} />

        {load.state === 'loading' && (
          <PixelText size={10} color={palette.white} shadow={palette.ink} center>
            LOADING...
          </PixelText>
        )}

        {load.state === 'failed' && (
          <Panel testID="leaderboard-error">
            <PixelText size={10} center>
              {load.message.toUpperCase()}
            </PixelText>
            <PixelButton label="TRY AGAIN" testID="leaderboard-retry" onPress={retry} />
          </Panel>
        )}

        {load.state === 'ready' && load.entries.length === 0 && (
          <Panel testID="leaderboard-empty">
            <PixelText size={10} center>
              NOBODY IS RANKED YET.
            </PixelText>
            <PixelText size={9} color={palette.muted} center>
              BEAT A FRIEND TO TAKE FIRST PLACE.
            </PixelText>
          </Panel>
        )}

        {load.state === 'ready' && load.entries.length > 0 && (
          <View style={styles.rows} testID="leaderboard-rows">
            {load.entries.map((entry) => {
              const mine = entry.id === profile.id;
              return (
                <PixelFrame
                  key={entry.id}
                  face={mine ? '#ffe58a' : palette.cream}
                  contentStyle={styles.row}
                >
                  <PixelText size={10} style={styles.rank}>{`#${entry.rank}`}</PixelText>
                  <TierBadge score={entry.score} scale={2} />
                  <View style={styles.who}>
                    <PixelText size={10} numberOfLines={1} testID={`board-name-${entry.rank}`}>
                      {entry.name.toUpperCase()}
                    </PixelText>
                    <PixelText size={8} color={palette.muted}>
                      {`${entry.wins}W ${entry.losses}L`}
                    </PixelText>
                  </View>
                  <PixelText size={12} testID={`board-score-${entry.rank}`}>
                    {entry.score}
                  </PixelText>
                </PixelFrame>
              );
            })}
          </View>
        )}

        {load.state === 'ready' && !listed && (
          <PixelText size={9} color={palette.white} shadow={palette.ink} center testID="leaderboard-you">
            {profile.rank === null
              ? 'PLAY A FRIEND TO GET RANKED. COMPUTER MATCHES DO NOT COUNT.'
              : `YOU ARE #${profile.rank} WITH ${profile.score} PTS.`}
          </PixelText>
        )}
      </ScrollView>
    </SkyScene>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: 20, gap: 20, width: '100%', maxWidth: 420, alignSelf: 'center' },
  rows: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 10 },
  rank: { minWidth: 34 },
  who: { flex: 1, gap: 4 },
});
