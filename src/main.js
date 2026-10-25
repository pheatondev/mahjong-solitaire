/* main.js — boot + composition root: stage fit (§9.1), game clock (§4.1/§16),
   screen manager (§14.3 M3: HOME · LEVELS · GAME · STATS · SETTINGS), the tap
   ledger (§3.3/§3.5), boosters (§5.1–5.4), the §8.2 generation backstop, and
   §13 persistence wiring. All rule math lives in core/ — this file only
   orchestrates; audio/confetti are side effects, never logic. */

import { clamp } from './util.js';
import {
  createGameState, bankTile, freeIds, hudStars, snapshot, stateFromSnapshot,
} from './core/state.js';
import { dealBoard, shuffleBoard, shuffleBoardBestEffort } from './core/dealer.js';
import { posKey, isNoProgressState, hintScan } from './core/rules.js';
import { solverCheck } from './core/solver.js';
import { thresholds } from './core/score.js';
import { parseChapter } from './data/levels.js';
import { faceFile } from './data/assets.js';
import { STR } from './data/i18n.js';
import { trapFocus } from './view/widgets.js';
import {
  initStore, setBrokenToastHandler, getStore, markPlayed, recordPop, recordSeal, recordWin,
  setSetting, setProgressFlag, totalStars, resetProgress,
} from './data/store.js';
import { createBoardView, createBankView, computeFit } from './view/board-render.js';
import { createLevelSelect } from './view/level-select.js';
import { createAudio } from './view/audio.js';
import { createFx } from './view/fx.js';
import { createHomeScr } from './view/screens/home.js';
import { createStatsScr } from './view/screens/stats.js';
import { createSettingsScr } from './view/screens/settings.js';

const $ = (s) => document.querySelector(s);
const els = {
  safe: $('#safe'), stage: $('#stage'), scrLevels: $('#scr-levels'), scrGame: $('#scr-game'),
  scrHome: $('#scr-home'), scrStats: $('#scr-stats'), scrSettings: $('#scr-settings'),
  fx: $('#fx'), splash: $('#splash'),
  lvlScroll: $('#lvl-scroll'), lvlTitle: $('#lvl-title'),
  bank: $('#bank'), board: $('#board'), grid: $('#grid'),
  chip: $('#chip'), score: $('#score'), stars: $('#stars'), combo: $('#combo'),
  win: $('#ovl-win'), fail: $('#ovl-fail'), dlg: $('#dlg-nopro'), toast: $('#toast'),
  dlgPause: $('#dlg-pause'), dlgReset: $('#dlg-reset'),
  tip: $('#tip'), winBest: $('#win-best'), failBody: $('#fail-body'), failTiles: $('#fail-tiles'),
};

/* ---------- module state ---------- */
let chapters = []; // parsed §7 files [{chapter, accent, levels}]
const ALL = new Map(); // levelId → { lvl, ch }
let level = null; // current level object
let chapterInfo = null;
let state = null;
let reDealCounter = 0;
let FIT = { w: 34, h: 48 }; // uniform portrait tile dims (design px), set per deal
let inputLocked = true;
let currentScreen = 'levels';
let openPeekId = null; // §3.5: at most one open peek
let undoStack = []; // §5.4 ring of 20 snapshots
let dialogOpen = false;
let hintLast = 0;
let sealRecorded = false;
let wonRecorded = false;

/* ---------- M3: audio (§12), confetti (§16/§17), pause, screens ---------- */
let paused = false; // §9.4 pause panel: player-initiated only
let settingsReturn = 'home'; // settings can be reached from Home or the pause panel
let resetArmed = false; // §13 double-confirm
let homeScr = null;
let statsScr = null;
let settingsScr = null;

let view, bank;
view = createBoardView(els.grid, els.board);
bank = createBankView(els.bank);
const levelSelect = createLevelSelect(els.lvlScroll, els.lvlTitle, (lvl) => startLevel(lvl, 0));
const audio = createAudio(() => getStore()?.settings?.sfx ?? true);
const fxr = createFx(els.fx, () => getStore()?.settings?.reduceMotion ?? false);

// §12: the AudioContext unlocks on the very first user gesture, whatever it hits
document.addEventListener('pointerdown', () => audio.unlock(), { once: true, capture: true });

/* ---------- §9.1 locked stage fit (v0.3.2: fits the SAFE AREA, not the raw
   viewport — env(safe-area-inset-*) insets live in CSS on #safe; stage centers
   inside it so top UI always clears the notch, and the scale shrinks slightly
   on notched devices to keep every design px inside the safe zone). ---------- */
function fitStage() {
  const vw = els.safe?.clientWidth || document.documentElement.clientWidth;
  const vh = els.safe?.clientHeight || document.documentElement.clientHeight;
  const scale = clamp(Math.min(vw / 390, vh / 844), 0.4, 2.0);
  document.documentElement.style.setProperty('--scale', scale);
}
fitStage();
new ResizeObserver(fitStage).observe(els.safe || document.documentElement);
new ResizeObserver(fitStage).observe(document.documentElement);
addEventListener('resize', fitStage);
visualViewport?.addEventListener('resize', fitStage);

/* ---------- game clock: game-time for the invisible combo window (§4.1) ----------
   rAF naturally stops when the tab is hidden (§16: clock freezes; no pause UI).
   The pause panel (§9.4) freezes game-time the same way — visuals keep breathing. */
let gameTime = 0;
let lastStamp = performance.now();
function tick(t) {
  if (!paused) gameTime += Math.min(t - lastStamp, 100);
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

/* ---------- screen manager (§14.3 M3: five screens) ---------- */
function showScreen(name) {
  currentScreen = name;
  els.scrLevels.classList.toggle('hidden', name !== 'levels');
  els.scrGame.classList.toggle('hidden', name !== 'game');
  els.scrHome.classList.toggle('hidden', name !== 'home');
  els.scrStats.classList.toggle('hidden', name !== 'stats');
  els.scrSettings.classList.toggle('hidden', name !== 'settings');
}

function goHome() {
  closePause({ silent: true });
  closeDialogUIOnly();
  showScreen('home');
  homeScr?.show();
  audio.jingle(); // no-op until audio is unlocked (§12)
}

function goStats() {
  statsScr.refresh();
  showScreen('stats');
}

/** Settings is reachable from Home (return 'home') or a paused game ('pause'). */
function goSettings(returnTo = 'home') {
  settingsReturn = returnTo;
  settingsScr.refresh();
  showScreen('settings');
}

function goSettingsBack() {
  if (settingsReturn === 'pause' && state?.phase === 'playing') {
    showScreen('game');
    showOverlay(els.dlgPause); // the paused game is still underneath
  } else {
    goHome();
  }
}

function goMap() {
  closePause({ silent: true });
  closeDialog();
  // the win/fail cards' Map button leaves the card context: dismiss both overlays
  // (they are only hidden by startLevel otherwise — Map used to leave the card
  //  open above the levels screen)
  hideOverlay(els.win);
  hideOverlay(els.fail);
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

/* ---------- overlay focus management (§17: dialogs trap focus + restore it) ---------- */
let releaseOverlayFocus = null;
function showOverlay(dlg) { // call whenever a dialog fades in
  releaseOverlayFocus?.();
  dlg.classList.add('open'); // must be visible BEFORE focusing (display:none drops focus)
  releaseOverlayFocus = trapFocus(dlg);
}
function hideOverlay(dlg) { // call whenever the topmost dialog fades out
  releaseOverlayFocus?.();
  releaseOverlayFocus = null;
  if (dlg) dlg.classList.remove('open');
}

/* ---------- boot ---------- */
const splashAt = performance.now(); // v0.3.6: min-hold clock starts when the JS runs

/** v0.3.6 boot splash: fades once Home is live; the min 600 ms hold keeps it from
 *  blipping past on warm/cached loads (§8.3/§9.3). Reduced-motion rounds to instant
 *  via base.css + the in-game toggle. */
function hideSplash() {
  const splash = els.splash;
  if (!splash || splash.dataset.gone) return;
  splash.dataset.gone = '1';
  const hold = Math.max(0, 600 - (performance.now() - splashAt));
  setTimeout(() => {
    splash.classList.add('gone');
    setTimeout(() => splash.remove(), 480); // after the 400 ms fade (inline CSS)
  }, hold);
}

/** v0.3.6: a failed boot never strands a blank app — the splash stays up with an
 *  error line and the pulsing dot stops. */
function splashError(err) {
  const splash = els.splash;
  console.error('boot failed', err);
  if (!splash) return;
  splash.classList.add('blank');
  splash.querySelector('.splash-dot')?.setAttribute('style', 'animation:none');
  const msg = splash.querySelector('.splash-err');
  if (msg) msg.textContent = 'Something went stale 🍪 — try a reload.';
}

async function boot() {
  setBrokenToastHandler(() => showToast(STR.saveToast)); // §13 one-time toast — before initStore
  initStore();
  syncBodyClasses(); // reduce-motion / highlight-off from the persisted settings

  // M3 screens — built after the store exists (their refresh() reads it)
  homeScr = createHomeScr(els.scrHome, {
    play: playFrontier,
    levels: () => { renderLevelSelect(); showScreen('levels'); },
    stats: goStats,
    settings: () => goSettings('home'),
  });
  statsScr = createStatsScr(els.scrStats, goHome);
  settingsScr = createSettingsScr(els.scrSettings, onSettingChange, openResetDialog, goSettingsBack);

  // static overlay/dialog copy (i18n)
  els.win.querySelector('h2').textContent = STR.winTitle;
  $('#btn-replay').textContent = STR.replay;
  $('#btn-next').textContent = STR.next(2);
  $('#btn-map2').textContent = STR.map;
  els.fail.querySelector('h2').textContent = STR.failTitle;
  els.failBody.textContent = STR.failBody;
  $('#btn-fail-restart').textContent = STR.restart;
  $('#btn-fail-map').textContent = STR.map;
  $('#nopro-title').textContent = STR.noProgTitle;
  $('#nopro-body').textContent = STR.noProgBody;
  $('#btn-dlg-shuffle').textContent = STR.dlgShuffle;
  $('#btn-dlg-undo').textContent = STR.dlgUndo;
  $('#btn-dlg-restart').textContent = STR.dlgRestart;
  $('#btn-dlg-map').textContent = STR.dlgMap;
  els.tip.textContent = STR.tipFirst;
  $('#pause-title').textContent = STR.pausedTitle;
  $('#btn-p-resume').textContent = STR.resume;
  $('#btn-p-restart').textContent = STR.pRestart;
  $('#btn-p-settings').textContent = STR.pSettings;
  $('#btn-p-map').textContent = STR.pMap;
  $('#reset-title').textContent = STR.resetConfirmTitle;
  $('#reset-body').textContent = STR.resetConfirmBody;
  $('#lvl-hint').textContent = STR.levelsHint;

  // load all 5 chapters (relative paths — Pages subpath, §2.1)
  for (let i = 1; i <= 5; i++) {
    const json = await (await fetch(`data/levels-${i}.json`)).json();
    chapters.push(parseChapter(json, { chapterIndex: i })); // validates §7.1, skips bad levels
    const ch = chapters[i - 1];
    for (const lvl of ch.levels) ALL.set(lvl.id, { lvl, ch });
  }

  renderLevelSelect();
  showScreen('home'); // M3: boot lands on Home; Play = the frontier level
  homeScr.show();
  hideSplash(); // v0.3.6: all loading + initialisation done → fade to Home

  // §15 PWA: register the dumb-precache worker. URL is derived from this module's own
  // location (not the document) so it stays correct under the Pages subpath (§2.1).
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register(new URL('../sw.js', import.meta.url)).catch(() => {
      /* offline precache is a progressive enhancement — play works regardless */
    });
  }
}
boot().catch(splashError); // v0.3.6: boot failure keeps the splash (with an error line)

/* ---------- §9.2 landscape-phone hint (never blocking, once per session) ---------- */
let landscapeHinted = false;
function landscapeCheck() {
  if (landscapeHinted) return;
  if (matchMedia('(orientation: landscape) and (max-width: 900px)').matches) {
    landscapeHinted = true; // in-memory only — a reload starts a fresh session
    showToast(STR.portraitHint);
  }
}
addEventListener('resize', landscapeCheck);
landscapeCheck();

/** §9.4 Home Play: always the frontier (a mid-level quit abandons, §3.4). */
function playFrontier() {
  const id = Math.min(60, getStore().progress.unlocked);
  const entry = ALL.get(id) ?? ALL.get(1);
  if (entry) startLevel(entry.lvl, 0);
}

/** §13 write-triggered side effects: live mute + body-level art toggles. */
function onSettingChange(key) {
  if (key === 'sfx') audio.applyMute();
  syncBodyClasses();
}

function syncBodyClasses() {
  const s = getStore()?.settings;
  document.body.classList.toggle('reduce-motion', !!s?.reduceMotion); // §17
  document.body.classList.toggle('hl-off', !!s && !s.highlightFree); // §9.4 toggle
}

/* ---------- §13 destructive reset (second confirm lives here) ---------- */
function openResetDialog() {
  resetArmed = false;
  $('#reset-body').textContent = STR.resetConfirmBody;
  $('#btn-reset-yes').textContent = STR.resetConfirm;
  audio.dialog();
  showOverlay(els.dlgReset);
}

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
  revealTimerSet = false; // fresh attempt owns its reveal (rapid-bank stale timers can't ghost it)
  currentScreen = 'game';
  showScreen('game');
  view.cancelFlights();
  closeDialogUIOnly();
  closePause({ silent: true });
  hideOverlay(els.dlgReset);

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
  hideOverlay(els.win);
  hideOverlay(els.fail);
  els.combo.classList.remove('show');

  // §9.4 first-run tooltip: level 1 only, until the very first bank tap ever
  els.tip.classList.toggle('show', !getStore().progress.tutorialDone && lvl.id === 1);

  const cols = Math.max(...lvl.layers.map((r) => r[0].length));
  const rows = Math.max(...lvl.layers.map((r) => r.length));
  FIT = computeFit(els.board, cols, rows);
  view.render(state.tiles);
  view.fit(FIT, cols, rows);
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
    audio.deny(); // §12.1 muted plink
    return;
  }

  // §3.5: only one open peek; every board action resolves it
  if (tile.hidden) {
    if (openPeekId === tile.id) {
      doBank(tile, el); // rule 3: tap the peeked tile → bank it
      return;
    }
    if (openPeekId != null) doUnpeek(tileById(openPeekId)); // rule 4: swap-peek
    openPeekId = tile.id;
    doPeek(tile); // rule 2: holds open until the next board action (no timer)
    return;
  }
  if (openPeekId != null) { // rule 5: face-up tap → the peek flips back, then bank
    doUnpeek(tileById(openPeekId));
    openPeekId = null;
  }
  doBank(tile, el);
});

/* ---------- bank a tile: logic at tap time, flight is cosmetic (§3.3/§14.2) ---------- */
function doPeek(tile) {
  view.peek(tile);
  audio.flip(); // §12.1 candy-flip swish
}

function doUnpeek(tile) {
  if (view.unpeek(tile)) audio.flipBack(); // quieter reverse swish (§12.1)
}

function doBank(tile, el) {
  undoPush(); // §5.4: exactly one snapshot per bank tap
  const comboAtTap = state.comboN; // the ladder pitch is the tap's combo, not landing's
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

  // §9.4: the first-run tooltip teaches exactly one successful bank
  if (els.tip.classList.contains('show')) {
    els.tip.classList.remove('show');
    setProgressFlag('tutorialDone', true);
  }

  el.classList.remove('peeked'); // peeked tiles fly face-up (flip plays during flight, §3.5)
  bank.bank(res.slot, tile.face);
  bank.warnStale(state.bank.map((b) => b?.face));
  refreshBoard();

  audio.flight(); // §12.1 bank-flight slide
  view.flyToBank(el, tile, bank.slotEls[res.slot], () => onLanded(res, tile, comboAtTap));
  checkNoProgress(); // §5.3 strict trigger, at logical tap time
}

/** Flight touchdown: landing reveals, auto-pop presentation, fail/win overlays. */
function onLanded(res, _tile, comboAtTap = 1) {
  if (res.popped) {
    bank.popSlots(res.popped[0], res.popped[1]);
    audio.match(comboAtTap); // §12.1: the pop sound fires AT LANDING, ladder-capped
    for (const s of res.popped) { // candy burst per freed slot (stage-px coords, §16)
      const slotEl = bank.slotEls[s];
      fxr.burst(slotEl.offsetLeft + slotEl.offsetWidth / 2, slotEl.offsetTop + slotEl.offsetHeight / 2, { n: 10 });
    }
  } else {
    bank.land(res.slot);
    audio.land(); // §12.1 soft "thock"
  }
  bank.reconcile(state.bank.map((b) => b?.face)); // v0.3.7: tin = state-truth, self-healing
  bank.warnStale(state.bank.map((b) => b?.face));

  if (state.phase === 'failed') {
    if (!sealRecorded) { sealRecorded = true; recordSeal(); } // §13 stats
    // the four sealed candies face the player in the fail card (§3.6) — sprite faces (v0.3.4)
    els.failTiles.innerHTML = state.bank
      .filter(Boolean)
      .map((b) => `<div class="ftile"><img src="${faceFile(b.face)}" alt="" aria-hidden="true" draggable="false"></div>`)
      .join('');
    // the 4th tile visibly lands before the fail overlay plays (§3.6 locked)
    scheduleReveal(() => showOverlay(els.fail), 120, 'failed');
  } else if (state.phase === 'won') {
    scheduleReveal(() => openWin(), 280, 'won'); // last pair pops first, then ★ reveal (§3.4)
  }
}

/* One reveal timer per attempt: with rapid banking (§3.3 — the fast second tap is
   valid input) BOTH flights of the winning pair resolve after the phase flips, so the
   old `setTimeout(openWin, 280)` ran twice — its stale timer fired over the NEXT
   level's fresh deal and re-opened the win card as a ghost. The fire-time phase guard
   makes stale timers inert; startLevel resets the flag for the fresh attempt. */
let revealTimerSet = false;
function scheduleReveal(reveal, delay, phase) {
  if (revealTimerSet) return;
  revealTimerSet = true;
  setTimeout(() => {
    revealTimerSet = false;
    if (state?.phase === phase) reveal(); // stale timer on a fresh deal does nothing
  }, delay);
}

/* ---------- overlays (§3.6 fail / §4.2 win) ---------- */
function openWin() {
  const prev = getStore().progress.best[String(level.id)] ?? null; // captured BEFORE recordWin
  if (!wonRecorded) {
    wonRecorded = true;
    recordWin(level.id, hudStars(state), state.score); // §6/§13: unlock N+1, best tier
  }
  const n = hudStars(state);
  // §4.2 new-best pill: this run improved the persisted best (stars or score)
  const isNewBest = !prev
    || n > (prev.stars ?? 0)
    || state.score > (prev.score ?? 0);
  els.winBest.hidden = !isNewBest;
  els.winBest.textContent = STR.newBest;
  const glyphEls = els.win.querySelectorAll('#win-stars .st');
  glyphEls.forEach((g, i) => {
    g.classList.toggle('lit', i < n);
    g.classList.remove('star-in');
    if (i < n) {
      g.style.animationDelay = `${i * 250}ms`;
      void g.offsetWidth;
      g.classList.add('star-in');
      setTimeout(() => audio.starPing(i), i * 250 + 60); // §12.1 rising pings
    }
  });
  audio.win(); // §12.1 arpeggio + sprinkle
  fxr.burst(195, 300, { n: 16, spread: 60 });
  fxr.burst(120, 390, { n: 10 });
  fxr.burst(270, 390, { n: 10 });
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
  showOverlay(els.win);
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
    doUnpeek(tileById(openPeekId));
    openPeekId = null;
  }
  state = stateFromSnapshot(snap, level.id, level.t2, level.t3); // combo breaks to ×0 (locked §5.4)
  audio.undo(); // §12.1 rewind slide
  snapScore();
  bank.syncBank(state.bank.map((b) => b?.face));
  const cols = Math.max(...level.layers.map((r) => r[0].length));
  const rows = Math.max(...level.layers.map((r) => r.length));
  view.render(state.tiles);
  view.fit(FIT, cols, rows);
  refreshBoard();
  els.combo.classList.remove('show');
  checkNoProgress();
}

/* ---------- §5.2 Shuffle ---------- */
function doShuffle() {
  if (!state || state.phase !== 'playing' || inputLocked) return;
  if (openPeekId != null) { // board action resolves the open peek (§3.5 rule 6)
    doUnpeek(tileById(openPeekId));
    openPeekId = null;
  }
  const rem = [...state.positions.values()];
  // re-pair the on-board face multiset; seed = id×7919+counter (§14.4). Constructive
  // when the multiset is even (always true with an empty tin); best-effort fallback
  // when a banked single strands its twin (odd family group, §5.2 v0.3.1 ruling).
  const seed = state.levelId * 7919 + reDealCounter;
  const constructive = shuffleBoard(rem, seed);
  let apply = constructive
    ? { pairs: constructive.map((s) => ({ a: s.a, b: s.b, faceA: s.face, faceB: s.face })), stray: null }
    : shuffleBoardBestEffort(rem, seed);
  if (!apply) {
    // construction stalled on all 10 streams (rare, position-degenerate): board left
    // as-is, the §5.3 dialog opens with Shuffle disabled
    openNoProgressDialog(true);
    return;
  }
  undoPush(); // a successful shuffle is one undoable step (§5.4)
  reDealCounter += 1; // §14.4: the counter bumps on Shuffle
  const setFace = (p, f) => {
    const t = state.positions.get(posKey(p.layer, p.row, p.col));
    if (t) t.face = f; // positions + hidden flags never change (§5.2/§8.4)
  };
  for (const { a, b, faceA, faceB } of apply.pairs) {
    setFace(a, faceA);
    setFace(b, faceB);
  }
  if (apply.stray) setFace(apply.stray.pos, apply.stray.face);
  const cols = Math.max(...level.layers.map((r) => r[0].length));
  const rows = Math.max(...level.layers.map((r) => r.length));
  // §5.2 render source: on-board occupants only — the live state's `tiles` array keeps
  // banked/popped ids for lookup (tileById), and rendering them would resurrect banked
  // tiles on the board (undo's snapshot-derived state is on-board-only, so it's safe).
  view.render([...state.positions.values()]);
  view.fit(FIT, cols, rows);
  refreshBoard();
  els.grid.classList.add('shimmer');
  setTimeout(() => els.grid.classList.remove('shimmer'), 260);
  audio.shuffle(); // §12.1 rattle sweep
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
    audio.ghost(); // §12.1 hint chime (same recipe for ghosts + gentle pair pulse)
  } else if (scan.kind === 'ghost') {
    if (openPeekId === scan.a.id) {
      pulseTarget(scan.a); // hint never closes a peek (locked §5.1)
    } else {
      view.ghostFlip(scan.a, () => openPeekId === scan.a.id);
    }
    audio.ghost();
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
    doUnpeek(tileById(openPeekId));
    openPeekId = null;
  }
  $('#btn-dlg-shuffle').disabled = !!shuffleDisabled;
  $('#btn-dlg-undo').disabled = !undoStack.length;
  showOverlay(els.dlg);
  inputLocked = true;
  audio.dialog(); // §12.1 doom-thud
}

function closeDialogUIOnly() {
  hideOverlay(els.dlg);
  dialogOpen = false;
}

function closeDialog() {
  closeDialogUIOnly();
  inputLocked = state?.phase !== 'playing'; // resume input iff a level is live
}

/* ---------- §9.4 pause panel (player-initiated only; tab-hide stays UI-free, §16) ---------- */
function openPause() {
  if (!state || state.phase !== 'playing' || paused || dialogOpen || inputLocked) return;
  paused = true; // the tick stops accumulating game-time; flights keep breathing
  inputLocked = true;
  $('#pause-sub').textContent = STR.pausedSub(chapterInfo.chapter, level.id);
  audio.dialog();
  showOverlay(els.dlgPause);
}

function closePause({ silent = false } = {}) {
  if (!paused) return;
  hideOverlay(els.dlgPause);
  paused = false;
  inputLocked = state?.phase !== 'playing' || dialogOpen;
  if (!silent) audio.jingle(); // resume blip
}

/* ---------- free & unlimited restart (§3.6) + navigation wiring ---------- */
function restart(freshCounter) {
  startLevel(level, freshCounter + 1); // reDealCounter increments → fresh deal (§14.4)
}

$('#btn-pause').addEventListener('click', openPause);
$('#btn-p-resume').addEventListener('click', () => closePause());
$('#btn-p-restart').addEventListener('click', () => { closePause({ silent: true }); restart(reDealCounter); });
$('#btn-p-settings').addEventListener('click', () => {
  hideOverlay(els.dlgPause); // panel hides; paused stays true until back
  goSettings('pause');
});
$('#btn-p-map').addEventListener('click', () => { closePause({ silent: true }); goMap(); });

$('#btn-levels-back').addEventListener('click', goHome);
$('#btn-fail-restart').addEventListener('click', () => restart(reDealCounter));
$('#btn-replay').addEventListener('click', () => startLevel(level, 0));
$('#btn-next').addEventListener('click', () => {
  if (level.id < 60) startLevel(ALL.get(level.id + 1).lvl, 0);
});
$('#btn-map2').addEventListener('click', goMap);
$('#btn-fail-map').addEventListener('click', goMap);
$('#btn-dlg-map').addEventListener('click', goMap);
$('#btn-dlg-restart').addEventListener('click', () => { closeDialog(); restart(reDealCounter); });
$('#btn-dlg-undo').addEventListener('click', () => { closeDialog(); doUndo(); });
$('#btn-dlg-shuffle').addEventListener('click', () => { closeDialog(); doShuffle(); });

$('#btn-undo').addEventListener('click', doUndo);
$('#btn-shuffle').addEventListener('click', doShuffle);
$('#btn-hint').addEventListener('click', doHint);

/* ---------- §13 reset double-confirm ---------- */
$('#btn-reset-yes').addEventListener('click', () => {
  if (!resetArmed) { // arm: demand one more explicit tap (§13 destructive)
    resetArmed = true;
    $('#reset-body').textContent = STR.resetArm;
    $('#btn-reset-yes').textContent = STR.resetConfirm;
    return;
  }
  hideOverlay(els.dlgReset);
  resetProgress(); // store back to pristine defaults
  syncBodyClasses();
  renderLevelSelect();
  settingsScr?.refresh();
  statsScr?.refresh();
  showToast(STR.resetToast);
});
$('#btn-reset-cancel').addEventListener('click', () => {
  resetArmed = false; // leaving the dialog always re-arms fresh next time
  hideOverlay(els.dlgReset);
});

