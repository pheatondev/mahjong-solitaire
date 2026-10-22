#!/usr/bin/env node
/* scripts/build-levels.mjs — M2 content authoring tool (GDD §7.2: the build agent authors
   all ~12 base shapes and all 60 level entries — shapes, candy level names; t2/t3 stay null
   so the §4.2 formulas apply; hidden counts follow the §6 curve). NOT part of the deploy:
   it deterministically writes the committed data/levels-1..5.json.

   Every generated level is asserted against:
   - §6 difficulty bands (tile count range, layer-count range per level id)
   - §7.1 layout validity via the production validator (cols 8–14, rows 6–12, even count,
     layer L>0 sits on layer L−1 — no floating tiles —, hidden ≤ floor(tiles/4), hidden = 0
     for levels 1–12, consecutive ids, 12 levels per chapter)
   - the 136-tile standard deck (a level can never request more tiles than the bag holds, §8.1)
   - a per-level expected tile count (authoring self-check against hand math)

   Re-run from the repo root: node scripts/build-levels.mjs */

import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { validateChapter } from '../src/data/levels.js';

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

/** Finalize a set of layer grids (all drawn on the same W×H grid):
 *  1. pad rows/cols up to §7.1 minimums (6 × 8) symmetrically — every layer gets the
 *     same offset so vertical stacking stays aligned;
 *  2. assert §7.1 bounds and that every layer-L>0 glyph sits on a layer-(L−1) glyph;
 *  3. return layers as row strings. */
function pack(layers) {
  let padRows = Math.max(0, 6 - H), padCols = Math.max(0, 8 - W);
  const padTop = Math.floor(padRows / 2), padLeft = Math.floor(padCols / 2);
  const padBot = padRows - padTop, padRight = padCols - padLeft;
  const totalRows = H + padRows;
  if (W + padCols > 14 || totalRows > 12) {
    throw new Error(`pack bounds: ${W + padCols}×${totalRows} outside 8–14 × 6–12 (§7.1)`);
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

/* ------------------------------------------------------------------ shapes
   Tier stacks (layer 1+) are always same-row nested runs on a solid lower row —
   the generic support assert catches any placement mistake at build time. */

function pebble(profile) { // oval
  const w = Math.max(...profile) + 2;
  setBoard(w, profile.length);
  return build([(g) => profile.forEach((c, r) => hrun(g, r, Math.floor((w - c) / 2), c))]);
}

function ring(ow, oh, hw, hh) { // donut = rect − centered hole
  setBoard(ow, oh);
  return build([(g) => {
    rect(g, 0, 0, ow, oh);
    const hc0 = Math.floor((ow - hw) / 2), hr0 = Math.floor((oh - hh) / 2);
    for (let r = hr0; r < hr0 + hh; r++) for (let c = hc0; c < hc0 + hw; c++) g[r][c] = '.';
  }]);
}

function wall(w, wallRows, stackRows, capW = 0) { // full-width wall + 6-wide center stack rows
  setBoard(w, wallRows + stackRows);
  const draws = [(g) => {
    for (let r = 0; r < wallRows; r++) hrun(g, r, 0, w);
    for (let r = wallRows; r < wallRows + stackRows; r++) hrun(g, r, Math.floor((w - 6) / 2), 6);
  }];
  if (capW > 0) draws.push((g) => hrun(g, 0, Math.floor((w - capW) / 2), capW)); // cap on the solid top wall row
  return build(draws);
}

function pyramid(baseRows, tiers = []) { // trapezoid (top→bottom, widest last) + tiers on the bottom row
  const w = Math.max(...baseRows);
  setBoard(w, baseRows.length);
  const draws = [(g) => baseRows.forEach((c, r) => hrun(g, r, Math.floor((w - c) / 2), c))];
  const bottom = baseRows.length - 1;
  for (const tw of tiers) draws.push((g) => hrun(g, bottom, Math.floor((w - tw) / 2), tw));
  return build(draws);
}

function cross(hRows, wCols, tiers = []) { // plus: 4-wide vertical bar + 4-row horizontal bar
  setBoard(wCols, hRows);
  const cy = Math.floor(hRows / 2);
  const draws = [(g) => {
    rect(g, Math.floor((wCols - 4) / 2), 0, 4, hRows);
    for (let r = cy - 2; r < cy + 2; r++) hrun(g, r, 0, wCols);
  }];
  for (const tw of tiers) draws.push((g) => hrun(g, cy - 2, Math.floor((wCols - tw) / 2), tw)); // tier on a horizontal-bar row
  return build(draws);
}

function butterfly(profile, tiers = []) { // mirrored wings — max wing ≤ 6 keeps cols ≤ 14
  const w = Math.max(...profile) * 2 + 2;
  setBoard(w, profile.length);
  const draws = [(g) => profile.forEach((p, r) => { hrun(g, r, 0, p); hrun(g, r, w - p, p); })];
  const rmax = profile.indexOf(Math.max(...profile)); // widest row solidly supports a wing-top tier
  for (const tw of tiers) draws.push((g) => hrun(g, rmax, 0, tw));
  return build(draws);
}

function heart(rows, tiers = []) { // rows: [solidWidth] | [left, gap, right]; widest row carries tiers
  const norm = rows.map((sp) => (typeof sp === 'number' ? [sp] : sp));
  const widths = norm.map((sp) => (sp.length === 1 ? sp[0] : sp[0] + sp[1] + sp[2]));
  const w = Math.max(8, ...widths);
  setBoard(w, norm.length);
  const rmax = widths.indexOf(Math.max(...widths));
  const draws = [(g) => norm.forEach((sp, r) => {
    if (sp.length === 1) hrun(g, r, Math.floor((w - sp[0]) / 2), sp[0]);
    else {
      const c0 = Math.floor((w - (sp[0] + sp[1] + sp[2])) / 2);
      hrun(g, r, c0, sp[0]); hrun(g, r, c0 + sp[0] + sp[1], sp[2]);
    }
  })];
  for (const tw of tiers) draws.push((g) => hrun(g, rmax, Math.floor((w - tw) / 2), tw));
  return build(draws);
}

function flower(w, h, tiers = [], cuts = false) { // bloom = rect (− corner cuts) + stacked center tiers
  setBoard(w, h);
  const draws = [(g) => {
    rect(g, 0, 0, w, h);
    if (cuts) for (const [c0, r0] of [[0, 0], [w - 2, 0], [0, h - 2], [w - 2, h - 2]]) {
      for (let dr = 0; dr < 2; dr++) for (let dc = 0; dc < 2; dc++) g[r0 + dr][c0 + dc] = '.';
    }
  }];
  const mid = Math.floor(h / 2); // a full-width row (corner cuts never reach it)
  for (const tw of tiers) draws.push((g) => hrun(g, mid, Math.floor((w - tw) / 2), tw));
  return build(draws);
}

function tunnel(w, topRows, botRows, sideW, midRows, tiers = []) { // frame walls + open middle
  setBoard(w, topRows + botRows + midRows);
  const draws = [(g) => {
    for (let r = 0; r < topRows; r++) hrun(g, r, 0, w);
    for (let r = topRows; r < topRows + midRows; r++) { hrun(g, r, 0, sideW); hrun(g, r, w - sideW, sideW); }
    for (let r = topRows + midRows; r < topRows + midRows + botRows; r++) hrun(g, r, 0, w);
  }];
  for (const tw of tiers) draws.push((g) => hrun(g, topRows, 0, tw)); // tiers stacked over the lower side column
  return build(draws);
}

function cat(headW, headH, bodyH, earRows = 2, tiers = []) { // ears + head + body row(s) + paws
  const bw = headW + 2;
  setBoard(bw, earRows + headH + bodyH + 1);
  const h0 = earRows, b0 = earRows + headH;
  const draws = [(g) => {
    for (let r = 0; r < earRows; r++) { hrun(g, r, 1, 2); hrun(g, r, bw - 3, 2); }
    for (let r = h0; r < b0; r++) hrun(g, r, 1, headW);
    for (let r = b0; r < b0 + bodyH; r++) hrun(g, r, 0, bw);
    hrun(g, b0 + bodyH, Math.floor((bw - 2) / 2), 2);
  }];
  for (const tw of tiers) draws.push((g) => hrun(g, b0 - 1, Math.floor((bw - tw) / 2), tw)); // tiers on the head top row
  return build(draws);
}

function castle(baseRows, tiers = []) { // full-width wall rows + gate notches; tiers crown the solid top row
  const w = Math.max(...baseRows);
  setBoard(w, baseRows.length);
  const draws = [(g) => {
    baseRows.forEach((rw, r) => hrun(g, r, 0, rw));
    const gc = Math.floor(w / 2) - 1;
    for (let r = 1; r < baseRows.length; r++) { g[r][gc] = '.'; g[r][gc + 1] = '.'; }
  }];
  for (const tw of tiers) draws.push((g) => hrun(g, 0, Math.floor((w - tw) / 2), tw));
  return build(draws);
}

function turtle(bodyRows, tiers = []) { // tail + 14-wide shell rows + 4-wide head; tiers = shell pagoda
  setBoard(14, bodyRows + 3);
  const shellTop = 1;
  const draws = [(g) => {
    hrun(g, 0, 6, 2); // tail
    for (let r = shellTop; r < shellTop + bodyRows; r++) hrun(g, r, 0, 14);
    hrun(g, shellTop + bodyRows, 5, 4); hrun(g, shellTop + bodyRows + 1, 5, 4); // head
  }];
  for (const tw of tiers) draws.push((g) => hrun(g, shellTop, Math.floor((14 - tw) / 2), tw));
  return build(draws);
}

/* ------------------------------------------------------------------ level plan */

// §6 difficulty bands by level id (asserted below, per level):
//   A 1–6: 18–36 tiles, 1 layer · B 7–12: 36–60, 1–2 · C 13–24: 60–84, 2–3, hidden 1–3
//   D 25–36: 84–108, 3–4 · E 37–48: 108–136, 3–5 · F 49–60: 120–136, 4–5
const BANDS = [
  { lo: 1, hi: 6, tiles: [18, 36], layers: [1, 1] },
  { lo: 7, hi: 12, tiles: [36, 60], layers: [1, 2] },
  { lo: 13, hi: 24, tiles: [60, 84], layers: [2, 3] },
  { lo: 25, hi: 36, tiles: [84, 108], layers: [3, 4] },
  { lo: 37, hi: 48, tiles: [108, 136], layers: [3, 5] },
  { lo: 49, hi: 60, tiles: [120, 136], layers: [4, 5] },
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

// 60 candy level names (§6/§7.2 — build-agent-authored)
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

// id → [expected tile count (authoring self-check), shape call]. Tier stacks are listed
// bottom-up and always nest on a solid lower row (the builder asserts support).
const PLAN = {
  /* Band A — Pebbles & Rings (1 layer, 18–36 tiles) */
  1: [18, () => pebble([2, 4, 6, 4, 2])],
  2: [22, () => pebble([2, 6, 6, 6, 2])],
  3: [26, () => pebble([2, 6, 8, 8, 2])],
  4: [20, () => ring(6, 4, 2, 2)],
  5: [28, () => ring(8, 4, 2, 2)],
  6: [34, () => ring(8, 5, 2, 3)],
  /* Band B — Walls (1–2 layers, 36–60) */
  7: [36, () => wall(12, 2, 2)],
  8: [40, () => wall(14, 2, 2)],
  9: [44, () => wall(10, 2, 4)],
  10: [46, () => wall(14, 2, 2, 6)],
  11: [50, () => wall(12, 2, 3, 8)],
  12: [54, () => wall(14, 2, 3, 8)],
  /* Band C — Blueberry: first layers + first fog (2–3 layers, 60–84, hidden 1–3) */
  13: [64, () => pyramid([8, 10, 12, 14, 14], [6])],
  14: [66, () => pyramid([6, 8, 10, 12, 14, 14], [2])],
  15: [64, () => butterfly([2, 4, 6, 6, 6, 4, 2], [4])],
  16: [68, () => pyramid([8, 10, 12, 14, 14], [8, 2])],
  17: [68, () => cross(12, 8, [4])],
  18: [70, () => cross(12, 9, [2])],
  19: [74, () => butterfly([2, 4, 6, 6, 6, 6, 4, 2], [2])],
  20: [78, () => heart([[3, 4, 3], [5, 2, 5], 9, 11, 13, 13, 9, 5], [2])],
  21: [84, () => heart([[3, 4, 3], [5, 2, 5], 9, 11, 13, 13, 11, 9], [2])],
  22: [82, () => cross(12, 12, [2])],
  23: [78, () => pyramid([8, 10, 12, 14, 14, 14], [6])],
  24: [82, () => pyramid([8, 10, 12, 14, 14, 14], [6, 4])],
  /* Band D — Lemon: towers & keeps (3–4 layers, 84–108, hidden ~12%) */
  25: [90, () => flower(12, 7, [4, 2])],
  26: [86, () => tunnel(12, 2, 2, 4, 4, [4, 2])],
  27: [104, () => cat(10, 4, 4, 2, [4, 2])],
  28: [86, () => castle([14, 14, 14, 14, 14, 12], [8, 4, 2])],
  29: [102, () => flower(12, 8, [4, 2])],
  30: [94, () => tunnel(14, 2, 2, 4, 4, [4, 2])],
  31: [106, () => cat(12, 4, 3, 2, [4, 2])],
  32: [92, () => castle([14, 14, 14, 12, 12, 12], [12, 10, 2])],
  33: [106, () => flower(12, 8, [8, 2])],
  34: [102, () => tunnel(14, 3, 2, 4, 3, [4, 4])],
  35: [102, () => cat(10, 5, 3, 2, [4, 2])],
  36: [94, () => castle([14, 14, 14, 14, 14, 14], [10, 8, 2])],
  /* Band E — Grape: grand boards (3–5 layers, 108–136, hidden ~18%) */
  37: [126, () => flower(12, 10, [4, 2])],
  38: [126, () => tunnel(14, 3, 3, 4, 4, [4, 4, 2])],
  39: [120, () => cat(12, 4, 4, 2, [4, 2])],
  40: [108, () => castle([14, 14, 14, 14, 14, 14, 14], [12, 6, 4])],
  41: [134, () => flower(12, 10, [10, 4])],
  42: [130, () => tunnel(14, 3, 3, 5, 4, [4, 2])],
  43: [132, () => cat(12, 5, 4, 2, [4, 2])],
  44: [128, () => castle([14, 14, 14, 14, 14, 14, 14, 14], [12, 10, 6, 2])],
  45: [132, () => flower(14, 9, [4, 2])],
  46: [134, () => tunnel(14, 3, 3, 4, 5, [4, 4, 2])],
  47: [134, () => cat(12, 4, 5, 2, [4, 2])],
  48: [128, () => castle([14, 14, 14, 14, 14, 14, 14, 14, 14], [8, 6, 4])],
  /* Band F — Rainbow: shell finale (4–5 layers, 120–136, hidden 25%) */
  49: [122, () => turtle(7, [8, 4, 2])],
  50: [134, () => castle([14, 14, 14, 14, 14, 14, 14, 14], [12, 10, 8, 6])],
  51: [132, () => flower(12, 10, [6, 4, 2])],
  52: [132, () => turtle(7, [12, 8, 4])],
  53: [134, () => cat(12, 5, 4, 2, [4, 2, 2])],
  54: [134, () => tunnel(14, 3, 3, 5, 4, [5, 3, 2])],
  55: [134, () => turtle(8, [6, 4, 2])],
  56: [134, () => castle([14, 14, 14, 14, 14, 14, 14, 14, 14], [10, 8, 4, 2])],
  57: [132, () => cat(10, 5, 4, 2, [10, 8, 4, 2])],
  58: [136, () => turtle(8, [8, 4, 2])],
  59: [122, () => flower(14, 9, [6, 4, 2], true)],
  60: [136, () => turtle(8, [10, 2, 2])],
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
  console.log(ch.chapter.padEnd(9) + levels.map((l) => `${l.id}:${l.tiles ?? cellCount(l.layers)}h${l.hidden}`).join(' '));
}

if (failures.length) {
  console.error(`\nFAIL — ${failures.length} issue(s):`);
  for (const m of failures) console.error(' - ' + m);
  process.exit(1);
}
console.log('\nOK — 5 chapters × 12 levels authored; §6 bands + §7.1 validator passed.');

