const CACHE_NAME = "demap-cache-v4";

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

// Estratégia de cache: Stale-While-Revalidate
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Em ambiente de desenvolvimento (localhost), desativa completamente o Service Worker
  // para o evento 'fetch'. Isso evita qualquer problema de cache com Vite e Firebase.
  if (url.hostname === "localhost") {
    return;
  }

  // IMPORTANT: Only cache GET requests.
  if (event.request.method !== "GET") {
    return;
  }

  // IMPORTANT: Do not cache any requests to Google's APIs.
  // This ensures that Firebase Authentication and Firestore can work in real-time
  // without interference from a stale cache.
  if (
    url.hostname.includes("google.com") ||
    url.hostname.includes("googleapis.com")
  ) {
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cachedResponse = await cache.match(event.request);

      const fetchPromise = fetch(event.request).then((networkResponse) => {
        // Se a requisição for bem-sucedida, atualiza o cache com a nova versão
        if (networkResponse.ok) {
          cache.put(event.request, networkResponse.clone());
        }
        return networkResponse;
      });

      // Retorna a resposta do cache imediatamente se existir, senão aguarda a rede.
      // A requisição de rede acontece em paralelo para atualizar o cache.
      return cachedResponse || fetchPromise;
    }),
  );
});
