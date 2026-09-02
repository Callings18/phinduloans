const CACHE_NAME = 'phindu-credit-v4';
const STATIC_CACHE = 'phindu-credit-static-v4';

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/favicon-32.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
  '/placeholder.svg',
];

const isNavigationRequest = (request) =>
  request.mode === 'navigate' ||
  (request.method === 'GET' && request.headers.get('accept')?.includes('text/html'));

// Install — precache shell assets; tolerate individual 404s
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(async (cache) => {
      await Promise.allSettled(PRECACHE_URLS.map((url) => cache.add(url)));
    }),
  );
  self.skipWaiting();
});

// Activate — drop old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((name) => name !== CACHE_NAME && name !== STATIC_CACHE)
          .map((name) => caches.delete(name)),
      ),
    ),
  );
  self.clients.claim();
});

// Fetch — network-first for HTML; cache-first for static; runtime cache for other GETs
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (isNavigationRequest(request)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', clone));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match('/index.html');
          return cached || caches.match('/');
        }),
    );
    return;
  }

  if (
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.woff2')
  ) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response && response.status === 200) {
              const clone = response.clone();
              caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
            }
            return response;
          }),
      ),
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => caches.match(request)),
  );
});

// Push notification event
self.addEventListener('push', (event) => {
  let title = 'Phindu Credit';
  let body = 'You have a new notification';
  let targetUrl = '/dashboard';
  if (event.data) {
    try {
      const parsed = event.data.json();
      if (parsed.title) title = String(parsed.title);
      if (parsed.body) body = String(parsed.body);
      if (parsed.url && typeof parsed.url === 'string') targetUrl = parsed.url;
    } catch {
      body = event.data.text() || body;
    }
  }

  const options = {
    body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    vibrate: [100, 50, 100],
    data: { dateOfArrival: Date.now(), url: targetUrl },
    actions: [
      { action: 'explore', title: 'View Details' },
      { action: 'close', title: 'Close' },
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/dashboard';

  if (event.action === 'close') return;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    }),
  );
});
