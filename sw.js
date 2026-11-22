const CACHE_NAME = 'cross-college-v3';
const ASSETS = [
  './',
  './index.html',
  './app.js',
  './manifest.json',
  './logo_college.png',
  './jspdf.umd.min.js',
  './qrcode.min.js',
  './html5-qrcode.min.js'
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((res) => res || fetch(e.request))
  );
});
