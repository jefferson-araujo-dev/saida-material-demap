/**
 * @file Módulo de utilitários de interface (UI).
 * Contém funções para manipulação de DOM, componentes visuais e interações do usuário.
 */

// ==========================================
// 1. CONSTANTES E CONFIGURAÇÕES
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
  userTie:
    '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />',
  usersGear:
    '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />',
  layer:
    '<polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" />',
  trash:
    '<path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />',
  bars: '<line x1="4" x2="20" y1="12" /><line x1="4" x2="20" y1="6" /><line x1="4" x2="20" y1="18" />',
  plus: '<line x1="12" x2="12" y1="5" y2="19" /><line x1="5" x2="19" y1="12" />',
};

const PAGE_TITLES = {
  dashboard: "Painel Gerencial",
  lancamentos: "Controle de Lançamentos",
};

// ==========================================
// 2. RENDERIZAÇÃO DE COMPONENTES
// ==========================================

/**
 * Gera o markup SVG para um ícone.
 * @param {string} name - O nome do ícone (chave em SVG_ICONS).
 * @param {string} [classes="w-4 h-4"] - Classes CSS para o elemento SVG.
 * @param {string} [attrs=""] - Atributos adicionais para o elemento SVG.
 * @returns {string} O HTML do SVG.
 */
export function svgIcon(name, classes = "w-4 h-4", attrs = "") {
  const iconPath = SVG_ICONS[name] || "";
  return `<svg class="${classes}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${attrs}>${iconPath}</svg>`;
}

// ==========================================
// 3. MANIPULAÇÃO DE ESTADO DA UI
// ==========================================

/**
 * Define a mensagem de saudação no cabeçalho com base na hora do dia.
 */
export const setGreeting = () => {
  const hour = new Date().getHours();
  const greetingElement = document.getElementById("page-greeting");
  if (!greetingElement) return;

  let message;
  if (hour < 12) {
    message = "Bom dia. Pronto para otimizar as movimentações de hoje?";
  } else if (hour < 18) {
    message = "Boa tarde. Acompanhe as saídas de materiais em tempo real.";
  } else {
    message =
      "Boa noite. O fechamento diário dos lançamentos está consolidado.";
  }
  greetingElement.textContent = message;
};

// ==========================================
// 4. COMPONENTES INTERATIVOS
// ==========================================

/**
 * Alterna a visibilidade da barra lateral e da sobreposição.
 */
export function toggleSidebar() {
  document.getElementById("sidebar")?.classList.toggle("-translate-x-full");
  const overlay = document.getElementById("sidebar-overlay");
  overlay?.classList.toggle("opacity-0");
  overlay?.classList.toggle("pointer-events-none");
}

/**
 * Fecha a barra lateral se a tela for de um dispositivo móvel.
 */
export function closeSidebarOnMobile() {
  if (window.innerWidth < 1024) {
    document.getElementById("sidebar")?.classList.add("-translate-x-full");
    document
      .getElementById("sidebar-overlay")
      ?.classList.add("opacity-0", "pointer-events-none");
  }
}

/**
 * Alterna a visibilidade do menu suspenso do usuário.
 */
export function toggleDropdown() {
  const dropdown = document.getElementById("user-dropdown");
  if (dropdown) {
    dropdown.classList.toggle("opacity-0");
    dropdown.classList.toggle("pointer-events-none");
    dropdown.classList.toggle("scale-95");
  }
}

/**
 * Exibe uma notificação (toast) na tela.
 * @param {string} message - A mensagem a ser exibida.
 * @param {'success'|'error'|'info'} [type='success'] - O tipo de toast.
 */
export function showToast(message, type = "success") {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  const icons = {
    success: `<div class="bg-emerald-100 p-2 rounded-full text-emerald-600">${svgIcon("check")}</div>`,
    error: `<div class="bg-red-100 p-2 rounded-full text-red-600">${svgIcon("xmark")}</div>`,
    info: `<div class="bg-brand-100 p-2 rounded-full text-brand-600">${svgIcon("info")}</div>`,
  };

  toast.className = `toast ${type}`;
  toast.innerHTML = `
    ${icons[type] || icons.info}
    <span class="font-bold text-sm tracking-wide text-slate-700">${message}</span>
    <div class="toast-progress"></div>
  `;

  container.appendChild(toast);

  // Animação de remoção
  setTimeout(() => {
    toast.style.transform = "translateY(20px)";
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 400);
  }, 3000);
}

/**
 * Alterna entre as abas da aplicação (Dashboard e Lançamentos).
 * @param {string} tabId - O ID da aba para ativar ('dashboard' ou 'lancamentos').
 */
export function switchTab(tabId) {
  // Esconde todos os conteúdos de aba
  document
    .querySelectorAll(".tab-content")
    .forEach((tab) => tab.classList.remove("active"));

  // Reseta o estilo de todos os botões de aba
  Object.keys(PAGE_TITLES).forEach((id) => {
    const btn = document.getElementById(`btn-${id}`);
    btn?.classList.remove(
      "bg-brand-600/15",
      "text-brand-400",
      "border-brand-500",
    );
    btn?.classList.add(
      "hover:bg-slate-800",
      "text-slate-400",
      "border-transparent",
    );
  });

  // Ativa a aba e o botão selecionados
  document.getElementById(`tab-${tabId}`)?.classList.add("active");
  const activeBtn = document.getElementById(`btn-${tabId}`);
  activeBtn?.classList.remove(
    "hover:bg-slate-800",
    "text-slate-400",
    "border-transparent",
  );
  activeBtn?.classList.add(
    "bg-brand-600/15",
    "text-brand-400",
    "border-brand-500",
  );

  // Atualiza o título da página
  const pageTitleEl = document.getElementById("page-title");
  if (pageTitleEl && PAGE_TITLES[tabId]) {
    pageTitleEl.innerText = PAGE_TITLES[tabId];
  }

  closeSidebarOnMobile();
}
