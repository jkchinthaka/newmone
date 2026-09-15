/**
 * Phase 2 service worker — conservative caching.
 *
 * Intentionally does NOT cache:
 * - /api/* or authenticated API payloads (stale maintenance data is dangerous)
 * - HTML navigations of the authenticated app shell (prefer fresh SSR/RSC)
 * - tokens / credentials (never stored here)
 *
 * Safe to cache: static PWA shell assets, icons, immutable /_next/static build chunks.
 */
const STATIC_CACHE = "maintainpro-static-v3";
const RUNTIME_CACHE = "maintainpro-runtime-v3";

const APP_SHELL = [
  "/offline.html",
  "/manifest.webmanifest",
  "/favicon.svg",
  "/pwa-192x192.svg",
  "/pwa-512x512.svg"
];

function isImmutableBuildAsset(pathname) {
  return pathname.startsWith("/_next/static/") || pathname.startsWith("/_next/image/");
}

function isNavigationRequest(request) {
  return request.mode === "navigate" || request.headers.get("sec-fetch-mode") === "navigate";
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== STATIC_CACHE && key !== RUNTIME_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);
  // Never intercept API — authenticated operational data must stay network-fresh.
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) {
    return;
  }

  if (isImmutableBuildAsset(url.pathname)) {
    event.respondWith(
      caches.open(RUNTIME_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) {
          return cached;
        }
        const response = await fetch(request);
        if (response.ok) {
          void cache.put(request, response.clone());
        }
        return response;
      }).catch(async () => {
        const cached = await caches.match(request);
        if (cached) {
          return cached;
        }
        throw new Error(`Build asset unavailable: ${url.pathname}`);
      })
    );
    return;
  }

  if (isNavigationRequest(request)) {
    // Network-first; do not put authenticated HTML documents into cache.
    event.respondWith(
      fetch(request).catch(async () => {
        return (await caches.match("/offline.html")) || Response.error();
      })
    );
    return;
  }

  // Public static assets under /public (icons, offline.html, etc.)
  if (
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".ico") ||
    url.pathname.endsWith(".webmanifest") ||
    url.pathname === "/offline.html"
  ) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) {
          return cached;
        }
        const response = await fetch(request);
        if (response.ok) {
          void cache.put(request, response.clone());
        }
        return response;
      }).catch(() => caches.match(request))
    );
  }
});
