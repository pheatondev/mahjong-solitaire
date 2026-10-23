#!/usr/bin/env node
/* scripts/build-levels.mjs — M2 content authoring tool (GDD §7.2: the build agent
   authors all base shapes and all 60 level entries — shapes, candy level names; t2/t3
   stay null so the §4.2 formulas apply; hidden counts follow the §6 curve). NOT part
   of the deploy: it deterministically writes the committed data/levels-1..5.json.

   v0.3.5 reshaping (1.5× tiles, user feedback): the board collapses to exactly
   5 columns × ≤ 8 rows (§7.1) so `computeFit` yields ≈ 52 × 72.75 design px —
   ~1.46× the v0.3.4 tile size — for EVERY level. Levels are re-sculpted as
   narrow tower/keep silhouettes with deeper plate ladders (bands climb to
   7 layers, §6); ALL per-level tile counts, names, hidden counts and §6
   tile-range curves are preserved exactly from the v0.3.3 plan, so score/threshold
   math and save data stay valid.

   Every generated level is asserted against:
   - §6 difficulty bands (tile count range, layer-count range per level id)
   - §7.1 layout validity via the production validator (cols = 5, rows 4–8, even count,
     layer L>0 sits on layer L−1 — no floating tiles —, hidden ≤ floor(tiles/4), hidden = 0
     for levels 1–12, consecutive ids, 12 levels per chapter, ≤ 7 layers)
   - the 136-tile standard deck (a level can never request more tiles than the bag holds, §8.1)
   - a per-level expected tile count (authoring self-check against hand math)

   Re-run from the repo root: node scripts/build-levels.mjs */

import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { SCHEMA, validateChapter } from '../src/data/levels.js';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

/* ------------------------------------------------------------------ helpers */

let W = 0, H = 0; // per-level board bbox (cols × rows)
const mkGrid = () => Array.from({ length: H }, () => Array(W).fill('.'));
const rect = (g, col0, row0, cw, ch) => {
  for (let r = row0; r < row0 + ch; r++) for (let c = col0; c < col0 + cw; c++) g[r][c] = 'A';
};
const hrun = (g, r, col0, len) => { for (let c = col0; c < col0 + len; c++) g[r][c] = 'A'; };
const setBoard = (w, h) => { W = w; H = h; };
const cellCount = (layers) =>
  layers.reduce((n, rows) => n + rows.reduce((m, s) => m + (s.match(/A/g) || []).length, 0), 0);

/* One layer = one draw function; draw fns that only stamp runs on an already
   set board (plate stacks, tiers) are called "plates". */
const plate = (...runs) => (g) => runs.forEach(([r, c0, len]) => hrun(g, r, c0, len));
const slab = (w, h) => (g) => rect(g, 0, 0, w, h);

/** Finalize a set of layer grids (all drawn on the same W×H grid):
 *  1. pad rows/cols up to §7.1 minimums (4 × 5) symmetrically — every layer gets the
 *     same offset so vertical stacking stays aligned;
 *  2. assert §7.1 bounds and that every layer-L>0 glyph sits on a layer-(L−1) glyph;
 *  3. return layers as row strings. */
function pack(layers) {
  let padRows = Math.max(0, SCHEMA.rowsMin - H), padCols = Math.max(0, SCHEMA.colsMin - W);
  const padTop = Math.floor(padRows / 2), padLeft = Math.floor(padCols / 2);
  const padBot = padRows - padTop, padRight = padCols - padLeft;
  const totalRows = H + padRows;
  if (W + padCols > SCHEMA.colsMax || totalRows > SCHEMA.rowsMax) {
    throw new Error(`pack bounds: ${W + padCols}×${totalRows} outside ${SCHEMA.colsMin}–${SCHEMA.colsMax} × ${SCHEMA.rowsMin}–${SCHEMA.rowsMax} (§7.1)`);
  }
  const edge = '.'.repeat(W + padCols);
  return layers.map((g) => {
    const rows = [
      ...Array(padTop).fill(edge),
      ...g.map((row) => '.'.repeat(padLeft) + row.join('') + '.'.repeat(padRight)),
      ...Array(padBot).fill(edge),
    ];
    return rows;
  });
}

function build(drawFns) {
  const grids = [];
  for (const draw of drawFns) {
    const g = mkGrid();
    draw(g);
    grids.push(g);
  }
  const layers = pack(grids);
  for (let L = 1; L < layers.length; L++) {
    layers[L].forEach((str, r) => {
      [...str].forEach((ch, c) => {
        if (ch !== '.' && layers[L - 1][r][c] === '.') {
          throw new Error(`floating tile: layer ${L} row ${r} col ${c} has no support (§7.1)`);
        }
      });
    });
  }
  return layers;
}

/** Composed plate-stack builder (v0.3.5): ENTRY = [w, h, [layerRunSpecs…]] on a
 *  5×h grid; the first layer is a full w×h slab, every further layer is a plate
 *  of [row, col0, len] runs (must be ⊆ the layer below). Run shorthands below. */
function slabStack(w, h, plates) {
  setBoard(w, h);
  return build([slab(w, h), ...plates.map((runs) => plate(...runs))]);
}

/* Run shorthand: on the 5-wide canon, runs default to horizontally centered. */
const R = (r, len, c0) => [r, c0 ?? Math.floor((5 - len) / 2), len];
const lg = (r0, n, len = 5) => Array.from({ length: n }, (_, i) => R(r0 + i, len)); // ladder segment

/* ------------------------------------------------------------------ shapes */

/** Centered pebble/oval (§7.2): one layer of centered rows on the 5-wide board. */
function pebble(profile) {
  setBoard(5, profile.length);
  return build([(g) => profile.forEach((len, r) => len && hrun(g, r, Math.floor((5 - len) / 2), len))]);
}

/** Donut shell (§7.2): 5-wide rect minus a centered hole. */
function ring(oh, holeRows, holeCols = 1, holeRow0 = 0) {
  setBoard(5, oh);
  return build([(g) => {
    rect(g, 0, 0, 5, oh);
    const hc0 = Math.floor((5 - holeCols) / 2);
    for (let r = holeRow0; r < holeRow0 + holeRows; r++) for (let c = hc0; c < hc0 + holeCols; c++) g[r][c] = '.';
  }]);
}

/** Keep: 5×7 slab with a single-cell crown cell centered on row 7. */
function keep() {
  setBoard(5, 8);
  return build([(g) => { rect(g, 0, 0, 5, 7); hrun(g, 7, 2, 1); }]);
}

/** Cat (§7.2, 5-wide): 2+2 ear legs rows 0–1, full head rows 2–6, 5-wide paws row 7;
 *  optional plate ladders climb the head. */
function cat(plates) {
  setBoard(5, 8);
  const base = (g) => {
    for (let r = 0; r < 2; r++) { hrun(g, r, 0, 2); hrun(g, r, 3, 2); }
    for (let r = 2; r < 8; r++) hrun(g, r, 0, 5);
  };
  const P = plates ?? [lg(2, 4), lg(2, 4)];
  return build([base, ...P.map((runs) => plate(...runs))]);
}

/** Heart (§7.2, 5-wide): lobe rows (2+2 with a 1-wide cleft) + solid body rows;
 *  plate ladders climb the body (default from row 3). */
function heart(plates) {
  setBoard(5, 8);
  const base = (g) => {
    for (let r = 0; r < 2; r++) { hrun(g, r, 0, 2); hrun(g, r, 3, 2); }
    for (let r = 2; r < 8; r++) hrun(g, r, 0, 5);
  };
  const P = plates ?? [lg(3, 4), lg(3, 4)];
  return build([base, ...P.map((runs) => plate(...runs))]);
}

/** Castle (§7.2, 5-wide): wall rows with a single-cell gate notch from row 1 down;
 *  plate ladders stack over the two legs (rows ≥ 1, cols 0–1 / 3–4). */
function castle(plates) {
  setBoard(5, 8);
  const base = (g) => {
    for (let r = 0; r < 8; r++) hrun(g, r, 0, 5);
    for (let r = 1; r < 8; r++) g[r][2] = '.';
  };
  return build([base, ...(plates ?? []).map((runs) => plate(...runs))]);
}

/** Castle-leg plate: `n` rows of both legs (cols 0–1 and 3–4) from row r0. */
const legs = (r0, n) => [
  ...Array.from({ length: n }, (_, i) => [r0 + i, 0, 2]),
  ...Array.from({ length: n }, (_, i) => [r0 + i, 3, 2]),
];

/* ------------------------------------------------------------------ level plan */

// §6 difficulty bands by level id (asserted below, per level). v0.3.5: the 5×8
// footprint forces deeper stacks, so the layer ranges widen accordingly
// (tile ranges, hidden shares and the banding itself are unchanged):
//   A 1–6: 18–36 tiles, 1 layer · B 7–12: 36–60, 1–3 · C 13–24: 60–84, 3–4, hidden 1–3
//   D 25–36: 84–108, 3–5 · E 37–48: 108–136, 4–6 · F 49–60: 120–136, 5–7
const BANDS = [
  { lo: 1, hi: 6, tiles: [18, 36], layers: [1, 1] },
  { lo: 7, hi: 12, tiles: [36, 60], layers: [1, 3] },
  { lo: 13, hi: 24, tiles: [60, 84], layers: [3, 4] },
  { lo: 25, hi: 36, tiles: [84, 108], layers: [3, 5] },
  { lo: 37, hi: 48, tiles: [108, 136], layers: [4, 6] },
  { lo: 49, hi: 60, tiles: [120, 136], layers: [5, 7] },
];
const bandOf = (id) => BANDS.find((b) => id >= b.lo && id <= b.hi);

// hidden counts: 0 for 1–12 (§7.1 teaching pacing); 1–3 on 13–24; ~12% / ~18% / 25% after
const hiddenFor = (id, tiles) => {
  if (id <= 12) return 0;
  if (id <= 24) return Math.min(3, Math.max(1, Math.round((id - 12) / 4)));
  if (id <= 36) return Math.floor(tiles * 0.12);
  if (id <= 48) return Math.floor(tiles * 0.18);
  return Math.floor(tiles / 4); // = 25% (validator cap is the same value)
};

// 60 candy level names (§6/§7.2 — build-agent-authored; unchanged v0.3.5)
const NAMES = [
  // Melon 1–12
  'First Pops', 'Bubble Bounce', 'Tiny Treats', 'Sherbet Circle', 'Sweet Ring-Around', 'Peppermint Path',
  'Sugar Wall', 'Marshmallow Munch', 'Licorice Lineup', 'Bubblegum Blocks', 'Candy Keep', 'Melon Zinger',
  // Blueberry 13–24
  'Berry Basecamp', 'Fog Fountain', 'Wing Flight', 'Wing Rally', 'Crossroads Craving', 'Berry Bazaar',
  'Heartbeat Hollows', 'Sugar Stack', 'Twin Pillars', 'Riddle Rind', 'Rest Stop', 'Jam Session',
  // Lemon 25–36
  'Lemon Layer', 'Zesty Levels', 'Citrus Castle', 'Peel Puzzle', 'Pucker Up', 'Lemonade Stand',
  'Butter Mint', 'Fruit Punch', 'Sweet Shoppe', 'Sugar Citadel', 'Cream Column', 'Lemon Squeeze',
  // Grape 37–48
  'Vine Villain', 'Purple Pantry', 'Grape Gateway', 'Juice Junction', 'Jam Fortress', 'Fizz Factory',
  'Royal Row', 'Barrel of Grapes', 'Raisin Rampart', 'Purple Peak', 'Cordial Keep', 'Great Grape',
  // Rainbow 49–60
  'Rainbow Road', 'Shell Shuffle', 'Sour Storm', 'Sugar Shell', 'Prism Palace', 'End of the Jar',
  'Gumball Gauntlet', 'Candy Cascade', 'Final Frolic', 'The Big Sprinkle', 'Sugar Showdown', 'Sweetest Victory',
];

// id → [expected tile count (authoring self-check), shape call]. Tile counts are
// IDENTICAL to the v0.3.3 plan; silhouettes are re-sculpted to the 5-wide canon.
const PLAN = {
  /* Band A — Pebbles & Rings (1 layer, 18–36 tiles) */
  1: [18, () => pebble([3, 4, 5, 4, 2])],
  2: [22, () => pebble([2, 4, 5, 5, 4, 2])],
  3: [26, () => pebble([3, 4, 5, 5, 5, 4])],
  4: [20, () => ring(5, 5)],           // two 2-wide legs, 5 rows
  5: [28, () => ring(6, 2, 1, 2)],
  6: [34, () => ring(7, 1, 1, 3)],
  /* Band B — Keeps & first stacks (1–3 layers, 36–60) */
  7: [36, () => keep()],
  8: [40, () => slabStack(5, 8, [])],
  9: [44, () => slabStack(5, 8, [[R(0, 4)]])],
  10: [46, () => slabStack(5, 8, [[R(0, 4), R(1, 2)]])],
  11: [50, () => slabStack(5, 8, [lg(0, 2)])],
  12: [54, () => slabStack(5, 8, [lg(0, 2), [R(0, 4)]])],
  /* Band C — Blueberry: deep bloom keeps (3–4 layers, 60–84, hidden 1–3) */
  13: [64, () => slabStack(5, 8, [lg(0, 4), [R(0, 4)]])],
  14: [66, () => slabStack(5, 8, [lg(0, 4), [R(0, 4), R(1, 2)]])],
  15: [64, () => slabStack(5, 8, [[R(0, 5), R(1, 5), R(2, 5), R(3, 1)], [R(0, 5), R(1, 3)]])],
  16: [68, () => slabStack(5, 8, [lg(0, 4), [R(0, 4), R(1, 4)]])],
  17: [68, () => slabStack(5, 8, [[...lg(0, 4), R(4, 4)], [R(0, 4)]])],
  18: [70, () => slabStack(5, 8, [[...lg(0, 4), R(4, 4)], [R(0, 5)], [R(0, 1)]])],
  19: [74, () => slabStack(5, 8, [lg(0, 6), [R(0, 4)]])],
  20: [78, () => cat()],
  21: [84, () => slabStack(5, 8, [lg(0, 6), lg(0, 2), [R(0, 4)]])],
  22: [82, () => slabStack(5, 8, [lg(0, 6), lg(0, 2), [R(0, 2)]])],
  23: [78, () => heart()],
  24: [82, () => heart([[...lg(3, 4)], [...lg(3, 4)], [R(3, 4)]])],
  /* Band D — Lemon: towers & citadels (3–5 layers, 84–108, hidden ~12%) */
  25: [90, () => slabStack(5, 8, [lg(0, 6), lg(0, 4)])],
  26: [86, () => slabStack(5, 8, [[...lg(0, 4), R(4, 4)], [R(0, 5), R(1, 5), R(2, 4)], [R(0, 4), R(1, 4)]])],
  27: [104, () => slabStack(5, 8, [[...lg(0, 6), R(6, 4)], lg(0, 4), [R(0, 4), R(1, 4)], [R(0, 2)]])],
  28: [86, () => castle([[...legs(1, 7)], [...legs(1, 4)], [...legs(1, 2)], [[1, 0, 1]]])],
  29: [102, () => slabStack(5, 8, [[...lg(0, 6), R(6, 4)], lg(0, 4), [R(0, 4), R(1, 4)]])],
  30: [94, () => slabStack(5, 8, [lg(0, 6), [R(0, 5), R(1, 5), R(2, 5), R(3, 1)], [R(0, 4), R(1, 4)]])],
  31: [106, () => slabStack(5, 8, [lg(0, 8), lg(0, 4), [R(0, 5)], [R(0, 1)]])],
  32: [92, () => slabStack(5, 8, [lg(0, 6), [R(0, 5), R(1, 5), R(2, 5), R(3, 1)], [R(0, 4), R(1, 2)]])],
  33: [106, () => slabStack(5, 8, [lg(0, 8), [...lg(0, 4), R(4, 4)], [R(0, 2)]])],
  34: [102, () => slabStack(5, 8, [[...lg(0, 7), R(7, 3)], lg(0, 4), [R(0, 4)]])],
  35: [102, () => slabStack(5, 8, [lg(0, 6), [R(0, 5), R(1, 5), R(2, 5), R(3, 1)], lg(0, 2), [R(0, 4), R(1, 2)]])],
  36: [94, () => slabStack(5, 8, [[...lg(0, 4), R(4, 4)], lg(0, 4), lg(0, 2)])],
  /* Band E — Grape: grand towers (4–6 layers, 108–136, hidden ~18%) */
  37: [126, () => slabStack(5, 8, [lg(0, 8), lg(0, 6), [R(0, 5), R(1, 5), R(2, 5), R(3, 1)]])],
  38: [126, () => slabStack(5, 8, [lg(0, 8), [...lg(0, 6), R(6, 4)], lg(0, 2), [R(0, 2)]])],
  39: [120, () => slabStack(5, 8, [lg(0, 8), lg(0, 6), lg(0, 2)])],
  40: [108, () => slabStack(5, 8, [lg(0, 8), lg(0, 4), [R(0, 4), R(1, 4)]])],
  41: [134, () => slabStack(5, 8, [lg(0, 8), lg(0, 8), lg(0, 2), [R(0, 3)], [R(0, 1)]])],
  42: [130, () => slabStack(5, 8, [lg(0, 8), lg(0, 6), [R(0, 5), R(1, 5), R(2, 5), R(3, 1)], [R(0, 4)]])],
  43: [132, () => slabStack(5, 8, [lg(0, 8), lg(0, 8), lg(0, 2), [R(0, 2)]])],
  44: [128, () => slabStack(5, 8, [lg(0, 8), lg(0, 8), [R(0, 4), R(1, 4)]])],
  45: [132, () => slabStack(5, 8, [[...lg(0, 7), R(7, 3)], [...lg(0, 7), R(7, 3)], lg(0, 2), [R(0, 4), R(1, 2)]])],
  46: [134, () => slabStack(5, 8, [lg(0, 8), [...lg(0, 6), R(6, 4)], [R(0, 5), R(1, 5), R(2, 5), R(3, 1)], [R(0, 4)]])],
  47: [134, () => slabStack(5, 8, [lg(0, 8), lg(0, 6), lg(0, 4), [R(0, 4)]])],
  48: [128, () => slabStack(5, 8, [lg(0, 8), lg(0, 6), [R(0, 5), R(1, 5), R(2, 5), R(3, 1)], [R(0, 2)]])],
  /* Band F — Rainbow: tower finale (5–7 layers, 120–136, hidden 25%) */
  49: [122, () => slabStack(5, 8, [lg(0, 8), lg(0, 6), lg(0, 2), [R(0, 2)]])],
  50: [134, () => slabStack(5, 8, [lg(0, 8), lg(0, 8), lg(0, 2), [R(0, 3)], [R(0, 1)]])],
  51: [132, () => slabStack(5, 8, [lg(0, 8), lg(0, 8), lg(0, 2), [R(0, 2)]])],
  52: [132, () => slabStack(5, 8, [lg(0, 8), lg(0, 6), [R(0, 5), R(1, 5), R(2, 5), R(3, 1)], [R(0, 4)], [R(0, 2)]])],
  53: [134, () => slabStack(5, 8, [lg(0, 8), [...lg(0, 6), R(6, 4)], [R(0, 5), R(1, 5), R(2, 5), R(3, 1)], [R(0, 4)]])],
  54: [134, () => slabStack(5, 8, [lg(0, 8), lg(0, 8), [R(0, 5), R(1, 5), R(2, 2)], [R(0, 2)]])],
  55: [134, () => slabStack(5, 8, [lg(0, 8), lg(0, 6), lg(0, 2), [R(0, 4), R(1, 4)], [R(0, 4)], [R(0, 2)]])],
  56: [134, () => slabStack(5, 8, [[...lg(0, 6), R(6, 4)], [...lg(0, 6), R(6, 4)], lg(0, 4), [R(0, 4)], [R(0, 2)]])],
  57: [132, () => slabStack(5, 8, [lg(0, 8), [...lg(0, 6), R(6, 4)], lg(0, 2), [R(0, 4), R(1, 2)], [R(0, 2)]])],
  58: [136, () => slabStack(5, 8, [lg(0, 8), lg(0, 8), [R(0, 5), R(1, 5), R(2, 2)], [R(0, 4)]])],
  59: [122, () => slabStack(5, 8, [[...lg(0, 6), R(6, 4)], lg(0, 6), lg(0, 2), [R(0, 4), R(1, 2)], [R(0, 2)]])],
  60: [136, () => slabStack(5, 8, [lg(0, 8), lg(0, 8), lg(0, 2), [R(0, 4)], [R(0, 2)]])],
};

/* ------------------------------------------------------------------ assemble */

const CHAPTERS = [
  { chapter: 'Melon', accent: '#ff5d8f', ids: [1, 12] },
  { chapter: 'Blueberry', accent: '#7a5cff', ids: [13, 24] },
  { chapter: 'Lemon', accent: '#ffcb3d', ids: [25, 36] },
  { chapter: 'Grape', accent: '#b46bf2', ids: [37, 48] },
  { chapter: 'Rainbow', accent: '#ff8c42', ids: [49, 60] },
];

mkdirSync(join(root, 'data'), { recursive: true });
const failures = [];

for (const [ci, ch] of CHAPTERS.entries()) {
  const levels = [];
  for (let id = ch.ids[0]; id <= ch.ids[1]; id++) {
    const [expected, make] = PLAN[id];
    const layers = make();
    const tiles = cellCount(layers);
    const band = bandOf(id);
    if (tiles !== expected) failures.push(`level ${id}: tiles=${tiles}, expected ${expected}`);
    if (tiles % 2 !== 0) failures.push(`level ${id}: odd tile count ${tiles}`);
    if (tiles > 136) failures.push(`level ${id}: ${tiles} tiles exceed the 136-tile deck (§8.1)`);
    if (tiles < band.tiles[0] || tiles > band.tiles[1]) {
      failures.push(`level ${id}: tiles=${tiles} outside §6 band ${band.tiles[0]}–${band.tiles[1]}`);
    }
    const layerN = layers.length;
    if (layerN < band.layers[0] || layerN > band.layers[1]) {
      failures.push(`level ${id}: layers=${layerN} outside §6 band ${band.layers[0]}–${band.layers[1]}`);
    }
    if (layerN > 7) failures.push(`level ${id}: layers=${layerN} exceed the 7-layer stack (§6 v0.3.5)`);
    const hidden = hiddenFor(id, tiles);
    if (hidden > Math.floor(tiles / 4)) failures.push(`level ${id}: hidden=${hidden} > cap ${Math.floor(tiles / 4)}`);
    levels.push({ id, name: NAMES[id - 1], t2: null, t3: null, hidden, layers });
  }
  const json = { chapter: ch.chapter, accent: ch.accent, levels };
  const { chapterIssues, levelIssues } = validateChapter(json, { chapterIndex: ci + 1, full: true });
  for (const m of chapterIssues) failures.push(`chapter ${ch.chapter}: ${m}`);
  levelIssues.forEach((issues, idx) => {
    for (const m of issues) failures.push(`level ${levels[idx].id} (${ch.chapter}): ${m}`);
  });
  if (failures.length === 0) {
    writeFileSync(join(root, 'data', `levels-${ci + 1}.json`), JSON.stringify(json, null, 2) + '\n');
  }
  console.log(ch.chapter.padEnd(9) + levels.map((l) => `${l.id}:${cellCount(l.layers)}h${l.hidden}x${l.layers.length}`).join(' '));
}

if (failures.length) {
  console.error(`\nFAIL — ${failures.length} issue(s):`);
  for (const m of failures) console.error(' - ' + m);
  process.exit(1);
}
console.log('\nOK — 5 chapters × 12 levels authored; §6 bands + §7.1 validator passed (v0.3.5 5×8 canon).');
