/* Update this version whenever app shell behavior changes. Navigation is network-first. */
const VERSION = 'cinevault-v1.1.0';
const CORE = [
  '/',
  '/watchlist',
  '/watched',
  '/collections',
  '/settings',
  '/statistics',
  '/bulk',
  '/discover',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icon.svg',
];
const installFetch = (url) => fetch(url, { cache: 'reload', signal: AbortSignal.timeout(8000) });
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(VERSION),
        assets = new Set();
      await Promise.all(
        CORE.map(async (url) => {
          try {
            const response = await installFetch(url);
            if (!response.ok) return;
            await cache.put(url, response.clone());
            if (response.headers.get('Content-Type')?.includes('text/html')) {
              const html = await response.text();
              for (const match of html.matchAll(/(?:src|href)="(\/_next\/static\/[^"?]+)"/g))
                assets.add(match[1]);
            }
          } catch {}
        }),
      );
      // Shared chunks occur in every route. Fetch each once with bounded concurrency.
      const pending = [...assets];
      await Promise.all(
        Array.from({ length: Math.min(4, pending.length) }, async () => {
          while (pending.length) {
            const asset = pending.shift();
            try {
              const response = await installFetch(asset);
              if (response.ok) await cache.put(asset, response);
            } catch {}
          }
        }),
      );
      await self.skipWaiting();
    })(),
  );
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys())
        if (name.startsWith('cinevault-') && name !== VERSION) await caches.delete(name);
      await self.clients.claim();
    })(),
  );
});
self.addEventListener('fetch', (event) => {
  const req = event.request,
    url = new URL(req.url);
  if (
    req.method !== 'GET' ||
    url.pathname.startsWith('/api/') ||
    req.headers.get('RSC') ||
    url.searchParams.has('_rsc')
  )
    return;
  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const cache = await caches.open(VERSION);
        try {
          const r = await fetch(req);
          if (r.ok) await cache.put(url.pathname, r.clone());
          return r;
        } catch {
          return (await cache.match(url.pathname)) || (await cache.match('/')) || Response.error();
        }
      })(),
    );
    return;
  }
  if (url.origin === self.location.origin && url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(VERSION),
          old = await cache.match(req);
        if (old) return old;
        const r = await fetch(req);
        if (r.ok) await cache.put(req, r.clone());
        return r;
      })(),
    );
  } else if (url.hostname === 'image.tmdb.org') {
    event.respondWith(
      (async () => {
        const cache = await caches.open(VERSION + '-posters');
        const old = await cache.match(req);
        if (old) return old;
        try {
          const r = await fetch(req);
          if (r.ok || r.type === 'opaque') {
            await cache.put(req, r.clone());
            const keys = await cache.keys();
            if (keys.length > 500) await cache.delete(keys[0]);
          }
          return r;
        } catch {
          return Response.error();
        }
      })(),
    );
  }
});
