# Mahjong Lite 🍬

Candy-coated mahjong solitaire for mobile browsers. Bank twins instantly, pop pairs
understocked with free tiles, chase three stars per level. Free, offline-capable,
no ads, no accounts, no tracking.

> **Mahjong Lite** is a working title placeholder — the final name is chosen at ship
> time and is a single search/replace (GDD §22).

## How to play

- **Tap any free tile** (an empty edge or top — both left & right edges and the top face
  clear) to bank it instantly. Two identical faces in the bank pop as a pair and free
  their spaces.
- A pair pops as long as **at least one of its two tiles is free at tap time** —
  the banked twin counts.
- The bank holds 4 tiles. Fill it with no pop and no possible moves and the run is
  sealed (game over). Boosters: **Undo ↩︎** (20 snapshots), **Shuffle 🔄**, **Hint 💡**.
- Pickup-and-play goals: gold `t2`(score)/`t3`(score) targets grant the 2nd/3rd star.

## Run it locally

ES modules + level fetches never work from `file://`.

```sh
python -m http.server 8124
# → http://localhost:8124/
```

Any static file server works. There is **no build step**: what's in the repo is what's
deployed (vanilla ES2020 modules, no dependencies, no bundler — GDD §2.2–2.3).

## Deploy (GitHub Pages)

1. Push the repo (all files at the repo root: `index.html`, `manifest.webmanifest`,
   `sw.js`, `css/`, `src/`, `data/`, `icons/`).
2. Settings → Pages → deploy from the branch root.
3. That's it. Every URL in the game is **relative** (`./…`), so it deploys under any
   subpath (e.g. `https://user.github.io/mahjong-lite/`). Changing absolute paths back
   is the #1 known release-breaker (GDD §2.1, §21).

When renaming at ship time: the name appears in `index.html` (title), `manifest.webmanifest`
(`name`/`short_name`/`id`), the localStorage key prefix (`mahjonglite:v1`, keep it or
migrate deliberately), and the service-worker cache prefix.

## Offline / releases ("dumb precache", GDD §15)

The service worker precaches the whole shell on install and serves it cache-first.
There is NO update dance — the **only** release mechanism is bumping `VERSION` in
`sw.js` (e.g. `v1.0.0` → `v1.0.1`), which changes the cache name; on activate the old
cache is deleted and players get the new files on their next visit.

Dev tip: the SW roots itself after the first load — if you edit files and reload into an
old shell, unregister it once from the console
(`navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister()))`
plus `caches.keys().then(ks => ks.forEach(k => caches.delete(k)))`) then reload.

## Icons (pipeline note)

`icons/*.png` are rasterized from a hand-built master SVG **in the browser** (SVG data
URL → `<canvas>` → `toDataURL`) at exact sizes: 512/192 (any), 512/192 maskable with the
content shrunk to the safe zone, and 180 apple-touch-icon. `favicon.svg` is the
tile-face-only file counterpart. To change icon art, edit the master and re-rasterize —
don't hand-edit the PNGs.

## Tech notes

- **DOM rendering, no canvas engine** — one `div.tile` per tile; transform-only animation.
- **No JS rapid-tap guard** — fast second taps are valid input (peek → bank); zoom is
  prevented at the CSS/viewport level only.
- Persistence is one `localStorage` key (`mahjonglite:v1`); an in-memory fallback + a
  one-time toast covers broken storage modes.
- Full design constraints, rules, level format and architecture live in `GDD.md`
  (§3 core rules, §7 levels, §14 architecture, §22 definition of done).

## Data & tests

```sh
node scripts/build-levels.mjs   # regenerate chapter JSONs from the base shapes
node scripts/validate.mjs       # GDD §7.1 level validation
node scripts/smoke-rules.mjs    # M1 rules-core smoke (§3/§4/§8)
node scripts/smoke-m2.mjs       # M2 full-loop smoke (60 levels × 10 seeds + boosters)
```

All 60 levels are validated: even tile count, 8–14 × 6–12 bounds, footprint integrity,
hidden-tile caps, and solvability (fixed-seed deal + solver backstop).
