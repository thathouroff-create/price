/**
 * Service Worker: Price & Percent Calculator
 * Versioned cache, network-first navigation, cache-first static assets,
 * destination-aware offline fallbacks, and non-disruptive update lifecycle.
 */

const APP_VERSION = '2.0.1';
const CACHE_NAME = 'price-v' + APP_VERSION;

const STATIC_ASSETS = [
  './',
  './index.html',
  './css/app.css',
  './js/calc-core.js',
  './js/storage.js',
  './js/ui-price.js',
  './js/ui-percent.js',
  './js/app.js',
  './manifest.json',
  './icons/icon.svg',
  './icons/icon-maskable.svg',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;

  // 1. Navigation requests (HTML document): Network-First with Cache fallback
  if (req.mode === 'navigate' || req.destination === 'document') {
    event.respondWith(
      fetch(req)
        .then(res => {
          if (res && res.status === 200) {
            const resClone = res.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(req, resClone));
          }
          return res;
        })
        .catch(() => {
          return caches.match('./index.html');
        })
    );
    return;
  }

  // 2. Images: Cache-first with error fallback (never return HTML for an image!)
  if (req.destination === 'image') {
    event.respondWith(
      caches.match(req).then(cached => {
        return cached || fetch(req).then(res => {
          if (res && res.status === 200) {
            const resClone = res.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(req, resClone));
          }
          return res;
        }).catch(() => {
          return Response.error();
        });
      })
    );
    return;
  }

  // 3. Static scripts & styles: Cache-first
  event.respondWith(
    caches.match(req).then(cached => {
      return cached || fetch(req).then(res => {
        if (res && res.status === 200) {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, resClone));
        }
        return res;
      });
    })
  );
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
