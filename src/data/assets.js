/* assets.js — user-supplied pixel-art tile sprite atlas (§10.3, v0.3.4).
   One PNG per dealt face, 20×28 px (5:7), pixel-art with the tile's extruded
   edge baked into the sprite; rendered with image-rendering: pixelated.
   Relative paths only — Pages deploys under a subpath (§2.1). */

const SUIT_FILE = {
  d: 'Circles',
  b: 'Bamboo',
  c: 'Characters',
};

const FACE_FILE = {
  wE: 'East',
  wS: 'South',
  wW: 'West',
  wN: 'North',
  drR: 'Red',
  drG: 'Green',
  drW: 'White',
};

/** Map a dealt face id ('d5', 'b1', 'wN', 'drG', …) to its sprite path. */
export function faceFile(face) {
  const fixed = FACE_FILE[face];
  if (fixed) return `assets/tiles/${fixed}.png`;
  const suit = face?.[0], rank = Number(face?.slice?.(1));
  const stem = SUIT_FILE[suit];
  if (!stem || !(rank >= 1 && rank <= 9)) throw new Error(`no sprite for face "${face}"`);
  return `assets/tiles/${stem}${rank}.png`;
}
