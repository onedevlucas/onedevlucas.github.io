const CACHE_NAME = 'borail-v78-notifications';
const PUSH_META_CACHE = 'borail-push-meta-v1';
const PUSH_META_URL = '/__borail_push_config__';

const CORE_ASSETS = [
  './',
  'index.html',
  'home.html',
  'map.html',
  'mybocard.html',
  'status.html',
  'settings.html',
  'workbench.html',
  'manifest.webmanifest',
  'assets/css/home.css',
  'assets/css/map.css',
  'assets/css/mybocard.css',
  'assets/css/status.css',
  'assets/css/settings.css',
  'assets/css/timetable.css',
  'assets/css/winter-emergency.css',
  'assets/css/workbench.css',
  'assets/js/status.js',
  'assets/js/settings.js',
  'assets/js/borail-data.js',
  'assets/js/notification-config.js',
  'assets/js/pwa.js',
  'assets/js/mybocard.js',
  'assets/js/time.js',
  'assets/js/service-calendar.js',
  'assets/js/ad-carousel.js',
  'assets/js/live-map-route-geometry.js',
  'assets/js/live-map-id-geometry.js',
  'assets/js/live-map.js',
  'assets/js/trip-planner-core.js',
  'assets/js/timetable.js',
  'assets/js/workbench-core.js',
  'assets/js/workbench.js',
  'assets/maps/borail-flatlands-regular-service-map.pdf',
  'assets/maps/borail-flatlands-route-map.pdf',
  'assets/maps/borail-flatlands-rush-hour-map.pdf',
  'assets/maps/borail-flatlands-winter-emergency-map.pdf',
  'assets/maps/borail-live-track-layout.svg',
  'assets/maps/engineering/registry.json',
  'assets/maps/engineering/ALocal.svg',
  'assets/maps/engineering/AExpress.svg',
  'assets/maps/engineering/BLocal.svg',
  'assets/maps/engineering/BExpress.svg',
  'assets/maps/engineering/CLocal.svg',
  'assets/maps/engineering/DLocal.svg',
  'assets/maps/engineering/ELocal.svg',
  'assets/maps/engineering/FLocal.svg',
  'assets/maps/engineering/FExpress.svg',
  'assets/maps/engineering/GLocal.svg',
  'assets/maps/engineering/SLocal.svg',
  'assets/maps/engineering/SExpress.svg',
  'assets/images/ads/carousel/manifest.json',
  'assets/images/ads/carousel/01-sponsor.png',
  'assets/images/ads/carousel/02-youtube-promo.png',
  'assets/images/ads/carousel/03-discord.png',
  'assets/images/ads/carousel/04-mybocard.png',
  'assets/images/ads/carousel/05-smooth-stop.png',
  'assets/images/branding/borail-logo.png',
  'assets/images/branding/favicon.png',
  'assets/images/navigation/information.png',
  'assets/images/navigation/game-controller.svg',
  'assets/images/navigation/map.png',
  'assets/images/navigation/mybocard.svg',
  'assets/images/navigation/status.png',
  'assets/images/navigation/settings.svg',
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
      keys.filter((key) => key !== CACHE_NAME && key !== PUSH_META_CACHE).map((key) => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener('message', (event) => {
  if (event.data?.type !== 'BORAIL_PUSH_CONFIG') return;
  const payload = {
    apiBase: String(event.data.apiBase || '').replace(/\/$/, ''),
    id: String(event.data.id || ''),
    manageToken: String(event.data.manageToken || '')
  };
  event.waitUntil(
    caches.open(PUSH_META_CACHE).then(cache => cache.put(
      PUSH_META_URL,
      new Response(JSON.stringify(payload), { headers: { 'Content-Type': 'application/json' } })
    ))
  );
});

self.addEventListener('push', (event) => {
  let payload = {};
  try { payload = event.data?.json() || {}; }
  catch { payload = { body: event.data?.text() || 'BORail service information has changed.' }; }
  const title = payload.title || 'BORail Service Alert';
  const options = {
    body: payload.body || '',
    icon: payload.icon || 'assets/images/branding/borail-logo.png',
    badge: payload.badge || 'assets/images/branding/favicon.png',
    tag: payload.tag || 'borail-service-alert',
    renotify: payload.renotify !== false,
    data: {
      url: payload.url || 'status.html',
      ...(payload.data || {})
    }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || 'status.html', self.location.origin).href;
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(openClients => {
      const existing = openClients.find(client => client.url.startsWith(self.location.origin));
      if (existing) {
        existing.navigate(target);
        return existing.focus();
      }
      return clients.openWindow(target);
    })
  );
});

self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(PUSH_META_CACHE);
      const response = await cache.match(PUSH_META_URL);
      const meta = response ? await response.json() : null;
      if (!meta?.apiBase || !meta?.id || !meta?.manageToken) throw new Error('Missing subscription metadata');
      const configResponse = await fetch(`${meta.apiBase}/config`);
      const config = await configResponse.json();
      const padding = '='.repeat((4 - config.vapidPublicKey.length % 4) % 4);
      const raw = atob((config.vapidPublicKey + padding).replace(/-/g, '+').replace(/_/g, '/'));
      const key = Uint8Array.from(raw, character => character.charCodeAt(0));
      const subscription = await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
      const refreshResponse = await fetch(`${meta.apiBase}/subscriptions/${encodeURIComponent(meta.id)}/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${meta.manageToken}` },
        body: JSON.stringify({ subscription: subscription.toJSON() })
      });
      if (!refreshResponse.ok) throw new Error('Subscription refresh failed');
    } catch {
      await self.registration.showNotification('BORail Notifications Need Attention', {
        body: 'Open BORail Settings to reconnect notifications on this device.',
        icon: 'assets/images/branding/borail-logo.png',
        tag: 'borail-push-reconnect',
        data: { url: 'settings.html' }
      });
    }
  })());
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const requestPath = new URL(event.request.url).pathname;
  const networkFirst = ['document', 'script', 'style'].includes(event.request.destination) ||
    requestPath.endsWith('/assets/images/ads/carousel/manifest.json');

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
