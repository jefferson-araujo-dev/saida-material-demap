// Service worker escrito à mão para a PWA "Gestão de Materiais | COENG".
//
// Estratégia: não faz precache de bundles com hash (que mudam a cada build).
// - Navegações (HTML): network-first com fallback para o cache -> novas versões
//   entram assim que houver rede, mas o app abre offline.
// - Demais GET (js/css/svg/etc.): stale-while-revalidate -> resposta rápida do
//   cache e atualização em segundo plano.
const CACHE_NAME = "demap-cache-v4";

// Apenas URLs estáveis (sem hash) entram no cache na instalação.
const APP_SHELL = ["/", "/index.html", "/manifest.json", "/assets/favicon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .catch(() => undefined),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((nomes) =>
        Promise.all(
          nomes.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // Só lida com recursos da própria origem. Firebase/Firestore, fontes, etc.
  // seguem direto para a rede.
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((resposta) => {
          const copia = resposta.clone();
          caches
            .open(CACHE_NAME)
            .then((cache) => cache.put("/index.html", copia));
          return resposta;
        })
        .catch(() =>
          caches
            .match(request)
            .then((cached) => cached || caches.match("/index.html")),
        ),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const rede = fetch(request)
        .then((resposta) => {
          if (resposta && resposta.status === 200 && resposta.type === "basic") {
            const copia = resposta.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copia));
          }
          return resposta;
        })
        .catch(() => cached);
      return cached || rede;
    }),
  );
});
