import { auth } from "./firebase.js";
import {
  svgIcon,
  setGreeting,
  toggleSidebar,
  toggleDropdown,
  showToast,
  switchTab,
} from "./ui.js";
import {
  limparNotificacoesNoFirestore,
  criarNotificacaoNoFirestore,
  escutarNotificacoes,
  salvarEncarregadoNoFirestore,
  removerEncarregadoNoFirestore,
  escutarEncarregados,
  fetchBaseDoFirestore,
  salvarBaseNoFirestoreLote,
  adicionarLancamentoNoFirestore,
  deletarLancamentoNoFirestore,
  alternarBaixaNoFirestore,
  salvarLancamentosEmLote,
  escutarLancamentos,
} from "./database.js";

import {
  signInAnonymously,
  signInWithCustomToken,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  updateProfile,
  sendPasswordResetEmail,
} from "firebase/auth";
import {
  Chart,
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from "chart.js";
import * as XLSX from "xlsx";
import {
  normalizarData,
  normalizarLancamentoImportado,
  normalizarTexto,
} from "./normalizacao.mjs";

Chart.register(
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
);

// ==========================================
// 0. ESTADO GLOBAL E UTILITÁRIOS DE INTERFACE
// ==========================================
let chartEnc = null;
let chartMat = null;
let acaoPendenteModal = null;
let pendingChartData = null;
let isLoadingDashboard = true;
let isLoadingTabela = true;
let dadosCarregadosToastMostrado = false;
let colunasExportacaoSelecionadas = [];

// ==========================================
// UTILITÁRIOS DE SEGURANÇA
// ==========================================
const escapeHTML = (str) => {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

// ==========================================
// UTILITÁRIOS DE DESEMPENHO
// ==========================================
const debounce = (func, wait) => {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

// ==========================================
// CACHE DE DOM E AUXILIARES DE DESEMPENHO
// ==========================================
const DOM = {
  grid: document.getElementById("grid-lancamentos"),
  tabInfo: document.getElementById("tabela-info"),
  pagInfo: document.getElementById("tabela-paginacao-info"),
  btnPrev: document.getElementById("btn-prev-page"),
  btnNext: document.getElementById("btn-next-page"),
};

const colunasExportacaoMeta = {
  data: "Data",
  codigo: "Código",
  material: "Material",
  quantidade: "Quantidade",
  encarregado: "Encarregado",
  baixa: "Baixa",
};

const carregarColunasExportacao = () => {
  const salvas = localStorage.getItem("demap_export_columns");
  if (!salvas) {
    colunasExportacaoSelecionadas = Object.keys(colunasExportacaoMeta);
    return;
  }
  try {
    const parsed = JSON.parse(salvas);
    colunasExportacaoSelecionadas =
      Array.isArray(parsed) && parsed.length
        ? parsed.filter((key) =>
            Object.prototype.hasOwnProperty.call(colunasExportacaoMeta, key),
          )
        : Object.keys(colunasExportacaoMeta);
  } catch (error) {
    colunasExportacaoSelecionadas = Object.keys(colunasExportacaoMeta);
  }
};

const formatarDataParaDisplay = (valor) => {
  if (!valor) return "";
  const texto = String(valor);
  return texto.includes("-") ? texto.split("-").reverse().join("/") : texto;
};

const atualizarTextoSeExiste = (id, valor) => {
  const el = document.getElementById(id);
  if (el) el.textContent = valor;
};

const abrirModal = (modalId, contentId, callback) => {
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

const fecharModal = (modalId, contentId) => {
  const modal = document.getElementById(modalId);
  const content = document.getElementById(contentId);
  if (!modal || !content) return;
  modal.classList.add("opacity-0");
  content.classList.add("scale-95");
  setTimeout(() => modal.classList.add("hidden"), 300);
};

carregarColunasExportacao();

const obterMensagemErroFirebase = (
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

const mostrarErroFirebase = (
  error,
  fallback = "Não foi possível concluir a operação.",
) => {
  const mensagem = obterMensagemErroFirebase(error, fallback);
  showToast(mensagem, "error");
  return mensagem;
};

const renderizarSkeletonTabela = () => {
  if (!DOM.grid) return;
  DOM.grid.innerHTML = `
    <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col gap-5 animate-pulse">
      <div class="flex justify-between gap-4">
        <div class="flex-1 space-y-3">
          <div class="h-4 bg-slate-200 rounded w-3/4"></div>
          <div class="h-4 bg-slate-200 rounded w-1/2"></div>
        </div>
        <div class="h-14 w-14 bg-slate-200 rounded-2xl"></div>
      </div>
      <div class="border-t border-slate-100"></div>
      <div class="space-y-4">
        <div class="flex justify-between">
          <div class="h-3 bg-slate-200 rounded w-20"></div>
          <div class="h-3 bg-slate-200 rounded w-24"></div>
        </div>
      </div>
    </div>
    <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col gap-5 animate-pulse">
      <div class="flex justify-between gap-4">
        <div class="flex-1 space-y-3">
          <div class="h-4 bg-slate-200 rounded w-3/4"></div>
          <div class="h-4 bg-slate-200 rounded w-1/2"></div>
        </div>
        <div class="h-14 w-14 bg-slate-200 rounded-2xl"></div>
      </div>
      <div class="border-t border-slate-100"></div>
      <div class="space-y-4">
        <div class="flex justify-between">
          <div class="h-3 bg-slate-200 rounded w-20"></div>
          <div class="h-3 bg-slate-200 rounded w-24"></div>
        </div>
      </div>
    </div>
    <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col gap-5 animate-pulse">
      <div class="flex justify-between gap-4">
        <div class="flex-1 space-y-3">
          <div class="h-4 bg-slate-200 rounded w-3/4"></div>
          <div class="h-4 bg-slate-200 rounded w-1/2"></div>
        </div>
        <div class="h-14 w-14 bg-slate-200 rounded-2xl"></div>
      </div>
      <div class="border-t border-slate-100"></div>
      <div class="space-y-4">
        <div class="flex justify-between">
          <div class="h-3 bg-slate-200 rounded w-20"></div>
          <div class="h-3 bg-slate-200 rounded w-24"></div>
        </div>
      </div>
    </div>`;
  if (DOM.tabInfo) DOM.tabInfo.textContent = "Carregando registros...";
  if (DOM.pagInfo) DOM.pagInfo.textContent = "—";
  if (DOM.btnPrev) DOM.btnPrev.disabled = true;
  if (DOM.btnNext) DOM.btnNext.disabled = true;
};

const renderizarSkeletonDashboard = () => {
  const dashboardContent = document.getElementById("dashboard-content");
  const dashboardSkeleton = document.getElementById("dashboard-skeleton");
  if (dashboardContent) dashboardContent.classList.add("hidden");
  if (dashboardSkeleton) dashboardSkeleton.classList.remove("hidden");
};

const esconderSkeletonDashboard = () => {
  const dashboardContent = document.getElementById("dashboard-content");
  const dashboardSkeleton = document.getElementById("dashboard-skeleton");
  if (dashboardContent) dashboardContent.classList.remove("hidden");
  if (dashboardSkeleton) dashboardSkeleton.classList.add("hidden");
};

const formatarNome = (nome) => {
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

setGreeting();

// ==========================================
// DELEGAÇÃO DE EVENTOS (substitui onclicks globais)
// ==========================================
document.addEventListener("click", (e) => {
  const actionEl = e.target.closest("[data-action]");
  if (!actionEl) return;

  const action = actionEl.getAttribute("data-action");
  switch (action) {
    case "toggle-sidebar":
      toggleSidebar();
      break;
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
    case "switch-tab": {
      const tabId = actionEl.getAttribute("data-tab");
      switchTab(tabId);
      if (tabId === "dashboard" && pendingChartData) {
        renderizarGraficos(pendingChartData.aEnc, pendingChartData.aMat);
        pendingChartData = null;
      }
      break;
    }
    case "limpar-filtros":
      limparFiltros();
      break;
    case "mudar-pagina":
      mudarPagina(parseInt(actionEl.getAttribute("data-dir")));
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
  }
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

const toggleNotifications = function () {
  const dropdown = document.getElementById("notifications-dropdown");
  if (dropdown) {
    dropdown.classList.toggle("opacity-0");
    dropdown.classList.toggle("pointer-events-none");
    dropdown.classList.toggle("scale-95");
  }
};

const limparNotificacoes = async function () {
  if (!notificacoesNaoLidas.length || !currentUser) return;
  try {
    await limparNotificacoesNoFirestore(currentUser.uid, notificacoesNaoLidas);
    showToast("Notificações lidas com sucesso!", "success");
    toggleNotifications();
  } catch (error) {
    console.error("Erro ao limpar notificações:", error);
    showToast("Erro ao limpar notificações.", "error");
  }
};

const criarNotificacao = async function (titulo, mensagem, tipo = "info") {
  if (!currentUser) return;
  try {
    await criarNotificacaoNoFirestore(currentUser.uid, titulo, mensagem, tipo);
  } catch (error) {
    console.error("Erro ao criar notificação:", error);
  }
};

const iniciarEscutaNotificacoes = function () {
  if (!currentUser) return;
  escutarNotificacoes(
    currentUser.uid,
    (snapshot) => {
      const lista = document.getElementById("lista-notificacoes");
      const badge = document.getElementById("badge-notificacoes");
      let html = "";
      notificacoesNaoLidas = [];

      if (snapshot.empty) {
        html = `
              <div class="p-8 text-center text-slate-400">
                <div class="bg-slate-50 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-300">
                  ${svgIcon("checkDouble", "w-6 h-6")}
                </div>
                <p class="text-xs font-bold text-slate-600">Tudo limpo por aqui</p>
                <p class="text-[10px] mt-1 font-medium">Você não possui novas notificações.</p>
              </div>
            `;
      } else {
        snapshot.forEach((docSnap) => {
          const notif = docSnap.data();
          if (!notif.lida) notificacoesNaoLidas.push(docSnap.id);

          const date = notif.timestamp ? notif.timestamp.toDate() : new Date();
          const timeStr =
            date.toLocaleDateString("pt-BR") +
            " às " +
            date.toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
            });

          const bgHover = notif.lida
            ? "hover:bg-slate-50"
            : "bg-brand-50/30 hover:bg-brand-50/50 cursor-pointer";
          const dot = notif.lida
            ? ""
            : `<div class="w-1.5 h-1.5 bg-brand-500 rounded-full mt-1.5 flex-shrink-0"></div>`;
          const textColor = notif.lida ? "text-slate-800" : "text-brand-700";

          html += `
                <div class="p-3 ${bgHover} rounded-xl transition-colors mb-1 border border-transparent hover:border-slate-100 group flex gap-2 items-start">
                  ${dot}
                  <div>
                    <p class="text-xs font-bold ${textColor} transition-colors">${notif.titulo}</p>
                    <p class="text-[10px] text-slate-500 mt-1">${notif.mensagem}</p>
                    <p class="text-[9px] text-slate-400 mt-2 font-semibold uppercase tracking-wider">${timeStr}</p>
                  </div>
                </div>
              `;
        });
      }
      if (lista) lista.innerHTML = html;
      if (badge) {
        if (notificacoesNaoLidas.length > 0)
          badge.classList.remove("opacity-0");
        else badge.classList.add("opacity-0");
      }
    },
    (error) => console.error("Erro ao escutar notificações:", error),
  );
};

const logout = () => {
  if (!auth) return;

  const dropdown = document.getElementById("user-dropdown");
  if (dropdown && !dropdown.classList.contains("opacity-0")) toggleDropdown();

  abrirModalConfirmacao(
    "Sair do Sistema",
    "Tem certeza de que deseja encerrar a sua sessão agora?",
    async () => {
      try {
        await signOut(auth);
        showToast("Sessão encerrada com sucesso.", "success");
        setTimeout(() => window.location.reload(), 1000);
      } catch (error) {
        showToast("Erro ao sair.", "error");
      }
    },
    "Sair",
  );
};

const abrirModalPerfil = () => {
  if (!currentUser) return;
  const dropdown = document.getElementById("user-dropdown");
  if (dropdown && !dropdown.classList.contains("opacity-0")) toggleDropdown();

  abrirModal("modal-perfil", "modal-perfil-content", () => {
    document.getElementById("input-perfil-email").value =
      currentUser.email || "visitante@coeng.com";
    document.getElementById("input-perfil-nome").value =
      document.getElementById("user-dropdown-name").textContent;
  });
};

const fecharModalPerfil = () => {
  fecharModal("modal-perfil", "modal-perfil-content");
};

const salvarPerfil = async () => {
  if (!currentUser) return;
  const novoNome = document.getElementById("input-perfil-nome").value.trim();
  if (!novoNome) return showToast("O nome não pode ficar vazio.", "error");

  const btn = document.getElementById("btn-salvar-perfil");
  const originalText = btn.innerHTML;
  btn.innerHTML = `${svgIcon("spinner", "w-4 h-4 animate-spin")} Salvando...`;
  btn.disabled = true;
  try {
    await updateProfile(currentUser, { displayName: novoNome });
    const headerNameEl = document.getElementById("header-user-name");
    if (headerNameEl) headerNameEl.textContent = novoNome.split(" ")[0];
    const dropNameEl = document.getElementById("user-dropdown-name");
    if (dropNameEl) dropNameEl.textContent = novoNome;
    const avatarBtnEl = document.getElementById("user-avatar-btn");
    if (avatarBtnEl) avatarBtnEl.textContent = novoNome.charAt(0).toUpperCase();
    showToast("Perfil atualizado com sucesso!", "success");
    fecharModalPerfil();
  } catch (error) {
    showToast("Erro ao atualizar perfil.", "error");
  } finally {
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
};

const enviarEmailTrocaSenha = async () => {
  if (!currentUser || !currentUser.email) {
    showToast("Apenas contas com e-mail podem alterar a senha.", "error");
    return;
  }
  const btn = document.getElementById("btn-trocar-senha");
  const originalText = btn.innerHTML;
  btn.innerHTML = `${svgIcon("spinner", "w-3.5 h-3.5 animate-spin")} ...`;
  btn.disabled = true;

  try {
    await sendPasswordResetEmail(auth, currentUser.email);
    showToast("Link de redefinição enviado para o seu e-mail!", "success");
  } catch (error) {
    showToast("Erro ao processar solicitação de troca de senha.", "error");
  } finally {
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
};

const abrirModalConfiguracoes = () => {
  if (!isAdmin) {
    return showToast("Acesso restrito a administradores.", "error");
  }
  const dropdown = document.getElementById("user-dropdown");
  if (dropdown && !dropdown.classList.contains("opacity-0")) toggleDropdown();

  abrirModal("modal-configuracoes", "modal-configuracoes-content", () => {
    document.getElementById("config-itens-pagina").value = itensPorPagina;
  });
};

const fecharModalConfiguracoes = () => {
  fecharModal("modal-configuracoes", "modal-configuracoes-content");
};

const salvarConfiguracoes = () => {
  itensPorPagina =
    parseInt(document.getElementById("config-itens-pagina").value) || 9;
  localStorage.setItem(
    "demap_configuracoes",
    JSON.stringify({ itensPorPagina }),
  );
  showToast("Configurações salvas!", "success");
  fecharModalConfiguracoes();
  paginaAtual = 1;
  if (dadosFiltrados.length > 0) renderizarGridLancamentos();
};

// ==========================================
// 1. NOTIFICAÇÕES & MODAIS
// ==========================================

const abrirModalConfirmacao = (
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

const fecharModalConfirmacao = () => {
  fecharModal("modal-confirmacao", "modal-confirmacao-content");
  acaoPendenteModal = null;
};

const confirmarModalConfirmacao = () => {
  if (acaoPendenteModal) acaoPendenteModal();
  fecharModalConfirmacao();
};

const abrirModalPrompt = () => {
  const input = document.getElementById("input-modal-prompt");
  input.value = "";
  abrirModal("modal-prompt", "modal-prompt-content", () => input.focus());
};

const fecharModalPrompt = () => {
  fecharModal("modal-prompt", "modal-prompt-content");
};

const abrirModalExportacao = () => {
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

const fecharModalExportacao = () => {
  fecharModal("modal-exportacao", "modal-exportacao-content");
};

const confirmarExportacao = () => {
  const container = document.getElementById("export-columns-list");
  if (!container) return;
  const selecionadas = Array.from(
    container.querySelectorAll('input[type="checkbox"]:checked'),
  ).map((el) => el.value);
  if (!selecionadas.length) {
    showToast("Selecione ao menos uma coluna para exportar.", "error");
    return;
  }
  colunasExportacaoSelecionadas = selecionadas;
  localStorage.setItem("demap_export_columns", JSON.stringify(selecionadas));
  fecharModalExportacao();
  exportarExcel(selecionadas);
};

const confirmarModalPrompt = async () => {
  const input = document.getElementById("input-modal-prompt");
  const novoNome = input.value.trim();
  if (novoNome) {
    if (!encarregados.includes(novoNome)) {
      encarregados.push(novoNome);
      renderizarSelectEncarregados();
      document.getElementById("select-encarregado").value = novoNome;
      showToast(`Encarregado "${novoNome}" adicionado!`, "success");
      criarNotificacao(
        "Novo Responsável",
        `O encarregado "${novoNome}" foi adicionado.`,
        "info",
      );
      fecharModalPrompt();

      // Salvar na nuvem (Firestore)
      try {
        await salvarEncarregadoNoFirestore(novoNome);
      } catch (e) {}
    } else {
      showToast("Este encarregado já existe.", "error");
    }
  } else {
    input.focus();
  }
};

const removerEncarregadoSelecionado = () => {
  if (!isAdmin) {
    return showToast(
      "Apenas o administrador pode remover encarregados.",
      "error",
    );
  }
  const select = document.getElementById("select-encarregado");
  const encarregado = select.value;
  if (!encarregado) {
    showToast("Selecione um encarregado para remover.", "error");
    return;
  }

  abrirModalConfirmacao(
    "Excluir Encarregado",
    `Tem certeza que deseja remover o encarregado "${encarregado}"?`,
    async () => {
      try {
        await removerEncarregadoNoFirestore(encarregado);
        showToast(
          `Encarregado "${encarregado}" removido com sucesso.`,
          "success",
        );
      } catch (error) {
        showToast("Erro ao remover encarregado.", "error");
      }
    },
    "Excluir",
  );
};

// ==========================================
// 2. DADOS ESTÁTICOS
// ==========================================
let encarregados = [];

function renderizarSelectEncarregados() {
  const select = document.getElementById("select-encarregado");
  const filtroSelect = document.getElementById("select-filtro-encarregado");

  const valorAtual = select?.value;
  const valorFiltroAtual = filtroSelect?.value;

  if (select)
    select.innerHTML = '<option value="">Selecione o responsável...</option>';
  if (filtroSelect)
    filtroSelect.innerHTML = '<option value="">Todos os encarregados</option>';

  [...encarregados].sort().forEach((nome) => {
    if (select) select.add(new Option(nome, nome));
    if (filtroSelect) filtroSelect.add(new Option(nome, nome));
  });
  if (valorAtual && encarregados.includes(valorAtual))
    select.value = valorAtual;
  if (valorFiltroAtual && encarregados.includes(valorFiltroAtual))
    filtroSelect.value = valorFiltroAtual;
}
renderizarSelectEncarregados();

let baseDados = {
  14407: "LAMINADO DE FREIJÓ DE (200 MM A 400 MM)",
  20932: "COMPENSADO VIROLA 2.750mm X 1.600mm X 4mm",
  15934: "TUBO INDUSTRIAL TIPO METALON DE 25 mm X 25 mm",
};
const savedBase = localStorage.getItem("demap_base_dados");
if (savedBase) {
  baseDados = JSON.parse(savedBase);
  atualizarUIBaseDados(Object.keys(baseDados).length);
}

function atualizarUIBaseDados(count) {
  const statusBase = document.getElementById("status-base");
  if (statusBase) {
    statusBase.classList.remove("hidden");
    statusBase.classList.add("flex");
    document.getElementById("status-base-text").textContent =
      count.toLocaleString("pt-BR") + " itens integrados";
  }
}

const carregarBaseDoFirestore = async function () {
  try {
    const newBase = await fetchBaseDoFirestore();
    if (newBase) {
      baseDados = newBase;
      localStorage.setItem("demap_base_dados", JSON.stringify(baseDados));
      atualizarUIBaseDados(Object.keys(baseDados).length);
    }
  } catch (error) {
    mostrarErroFirebase(
      error,
      "Não foi possível carregar a base de materiais.",
    );
  }
};

const carregarEncarregadosDoFirestore = function () {
  try {
    escutarEncarregados((snapshot) => {
      encarregados = [];
      snapshot.forEach((doc) => {
        encarregados.push(doc.data().nome || doc.id);
      });
      renderizarSelectEncarregados();
    });
  } catch (error) {
    mostrarErroFirebase(error, "Não foi possível carregar os encarregados.");
  }
};

document
  .getElementById("input-excel-base")
  .addEventListener("change", function (e) {
    if (!isAdmin) {
      showToast("Apenas o administrador pode carregar a base.", "error");
      e.target.value = "";
      return;
    }
    const file = e.target.files[0];
    if (!file) return;
    showToast("Sincronizando base...", "info");
    const reader = new FileReader();
    reader.onload = function (event) {
      try {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const rows = XLSX.utils.sheet_to_json(
          workbook.Sheets[workbook.SheetNames[0]],
          { header: 1 },
        );
        let newBase = {};
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (row && row.length >= 4) {
            let cod = String(row[1] || "")
              .replace(/(^"|"$)/g, "")
              .trim();
            let nome = String(row[3] || "")
              .replace(/(^"|"$)/g, "")
              .trim();
            if (cod && nome && cod !== "undefined" && nome !== "undefined")
              newBase[cod] = nome;
          }
        }
        if (Object.keys(newBase).length > 0) {
          baseDados = newBase;
          localStorage.setItem("demap_base_dados", JSON.stringify(baseDados));
          atualizarUIBaseDados(Object.keys(baseDados).length);
          showToast("Sincronizando com a nuvem...", "info");

          // Envia os dados em lotes de 500 itens para o Firebase
          (async () => {
            try {
              const count = await salvarBaseNoFirestoreLote(baseDados);
              showToast(`Base salva na nuvem com ${count} itens.`, "success");
            } catch (e) {
              showToast("Erro ao sincronizar com a nuvem.", "error");
            }
          })();
        } else {
          showToast("Planilha inválida.", "error");
        }
      } catch (error) {
        showToast("Erro ao ler Excel.", "error");
      }
    };
    reader.readAsArrayBuffer(file);
  });

document.getElementById("input-data").value = new Date()
  .toISOString()
  .split("T")[0];

const inputCodigo = document.getElementById("input-codigo");
const inputMaterial = document.getElementById("input-material");
const badgeEncontrado = document.getElementById("badge-encontrado");
const btnSubmit = document.getElementById("btn-submit");
const statusForm = document.getElementById("status-form");

inputCodigo.addEventListener("input", (e) => {
  const cod = e.target.value.trim();
  if (baseDados[cod]) {
    inputMaterial.value = baseDados[cod];
    inputMaterial.className =
      "w-full rounded-xl border border-emerald-300 px-4 py-3 bg-emerald-50 text-emerald-800 font-bold focus:outline-none shadow-inner transition-colors text-sm";
    badgeEncontrado.classList.remove("opacity-0");
    if (statusForm) {
      statusForm.textContent = "Material encontrado na base.";
      statusForm.className = "text-xs text-emerald-600 font-semibold";
    }
  } else {
    badgeEncontrado.classList.add("opacity-0");
    inputMaterial.value = cod.length > 2 ? "Material não catalogado" : "";
    inputMaterial.className =
      cod.length > 2
        ? "w-full rounded-xl border border-red-200 px-4 py-3 bg-red-50 text-red-600 font-bold focus:outline-none shadow-inner transition-colors text-sm"
        : "w-full rounded-xl border border-slate-200 px-4 py-3 bg-slate-100/70 text-slate-500 focus:outline-none cursor-not-allowed shadow-inner transition-colors text-sm font-medium";
    if (statusForm) {
      statusForm.textContent =
        cod.length > 2
          ? "Código ainda não cadastrado."
          : "Informe o código do material.";
      statusForm.className = "text-xs text-amber-600 font-semibold";
    }
  }
});

// ==========================================
// 3. FIREBASE CONFIG
// ==========================================
let currentUser,
  isAdmin = false;
let notificacoesNaoLidas = [];
let dadosAtuais = [];
let dadosFiltrados = [];
let ordenacaoAtual = { coluna: "data", crescente: false };
let paginaAtual = 1;
let itensPorPagina = 9;

// Carrega as configurações locais
const savedConfig = localStorage.getItem("demap_configuracoes");
if (savedConfig) {
  try {
    const parsed = JSON.parse(savedConfig);
    if (parsed.itensPorPagina) itensPorPagina = parsed.itensPorPagina;
  } catch (e) {}
}

try {
  const initAuth = async () => {
    if (typeof __initial_auth_token !== "undefined" && __initial_auth_token) {
      await signInWithCustomToken(auth, __initial_auth_token);
    }
  };
  initAuth();
  onAuthStateChanged(auth, (user) => {
    if (user) {
      currentUser = user;

      // Atualizar UI com dados do usuário
      const userEmail = user.email || "visitante@coeng.com";
      let userNamePart = user.email
        ? user.email.split("@")[0].split(".")[0]
        : "Visitante";
      let fullName = userNamePart;
      let roleName = "Usuário Padrão";
      let roleClass =
        "text-xs text-blue-600 font-bold bg-blue-50 inline-block px-2 py-0.5 rounded-md mt-0.5";

      if (userEmail.toLowerCase() === "jeffin.araujo.1990@gmail.com") {
        userNamePart = "Jefferson";
        fullName = "Jefferson de Araújo Silva";
        roleName = "Administrador";
        roleClass =
          "text-xs text-brand-600 font-bold bg-brand-50 inline-block px-2 py-0.5 rounded-md mt-0.5";
        isAdmin = true;
      } else if (!user.email) {
        roleName = "Visitante";
        roleClass =
          "text-xs text-slate-500 font-bold bg-slate-100 inline-block px-2 py-0.5 rounded-md mt-0.5";
        isAdmin = false;
      } else {
        isAdmin = false;
      }
      const displayNameHeader = user.displayName
        ? user.displayName.split(" ")[0]
        : userNamePart.charAt(0).toUpperCase() + userNamePart.slice(1);
      const displayNameFull =
        user.displayName ||
        fullName.charAt(0).toUpperCase() + fullName.slice(1);
      const initial = displayNameHeader.charAt(0).toUpperCase();

      const headerNameEl = document.getElementById("header-user-name");
      if (headerNameEl) headerNameEl.textContent = displayNameHeader;

      const dropNameEl = document.getElementById("user-dropdown-name");
      if (dropNameEl) dropNameEl.textContent = displayNameFull;

      const dropEmailEl = document.getElementById("user-dropdown-email");
      if (dropEmailEl) dropEmailEl.textContent = userEmail;

      const roleEl = document.getElementById("header-user-role");
      if (roleEl) {
        roleEl.textContent = roleName;
        roleEl.className = roleClass;
      }

      const avatarBtnEl = document.getElementById("user-avatar-btn");
      if (avatarBtnEl) avatarBtnEl.textContent = initial;

      const btnConfig = document.getElementById("btn-menu-configuracoes");
      if (btnConfig) btnConfig.style.display = isAdmin ? "" : "none";

      const btnRemoverEnc = document.getElementById("btn-remover-encarregado");
      if (btnRemoverEnc) btnRemoverEnc.style.display = isAdmin ? "" : "none";

      const btnCarregarBase = document.getElementById("btn-carregar-base");
      if (btnCarregarBase)
        btnCarregarBase.style.display = isAdmin ? "" : "none";

      const loginScreen = document.getElementById("login-screen");
      if (loginScreen) {
        loginScreen.classList.add("opacity-0");
        setTimeout(() => loginScreen.classList.add("hidden"), 500);
      }
      iniciarEscutaNotificacoes();
      carregarBaseDoFirestore();
      carregarEncarregadosDoFirestore();
      iniciarEscutaDeDados();
    } else {
      const loginScreen = document.getElementById("login-screen");
      if (loginScreen) {
        loginScreen.classList.remove("hidden");
        setTimeout(() => loginScreen.classList.remove("opacity-0"), 10);
      }
    }
  });
} catch (error) {
  mostrarErroFirebase(error, "Falha de conexão com a nuvem.");
}

// Lógica do formulário de acesso
document.getElementById("form-login").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("login-email").value;
  const pass = document.getElementById("login-password").value;
  const btn = document.getElementById("btn-login");
  const originalText = btn.innerHTML;

  btn.innerHTML = `${svgIcon("spinner", "w-5 h-5 animate-spin")} Autenticando...`;
  btn.disabled = true;

  try {
    await signInWithEmailAndPassword(auth, email, pass);
    showToast("Acesso realizado com sucesso!", "success");
    // O onAuthStateChanged lidará com o fechamento da tela automaticamente
  } catch (error) {
    mostrarErroFirebase(error, "Não foi possível entrar no sistema.");
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
});

const loginAnonimo = async () => {
  const btn = document.getElementById("btn-login-anonimo");
  const originalText = btn.innerHTML;
  btn.innerHTML = `${svgIcon("spinner", "w-4 h-4 animate-spin")} Aguarde...`;
  btn.disabled = true;
  try {
    await signInAnonymously(auth);
    showToast("Acesso Visitante liberado.", "success");
  } catch (error) {
    mostrarErroFirebase(error, "Erro ao acessar anonimamente.");
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
};

document
  .getElementById("input-excel-historico")
  .addEventListener("change", async function (e) {
    const file = e.target.files[0];
    if (!file || !currentUser) return;
    showToast("Processando histórico...", "info");
    const reader = new FileReader();
    reader.onload = async function (event) {
      try {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const rows = XLSX.utils.sheet_to_json(
          workbook.Sheets[workbook.SheetNames[0]],
          { raw: false },
        );
        const lancamentosFormatados = [];
        for (let row of rows) {
          const lancamento = normalizarLancamentoImportado(row);
          if (
            lancamento.codigo &&
            lancamento.quantidade > 0 &&
            lancamento.data
          ) {
            lancamentosFormatados.push(lancamento);
          }
        }
        if (lancamentosFormatados.length > 0) {
          const count = await salvarLancamentosEmLote(
            currentUser.uid,
            lancamentosFormatados,
          );
          showToast(`${count} registros importados!`, "success");
          criarNotificacao(
            "Importação Concluída",
            `${count} lançamentos foram importados do histórico.`,
            "success",
          );
          e.target.value = "";
        } else {
          showToast("Planilha vazia ou com erros.", "error");
        }
      } catch (error) {
        mostrarErroFirebase(error, "Falha na importação do histórico.");
      }
    };
    reader.readAsArrayBuffer(file);
  });

// ==========================================
// 4. CRUD DE LANÇAMENTOS (GRADE AVANÇADA)
// ==========================================
document
  .getElementById("form-lancamento")
  .addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!currentUser) return;
    const btn = btnSubmit || document.getElementById("btn-submit");
    const original = btn.innerHTML;
    btn.innerHTML = `${svgIcon("spinner", "w-4 h-4 animate-spin")} Processando...`;
    btn.disabled = true;
    const material = inputMaterial.value;
    const codigo = normalizarTexto(
      document.getElementById("input-codigo").value,
    );
    const quantidade = Number(
      document.getElementById("input-quantidade").value,
    );
    const encarregado = normalizarTexto(
      document.getElementById("select-encarregado").value,
    );

    if (material.includes("Não catalogado") || material === "" || !codigo) {
      showToast("Verifique o cód. almox. e o material informado.", "error");
      btn.innerHTML = original;
      btn.disabled = false;
      return;
    }

    if (!Number.isFinite(quantidade) || quantidade <= 0) {
      showToast("Informe uma quantidade válida.", "error");
      btn.innerHTML = original;
      btn.disabled = false;
      return;
    }

    try {
      await adicionarLancamentoNoFirestore(currentUser.uid, {
        data: document.getElementById("input-data").value,
        codigo,
        material,
        quantidade,
        encarregado,
        baixa: "Não",
      });
      document.getElementById("form-lancamento").reset();
      document.getElementById("input-data").value = new Date()
        .toISOString()
        .split("T")[0];
      inputMaterial.className =
        "w-full rounded-xl border border-slate-200 px-4 py-3 bg-slate-100/70 text-slate-500 focus:outline-none cursor-not-allowed shadow-inner transition-colors text-sm font-medium";
      badgeEncontrado.classList.add("opacity-0");
      if (statusForm) {
        statusForm.textContent = "Registro pronto para salvar.";
        statusForm.className = "text-xs text-slate-500 font-semibold";
      }
      showToast("Saída registrada com sucesso!");
      const qtdNotif = document.getElementById("input-quantidade").value;
      criarNotificacao(
        "Nova Saída",
        `Material: ${material} | Qtd: ${qtdNotif}`,
        "success",
      );
    } catch (error) {
      console.error(error);
      showToast("Erro no servidor. Tente novamente em instantes.", "error");
    } finally {
      btn.innerHTML = original;
      btn.disabled = false;
    }
  });

const deletarLancamento = (docId) => {
  if (!currentUser) return;
  if (!isAdmin) {
    return showToast("Apenas o administrador pode excluir registros.", "error");
  }
  abrirModalConfirmacao(
    "Excluir Registro",
    "Atenção: Esta ação removerá a saída do banco de dados permanentemente.",
    async () => {
      try {
        await deletarLancamentoNoFirestore(currentUser.uid, docId);
        showToast("Registro apagado.", "success");
      } catch (error) {
        mostrarErroFirebase(error, "Erro ao excluir o registro.");
      }
    },
    "Excluir",
  );
};

const toggleBaixa = async (idOuIds, statusAtual) => {
  if (!currentUser) return;
  const novoStatus = statusAtual === "Sim" ? "Não" : "Sim";
  try {
    await alternarBaixaNoFirestore(currentUser.uid, idOuIds, novoStatus);
    showToast(`Status alterado para "${novoStatus}".`, "success");
  } catch (error) {
    mostrarErroFirebase(error, "Erro ao sincronizar o status.");
  }
};

function iniciarEscutaDeDados() {
  if (!currentUser) return;
  isLoadingTabela = true;
  isLoadingDashboard = true;
  renderizarSkeletonTabela();
  renderizarSkeletonDashboard();
  escutarLancamentos(currentUser.uid, (snapshot) => {
    dadosAtuais = [];
    if (!snapshot.empty)
      snapshot.forEach((doc) => {
        dadosAtuais.push({ ...doc.data(), id: doc.id });
      });
    isLoadingTabela = false;
    isLoadingDashboard = false;
    esconderSkeletonDashboard();
    aplicarFiltroPesquisa();
    atualizarDashboard();
    if (!dadosCarregadosToastMostrado) {
      dadosCarregadosToastMostrado = true;
      showToast("Dados carregados.", "success");
    }
  });
}

const searchInput = document.getElementById("input-search");
const btnClearSearch = document.getElementById("btn-clear-search");
const ordenacaoSelect = document.getElementById("select-ordenacao");
const filtroEncarregadoSelect = document.getElementById(
  "select-filtro-encarregado",
);
const filtroStatusSelect = document.getElementById("select-filtro-status");
const inputDataInicio = document.getElementById("input-data-de");
const inputDataFim = document.getElementById("input-data-ate");

// Tenta recuperar os filtros salvos no navegador
const savedFiltrosStr = localStorage.getItem("demap_filtros");
if (savedFiltrosStr) {
  try {
    const savedFiltros = JSON.parse(savedFiltrosStr);
    if (savedFiltros.search) {
      searchInput.value = savedFiltros.search;
      if (btnClearSearch) btnClearSearch.classList.remove("hidden");
    }
    if (savedFiltros.encarregadoFiltro)
      filtroEncarregadoSelect.value = savedFiltros.encarregadoFiltro;
    if (savedFiltros.statusFiltro)
      filtroStatusSelect.value = savedFiltros.statusFiltro;
    if (savedFiltros.dataInicio)
      inputDataInicio.value = savedFiltros.dataInicio;
    if (savedFiltros.dataFim) inputDataFim.value = savedFiltros.dataFim;
    if (savedFiltros.ordenacao) {
      ordenacaoSelect.value = savedFiltros.ordenacao;
      const val = savedFiltros.ordenacao;
      if (val === "data_desc")
        ordenacaoAtual = { coluna: "data", crescente: false };
      else if (val === "data_asc")
        ordenacaoAtual = { coluna: "data", crescente: true };
      else if (val === "material_asc")
        ordenacaoAtual = { coluna: "material", crescente: true };
      else if (val === "quantidade_desc")
        ordenacaoAtual = { coluna: "quantidade", crescente: false };
      else if (val === "encarregado_asc")
        ordenacaoAtual = { coluna: "encarregado", crescente: true };
    }
  } catch (e) {}
}

const salvarFiltros = () => {
  localStorage.setItem(
    "demap_filtros",
    JSON.stringify({
      search: searchInput.value,
      encarregadoFiltro: filtroEncarregadoSelect.value,
      statusFiltro: filtroStatusSelect.value,
      dataInicio: inputDataInicio.value,
      dataFim: inputDataFim.value,
      ordenacao: ordenacaoSelect.value,
    }),
  );
};

const limparFiltros = () => {
  searchInput.value = "";
  if (btnClearSearch) btnClearSearch.classList.add("hidden");
  filtroEncarregadoSelect.value = "";
  filtroStatusSelect.value = "";
  inputDataInicio.value = "";
  inputDataFim.value = "";
  ordenacaoSelect.value = "data_desc";

  paginaAtual = 1;
  ordenacaoAtual = { coluna: "data", crescente: false };

  salvarFiltros();
  aplicarFiltroPesquisa();
};

const onFiltroChange = () => {
  paginaAtual = 1;
  if (btnClearSearch) {
    if (searchInput.value.trim() !== "")
      btnClearSearch.classList.remove("hidden");
    else btnClearSearch.classList.add("hidden");
  }
  salvarFiltros();
  aplicarFiltroPesquisa();
};
searchInput.addEventListener("input", debounce(onFiltroChange, 300));
if (btnClearSearch) {
  btnClearSearch.addEventListener("click", () => {
    searchInput.value = "";
    btnClearSearch.classList.add("hidden");
    searchInput.focus();
    onFiltroChange();
  });
}
filtroEncarregadoSelect.addEventListener("change", onFiltroChange);
filtroStatusSelect.addEventListener("change", onFiltroChange);
inputDataInicio.addEventListener("change", onFiltroChange);
inputDataFim.addEventListener("change", onFiltroChange);
ordenacaoSelect.addEventListener("change", () => {
  const val = ordenacaoSelect.value;
  paginaAtual = 1;
  if (val === "data_desc")
    ordenacaoAtual = { coluna: "data", crescente: false };
  else if (val === "data_asc")
    ordenacaoAtual = { coluna: "data", crescente: true };
  else if (val === "material_asc")
    ordenacaoAtual = { coluna: "material", crescente: true };
  else if (val === "quantidade_desc")
    ordenacaoAtual = { coluna: "quantidade", crescente: false };
  else if (val === "encarregado_asc")
    ordenacaoAtual = { coluna: "encarregado", crescente: true };

  salvarFiltros();
  aplicarOrdenacao();
  renderizarGridLancamentos();
});

const parseDataFiltro = (valor) => {
  const dataNormal = normalizarData(valor);
  if (!dataNormal) return null;
  const [ano, mes, dia] = dataNormal.split("-").map(Number);
  if (!ano || !mes || !dia) return null;
  return new Date(ano, mes - 1, dia);
};

function aplicarFiltroPesquisa() {
  const termo = searchInput.value.toLowerCase().trim();
  const encarregadoSelecionado = filtroEncarregadoSelect.value;
  const statusSelecionado = filtroStatusSelect.value;
  const dataInicio = inputDataInicio.value
    ? parseDataFiltro(inputDataInicio.value)
    : null;
  const dataFim = inputDataFim.value
    ? parseDataFiltro(inputDataFim.value)
    : null;
  let tempFiltrados = dadosAtuais.filter((item) => {
    const matchTexto =
      termo === "" ||
      item.codigo.toLowerCase().includes(termo) ||
      item.material.toLowerCase().includes(termo) ||
      item.encarregado.toLowerCase().includes(termo);

    let matchEncarregado = true;
    if (encarregadoSelecionado)
      matchEncarregado = item.encarregado === encarregadoSelecionado;

    let matchStatus = true;
    if (statusSelecionado)
      matchStatus = (item.baixa || "Não") === statusSelecionado;

    const dataItem = parseDataFiltro(item.data);
    let matchData = true;
    if (dataInicio || dataFim) {
      matchData = false;
      if (dataItem) {
        const depoisDoInicio = !dataInicio || dataItem >= dataInicio;
        const antesDoFim = !dataFim || dataItem <= dataFim;
        matchData = depoisDoInicio && antesDoFim;
      }
    }

    return matchTexto && matchEncarregado && matchStatus && matchData;
  });

  // Somatório Diário Inteligente
  const agrupados = {};
  tempFiltrados.forEach((item) => {
    const key = `${item.data}_${item.codigo}_${item.encarregado}_${item.baixa || "Não"}`;
    if (!agrupados[key]) {
      agrupados[key] = {
        ...item,
        quantidade: Number(item.quantidade),
        ids: [item.id],
        isGrouped: false,
      };
    } else {
      agrupados[key].quantidade += Number(item.quantidade);
      agrupados[key].ids.push(item.id);
      agrupados[key].isGrouped = true;
    }
  });
  dadosFiltrados = Object.values(agrupados);
  aplicarOrdenacao();
  renderizarGridLancamentos();
}

function aplicarOrdenacao() {
  const { coluna, crescente } = ordenacaoAtual;
  dadosFiltrados.sort((a, b) => {
    let vA =
      coluna === "quantidade"
        ? Number(a[coluna]) || 0
        : String(a[coluna] || "").toLowerCase();
    let vB =
      coluna === "quantidade"
        ? Number(b[coluna]) || 0
        : String(b[coluna] || "").toLowerCase();
    if (vA < vB) return crescente ? -1 : 1;
    if (vA > vB) return crescente ? 1 : -1;
    return 0;
  });
}

function renderizarGridLancamentos() {
  if (isLoadingTabela) {
    renderizarSkeletonTabela();
    return;
  }

  DOM.grid.innerHTML = "";
  const total = dadosFiltrados.length;
  const paginas = Math.ceil(total / itensPorPagina) || 1;

  if (total === 0) {
    DOM.grid.innerHTML = `<div class="col-span-1 md:col-span-2 xl:col-span-3 flex flex-col items-center justify-center py-20 text-slate-400 bg-white rounded-3xl border border-slate-200 border-dashed">
                    <div class="bg-slate-50 p-5 rounded-full mb-4 ring-8 ring-slate-50/50 opacity-50">${svgIcon("folder", "w-10 h-10")}</div>
                    <h4 class="font-extrabold text-lg text-slate-700">Nenhum registro encontrado</h4>
                    <p class="text-sm mt-1">Altere os filtros de pesquisa ou adicione um novo lançamento.</p>
                </div>`;
    DOM.tabInfo.textContent = "0 registros";
    DOM.btnPrev.disabled = true;
    DOM.btnNext.disabled = true;
    return;
  }

  if (paginaAtual > paginas) paginaAtual = paginas;
  if (paginaAtual < 1) paginaAtual = 1;
  const start = (paginaAtual - 1) * itensPorPagina;
  const end = Math.min(start + itensPorPagina, total);

  let itensHTML = "";
  dadosFiltrados.slice(start, end).forEach((item) => {
    const dataBR = formatarDataParaDisplay(item.data);
    const idArg = item.isGrouped
      ? `[${item.ids.map((id) => `'${id}'`).join(",")}]`
      : `'${item.id}'`;
    const baixaAtual = item.baixa || "Não";
    const borderColor =
      baixaAtual === "Sim" ? "border-t-emerald-500" : "border-t-amber-500";

    const materialSeguro = escapeHTML(item.material);
    const encarregadoSeguro = escapeHTML(item.encarregado);

    const btnBaixa =
      baixaAtual === "Sim"
        ? `<button data-action="toggle-baixa" data-id="${item.isGrouped ? `[${item.ids.map((id) => `'${id}'`).join(",")}]` : item.id}" data-status="Sim" class="flex-1 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5">${svgIcon("checkDouble", "w-4 h-4")} Concluído</button>`
        : `<button data-action="toggle-baixa" data-id="${item.isGrouped ? `[${item.ids.map((id) => `'${id}'`).join(",")}]` : item.id}" data-status="Não" class="flex-1 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5">${svgIcon("clock", "w-4 h-4")} Pendente</button>`;

    itensHTML += `
                    <div class="bg-white rounded-2xl shadow-sm border border-slate-200/80 border-t-4 ${borderColor} p-4 sm:p-6 flex flex-col hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
                        <div class="flex justify-between items-start mb-4">
                            <div class="bg-slate-100/80 px-2.5 py-1 rounded-md text-[10px] font-bold text-slate-500 tracking-widest border border-slate-200">
                                CÓD: ${escapeHTML(item.codigo)}
                            </div>
                            <div class="bg-blue-50 text-blue-600 px-2.5 py-1 rounded-md text-[10px] font-bold flex items-center gap-1">
                                ${svgIcon("calendar", "w-4 h-4")} ${dataBR}
                            </div>
                        </div>
                        <h3 class="font-black text-slate-800 text-base leading-tight line-clamp-2 mb-4" title="${materialSeguro}">${materialSeguro}</h3>
                        
                        <div class="flex items-center gap-3 sm:gap-4 bg-slate-50/50 rounded-xl p-3 border border-slate-100 mb-4">
                            <svg class="text-brand-500 text-sm mr-2" aria-hidden="true"><use href="#icon-users-gear"></use></svg>
                            <div class="flex-1 min-w-0">
                                <p class="text-[10px] font-bold text-slate-400 uppercase">Responsável</p>
                                <p class="font-bold text-slate-700 text-sm truncate" title="${encarregadoSeguro}">${encarregadoSeguro}</p>
                            </div>
                            <div class="text-right">
                                <p class="text-[10px] font-bold text-slate-400 uppercase">Qtd</p>
                                <p class="font-black text-brand-600 text-lg leading-none">${item.quantidade.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}</p>
                            </div>
                        </div>

                        <div class="mt-auto flex gap-2 pt-2 border-t border-slate-100">
                            ${btnBaixa}
                            ${
                              item.isGrouped
                                ? `<div class="w-16 flex-shrink-0 py-2.5 bg-blue-50 text-blue-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1 shadow-sm">${svgIcon("layer", "w-4 h-4")} ${item.ids.length}x</div>`
                                : isAdmin
                                  ? `<button data-action="deletar-lancamento" data-id="${item.id}" class="w-16 flex-shrink-0 py-2.5 bg-slate-50 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-xl transition-colors flex items-center justify-center shadow-sm" title="Excluir Registro">${svgIcon("trash", "w-4 h-4")}</button>`
                                  : `<div class="w-16 flex-shrink-0 py-2.5 bg-slate-50 text-slate-300 rounded-xl transition-colors flex items-center justify-center shadow-sm cursor-not-allowed" title="Sem permissão para excluir">${svgIcon("trash", "w-4 h-4")}</div>`
                            }
                        </div>
                    </div>`;
  });
  DOM.grid.innerHTML = itensHTML;

  document.getElementById("tabela-info").textContent =
    `Pág. ${paginaAtual} de ${paginas} (${total} itens)`;
  document.getElementById("tabela-paginacao-info").textContent =
    `${paginaAtual} / ${paginas}`;
  document.getElementById("btn-prev-page").disabled = paginaAtual === 1;
  document.getElementById("btn-next-page").disabled = paginaAtual === paginas;
}

const mudarPagina = (dir) => {
  paginaAtual += dir;
  renderizarGridLancamentos();
};
const exportarExcel = (colunasSelecionadas = colunasExportacaoSelecionadas) => {
  if (!dadosFiltrados.length)
    return showToast("Sem dados para exportar.", "info");
  const filtrosResumo = [
    searchInput.value ? `Busca: ${searchInput.value}` : "",
    filtroEncarregadoSelect.value
      ? `Encarregado: ${filtroEncarregadoSelect.value}`
      : "",
    filtroStatusSelect.value ? `Status: ${filtroStatusSelect.value}` : "",
    inputDataInicio.value ? `De: ${inputDataInicio.value}` : "",
    inputDataFim.value ? `Até: ${inputDataFim.value}` : "",
  ].filter(Boolean);
  const colunasValidas = (colunasSelecionadas || []).filter((coluna) =>
    Object.prototype.hasOwnProperty.call(colunasExportacaoMeta, coluna),
  );
  const data = dadosFiltrados.map((i) => {
    const linha = {};
    (colunasValidas.length
      ? colunasValidas
      : Object.keys(colunasExportacaoMeta)
    ).forEach((coluna) => {
      if (coluna === "data") {
        linha[colunasExportacaoMeta[coluna]] = formatarDataParaDisplay(i.data);
      } else if (coluna === "quantidade") {
        linha[colunasExportacaoMeta[coluna]] = Number(i.quantidade);
      } else {
        linha[colunasExportacaoMeta[coluna]] = i[coluna] || "";
      }
    });
    return linha;
  });
  const ws = XLSX.utils.json_to_sheet(data);
  const colWidths = {
    Data: 12,
    Código: 15,
    Material: 50,
    Quantidade: 12,
    Encarregado: 25,
    Baixa: 10,
  };
  ws["!cols"] = Object.keys(data[0] || {}).map((key) => ({
    wch: colWidths[key] || 20,
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Lançamentos");
  const nomeArquivo = `DEMAP_Lançamentos_${new Date().toISOString().split("T")[0]}${filtrosResumo.length ? "_filtrado" : ""}.xlsx`;
  XLSX.writeFile(wb, nomeArquivo);
  showToast("Relatório baixado com sucesso!", "success");
};

// ==========================================
// 5. GRÁFICOS E PAINEL
// ==========================================
function atualizarDashboard() {
  if (isLoadingDashboard) {
    renderizarSkeletonDashboard();
    return;
  }
  esconderSkeletonDashboard();

  let total = 0;
  let encSet = new Set();
  let matSet = new Set();
  let volEnc = {};
  let topMat = {};
  const hoje = new Date();
  const inicio7 = new Date(hoje);
  inicio7.setDate(hoje.getDate() - 7);
  const inicio30 = new Date(hoje);
  inicio30.setDate(hoje.getDate() - 30);
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  let resumo7d = 0;
  let resumo30d = 0;
  let resumoMes = 0;
  dadosAtuais.forEach((i) => {
    total += Number(i.quantidade);
    encSet.add(i.encarregado);
    matSet.add(i.codigo);
    volEnc[i.encarregado] = (volEnc[i.encarregado] || 0) + Number(i.quantidade);
    let matDesc = i.material.substring(0, 30) + "...";
    topMat[matDesc] = (topMat[matDesc] || 0) + Number(i.quantidade);

    const dataItem = parseDataFiltro(i.data);
    if (dataItem) {
      if (dataItem >= inicio7) resumo7d += Number(i.quantidade);
      if (dataItem >= inicio30) resumo30d += Number(i.quantidade);
      if (dataItem >= inicioMes) resumoMes += Number(i.quantidade);
    }
  });
  atualizarTextoSeExiste(
    "card-total-saidas",
    total.toLocaleString("pt-BR", { maximumFractionDigits: 2 }),
  );
  atualizarTextoSeExiste("card-total-encarregados", encSet.size);
  atualizarTextoSeExiste("card-total-materiais", matSet.size);
  atualizarTextoSeExiste(
    "resumo-7d",
    `${resumo7d.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} qtd`,
  );
  atualizarTextoSeExiste(
    "resumo-30d",
    `${resumo30d.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} qtd`,
  );
  atualizarTextoSeExiste(
    "resumo-mes",
    `${resumoMes.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} qtd`,
  );

  let aEnc = Object.keys(volEnc)
    .map((k) => ({ nome: k, vol: volEnc[k] }))
    .sort((a, b) => b.vol - a.vol)
    .slice(0, 10);
  let aMat = Object.keys(topMat)
    .map((k) => ({ nome: k, vol: topMat[k] }))
    .sort((a, b) => b.vol - a.vol)
    .slice(0, 5);

  const emptyEnc = document.getElementById("empty-chart-enc");
  if (emptyEnc) emptyEnc.classList.toggle("hidden", aEnc.length > 0);
  const emptyMat = document.getElementById("empty-chart-mat");
  if (emptyMat) emptyMat.classList.toggle("hidden", aMat.length > 0);

  const tabDashboard = document.getElementById("tab-dashboard");
  if (tabDashboard?.classList.contains("active")) {
    renderizarGraficos(aEnc, aMat);
    pendingChartData = null;
  } else {
    pendingChartData = { aEnc, aMat };
  }
}

function renderizarGraficos(dEnc, dMat) {
  Chart.defaults.font.family = "'Inter', sans-serif";
  const canvasEnc = document.getElementById("chartEncarregados");
  const canvasMat = document.getElementById("chartMateriais");
  const emptyEnc = document.getElementById("empty-chart-enc");
  const emptyMat = document.getElementById("empty-chart-mat");

  if (!canvasEnc || !canvasMat || !emptyEnc || !emptyMat) return;

  const mostrarEstadoVazio = (canvas, empty, mensagem) => {
    canvas.classList.add("hidden");
    empty.classList.remove("hidden");
    const texto = empty.querySelector("p");
    if (texto) texto.textContent = mensagem;
  };

  const mostrarGrafico = (canvas, empty) => {
    canvas.classList.remove("hidden");
    empty.classList.add("hidden");
  };

  if (chartEnc) {
    chartEnc.destroy();
    chartEnc = null;
  }
  if (chartMat) {
    chartMat.destroy();
    chartMat = null;
  }

  if (!dEnc.length) {
    mostrarEstadoVazio(canvasEnc, emptyEnc, "Sem dados para encargados");
  } else {
    mostrarGrafico(canvasEnc, emptyEnc);
    const ctxE = canvasEnc.getContext("2d");
    const gradB = ctxE.createLinearGradient(0, 0, 0, 300);
    gradB.addColorStop(0, "#3b82f6");
    gradB.addColorStop(1, "#6366f1");
    chartEnc = new Chart(ctxE, {
      type: "bar",
      data: {
        labels: dEnc.map((d) => formatarNome(d.nome)),
        datasets: [
          {
            data: dEnc.map((d) => d.vol),
            backgroundColor: gradB,
            borderRadius: 8,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, grid: { display: false } },
          x: {
            grid: { display: false },
            ticks: { font: { weight: "bold" } },
          },
        },
      },
    });
  }

  if (!dMat.length) {
    mostrarEstadoVazio(canvasMat, emptyMat, "Sem dados para materiais");
  } else {
    mostrarGrafico(canvasMat, emptyMat);
    const ctxM = canvasMat.getContext("2d");
    const gradO = ctxM.createLinearGradient(300, 0, 0, 0);
    gradO.addColorStop(0, "#f97316");
    gradO.addColorStop(1, "#fbbf24");
    chartMat = new Chart(ctxM, {
      type: "bar",
      data: {
        labels: dMat.map((d) => d.nome),
        datasets: [
          {
            data: dMat.map((d) => d.vol),
            backgroundColor: gradO,
            borderRadius: 8,
          },
        ],
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { beginAtZero: true, grid: { display: false } },
          y: {
            grid: { display: false },
            ticks: { font: { weight: "bold" } },
          },
        },
      },
    });
  }
}

// ==========================================
// 6. NAVEGAÇÃO DE ABAS
// ==========================================
// (As funções de abas agora estão no ui.js)

// ==========================================
// 7. SERVICE WORKER (PWA INSTALÁVEL)
// ==========================================
const mostrarBannerAtualizacaoPWA = (registration) => {
  if (!document.getElementById("pwa-update-banner")) {
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
      .addEventListener("click", () => {
        banner.remove();
      });
  }
};

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./sw.js")
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
