// NOWERA service worker: instant repeat loads + offline shell.
// Never touches Supabase/API traffic (cross-origin or /api) — data is always live.
const VERSION = 'nowera-v1-5-1';
const STATIC = `static-${VERSION}`;
const SHELL = `shell-${VERSION}`;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.add('/index.html').catch(() => {})).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => ![STATIC, SHELL].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  // Hashed build assets never change: cache-first.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(caches.open(STATIC).then(async (cache) => {
      const hit = await cache.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) cache.put(req, res.clone());
      return res;
    }));
    return;
  }

  // Logos/icons keep their file names: show the cached copy instantly, refresh it in the background.
  if (url.pathname.startsWith('/icons/') || url.pathname.startsWith('/brands/')) {
    event.respondWith(caches.open(STATIC).then(async (cache) => {
      const hit = await cache.match(req);
      const fresh = fetch(req).then((res) => { if (res.ok) cache.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || fresh;
    }));
    return;
  }

  // Page navigations: network first (always the newest deploy), cached shell when offline.
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).then((res) => {
      if (res.ok) caches.open(SHELL).then((c) => c.put('/index.html', res.clone()));
      return res;
    }).catch(() => caches.match('/index.html')));
  }
});
