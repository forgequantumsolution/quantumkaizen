// Network-first service worker — avoids stale index.html after deployments.
// Strategy:
//   • Navigation requests (HTML pages) → always network, cache as fallback only when offline
//   • Hashed static assets (/assets/*) → cache-first (immutable filenames, safe to cache long-term)
//   • Everything else → network-first

const CACHE = 'qk-v3';

self.addEventListener('install', () => {
  self.skipWaiting(); // Activate new SW immediately on every deployment
});

self.addEventListener('activate', e => {
  // Delete all old caches from previous SW versions
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const { request } = e;
  const url = new URL(request.url);

  // Skip non-GET and cross-origin requests
  if (request.method !== 'GET' || url.origin !== location.origin) return;

  // Hashed assets are immutable — cache-first
  if (url.pathname.startsWith('/assets/')) {
    e.respondWith(
      caches.open(CACHE).then(cache =>
        cache.match(request).then(cached => {
          if (cached) return cached;
          return fetch(request).then(res => {
            cache.put(request, res.clone());
            return res;
          });
        })
      )
    );
    return;
  }

  // HTML navigation + everything else — network-first, offline fallback to cached /
  e.respondWith(
    fetch(request)
      .then(res => {
        // Cache successful HTML responses for offline fallback
        if (request.mode === 'navigate') {
          caches.open(CACHE).then(c => c.put(request, res.clone()));
        }
        return res;
      })
      .catch(() => caches.match(request).then(r => r || caches.match('/')))
  );
});
