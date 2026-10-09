/* AVP v5 – Service Worker
 * Strategie: hashed Assets (index-*.js/css) cache-first (immutable),
 * Navigationen network-first mit Cache-Fallback (nie veraltetes HTML),
 * alles andere network-first. Versionierung verhindert Stale-Caches.
 */
const CACHE = 'avp5-cache-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
  // App-Shell precachen (HTML + Manifest + Icons), damit Offline-Installation
  // und Offline-Nutzung schon nach dem ersten Besuch funktionieren
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(['./index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png']))
      .catch(() => {})
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Gehashte Build-Assets: unveränderlich → cache-first
  if (/\/assets\/[^/]+\.[a-z0-9]+\.(js|css|png|svg|woff2?)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy));
            }
            return res;
          })
      )
    );
    return;
  }

  // Navigation & Rest: network-first, offline Fallback auf gecachte Seite
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && (req.mode === 'navigate' || url.pathname.endsWith('/index.html'))) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() =>
        caches.match(req).then((hit) => hit || caches.match('/index.html'))
      )
  );
});
