// ==========================================
// MODAIS GENÉRICOS (abrir/fechar, confirmação, prompt)
// ==========================================
// Utilitários de modal reutilizados por vários módulos de funcionalidade
// (auth, encarregados, lançamentos). Não conhece nada sobre o que cada
// modal específico faz — só cuida de abrir/fechar, foco e a tecla Escape.

// Registro dos modais abertos, na ordem de abertura, para dar suporte a
// fechar com Escape e restaurar o foco ao elemento que abriu o modal.
const modaisAbertos = new Map(); // modalId -> { contentId, prevFocus, hideTimer }

const primeiroFocavel = (container) =>
  container.querySelector(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  );

export const abrirModal = (modalId, contentId, callback) => {
  const modal = document.getElementById(modalId);
  const content = document.getElementById(contentId);
  if (!modal || !content) return;

  const registro = modaisAbertos.get(modalId);
  if (registro?.hideTimer) clearTimeout(registro.hideTimer);

  content.setAttribute("role", "dialog");
  content.setAttribute("aria-modal", "true");
  modaisAbertos.set(modalId, {
    contentId,
    prevFocus:
      registro?.prevFocus ||
      (document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null),
    hideTimer: null,
  });

  modal.classList.remove("hidden");
  requestAnimationFrame(() => {
    modal.classList.remove("opacity-0");
    content.classList.remove("scale-95");
    (primeiroFocavel(content) || content).focus?.();
    if (typeof callback === "function") callback();
  });
};

export const fecharModal = (modalId, contentId) => {
  const modal = document.getElementById(modalId);
  const content = document.getElementById(contentId);
  if (!modal || !content) return;
  modal.classList.add("opacity-0");
  content.classList.add("scale-95");

  const registro = modaisAbertos.get(modalId);
  if (registro?.hideTimer) clearTimeout(registro.hideTimer);
  const hideTimer = setTimeout(() => {
    modal.classList.add("hidden");
    modaisAbertos.delete(modalId);
  }, 300);
  modaisAbertos.set(modalId, {
    contentId,
    prevFocus: registro?.prevFocus || null,
    hideTimer,
  });

  if (registro?.prevFocus?.isConnected) registro.prevFocus.focus();
};

// Fecha o modal aberto mais recentemente ao pressionar Escape.
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape" || modaisAbertos.size === 0) return;
  const ids = [...modaisAbertos.keys()];
  const modalId = ids[ids.length - 1];
  const registro = modaisAbertos.get(modalId);
  if (registro) fecharModal(modalId, registro.contentId);
});

// ---- Diálogo de confirmação genérico ----
let acaoPendenteModal = null;

export const abrirModalConfirmacao = (
  titulo,
  mensagem,
  onConfirm,
  txtBotao = "Confirmar",
) => {
  document.getElementById("modal-titulo").innerText = titulo;
  document.getElementById("modal-mensagem").innerText = mensagem;
  const btnModal = document.getElementById("btn-modal-confirmar");
  if (btnModal) btnModal.innerText = txtBotao;
  acaoPendenteModal = onConfirm;
  abrirModal("modal-confirmacao", "modal-confirmacao-content");
};

export const fecharModalConfirmacao = () => {
  fecharModal("modal-confirmacao", "modal-confirmacao-content");
  acaoPendenteModal = null;
};

export const confirmarModalConfirmacao = () => {
  if (acaoPendenteModal) acaoPendenteModal();
  fecharModalConfirmacao();
};

// ---- Prompt genérico de texto livre ----
export const abrirModalPrompt = () => {
  const input = document.getElementById("input-modal-prompt");
  input.value = "";
  abrirModal("modal-prompt", "modal-prompt-content", () => input.focus());
};

export const fecharModalPrompt = () => {
  fecharModal("modal-prompt", "modal-prompt-content");
};
