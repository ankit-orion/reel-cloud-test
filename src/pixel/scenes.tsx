import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CLOUD } from './sprites';
import { Sprite } from './Sprite';
import { palette } from './ui';

const GROUND_HEIGHT = 72;

/** Blue sky with drifting-looking clouds; `ground` adds a strip of grass and dirt along the bottom. */
export function SkyScene({ children, ground = false }: { children: ReactNode; ground?: boolean }) {
  return (
    <View style={styles.sky}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Sprite sprite={CLOUD} scale={8} style={[styles.cloud, { top: '9%', right: -40 }]} />
        <Sprite sprite={CLOUD} scale={10} style={[styles.cloud, { top: '30%', left: -90 }]} />
        <Sprite sprite={CLOUD} scale={5} style={[styles.cloud, { top: '49%', right: 20 }]} />
        {ground && (
          <View style={styles.ground}>
            <View style={styles.grassLip} />
            <View style={styles.grassBand} />
            <View style={styles.dirt}>
              {DIRT_SPECKS.map((speck, index) => (
                <View key={index} style={[styles.speck, speck]} />
              ))}
            </View>
          </View>
        )}
      </View>
      <SafeAreaView style={[styles.fill, ground && { paddingBottom: GROUND_HEIGHT }]}>{children}</SafeAreaView>
    </View>
  );
}

const DIRT_SPECKS = [
  { left: '6%', top: 8 },
  { left: '22%', top: 24 },
  { left: '41%', top: 6 },
  { left: '58%', top: 28 },
  { left: '74%', top: 12 },
  { left: '90%', top: 26 },
] as const;

/** Deterministic pseudo-random scatter, so the turf looks the same on every render and device. */
function scatter(count: number) {
  const tiles: { left: `${number}%`; top: `${number}%`; light: boolean }[] = [];
  let seed = 7;
  const next = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < count; i++) {
    tiles.push({
      left: `${Math.floor(next() * 20) * 5}%`,
      top: `${Math.floor(next() * 40) * 2.5}%`,
      light: next() > 0.5,
    });
  }
  return tiles;
}

const TURF = scatter(46);

/** The green playing field. */
export function GrassField({ children }: { children: ReactNode }) {
  return (
    <View style={styles.grass}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {TURF.map((tile, index) => (
          <View
            key={index}
            style={[
              styles.turf,
              { left: tile.left, top: tile.top, backgroundColor: tile.light ? palette.grassLight : palette.grassDark },
            ]}
          />
        ))}
      </View>
      <SafeAreaView style={styles.fill}>{children}</SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  sky: { flex: 1, backgroundColor: palette.sky, overflow: 'hidden' },
  cloud: { position: 'absolute' },
  ground: { position: 'absolute', left: 0, right: 0, bottom: 0, height: GROUND_HEIGHT },
  grassLip: { height: 8, backgroundColor: palette.grassLight },
  grassBand: { height: 16, backgroundColor: palette.grass },
  dirt: { flex: 1, backgroundColor: palette.dirt },
  speck: { position: 'absolute', width: 12, height: 8, backgroundColor: palette.dirtDark },
  grass: { flex: 1, backgroundColor: palette.grass, overflow: 'hidden' },
  turf: { position: 'absolute', width: 20, height: 20 },
});
