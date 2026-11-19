// Score and tier rules. Shared by the app (to draw badges and progress) and the
// server (which is the only place score is ever changed).

/** Score gained for winning a match against a real player. */
export const WIN_POINTS = 25;
/** Score lost for losing a match against a real player. Score never drops below zero. */
export const LOSS_POINTS = 10;

export interface Tier {
  id: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'legend';
  name: string;
  /** Lowest score that belongs to this tier. */
  minScore: number;
}

/** Ordered lowest to highest. */
export const TIERS: readonly Tier[] = [
  { id: 'bronze', name: 'Bronze', minScore: 0 },
  { id: 'silver', name: 'Silver', minScore: 100 },
  { id: 'gold', name: 'Gold', minScore: 250 },
  { id: 'platinum', name: 'Platinum', minScore: 500 },
  { id: 'diamond', name: 'Diamond', minScore: 1000 },
  { id: 'legend', name: 'Legend', minScore: 2000 },
];

export function tierForScore(score: number): Tier {
  let current = TIERS[0];
  for (const tier of TIERS) {
    if (score >= tier.minScore) current = tier;
  }
  return current;
}

export interface TierProgress {
  tier: Tier;
  /** The tier above, or null at the top. */
  next: Tier | null;
  /** Points still needed to reach `next`; 0 at the top. */
  pointsToNext: number;
  /** How far through the current tier the score is, from 0 to 1; 1 at the top. */
  fraction: number;
}

export function tierProgress(score: number): TierProgress {
  const tier = tierForScore(score);
  const next = TIERS[TIERS.indexOf(tier) + 1] ?? null;
  if (!next) return { tier, next, pointsToNext: 0, fraction: 1 };
  return {
    tier,
    next,
    pointsToNext: next.minScore - score,
    fraction: (score - tier.minScore) / (next.minScore - tier.minScore),
  };
}

export function scoreAfterMatch(score: number, won: boolean): number {
  return won ? score + WIN_POINTS : Math.max(0, score - LOSS_POINTS);
}
