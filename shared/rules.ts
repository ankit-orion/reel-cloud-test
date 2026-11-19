// Shared by the app and the server. The server runs these files directly with
// Node's type stripping, so keep them free of enums and non-type imports.

export const MOVES = ['rock', 'paper', 'scissors'] as const;
export type Move = (typeof MOVES)[number];

/** Outcome of a round from the first player's point of view. */
export type Outcome = 'win' | 'lose' | 'draw';

/** Round wins needed to take a match. */
export const WINS_TO_TAKE_MATCH = 3;

const BEATS: Record<Move, Move> = {
  rock: 'scissors',
  paper: 'rock',
  scissors: 'paper',
};

export const MOVE_LABEL: Record<Move, string> = {
  rock: 'Rock',
  paper: 'Paper',
  scissors: 'Scissors',
};

export function isMove(value: unknown): value is Move {
  return typeof value === 'string' && (MOVES as readonly string[]).includes(value);
}

export function judge(mine: Move, theirs: Move): Outcome {
  if (mine === theirs) return 'draw';
  return BEATS[mine] === theirs ? 'win' : 'lose';
}

/**
 * A uniformly random move. `random` must return a float in [0, 1); the
 * computer opponent uses nothing else, so it cannot be read or out-guessed.
 */
export function randomMove(random: () => number = Math.random): Move {
  return MOVES[Math.min(MOVES.length - 1, Math.floor(random() * MOVES.length))];
}
