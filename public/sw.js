// Minimal caching service worker for Foreman PWA.
const CACHE_NAME = "foreman-static-v3";
const ASSETS = [
  "/manifest.webmanifest",
  "/favicon.ico",
];

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((key) => (key === CACHE_NAME ? null : caches.delete(key))))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Never intercept API calls or authenticated app routes
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/owner/") ||
    url.pathname.startsWith("/worker/") ||
    url.pathname.startsWith("/portal") ||
    url.pathname.startsWith("/login") ||
    url.pathname.startsWith("/signup")
  ) {
    return;
  }

  // Only cache known static assets (not /_next/static/ — Next.js handles those via HTTP cache headers)
  const isCacheable = ASSETS.includes(url.pathname);

  if (!isCacheable) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((resp) => {
        if (resp.ok) {
          const respClone = resp.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, respClone));
        }
        return resp;
      });
    })
  );
});
