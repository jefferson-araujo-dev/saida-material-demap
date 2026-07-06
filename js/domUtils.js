/**
 * @file Módulo de utilitários gerais de DOM e tratamento de erros.
 */

import { showToast } from "./ui.js";

// ==========================================
// CACHE DE DOM
// ==========================================
export const DOM = {
  grid: document.getElementById("grid-lancamentos"),
  tabInfo: document.getElementById("tabela-info"),
  pagInfo: document.getElementById("tabela-paginacao-info"),
  btnPrev: document.getElementById("btn-prev-page"),
  btnNext: document.getElementById("btn-next-page"),
  // Elementos do formulário de lançamento
  inputData: document.getElementById("input-data"),
  inputCodigo: document.getElementById("input-codigo"),
  inputMaterial: document.getElementById("input-material"),
  inputQuantidade: document.getElementById("input-quantidade"),
  selectEncarregado: document.getElementById("select-encarregado"),
  badgeEncontrado: document.getElementById("badge-encontrado"),
  btnSubmit: document.getElementById("btn-submit"),
  statusForm: document.getElementById("status-form"),
  formLancamento: document.getElementById("form-lancamento"),
  // Elementos de filtro e busca
  searchInput: document.getElementById("input-search"),
  btnClearSearch: document.getElementById("btn-clear-search"),
  ordenacaoSelect: document.getElementById("select-ordenacao"),
  filtroEncarregadoSelect: document.getElementById("select-filtro-encarregado"),
  filtroStatusSelect: document.getElementById("select-filtro-status"),
  inputDataInicio: document.getElementById("input-data-de"),
  inputDataFim: document.getElementById("input-data-ate"),
};

// ==========================================
// UTILITÁRIOS GERAIS
// ==========================================

const SVG_ICONS = {
  check: '<path d="m20 6-11 11-4-4" />',
  xmark: '<path d="M18 6 6 18M6 6l12 12" />',
  info: '<circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" />',
  spinner: '<path d="M21 12a9 9 0 1 1-6.219-8.56" />',
  folder:
    '<path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2z" />',
  checkDouble:
    '<path d="m18 6-7.5 7.5L7 10" /><path d="m22 10-7.5 7.5L13 16" />',
  clock:
    '<circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />',
  calendar:
    '<rect width="18" height="18" x="3" y="4" rx="2" ry="2" /><line x1="16" x2="16" y1="2" y2="6" /><line x1="8" x2="8" y1="2" y2="6" /><line x1="3" x2="21" y1="10" y2="10" />',
  layer:
    '<polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" />',
  trash:
    '<path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />',
};

/**
 * Gera o markup SVG para um ícone.
 * @param {string} name - O nome do ícone (chave em SVG_ICONS).
 * @param {string} [classes="w-4 h-4"] - Classes CSS para o elemento SVG.
 * @returns {string} O HTML do SVG.
 */
export function svgIcon(name, classes = "w-4 h-4") {
  const iconPath = SVG_ICONS[name] || "";
  return `<svg class="${classes}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPath}</svg>`;
}

export const escapeHTML = (str) => {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

export const debounce = (func, wait) => {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

export const formatarDataParaDisplay = (valor) => {
  if (!valor) return "";
  const texto = String(valor);
  return texto.includes("-") ? texto.split("-").reverse().join("/") : texto;
};

export const atualizarTextoSeExiste = (id, valor) => {
  const el = document.getElementById(id);
  if (el) el.textContent = valor;
};

export const formatarNome = (nome) => {
  const n = String(nome).toLowerCase().trim();
  if (n.includes("francisco gustavo")) return "Gustavo";
  if (n.includes("francisco antônio") || n.includes("francisco antonio"))
    return "Toinho";
  if (n.includes("cordeiro")) return "Samambaia";
  if (n.includes("galdino")) return "Neto";
  if (n.includes("valdene")) return "Valdene";
  if (n.includes("willian")) return "Willian";
  return nome.split(" ")[0]; // Padrão: usa a primeira palavra
};

// ==========================================
// TRATAMENTO DE ERROS FIREBASE
// ==========================================
export const obterMensagemErroFirebase = (
  error,
  fallback = "Não foi possível concluir a operação.",
) => {
  const code = error?.code || "";
  const msg = error?.message || "";
  const mapa = {
    "auth/invalid-credential":
      "Credenciais inválidas. Verifique e-mail e senha.",
    "auth/user-not-found": "Nenhum usuário encontrado com esse e-mail.",
    "auth/wrong-password": "Senha incorreta. Tente novamente.",
    "auth/email-already-in-use": "Este e-mail já está cadastrado.",
    "auth/too-many-requests":
      "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
    "auth/network-request-failed":
      "Sem conexão com a internet. Verifique sua rede.",
    "permission-denied": "Você não tem permissão para executar esta ação.",
    unavailable:
      "O serviço está temporariamente indisponível. Tente novamente mais tarde.",
  };
  if (mapa[code]) return mapa[code];
  if (/offline|network|fetch/i.test(msg))
    return "Sem conexão com a internet. Verifique sua rede.";
  if (/permission|denied/i.test(msg))
    return "Você não tem permissão para executar esta ação.";
  return fallback;
};

export const mostrarErroFirebase = (
  error,
  fallback = "Não foi possível concluir a operação.",
) => {
  const mensagem = obterMensagemErroFirebase(error, fallback);
  showToast(mensagem, "error");
  return mensagem;
};

// ==========================================
// SKELETONS DE CARREGAMENTO
// ==========================================
export const renderizarSkeletonTabela = () => {
  if (!DOM.grid) return;
  DOM.grid.innerHTML = `
    <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col gap-5 animate-pulse">
      <div class="flex justify-between gap-4">
        <div class="flex-1 space-y-3"><div class="h-4 bg-slate-200 rounded w-3/4"></div><div class="h-4 bg-slate-200 rounded w-1/2"></div></div>
        <div class="h-14 w-14 bg-slate-200 rounded-2xl"></div>
      </div>
      <div class="border-t border-slate-100"></div>
      <div class="space-y-4"><div class="flex justify-between"><div class="h-3 bg-slate-200 rounded w-20"></div><div class="h-3 bg-slate-200 rounded w-24"></div></div></div>
    </div>
    <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col gap-5 animate-pulse">
      <div class="flex justify-between gap-4">
        <div class="flex-1 space-y-3"><div class="h-4 bg-slate-200 rounded w-3/4"></div><div class="h-4 bg-slate-200 rounded w-1/2"></div></div>
        <div class="h-14 w-14 bg-slate-200 rounded-2xl"></div>
      </div>
      <div class="border-t border-slate-100"></div>
      <div class="space-y-4"><div class="flex justify-between"><div class="h-3 bg-slate-200 rounded w-20"></div><div class="h-3 bg-slate-200 rounded w-24"></div></div></div>
    </div>
    <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col gap-5 animate-pulse">
      <div class="flex justify-between gap-4">
        <div class="flex-1 space-y-3"><div class="h-4 bg-slate-200 rounded w-3/4"></div><div class="h-4 bg-slate-200 rounded w-1/2"></div></div>
        <div class="h-14 w-14 bg-slate-200 rounded-2xl"></div>
      </div>
      <div class="border-t border-slate-100"></div>
      <div class="space-y-4"><div class="flex justify-between"><div class="h-3 bg-slate-200 rounded w-20"></div><div class="h-3 bg-slate-200 rounded w-24"></div></div></div>
    </div>`;
  if (DOM.tabInfo) DOM.tabInfo.textContent = "Carregando registros...";
  if (DOM.pagInfo) DOM.pagInfo.textContent = "—";
  if (DOM.btnPrev) DOM.btnPrev.disabled = true;
  if (DOM.btnNext) DOM.btnNext.disabled = true;
};

export const renderizarSkeletonDashboard = () => {
  const dashboardContent = document.getElementById("dashboard-content");
  const dashboardSkeleton = document.getElementById("dashboard-skeleton");
  if (dashboardContent) dashboardContent.classList.add("hidden");
  if (dashboardSkeleton) dashboardSkeleton.classList.remove("hidden");
};

export const esconderSkeletonDashboard = () => {
  const dashboardContent = document.getElementById("dashboard-content");
  const dashboardSkeleton = document.getElementById("dashboard-skeleton");
  if (dashboardContent) dashboardContent.classList.remove("hidden");
  if (dashboardSkeleton) dashboardSkeleton.classList.add("hidden");
};