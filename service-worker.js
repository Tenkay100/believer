const CACHE_NAME = 'aff-bank-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/login.html',
  '/assets/css/main.css',
  '/assets/css/animations.css',
  '/assets/js/utils.js',
  'https://unpkg.com/@phosphor-icons/web'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(ASSETS_TO_CACHE);
      })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Only intercept GET requests
  if (event.request.method !== 'GET') return;
  // Don't intercept API/Supabase calls
  if (event.request.url.includes('supabase.co')) return;

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version or fetch from network (Network-first strategy for HTML, Cache-first for CSS/JS)
        if (event.request.destination === 'document') {
           return fetch(event.request).catch(() => response);
        }
        return response || fetch(event.request);
      })
  );
});
