// Service Worker for DXS Exchange App
// Strategy: Network First for HTML/CSS/JS (always try fresh), Cache First for icons/manifest

const CACHE_VERSION = 'v4';  // Bump this on every release to force cache refresh
const CACHE_NAME = `dxs-exchange-${CACHE_VERSION}`;

// Assets to precache (available offline)
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-180.png',
  './icon-96.png'
];

// Install: precache assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  // Note: intentionally NOT calling skipWaiting() here.
  // We let the app decide (via postMessage) so user isn't disrupted mid-action.
});

// Activate: clean up old caches, claim all clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch: Network First for navigations & app shell, Cache First for icons/manifest
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;  // only handle same-origin requests

  // Cache First for static assets (icons, manifest) - they rarely change
  const isStaticAsset = /\.(png|jpg|jpeg|svg|ico|json|webp)$/i.test(url.pathname);

  if (isStaticAsset) {
    event.respondWith(
      caches.match(req).then((cached) => {
        return cached || fetch(req).then((res) => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return res;
        });
      })
    );
    return;
  }

  // Network First for HTML/JS/CSS - always try fresh, fallback to cache when offline
  event.respondWith(
    fetch(req).then((res) => {
      if (res && res.status === 200) {
        const clone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
      }
      return res;
    }).catch(() => {
      // Network failed → serve from cache
      return caches.match(req).then((cached) => {
        return cached || caches.match('./index.html');
      });
    })
  );
});

// Listen for messages from the app (e.g. "skipWaiting" when user clicks update)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
