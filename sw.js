/* SuvoCalc service worker — makes the site work offline after the first visit.
 * Cache-first for same-origin pages and assets; network responses refresh
 * the cache in the background. Old caches are deleted on activate. */
var CACHE = 'suvocalc-v1';
var PRECACHE = [
  '/suvocalc/',
  '/suvocalc/tools/',
  '/suvocalc/categories/',
  '/suvocalc/blog/',
  '/suvocalc/assets/css/style.css',
  '/suvocalc/assets/js/calc.js',
  '/suvocalc/assets/js/main.js',
  '/suvocalc/manifest.json'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return c.addAll(PRECACHE);
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) {
      return caches.delete(k);
    }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  var url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;
  e.respondWith(caches.match(e.request).then(function (hit) {
    if (hit) return hit;
    return fetch(e.request).then(function (res) {
      if (res && res.ok) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
      }
      return res;
    }).catch(function () {
      if (e.request.mode === 'navigate') return caches.match('/suvocalc/');
      return new Response('Offline', { status: 503, statusText: 'Offline' });
    });
  }));
});
