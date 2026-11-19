import type { ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { tapHaptic } from '../haptics';

export const FONT = 'PressStart2P_400Regular';

export const palette = {
  ink: '#1d1a26',
  white: '#fdfdfd',
  cream: '#fff6dc',
  creamDark: '#ecdcb0',
  muted: '#6b6478',
  sky: '#7fdcf2',
  grass: '#3fa535',
  grassDark: '#35902c',
  grassLight: '#55bb49',
  dirt: '#8a4b2a',
  dirtDark: '#6e3a1f',
  blue: '#2f80ed',
  red: '#e5484d',
  win: '#1f9d3a',
  lose: '#d1343a',
};

const BUTTON_COLORS = {
  yellow: { face: '#ffc83d', light: '#ffe58a', dark: '#d98e04', text: '#3b2500' },
  green: { face: '#4cc552', light: '#9be79b', dark: '#2b8f31', text: '#0c2e0f' },
  red: { face: '#ef5a5f', light: '#f9a3a6', dark: '#b02a30', text: '#fdfdfd' },
  grey: { face: '#d6d9e0', light: '#f3f4f7', dark: '#9da2ae', text: '#1d1a26' },
};
export type ButtonColor = keyof typeof BUTTON_COLORS;

/** Thickness of outlines and of the single-pixel corner notches. */
const PX = 4;

const SHADOW_OFFSETS = [[1, 1]];
// All eight neighbours, plus a second row underneath for weight.
const OUTLINE_OFFSETS = [
  [-1, -1], [0, -1], [1, -1],
  [-1, 0], [1, 0],
  [-1, 1], [0, 1], [1, 1],
  [-1, 2], [0, 2], [1, 2],
];

interface PixelTextProps {
  children: ReactNode;
  size?: number;
  color?: string;
  /** Colour of a hard drop shadow one "pixel" down and right; omit for flat text. */
  shadow?: string;
  /** Colour of a full outline with a heavier bottom edge, for text that sits on busy backgrounds. */
  outline?: string;
  center?: boolean;
  style?: StyleProp<TextStyle>;
  testID?: string;
  numberOfLines?: number;
  accessibilityRole?: 'header';
}

export function PixelText({
  children,
  size = 12,
  color = palette.ink,
  shadow,
  outline,
  center,
  style,
  testID,
  numberOfLines,
  accessibilityRole,
}: PixelTextProps) {
  const base: TextStyle = {
    fontFamily: FONT,
    fontSize: size,
    lineHeight: Math.round(size * 1.5),
    textAlign: center ? 'center' : 'left',
  };
  const text = (
    <Text
      testID={testID}
      numberOfLines={numberOfLines}
      accessibilityRole={accessibilityRole}
      style={[base, { color }, !shadow && !outline && style]}
    >
      {children}
    </Text>
  );
  if (!shadow && !outline) return text;
  const unit = Math.max(2, Math.round(size / 8));
  // Extra copies of the text, nudged by whole "pixels", give a crisp shadow or outline;
  // blurred text shadows would break the pixel look.
  const copies = outline ? OUTLINE_OFFSETS : SHADOW_OFFSETS;
  return (
    <View style={style as StyleProp<ViewStyle>}>
      {copies.map(([x, y]) => (
        <Text
          key={`${x},${y}`}
          aria-hidden
          importantForAccessibility="no"
          numberOfLines={numberOfLines}
          style={[
            base,
            styles.shadowCopy,
            { color: outline ?? shadow, left: x * unit, right: -x * unit, top: y * unit },
          ]}
        >
          {children}
        </Text>
      ))}
      {text}
    </View>
  );
}

interface PixelFrameProps {
  children: ReactNode;
  face: string;
  outline?: string;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}

/** A box with a chunky outline and one-pixel notched corners. */
export function PixelFrame({ children, face, outline = palette.ink, style, contentStyle }: PixelFrameProps) {
  return (
    <View style={style}>
      <View style={[styles.frameEdge, { backgroundColor: outline }]} />
      <View style={[styles.frameMiddle, { backgroundColor: outline }]}>
        <View style={[styles.frameFace, { backgroundColor: face }, contentStyle]}>{children}</View>
      </View>
      <View style={[styles.frameEdge, { backgroundColor: outline }]} />
    </View>
  );
}

interface PanelProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  testID?: string;
}

export function Panel({ children, style, contentStyle, testID }: PanelProps) {
  return (
    <View testID={testID} style={style}>
      <PixelFrame face={palette.cream} contentStyle={[styles.panel, contentStyle]}>
        {children}
      </PixelFrame>
    </View>
  );
}

interface PixelButtonProps {
  label?: string;
  onPress: () => void;
  color?: ButtonColor;
  size?: 'md' | 'sm';
  disabled?: boolean;
  /** Draws the button as held down, e.g. the move you locked in. */
  selected?: boolean;
  children?: ReactNode;
  testID?: string;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

export function PixelButton({
  label,
  onPress,
  color = 'yellow',
  size = 'md',
  disabled,
  selected,
  children,
  testID,
  accessibilityLabel,
  style,
}: PixelButtonProps) {
  const colors = BUTTON_COLORS[color];
  const depth = size === 'md' ? 6 : 4;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!disabled, selected: !!selected }}
      disabled={disabled}
      onPress={() => {
        tapHaptic();
        onPress();
      }}
      style={[disabled && !selected && styles.disabled, style]}
    >
      {({ pressed }) => {
        const down = pressed || selected;
        return (
          // Pressing swaps the bottom lip for top padding, so the face sinks without the layout moving.
          <View style={{ paddingTop: down ? depth - 2 : 0 }}>
            <PixelFrame face={colors.face}>
              <View style={[styles.buttonLight, { backgroundColor: colors.light }]} />
              <View style={[styles.buttonContent, size === 'sm' && styles.buttonContentSmall]}>
                {children}
                {label !== undefined && (
                  <PixelText size={size === 'md' ? 14 : 10} color={colors.text} center>
                    {label}
                  </PixelText>
                )}
              </View>
              <View style={{ height: down ? 2 : depth, backgroundColor: colors.dark }} />
            </PixelFrame>
          </View>
        );
      }}
    </Pressable>
  );
}

export function PixelInput(props: TextInputProps) {
  return (
    <PixelFrame face={palette.white}>
      <TextInput
        placeholderTextColor="#a8a3b3"
        selectionColor={palette.blue}
        autoCorrect={false}
        spellCheck={false}
        {...props}
        style={[styles.input, props.style]}
      />
    </PixelFrame>
  );
}

const styles = StyleSheet.create({
  shadowCopy: { position: 'absolute' },
  frameEdge: { height: PX, marginHorizontal: PX },
  frameMiddle: { paddingHorizontal: PX },
  frameFace: {},
  panel: { padding: 16, gap: 12 },
  buttonLight: { height: 4 },
  buttonContent: {
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonContentSmall: { minHeight: 34, paddingHorizontal: 10, paddingVertical: 8 },
  disabled: { opacity: 0.55 },
  input: {
    fontFamily: FONT,
    fontSize: 14,
    color: palette.ink,
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlign: 'center',
  },
});
