/* i18n.js — ALL UI strings in one const map (§14.4). EN v1, structured for
   future localization (framework itself is a backlog item — §19). */

export const STR = {
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
  portraitHint: 'Portrait is comfier 🍬 — rotate anytime', // §9.2 landscape-phone nudge, once per session

  // ======= M3 =======

  // §9.4 Home — logo lockup (CSS-only), frontier Play, quiet menu buttons
  homePlay: '▶ Play',
  homeLevels: '🍬 Levels',
  homeStats: '📊 Stats',
  homeSettings: '⚙️ Settings',
  homeFoot: 'Made for Emmy, by Pads <3',

  // §9.4 levels extras
  backAria: 'Back',
  starsTotal: (a, b) => `★ ${a} / ${b}`,
  levelsHint: 'beat level N unlocks N+1 · replay anytime for stars',

  // §9.4 first-run tooltip (one-time, level 1; dismisses on first bank tap)
  tipFirst: 'Tap a free tile to bank it — two matching tiles in the bank pop! 🍬',

  // §9.4 pause panel
  pausedTitle: 'Paused ⏸',
  pausedSub: (chapter, id) => `${chapter} · Level ${id}`,
  resume: '▶ Resume',
  pRestart: '↻ Restart',
  pSettings: '⚙️ Settings',
  pMap: '🗺 Level map',

  // §3.6 fail overlay copy
  failBody: 'Four different candies, no pair — attempt ends.',

  // §4.2 win extras
  newBest: '🍬 New best!',

  // §9.4 stats screen
  statsTitle: 'Stats',
  stPaired: 'pairs cleared',
  stMatches: 'matches played',
  stCombo: 'best combo',
  stLevels: 'levels completed',
  stOverflow: 'tin overflows',
  stStars: 'total stars',
  starCount: (a, b) => `${a} / ${b}`,
  statsFoot: 'lifetime · per device — reset only in Settings',

  // §9.4 settings (§10.4 single theme; §12.2 inert music)
  setTitle: 'Settings',
  setSfx: 'Sound effects',
  setMusic: 'Music',
  setMusicNote: 'music ships post-launch · toggle stays resident',
  setHighlight: 'Highlight free tiles',
  setReduce: 'Reduce motion',
  setReset: 'Reset progress',
  setResetHint: 'double-confirm',
  resetConfirmTitle: 'Reset all progress?',
  resetConfirmBody: 'Stars, bests and stats are wiped for this browser. No way back.',
  resetArm: 'Tap again to confirm',
  resetConfirm: 'Yes — reset everything',
  resetToast: 'Progress reset — fresh candies 🍬',
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
  // Whole-face labels (winds 東南西北, dragons 中發白) are stored as strings; suited
  // families (d/b/c) are label functions keyed by suit letter.
  if (typeof FACE_NAMES[face] === 'string') return FACE_NAMES[face];
  const suit = face?.[0], rank = Number(face?.slice?.(1));
  const fam = FACE_NAMES[suit];
  // §17 hardening: an unexpected face degrades to a raw label instead of crashing
  // refreshFree mid-startLevel (which would strand inputLocked on a dead board).
  return typeof fam === 'function' ? fam(rank) : String(face ?? 'unknown');
}
