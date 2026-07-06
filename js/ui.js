/**
 * @file Módulo de utilitários de interface (UI).
 * Contém funções para manipulação de DOM, componentes visuais e interações do usuário.
 */

import { svgIcon } from "./domUtils.js"; // Importa svgIcon de domUtils

// ==========================================
// 1. CONSTANTES E CONFIGURAÇÕES
// ==========================================

const PAGE_TITLES = {
  dashboard: "Painel Gerencial",
  lancamentos: "Controle de Lançamentos",
};

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
