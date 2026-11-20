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
        if (live.ok && !live.redirected && live.url.startsWith(scope.origin + scope.pathname) &&
            live.headers.get('Content-Type')?.includes('text/html')) {
          // Cloudflare Access can return an HTML login page; do not poison the
          // offline app shell cache with that page when a session expires.
          const html = await live.clone().text();
          if (html.includes('<title>Market Compass</title>') && html.includes('id="root"')) {
            const cache = await caches.open(CACHE);
            await cache.put(SHELL_URL, live.clone());
          }
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
    if (live.ok && !live.redirected && live.type === 'basic' &&
        !live.headers.get('Content-Type')?.includes('text/html') &&
        !url.pathname.endsWith('/sw.js') &&
        (url.pathname.includes('/assets/') || /\.(?:png|svg|webp|woff2|css|js)$/.test(url.pathname))) {
      const cache = await caches.open(CACHE);
      await cache.put(req, live.clone());
    }
    return live;
  })());
});


// The only push listener: privacy-preserving generic notifications.
self.addEventListener('push', event => {
  let data = {};
  try { data = event.data?.json() || {}; } catch { /* fallback */ }
  event.waitUntil(self.registration.showNotification('Market Compass reminder', {
    body:'Open Market Compass to review your salary-cycle expenses.',
    tag: typeof data.tag==='string' ? data.tag.slice(0,80) : 'mc-reminder',
    icon:new URL('icons/icon-192.png',self.registration.scope).href,
    data:{url:new URL('expenses',self.registration.scope).href}
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target=new URL('expenses',self.registration.scope).href;
  event.waitUntil((async()=>{
    const windows=await clients.matchAll({type:'window',includeUncontrolled:true});
    const existing=windows.find(client=>client.url.startsWith(self.registration.scope));
    if(existing){await existing.navigate(target);return existing.focus();}
    return clients.openWindow(target);
  })());
});

// Browser push works only for explicitly subscribed installed Home Screen apps.
// Never include amounts, account identifiers, or lender names on lock screens.
self.addEventListener('push', event => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch { /* generic fallback */ }
  const title = typeof payload.title === 'string' ? payload.title.slice(0, 100) : 'Market Compass reminder';
  const body = typeof payload.body === 'string' ? payload.body.slice(0, 170) : 'Review your private budget.';
  const url = typeof payload.url === 'string' && /^\/market-compass-ios\/(?:expenses)?$/.test(payload.url)
    ? payload.url : '/market-compass-ios/expenses';
  event.waitUntil(self.registration.showNotification(title, {
    body, tag: typeof payload.tag === 'string' ? payload.tag.slice(0, 100) : 'mc-reminder',
    icon: new URL('icons/icon-192.png', self.registration.scope).href,
    data: { url },
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || '/market-compass-ios/expenses', self.location.origin);
  if(target.origin !== self.location.origin || !target.pathname.startsWith('/market-compass-ios/')) return;
  event.waitUntil(self.clients.matchAll({ type:'window', includeUncontrolled:true }).then(async clients => {
    for (const client of clients) {
      if (new URL(client.url).origin===target.origin) { await client.focus(); return; }
    }
    return self.clients.openWindow(target.href);
  }));
});
