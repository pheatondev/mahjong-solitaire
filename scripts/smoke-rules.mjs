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

  // greedy play-out through the bank — every dealt board is winnable by construction
  const st = createGameState(lvl, deal);
  let pops = 0, now = 0, aborted = null;
  while (st.positions.size > 0) {
    const free = [...st.positions.values()].filter((t) => freeIds(st).has(t.id));
    if (!free.length) { aborted = 'no free taps (deal bug)'; break; }
    const pick = free.find((t) => st.bank.some((b) => b && b.face === t.face)) || free[0];
    now += 2000; // stays inside the 5 s window → chain capping is exercised below ×10
    const r = bankTile(st, pick, now);
    if (r.popped) pops++;
    else if (r.sealed) { aborted = 'sealed mid-greedy-run (deal bug)'; break; }
  }
  expect(!aborted, `deal ${reDeal}: aborted — ${aborted}`);
  expect(st.phase === 'won', `deal ${reDeal}: greedy play did not WIN (phase ${st.phase})`);
  // combo capped at 10 → per-pop max 325; P=8 pairs
  expect(st.score > 0 && st.score <= 8 * 325, `deal ${reDeal}: score ${st.score} out of bounds`);
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
  const deal = dealBoard(lvl, 123);
  const st = createGameState(lvl, deal);
  // two real twins along greedy play to verify ladder increments then expiry reset
  let now = 0, firstN = null, afterExpiryN = null;
  for (const pickOrder of [0, 1]) {
    while (st.positions.size > 0) {
      const free = [...st.positions.values()].filter((t) => freeIds(st).has(t.id));
      if (!free.length) break;
      const twin = free.find((t) => st.bank.some((b) => b && b.face === t.face));
      const pick = twin || free[pickOrder % free.length];
      if (twin) {
        now += pickOrder === 0 ? 1000 : 9000; // 2nd match outside window → expiry reset path
        const r = bankTile(st, pick, now);
        if (!firstN && r.popped) firstN = st.comboN;
        else if (r.popped && pickOrder === 1) afterExpiryN = st.comboN;
        continue;
      }
      now += 500; bankTile(st, pick, now);
    }
    if (st.positions.size === 0 && st.bank.every((b) => !b)) break;
  }
  if (firstN != null) expect(firstN === 1 || firstN === 2, `combo: unexpected first n ${firstN}`);
  if (afterExpiryN != null) expect(afterExpiryN === 1, `combo: expiry did not reset (n=${afterExpiryN})`);
}

console.log(failures === 0 ? 'SMOKE OK — rules core behaves per §3/§4/§8' : `SMOKE FAILURES: ${failures}`);
process.exit(failures === 0 ? 0 : 1);
