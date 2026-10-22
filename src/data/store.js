/* store.js — persistence (§13). Single localStorage key `mahjonglite:v1`, versioned with
   an unknown guard → migrate-or-reset. Written on: level complete, stars/score improve,
   settings change, stats change. Storage failure (private mode / quota) → the game keeps
   running fully in memory and shows the one-time non-blocking §13 toast.
   Pure data module — no DOM; the toast itself is main.js's job. */

const KEY = 'mahjonglite:v1';
const VERSION = 1;

const SETTINGS_DEFAULTS = {
  theme: 'bubblegum', // bubblegum | berrynight | mintmeadow (§10.4 — themed in M3)
  sfx: true, music: true,
  highlightFree: true,
  reduceMotion: false,
};
const PROGRESS_DEFAULTS = () => ({ unlocked: 1, lastPlayed: 0, best: {}, tutorialDone: false, promoShown: false });
const STATS_DEFAULTS = () => ({
  matches: 0,     // pop events (user-ruled ×2 relation to pairsCleared)
  pairsCleared: 0, // tiles matched away (2 × matches)
  bestCombo: 0,
  levelsCompleted: 0, // first-time completions
  bankFails: 0,
});

let data = null;
let broken = false; // true once a read/write has failed → run on memory only
let announced = false;
let onBrokenToast = null;

function defaults() {
  return {
    v: VERSION,
    settings: { ...SETTINGS_DEFAULTS },
    progress: PROGRESS_DEFAULTS(),
    stats: STATS_DEFAULTS(),
  };
}

/** Unknown guard → migrate-or-reset (§13): only v === 1 shapes load; everything else
 *  (corrupt JSON, future version, hostile shape) resets to v1 defaults. */
function sanitize(obj) {
  const def = defaults();
  if (!obj || typeof obj !== 'object' || obj.v !== VERSION) return def;
  const best = (obj.progress && typeof obj.progress.best === 'object' && obj.progress.best) || {};
  const num = (x, fallback) => (typeof x === 'number' && Number.isFinite(x) ? x : fallback);
  const bool = (x, fallback) => (typeof x === 'boolean' ? x : fallback);
  return {
    v: VERSION,
    settings: {
      theme: typeof obj.settings?.theme === 'string' ? obj.settings.theme : def.settings.theme,
      sfx: bool(obj.settings?.sfx, true),
      music: bool(obj.settings?.music, true),
      highlightFree: bool(obj.settings?.highlightFree, true),
      reduceMotion: bool(obj.settings?.reduceMotion, false),
    },
    progress: {
      unlocked: Math.min(60, Math.max(1, Math.round(num(obj.progress?.unlocked, 1)))),
      lastPlayed: Math.min(60, Math.max(0, Math.round(num(obj.progress?.lastPlayed, 0)))),
      best,
      tutorialDone: bool(obj.progress?.tutorialDone, false), // §9.4 first-run tooltip
      promoShown: bool(obj.progress?.promoShown, false),     // §13 mitigation 1: install promo
    },
    stats: {
      matches: num(obj.stats?.matches, 0),
      pairsCleared: num(obj.stats?.pairsCleared, 0),
      bestCombo: num(obj.stats?.bestCombo, 0),
      levelsCompleted: num(obj.stats?.levelsCompleted, 0),
      bankFails: num(obj.stats?.bankFails, 0),
    },
  };
}

function maybeAnnounce() {
  if (announced) return;
  announced = true;
  if (onBrokenToast) onBrokenToast();
}

function persist() {
  if (broken) { maybeAnnounce(); return; }
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    broken = true; // private mode / quota: §13 — run in memory, one-time toast
    maybeAnnounce();
  }
}

/** Load (or lazily initialize) the store. Call once at boot. */
export function initStore() {
  let raw = null;
  try { raw = localStorage.getItem(KEY); } catch { broken = true; }
  if (!broken && raw) {
    try { data = sanitize(JSON.parse(raw)); } catch { data = defaults(); }
    // §13 migrate-or-reset: a corrupt / older-shape payload is rewritten to the
    // loadable v1 shape at boot, so it never poisons subsequent boots. Identical
    // payloads write nothing (the listed §13 write triggers stay authoritative).
    if (JSON.stringify(data) !== raw) persist();
  } else {
    data = defaults();
  }
  return data;
}

/** The toast callback fires at most once per session (§13 one-time non-blocking toast). */
export function setBrokenToastHandler(fn) { onBrokenToast = fn; }

export function getStore() { return data; }
export function isBroken() { return broken; }

/** Lifetime total stars over all persisted bests (§9.4 Levels header + Stats). */
export function totalStars() {
  let n = 0;
  for (const r of Object.values(data.progress.best)) n += r?.stars ?? 0;
  return n;
}

/** §9.4 one-time-ness flags live in progress (first-run tooltip, install promo). */
export function setProgressFlag(key, value) {
  if (key in data.progress) data.progress[key] = value;
  persist();
}

/** §13 destructive reset — the double-confirm dialog lives in the settings screen. */
export function resetProgress() {
  data = defaults();
  persist();
}

/** bestOf(id) → {stars, score} | undefined */
export function bestOf(levelId) {
  return data.progress.best[String(levelId)];
}

/** §6/§13: beating level N unlocks N+1; best stars (then score) improve only. */
export function recordWin(levelId, stars, score) {
  const p = data.progress;
  const key = String(levelId);
  const prev = p.best[key];
  const firstTime = !prev;
  if (!prev || stars > prev.stars || score > (prev.score ?? 0)) {
    p.best[key] = { stars, score };
  }
  p.unlocked = Math.min(60, Math.max(p.unlocked, levelId + 1));
  if (firstTime) data.stats.levelsCompleted += 1;
  persist();
}

/** Most recently started level (display/history only, §13). */
export function markPlayed(levelId) {
  data.progress.lastPlayed = levelId;
  persist();
}

/** Stats semantics (user-ruled): matches = pop events; pairsCleared = tiles matched away. */
export function recordPop(comboN) {
  const s = data.stats;
  s.matches += 1;
  s.pairsCleared += 2;
  s.bestCombo = Math.max(s.bestCombo, comboN);
  persist();
}

export function recordSeal() {
  data.stats.bankFails += 1;
  persist();
}

/** Settings hook (§13 write trigger; settings screen lands in M3). */
export function setSetting(key, value) {
  if (key in data.settings) data.settings[key] = value;
  persist();
}
