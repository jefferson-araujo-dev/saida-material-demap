// ==========================================
// LANÇAMENTOS (CRUD, grade, filtros, paginação, exportação)
// ==========================================
import {
  adicionarLancamentoNoFirestore,
  softDeletarLancamentoNoFirestore, // Cancelamento (soft-delete)
  atualizarLancamentoNoFirestore,
  alternarBaixaNoFirestore,
  salvarLancamentosEmLote,
  escutarLancamentos,
  LIMITE_LANCAMENTOS_PADRAO,
  registrarAuditoria,
} from "./database.js";
import { svgIcon, showToast, escapeHTML, toggleDropdown } from "./ui.js";
import { state } from "./state.js";
import {
  obterDataLocalFormatada,
  formatarDataParaDisplay,
  parseDataFiltro,
  debounce,
  mostrarErroFirebase,
  carregarXLSX,
} from "./utils.js";
import { abrirModal, fecharModal, abrirModalConfirmacao } from "./modal.js";
import {
  normalizarLancamentoImportado,
  normalizarTexto,
} from "./normalizacao.mjs";
import {
  filtrarLancamentos,
  agruparLancamentos,
  ordenarLancamentos,
  calcularPaginacao,
} from "./lancamentos-logica.js";
import { encarregados } from "./encarregados.js";
import { baseDados } from "./base.js";
import { criarNotificacao } from "./notificacoes.js";
import {
  atualizarDashboard,
  renderizarSkeletonDashboard,
  esconderSkeletonDashboard,
} from "./dashboard.js";

// ==========================================
// CACHE DE DOM
// ==========================================
const DOM = {
  grid: document.getElementById("grid-lancamentos"),
  tabInfo: document.getElementById("tabela-info"),
  pagInfo: document.getElementById("tabela-paginacao-info"),
  btnPrev: document.getElementById("btn-prev-page"),
  btnNext: document.getElementById("btn-next-page"),
};

const inputCodigo = document.getElementById("input-codigo");
const inputMaterial = document.getElementById("input-material");
const badgeEncontrado = document.getElementById("badge-encontrado");
const btnSubmit = document.getElementById("btn-submit");
const statusForm = document.getElementById("status-form");

const searchInput = document.getElementById("input-search");
const btnClearSearch = document.getElementById("btn-clear-search");
const ordenacaoSelect = document.getElementById("select-ordenacao");
const filtroEncarregadoSelect = document.getElementById(
  "select-filtro-encarregado",
);
const filtroStatusSelect = document.getElementById("select-filtro-status");
const inputDataInicio = document.getElementById("input-data-de");
const inputDataFim = document.getElementById("input-data-ate");

// ==========================================
// ESTADO DO MÓDULO
// ==========================================
let dadosFiltrados = [];
let ordenacaoAtual = { coluna: "data", crescente: false };
let paginaAtual = 1;
let itensPorPagina = 9;
let unsubscribeLancamentos = null;
let limiteLancamentos = LIMITE_LANCAMENTOS_PADRAO;
let atingiuLimiteLancamentos = false;
let isLoadingTabela = true;
let dadosCarregadosToastMostrado = false;

const colunasExportacaoMeta = {
  data: "Data",
  codigo: "Código",
  material: "Material",
  quantidade: "Quantidade",
  encarregado: "Encarregado",
  baixa: "Baixa",
};
let colunasExportacaoSelecionadas = [];

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
  } catch {
    colunasExportacaoSelecionadas = Object.keys(colunasExportacaoMeta);
  }
};
carregarColunasExportacao();

// Carrega as configurações locais
const savedConfig = localStorage.getItem("demap_configuracoes");
if (savedConfig) {
  try {
    const parsed = JSON.parse(savedConfig);
    if (parsed.itensPorPagina) itensPorPagina = parsed.itensPorPagina;
  } catch {}
}

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

// ==========================================
// EDIÇÃO DE LANÇAMENTO
// ==========================================
export const abrirModalEdicao = (id) => {
  const lancamento = state.dadosAtuais.find((d) => d.id === id);
  if (!lancamento) {
    showToast("Registro não encontrado para edição.", "error");
    return;
  }

  document.getElementById("edit-lancamento-id").value = lancamento.id;
  document.getElementById("edit-data").value = lancamento.data;
  document.getElementById("edit-quantidade").value = lancamento.quantidade;

  const select = document.getElementById("edit-encarregado");
  select.innerHTML = "";
  encarregados.forEach((nome) => {
    select.add(new Option(nome, nome));
  });
  select.value = lancamento.encarregado;

  abrirModal("modal-edicao", "modal-edicao-content");
};

export const fecharModalEdicao = () => {
  fecharModal("modal-edicao", "modal-edicao-content");
};

export const salvarEdicao = async () => {
  const id = document.getElementById("edit-lancamento-id").value;
  const novosDados = {
    data: document.getElementById("edit-data").value,
    quantidade: Number(document.getElementById("edit-quantidade").value),
    encarregado: document.getElementById("edit-encarregado").value,
  };

  if (
    !id ||
    !novosDados.data ||
    !novosDados.encarregado ||
    novosDados.quantidade <= 0
  ) {
    showToast("Por favor, preencha todos os campos corretamente.", "error");
    return;
  }

  const btn = document.getElementById("btn-salvar-edicao");
  const originalText = btn.innerHTML;
  btn.innerHTML = `${svgIcon("spinner", "w-4 h-4 animate-spin")} Salvando...`;
  btn.disabled = true;

  try {
    await atualizarLancamentoNoFirestore(
      state.currentUser.uid,
      id,
      novosDados,
      state.currentUser.displayName,
      state.currentUser.uid,
    );
    showToast("Lançamento atualizado com sucesso!", "success");
    registrarAuditoria(
      state.currentUser.uid,
      "correcao_lancamento",
      "lancamento",
      id,
      state.currentUser.displayName,
      state.currentUser.uid,
      { camposAlterados: Object.keys(novosDados) },
    );
    fecharModalEdicao();
  } catch (error) {
    mostrarErroFirebase(error, "Erro ao salvar as alterações.");
  } finally {
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
};

// ==========================================
// CONFIGURAÇÕES (itens por página)
// ==========================================
export const abrirModalConfiguracoes = () => {
  if (!state.isAdmin) {
    return showToast("Acesso restrito a administradores.", "error");
  }
  const dropdown = document.getElementById("user-dropdown");
  if (dropdown && !dropdown.classList.contains("opacity-0")) toggleDropdown();

  abrirModal("modal-configuracoes", "modal-configuracoes-content", () => {
    document.getElementById("config-itens-pagina").value = itensPorPagina;
  });
};

export const fecharModalConfiguracoes = () => {
  fecharModal("modal-configuracoes", "modal-configuracoes-content");
};

export const salvarConfiguracoes = () => {
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
// EXPORTAÇÃO PARA EXCEL
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
  colunasExportacaoSelecionadas = selecionadas;
  localStorage.setItem("demap_export_columns", JSON.stringify(selecionadas));
  fecharModalExportacao();
  exportarExcel(selecionadas);
};

const exportarExcel = async (
  colunasSelecionadas = colunasExportacaoSelecionadas,
) => {
  const XLSX = await carregarXLSX();
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
// FORMULÁRIO DE NOVO LANÇAMENTO
// ==========================================
document.getElementById("input-data").value = obterDataLocalFormatada();

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

document
  .getElementById("input-excel-historico")
  .addEventListener("change", async function (e) {
    const file = e.target.files[0];
    if (!file || !state.currentUser) return;
    showToast("Processando histórico...", "info");
    const reader = new FileReader();
    reader.onload = async function (event) {
      try {
        const XLSX = await carregarXLSX();
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
            lancamento.data &&
            lancamento.encarregado
          ) {
            lancamentosFormatados.push(lancamento);
          }
        }
        if (lancamentosFormatados.length > 0) {
          const count = await salvarLancamentosEmLote(
            state.currentUser.uid,
            lancamentosFormatados,
            state.currentUser.displayName,
            state.currentUser.uid,
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

document
  .getElementById("form-lancamento")
  .addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!state.currentUser) return;
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
      await adicionarLancamentoNoFirestore(
        state.currentUser.uid,
        {
          // Passa dados do criador
          data: document.getElementById("input-data").value,
          codigo,
          material,
          quantidade,
          encarregado,
          baixa: "Não",
        },
        state.currentUser.displayName,
        state.currentUser.uid,
      );
      document.getElementById("form-lancamento").reset();
      document.getElementById("input-data").value = obterDataLocalFormatada();
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
      registrarAuditoria(
        state.currentUser.uid,
        "criacao_lancamento",
        "lancamento",
        null,
        state.currentUser.displayName,
        state.currentUser.uid,
        { codigo, quantidade, encarregado },
      );
    } catch (error) {
      console.error(error);
      showToast("Erro no servidor. Tente novamente em instantes.", "error");
    } finally {
      btn.innerHTML = original;
      btn.disabled = false;
    }
  });

export const deletarLancamento = (docId) => {
  if (!state.currentUser) return;
  if (!state.isAdmin) {
    return showToast(
      "Apenas o administrador pode cancelar registros.",
      "error",
    );
  }
  abrirModalConfirmacao(
    "Cancelar Registro",
    "O lançamento será marcado como cancelado e continuará visível no histórico (nenhum dado é removido do banco).",
    async () => {
      // Motivo é opcional: não há campo dedicado no modal de confirmação
      // (fora de escopo alterar sua estrutura agora), mas a razão pode ser
      // capturada quando disponível.
      let motivo = null;
      try {
        motivo = window.prompt(
          "Motivo do cancelamento (opcional):",
          "",
        );
      } catch {
        motivo = null;
      }
      try {
        await softDeletarLancamentoNoFirestore(
          state.currentUser.uid,
          docId,
          state.currentUser.displayName,
          state.currentUser.uid,
          motivo && motivo.trim() ? motivo.trim() : null,
        );
        showToast("Registro cancelado.", "success");
        registrarAuditoria(
          state.currentUser.uid,
          "cancelamento_lancamento",
          "lancamento",
          docId,
          state.currentUser.displayName,
          state.currentUser.uid,
          { motivo: motivo && motivo.trim() ? motivo.trim() : null },
        );
      } catch (error) {
        mostrarErroFirebase(error, "Erro ao cancelar o registro.");
      }
    },
    "Cancelar Registro",
  );
};

export const toggleBaixa = async (idOuIds, statusAtual) => {
  if (!state.currentUser) return;
  const novoStatus = statusAtual === "Sim" ? "Não" : "Sim";
  try {
    await alternarBaixaNoFirestore(
      state.currentUser.uid,
      idOuIds,
      novoStatus,
      state.currentUser.displayName,
      state.currentUser.uid,
    );
    showToast(`Status alterado para "${novoStatus}".`, "success");
  } catch (error) {
    mostrarErroFirebase(error, "Erro ao sincronizar o status.");
  }
};

export function iniciarEscutaDeDados() {
  if (!state.currentUser) return;
  isLoadingTabela = true;
  state.isLoadingDashboard = true;
  renderizarSkeletonTabela();
  renderizarSkeletonDashboard();
  if (typeof unsubscribeLancamentos === "function") {
    unsubscribeLancamentos();
    unsubscribeLancamentos = null;
  }
  unsubscribeLancamentos = escutarLancamentos(
    state.currentUser.uid,
    (snapshot) => {
      atingiuLimiteLancamentos = snapshot.size >= limiteLancamentos;
      state.dadosAtuais = [];
      if (!snapshot.empty)
        snapshot.forEach((doc) => {
          const dados = doc.data();
          // Lançamentos cancelados (soft-delete) permanecem no histórico,
          // marcados como "Cancelado" na grade (ver renderizarGridLancamentos),
          // em vez de serem removidos da visualização.
          state.dadosAtuais.push({ ...dados, id: doc.id });
        });
      isLoadingTabela = false;
      state.isLoadingDashboard = false;
      esconderSkeletonDashboard();
      aplicarFiltroPesquisa();
      atualizarDashboard();
      if (!dadosCarregadosToastMostrado) {
        dadosCarregadosToastMostrado = true;
        showToast("Dados carregados.", "success");
      }
    },
    limiteLancamentos,
  );
}

export const carregarMaisLancamentos = () => {
  limiteLancamentos += LIMITE_LANCAMENTOS_PADRAO;
  showToast("Carregando mais registros...", "info");
  iniciarEscutaDeDados();
};

// ==========================================
// FILTROS, ORDENAÇÃO E PAGINAÇÃO
// ==========================================

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
  } catch {}
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

export const limparFiltros = () => {
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
  dadosFiltrados = ordenarLancamentos(dadosFiltrados, ordenacaoAtual);
  renderizarGridLancamentos();
});

function aplicarFiltroPesquisa() {
  const filtrados = filtrarLancamentos(state.dadosAtuais, {
    termo: searchInput.value,
    encarregado: filtroEncarregadoSelect.value,
    status: filtroStatusSelect.value,
    dataInicio: inputDataInicio.value
      ? parseDataFiltro(inputDataInicio.value)
      : null,
    dataFim: inputDataFim.value ? parseDataFiltro(inputDataFim.value) : null,
  });
  dadosFiltrados = ordenarLancamentos(
    agruparLancamentos(filtrados),
    ordenacaoAtual,
  );
  renderizarGridLancamentos();
}

function renderizarGridLancamentos() {
  if (isLoadingTabela) {
    renderizarSkeletonTabela();
    return;
  }

  const btnCarregarMais = document.getElementById("btn-carregar-mais");
  if (btnCarregarMais)
    btnCarregarMais.classList.toggle("hidden", !atingiuLimiteLancamentos);

  const total = dadosFiltrados.length;

  if (total === 0) {
    DOM.grid.innerHTML = `<div class="col-span-1 md:col-span-2 xl:col-span-3 flex flex-col items-center justify-center py-20 text-slate-400 bg-white rounded-3xl border border-slate-200 border-dashed">
                    <div class="bg-slate-50 p-5 rounded-full mb-4 ring-8 ring-slate-50/50 opacity-50">${svgIcon("folder", "w-10 h-10")}</div>
                    <h4 class="font-extrabold text-lg text-slate-700">Nenhum registro encontrado</h4>
                    <p class="text-sm mt-1">Altere os filtros de pesquisa ou adicione um novo lançamento.</p>
                </div>`;
    if (DOM.tabInfo) DOM.tabInfo.textContent = "0 registros";
    if (DOM.pagInfo) DOM.pagInfo.textContent = "0 / 0";
    if (DOM.btnPrev) DOM.btnPrev.disabled = true;
    if (DOM.btnNext) DOM.btnNext.disabled = true;
    return;
  }

  const paginacao = calcularPaginacao(total, paginaAtual, itensPorPagina);
  const { paginas, start, end } = paginacao;
  paginaAtual = paginacao.paginaAtual;

  let itensHTML = "";
  dadosFiltrados.slice(start, end).forEach((item) => {
    const dataBR = formatarDataParaDisplay(item.data);
    const baixaAtual = item.baixa || "Não";
    const cancelado = item.deleted === true;
    const borderColor = cancelado
      ? "border-t-slate-300"
      : baixaAtual === "Sim"
        ? "border-t-emerald-500"
        : "border-t-amber-500";

    const materialSeguro = escapeHTML(item.material);
    const encarregadoSeguro = escapeHTML(item.encarregado);

    // Valor do data-id: string JSON-like com aspas simples quando é um grupo
    // (ver parsing no handler de "toggle-baixa"), ou o id único caso contrário.
    const idBaixa = item.isGrouped
      ? `[${item.ids.map((id) => `'${id}'`).join(",")}]`
      : item.id;
    const btnClasses =
      "flex-1 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5";
    const btnBaixa =
      baixaAtual === "Sim"
        ? `<button data-action="toggle-baixa" data-id="${idBaixa}" data-status="Sim" class="${btnClasses} bg-emerald-50 hover:bg-emerald-100 text-emerald-700">${svgIcon("checkDouble", "w-4 h-4")} Concluído</button>`
        : `<button data-action="toggle-baixa" data-id="${idBaixa}" data-status="Não" class="${btnClasses} bg-amber-50 hover:bg-amber-100 text-amber-700">${svgIcon("clock", "w-4 h-4")} Pendente</button>`;

    itensHTML += `
                    <div class="bg-white rounded-2xl shadow-sm border border-slate-200/80 border-t-4 ${borderColor} p-4 sm:p-6 flex flex-col hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group ${cancelado ? "opacity-60" : ""}">
                        <div class="flex justify-between items-start mb-4">
                            <div class="bg-slate-100/80 px-2.5 py-1 rounded-md text-[10px] font-bold text-slate-500 tracking-widest border border-slate-200">
                                CÓD: ${escapeHTML(item.codigo)}
                            </div>
                            <div class="bg-brand-50 text-brand-600 px-2.5 py-1 rounded-md text-[10px] font-bold flex items-center gap-1">
                                ${svgIcon("calendar", "w-4 h-4")} ${dataBR}
                            </div>
                        </div>
                        ${cancelado ? `<div class="mb-2 inline-flex w-fit items-center gap-1 bg-red-50 text-red-600 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wide" title="${item.motivoCancelamento ? escapeHTML(item.motivoCancelamento) : "Cancelado"}">Cancelado</div>` : ""}
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
                            ${cancelado ? "" : btnBaixa}
                            ${
                              cancelado
                                ? `<div class="flex-1 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 bg-slate-50 text-slate-400 cursor-not-allowed" title="Registro cancelado — sem ações disponíveis">Sem ações</div>`
                                : item.isGrouped
                                  ? `<div class="w-16 flex-shrink-0 py-2.5 bg-brand-50 text-brand-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1 shadow-sm">${svgIcon("layer", "w-4 h-4")} ${item.ids.length}x</div>`
                                  : state.isAdmin
                                    ? `
                                  <button data-action="abrir-modal-edicao" data-id="${item.id}" class="w-12 flex-shrink-0 py-2.5 bg-slate-50 hover:bg-brand-50 text-slate-400 hover:text-brand-600 rounded-xl transition-colors flex items-center justify-center shadow-sm" title="Editar Registro"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L12.828 15H10v-2.828l8.586-8.586z"></path></svg></button>
                                  <button data-action="deletar-lancamento" data-id="${item.id}" class="w-12 flex-shrink-0 py-2.5 bg-slate-50 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-xl transition-colors flex items-center justify-center shadow-sm" title="Cancelar Registro">${svgIcon("trash", "w-4 h-4")}</button>
                                  `
                                    : `<div class="w-16 flex-shrink-0 py-2.5 bg-slate-50 text-slate-300 rounded-xl transition-colors flex items-center justify-center shadow-sm cursor-not-allowed" title="Sem permissão para editar/cancelar">${svgIcon("trash", "w-4 h-4")}</div>`
                            }
                        </div>
                    </div>`;
  });
  DOM.grid.innerHTML = itensHTML;

  if (DOM.tabInfo)
    DOM.tabInfo.textContent = `Pág. ${paginaAtual} de ${paginas} (${total} itens)`;
  if (DOM.pagInfo) DOM.pagInfo.textContent = `${paginaAtual} / ${paginas}`;
  if (DOM.btnPrev) DOM.btnPrev.disabled = paginaAtual === 1;
  if (DOM.btnNext) DOM.btnNext.disabled = paginaAtual === paginas;
}

export const mudarPagina = (dir) => {
  paginaAtual += dir;
  renderizarGridLancamentos();
};
