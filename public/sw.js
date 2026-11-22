/* NOWERA service worker — v2 (Web Push اضافه شد)
 * Only same-origin GET requests are cached. Supabase (cross-origin) and /api/* are never cached. */
const VERSION = 'nowera-v2';
const SHELL_CACHE = `${VERSION}-shell`;
const ASSET_CACHE = `${VERSION}-assets`;
const SHELL_URLS = ['/', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((c) => c.addAll(SHELL_URLS)).catch(() => {}));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

// ───── Web Push ─────
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = { body: event.data ? event.data.text() : '' }; }
  event.waitUntil(
    self.registration.showNotification(data.title || 'NOWERA', {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/favicon-48.png',
      tag: data.tag || undefined,
      renotify: Boolean(data.tag),
      data: { url: data.url || '/' },
      dir: 'rtl',
      lang: 'fa',
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (list) => {
      for (const c of list) {
        if (new URL(c.url).origin === self.location.origin) {
          await c.focus();
          if ('navigate' in c) { try { await c.navigate(target); } catch (e) {} }
          return;
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});

// اگر مرورگر اشتراک را تازه کرد، صفحه را خبر کن تا دوباره ثبت کند
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    self.clients.matchAll({ includeUncontrolled: true }).then((list) =>
      list.forEach((c) => c.postMessage({ type: 'PUSH_RESUBSCRIBE' })),
    ),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;
  if (url.pathname === '/sw.js') return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL_CACHE).then((c) => c.put('/', copy));
          return res;
        })
        .catch(async () => (await caches.match('/')) || Response.error()),
    );
    return;
  }

  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(ASSET_CACHE).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }

  event.respondWith(
    caches.open(ASSET_CACHE).then(async (cache) => {
      const hit = await cache.match(req);
      const net = fetch(req)
        .then((res) => {
          if (res.ok) cache.put(req, res.clone());
          return res;
        })
        .catch(() => hit);
      return hit || net;
    }),
  );
});
