/* Mahjong Lite — sw.js (GDD §15, locked "dumb precache" strategy).
   - Version-named cache, precache-as-install: the whole shipped shell on install.
   - Cache-first for same-origin GETs, plain network otherwise.
   - Bare directory-path navigations (deployed subpath, e.g. /mahjong-lite/) serve the
     cached index.html shell.
   - NO skipWaiting / clientsClaim / update toast. The ONLY release mechanism is a
     cache-name bump (VERSION below): the new deploy misses, repopulates, and activate
     deletes the old-named cache. Players get the new version on their next visit. */

const VERSION = 'v1.0.0';
const CACHE = `mahjonglite-${VERSION}`;

/* Every file the shell needs — anything not listed here is simply never cached. */
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/base.css',
  './css/themes.css',
  './css/components.css',
  './css/anim.css',
  './src/main.js',
  './src/util.js',
  './src/core/state.js',
  './src/core/rules.js',
  './src/core/solver.js',
  './src/core/dealer.js',
  './src/core/score.js',
  './src/data/levels.js',
  './src/data/i18n.js',
  './src/data/store.js',
  './src/view/board-render.js',
  './src/view/level-select.js',
  './src/view/widgets.js',
  './src/view/fx.js',
  './src/view/audio.js',
  './src/view/screens/home.js',
  './src/view/screens/stats.js',
  './src/view/screens/settings.js',
  './data/levels-1.json',
  './data/levels-2.json',
  './data/levels-3.json',
  './data/levels-4.json',
  './data/levels-5.json',
  './icons/favicon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
];

/* Install: precache everything. We intentionally do NOT call skipWaiting — the old
   worker keeps serving until every tab has closed (§15: no update dance). */
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
});

/* Activate: delete caches from older releases. We intentionally do NOT claim clients. */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
  );
});

/* Fetch: cache-first for same-origin GETs; navigations fall back to the cached shell
   so bare directory-path visits (and offline reopens) always get index.html (§15). */
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return; // plain network otherwise
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  const isNav = req.mode === 'navigate' || req.destination === 'document';
  if (isNav) {
    event.respondWith(caches.match('./index.html').then((hit) => hit || fetch(req)));
    return;
  }
  event.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
});
