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
const STATIC_CACHE = "maintainpro-static-v4";
const RUNTIME_CACHE = "maintainpro-runtime-v4";
const IMAGE_CACHE = "maintainpro-images-v4";
/** Every deploy adds new hashed chunks; keep only the newest ones so phones do not fill up. */
const RUNTIME_MAX_ENTRIES = 400;
const IMAGE_MAX_ENTRIES = 150;

const APP_SHELL = [
  "/offline.html",
  "/manifest.webmanifest",
  "/favicon.svg",
  "/pwa-192x192.svg",
  "/pwa-512x512.svg"
];

function isImmutableBuildAsset(pathname) {
  // Hashed file names: a changed file always has a new URL, so cache-first is safe.
  return pathname.startsWith("/_next/static/");
}

function isOptimizedImage(pathname) {
  // Same URL can return a newer picture, so these are refreshed in the background.
  return pathname === "/_next/image" || pathname.startsWith("/_next/image/");
}

/** Oldest entries go first (cache keys keep insertion order). */
async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  const extra = keys.length - maxEntries;
  for (let index = 0; index < extra; index += 1) {
    await cache.delete(keys[index]);
  }
}

/** Serve the cached copy now and update it from the network for next time. */
function staleWhileRevalidate(event, cacheName, maxEntries) {
  const { request } = event;
  event.respondWith(
    caches.open(cacheName).then(async (cache) => {
      const cached = await cache.match(request);
      const network = fetch(request)
        .then((response) => {
          if (response.ok) {
            void cache.put(request, response.clone()).then(() => (maxEntries ? trimCache(cacheName, maxEntries) : undefined));
          }
          return response;
        })
        .catch(() => cached);
      if (cached) {
        event.waitUntil(network.then(() => undefined));
        return cached;
      }
      const response = await network;
      return response || Response.error();
    })
  );
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
            .filter((key) => key !== STATIC_CACHE && key !== RUNTIME_CACHE && key !== IMAGE_CACHE)
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
          event.waitUntil(cache.put(request, response.clone()).then(() => trimCache(RUNTIME_CACHE, RUNTIME_MAX_ENTRIES)));
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

  if (isOptimizedImage(url.pathname)) {
    staleWhileRevalidate(event, IMAGE_CACHE, IMAGE_MAX_ENTRIES);
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

  // Public static assets under /public (icons, offline.html, etc.): shown from cache, refreshed in
  // the background so a changed logo or icon appears on the next visit without a version bump.
  if (
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".ico") ||
    url.pathname.endsWith(".webmanifest") ||
    url.pathname === "/offline.html"
  ) {
    staleWhileRevalidate(event, STATIC_CACHE, 0);
  }
});
