const CACHE_NAME = 'bakery-cache-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/admin.html',
  '/admin.js',
  '/manifest.json',
  '/icons/logo.png',
  '/icons/192.png',
  '/icons/512.png'
];

self.addEventListener('install', evt => {
  evt.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', evt => {
  evt.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', evt => {
  if (evt.request.method !== 'GET') return;
  evt.respondWith(
    caches.match(evt.request).then(cached => {
      if (cached) return cached;
      return fetch(evt.request).then(res => {
        // cache same-origin GET responses
        try {
          if (evt.request.url.startsWith(self.location.origin)) {
            caches.open(CACHE_NAME).then(cache => cache.put(evt.request, res.clone()));
          }
        } catch (e) {
          // ignore non-cacheable responses
        }
        return res;
      }).catch(() => {
        // fallback to index.html for navigation requests (SPA)
        if (evt.request.mode === 'navigate' || (evt.request.headers.get('accept') || '').includes('text/html')) {
          return caches.match('/index.html');
        }
        return caches.match('/index.html');
      });
    })
  );
});
