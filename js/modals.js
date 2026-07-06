/**
 * @file Módulo para gerenciamento de modais.
 */

import { showToast } from "./ui.js";
import { DOM, svgIcon } from "./domUtils.js";
import {
  colunasExportacaoMeta,
  colunasExportacaoSelecionadas,
  setColunasExportacaoSelecionadas,
  exportarExcel,
} from "./excel.js"; // encarregados e renderizarSelectEncarregados serão passados pelo app.js
import { salvarEncarregadoNoFirestore } from "./database.js";
import { criarNotificacao } from "./notifications.js";

let acaoPendenteModal = null;

// ==========================================
// FUNÇÕES GENÉRICAS DE MODAL
// ==========================================
export const abrirModal = (modalId, contentId, callback) => {
  const modal = document.getElementById(modalId);
  const content = document.getElementById(contentId);
  if (!modal || !content) return;

  modal.classList.remove("hidden");
  requestAnimationFrame(() => {
    modal.classList.remove("opacity-0");
    content.classList.remove("scale-95");
    if (typeof callback === "function") callback();
  });
};

export const fecharModal = (modalId, contentId) => {
  const modal = document.getElementById(modalId);
  const content = document.getElementById(contentId);
  if (!modal || !content) return;
  modal.classList.add("opacity-0");
  content.classList.add("scale-95");
  setTimeout(() => modal.classList.add("hidden"), 300);
};

// ==========================================
// MODAL DE CONFIRMAÇÃO
// ==========================================
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

// ==========================================
// MODAL DE PROMPT (Adicionar Encarregado)
// ==========================================
export const abrirModalPrompt = () => {
  const input = document.getElementById("input-modal-prompt");
  input.value = "";
  abrirModal("modal-prompt", "modal-prompt-content", () => input.focus());
};

export const fecharModalPrompt = () => {
  fecharModal("modal-prompt", "modal-prompt-content");
};

export const confirmarModalPrompt = async (
  currentUser,
  encarregados,
  renderizarSelectEncarregados,
) => {
  const input = document.getElementById("input-modal-prompt");
  const novoNome = input.value.trim();
  if (novoNome) {
    if (!encarregados.includes(novoNome)) {
      encarregados.push(novoNome); // Atualiza a lista localmente
      renderizarSelectEncarregados();
      DOM.selectEncarregado.value = novoNome;
      showToast(`Encarregado "${novoNome}" adicionado!`, "success");
      criarNotificacao(
        currentUser,
        "Novo Responsável",
        `O encarregado "${novoNome}" foi adicionado.`,
        "info",
      );
      fecharModalPrompt();

      // Salvar na nuvem (Firestore)
      try {
        await salvarEncarregadoNoFirestore(novoNome);
      } catch (e) {
        console.error("Erro ao salvar encarregado no Firestore:", e);
      }
    } else {
      showToast("Este encarregado já existe.", "error");
    }
  } else {
    input.focus();
  }
};

// ==========================================
// MODAL DE EXPORTAÇÃO
// ==========================================
export const abrirModalExportacao = () => {
  const container = document.getElementById("export-columns-list");
  if (!container) return;

  container.innerHTML = "";
  Object.entries(colunasExportacaoMeta).forEach(([key, label]) => {
    const checked = colunasExportacaoSelecionadas.includes(key)
      ? "checked"
      : "";
    container.insertAdjacentHTML(
      "beforeend",
      `
        <label class="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700">
          <input type="checkbox" value="${key}" ${checked} class="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
          <span>${label}</span>
        </label>
      `,
    );
  });

  abrirModal("modal-exportacao", "modal-exportacao-content");
};

export const fecharModalExportacao = () => {
  fecharModal("modal-exportacao", "modal-exportacao-content");
};

export const confirmarExportacao = () => {
  const container = document.getElementById("export-columns-list");
  if (!container) return;
  const selecionadas = Array.from(
    container.querySelectorAll('input[type="checkbox"]:checked'),
  ).map((el) => el.value);
  if (!selecionadas.length) {
    showToast("Selecione ao menos uma coluna para exportar.", "error");
    return;
  }
  setColunasExportacaoSelecionadas(selecionadas); // Atualiza o estado no módulo excel.js
  localStorage.setItem("demap_export_columns", JSON.stringify(selecionadas));
  fecharModalExportacao();
  exportarExcel(); // Chama a função de exportação do módulo excel.js
};
