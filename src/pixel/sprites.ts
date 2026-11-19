// Original pixel art, drawn as text: one character per pixel, '.' is transparent.
// Pure data with no React imports, so it can be checked and previewed outside the app.

import type { Move } from '../../shared/rules';
import type { Tier } from '../../shared/tiers';

export interface SpriteDef {
  rows: readonly string[];
  palette: Record<string, string>;
}

const OUTLINE = '#1d1a26';

const SKIN = { k: OUTLINE, s: '#f6c391', d: '#dd9a63', w: '#fdfdfd' };

/** Wrist, cuff and sleeve shared by every hand so the arm never shifts between moves. */
const ARM = [
  '....ksssssssssk....',
  '....ksssssssddk....',
  '..kkkkkkkkkkkkkkk..',
  '..kwwwwwwwwwwwwwk..',
  '..kkkkkkkkkkkkkkk..',
  '..kccccccccccccCk..',
  '..kccccccccccccCk..',
  '..kccccccccccccCk..',
  '..kccccccccccccCk..',
];

const ROCK_HAND = [
  '...................',
  '...................',
  '...................',
  '..kkkkkkkkkkkkkkk..',
  '.kssdkssdkssdkssdk.',
  '.kssdkssdkssdkssdk.',
  '.kssdkssdkssdkssdk.',
  '.kdddkdddkdddkdddk.',
  '.kkkkkkkkkkkkkkkkk.',
  '.ksssssssssskssssk.',
  '.ksssssssssskssssk.',
  '.kdddddddddkksssdk.',
  '.kkkkkkkkkkksssddk.',
  '..ksssssssssssddk..',
  '..kddsssssssdddk...',
  '...kkdddddddddkk...',
];

const PAPER_HAND = [
  '.......kkk.........',
  '......kssdkkkk.....',
  '...kkkkssdkssdk....',
  '..kssdkssdkssdk....',
  '..kssdkssdkssdkkkk.',
  '..kssdkssdkssdkssdk',
  '..kssdkssdkssdkssdk',
  '..kssdkssdkssdkssdk',
  '..kssdkssdkssdkssdk',
  '..ksssdsssdsssdssdk',
  '.kkssssssssssssssdk',
  'kssssssssssssssssdk',
  'kssssssssssssssssdk',
  '.kkssssssssssssdddk',
  '..kddsssssssssdddk.',
  '...kkdddddddddkk...',
];

const SCISSORS_HAND = [
  '..kkk.........kkk..',
  '.kssdk.......kssdk.',
  '.kssdk.......kssdk.',
  '.kssdk.......kssdk.',
  '..kssdk.....kssdk..',
  '..kssdk.....kssdk..',
  '...kssdk...kssdk...',
  '...kssdk...kssdk...',
  '....kssdk.kssdk....',
  '...kssssdkssssdk...',
  '..ksssssssssssssk..',
  '..kkkkkkkkkkssssk..',
  '..ksssssssskssssk..',
  '..kdddddddkkssddk..',
  '..kkkkkkkkkssdddk..',
  '...kkdddddddddkk...',
];

export type Sleeve = 'blue' | 'red';

const SLEEVES: Record<Sleeve, { c: string; C: string }> = {
  blue: { c: '#2f80ed', C: '#1c5fc0' },
  red: { c: '#e5484d', C: '#b83236' },
};

const HAND_ROWS: Record<Move, string[]> = {
  rock: ROCK_HAND,
  paper: PAPER_HAND,
  scissors: SCISSORS_HAND,
};

const handCache = new Map<string, SpriteDef>();

/** A hand on an arm, fingers pointing up. Returns the same object for the same arguments. */
export function handSprite(move: Move, sleeve: Sleeve): SpriteDef {
  const key = `${move}:${sleeve}`;
  let sprite = handCache.get(key);
  if (!sprite) {
    sprite = { rows: [...HAND_ROWS[move], ...ARM], palette: { ...SKIN, ...SLEEVES[sleeve] } };
    handCache.set(key, sprite);
  }
  return sprite;
}

/** The objects themselves, for the three move buttons. */
export const MOVE_ICON: Record<Move, SpriteDef> = {
  rock: {
    rows: [
      '............',
      '....kkkkk...',
      '..kkgggggk..',
      '.kggwwgggGk.',
      '.kgwwggggGk.',
      'kggwgggggGGk',
      'kggggggGGGGk',
      'kgggggGGGGGk',
      'kgGGGGGGGGGk',
      '.kGGGGGGGGk.',
      '..kkkkkkkk..',
      '............',
    ],
    palette: { k: OUTLINE, g: '#9aa3ad', G: '#6c7480', w: '#d3d9df' },
  },
  paper: {
    rows: [
      '............',
      '..kkkkkkk...',
      '..kwwwwwkk..',
      '..kwwwwwkwk.',
      '..kwllllkkk.',
      '..kwwwwwwwk.',
      '..kwlllllwk.',
      '..kwwwwwwwk.',
      '..kwlllllwk.',
      '..kwwwwwwwk.',
      '..kkkkkkkkk.',
      '............',
    ],
    palette: { k: OUTLINE, w: '#fdfdfd', l: '#b9c2cc' },
  },
  scissors: {
    rows: [
      '..k......k..',
      '.kbk....kbk.',
      '.kbbk..kbbk.',
      '..kbbkkbbk..',
      '...kbbbbk...',
      '....kbbk....',
      '...krkkrk...',
      '..krrkkrrk..',
      '.kr.rkkr.rk.',
      '.krrrkkrrrk.',
      '..kkk..kkk..',
      '............',
    ],
    palette: { k: OUTLINE, b: '#dfe6ea', r: '#e5484d' },
  },
};

export const CLOUD: SpriteDef = {
  rows: [
    '......wwwww.......',
    '....wwwwwwwww.....',
    '..wwwwwwwwwwwwww..',
    'wwwwwwwwwwwwwwwwww',
    'wwwwwwwwwwwwwwwwww',
    '.sssssssssssssss..',
  ],
  palette: { w: '#fdfdfd', s: '#d8f3fa' },
};

const TIER_GEM_ROWS = [
  '...kkkkk...',
  '..klllaak..',
  '.klllaaaAk.',
  'klllaaaaAAk',
  'kllaaaaaAAk',
  'kaaaaaaAAAk',
  '.kaaaaaAAk.',
  '..kaaaAAk..',
  '...kaAAk...',
  '....kAk....',
  '.....k.....',
];

/** Main, shadow and highlight colour of each tier's gem. */
export const TIER_COLORS: Record<Tier['id'], { a: string; A: string; l: string }> = {
  bronze: { a: '#cd7f32', A: '#8c5422', l: '#eab07a' },
  silver: { a: '#c3cad4', A: '#808998', l: '#f2f5f9' },
  gold: { a: '#ffc928', A: '#c58a00', l: '#fff3a6' },
  platinum: { a: '#5fd9c6', A: '#2b9484', l: '#d3fff6' },
  diamond: { a: '#4fb8ff', A: '#1470c4', l: '#c9ebff' },
  legend: { a: '#c06be0', A: '#742a9c', l: '#f4cdff' },
};

const gemCache = new Map<Tier['id'], SpriteDef>();

export function tierGem(tier: Tier['id']): SpriteDef {
  let sprite = gemCache.get(tier);
  if (!sprite) {
    sprite = { rows: TIER_GEM_ROWS, palette: { k: OUTLINE, ...TIER_COLORS[tier] } };
    gemCache.set(tier, sprite);
  }
  return sprite;
}

export interface SpritePath {
  color: string;
  /** SVG path data in sprite-pixel units. */
  d: string;
}

/**
 * Turns a sprite into one SVG path per colour, with each horizontal run of
 * same-coloured pixels drawn as a single rectangle.
 */
export function spritePaths(sprite: SpriteDef): SpritePath[] {
  const byColor = new Map<string, string[]>();
  sprite.rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const char = row[x];
      let end = x + 1;
      while (end < row.length && row[end] === char) end++;
      if (char !== '.') {
        const color = sprite.palette[char];
        if (!color) throw new Error(`Sprite uses "${char}" with no palette colour`);
        const runs = byColor.get(color) ?? [];
        runs.push(`M${x} ${y}h${end - x}v1h${x - end}z`);
        byColor.set(color, runs);
      }
      x = end;
    }
  });
  return [...byColor].map(([color, runs]) => ({ color, d: runs.join('') }));
}

export function spriteSize(sprite: SpriteDef): { width: number; height: number } {
  return { width: sprite.rows[0].length, height: sprite.rows.length };
}
