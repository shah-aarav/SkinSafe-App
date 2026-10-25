const CACHE = 'skincheck-shell-v1';
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const response = await fetch('/', {cache:'reload'});
    const html = await response.text();
    const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map(match => match[1]);
    await cache.put('/', new Response(html, {headers:{'Content-Type':'text/html'}}));
    await cache.addAll(['/manifest.webmanifest','/icon.svg','/icon-192.png','/icon-512.png', ...assets]);
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.startsWith('skincheck-shell-') && key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  event.respondWith((async () => {
    if (event.request.mode === 'navigate') {
      try { return await fetch(event.request); } catch { return await caches.match('/') || Response.error(); }
    }
    return await caches.match(event.request) || fetch(event.request);
  })());
});
