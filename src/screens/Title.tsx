import { StyleSheet, View, useWindowDimensions } from 'react-native';

import { MOVES } from '../../shared/rules';
import { MOVE_ICON } from '../pixel/sprites';
import { Sprite } from '../pixel/Sprite';
import { PixelText, palette } from '../pixel/ui';

/** The game's logo: three stacked words with the three objects beside them. */
export function Title() {
  const { width } = useWindowDimensions();
  const size = width < 360 ? 24 : 30;
  return (
    <View style={styles.title} accessible accessibilityRole="header" accessibilityLabel="Rock Paper Scissors">
      {MOVES.map((move, index) => (
        <View key={move} style={[styles.line, index === 1 && styles.reversed]}>
          <PixelText size={size} color={palette.white} outline={palette.ink}>
            {move.toUpperCase()}
          </PixelText>
          <Sprite sprite={MOVE_ICON[move]} scale={3} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  title: { alignItems: 'center', gap: 6 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  reversed: { flexDirection: 'row-reverse' },
});
