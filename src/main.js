/* main.js — boot, stage fit (§9.1), game clock (§4.1/§16), screen flow (§14.3 M1 slice:
   BOOT → GAME), and the tap→bank→auto-pop loop (§3.3). M1: single test level, no
   persistence (§13 arrives in M2), no pause panel, no boosters (M2), no audio (M3). */

import { clamp } from './util.js';
import { createGameState, bankTile, freeIds, hudStars } from './core/state.js';
import { dealBoard } from './core/dealer.js';
import { solverCheck } from './core/solver.js';
import { thresholds } from './core/score.js';
import { parseChapter } from './data/levels.js';
import { STR } from './data/i18n.js';
import { createBoardView, createBankView, computeFit } from './view/board-render.js';

const $ = (s) => document.querySelector(s);
const els = {
  stage: $('#stage'), bank: $('#bank'), board: $('#board'), grid: $('#grid'),
  fx: $('#fx'), chip: $('#chip'), score: $('#score'), stars: $('#stars'), combo: $('#combo'),
  win: $('#ovl-win'), fail: $('#ovl-fail'),
};

let state = null;
let level = null;
let chapterName = '';
let reDealCounter = 0;
let T = 48;
let inputLocked = true;

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
   rAF naturally stops when the tab is hidden (§16: clock freezes; no pause panel).
   Deltas clamp to guard against the huge first frame after returning to the tab. */
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
  if (state && shownScore !== state.score) {
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

/* ---------- boot (§14.3: BOOT → GAME for M1; Home/Levels arrive in M2/M3) ---------- */
async function boot() {
  els.win.querySelector('h2').textContent = STR.winTitle;
  $('#btn-replay').textContent = STR.replay;
  $('#btn-restart2').textContent = STR.restart;
  els.fail.querySelector('h2').textContent = STR.failTitle;
  $('#btn-fail-restart').textContent = STR.restart;
  $('#btn-restart').textContent = STR.restart;

  const json = await (await fetch('data/levels-1.json')).json(); // relative path (§2.1)
  const chapter = parseChapter(json); // validates §7.1; warns + skips bad levels
  chapterName = chapter.chapter;
  document.documentElement.style.setProperty('--accent', chapter.accent); // chapter palette (§6)
  level = chapter.levels[0];
  if (!level) throw new Error('no valid level in chapter file');
  startLevel(level, 0);
}
boot();

/* ---------- level start / fresh deal ---------- */
function startLevel(lvl, redo, tries = 0) {
  reDealCounter = redo;
  inputLocked = true;

  const deal = dealBoard(lvl, redo); // §8.1 reverse-order construction, 10 stream retries
  const th = thresholds(deal.tileCount, lvl.t2, lvl.t3); // §4.2 formulas when null
  lvl.t2 = th.t2;
  lvl.t3 = th.t3;
  state = createGameState(lvl, deal);
  shownScore = 0;
  els.score.textContent = '0';
  renderStars();

  els.chip.textContent = STR.chip(chapterName, lvl.id);
  els.chip.classList.add('on');
  els.bank.querySelectorAll('.mini').forEach((m) => m.remove());
  els.bank.querySelectorAll('.slot').forEach((s) => s.classList.remove('warn'));
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
  const onBoard = [...state.positions.values()];
  view.refreshFree(freeIds(state), onBoard);
}

let view, bank;
view = createBoardView(els.grid, els.board);
bank = createBankView(els.bank);

/* ---------- the tap verb (§3.3): single pointerdown, tap-order ledger ---------- */
els.board.addEventListener('pointerdown', (e) => {
  if (!state || inputLocked || state.phase !== 'playing') return;
  const tileEl = e.target.closest?.('.tile');
  if (!tileEl) return;
  const tile = state.tiles.find((t) => t.id === +tileEl.dataset.id);
  if (!tile) return;
  if (!state.positions.has(`${tile.layer},${tile.row},${tile.col}`)) return; // mid-flight tap

  const isFreeTile = freeIds(state).has(tile.id);
  if (!isFreeTile) {
    view.deny(tileEl); // not free → jiggle + dim flash (§3.3); never a modal
    return;
  }

  // Logic applies at tap time (locked tap-order ledger); the flight is cosmetic (§14.2).
  const res = bankTile(state, tile, gameTime);

  // combo badge (§4.3 minimal: badge text only; full juice lands in M3)
  if (res.popped) {
    els.combo.textContent = state.comboN >= 2 ? `Combo ×${state.comboN}!` : '';
    if (state.comboN >= 2) {
      els.combo.classList.remove('show');
      void els.combo.offsetWidth;
      els.combo.classList.add('show');
    }
  }

  bank.bank(res.slot, tile.face);
  bank.warnStale(state.bank.map((t) => t?.face));
  refreshBoard();

  view.flyToBank(tileEl, tile, T, bank.slotEls[res.slot], () => onLanded(res, tile));
});

/** Flight touchdown: landing reveals, auto-pop presentation (whose landing resolves
    second = the completing flight), then the §3.6 fail / §3.4 win overlays. */
function onLanded(res, tile) {
  if (res.popped) {
    bank.popSlots(res.popped[0], res.popped[1]);
  } else {
    bank.land(res.slot);
  }
  bank.warnStale(state.bank.map((t) => t?.face));

  if (state.phase === 'failed') {
    // the 4th tile visibly lands before the fail overlay plays (§3.6 locked)
    setTimeout(() => openFail(), 120);
  } else if (state.phase === 'won') {
    setTimeout(openWin, 280); // last pair pops first, then ★ reveal (§3.4)
  }
}

/* ---------- overlays (§3.6 fail / §4.2 win) ---------- */
function openFail() {
  els.fail.classList.add('open');
}
function openWin() {
  const n = hudStars(state); // final score → tier (§4.2)
  const glyphEls = els.win.querySelectorAll('#win-stars .st');
  glyphEls.forEach((g, i) => {
    g.classList.toggle('lit', i < n);
    g.classList.remove('star-in');
    if (i < n) {
      g.style.animationDelay = `${i * 250}ms`; // staggered fill (§9.4)
      void g.offsetWidth;
      g.classList.add('star-in');
    }
  });
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

/* ---------- free & unlimited restart (§3.6): fresh deal, costs nothing ---------- */
function restart(freshCounter) {
  startLevel(level, freshCounter + 1); // reDealCounter increments → fresh deal (§3.6/§14.4)
}
$('#btn-restart').addEventListener('click', () => restart(reDealCounter));
$('#btn-fail-restart').addEventListener('click', () => restart(reDealCounter));
$('#btn-replay').addEventListener('click', () => restart(reDealCounter));

/* dev-only probe for scripted verification (M1): no gameplay influence. */
window.__m1 = () => ({
  phase: state.phase,
  score: state.score,
  bank: state.bank.map((t) => t?.face ?? null),
  onBoard: state.positions.size,
  comboN: state.comboN,
  inputLocked,
});
