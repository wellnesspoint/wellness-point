/*
 * Wellness Point service worker: deliberately small and conservative.
 *
 *  - Pages are always fetched from the network (never served from cache), so
 *    prices, stock and logins are never stale. Only when the network fails does
 *    the visitor get the /offline page instead of the browser's error screen.
 *  - Hashed build files (/_next/static) and icons are cached for speed.
 *  - Never touches APIs, the admin panel, checkout/payments, non-GET requests or
 *    other origins (Razorpay, Cloudinary...).
 *
 * Bump VERSION to drop old caches.
 */
const VERSION = "v1";
const STATIC_CACHE = `wp-static-${VERSION}`;
const OFFLINE_URL = "/offline";
const PRECACHE = [OFFLINE_URL, "/icon-192x192.png", "/icon-512x512.png", "/favicon-32x32.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("wp-") && k !== STATIC_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const NEVER = ["/api/", "/admin", "/checkout", "/order-confirmation", "/_next/image", "/_next/data"];

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (NEVER.some((p) => url.pathname.startsWith(p))) return;

  // Page loads: network first, offline page only if the network fails.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() =>
        caches.match(OFFLINE_URL).then(
          (res) => res || new Response("You are offline.", { status: 503, headers: { "Content-Type": "text/plain" } })
        )
      )
    );
    return;
  }

  // Hashed build assets never change: cache first.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(STATIC_CACHE).then((c) => c.put(req, copy));
            }
            return res;
          })
      )
    );
    return;
  }

  // Icons and other small public files: serve cached copy, refresh in the background.
  if (/\.(?:png|jpg|jpeg|svg|webp|ico|woff2?)$/i.test(url.pathname)) {
    event.respondWith(
      caches.open(STATIC_CACHE).then((cache) =>
        cache.match(req).then((hit) => {
          const refresh = fetch(req)
            .then((res) => {
              if (res.ok) cache.put(req, res.clone());
              return res;
            })
            .catch(() => hit);
          return hit || refresh;
        })
      )
    );
  }
});
