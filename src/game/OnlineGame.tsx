import { useEffect, useRef, useState } from 'react';
import { BackHandler } from 'react-native';

import type { RoomSnapshot } from '../../shared/protocol';
import type { Move } from '../../shared/rules';
import { tierForScore } from '../../shared/tiers';
import { outcomeHaptic } from '../haptics';
import type { RoomLink } from '../net/useRoom';
import { PixelButton, palette } from '../pixel/ui';
import { Arena, Dialog } from './Arena';
import { useRoundPlayback } from './useRoundPlayback';

interface Props {
  room: RoomSnapshot;
  link: RoomLink;
  /** Leave the room and go back to the home screen. */
  onExit: () => void;
}

/** A live match against a friend. The server decides everything; this screen plays it back. */
export function OnlineGame({ room, link, onExit }: Props) {
  const playback = useRoundPlayback();
  const { play, reset } = playback;
  // Rounds already played back on this screen. Joining mid-match (after a reconnect) skips the replay.
  const [shown, setShown] = useState(room.rounds.length);
  const [picked, setPicked] = useState<Move | null>(null);
  const [confirmingLeave, setConfirmingLeave] = useState(false);
  const match = useRef(room.matchNumber);

  const opponent = room.opponent!;
  const online = link.status === 'online';
  const playing = room.status === 'playing';

  // A rematch starts the same room over.
  useEffect(() => {
    if (match.current === room.matchNumber) return;
    match.current = room.matchNumber;
    reset();
    setShown(0);
    setPicked(null);
  }, [room.matchNumber, reset]);

  // Play back each round the server has decided, one at a time.
  const pending = room.rounds[shown];
  useEffect(() => {
    if (playback.phase !== 'idle' || !pending || match.current !== room.matchNumber) return;
    play(pending, {
      reveal: () => outcomeHaptic(pending.outcome),
      done: () => {
        setShown((count) => count + 1);
        setPicked(null);
      },
    });
  }, [pending, playback.phase, play, room.matchNumber]);

  // Leaving mid-match costs the match, so Android's back button asks first.
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (playing) setConfirmingLeave(true);
      else onExit();
      return true;
    });
    return () => subscription.remove();
  }, [playing, onExit]);

  // Pips only count rounds the player has already watched.
  const visible = room.rounds.slice(0, shown + (playback.phase === 'reveal' ? 1 : 0));
  const wins = {
    you: visible.filter((round) => round.outcome === 'win').length,
    opponent: visible.filter((round) => round.outcome === 'lose').length,
  };

  const caughtUp = playback.phase === 'idle' && shown >= room.rounds.length;
  const name = opponent.name.toUpperCase();

  let status = 'PICK YOUR MOVE';
  let detail = '';
  if (!online) {
    status = 'RECONNECTING...';
  } else if (playing && !opponent.connected) {
    status = `${name} LOST CONNECTION`;
    detail = 'WAITING FOR THEM TO COME BACK';
  } else if (room.you.picked) {
    status = `WAITING FOR ${name}`;
  } else if (opponent.picked) {
    detail = `${name} IS READY`;
  }

  let overlay = null;
  if (confirmingLeave && playing) {
    overlay = (
      <Dialog testID="leave-confirm" title="LEAVE MATCH?" lines={['YOU WILL LOSE THIS MATCH.']}>
        <PixelButton label="KEEP PLAYING" testID="leave-cancel" onPress={() => setConfirmingLeave(false)} />
        <PixelButton label="LEAVE" color="red" testID="leave-confirm-button" onPress={onExit} />
      </Dialog>
    );
  } else if (room.status === 'over' && room.result && caughtUp) {
    const { youWon, reason, scoreBefore, scoreAfter } = room.result;
    const [tierBefore, tierAfter] = [tierForScore(scoreBefore), tierForScore(scoreAfter)];
    const change = scoreAfter - scoreBefore;
    const opponentGone = !opponent.connected;
    overlay = (
      <Dialog
        testID="result"
        title={youWon ? 'YOU WIN!' : 'YOU LOSE'}
        titleColor={youWon ? palette.win : palette.lose}
        lines={[
          reason === 'forfeit' && youWon && `${name} LEFT THE MATCH.`,
          change === 0 ? `SCORE ${scoreAfter}` : `SCORE ${scoreAfter} (${change > 0 ? '+' : ''}${change})`,
          tierAfter.id !== tierBefore.id &&
            (scoreAfter > scoreBefore ? `PROMOTED TO ${tierAfter.name.toUpperCase()}!` : `BACK TO ${tierAfter.name.toUpperCase()}.`),
          !opponentGone && opponent.wantsRematch && !room.you.wantsRematch && `${name} WANTS A REMATCH!`,
        ]}
      >
        <PixelButton
          testID="rematch"
          color="green"
          label={opponentGone ? `${name} LEFT` : room.you.wantsRematch ? `WAITING FOR ${name}` : 'REMATCH'}
          disabled={opponentGone || room.you.wantsRematch || !online}
          onPress={link.rematch}
        />
        <PixelButton label="HOME" color="grey" testID="result-home" onPress={onExit} />
      </Dialog>
    );
  }

  return (
    <Arena
      you={{ name: room.you.name, wins: wins.you }}
      opponent={{ name: opponent.name, wins: wins.opponent }}
      playback={playback}
      status={status}
      detail={detail}
      canPick={online && playing && caughtUp && !room.you.picked}
      picked={picked}
      onPick={(move) => {
        setPicked(move);
        link.pick(move);
      }}
      onQuit={() => (playing ? setConfirmingLeave(true) : onExit())}
      roundHeadline={(outcome) => (outcome === 'win' ? 'YOU WIN!' : `${name} WINS`)}
      overlay={overlay}
    />
  );
}
