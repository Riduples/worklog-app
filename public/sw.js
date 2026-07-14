// Shell-only service worker: installability + a graceful offline fallback.
// Deliberately does NOT cache Next.js build output (hashed per-deploy — caching
// it risks serving stale JS/CSS after a redeploy) and never touches /api/* or
// Supabase requests, so financial data is always read fresh from the network.
const CACHE_NAME = "worklog-shell-v1";
const PRECACHE_URLS = ["/offline.html", "/icon.png", "/apple-icon.png", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.pathname.startsWith("/api/") || url.hostname.endsWith(".supabase.co")) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("/offline.html")));
  }
});
