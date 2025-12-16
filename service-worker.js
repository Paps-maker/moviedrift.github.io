const CACHE_NAME = "moviedrift-cache-v3"; // increment this when updating
const STATIC_ASSETS = [
  "./",
  "./index.html",
  "./img/logo.png",
  "./style.css",
  "./script.js"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting(); // activate immediately
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      )
    )
  );
  clients.claim(); // take control immediately
});

// 🔥 Allow page to tell SW to skip waiting
self.addEventListener("message", event => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// ---------------- FETCH ----------------
self.addEventListener("fetch", event => {
  const request = event.request;

  // 1️⃣ Network-first for navigation (HTML pages)
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // 2️⃣ Cache-first for static assets
  if (STATIC_ASSETS.includes(new URL(request.url).pathname)) {
    event.respondWith(
      caches.match(request).then(response => response || fetch(request))
    );
    return;
  }

  // 3️⃣ Cache API responses & poster images dynamically
  if (request.url.includes("api.themoviedb.org") || request.url.includes("image.tmdb.org")) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(networkResponse => {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          return networkResponse;
        }).catch(() => cached); // fallback if offline
      })
    );
    return;
  }

  // 4️⃣ Fallback for all other requests (cache-first)
  event.respondWith(
    caches.match(request).then(response => response || fetch(request))
  );
});
