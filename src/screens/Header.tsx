import { StyleSheet, View } from 'react-native';

import { PixelButton, PixelText, palette } from '../pixel/ui';

/** Back button and a title, for the screens that hang off Home. */
export function Header({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View style={styles.header}>
      <PixelButton label="<" size="sm" color="grey" testID="back" accessibilityLabel="Back" onPress={onBack} />
      <PixelText size={16} color={palette.white} shadow={palette.ink} accessibilityRole="header" style={styles.title}>
        {title}
      </PixelText>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  title: { flexShrink: 1 },
});
