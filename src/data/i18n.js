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

  // §9.4 level select (M2)
  levelsTitle: 'Levels',
  chapterHead: (name, lo, hi) => `${name} · ${lo}–${hi}`,
  levelAria: (n, locked) => (locked ? `Level ${n}, locked` : `Level ${n}`),

  // §5 boosters (M2)
  mapBtn: '🗺', undoBtn: '↩', shuffleBtn: '🔄', hintBtn: '💡',
  mapBtnAria: 'Level map', undoBtnAria: 'Undo', shuffleBtnAria: 'Shuffle', hintBtnAria: 'Hint',
  next: (n) => `Next · L${n}`,
  map: '🗺 Map',

  // §5.1 hint ladder
  noPairsToast: 'No pairs in sight 🍬 — bank any free tile or Undo',

  // §5.3 no-progress dialog (§9.5 copy: inform and offer, never auto-play)
  noProgTitle: 'No safe moves in sight 🍬',
  noProgBody: 'Reshuffle the board, or take a step back?',
  dlgShuffle: '🔄 Shuffle',
  dlgUndo: '↩ Undo last bank',
  dlgRestart: '↻ Restart level',
  dlgMap: '🗺 Level map',

  // §13 storage-failure toast (one-time, non-blocking)
  saveToast: "Progress won't be saved in this browser mode 🍪",
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
