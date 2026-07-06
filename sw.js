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

// Estratégia de cache: Stale-While-Revalidate
self.addEventListener("fetch", (event) => {
  // Ignora requisições que não são GET (ex: POST para o Firebase)
  if (event.request.method !== "GET") {
    return;
  }

  const url = new URL(event.request.url);

  // Em ambiente de desenvolvimento, ignora as requisições internas do Vite para evitar erros.
  // Isso permite que o Hot Module Replacement (HMR) funcione corretamente.
  const isDev = url.hostname === "localhost";
  if (
    isDev &&
    (url.pathname.startsWith("/@vite/") ||
      url.pathname.startsWith("/node_modules/"))
  ) {
    return; // Deixa o navegador lidar com a requisição normalmente.
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
