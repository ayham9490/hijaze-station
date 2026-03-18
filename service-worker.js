const STATIC_CACHE = 'accounting-static-v3';
const RUNTIME_CACHE = 'accounting-runtime-v3';
const OFFLINE_FALLBACK = './offline.html';

const CORE_ASSETS = [
  './',
  './index.html',
  './offline.html',
  './style.css',
  './app.js',
  './config.js',
  './manifest.json',
  './service-worker.js',
  './modules/ui.js',
  './modules/auth.js',
  './modules/supabase-client.js',
  './modules/currency.js',
  './modules/accounts.js',
  './modules/transactions.js',
  './modules/reports.js',
  './pages/dashboard.html',
  './pages/accounts.html',
  './pages/transactions.html',
  './pages/ledger.html',
  './pages/reports.html',
  './pages/settings.html',
  './assets/logo.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-1024.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(STATIC_CACHE);
    await Promise.allSettled(CORE_ASSETS.map(async (asset) => {
      try {
        await cache.add(asset);
      } catch (error) {
        // فشل ملف فردي لا يمنع تثبيت الخدمة.
      }
    }));
  })());
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => key !== STATIC_CACHE && key !== RUNTIME_CACHE)
        .map((key) => caches.delete(key))
    );
    await self.clients.claim();
  })());
});

const isSameOrigin = (requestUrl) => {
  return new URL(requestUrl).origin === self.location.origin;
};

const serveNavigationRequest = async (event) => {
  try {
    const networkResponse = await fetch(event.request);
    const cache = await caches.open(RUNTIME_CACHE);
    cache.put(event.request, networkResponse.clone());
    return networkResponse;
  } catch (error) {
    const cachedPage = await caches.match(event.request);
    if (cachedPage) {
      return cachedPage;
    }
    const offlinePage = await caches.match(OFFLINE_FALLBACK);
    return offlinePage || Response.error();
  }
};

const serveStaticRequest = async (event) => {
  const cacheHit = await caches.match(event.request);
  const fetchPromise = fetch(event.request)
    .then(async (networkResponse) => {
      if (networkResponse && networkResponse.status === 200 && isSameOrigin(event.request.url)) {
        const runtime = await caches.open(RUNTIME_CACHE);
        runtime.put(event.request, networkResponse.clone());
      }
      return networkResponse;
    })
    .catch(() => cacheHit);

  return cacheHit || fetchPromise;
};

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(serveNavigationRequest(event));
    return;
  }

  event.respondWith(serveStaticRequest(event));
});
