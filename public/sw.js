const CACHE = 'kotoba-shell-v10';
const DICTIONARIES = 'japanese-dictionaries-v1';
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(['/', '/icon.svg', '/manifest.webmanifest'])));
  self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const dictionary = await caches.open(DICTIONARIES);
    // Dictionary files are versioned independently of the app shell.
    for (const key of await caches.keys()) {
      if (!key.startsWith('kotoba-') || key === CACHE) continue;
      const previous = await caches.open(key);
      for (const request of await previous.keys()) {
        if (!new URL(request.url).pathname.startsWith('/furigana/')) continue;
        const response = await previous.match(request);
        if (response) await dictionary.put(request, response);
      }
      await caches.delete(key);
    }
    await self.clients.claim();
  })());
});
self.addEventListener('message', event => {
  if (event.data?.type !== 'CACHE_ASSETS' || !Array.isArray(event.data.urls)) return;
  const urls = event.data.urls.filter(url => typeof url === 'string' && url.startsWith(self.location.origin + '/_next/static/'));
  event.waitUntil(caches.open(CACHE).then(cache => Promise.allSettled(urls.map(url => cache.add(url)))));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).then(async response => {
      if (response.ok && url.pathname === '/') { const cache = await caches.open(CACHE); await cache.put('/', response.clone()); }
      return response;
    }).catch(async () => (await caches.match('/')) || Response.error()));
  } else if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/furigana/') || url.pathname === '/icon.svg') {
    event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(async response => {
      if (response.ok) { const cache = await caches.open(url.pathname.startsWith('/furigana/') ? DICTIONARIES : CACHE); await cache.put(event.request, response.clone()); }
      return response;
    })));
  }
});
