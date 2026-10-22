/* score.js — combo ladder + star math (§4). Pure functions; no timers here. */

/** matchScore(n) = 100 + 25 × (n − 1); n = 1-based position in the current combo
 *  chain, capped at 10 (§4.1). Caller (state) owns the cap. */
export function matchScore(n) {
  return 100 + 25 * (n - 1);
}

/** Live projection of the current run's tier (§9.4 HUD stars): stars are
 *  unconditionally ≥ 1 only in the sense that clearing the level pays ★☆☆. */
export function projectedStars(score, t2, t3) {
  return 1 + (score >= t2 ? 1 : 0) + (score >= t3 ? 1 : 0);
}

/** Per-level thresholds; `t2`/`t3` fall back to the §4.2 formulas when the
 *  level JSON leaves them null (M4 hand-tunes later — locked). */
export function thresholds(tiles, t2, t3) {
  const pairs = tiles / 2;
  return { t2: t2 ?? pairs * 130, t3: t3 ?? pairs * 190 };
}
