/* util.js — first-party helpers (§2.3): clamp, seeded mulberry32 RNG (§14.4), tiny event bus. */

/** Clamp value into [lo, hi]. */
export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Deterministic seeded RNG — deals are reproducible (§14.4). seed = levelId × 7919 + reDealCounter. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher–Yates with an injected rng (pure shuffle). */
export function shuffled(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = (rng() * (i + 1)) | 0;
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Minimal pub/sub (no event library — §2.3). */
export function createBus() {
  const map = new Map();
  return {
    on(ev, fn) {
      let s = map.get(ev);
      if (!s) { s = new Set(); map.set(ev, s); }
      s.add(fn);
    },
    emit(ev, data) {
      map.get(ev)?.forEach((fn) => fn(data));
    },
  };
}
