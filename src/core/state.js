/* state.js — game state singleton (§14.1). M1: tiles + tin + score + phases.
   Snapshot/undo (§5.4) and shuffle hook into this module in M2. */

import { posKey, isFree, computeFreeIds } from './rules.js';
import { matchScore, projectedStars } from './score.js';

export const BANK_CAP = 4;
export const COMBO_WINDOW_MS = 5000; // invisible window, game-time (§4.1 locked)
export const COMBO_CAP = 10;         // score ladder cap (§4.1)

/** Build g state for a dealt level. deal.tiles carry {id, face, layer,row,col}. */
export function createGameState(level, deal) {
  const tiles = deal.tiles.map((t) => ({ ...t }));
  const positions = new Map();
  for (const t of tiles) positions.set(posKey(t.layer, t.row, t.col), t);
  return {
    levelId: level.id,
    t2: level.t2,
    t3: level.t3,
    tiles,          // all dealt tiles (valid objects = landed; banked = neither)
    positions,      // strictly on-board occupants (§3.1 free-check source)
    bank: [null, null, null, null],
    score: 0,
    comboN: 0,
    comboUntil: -Infinity,
    phase: 'playing',
  };
}

/** Free ids for view styling (§9.5). */
export function freeIds(st) {
  return computeFreeIds([...st.positions.values()]);
}

/**
 * The tap verb, at tap time (§3.3 tap-order ledger): locks the tile logically,
 * banks it into the first empty slot, auto-pops an arriving twin, and detects
 * the §3.6 seal + §3.4 win edges. Flights/landing pop presentation are view-side.
 *
 * @param {ReturnType<typeof createGameState>} st
 * @param {{id:number,face:string,layer:number,row:number,col:number}} tile
 * @param {number} now game-time ms (invisible combo window, §4.1)
 */
export function bankTile(st, tile, now) {
  st.positions.delete(posKey(tile.layer, tile.row, tile.col));
  const slot = st.bank.indexOf(null);
  if (slot === -1) throw new Error('bank full while playing — impossible state');
  st.bank[slot] = tile;

  const twinSlot = st.bank.findIndex((t, i) => t && t !== tile && t.face === tile.face);
  const res = { slot, popped: null, sealed: false };

  if (twinSlot !== -1) {
    // Identical twin already banked → both auto-pop (§3.3). One undo step later
    // reverses the whole pop (snapshot rule §5.4 — M2).
    st.bank[slot] = null;
    st.bank[twinSlot] = null;
    // combo window: continue inside it, else the chain restarts at ×1 (§4.1)
    st.comboN = now < st.comboUntil ? Math.min(st.comboN + 1, COMBO_CAP) : 1;
    st.comboUntil = now + COMBO_WINDOW_MS;
    st.score += matchScore(st.comboN);
    res.popped = twinSlot < slot ? [twinSlot, slot] : [slot, twinSlot];
  } else if (st.bank.every((t) => t)) {
    // 4 distinct faces, no pair → the tin has sealed (§3.6): terminal at tap time.
    res.sealed = true;
    st.phase = 'failed';
  }

  if (st.phase !== 'failed' && st.positions.size === 0 && st.bank.every((t) => t === null)) {
    st.phase = 'won'; // last pair auto-pops in the bank → star reveal (§3.4)
  }
  return res;
}

/** Live star tier for the HUD projection (§9.4). */
export function hudStars(st) {
  return projectedStars(st.score, st.t2, st.t3);
}
