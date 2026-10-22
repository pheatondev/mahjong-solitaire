/* i18n.js — ALL UI strings in one const map (§14.4). EN v1, structured for
   future localization (framework itself is a backlog item — §19). */

export const STR = {
  appName: 'Mahjong Lite',
  madeWith: 'made with 🍬',
  chip: (chapter, id) => `${chapter} · L${id}`,

  winTitle: 'Level cleared! 🍬',
  replay: 'Replay',
  restart: '↻ Restart',
  failTitle: 'The tin overflowed! 🍬',

  noPairsToast: 'No pairs in sight 🍬 — bank any free tile or Undo', // §5.1 ladder step 4 (M2)
};

/** A11y labels per family (§17: tiles get aria-label, e.g. "Blue dot tile, free"). */
export const FACE_NAMES = {
  d: (r) => `${r} dots`,
  b: (r) => `${r} bamboo`,
  c: (r) => `${r} characters`,
  wE: 'east wind',
  wS: 'south wind',
  wW: 'west wind',
  wN: 'north wind',
  drR: 'red dragon',
  drG: 'green dragon',
  drW: 'white dragon',
};

export function faceName(face) {
  if (face === 'drR' || face === 'drG' || face === 'drW') return FACE_NAMES[face];
  const suit = face[0], rank = Number(face.slice(1));
  return FACE_NAMES[suit](rank);
}
