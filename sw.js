const CACHE_NAME = 'cross-college-v2';
const ASSETS = [
  './',
  './index.html',
  './app.js',
  './manifest.json',
  './logo_college.png',
  'https://cloudflare.com',
  'https://cloudflare.com',
  'https://unpkg.com'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((res) => res || fetch(e.request))
  );
});
