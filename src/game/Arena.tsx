import type { ReactNode } from 'react';
import { Animated, StyleSheet, View, useWindowDimensions } from 'react-native';

import { MOVES, MOVE_LABEL, WINS_TO_TAKE_MATCH, type Move } from '../../shared/rules';
import { GrassField } from '../pixel/scenes';
import { MOVE_ICON, handSprite, type Sleeve } from '../pixel/sprites';
import { Sprite } from '../pixel/Sprite';
import { Panel, PixelButton, PixelFrame, PixelText, palette } from '../pixel/ui';
import type { RoundPlayback } from './useRoundPlayback';

const COUNTDOWN_WORDS = ['ROCK...', 'PAPER...', 'SCISSORS...'];
const WIN_VERB: Record<Move, string> = { rock: 'CRUSHES', paper: 'COVERS', scissors: 'CUT' };

interface Side {
  name: string;
  /** Rounds won so far in this match. */
  wins: number;
}

interface Props {
  you: Side;
  opponent: Side;
  playback: RoundPlayback;
  /** Shown while no round is playing: whose turn it is, who we are waiting for. */
  status: string;
  detail?: string;
  canPick: boolean;
  /** The move this player has locked in for the round being decided. */
  picked?: Move | null;
  onPick: (move: Move) => void;
  onQuit: () => void;
  /** Winner/loser wording for a decided round, e.g. "YOU WIN!" or "CPU WINS". */
  roundHeadline: (outcome: 'win' | 'lose') => string;
  /** A dialog drawn over the field (match result, leave confirmation). */
  overlay?: ReactNode;
}

function describe(round: NonNullable<RoundPlayback['round']>): string {
  if (round.outcome === 'draw') return `BOTH THREW ${MOVE_LABEL[round.you].toUpperCase()}`;
  const [winner, loser] = round.outcome === 'win' ? [round.you, round.opponent] : [round.opponent, round.you];
  return `${MOVE_LABEL[winner].toUpperCase()} ${WIN_VERB[winner]} ${MOVE_LABEL[loser].toUpperCase()}`;
}

/** The playing field: two hands, the score pips and the three move buttons. */
export function Arena(props: Props) {
  const { you, opponent, playback, canPick, picked, overlay } = props;
  const { height, width } = useWindowDimensions();
  const handScale = Math.max(4, Math.min(9, Math.floor(height / 115)));
  const iconScale = width < 360 ? 4 : 5;
  // Names sit beside the arms; on narrow phones they shrink to stay clear of them.
  const nameSize = width < 360 ? 8 : 10;

  const revealed = playback.phase === 'reveal' ? playback.round : null;
  let headline = props.status;
  let detail = props.detail ?? '';
  if (playback.phase === 'countdown') {
    headline = COUNTDOWN_WORDS[playback.beat];
    detail = '';
  } else if (revealed) {
    headline = revealed.outcome === 'draw' ? 'DRAW!' : props.roundHeadline(revealed.outcome);
    detail = describe(revealed);
  }

  const hand = (side: 'you' | 'opponent', sleeve: Sleeve) => {
    const move = revealed ? revealed[side] : 'rock';
    const lost = revealed ? revealed.outcome === (side === 'you' ? 'lose' : 'win') : false;
    const label = `${side === 'you' ? you.name : opponent.name}: ${revealed ? MOVE_LABEL[move] : 'ready'}`;
    return (
      // The opponent's arm is turned around so it reaches in from the far edge.
      <View style={side === 'opponent' && styles.flipped}>
        <Animated.View
          testID={`hand-${side}`}
          accessible
          accessibilityLabel={label}
          style={{
            transform: [
              { translateY: playback.shake.interpolate({ inputRange: [0, 1], outputRange: [0, -16] }) },
              { scale: playback.pop },
            ],
          }}
        >
          {/* The beaten hand pulls back toward its own edge. */}
          <View style={lost && { transform: [{ translateY: handScale * 4 }, { scale: 0.85 }] }}>
            <Sprite sprite={handSprite(move, sleeve)} scale={handScale} />
          </View>
        </Animated.View>
      </View>
    );
  };

  return (
    <GrassField>
      <View style={styles.field}>
        {hand('opponent', 'red')}

        <View style={styles.status} accessibilityLiveRegion="polite">
          <PixelText size={16} color={palette.white} shadow={palette.ink} center testID="headline">
            {headline}
          </PixelText>
          <PixelText size={9} color={palette.white} shadow={palette.ink} center testID="detail">
            {detail}
          </PixelText>
        </View>

        {hand('you', 'blue')}

        <View style={styles.topLeft}>
          <PixelButton label="X" size="sm" color="red" testID="quit" accessibilityLabel="Leave match" onPress={props.onQuit} />
        </View>
        <View style={[styles.corner, styles.topRight]}>
          <Nameplate name={opponent.name} align="right" size={nameSize} testID="name-opponent" />
          <Pips wins={opponent.wins} testID="pips-opponent" label={`${opponent.name} round wins`} />
        </View>
        <View style={[styles.corner, styles.bottomLeft]}>
          <Nameplate name={you.name} align="left" size={nameSize} testID="name-you" />
        </View>
        <View style={[styles.corner, styles.bottomRight]}>
          <Pips wins={you.wins} testID="pips-you" label="Your round wins" />
        </View>
      </View>

      <View style={styles.moves}>
        {MOVES.map((move) => (
          <PixelButton
            key={move}
            testID={`move-${move}`}
            accessibilityLabel={MOVE_LABEL[move]}
            disabled={!canPick}
            selected={picked === move}
            onPress={() => props.onPick(move)}
            style={styles.move}
          >
            <Sprite sprite={MOVE_ICON[move]} scale={iconScale} />
          </PixelButton>
        ))}
      </View>

      {overlay && <View style={styles.overlay}>{overlay}</View>}
    </GrassField>
  );
}

interface NameplateProps {
  name: string;
  align: 'left' | 'right';
  size: number;
  testID: string;
}

function Nameplate({ name, align, size, testID }: NameplateProps) {
  return (
    <PixelText
      size={size}
      color={palette.white}
      shadow={palette.ink}
      numberOfLines={1}
      testID={testID}
      style={{ alignSelf: align === 'left' ? 'flex-start' : 'flex-end' }}
    >
      {name.toUpperCase()}
    </PixelText>
  );
}

/** One slot per round needed to win; filled slots are rounds won. */
function Pips({ wins, testID, label }: { wins: number; testID: string; label: string }) {
  return (
    <View
      style={styles.pips}
      testID={testID}
      accessible
      accessibilityLabel={`${label}: ${wins} of ${WINS_TO_TAKE_MATCH}`}
    >
      {Array.from({ length: WINS_TO_TAKE_MATCH }, (_, index) => (
        <PixelFrame key={index} face={index < wins ? '#ffd23f' : '#2c7a25'}>
          <View style={styles.pip} />
        </PixelFrame>
      ))}
    </View>
  );
}

interface DialogProps {
  title: string;
  titleColor?: string;
  lines?: (string | null | false | undefined)[];
  children: ReactNode;
  testID?: string;
}

/** A panel for the field's overlay: a title, a few lines, then buttons. */
export function Dialog({ title, titleColor = palette.ink, lines = [], children, testID }: DialogProps) {
  return (
    <Panel testID={testID} style={styles.dialog} contentStyle={styles.dialogContent}>
      <PixelText size={18} color={titleColor} center testID={testID && `${testID}-title`} accessibilityRole="header">
        {title}
      </PixelText>
      {lines.filter(Boolean).map((line) => (
        <PixelText key={line as string} size={10} color={palette.muted} center>
          {line}
        </PixelText>
      ))}
      <View style={styles.dialogButtons}>{children}</View>
    </Panel>
  );
}

const styles = StyleSheet.create({
  field: { flex: 1, alignItems: 'center', justifyContent: 'space-between' },
  flipped: { transform: [{ rotate: '180deg' }] },
  status: { alignItems: 'center', gap: 8, paddingHorizontal: 16, minHeight: 52, justifyContent: 'center' },
  topLeft: { position: 'absolute', top: 10, left: 12 },
  corner: { position: 'absolute', maxWidth: '36%', gap: 8 },
  topRight: { top: 12, right: 12, alignItems: 'flex-end' },
  bottomLeft: { bottom: 12, left: 12 },
  bottomRight: { bottom: 10, right: 12 },
  pips: { flexDirection: 'row', gap: 4 },
  pip: { width: 12, height: 12 },
  moves: { flexDirection: 'row', gap: 10, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 12, backgroundColor: palette.grassDark },
  move: { flex: 1 },
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(16, 14, 24, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  dialog: { width: '100%', maxWidth: 380 },
  dialogContent: { paddingVertical: 22, gap: 14 },
  dialogButtons: { gap: 10, marginTop: 6 },
});
