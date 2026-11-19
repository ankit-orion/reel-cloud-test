import { useMemo } from 'react';
import { PixelRatio, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { spritePaths, spriteSize, type SpriteDef } from './sprites';

interface Props {
  sprite: SpriteDef;
  /** Screen points per sprite pixel. */
  scale: number;
  style?: StyleProp<ViewStyle>;
}

export function Sprite({ sprite, scale, style }: Props) {
  const paths = useMemo(() => spritePaths(sprite), [sprite]);
  const { width, height } = spriteSize(sprite);
  // Snap to whole device pixels so sprite pixels stay hard-edged on any screen density.
  const unit = PixelRatio.roundToNearestPixel(scale);
  return (
    <Svg width={width * unit} height={height * unit} viewBox={`0 0 ${width} ${height}`} style={style}>
      {paths.map((path) => (
        <Path key={path.color} d={path.d} fill={path.color} />
      ))}
    </Svg>
  );
}
