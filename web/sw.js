// The site opens from the device: the page and the article texts are kept here and served at once,
// without asking the server first. Each deploy has its own version: it is fetched in the background
// on a visit and takes over from the next one.
const V = '__VERSION__';
const ASSETS = __ASSETS__;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(V).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // the film's music streams (range requests), it is not kept
  if (e.request.method !== 'GET' || url.origin !== location.origin || /^\/(api|media)\//.test(url.pathname)) return;
  // the presentation at / (and /index.html), the reader at /read (and /app.html), the film at /film.html
  const p = url.pathname;
  const page = p === '/' || p === '/index.html' ? '/' : p === '/read' || p === '/app.html' ? '/read' : p;
  const key = e.request.mode === 'navigate' || /^\/(index|app)\.html$/.test(url.pathname) ? page : url.pathname;
  e.respondWith(
    caches.open(V).then(async (c) => {
      const hit = await c.match(key);
      if (hit) return hit;
      const r = await fetch(e.request);
      if (r.ok) c.put(key, r.clone());
      return r;
    }),
  );
});
