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
