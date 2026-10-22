/* rules.js — the ONE free-check predicate (§3.1) and board/blocking analysis.
   The dealer, solver and hint must reuse these functions — never a second,
   cleverer rule (§8.1 note, locked reference shape). */

/** Cell key "layer,row,col" (integer grid coords, §3.1). */
export const posKey = (layer, row, col) => layer + ',' + row + ',' + col;

/** A tile is FREE iff not covered AND not double-side-blocked (§3.1, exact). */
export function isFree(tiles, tile) {
  if (covered(tiles, tile)) return false;
  const leftBlocked = occupied(tiles, tile.layer, tile.row, tile.col - 1);
  const rightBlocked = occupied(tiles, tile.layer, tile.row, tile.col + 1);
  return !leftBlocked || !rightBlocked;
}

/** Free check (JS transliteration of the §3.1 pseudocode for readability): */
function covered(tiles, tile) {
  return tiles.some((t2) => t2 !== tile && t2.layer > tile.layer && t2.col === tile.col && t2.row === tile.row);
}
function occupied(tiles, layer, row, col) {
  return tiles.some((t2) => t2.layer === layer && t2.row === row && t2.col === col);
}

/** Set of tile ids currently free (for view styling, §9.5). */
export function computeFreeIds(tiles) {
  const ids = new Set();
  for (const t of tiles) if (isFree(tiles, t)) ids.add(t.id);
  return ids;
}

/** How many currently-blocked tiles would become free if `tile` were removed
    (the dealer's "picks that unblock the most" soft weighting, §8.1). */
export function unblockCount(tiles, tile) {
  const nowFree = new Set(tiles.filter((t) => t !== tile && isFree(tiles, t)).map(tileKey));
  const rest = tiles.filter((t) => t !== tile);
  let freed = 0;
  for (const t of rest) {
    if (nowFree.has(tileKey(t))) continue;
    if (isFree(rest, t)) freed++;
  }
  return freed;
}

const tileKey = (t) => posKey(t.layer, t.row, t.col) + ':' + t.id + ':' + t.face;

/**
 * §5.3 no-progress trigger (locked — strict pre-seal only). True iff EVERY course of
 * play is futile: (a) no two identical actionables — no free face-up board pair, and no
 * free face-up twin for any banked tile; (b) no free face-down tile remains to peek;
 * (c) the bank already holds 3 distinct faces (any further bank tap seals, §3.6).
 * Pure scan over the game state; reused by the tap loop and the hint ladder.
 */
export function isNoProgressState(st) {
  const onBoard = [...st.positions.values()];
  const counts = new Map(); // free face-up board faces
  let freeDown = 0;
  for (const t of onBoard) {
    if (!isFree(onBoard, t)) continue;
    if (t.hidden) { freeDown++; continue; }
    counts.set(t.face, (counts.get(t.face) ?? 0) + 1);
  }
  const bankFaces = st.bank.filter(Boolean).map((b) => b.face);
  let actionable = [...counts.values()].some((n) => n >= 2);
  if (!actionable) actionable = bankFaces.some((f) => counts.has(f));
  const distinct = new Set(bankFaces).size;
  return !actionable && freeDown === 0 && bankFaces.length === 3 && distinct === 3;
}

/**
 * §5.1 greedy hint scan (locked — no runtime solver). Collects all VISIBLE twin pairs:
 * free face-up board pairs, or a banked slot + its free face-up board twin; prefers the
 * pair whose removal unblocks the most tiles (sum), ties break by scan order.
 * @returns {{kind:'pair', a, b}|{kind:'ghost', a}|{kind:'gone'}}
 *   'gone' = nothing actionable and no free face-down tile — the caller runs the
 *   §5.3 check first (dialog) and otherwise raises the soft toast (ladder step 4).
 */
export function hintScan(st) {
  const onBoard = [...st.positions.values()];
  const freeUp = [], freeDown = [];
  for (const t of onBoard) {
    if (!isFree(onBoard, t)) continue;
    (t.hidden ? freeDown : freeUp).push(t);
  }
  const groups = new Map();
  for (const t of freeUp) {
    const g = groups.get(t.face);
    if (g) g.push(t); else groups.set(t.face, [t]);
  }
  let best = null, bestW = -1;
  const consider = (w, a, b) => { if (w > bestW) { bestW = w; best = { kind: 'pair', a, b }; } };
  for (const g of groups.values()) {
    for (let i = 0; i < g.length; i++) {
      for (let j = i + 1; j < g.length; j++) {
        consider(unblockCount(onBoard, g[i]) + unblockCount(onBoard, g[j]), g[i], g[j]);
      }
    }
    const banked = st.bank.find((b) => b && b.face === g[0].face);
    if (banked) consider(unblockCount(onBoard, g[0]) + 2, banked, g[0]);
  }
  if (best) return best;
  if (freeDown.length) return { kind: 'ghost', a: freeDown[0] };
  return { kind: 'gone' };
}
