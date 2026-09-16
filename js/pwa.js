// ==========================================
// SERVICE WORKER (PWA INSTALÁVEL)
// ==========================================
// Service worker escrito à mão (public/sw.js). Não usamos vite-plugin-pwa
// para evitar dois service workers concorrentes.
import { showToast } from "./ui.js";

const mostrarBannerAtualizacaoPWA = (registration) => {
  if (document.getElementById("pwa-update-banner")) return;
  const banner = document.createElement("div");
  banner.id = "pwa-update-banner";
  banner.className =
    "fixed bottom-4 right-4 z-[80] max-w-sm rounded-2xl border border-brand-200 bg-white/95 p-4 shadow-2xl shadow-slate-900/10 backdrop-blur";
  banner.innerHTML = `
      <div class="flex items-start gap-3">
        <div class="rounded-xl bg-brand-50 p-2 text-brand-600">
          <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M12 3v10" />
            <path d="M8 9l4 4 4-4" />
            <path d="M5 15v3h14v-3" />
          </svg>
        </div>
        <div class="flex-1">
          <p class="text-sm font-bold text-slate-800">Nova versão disponível</p>
          <p class="mt-1 text-xs text-slate-500">A atualização foi baixada e está pronta para ser aplicada.</p>
          <div class="mt-3 flex gap-2">
            <button id="btn-aplicar-atualizacao" class="rounded-xl bg-brand-600 px-3 py-2 text-xs font-semibold text-white">Atualizar agora</button>
            <button id="btn-fechar-atualizacao" class="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600">Depois</button>
          </div>
        </div>
      </div>`;
  document.body.appendChild(banner);
  document
    .getElementById("btn-aplicar-atualizacao")
    .addEventListener("click", () => {
      if (registration?.waiting) {
        registration.waiting.postMessage({ type: "SKIP_WAITING" });
        showToast("Atualização iniciada. Recarregando...", "success");
        setTimeout(() => window.location.reload(), 600);
      }
    });
  document
    .getElementById("btn-fechar-atualizacao")
    .addEventListener("click", () => banner.remove());
};

export function registrarServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        if (registration.waiting) {
          mostrarBannerAtualizacaoPWA(registration);
        }
        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          if (!worker) return;
          worker.addEventListener("statechange", () => {
            if (
              worker.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              mostrarBannerAtualizacaoPWA(registration);
            }
          });
        });
      })
      .catch(() => undefined);

    let isRefreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!isRefreshing) {
        isRefreshing = true;
        window.location.reload();
      }
    });
  });
}
