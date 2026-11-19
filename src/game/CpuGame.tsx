import { useEffect, useState } from 'react';
import { BackHandler } from 'react-native';

import { WINS_TO_TAKE_MATCH, judge, randomMove, type Move } from '../../shared/rules';
import { outcomeHaptic } from '../haptics';
import { PixelButton, palette } from '../pixel/ui';
import { Arena, Dialog } from './Arena';
import { useRoundPlayback } from './useRoundPlayback';

interface Props {
  playerName: string;
  /** Called once per finished match, so it can go on the profile. */
  onMatchEnd: (won: boolean) => void;
  onExit: () => void;
}

/** A match against the computer, which throws uniformly at random every round. */
export function CpuGame({ playerName, onMatchEnd, onExit }: Props) {
  const playback = useRoundPlayback();
  const [wins, setWins] = useState({ you: 0, cpu: 0 });
  const [picked, setPicked] = useState<Move | null>(null);
  const [result, setResult] = useState<'won' | 'lost' | null>(null);

  // Nothing is at stake against the computer, so Android's back button simply leaves.
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onExit();
      return true;
    });
    return () => subscription.remove();
  }, [onExit]);

  const pick = (move: Move) => {
    if (playback.phase !== 'idle' || result) return;
    const cpu = randomMove();
    const outcome = judge(move, cpu);
    const next = {
      you: wins.you + (outcome === 'win' ? 1 : 0),
      cpu: wins.cpu + (outcome === 'lose' ? 1 : 0),
    };
    setPicked(move);
    playback.play(
      { you: move, opponent: cpu, outcome },
      {
        reveal: () => {
          outcomeHaptic(outcome);
          setWins(next);
        },
        done: () => {
          setPicked(null);
          const won = next.you >= WINS_TO_TAKE_MATCH;
          if (won || next.cpu >= WINS_TO_TAKE_MATCH) {
            setResult(won ? 'won' : 'lost');
            onMatchEnd(won);
          }
        },
      },
    );
  };

  const playAgain = () => {
    setWins({ you: 0, cpu: 0 });
    setResult(null);
  };

  return (
    <Arena
      you={{ name: playerName, wins: wins.you }}
      opponent={{ name: 'Computer', wins: wins.cpu }}
      playback={playback}
      status="PICK YOUR MOVE"
      canPick={playback.phase === 'idle' && !result}
      picked={picked}
      onPick={pick}
      onQuit={onExit}
      roundHeadline={(outcome) => (outcome === 'win' ? 'YOU WIN!' : 'CPU WINS')}
      overlay={
        result && (
          <Dialog
            testID="result"
            title={result === 'won' ? 'YOU WIN!' : 'YOU LOSE'}
            titleColor={result === 'won' ? palette.win : palette.lose}
            lines={[`${wins.you} - ${wins.cpu}`, 'SAVED TO YOUR PROFILE.', 'COMPUTER MATCHES DO NOT CHANGE YOUR SCORE.']}
          >
            <PixelButton label="PLAY AGAIN" testID="play-again" onPress={playAgain} />
            <PixelButton label="HOME" color="grey" testID="result-home" onPress={onExit} />
          </Dialog>
        )
      }
    />
  );
}
