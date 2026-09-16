// ==========================================
// PONTO DE ENTRADA DA APLICAÇÃO
// ==========================================
// Este arquivo só orquestra: importa os módulos de funcionalidade (cada um
// registra seus próprios listeners e roda sua própria inicialização ao ser
// importado) e liga a delegação de eventos central baseada em [data-action].
// A lógica de cada área do sistema vive no módulo correspondente:
//   auth.js          — login, logout, perfil
//   notificacoes.js  — sino de notificações
//   encarregados.js  — lista de responsáveis
//   base.js          — base de materiais (código → nome)
//   lancamentos.js   — CRUD/grade/filtros/paginação/exportação
//   dashboard.js     — cartões e gráficos do painel
//   modal.js         — abrir/fechar modal, confirmação e prompt genéricos
//   pwa.js           — atualização do service worker
import { setGreeting, toggleDropdown, showToast, switchTab } from "./ui.js";
import {
  abrirModalPrompt,
  fecharModalPrompt,
  fecharModalConfirmacao,
  confirmarModalConfirmacao,
} from "./modal.js";
import {
  logout,
  abrirModalPerfil,
  fecharModalPerfil,
  salvarPerfil,
  enviarEmailTrocaSenha,
  loginAnonimo,
} from "./auth.js";
import { toggleNotifications, limparNotificacoes } from "./notificacoes.js";
import {
  confirmarModalPrompt,
  removerEncarregadoSelecionado,
} from "./encarregados.js";
import {
  abrirModalConfiguracoes,
  fecharModalConfiguracoes,
  salvarConfiguracoes,
  abrirModalExportacao,
  confirmarExportacao,
  fecharModalExportacao,
  limparFiltros,
  mudarPagina,
  carregarMaisLancamentos,
  toggleBaixa,
  deletarLancamento,
  abrirModalEdicao,
  fecharModalEdicao,
  salvarEdicao,
} from "./lancamentos.js";
import { renderizarGraficosPendentes } from "./dashboard.js";
import { registrarServiceWorker } from "./pwa.js";

setGreeting();

// ==========================================
// DELEGAÇÃO DE EVENTOS (substitui onclicks globais)
// ==========================================
document.addEventListener("click", (e) => {
  const actionEl = e.target.closest("[data-action]");
  if (!actionEl) return;

  const action = actionEl.getAttribute("data-action");
  switch (action) {
    case "toggle-dropdown":
      toggleDropdown();
      break;
    case "toggle-notifications":
      toggleNotifications();
      break;
    case "limpar-notificacoes":
      limparNotificacoes();
      break;
    case "logout":
      logout();
      break;
    case "abrir-perfil":
      abrirModalPerfil();
      break;
    case "fechar-perfil":
      fecharModalPerfil();
      break;
    case "salvar-perfil":
      salvarPerfil();
      break;
    case "trocar-senha":
      enviarEmailTrocaSenha();
      break;
    case "abrir-configuracoes":
      abrirModalConfiguracoes();
      break;
    case "fechar-configuracoes":
      fecharModalConfiguracoes();
      break;
    case "salvar-configuracoes":
      salvarConfiguracoes();
      break;
    case "exportar-excel":
      abrirModalExportacao();
      break;
    case "confirmar-exportacao":
      confirmarExportacao();
      break;
    case "fechar-exportacao":
      fecharModalExportacao();
      break;
    case "abrir-prompt":
      abrirModalPrompt();
      break;
    case "fechar-prompt":
      fecharModalPrompt();
      break;
    case "confirmar-prompt":
      confirmarModalPrompt();
      break;
    case "remover-encarregado":
      removerEncarregadoSelecionado();
      break;
    case "fechar-confirmacao":
      fecharModalConfirmacao();
      break;
    case "confirmar-acao":
      confirmarModalConfirmacao();
      break;
    case "toggle-password": {
      const input = document.getElementById("login-password");
      const icon = document.getElementById("icon-password-toggle");
      if (input && icon) {
        if (input.type === "password") {
          input.type = "text";
          icon.setAttribute("href", "#icon-eye-slash");
        } else {
          input.type = "password";
          icon.setAttribute("href", "#icon-eye");
        }
      }
      break;
    }
    case "login-anonimo":
      loginAnonimo();
      break;
    case "limpar-filtros":
      limparFiltros();
      break;
    case "mudar-pagina":
      mudarPagina(parseInt(actionEl.getAttribute("data-dir"), 10));
      break;
    case "carregar-mais-lancamentos":
      carregarMaisLancamentos();
      break;
    case "show-toast":
      showToast(
        actionEl.getAttribute("data-message"),
        actionEl.getAttribute("data-type"),
      );
      break;
    case "toggle-baixa": {
      const rawId = actionEl.getAttribute("data-id");
      const parsedId = rawId.startsWith("[")
        ? JSON.parse(rawId.replace(/'/g, '"'))
        : rawId;
      toggleBaixa(parsedId, actionEl.getAttribute("data-status"));
      break;
    }
    case "deletar-lancamento":
      deletarLancamento(actionEl.getAttribute("data-id"));
      break;
    case "abrir-modal-edicao":
      abrirModalEdicao(actionEl.getAttribute("data-id"));
      break;
    case "fechar-modal-edicao":
      fecharModalEdicao();
      break;
    case "salvar-edicao":
      salvarEdicao();
      break;
  }
});

// Função para lidar com a troca de abas
const onTabSwitch = (tabId) => {
  switchTab(tabId); // Chama a função original de ui.js

  // Se a aba do dashboard for ativada e houver dados de gráfico pendentes,
  // renderiza os gráficos agora (Chart.js não desenha bem em canvas oculto).
  if (tabId === "dashboard") renderizarGraficosPendentes();
};

// Adiciona o listener para os botões de aba
document.querySelectorAll('[data-action="switch-tab"]').forEach((btn) => {
  btn.addEventListener("click", () =>
    onTabSwitch(btn.getAttribute("data-tab")),
  );
});

// Fecha o menu suspenso ao clicar fora dele
document.addEventListener("click", (e) => {
  const dropdown = document.getElementById("user-dropdown");
  if (dropdown) {
    const isClickInside =
      e.target.closest("#user-dropdown") ||
      e.target.closest('[data-action="toggle-dropdown"]');
    if (!isClickInside && !dropdown.classList.contains("opacity-0")) {
      toggleDropdown();
    }
  }

  const notifDropdown = document.getElementById("notifications-dropdown");
  if (notifDropdown) {
    const isClickInsideNotif =
      e.target.closest("#notifications-dropdown") ||
      e.target.closest('[data-action="toggle-notifications"]');
    if (!isClickInsideNotif && !notifDropdown.classList.contains("opacity-0")) {
      toggleNotifications();
    }
  }
});

registrarServiceWorker();
