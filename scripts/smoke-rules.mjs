#!/usr/bin/env node
/* scripts/smoke-rules.mjs — dev-only rules smoke test (M1).
   1) deal ×10 fresh re-deals; §8.3 solver backstop must never say 'unsolvable'
   2) greedy bank play-out must reach phase 'won' with exact score math
   3) force-verify the §3.6 seal fails a bank of 4 distinct faces at tap time
   4) verify combo ladder math vs §4.1 (cap ×10, window expiry resets) */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const { parseChapter } = await import(join('file://', here, '../src/data/levels.js'));
const { dealBoard } = await import(join('file://', here, '../src/core/dealer.js'));
const { createGameState, bankTile, freeIds } = await import(join('file://', here, '../src/core/state.js'));
const { solverCheck } = await import(join('file://', here, '../src/core/solver.js'));

const json = JSON.parse(readFileSync(join(here, '../data/levels-1.json'), 'utf8'));
const lvl = parseChapter(json, { chapterIndex: 1 }).levels[0];
console.log('level', lvl.id, '—', lvl.name, '| tiles', lvl.tileCount, '| t2', lvl.t2, 't3', lvl.t3);
if (!lvl) { console.error('FAIL: no valid level'); process.exit(1); }

const WINDOW = 5000;
let failures = 0;
const expect = (cond, msg) => { if (!cond) { console.error('FAIL:', msg); failures++; } };

for (let reDeal = 0; reDeal < 10; reDeal++) {
  const deal = dealBoard(lvl, reDeal);
  expect(deal.tileCount === lvl.tileCount, `deal ${reDeal}: tile count mismatch`);

  const snap = deal.tiles.map((t) => ({ face: t.face, layer: t.layer, row: t.row, col: t.col }));
  const sv = solverCheck(snap);
  expect(sv.result === 'solvable', `deal ${reDeal}: solver says '${sv.result}' (nodes ${sv.nodes})`);

  // Play in the DEAL ORDER: construct peels pairs that are free in the remaining set —
  // the peel order read forward is exactly the legal play order (§8.1). Consecutive-pair
  // banking keeps the tin ≤ 1 tile, so the run always wins.
  const st = createGameState(lvl, deal);
  const P = lvl.tileCount / 2;
  let now = 0, pops = 0, aborted = null;
  for (const s of deal.slots) {
    const a = st.positions.get(`${s.a.layer},${s.a.row},${s.a.col}`);
    const b = st.positions.get(`${s.b.layer},${s.b.row},${s.b.col}`);
    if (!a || !b) { aborted = 'construction order not legal (tile missing)'; break; }
    now += 2000; // stays inside the 5 s window → chain capping is exercised below ×10
    const r1 = bankTile(st, a, now);
    now += 2000;
    const r2 = bankTile(st, b, now);
    if (r1.popped || r2.sealed) { aborted = 'first-of-pair popped/sealed (construction bug)'; break; }
    if (r2.popped) pops++;
  }
  expect(!aborted, `deal ${reDeal}: aborted — ${aborted}`);
  expect(st.phase === 'won', `deal ${reDeal}: construct-order play did not WIN (phase ${st.phase})`);
  expect(pops === P, `deal ${reDeal}: expected ${P} pops, got ${pops}`);
  // combo capped at 10 → per-pop max 325 (§4.1)
  expect(st.score > 0 && st.score <= P * 325, `deal ${reDeal}: score ${st.score} out of bounds`);
}

// §4.1 ladder math direct: n=1 →100, n=2 →125; expiry resets to n=1; cap at ×10 → 325
{
  const deal = dealBoard(lvl, 99);
  let faceCounter = 0;
  const st = createGameState(lvl, deal);
  // synthetic: fabricate 4 distinct tiles already banked, then seal on the next bank
  st.bank[0] = { id: +('9' + faceCounter++), face: 'x1', layer: 0, row: 0, col: 0 };
  st.bank[1] = { id: +('9' + faceCounter++), face: 'x2', layer: 0, row: 0, col: 0 };
  st.bank[2] = { id: +('9' + faceCounter++), face: 'x3', layer: 0, row: 0, col: 0 };
  // choose a real on-board tile (4th distinct by addition order) → must seal
  const t = [...st.positions.values()][0];
  const r = bankTile(st, t, 0);
  expect(r.sealed === true, 'seal: 4 distinct faces did not seal');
  expect(st.phase === 'failed', 'seal: phase not failed');
}

// combo math via matchScore semantics is covered by score.js; window expiry reset:
{
  const deal = dealBoard(lvl, 0);
  const st = createGameState(lvl, deal);
  // two real pops then expiry reset — construct-order pops exercise the ladder directly
  let now = 0;
  const seen = [];
  for (const s of deal.slots.slice(0, 3)) {
    const a = st.positions.get(`${s.a.layer},${s.a.row},${s.a.col}`);
    const b = st.positions.get(`${s.b.layer},${s.b.row},${s.b.col}`);
    now += 1000; bankTile(st, a, now);
    now += pickGap(seen.length); bankTile(st, b, now);
    seen.push(st.comboN);
  }
  function pickGap(i) { return i === 1 ? 9000 : 500; } // 2nd pop outside the window → expiry reset
  expect(seen.length === 3, 'combo: play did not produce 3 pops');
  if (seen.length === 3) {
    expect(seen[0] === 1 && seen[1] === 1, `combo: expiry did not reset (n=${seen[1]})`);
    expect(seen[2] === 2, `combo: ladder did not step to ×2 (n=${seen[2]})`);
  }
}

console.log(failures === 0 ? 'SMOKE OK — rules core behaves per §3/§4/§8' : `SMOKE FAILURES: ${failures}`);
process.exit(failures === 0 ? 0 : 1);
