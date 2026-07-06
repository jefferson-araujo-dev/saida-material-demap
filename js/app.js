import { auth } from "./firebase.js";
import {
  setGreeting,
  toggleSidebar,
  toggleDropdown,
  showToast,
  switchTab,
} from "./ui.js";
import {
  adicionarLancamentoNoFirestore,
  deletarLancamentoNoFirestore,
  alternarBaixaNoFirestore,
  salvarLancamentosEmLote,
  salvarEncarregadoNoFirestore,
  removerEncarregadoNoFirestore,
  escutarNotificacoes,
  escutarEncarregados,
  fetchBaseDoFirestore,
  salvarBaseNoFirestoreLote,
  escutarLancamentos,
} from "./database.js";
import {
  signInAnonymously,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  updateProfile,
  sendPasswordResetEmail,
} from "firebase/auth";
import * as XLSX from "xlsx";
import {
  normalizarData,
  normalizarLancamentoImportado,
  normalizarTexto,
} from "./normalizacao.mjs";
import {
  DOM,
  debounce,
  mostrarErroFirebase,
  renderizarSkeletonTabela,
  svgIcon,
  renderizarSkeletonDashboard,
  esconderSkeletonDashboard,
} from "./domUtils.js";
import {
  logout,
  abrirModalPerfil,
  fecharModalPerfil,
  salvarPerfil,
  enviarEmailTrocaSenha,
  loginAnonimo,
} from "./auth.js";
import {
  abrirModal,
  fecharModal,
  abrirModalConfirmacao,
  fecharModalConfirmacao,
  confirmarModalConfirmacao,
  abrirModalPrompt,
  fecharModalPrompt,
  confirmarModalPrompt,
  abrirModalExportacao,
  fecharModalExportacao,
  confirmarExportacao,
} from "./modals.js";
import {
  toggleNotifications,
  limparNotificacoes,
  criarNotificacao,
  iniciarEscutaNotificacoes,
} from "./notifications.js";
import {
  dadosAtuais,
  dadosFiltrados,
  ordenacaoAtual,
  paginaAtual as getPaginaAtual,
  itensPorPagina,
  encarregados,
  setItensPorPagina,
  setOrdenacaoAtual,
  setDadosAtuais,
  baseDados,
  renderizarSelectEncarregados,
  renderizarGridLancamentos,
  aplicarFiltroPesquisa,
  aplicarOrdenacao,
  mudarPagina,
  limparFiltros,
  onFiltroChange,
  carregarBaseDoFirestore,
  carregarEncarregadosDoFirestore,
  removerEncarregadoSelecionado,
} from "./dataManagement.js";
import {
  pendingChartData as getPendingChartData,
  isLoadingDashboard,
  setIsLoadingDashboard,
  atualizarDashboard,
  renderizarGraficos,
} from "./dashboard.js";
import {
  setColunasExportacaoSelecionadas,
  carregarColunasExportacao,
  exportarExcel,
} from "./excel.js";

// ==========================================
// 0. ESTADO GLOBAL E UTILITÁRIOS DE INTERFACE
// ==========================================
export let currentUser;
export let isAdmin = false;
export let isLoadingTabela = true;

let pendingChartData = null;

let dadosCarregadosToastMostrado = false; // Local to app.js

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
      toggleNotifications(); // Pass currentUser if needed
      break;
    case "limpar-notificacoes":
      limparNotificacoes(currentUser);
      break;
    case "logout":
      logout(currentUser);
      break;
    case "abrir-perfil":
      abrirModalPerfil(currentUser);
      break;
    case "fechar-perfil":
      fecharModalPerfil();
      break;
    case "salvar-perfil":
      salvarPerfil(currentUser);
      break;
    case "trocar-senha":
      enviarEmailTrocaSenha(currentUser);
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
      confirmarExportacao(); // This function now handles the export logic
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
      confirmarModalPrompt(
        currentUser,
        encarregados,
        renderizarSelectEncarregados,
      );
      break;
    case "remover-encarregado":
      // A função agora obtém o que precisa do escopo de app.js
      removerEncarregadoSelecionado(isAdmin, currentUser);
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
      loginAnonimo(); // This function now handles anonymous login
      break;
    case "switch-tab": {
      const tabId = actionEl.getAttribute("data-tab");
      switchTab(tabId);
      const chartData = getPendingChartData();
      if (tabId === "dashboard" && chartData) {
        renderizarGraficos(chartData.aEnc, chartData.aMat);
        pendingChartData = null;
      }
      break;
    }
    case "limpar-filtros":
      limparFiltros();
      aplicarFiltroPesquisa(isAdmin);
      break;
    case "mudar-pagina":
      mudarPagina(parseInt(actionEl.getAttribute("data-dir")));
      renderizarGridLancamentos(isLoadingTabela, isAdmin);
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
      toggleBaixa(
        currentUser.uid,
        parsedId,
        actionEl.getAttribute("data-status"),
      );
      break;
    }
    case "deletar-lancamento":
      deletarLancamento(
        currentUser.uid,
        actionEl.getAttribute("data-id"),
        isAdmin,
      );
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
  const novosItens =
    parseInt(document.getElementById("config-itens-pagina").value) || 9;
  setItensPorPagina(novosItens);
  localStorage.setItem(
    "demap_configuracoes",
    JSON.stringify({ itensPorPagina: novosItens }),
  );
  showToast("Configurações salvas!", "success");
  fecharModalConfiguracoes();
  // A paginação será resetada na próxima chamada de onFiltroChange
  if (dadosFiltrados.length > 0)
    renderizarGridLancamentos(isLoadingTabela, isAdmin);
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
        let newBase = {}; // This should update the baseDados in dataManagement.js
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
          // Update baseDados in dataManagement.js
          Object.assign(baseDados, newBase); // Merge newBase into existing baseDados
          localStorage.setItem("demap_base_dados", JSON.stringify(baseDados)); // Save to local storage
          // Call a function to update UI for baseDados count, if needed
          // For now, let's assume `atualizarUIBaseDados` is still in dataManagement.js
          // atualizarUIBaseDados(Object.keys(baseDados).length);
          showToast("Sincronizando com a nuvem...", "info");

          // Envia os dados em lotes de 500 itens para o Firebase
          (async () => {
            try {
              const count = await salvarBaseNoFirestoreLote(baseDados);
              showToast(`Base salva na nuvem com ${count} itens.`, "success");
            } catch (e) {
              mostrarErroFirebase(e, "Erro ao sincronizar com a nuvem.");
            }
          })();
        } else {
          showToast("Planilha inválida.", "error");
        }
      } catch (error) {
        mostrarErroFirebase(error, "Erro ao ler Excel.");
      }
    };
    reader.readAsArrayBuffer(file);
  });

DOM.inputData.value = new Date().toISOString().split("T")[0];

DOM.inputCodigo.addEventListener("input", (e) => {
  const cod = e.target.value.trim();
  if (baseDados[cod]) {
    DOM.inputMaterial.value = baseDados[cod];
    DOM.inputMaterial.className =
      "w-full rounded-xl border border-emerald-300 px-4 py-3 bg-emerald-50 text-emerald-800 font-bold focus:outline-none shadow-inner transition-colors text-sm";
    DOM.badgeEncontrado.classList.remove("opacity-0");
    if (DOM.statusForm) {
      DOM.statusForm.textContent = "Material encontrado na base.";
      DOM.statusForm.className = "text-xs text-emerald-600 font-semibold";
    }
  } else {
    DOM.badgeEncontrado.classList.add("opacity-0");
    DOM.inputMaterial.value = cod.length > 2 ? "Material não catalogado" : "";
    DOM.inputMaterial.className =
      cod.length > 2
        ? "w-full rounded-xl border border-red-200 px-4 py-3 bg-red-50 text-red-600 font-bold focus:outline-none shadow-inner transition-colors text-sm"
        : "w-full rounded-xl border border-slate-200 px-4 py-3 bg-slate-100/70 text-slate-500 focus:outline-none cursor-not-allowed shadow-inner transition-colors text-sm font-medium";
    if (DOM.statusForm) {
      DOM.statusForm.textContent =
        cod.length > 2
          ? "Código ainda não cadastrado."
          : "Informe o código do material.";
      DOM.statusForm.className = "text-xs text-amber-600 font-semibold";
    }
  }
});

// ==========================================
// 3. FIREBASE CONFIG
// ==========================================

try {
  const initAuth = async () => {
    // Esta lógica de token inicial parece específica para um ambiente, pode ser removida se não for usada.
    // if (typeof __initial_auth_token !== "undefined" && __initial_auth_token) {
    //   await signInWithCustomToken(auth, __initial_auth_token);
    // }
  };
  initAuth();
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      currentUser = user;

      // Força a atualização do token para garantir que as custom claims (ex: admin) sejam carregadas.
      const idTokenResult = await user.getIdTokenResult(true);
      const claims = idTokenResult.claims || {};
      isAdmin = claims.admin === true;

      // Atualizar UI com dados do usuário
      const userEmail = user.email || "visitante@coeng.com";
      let userNamePart = user.email
        ? user.email.split("@")[0].split(".")[0]
        : "Visitante";
      let fullName = userNamePart;
      let roleName = "Usuário Padrão";
      let roleClass =
        "text-xs text-blue-600 font-bold bg-blue-50 inline-block px-2 py-0.5 rounded-md mt-0.5";

      if (isAdmin) {
        roleName = "Administrador";
        roleClass =
          "text-xs text-brand-600 font-bold bg-brand-50 inline-block px-2 py-0.5 rounded-md mt-0.5";
      } else if (!user.email) {
        roleName = "Visitante";
        roleClass =
          "text-xs text-slate-500 font-bold bg-slate-100 inline-block px-2 py-0.5 rounded-md mt-0.5";
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

      // 3. Somente agora, com as permissões confirmadas, inicia a escuta dos dados.
      inicializarListenersDeDados();
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

/**
 * Inicia todos os listeners do Firestore após a autenticação e verificação de permissões.
 */
function inicializarListenersDeDados() {
  if (!currentUser) return;
  iniciarEscutaNotificacoes();
  carregarBaseDoFirestore();
  carregarEncarregadosDoFirestore();
  iniciarEscutaDeDados();
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
    if (!currentUser || isLoadingTabela) return; // Prevent submission if data is still loading
    const btn = btnSubmit || document.getElementById("btn-submit");
    const original = btn.innerHTML;
    btn.innerHTML = `${svgIcon("spinner", "w-4 h-4 animate-spin")} Processando...`;
    btn.disabled = true;
    const material = inputMaterial.value;
    const codigo = normalizarTexto(
      document.getElementById("input-codigo").value,
    );
    const quantidade = Number(DOM.inputQuantidade.value);
    const encarregado = normalizarTexto(DOM.selectEncarregado.value);

    if (!material || material.includes("Não catalogado") || !codigo) {
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
        data: DOM.inputData.value,
        codigo,
        material,
        quantidade,
        encarregado,
        baixa: "Não",
      });
      DOM.formLancamento.reset();
      DOM.inputData.value = new Date().toISOString().split("T")[0];
      DOM.inputMaterial.className =
        "w-full rounded-xl border border-slate-200 px-4 py-3 bg-slate-100/70 text-slate-500 focus:outline-none cursor-not-allowed shadow-inner transition-colors text-sm font-medium";
      DOM.badgeEncontrado.classList.add("opacity-0");
      if (DOM.statusForm) {
        DOM.statusForm.textContent = "Registro pronto para salvar.";
        DOM.statusForm.className = "text-xs text-slate-500 font-semibold";
      }
      showToast("Saída registrada com sucesso!");
      const qtdNotif = DOM.inputQuantidade.value;
      criarNotificacao(
        currentUser,
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

const deletarLancamento = (uid, docId, isAdmin) => {
  if (!currentUser) return;
  if (!isAdmin) {
    return showToast("Apenas o administrador pode excluir registros.", "error");
  }
  abrirModalConfirmacao(
    "Excluir Registro",
    "Atenção: Esta ação removerá a saída do banco de dados permanentemente.",
    async () => {
      try {
        await deletarLancamentoNoFirestore(uid, docId);
        showToast("Registro apagado.", "success");
      } catch (error) {
        mostrarErroFirebase(error, "Erro ao excluir o registro.");
      }
    },
    "Excluir",
  );
};

const toggleBaixa = async (uid, idOuIds, statusAtual) => {
  if (!currentUser) return;
  const novoStatus = statusAtual === "Sim" ? "Não" : "Sim";
  try {
    await alternarBaixaNoFirestore(uid, idOuIds, novoStatus);
    showToast(`Status alterado para "${novoStatus}".`, "success");
  } catch (error) {
    mostrarErroFirebase(error, "Erro ao sincronizar o status.");
  }
};

function iniciarEscutaDeDados() {
  if (!currentUser) return;
  isLoadingTabela = true;
  setIsLoadingDashboard(true);
  renderizarSkeletonTabela(); // From domUtils
  renderizarSkeletonDashboard(); // From domUtils
  escutarLancamentos(currentUser.uid, (snapshot) => {
    const novosDados = [];
    if (!snapshot.empty)
      snapshot.forEach((doc) => {
        novosDados.push({ ...doc.data(), id: doc.id });
      });
    setDadosAtuais(novosDados); // Use the new function to update the state
    isLoadingTabela = false;
    setIsLoadingDashboard(false);
    esconderSkeletonDashboard();
    aplicarFiltroPesquisa(isAdmin);
    atualizarDashboard();
    if (!dadosCarregadosToastMostrado) {
      dadosCarregadosToastMostrado = true;
      showToast("Dados carregados.", "success");
    }
  });
}

// Recupera os filtros salvos e configura os listeners
const savedFiltrosStr = localStorage.getItem("demap_filtros");
if (savedFiltrosStr) {
  try {
    const savedFiltros = JSON.parse(savedFiltrosStr);
    if (savedFiltros.search) DOM.searchInput.value = savedFiltros.search;
    if (DOM.btnClearSearch)
      DOM.btnClearSearch.classList.toggle("hidden", !savedFiltros.search);
    if (savedFiltros.encarregadoFiltro)
      DOM.filtroEncarregadoSelect.value = savedFiltros.encarregadoFiltro;
    if (savedFiltros.statusFiltro)
      DOM.filtroStatusSelect.value = savedFiltros.statusFiltro;
    if (savedFiltros.dataInicio)
      DOM.inputDataInicio.value = savedFiltros.dataInicio;
    if (savedFiltros.dataFim) DOM.inputDataFim.value = savedFiltros.dataFim;
    if (savedFiltros.ordenacao) {
      DOM.ordenacaoSelect.value = savedFiltros.ordenacao;
      const val = DOM.ordenacaoSelect.value;
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
  } catch (e) {
    console.error("Erro ao carregar filtros salvos:", e);
  }
}

DOM.searchInput.addEventListener(
  "input",
  debounce(() => {
    onFiltroChange();
    aplicarFiltroPesquisa(isAdmin);
  }, 300),
);
if (DOM.btnClearSearch) {
  DOM.btnClearSearch.addEventListener("click", () => {
    DOM.searchInput.value = "";
    DOM.btnClearSearch.classList.add("hidden");
    DOM.searchInput.focus();
    onFiltroChange();
    aplicarFiltroPesquisa(isAdmin);
  });
}

const setupFilterListeners = () => {
  const elements = [
    DOM.filtroEncarregadoSelect,
    DOM.filtroStatusSelect,
    DOM.inputDataInicio,
    DOM.inputDataFim,
  ];
  elements.forEach((el) =>
    el.addEventListener("change", () => {
      onFiltroChange();
      aplicarFiltroPesquisa(isAdmin);
    }),
  );
};
setupFilterListeners();

DOM.ordenacaoSelect.addEventListener("change", () => {
  const val = DOM.ordenacaoSelect.value;
  if (val === "data_desc") {
    setOrdenacaoAtual({ coluna: "data", crescente: false });
  } else if (val === "data_asc") {
    setOrdenacaoAtual({ coluna: "data", crescente: true });
  } else if (val === "material_asc") {
    setOrdenacaoAtual({ coluna: "material", crescente: true });
  } else if (val === "quantidade_desc") {
    setOrdenacaoAtual({ coluna: "quantidade", crescente: false });
  } else if (val === "encarregado_asc") {
    setOrdenacaoAtual({ coluna: "encarregado", crescente: true });
  }

  aplicarOrdenacao();
  renderizarGridLancamentos(isLoadingTabela, isAdmin);
});

// ==========================================
// 5. SERVICE WORKER (PWA INSTALÁVEL)
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
