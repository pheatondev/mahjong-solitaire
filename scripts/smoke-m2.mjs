#!/usr/bin/env node
/* scripts/smoke-m2.mjs — M2 sweep (§20/§22 exit criteria). No DOM, no deps:
   1) all 60 levels × 3 Seeds deal; hidden counts match the authored value (§8.4 cap)
   2) §8.2/§8.3 solver backstop across seeds: never 'unsolvable' ('unknown' allowed)
   3) construction-order play wins on a band-spread sample (score within [1, P×325])
   4) §5.2 shuffleBoard: face multiset + positions preserved, hidden flags fixed;
      an odd family group fails constructive shuffle → best-effort fallback re-pairs
      it (§5.2 v0.3.1 ruling; the leave-as-is escalation survives only as a backstop)
   5) §5.3 isNoProgressState unit cases + §5.1 hintScan ladder kinds
   6) §5.4 snapshot ↔ stateFromSnapshot roundtrip parity, combo broken to ×0
   (DOM glue — peek order, flights, screens — is verified in-browser at the milestone). */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const load = (rel) => import(join('file://', here, '../', rel));
const { parseChapter } = await load('src/data/levels.js');
const { dealBoard, shuffleBoard, shuffleBoardBestEffort } = await load('src/core/dealer.js');
const {
  createGameState, bankTile, freeIds, snapshot, stateFromSnapshot,
} = await load('src/core/state.js');
const { solverCheck } = await load('src/core/solver.js');
const { posKey, unblockCount, isNoProgressState, hintScan } = await load('src/core/rules.js');

let failures = 0;
const expect = (cond, msg) => { if (!cond) { console.error('FAIL:', msg); failures++; } };
const faceCounts = (faces) => {
  const m = new Map();
  for (const f of faces) m.set(f, (m.get(f) ?? 0) + 1);
  return m;
};
const sigOf = (t) => `${posKey(t.layer, t.row, t.col)}:${t.face}${t.hidden ? ':H' : ''}`;

/* ---------- load all 5 chapters ---------- */
const chapters = [];
for (let i = 1; i <= 5; i++) {
  const json = JSON.parse(readFileSync(join(here, '../data', `levels-${i}.json`), 'utf8'));
  chapters.push(parseChapter(json, { chapterIndex: i }));
}
const levels = chapters.flatMap((c) => c.levels);
expect(levels.length === 60, `expected 60 levels, got ${levels.length}`);
console.log(`sweep: ${levels.length} levels · seeds 0–9 each · plus §5 unit checks\n`);

/* ---------- 1+2: deal sweep + solver backstop
   §22 policy: fixed-seed deal + 10 fresh-seed re-deals construct per level → seeds 0–9. */
for (const lvl of levels) {
  for (const seedStep of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]) {
    let deal;
    try { deal = dealBoard(lvl, seedStep); } catch (e) {
      expect(false, `L${lvl.id} seed ${seedStep}: deal threw — ${e.message}`);
      continue;
    }
    const hiddenN = deal.tiles.filter((t) => t.hidden).length;
    expect(hiddenN === (lvl.hidden ?? 0),
      `L${lvl.id} seed ${seedStep}: hidden ${hiddenN} ≠ authored ${lvl.hidden ?? 0} (§8.4)`);
    const sv = solverCheck(deal.tiles);
    expect(sv.result !== 'unsolvable',
      `L${lvl.id} seed ${seedStep}: solver says 'unsolvable' (§8.2 breach, nodes ${sv.nodes})`);
  }
}

/* ---------- 3: construction-order play, band-spread sample ---------- */
for (const [i, lvl] of levels.entries()) {
  if (i % 4 !== 0) continue; // every 4th level ≈ 15 levels across all bands
  const deal = dealBoard(lvl, 0);
  const st = createGameState(lvl, deal);
  let now = 0, pops = 0, aborted = null;
  for (const s of deal.slots.slice().reverse()) { // reverse peel = legal forward (§8.1)
    const a = st.positions.get(posKey(s.a.layer, s.a.row, s.a.col));
    const b = st.positions.get(posKey(s.b.layer, s.b.row, s.b.col));
    if (!a || !b) { aborted = 'construction order not legal'; break; }
    now += 900; const r1 = bankTile(st, a, now);
    now += 900; const r2 = bankTile(st, b, now);
    if (r1.popped || r2.sealed) { aborted = 'first-of-pair popped/sealed'; break; }
    if (r2.popped) pops++;
  }
  expect(!aborted, `L${lvl.id}: ${aborted}`);
  expect(st.phase === 'won' && st.positions.size === 0, `L${lvl.id}: construct-order play did not win`);
  const P = lvl.tileCount / 2;
  expect(pops === P, `L${lvl.id}: ${P} pairs expected, popped ${pops}`);
  expect(st.score > 0 && st.score <= P * 325, `L${lvl.id}: score ${st.score} out of bounds`);
}

/* ---------- 4: §5.2 shuffle semantics ---------- */
for (const id of [13, 30, 60]) { // samples from bands C, D, F
  const lvl = levels[id - 1];
  const deal = dealBoard(lvl, 0);
  const st = createGameState(lvl, deal);
  // play the LAST 5 construct pairs (pairs leave 2 tiles at a time)
  for (const s of deal.slots.slice(-5).reverse()) {
    bankTile(st, st.positions.get(posKey(s.a.layer, s.a.row, s.a.col)), 1000);
    bankTile(st, st.positions.get(posKey(s.b.layer, s.b.row, s.b.col)), 2000);
  }
  const rem = [...st.positions.values()];
  const beforeCounts = faceCounts(rem.map((t) => t.face));
  const hiddenBefore = new Set(rem.filter((t) => t.hidden).map(sigOf));
  const re = shuffleBoard(rem, lvl.id * 7919 + 3);
  expect(re, `L${id}: shuffleBoard unexpectedly failed (a pairable board must re-deal)`);
  if (re) {
    // apply like main.js does, then compare
    for (const { a, b, face } of re) {
      for (const p of [a, b]) {
        const t = st.positions.get(posKey(p.layer, p.row, p.col));
        if (t) t.face = face;
      }
    }
    const afterCounts = faceCounts([...st.positions.values()].map((t) => t.face));
    expect(afterCounts.size === beforeCounts.size
      && [...beforeCounts].every(([f, n]) => afterCounts.get(f) === n),
      `L${id}: shuffle face multiset changed (§5.2)`);
    expect(st.positions.size === rem.length, `L${id}: shuffle changed occupancy (§5.2)`);
    const hiddenAfter = new Set([...st.positions.values()].filter((t) => t.hidden).map(sigOf));
    expect(hiddenAfter.size === hiddenBefore.size,
      `L${id}: shuffle changed the hidden set (§8.4/§5.2)`);
  }
}
{
  // §5.2 v0.3.1: constructive shuffle keeps its odd → null semantics (main.js falls back)
  const odd = [];
  const faces6 = ['d1', 'd1', 'd2', 'd2', 'd2', 'd3'];
  faces6.forEach((face, i) => odd.push({ face, layer: 0, row: Math.floor(i / 2), col: i % 2 }));
  expect(shuffleBoard(odd, 777) === null, 'odd family group must fail constructive shuffle (§5.2 rule 1)');
  // §5.2 rule 2 best-effort: same odd multiset re-pairs — even part by construction,
  // stranded faces (one d2, one d3) on individual positions; multiset/positions preserved
  const reBe = shuffleBoardBestEffort(odd, 777);
  expect(reBe, 'odd family group must shuffle best-effort (§5.2 rule 2)');
  if (reBe) {
    expect(!reBe.stray, 'even-position board must have no stray (§5.2)');
    const key = (p) => `${p.layer}:${p.row}:${p.col}`;
    const oddKey = new Set(odd.map((t) => key(t)));
    expect(reBe.pairs.length === 3, 'best-effort keeps one slot per position pair');
    expect(reBe.pairs.every((s) => oddKey.has(key(s.a)) && oddKey.has(key(s.b))),
      'best-effort shuffle must stay on the remaining positions (§5.2)');
    const applied = new Map();
    for (const { a, b, faceA, faceB } of reBe.pairs) {
      applied.set(key(a), faceA);
      applied.set(key(b), faceB);
    }
    expect(odd.every((t) => applied.has(key(t))), 'every remaining position gets a face');
    const fc = faceCounts([...applied.values()]);
    expect(fc.get('d1') === 2 && fc.get('d2') === 3 && fc.get('d3') === 1,
      'best-effort shuffle must preserve the face multiset (§5.2)');
  }
  // §5.2 rule 2, odd-POSITION board (bank 1/3 tiles → board count odd): one stray
  const oddN = odd.slice(0, 5); // d1 d1 d2 d2 d2 (banked d3 strands its twin → d3 missing here)
  const reN = shuffleBoardBestEffort(oddN, 999);
  expect(reN, 'odd-position board must shuffle best-effort (§5.2 rule 2)');
  if (reN) {
    expect(reN.stray, 'odd-position board must leave exactly one stray');
    if (reN.stray) {
      const key = (p) => `${p.layer}:${p.row}:${p.col}`;
      const applied = new Map();
      for (const { a, b, faceA, faceB } of reN.pairs) {
        applied.set(key(a), faceA);
        applied.set(key(b), faceB);
      }
      applied.set(key(reN.stray.pos), reN.stray.face);
      const fc = faceCounts([...applied.values()]);
      expect(fc.get('d1') === 2 && fc.get('d2') === 3,
        'odd-position shuffle must preserve the face multiset (§5.2)');
      expect(applied.size === 5, 'every position (stray included) gets exactly one face');
    }
  }
}

/* ---------- 5: §5.3 trigger + §5.1 hint kinds (fabricated minimal states) ---------- */
const mkSt = (tiles, bank) => ({
  positions: new Map(tiles.map((t) => [posKey(t.layer, t.row, t.col), t])),
  bank,
});
const mkT = (id, face, layer, row, col, hidden = false) => ({ id, face, layer, row, col, hidden });

// non-trigger: banked d1 + its free face-up twin on board → actionable (case a)
let st5 = mkSt([mkT(1, 'd1', 0, 0, 0), mkT(2, 'd2', 0, 0, 1)],
  [mkT(9, 'd1'), null, null, null]);
let scan5 = hintScan(st5);
expect(!isNoProgressState(st5), 'trigger fired while a banked twin is free (§5.3 case a)');
expect(scan5.kind === 'pair', `hint should spot a banked-twin pair, got ${scan5.kind}`);

// non-trigger: a free face-down tile remains peekable (case b)
st5 = mkSt([mkT(1, 'd1', 0, 0, 0, true), mkT(2, 'd2', 0, 0, 1, true)],
  [mkT(9, 'd3'), mkT(10, 'd4'), null, null]);
expect(!isNoProgressState(st5), 'trigger fired while a free face-down tile remains (§5.3 case b)');
expect(hintScan(st5).kind === 'ghost', 'hint should ghost-flip when only face-down tiles are free');

// non-trigger: 3 banked but NOT distinct → the trigger demands 3 distinct; a duplicate
// bank means banking may still recover, so this is NOT the strict trigger
st5 = mkSt([mkT(1, 'd3', 0, 0, 0)],
  [mkT(9, 'd1'), mkT(10, 'd1'), mkT(11, 'd2'), null]);
expect(!isNoProgressState(st5), 'trigger fired on a pre-seal state with a duplicate bank');
expect(hintScan(st5).kind === 'gone', 'hint ladder should reach the terminal step here');

// strict trigger: no actionables, no face-down, bank = 3 distinct → dialog, not toast
st5 = mkSt([mkT(1, 'd3', 0, 0, 0)], // its only free face has no twin on board or bank
  [mkT(9, 'd5'), mkT(10, 'd6'), mkT(11, 'd7'), null]);
expect(isNoProgressState(st5), 'strict trigger missed: no actionables + 3 distinct bank (§5.3)');
expect(hintScan(st5).kind === 'gone', 'hint scan should be terminal on the strict trigger state');

// sanity: unblockCount still positive-weighting (its own M1 contract, reused by hint)
{
  const board = [
    mkT(1, 'd1', 0, 0, 0), mkT(2, 'd1', 0, 0, 1), mkT(3, 'd2', 0, 0, 2),
  ];
  expect(unblockCount(board, board[0]) === 1, 'unblockCount: removing the left tile frees 1');
}

/* ---------- 6: §5.4 snapshot roundtrip ---------- */
{
  const lvl = levels[12]; // L13: has hidden tiles
  const deal = dealBoard(lvl, 0);
  const st = createGameState(lvl, deal);
  for (const s of deal.slots.slice(-2).reverse()) { // small score + bank imbalance
    bankTile(st, st.positions.get(posKey(s.a.layer, s.a.row, s.a.col)), 1000);
    bankTile(st, st.positions.get(posKey(s.b.layer, s.b.row, s.b.col)), 2000);
  }
  const snap = snapshot(st);
  const st2 = stateFromSnapshot(snap, lvl.id, lvl.t2, lvl.t3);
  const setA = [...st.positions.values()].map(sigOf).sort();
  const setB = [...st2.positions.values()].map(sigOf).sort();
  expect(setA.join('|') === setB.join('|'), 'restore: board faces/hidden/coords not parity');
  expect(st2.bank.map((b) => b?.face ?? null).join() === st.bank.map((b) => b?.face ?? null).join(),
    'restore: bank arrangement not parity');
  expect(st2.score === st.score, 'restore: score not restored (§5.4)');
  expect(st2.comboN === 0 && st2.comboUntil === -Infinity, 'undo must break combo to ×0 (locked)');
  expect(st2.phase === 'playing' && freeIds(st2).size > 0, 'restore: state not playable');
  // walk-back + re-play: the restored state must accept a bank tap
  const t = [...st2.positions.values()].find((t) => freeIds(st2).has(t.id));
  const r = bankTile(st2, t, 0);
  expect(r && typeof r.slot === 'number', 'restored state rejects a legal bank tap');
}

console.log(failures === 0
  ? 'SMOKE-M2 OK — content + §5 boosters + §8.4 deal + §13-free core behaves per GDD'
  : `SMOKE-M2 FAILURES: ${failures}`);
process.exit(failures === 0 ? 0 : 1);
