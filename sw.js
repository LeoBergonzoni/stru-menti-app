const VERSION = 'v1.0.0';
const OFFLINE_HTML = '/offline.html';
const STATIC_ASSETS = [
  '/', '/index.html',
  '/style.css', '/script.js',
  OFFLINE_HTML
];

// Install: precache essenziali
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(`static-${VERSION}`).then(c => c.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate: pulizia vecchi cache
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys
        .filter(k => !k.endsWith(VERSION))
        .map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

function isHtml(req) {
  return req.mode === 'navigate' ||
         (req.headers.get('accept') || '').includes('text/html');
}

function isStaticAsset(url) {
  return /\.(?:js|css|png|jpg|jpeg|svg|woff2?)$/i.test(url.pathname);
}

function isApi(url) {
  // Netlify Functions + Firestore + Stripe checkout endpoints
  return url.pathname.startsWith('/.netlify/functions/')
      || url.hostname.endsWith('firebaseio.com')
      || url.hostname.endsWith('googleapis.com')
      || url.hostname.endsWith('stripe.com')
      || url.hostname.endsWith('openai.com');
}

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  const req = e.request;

  // Non interferire con metodi non-GET
  if (req.method !== 'GET') return;

  // HTML => network-first con fallback cache/offline
  if (isHtml(req)) {
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(`pages-${VERSION}`).then(c => c.put(req, copy));
        return res;
      }).catch(async () => {
        const cached = await caches.match(req);
        return cached || caches.match(OFFLINE_HTML);
      })
    );
    return;
  }

  // API dinamiche => fetch diretto (no cache)
  if (isApi(url)) {
    return; // lascia passare
  }

  // Asset statici => stale-while-revalidate
  if (isStaticAsset(url)) {
    e.respondWith((async () => {
      const cache = await caches.open(`assets-${VERSION}`);
      const cached = await cache.match(req);
      const networkPromise = fetch(req).then(res => {
        cache.put(req, res.clone());
        return res;
      }).catch(() => cached);
      return cached || networkPromise;
    })());
  }
});