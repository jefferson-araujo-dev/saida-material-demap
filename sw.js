const CACHE_NAME = "demap-cache-v3";

const ASSETS_TO_CACHE = [
  "./",
  "./index.html",
  "./css/output.css",
  "./js/app.js",
  "./js/database.js",
  "./js/firebase.js",
  "./js/ui.js",
  "./js/normalizacao.mjs",
  "./assets/favicon.svg",
  "./manifest.json",
];

// Evento de Instalação: Salva os arquivos iniciais
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE)),
  );
  self.skipWaiting();
});

// Evento de Ativação: Limpa caches antigos
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        }),
      );
    }),
  );
  self.clients.claim();
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches
      .match(event.request)
      .then((response) => response || fetch(event.request)),
  );
});
