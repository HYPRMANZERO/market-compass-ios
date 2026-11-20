/* Market Compass offline app shell — compiled assets are injected during GitHub Actions.
   The service worker never caches financial API requests or any other cross-origin data.
   IndexedDB holds the encrypted vault independently of this static application cache. */
const CACHE = 'mc-offline-__BUILD_ID__';
const APP_SHELL = __PRECACHE_JSON__;
const SHELL_URL = new URL('./index.html', self.registration.scope).href;

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(APP_SHELL.map(path => new URL(path, self.registration.scope).href));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('mc-offline-') && key !== CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const scope = new URL(self.registration.scope);
  if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;
  if (url.pathname.includes('/api/') || url.pathname.includes('/auth/') || req.headers.has('Authorization')) return;

  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const live = await fetch(req, { cache: 'no-store' });
        if (live.ok && !live.redirected && live.url.startsWith(scope.origin + scope.pathname) && live.headers.get('Content-Type')?.includes('text/html')) {
          const cache = await caches.open(CACHE);
          await cache.put(SHELL_URL, live.clone());
        }
        return live;
      } catch {
        return (await caches.match(SHELL_URL)) ||
          new Response('Market Compass could not open. Connect once to finish installing the offline shell.', { status: 503, headers: { 'Content-Type': 'text/plain' } });
      }
    })());
    return;
  }
  // Immutable content-hashed JS/CSS assets and icons use cache-first. A new build
  // installs a new cache atomically, then removes old asset versions.
  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;
    const live = await fetch(req);
    if (live.ok && live.type === 'basic' && !url.pathname.endsWith('/sw.js') &&
        (url.pathname.includes('/assets/') || /\.(?:png|svg|webp|woff2|css|js)$/.test(url.pathname))) {
      const cache = await caches.open(CACHE);
      await cache.put(req, live.clone());
    }
    return live;
  })());
});

/* All push payloads are generic reminders; no balance or financial record appears
   in the notification. Notification clicks open the installed expense page. */
self.addEventListener('push', event => {
  let message = {};
  try { message = event.data ? event.data.json() : {}; } catch { /* generic fallback */ }
  const title = 'Market Compass check-in';
  const body = 'Open Market Compass to review your salary-cycle budget.';
  const target = new URL('./expenses', self.registration.scope).href;
  event.waitUntil(self.registration.showNotification(title, {
    body, tag: typeof message.tag === 'string' ? message.tag.slice(0, 80) : 'mc-check-in',
    icon: new URL('./icons/icon-192.png', self.registration.scope).href,
    data: { target }
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = event.notification.data?.target || new URL('./expenses', self.registration.scope).href;
  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({type:'window', includeUncontrolled:true});
    const existing = clients.find(client => new URL(client.url).origin === new URL(target).origin);
    if (existing) { await existing.focus(); existing.navigate(target); return; }
    await self.clients.openWindow(target);
  })());
});

// Notifications never contain banking data and only navigate inside the PWA.
self.addEventListener('push', event => {
  let data = {};
  try { data = event.data?.json() || {}; } catch { /* Ignore invalid payload */ }
  const title = 'Market Compass salary-day check-in';
  event.waitUntil(self.registration.showNotification(title, {
    body: 'Open Market Compass to record salary and review upcoming expenses.',
    tag: 'mc-salary-reminder', icon: new URL('icons/icon-192.png', self.registration.scope).href,
    data: { url: new URL('expenses', self.registration.scope).href }
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = new URL('expenses', self.registration.scope).href;
  event.waitUntil((async () => {
    const clientsList = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = clientsList.find(client => client.url.startsWith(self.registration.scope));
    if (existing) { await existing.navigate(target); return existing.focus(); }
    return clients.openWindow(target);
  })());
});
