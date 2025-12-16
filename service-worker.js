const CACHE_NAME = "moviedrift-cache-v3"; // increment version
const TMDB_CACHE = "tmdb-cache-v1"; // cache for TMDB API
const TMDB_QUEUE = []; // queue for incremental updates

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
  if (event.data && event.data.type === "QUEUE_TMDB") {
    TMDB_QUEUE.push(...event.data.urls);
    processQueue();
  }
});

let isProcessing = false;

// Process the queue one at a time
async function processQueue() {
  if (isProcessing || TMDB_QUEUE.length === 0) return;
  isProcessing = true;

  const url = TMDB_QUEUE.shift();
  try {
    const response = await fetch(url);
    const clone = response.clone();
    const cache = await caches.open(TMDB_CACHE);
    await cache.put(url, clone);

    // Notify clients that this item has new data
    const clientsList = await self.clients.matchAll();
    clientsList.forEach(client =>
      client.postMessage({ type: "NEW_TMDB_ITEM", url })
    );
  } catch (e) {
    console.warn("Failed to update TMDB item", url, e);
  } finally {
    isProcessing = false;
    if (TMDB_QUEUE.length > 0) {
      // Process the next item
      processQueue();
    }
  }
}

self.addEventListener("fetch", event => {
  const url = event.request.url;

  // TMDB API requests → network-first + cache
  if (url.includes("api.themoviedb.org")) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        const fetchPromise = fetch(event.request)
          .then(response => {
            const clone = response.clone();
            caches.open(TMDB_CACHE).then(cache => cache.put(event.request, clone));
            return response;
          })
          .catch(() => cached || Promise.reject("No cache or network"));

        // Serve cached first if exists
        return cached || fetchPromise;
      })
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
