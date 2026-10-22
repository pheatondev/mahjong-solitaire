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
    const free = remaining.filter((p) => isFree(remaining, p));
    if (free.length >= 2) {
      const p = weightedPick(free, remaining, rng); // soft heuristic: unblock the most
      removeOne(remaining, p);
      const free2 = remaining.filter((q) => isFree(remaining, q));
      const q = weightedPick(free2.length ? free2 : remaining, remaining, rng);
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
 * Deal one board for a level + reDealCounter (seed = levelId × 7919 + reDealCounter, §14.4).
 * Order per §8.1: positions → reverse-order construction → bag compose → shuffle →
 * per pair slot: next family with ≥ 2 copies remaining. Flipped-tile hidden positions
 * (§8.4) are dealt in M2 (M1 levels have hidden: 0).
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
  const counts = new Map();
  for (const f of bag) counts.set(f, (counts.get(f) ?? 0) + 1);

  const faces = [];
  let ptr = 0;
  for (let i = 0; i < slots.length; i++) {
    while (ptr < bag.length && counts.get(bag[ptr]) < 2) ptr++; // next family with ≥ 2 copies
    if (ptr >= bag.length) throw new Error('bag exhausted — deal bug');
    const f = bag[ptr];
    counts.set(f, counts.get(f) - 2); // both positions of the slot take the same face (§8.1 step 4)
    faces.push(f);
    ptr++;
  }

  const tiles = [];
  let id = 0;
  slots.forEach((s, i) => {
    tiles.push({ id: id++, face: faces[i], layer: s.a.layer, row: s.a.row, col: s.a.col });
    tiles.push({ id: id++, face: faces[i], layer: s.b.layer, row: s.b.row, col: s.b.col });
  });
  return { tiles, tileCount: tiles.length, pairCount: tiles.length / 2 };
}
