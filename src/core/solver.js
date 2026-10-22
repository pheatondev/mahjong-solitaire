/* solver.js — DFS backstop (§8.3). GENERATION-TIME ONLY: never runs during gameplay
   (locked §8.2 — hints are greedy scans, shuffles re-deal by construction). It executes
   once per level deal; a budget-exhausted check is 'unknown', never 'unsolvable' (locked). */

import { isFree } from './rules.js';

const NODE_CAP = 200_000; // ~50 ms on a mid phone; generous by design (§8.3)
const MS_CAP = 50;
const PAIRS_FANOUT = 24;  // tension-ordered candidate cap per node

const BUDGET = Symbol('budget');

/**
 * Backstop check: are the dealt faces solvable under the exact §3.1 rules?
 * @param {Array<{face:string,layer:number,row:number,col:number}>} tiles
 * @returns {{result:'solvable'|'unsolvable'|'unknown', nodes:number}}
 */
export function solverCheck(tiles) {
  let nodes = 0;
  const deadline = performance.now() + MS_CAP;
  const visited = new Set();

  function search(rem) {
    if (rem.length === 0) return true;
    if (++nodes > NODE_CAP || performance.now() > deadline) throw BUDGET;

    const free = rem.filter((t) => isFree(rem, t));

    // Candidate pairs: identical free faces (§3.1/§3.2 identical-only)
    const byFace = new Map();
    for (const t of free) {
      let g = byFace.get(t.face);
      if (!g) { g = []; byFace.set(t.face, g); }
      g.push(t);
    }
    const cands = [];
    for (const g of byFace.values()) {
      for (let i = 0; i < g.length; i++) {
        for (let j = i + 1; j < g.length; j++) cands.push([g[i], g[j]]);
      }
    }
    if (cands.length === 0) return false;

    // Heuristics first: pairs that most reduce "covering tension" (§8.3)
    const tension = (t) => {
      let n = 0;
      for (const o of rem) {
        if (o === t) continue;
        if (o.layer < t.layer && o.col === t.col && o.row === t.row) n++;
        else if (o.layer === t.layer && o.row === t.row && Math.abs(o.col - t.col) === 1) n++;
      }
      return n;
    };
    cands.sort((p, q) => (tension(q[0]) + tension(q[1])) - (tension(p[0]) + tension(p[1])));
    const fan = cands.slice(0, PAIRS_FANOUT);

    for (const [a, b] of fan) {
      const next = rem.filter((t) => t !== a && t !== b);
      const h = hash(next);
      if (visited.has(h)) continue;
      visited.add(h);
      if (search(next)) return true;
    }
    return false;
  }

  try {
    return { result: search(tiles) ? 'solvable' : 'unsolvable', nodes };
  } catch (e) {
    if (e === BUDGET) return { result: 'unknown', nodes }; // inconclusive ≠ unsolvable (locked)
    throw e;
  }
}

function hash(rem) {
  const d = rem.map((t) => posKey(t));
  d.sort();
  return d.join('|');
}
function posKey(t) {
  return t.layer + ',' + t.row + ',' + t.col + ',' + t.face;
}
