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
- **Tiles are portrait 5:7 sprite `<img>`s** from `assets/tiles/*.png` (face→file map in `src/data/assets.js`, GDD §10.3 v0.3.4); fit is the level-independent pair `{w, h}` (`th = clamp(min((aw/5)×7/5, (ah − 6·7)/8), 26, 84)` ≈52 × 72.75 design px, v0.3.5 1.5×-tile canon); each layer sits `DY = 7` design px above the one below (`--ty = row·th − layer·DY + stackSpread`, stackSpread = maxLayer·DY headroom above row 0) — no CSS rim/shadow/chip stacks on tiles.
- **Hidden tiles are flat solid slate `#4a3f52`** (CSS `.back`) — no patterns, no `#tile-back` symbol (GDD §3.5).
- The DFS **solver is generation-time only** — never runs during gameplay (GDD §8.3).
- There is **no selection state**: every tap on a free tile banks it instantly (logical celles freed at tap time; flight to bank is cosmetic, GDD §3.3/§14.2).
- Deal RNG is deterministic mulberry32, seed = `levelId × 7919 + reDealCounter`; counter bumps on Restart and Shuffle (GDD §14.4).
- **No JS rapid-tap guard** — fast second tap is valid input (peek→bank); zoom prevention is CSS/viewport-level only (GDD §16).
- **Tab-hide opens no pause UI** — the rAF clock just freezes (GDD §16).
- **Boot splash paints first** (v0.3.6): the self-contained cover in `index.html` (inline CSS, no script) fades only when `main.js` finishes loading data + Home; min 600 ms hold; boot failure keeps it with an error line. No splash at level entry — shimmer only (GDD §8.3).
- **Tin slots are portrait 5:7** (v0.3.7): slot content box = the board-tile cell (≈52×73), sprite minis fill it edge-to-edge, landing settles at scale 1.0 (not 78%); strip is 70→80 px — that consumed the board's exact 10 px fit slack (tiles stay 72.75 px), so don't grow it further without re-verifying the fit. The tin DOM is reconciled from `state.bank` on every landing (in-flight pending minis untouched) — banked tiles never go visually missing (GDD §9.5).
- **The bank is left-packed and face-keyed** (v0.3.8): `state.bank` compacts on every pop (no empty slot ever left of a banked tile; order is rule-neutral) and the tin minis glide left staggered (~220 ms, 60 ms cascade) as the popped pair bursts out. Minis live directly in `#bank`, keyed by face (unique in the bank), positioned by `translate` from slot-0's content origin — never re-parent per slot, never key anything by slot index.
- **The Bubblegum Beach sky breathes** (v0.3.8): one soft white "ivory bloom" glow (`#bg::after`) drifts diagonally + scales over ~14 s, transform/opacity only (no per-frame background repaint), static under prefers-reduced-motion and the in-game toggle (GDD §10.4).
- **iOS 26 fixed-layer hardening** (v0.3.11–v0.3.12, user device = iOS 26.6.1): body-level fixed full-cover layers harden in two tiers — opaque layers (`#bg`, `#splash`) carry explicit `height: 100lvh` + `100vh` fallback next to `inset: 0`; **translucent** scrims (`.overlay`) instead keep auto height and stretch past both safe-area edges via symmetric negative margins (`margin: -(max(env(safe-area-inset-bottom, 0px), 16px) + 8px) 0`) — iOS 26.6 clamps translucent composited fixed layers to the safe-area bottom even when opaque layers paint full-bleed (device-confirmed). Never collapse either back to bare `inset: 0` (GDD §15).
- Service worker = "dumb precache": cache-first, no `skipWaiting`/`clientsClaim`/update toast; releases bump the cache name only, and bare directory-path navigations must serve cached `index.html` (GDD §15).
- Persistence: single `localStorage` key `mahjonglite:v1`; never mirror to IndexedDB; in-memory fallback + toast on storage failure (GDD §13).
- All UI strings live in one `src/data/i18n.js` map (GDD §14.4).

## When code lands

- Target file tree is fixed in GDD §14.1 (`index.html`, `manifest.webmanifest`, `sw.js`, `data/levels-*.json`, `css/`, `src/{core,data,view}/`) — put new files there.
- Level data is agent-authored: 60 levels across 5 chapter files (base shapes, GDD §7.2), validated against §7.1 — even tile count, `cols = 5` exactly (uniform tile size, GDD v0.3.5 1.5×-tile canon), `4 ≤ rows ≤ 8`, ≤ 7 layers, layer L>0 cells must sit on a layer-L−1 footprint, `hidden ≤ 25%` of tiles and `0` for levels 1–12.
- Solvability check per level: fixed-seed deal + 10 fresh-seed re-deals construct, solver backstop passes (GDD §22).
- Conventions: ≤ ~200 lines/module, JSDoc types on exports, no classes without reason (GDD §14.4).

## `design/` assets are generated, not hand-edited

- `design/screens/*.svg` and `design/tile-face-specimen.svg` are outputs of the Python scripts in `design/tools/` — change the scripts and regenerate rather than editing the SVGs.
- Gotcha: `design/tools/gen-screen-mockups.py` writes to a hardcoded Windows `OUTDIR` (`C:\R\OpenCode Projects\...`); fix it to the current repo path before running.
- PNGs under `design/screens/png/` are browser-rendered from the SVGs via `design/tools/capture.html` (screenshot with scale-to-fit); PWA icons rasterize from `design/icons-master[-maskable].svg` via `design/tools/capture-icon.html` + canvas/`<a download>` — the same in-browser rasterization pipeline is the locked method for icons (GDD §15).
- Mockups use the locked 390×844 stage and palette tokens from GDD §9.4/§10.2.
