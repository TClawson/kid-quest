// Offline support: serve the app shell from cache, refresh it in the background.
const CACHE = 'kid-quest-v57';
const SHELL = [
  './', 'index.html', 'css/style.css', 'css/moves.css', 'css/pixel.css', 'fonts/jersey-10-latin-400-normal.woff2', 'js/app.js', 'js/logic.js', 'js/fx.js', 'js/avatar.js', 'js/items.js', 'js/maparts.js', 'js/music.js', 'js/songs.js', 'js/maplife.js', 'js/treasure.js', 'js/treasure-art.js', 'js/mapshow.js', 'js/landmarks.js', 'js/store.js', 'js/visits.js', 'js/practice.js', 'js/listen.js', 'js/onsets.js', 'js/listen-tap.js', 'js/hear.js', 'js/beat.js', 'js/rig.js', 'js/live.js', 'js/play.js', 'js/hockey.js', 'js/fishing.js', 'js/football.js', 'js/playground.js', 'js/cloud.js', 'js/firebase-config.js', 'js/vendor/firebase.js',
  'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png',
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
