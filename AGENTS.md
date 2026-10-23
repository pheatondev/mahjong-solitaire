# AGENTS.md

## What this repo is

- Design-stage repo for **Mahjong Lite**, a mobile-first mahjong solitaire PWA (browser, GitHub Pages). No code yet — no package manager, no build config, no CI, no tests.
- `GDD.md` is the single source of truth ("the build contract", versioned — v0.3.0). Read it before writing any code; §2 (locked tech constraints), §3/§7/§8 (rules, level format, generation/solver), §14 (architecture + coding conventions) are the operative parts.
- Not yet under version control. GDD §20 build protocol: the agent runs `git init` and commits at milestone checkpoints (M1–M4); creating the GitHub repo and enabling Pages is **user work**.
- Working title "Mahjong Lite" is a placeholder; final rename is a ship-time search/replace (GDD §22) — don't rename anything early.

## Tooling rules (deliberately unconventional)

- **No npm, no build step, no bundler, zero third-party or CDN dependencies** (GDD §2.2–2.3, locked). Plain HTML/CSS + vanilla ES2020 ES modules; helpers are small first-party modules in `src/`. What's in the repo is what's deployed.
- ES modules need HTTP, not `file://`: dev server is `python -m http.server` (or VS Code Live Server).
- **Relative asset paths only** — Pages deploys under a subpath (`/mahjong-lite/`); absolute paths are a known release-breaker (GDD §2.1, §21).
- Exact dev commands, test runners, linters: none exist. Don't invent any.

## Locked GDD rulings agents would otherwise violate

- **DOM rendering, no canvas engine**; one `div.tile` per tile (`z-index = 100 + layer × 10`, transform-only animation).
- **Tiles are portrait 5:7 sprite `<img>`s** from `assets/tiles/*.png` (face→file map in `src/data/assets.js`, GDD §10.3 v0.3.4); fit is the level-independent pair `{w, h}` (`th = clamp(min((aw/8)×7/5, (ah − 4·7)/12), 26, 84)`); each layer sits `DY = 7` design px above the one below (`--ty = row·th − layer·DY`) — no CSS rim/shadow/chip stacks on tiles.
- **Hidden tiles are flat solid slate `#4a3f52`** (CSS `.back`) — no patterns, no `#tile-back` symbol (GDD §3.5).
- The DFS **solver is generation-time only** — never runs during gameplay (GDD §8.3).
- There is **no selection state**: every tap on a free tile banks it instantly (logical celles freed at tap time; flight to bank is cosmetic, GDD §3.3/§14.2).
- Deal RNG is deterministic mulberry32, seed = `levelId × 7919 + reDealCounter`; counter bumps on Restart and Shuffle (GDD §14.4).
- **No JS rapid-tap guard** — fast second tap is valid input (peek→bank); zoom prevention is CSS/viewport-level only (GDD §16).
- **Tab-hide opens no pause UI** — the rAF clock just freezes (GDD §16).
- Service worker = "dumb precache": cache-first, no `skipWaiting`/`clientsClaim`/update toast; releases bump the cache name only, and bare directory-path navigations must serve cached `index.html` (GDD §15).
- Persistence: single `localStorage` key `mahjonglite:v1`; never mirror to IndexedDB; in-memory fallback + toast on storage failure (GDD §13).
- All UI strings live in one `src/data/i18n.js` map (GDD §14.4).

## When code lands

- Target file tree is fixed in GDD §14.1 (`index.html`, `manifest.webmanifest`, `sw.js`, `data/levels-*.json`, `css/`, `src/{core,data,view}/`) — put new files there.
- Level data is agent-authored: 60 levels across 5 chapter files (base shapes, GDD §7.2), validated against §7.1 — even tile count, `cols = 8` exactly (uniform tile size, GDD v0.3.3), `6 ≤ rows ≤ 12`, layer L>0 cells must sit on a layer-L−1 footprint, `hidden ≤ 25%` of tiles and `0` for levels 1–12.
- Solvability check per level: fixed-seed deal + 10 fresh-seed re-deals construct, solver backstop passes (GDD §22).
- Conventions: ≤ ~200 lines/module, JSDoc types on exports, no classes without reason (GDD §14.4).

## `design/` assets are generated, not hand-edited

- `design/screens/*.svg` and `design/tile-face-specimen.svg` are outputs of the Python scripts in `design/tools/` — change the scripts and regenerate rather than editing the SVGs.
- Gotcha: `design/tools/gen-screen-mockups.py` writes to a hardcoded Windows `OUTDIR` (`C:\R\OpenCode Projects\...`); fix it to the current repo path before running.
- PNGs under `design/screens/png/` are browser-rendered from the SVGs via `design/tools/capture.html` (screenshot with scale-to-fit); PWA icons rasterize from `design/icons-master[-maskable].svg` via `design/tools/capture-icon.html` + canvas/`<a download>` — the same in-browser rasterization pipeline is the locked method for icons (GDD §15).
- Mockups use the locked 390×844 stage and palette tokens from GDD §9.4/§10.2.
