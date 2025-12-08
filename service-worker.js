self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open("moviedrift-cache").then((cache) => {
      return cache.addAll([
        "./",
        "./index.html",
        "./img/logo.png"
      ]);
    })
  );
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
