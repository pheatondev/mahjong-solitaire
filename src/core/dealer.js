/* dealer.js — board generation, reverse-order construction (§8.1, locked reference shape)
   + face bag composition (§8.1 step 3 / Appendix A). No solver here; the solver backstop
   lives in solver.js and runs generation-time only (§8.2). */

import { mulberry32, shuffled } from '../util.js';
import { isFree, unblockCount } from './rules.js';

/** Dealt faces use the pure standard 136-tile deck only — decorative flowers/seasons are
 *  never dealt in v1 (§8.1 locked / §11). Locked composition order (§8.1 step 3). */
const FAMILY_ORDER = [
  'd1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7', 'd8', 'd9', // Dots 1–9
  'b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7', 'b8', 'b9', // Bamboo 1–9
  'c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9', // Characters 1–9
  'wE', 'wS', 'wW', 'wN',                               // Winds 東南西北
  'drR', 'drG', 'drW',                                  // Dragons 中發白 (Appendix A order)
];

/** Compose the face bag for a tile budget (locked §8.1 step 3): 4 copies per family in
 *  deck order until the remainder would drop below 4, then ONE final family at 2 copies
 *  to land on parity. Deterministic per tile count (§8.1 note). */
export function composeBag(tileCount) {
  let rem = tileCount | 0;
  const bag = [];
  for (const f of FAMILY_ORDER) {
    if (rem === 0) break;
    const take = rem <= 2 ? 2 : 4;
    for (let i = 0; i < take; i++) bag.push(f);
    rem -= take;
  }
  if (rem !== 0) throw new Error('bag composition off parity for ' + tileCount + ' tiles');
  return bag;
}

/**
 * §8.1 construct(): simulate the play-through IN REVERSE — repeatedly pair two currently-free
 * positions, removing them, until empty. Produces pairSlots whose i-th entry is a legal i-th
 * move of a real solution (availability lemma, §8.1). Stalls back-track ⌈k⌉ ≤ 3 pair slots.
 */
export function construct(positions, rng) {
  const remaining = positions.slice();
  const pairSlots = [];
  let stuckBudget = 400;

  while (remaining.length > 0) {
    // §8.1 locked pseudocode: BOTH picks come from the same pre-removal free set —
    // a pair the §8.3 solver could not take atomically would breach its backstop role.
    const free = remaining.filter((p) => isFree(remaining, p));
    if (free.length >= 2) {
      const p = weightedPick(free, remaining, rng); // soft heuristic: unblock the most
      free.splice(free.indexOf(p), 1);
      const q = weightedPick(free, remaining, rng);
      removeOne(remaining, p);
      removeOne(remaining, q);
      pairSlots.push({ a: p, b: q });
    } else {
      // Stuck: fewer than 2 free with tiles remaining → undo last ⌈k⌉ pair slots (k ≤ 3).
      console.count('construct-stuck');
      if (--stuckBudget <= 0) return null; // attempt stalls → caller escalates (§8.1 loop)
      const k = Math.min(pairSlots.length, 1 + Math.floor(rng() * 3));
      for (let i = 0; i < k; i++) {
        const s = pairSlots.pop();
        remaining.push(s.a, s.b);
      }
    }
  }
  return pairSlots;
}

function removeOne(arr, t) {
  const i = arr.indexOf(t);
  arr.splice(i, 1);
}

/** rng-weighted toward picks that unblock the most tiles — a soft heuristic, not a
 *  correctness requirement (§8.1 note). */
function weightedPick(cands, remaining, rng) {
  let total = 0;
  const weights = cands.map((c) => {
    const wgt = 1 + unblockCount(remaining, c);
    total += wgt;
    return wgt;
  });
  let roll = rng() * total;
  for (let i = 0; i < cands.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return cands[i];
  }
  return cands[cands.length - 1];
}

/** Dealt layout ASCII → positions [{layer,row,col}] (footprint glyphs per §7.1). */
export function layoutPositions(layers) {
  const positions = [];
  layers.forEach((rows, layer) => {
    rows.forEach((str, row) => {
      for (let col = 0; col < str.length; col++) {
        if (str[col] !== '.') positions.push({ layer, row, col });
      }
    });
  });
  return positions;
}

/**
 * §8.1 step 4: assign one face per pair slot in generated order — the next family with
 * ≥ 2 copies remaining in the (already shuffled) bag goes to that slot. Family counts in
 * the bag are invariantly even (composeBag emits 4/2; slots consume 2), so the scan can
 * never strand a positive family — it returns null only when the multiset itself cannot
 * be slotted (an odd family group, possible on shuffle remainders §5.2).
 */
function facesForSlots(bag, slotCount) {
  const counts = new Map();
  for (const f of bag) counts.set(f, (counts.get(f) ?? 0) + 1);
  const faces = [];
  let ptr = 0;
  for (let i = 0; i < slotCount; i++) {
    while (ptr < bag.length && counts.get(bag[ptr]) < 2) ptr++; // next family with ≥ 2 copies
    if (ptr >= bag.length) return null; // multiset not pairable → caller escalates per its section
    const f = bag[ptr];
    counts.set(f, counts.get(f) - 2); // both positions of the slot take the same face (§8.1 step 4)
    faces.push(f);
    ptr++;
  }
  return faces;
}

/**
 * Deal one board for a level + reDealCounter (seed = levelId × 7919 + reDealCounter, §14.4).
 * Order per §8.1: positions → reverse-order construction → bag compose → shuffle →
 * per pair slot: next family with ≥ 2 copies remaining. Then §8.4: hidden positions are
 * chosen among P by the same seeded stream AFTER the faces are fixed, capped at floor(tiles/4).
 */
export function dealBoard(level, reDealCounter) {
  const positions = layoutPositions(level.layers);
  let slots = null;
  let rng = null;
  for (let attempt = 1; attempt <= 10 && !slots; attempt++) {
    // fresh RNG stream per attempt (§8.1 attempt loop); attempt index folds the seed
    rng = mulberry32(level.id * 7919 + reDealCounter + attempt);
    slots = construct(positions, rng);
  }
  if (!slots) throw new Error('deal stalled on all 10 attempts (§8.1) — check layout');

  const bag = shuffled(composeBag(positions.length), rng); // shuffle the bag (§8.1 step 3)
  const faces = facesForSlots(bag, slots.length); // parity structurally guaranteed on a fresh bag
  if (!faces) throw new Error('fresh deal bag failed to slot — composeBag bug');

  const tiles = [];
  let id = 0;
  slots.forEach((s, i) => {
    tiles.push({ id: id++, face: faces[i], layer: s.a.layer, row: s.a.row, col: s.a.col });
    tiles.push({ id: id++, face: faces[i], layer: s.b.layer, row: s.b.row, col: s.b.col });
  });

  // §8.4: hidden positions, purely visual, any position is fair; no all-hidden-pair rule.
  const hiddenN = Math.min(level.hidden ?? 0, Math.floor(tiles.length / 4));
  if (hiddenN > 0) {
    const order = shuffled(tiles, rng); // seeded stream continues after faces are fixed
    const hiddenIds = new Set(order.slice(0, hiddenN).map((t) => t.id));
    for (const t of tiles) if (hiddenIds.has(t.id)) t.hidden = true;
  }
  tiles.forEach((t) => { if (!t.hidden) t.hidden = false; });

  // slots also returned for dev play-throughs (§8.1: reverse peel order = legal forward order)
  return { tiles, tileCount: tiles.length, pairCount: tiles.length / 2, slots };
}

/**
 * §5.2 shuffle: re-pair the multiset of faces currently on the board via reverse-order
 * construction restricted to the remaining positions. Hidden flags stay fixed to
 * positions (§8.4); positions/occupancy never change. Seeded: caller passes
 * seed = levelId × 7919 + reDealCounter; 10 fresh RNG streams per the shared attempt loop.
 * @returns Array<{a, b, face}> pair slots, or null when construction stalls or the
 *   on-board multiset is not family-pairable (e.g. a lone twin sits banked, §5.2 rule 3 —
 *   caller leaves the board as-is and escalates to the §5.3 dialog).
 */
export function shuffleBoard(remTiles, seed) {
  const positions = remTiles.map((t) => ({ layer: t.layer, row: t.row, col: t.col }));
  const bag = remTiles.map((t) => t.face);
  for (let attempt = 1; attempt <= 10; attempt++) {
    const rng = mulberry32(seed + attempt); // fresh stream per attempt (§8.1 loop shape)
    const slots = construct(positions, rng);
    if (!slots) continue;
    const faces = facesForSlots(shuffled(bag, rng), positions.length / 2);
    if (!faces) return null; // odd family group → strictly better to leave the board (§5.2)
    return slots.map((s, i) => ({ a: s.a, b: s.b, face: faces[i] }));
  }
  return null;
}
