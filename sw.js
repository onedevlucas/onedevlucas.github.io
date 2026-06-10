const CACHE_NAME = 'borail-v50c-organized';

const CORE_ASSETS = [
  './',
  'index.html',
  'home.html',
  'map.html',
  'status.html',
  'assets/css/home.css',
  'assets/css/map.css',
  'assets/css/status.css',
  'assets/css/timetable.css',
  'assets/js/status.js',
  'assets/js/timetable.js',
  'assets/images/ads/sponsor.png',
  'assets/images/ads/youtube-promo.png',
  'assets/images/branding/borail-logo.png',
  'assets/images/branding/favicon.png',
  'assets/images/navigation/information.png',
  'assets/images/navigation/map.png',
  'assets/images/navigation/status.png',
  'assets/images/navigation/timetable.png',
  'assets/images/ui/accessibility.png',
  'assets/images/line-icons/a-express.png',
  'assets/images/line-icons/a-local.png',
  'assets/images/line-icons/b-express.png',
  'assets/images/line-icons/b-local.png',
  'assets/images/line-icons/c-local.png',
  'assets/images/line-icons/d-local.png',
  'assets/images/line-icons/e-local.png',
  'assets/images/line-icons/f-express.png',
  'assets/images/line-icons/f-local.png',
  'assets/images/line-icons/g-local.png',
  'assets/images/line-icons/s-express.png',
  'assets/images/line-icons/s-local.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const networkFirst = ['document', 'script', 'style'].includes(event.request.destination);

  if (networkFirst) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }

        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      });
    })
  );
});
