const CACHE_NAME = "moviedrift-cache-v3"; // increment version
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./img/logo.png"
];

// Optional: additional assets to cache slowly in the background
const ASSETS_TO_CACHE_LATER = [
  "./css/styles.css",
  "./js/app.js",
  "./img/banner1.jpg",
  "./img/banner2.jpg"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Cache only core assets first (fast)
      return cache.addAll(CORE_ASSETS);
    })
  );
  self.skipWaiting(); // activate immediately
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
  clients.claim(); // take control immediately

  // Cache additional assets slowly in the background
  caches.open(CACHE_NAME).then(cache => {
    ASSETS_TO_CACHE_LATER.forEach((url, index) => {
      setTimeout(() => {
        fetch(url)
          .then(resp => cache.put(url, resp))
          .catch(err => console.warn("Background cache failed:", url, err));
      }, index * 1500); // stagger requests 1.5s apart
    });
  });
});

// 🔥 IMPORTANT: allow page to tell SW to skip waiting
self.addEventListener("message", event => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", event => {
  const url = event.request.url;

  // Network-first for main HTML
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

  // Cache-first for other requests
  event.respondWith(
    caches.match(event.request).then(response => {
      return (
        response ||
        fetch(event.request).then(networkResponse => {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return networkResponse;
        })
      );
    })
  );
});
