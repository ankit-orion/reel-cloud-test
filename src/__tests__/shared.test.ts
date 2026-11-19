import { nameProblem } from '../../shared/protocol';
import { MOVES, isMove, judge, randomMove } from '../../shared/rules';
import { LOSS_POINTS, TIERS, WIN_POINTS, scoreAfterMatch, tierForScore, tierProgress } from '../../shared/tiers';
import { MOVE_ICON, CLOUD, handSprite, spritePaths, spriteSize, tierGem, type SpriteDef } from '../pixel/sprites';

describe('rules', () => {
  it('judges every pairing', () => {
    expect(judge('rock', 'scissors')).toBe('win');
    expect(judge('paper', 'rock')).toBe('win');
    expect(judge('scissors', 'paper')).toBe('win');
    expect(judge('scissors', 'rock')).toBe('lose');
    expect(judge('rock', 'paper')).toBe('lose');
    expect(judge('paper', 'scissors')).toBe('lose');
    for (const move of MOVES) expect(judge(move, move)).toBe('draw');
  });

  it('recognises moves', () => {
    expect(isMove('rock')).toBe(true);
    expect(isMove('lizard')).toBe(false);
    expect(isMove(undefined)).toBe(false);
  });
});

describe('the computer opponent', () => {
  it('maps the random range evenly onto the three moves', () => {
    expect(randomMove(() => 0)).toBe('rock');
    expect(randomMove(() => 0.3333)).toBe('rock');
    expect(randomMove(() => 0.3334)).toBe('paper');
    expect(randomMove(() => 0.6666)).toBe('paper');
    expect(randomMove(() => 0.6667)).toBe('scissors');
    expect(randomMove(() => 0.999999)).toBe('scissors');
  });

  it('throws each move about a third of the time', () => {
    const counts = { rock: 0, paper: 0, scissors: 0 };
    const throws = 30000;
    for (let i = 0; i < throws; i++) counts[randomMove()]++;
    for (const move of MOVES) {
      expect(counts[move] / throws).toBeGreaterThan(0.31);
      expect(counts[move] / throws).toBeLessThan(0.36);
    }
  });
});

describe('tiers', () => {
  it('places scores on the scale', () => {
    expect(tierForScore(0).id).toBe('bronze');
    expect(tierForScore(99).id).toBe('bronze');
    expect(tierForScore(100).id).toBe('silver');
    expect(tierForScore(249).id).toBe('silver');
    expect(tierForScore(250).id).toBe('gold');
    expect(tierForScore(500).id).toBe('platinum');
    expect(tierForScore(1000).id).toBe('diamond');
    expect(tierForScore(2000).id).toBe('legend');
    expect(tierForScore(999999).id).toBe('legend');
  });

  it('is ordered from lowest to highest, starting at zero', () => {
    expect(TIERS[0].minScore).toBe(0);
    for (let i = 1; i < TIERS.length; i++) expect(TIERS[i].minScore).toBeGreaterThan(TIERS[i - 1].minScore);
  });

  it('reports progress to the next tier', () => {
    expect(tierProgress(0)).toMatchObject({ pointsToNext: 100, fraction: 0 });
    expect(tierProgress(175)).toMatchObject({ pointsToNext: 75, fraction: 0.5 });
    expect(tierProgress(175).next?.id).toBe('gold');
    expect(tierProgress(5000)).toMatchObject({ next: null, pointsToNext: 0, fraction: 1 });
  });

  it('scores wins and losses, never going below zero', () => {
    expect(scoreAfterMatch(0, true)).toBe(WIN_POINTS);
    expect(scoreAfterMatch(100, false)).toBe(100 - LOSS_POINTS);
    expect(scoreAfterMatch(LOSS_POINTS - 1, false)).toBe(0);
    expect(scoreAfterMatch(0, false)).toBe(0);
  });
});

describe('player names', () => {
  it('accepts simple names and explains rejections', () => {
    expect(nameProblem('Ana')).toBeNull();
    expect(nameProblem('rock_star_99')).toBeNull();
    expect(nameProblem('ab')).toMatch(/at least 3/);
    expect(nameProblem('a_very_long_name')).toMatch(/at most 12/);
    expect(nameProblem('no spaces')).toMatch(/letters, numbers/);
  });
});

describe('sprites', () => {
  const sprites: [string, SpriteDef][] = [
    ...MOVES.flatMap((move): [string, SpriteDef][] => [
      [`${move} hand`, handSprite(move, 'blue')],
      [`${move} icon`, MOVE_ICON[move]],
    ]),
    ['cloud', CLOUD],
    ...TIERS.map((tier): [string, SpriteDef] => [`${tier.id} gem`, tierGem(tier.id)]),
  ];

  it.each(sprites)('%s is a clean rectangle with a colour for every pixel', (_name, sprite) => {
    const { width } = spriteSize(sprite);
    for (const row of sprite.rows) expect(row).toHaveLength(width);
    expect(() => spritePaths(sprite)).not.toThrow();
  });

  it('keeps every hand the same size, so the arm does not jump between moves', () => {
    const sizes = MOVES.map((move) => spriteSize(handSprite(move, 'red')));
    expect(new Set(sizes.map((size) => `${size.width}x${size.height}`)).size).toBe(1);
  });

  it('draws each run of pixels once', () => {
    const paths = spritePaths({ rows: ['aa.b', 'bbbb'], palette: { a: '#111', b: '#222' } });
    expect(paths).toEqual([
      { color: '#111', d: 'M0 0h2v1h-2z' },
      { color: '#222', d: 'M3 0h1v1h-1zM0 1h4v1h-4z' },
    ]);
  });
});
