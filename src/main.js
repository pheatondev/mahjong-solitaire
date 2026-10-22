/* main.js — boot + composition root: stage fit (§9.1), game clock (§4.1/§16),
   screen manager (§14.3 M2 slice: LEVELS ⇄ GAME), the tap ledger (§3.3/§3.5),
   boosters (§5.1–5.4), the §8.2 generation backstop, and §13 persistence wiring.
   Sudoku-free: all rule math lives in core/ — this file only orchestrates.
   Audio / pause panel / themes / install promo are M3–M4. */

import { clamp } from './util.js';
import {
  createGameState, bankTile, freeIds, hudStars, snapshot, stateFromSnapshot,
} from './core/state.js';
import { dealBoard, shuffleBoard } from './core/dealer.js';
import { posKey, isNoProgressState, hintScan } from './core/rules.js';
import { solverCheck } from './core/solver.js';
import { thresholds } from './core/score.js';
import { parseChapter } from './data/levels.js';
import { STR } from './data/i18n.js';
import {
  initStore, setBrokenToastHandler, getStore, markPlayed, recordPop, recordSeal, recordWin,
} from './data/store.js';
import { createBoardView, createBankView, computeFit } from './view/board-render.js';
import { createLevelSelect } from './view/level-select.js';

const $ = (s) => document.querySelector(s);
const els = {
  stage: $('#stage'), scrLevels: $('#scr-levels'), scrGame: $('#scr-game'),
  lvlScroll: $('#lvl-scroll'), lvlTitle: $('#lvl-title'),
  bank: $('#bank'), board: $('#board'), grid: $('#grid'),
  chip: $('#chip'), score: $('#score'), stars: $('#stars'), combo: $('#combo'),
  win: $('#ovl-win'), fail: $('#ovl-fail'), dlg: $('#dlg-nopro'), toast: $('#toast'),
};

/* ---------- module state ---------- */
let chapters = []; // parsed §7 files [{chapter, accent, levels}]
const ALL = new Map(); // levelId → { lvl, ch }
let level = null; // current level object
let chapterInfo = null;
let state = null;
let reDealCounter = 0;
let T = 48;
let inputLocked = true;
let currentScreen = 'levels';
let openPeekId = null; // §3.5: at most one open peek
let undoStack = []; // §5.4 ring of 20 snapshots
let dialogOpen = false;
let hintLast = 0;
let sealRecorded = false;
let wonRecorded = false;

let view, bank;
view = createBoardView(els.grid, els.board);
bank = createBankView(els.bank);
const levelSelect = createLevelSelect(els.lvlScroll, els.lvlTitle, (lvl) => startLevel(lvl, 0));

/* ---------- §9.1 locked stage fit ---------- */
function fitStage() {
  const vw = document.documentElement.clientWidth;
  const vh = document.documentElement.clientHeight;
  const scale = clamp(Math.min(vw / 390, vh / 844), 0.4, 2.0);
  document.documentElement.style.setProperty('--scale', scale);
}
new ResizeObserver(fitStage).observe(document.documentElement);
addEventListener('resize', fitStage);
visualViewport?.addEventListener('resize', fitStage);
fitStage();

/* ---------- game clock: game-time for the invisible combo window (§4.1) ----------
   rAF naturally stops when the tab is hidden (§16: clock freezes; no pause panel). */
let gameTime = 0;
let lastStamp = performance.now();
function tick(t) {
  gameTime += Math.min(t - lastStamp, 100);
  lastStamp = t;
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

/* ---------- score / HUD display (springy count-up, §4.1) ---------- */
let shownScore = 0;
function hudTick() {
  if (state && currentScreen === 'game' && shownScore !== state.score) {
    shownScore += (state.score - shownScore) * 0.2;
    if (Math.abs(shownScore - state.score) < 0.6) shownScore = state.score;
    els.score.textContent = String(Math.round(shownScore));
    renderStars();
  }
  requestAnimationFrame(hudTick);
}
requestAnimationFrame(hudTick);

function renderStars() {
  const n = hudStars(state);
  els.stars.innerHTML = [0, 1, 2].map((i) => `<span${i < n ? ' class="lit"' : ''}>★</span>`).join('');
}

function snapScore() { // undo/restore: display snaps, no spring
  shownScore = state.score;
  els.score.textContent = String(state.score);
  renderStars();
}

/* ---------- screen manager (§14.3) ---------- */
function showScreen(name) {
  currentScreen = name;
  els.scrLevels.classList.toggle('hidden', name !== 'levels');
  els.scrGame.classList.toggle('hidden', name !== 'game');
}

function goMap() {
  closeDialog();
  renderLevelSelect();
  showScreen('levels');
}

function renderLevelSelect() {
  levelSelect.render(
    chapters.map((c) => ({ chapter: c.chapter, accent: c.accent, levels: c.levels })),
    getStore(),
  );
}

/* ---------- toast (§13 storage-failure + §5.1 step 4) ---------- */
let toastTimer = null;
function showToast(msg) {
  els.toast.textContent = msg;
  els.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.remove('show'), 2400);
}

/* ---------- boot ---------- */
async function boot() {
  setBrokenToastHandler(() => showToast(STR.saveToast)); // §13 one-time toast — before initStore
  initStore();

  // static overlay/dialog copy (i18n)
  els.win.querySelector('h2').textContent = STR.winTitle;
  $('#btn-replay').textContent = STR.replay;
  $('#btn-next').textContent = STR.next(2);
  $('#btn-map2').textContent = STR.map;
  els.fail.querySelector('h2').textContent = STR.failTitle;
  $('#btn-fail-restart').textContent = STR.restart;
  $('#btn-fail-map').textContent = STR.map;
  $('#nopro-title').textContent = STR.noProgTitle;
  $('#nopro-body').textContent = STR.noProgBody;
  $('#btn-dlg-shuffle').textContent = STR.dlgShuffle;
  $('#btn-dlg-undo').textContent = STR.dlgUndo;
  $('#btn-dlg-restart').textContent = STR.dlgRestart;
  $('#btn-dlg-map').textContent = STR.dlgMap;

  // load all 5 chapters (relative paths — Pages subpath, §2.1)
  for (let i = 1; i <= 5; i++) {
    const json = await (await fetch(`data/levels-${i}.json`)).json();
    chapters.push(parseChapter(json, { chapterIndex: i })); // validates §7.1, skips bad levels
    const ch = chapters[i - 1];
    for (const lvl of ch.levels) ALL.set(lvl.id, { lvl, ch });
  }

  renderLevelSelect();
  showScreen('levels');
}
boot();

/* ---------- level start / fresh deal ---------- */
function startLevel(lvl, redo, tries = 0) {
  level = lvl;
  chapterInfo = ALL.get(lvl.id).ch;
  reDealCounter = redo;
  inputLocked = true;
  openPeekId = null;
  undoStack = [];
  sealRecorded = false;
  wonRecorded = false;
  dialogOpen = false;
  currentScreen = 'game';
  showScreen('game');
  view.cancelFlights();
  closeDialogUIOnly();

  document.documentElement.style.setProperty('--accent', chapterInfo.accent); // chapter palette (§6)

  const deal = dealBoard(lvl, redo); // §8.1 reverse-order construction, 10 stream retries
  const th = thresholds(deal.tileCount, lvl.t2, lvl.t3); // §4.2 formulas when null
  lvl.t2 = th.t2;
  lvl.t3 = th.t3;
  state = createGameState(lvl, deal);
  markPlayed(lvl.id); // §13 lastPlayed (display/history only)

  shownScore = 0;
  els.score.textContent = '0';
  renderStars();
  els.chip.textContent = STR.chip(chapterInfo.chapter, lvl.id);
  els.chip.classList.add('on');
  bank.clearAll();
  els.win.classList.remove('open');
  els.fail.classList.remove('open');
  els.combo.classList.remove('show');

  const cols = Math.max(...lvl.layers.map((r) => r[0].length));
  const rows = Math.max(...lvl.layers.map((r) => r.length));
  T = computeFit(els.board, cols, rows);
  view.render(state.tiles);
  view.fit(T, cols, rows);
  refreshBoard();

  // §14.2/§8.3: brief board shimmer while the §8.2 solver backstop resolves
  els.grid.classList.add('shimmer');
  setTimeout(() => {
    els.grid.classList.remove('shimmer');
    // §8.2: solver runs ONCE per deal, generation-time only; never during gameplay
    const snap = [...state.positions.values()].map((t) => ({ face: t.face, layer: t.layer, row: t.row, col: t.col }));
    const verdict = solverCheck(snap);
    if (verdict.result === 'unsolvable') {
      console.assert(false, `§8.2 backstop failure on level ${lvl.id} (re-deal ${redo}) — re-dealing`);
      if (tries < 10) return startLevel(lvl, redo + 1, tries + 1);
    }
    inputLocked = false;
  }, 280);
}

function refreshBoard() {
  view.refreshFree(freeIds(state), [...state.positions.values()]);
}

/* ---------- the tap verb (§3.3 + §3.5 peek cases): tap-order ledger ---------- */
function tileById(id) {
  return state.tiles.find((t) => t.id === id) ?? null;
}

els.board.addEventListener('pointerdown', (e) => {
  if (!state || inputLocked || state.phase !== 'playing') return;
  const el = e.target.closest?.('.tile');
  if (!el) return;
  const tile = tileById(+el.dataset.id);
  if (!tile) return;
  if (!state.positions.has(posKey(tile.layer, tile.row, tile.col))) return; // mid-flight tap

  if (!freeIds(state).has(tile.id)) {
    view.deny(el); // not free → jiggle + dim flash (§3.3); never a modal
    return;
  }

  // §3.5: only one open peek; every board action resolves it
  if (tile.hidden) {
    if (openPeekId === tile.id) {
      doBank(tile, el); // rule 3: tap the peeked tile → bank it
      return;
    }
    if (openPeekId != null) view.unpeek(tileById(openPeekId)); // rule 4: swap-peek
    openPeekId = tile.id;
    view.peek(tile); // rule 2: holds open until the next board action (no timer)
    return;
  }
  if (openPeekId != null) { // rule 5: face-up tap → the peek flips back, then bank
    view.unpeek(tileById(openPeekId));
    openPeekId = null;
  }
  doBank(tile, el);
});

/* ---------- bank a tile: logic at tap time, flight is cosmetic (§3.3/§14.2) ---------- */
function doBank(tile, el) {
  undoPush(); // §5.4: exactly one snapshot per bank tap
  const res = bankTile(state, tile, gameTime);
  openPeekId = null; // the peeked tile (if any) just left the board; peek is resolved

  if (res.popped) {
    // §4.3 combo badge
    els.combo.textContent = state.comboN >= 2 ? `Combo ×${state.comboN}!` : '';
    if (state.comboN >= 2) {
      els.combo.classList.remove('show');
      void els.combo.offsetWidth;
      els.combo.classList.add('show');
    }
    recordPop(state.comboN); // stats: matches = pop events (§13)
  }

  el.classList.remove('peeked'); // peeked tiles fly face-up (flip plays during flight, §3.5)
  bank.bank(res.slot, tile.face);
  bank.warnStale(state.bank.map((b) => b?.face));
  refreshBoard();

  view.flyToBank(el, tile, T, bank.slotEls[res.slot], () => onLanded(res, tile));
  checkNoProgress(); // §5.3 strict trigger, at logical tap time
}

/** Flight touchdown: landing reveals, auto-pop presentation, fail/win overlays. */
function onLanded(res) {
  if (res.popped) {
    bank.popSlots(res.popped[0], res.popped[1]);
  } else {
    bank.land(res.slot);
  }
  bank.warnStale(state.bank.map((b) => b?.face));

  if (state.phase === 'failed') {
    if (!sealRecorded) { sealRecorded = true; recordSeal(); } // §13 stats
    // the 4th tile visibly lands before the fail overlay plays (§3.6 locked)
    setTimeout(() => els.fail.classList.add('open'), 120);
  } else if (state.phase === 'won') {
    setTimeout(openWin, 280); // last pair pops first, then ★ reveal (§3.4)
  }
}

/* ---------- overlays (§3.6 fail / §4.2 win) ---------- */
function openWin() {
  if (!wonRecorded) {
    wonRecorded = true;
    recordWin(level.id, hudStars(state), state.score); // §6/§13: unlock N+1, best tier
  }
  const n = hudStars(state);
  const glyphEls = els.win.querySelectorAll('#win-stars .st');
  glyphEls.forEach((g, i) => {
    g.classList.toggle('lit', i < n);
    g.classList.remove('star-in');
    if (i < n) {
      g.style.animationDelay = `${i * 250}ms`;
      void g.offsetWidth;
      g.classList.add('star-in');
    }
  });
  const btnNext = $('#btn-next');
  btnNext.style.display = level.id >= 60 ? 'none' : '';
  btnNext.textContent = STR.next(Math.min(60, level.id + 1));
  // score count-up on reveal
  const target = state.score;
  const start = performance.now();
  (function count() {
    const p = Math.min((performance.now() - start) / 800, 1);
    els.win.querySelector('#win-score').textContent = String(Math.round(target * p));
    if (p < 1) requestAnimationFrame(count);
  })();
  els.win.classList.add('open');
}

/* ---------- §5.4 Undo ---------- */
function undoPush() {
  undoStack.push(snapshot(state));
  if (undoStack.length > 20) undoStack.shift(); // §5.4 ring buffer of 20
}

function doUndo() {
  if (!state || state.phase !== 'playing' || !undoStack.length) return;
  const snap = undoStack.pop();
  view.cancelFlights(); // in-air flights are cosmetic; their onLanded must not fire (§14.2)
  if (openPeekId != null) {
    view.unpeek(tileById(openPeekId));
    openPeekId = null;
  }
  state = stateFromSnapshot(snap, level.id, level.t2, level.t3); // combo breaks to ×0 (locked §5.4)
  snapScore();
  bank.syncBank(state.bank.map((b) => b?.face));
  const cols = Math.max(...level.layers.map((r) => r[0].length));
  const rows = Math.max(...level.layers.map((r) => r.length));
  view.render(state.tiles);
  view.fit(T, cols, rows);
  refreshBoard();
  els.combo.classList.remove('show');
  checkNoProgress();
}

/* ---------- §5.2 Shuffle ---------- */
function doShuffle() {
  if (!state || state.phase !== 'playing' || inputLocked) return;
  if (openPeekId != null) { // board action resolves the open peek (§3.5 rule 6)
    view.unpeek(tileById(openPeekId));
    openPeekId = null;
  }
  const rem = [...state.positions.values()];
  // re-pair the on-board face multiset by construction; seed = id×7919+counter (§14.4)
  const re = shuffleBoard(rem, state.levelId * 7919 + reDealCounter);
  if (!re) {
    // §5.2 failure (rare: an odd family group sits banked): board left as-is,
    // the §5.3 dialog opens with Shuffle disabled — locked escalation
    openNoProgressDialog(true);
    return;
  }
  undoPush(); // a successful shuffle is one undoable step (§5.4)
  reDealCounter += 1; // §14.4: the counter bumps on Shuffle
  for (const { a, b, face } of re) {
    for (const p of [a, b]) {
      const t = state.positions.get(posKey(p.layer, p.row, p.col));
      if (t) t.face = face; // positions + hidden flags never change (§5.2/§8.4)
    }
  }
  const cols = Math.max(...level.layers.map((r) => r[0].length));
  const rows = Math.max(...level.layers.map((r) => r.length));
  view.render(state.tiles);
  view.fit(T, cols, rows);
  refreshBoard();
  els.grid.classList.add('shimmer');
  setTimeout(() => els.grid.classList.remove('shimmer'), 260);
  checkNoProgress();
}

/* ---------- §5.1 Hint (greedy scan — the solver never runs in gameplay, locked) ---------- */
function pulseTarget(t) {
  const slot = state.bank.indexOf(t); // banked twin → pulse its tin slot mini
  if (slot !== -1) {
    view.pulse(bank.slotEls[slot].querySelector('.mini'));
    return;
  }
  view.pulse(view.tileEl(t.id));
}

function doHint() {
  if (!state || state.phase !== 'playing' || inputLocked) return;
  const now = performance.now();
  if (now - hintLast < 1500) return; // §5.1 gentle re-trigger guard
  hintLast = now;

  const scan = hintScan(state);
  if (scan.kind === 'pair') {
    pulseTarget(scan.a);
    pulseTarget(scan.b);
  } else if (scan.kind === 'ghost') {
    if (openPeekId === scan.a.id) {
      pulseTarget(scan.a); // hint never closes a peek (locked §5.1)
    } else {
      view.ghostFlip(scan.a, () => openPeekId === scan.a.id);
    }
  } else if (isNoProgressState(state)) {
    openNoProgressDialog(false); // ladder step 3
  } else {
    showToast(STR.noPairsToast); // ladder step 4
  }
}

/* ---------- §5.3 no-progress dialog (strict pre-seal only; modal, no dismiss) ---------- */
function checkNoProgress() {
  if (!state || state.phase !== 'playing' || dialogOpen) return;
  if (!isNoProgressState(state)) return;
  openNoProgressDialog(false);
}

function openNoProgressDialog(shuffleDisabled) {
  dialogOpen = true;
  if (openPeekId != null) { // any open peek flips back as the scrim opens (§5.3)
    view.unpeek(tileById(openPeekId));
    openPeekId = null;
  }
  $('#btn-dlg-shuffle').disabled = !!shuffleDisabled;
  $('#btn-dlg-undo').disabled = !undoStack.length;
  els.dlg.classList.add('open');
  inputLocked = true;
}

function closeDialogUIOnly() {
  els.dlg.classList.remove('open');
  dialogOpen = false;
}

function closeDialog() {
  closeDialogUIOnly();
  inputLocked = state?.phase !== 'playing'; // resume input iff a level is live
}

/* ---------- free & unlimited restart (§3.6) + navigation wiring ---------- */
function restart(freshCounter) {
  startLevel(level, freshCounter + 1); // reDealCounter increments → fresh deal (§14.4)
}

$('#btn-restart').addEventListener('click', () => restart(reDealCounter));
$('#btn-fail-restart').addEventListener('click', () => restart(reDealCounter));
$('#btn-replay').addEventListener('click', () => startLevel(level, 0));
$('#btn-next').addEventListener('click', () => {
  if (level.id < 60) startLevel(ALL.get(level.id + 1).lvl, 0);
});
$('#btn-map').addEventListener('click', goMap);
$('#btn-map2').addEventListener('click', goMap);
$('#btn-fail-map').addEventListener('click', goMap);
$('#btn-dlg-map').addEventListener('click', goMap);
$('#btn-dlg-restart').addEventListener('click', () => { closeDialog(); restart(reDealCounter); });
$('#btn-dlg-undo').addEventListener('click', () => { closeDialog(); doUndo(); });
$('#btn-dlg-shuffle').addEventListener('click', () => { closeDialog(); doShuffle(); });

$('#btn-undo').addEventListener('click', doUndo);
$('#btn-shuffle').addEventListener('click', doShuffle);
$('#btn-hint').addEventListener('click', doHint);

/* ---------- dev-only probes for scripted verification (removed in M4). No
   gameplay influence — only console-invoked. ---------- */
window.__m1 = () => ({
  phase: state?.phase ?? null,
  score: state?.score ?? 0,
  bank: state?.bank.map((b) => b?.face ?? null) ?? [],
  onBoard: state?.positions.size ?? 0,
  comboN: state?.comboN ?? 0,
  inputLocked,
});
window.__m2 = () => ({
  ...window.__m1(),
  screen: currentScreen,
  peek: openPeekId,
  undoDepth: undoStack.length,
  dialogOpen,
  reDealCounter,
});
window.__m2dev = { openDialog: () => openNoProgressDialog(false), closeDialog };
