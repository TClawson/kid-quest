// Offline support: serve the app shell from cache, refresh it in the background.
// The deploy replaces this name with one made from the commit, so every
// release gets a fresh cache and PRs never need to bump it.
const CACHE = 'kid-quest-dev';
// One file per line, so PRs that add files don't clash. test/shell.test.js
// checks every file here exists and every app file is here.
const SHELL = [
  './',
  'index.html',
  'css/style.css',
  'css/moves.css',
  'css/pixel.css',
  'css/village.css',
  'css/house.css',
  'css/music.css',
  'fonts/jersey-10-latin-400-normal.woff2',
  'js/app.js',
  'js/ctx.js',
  'js/timer-ui.js',
  'js/sync-ui.js',
  'js/celebrate.js',
  'js/play-ui.js',
  'js/logic.js',
  'js/fx.js',
  'js/avatar.js',
  'js/items.js',
  'js/maparts.js',
  'js/music.js',
  'js/songs.js',
  'js/maplife.js',
  'js/upscale.js',
  'js/village.js',
  'js/villageart.js',
  'js/villagemaps.js',
  'js/villageprops.js',
  'js/meadowart.js',
  'js/oakart.js',
  'js/sunsetart.js',
  'js/wreckart.js',
  'js/oceanart.js',
  'js/galleonart.js',
  'js/spaceart.js',
  'js/caveart.js',
  'js/castleart.js',
  'js/gateart.js',
  'js/volcanoart.js',
  'js/stoneart.js',
  'js/rainforestart.js',
  'js/kapokart.js',
  'js/rainbowart.js',
  'js/goldpotart.js',
  'js/galaxyart.js',
  'js/starwhaleart.js',
  'js/house.js',
  'js/roomwalk.js',
  'js/musichouse.js',
  'js/musicart.js',
  'js/musicrules.js',
  'js/houseart.js',
  'js/houserules.js',
  'js/furniture.js',
  'js/leaderboard.js',
  'js/pixelkit.js',
  'js/treasure.js',
  'js/treasure-art.js',
  'js/mapshow.js',
  'js/landmarks.js',
  'js/store.js',
  'js/visits.js',
  'js/practice.js',
  'js/listen.js',
  'js/onsets.js',
  'js/listen-tap.js',
  'js/hear.js',
  'js/beat.js',
  'js/rig.js',
  'js/live.js',
  'js/play.js',
  'js/hockey.js',
  'js/fishing.js',
  'js/fishart.js',
  'js/football.js',
  'js/playground.js',
  'js/cloud.js',
  'js/firebase-config.js',
  'js/vendor/firebase.js',
  'js/fishbook.js',
  'js/grants.js',
  'js/meter.js',
  'manifest.webmanifest',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
];

self.addEventListener('install', (e) => {
  // cache: 'reload' skips the browser's HTTP cache, so a new version never stores old files
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Network first: when online, always show the latest version (checked with the server,
// not the browser's HTTP cache) and keep a copy. When offline, use the copy.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' })
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true })
        .then((hit) => hit || (e.request.mode === 'navigate' ? caches.match('index.html') : undefined))
        .then((hit) => hit || Response.error())),
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then((list) => (list[0] ? list[0].focus() : self.clients.openWindow('./'))));
});
