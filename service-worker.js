const CACHE_NAME = "moviedrift-cache-v2"; // increment this when you update files

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
  self.skipWaiting(); // activate new SW immediately
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      );
    })
  );
  clients.claim(); // control pages immediately
});

self.addEventListener("fetch", event => {
  // Network-first for HTML pages
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request)) // fallback to cache
    );
    return;
  }

  // Cache-first for everything else
  event.respondWith(
    caches.match(event.request).then(response => {
      return (
        response ||
        fetch(event.request).then(networkResponse => {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache =>
            cache.put(event.request, clone)
          );
          return networkResponse;
        })
      );
    })
  );
});
