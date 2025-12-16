const CACHE_NAME = "moviedrift-cache-v3"; // increment version
const TMDB_CACHE = "tmdb-cache-v1"; // cache for TMDB API

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll([
        "./",
        "./index.html",
        "./img/logo.png"
      ]);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    Promise.all([
      caches.keys().then(keys => {
        return Promise.all(
          keys.filter(key => key !== CACHE_NAME && key !== TMDB_CACHE)
              .map(key => caches.delete(key))
        );
      }),
      clients.claim()
    ])
  );
});

self.addEventListener("message", event => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", event => {
  const url = event.request.url;

  // TMDB API requests → network-first + cache
  if (url.includes("api.themoviedb.org")) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(TMDB_CACHE).then(cache => cache.put(event.request, clone));
          // Notify clients of new TMDB data
          self.clients.matchAll().then(clients => {
            clients.forEach(client =>
              client.postMessage({ type: "NEW_TMDB_DATA_AVAILABLE" })
            );
          });
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Navigation requests → network-first
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Static assets → cache-first
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request).then(networkResponse => {
        const clone = networkResponse.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return networkResponse;
      });
    })
  );
});
