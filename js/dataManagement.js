/**
 * @file Módulo para gerenciamento de dados, filtros, ordenação e paginação da tabela de lançamentos.
 */
import {
  DOM,
  escapeHTML,
  formatarDataParaDisplay,
  mostrarErroFirebase,
  renderizarSkeletonTabela,
  debounce,
  svgIcon,
} from "./domUtils.js";
import { showToast } from "./ui.js";
import {
  escutarLancamentos,
  deletarLancamentoNoFirestore,
  alternarBaixaNoFirestore,
  escutarEncarregados,
  salvarEncarregadoNoFirestore,
  removerEncarregadoNoFirestore,
  fetchBaseDoFirestore,
  salvarBaseNoFirestoreLote,
} from "./database.js";
import { abrirModalConfirmacao } from "./modals.js";
import { normalizarData, normalizarTexto } from "./normalizacao.mjs";
import { criarNotificacao } from "./notifications.js";

// ==========================================
// ESTADO GLOBAL DO GERENCIAMENTO DE DADOS
// ==========================================
export let dadosAtuais = [];
export let dadosFiltrados = [];
export let ordenacaoAtual = { coluna: "data", crescente: false };
export let paginaAtual = 1;
export let itensPorPagina = 9;
export let encarregados = [];
export let baseDados = {
  14407: "LAMINADO DE FREIJÓ DE (200 MM A 400 MM)",
  20932: "COMPENSADO VIROLA 2.750mm X 1.600mm X 4mm",
  15934: "TUBO INDUSTRIAL TIPO METALON DE 25 mm X 25 mm",
};

export function setDadosAtuais(novosDados) {
  dadosAtuais = novosDados;
}

export function setItensPorPagina(novosItens) {
  itensPorPagina = novosItens;
}

export function setOrdenacaoAtual(novaOrdenacao) {
  ordenacaoAtual = novaOrdenacao;
}

// ==========================================
// CONFIGURAÇÕES LOCAIS
// ==========================================
const carregarConfiguracoesLocais = () => {
  const savedConfig = localStorage.getItem("demap_configuracoes");
  if (savedConfig) {
    try {
      const parsed = JSON.parse(savedConfig);
      if (parsed.itensPorPagina) itensPorPagina = parsed.itensPorPagina;
    } catch (e) {
      console.error("Erro ao carregar configurações locais:", e);
    }
  }
};
carregarConfiguracoesLocais();

const carregarBaseLocal = () => {
  const savedBase = localStorage.getItem("demap_base_dados");
  if (savedBase) {
    baseDados = JSON.parse(savedBase);
    atualizarUIBaseDados(Object.keys(baseDados).length);
  }
};
carregarBaseLocal();

// ==========================================
// FUNÇÕES DE RENDERIZAÇÃO E ATUALIZAÇÃO DA UI
// ==========================================
export function renderizarSelectEncarregados() {
  const select = DOM.selectEncarregado;
  const filtroSelect = DOM.filtroEncarregadoSelect;

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

function atualizarUIBaseDados(count) {
  const statusBase = document.getElementById("status-base");
  if (statusBase) {
    statusBase.classList.remove("hidden");
    statusBase.classList.add("flex");
    document.getElementById("status-base-text").textContent =
      count.toLocaleString("pt-BR") + " itens integrados";
  }
}

export function renderizarGridLancamentos(isLoadingTabela, isAdmin) {
  if (isLoadingTabela) {
    // isLoadingTabela é global em app.js, precisa ser passado ou importado
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
        ? `<button data-action="toggle-baixa" data-id="${idArg}" data-status="Sim" class="flex-1 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5">${svgIcon("checkDouble", "w-4 h-4")} Concluído</button>`
        : `<button data-action="toggle-baixa" data-id="${idArg}" data-status="Não" class="flex-1 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5">${svgIcon("clock", "w-4 h-4")} Pendente</button>`;

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

  DOM.tabInfo.textContent = `Pág. ${paginaAtual} de ${paginas} (${total} itens)`;
  DOM.pagInfo.textContent = `${paginaAtual} / ${paginas}`;
  DOM.btnPrev.disabled = paginaAtual === 1;
  DOM.btnNext.disabled = paginaAtual === paginas;
}

export const mudarPagina = (dir) => {
  // Esta função agora será chamada de um wrapper em app.js que passará os parâmetros necessários
  paginaAtual += dir;
};

// ==========================================
// FILTROS E ORDENAÇÃO
// ==========================================
const parseDataFiltro = (valor) => {
  const dataNormal = normalizarData(valor);
  if (!dataNormal) return null;
  const [ano, mes, dia] = dataNormal.split("-").map(Number);
  if (!ano || !mes || !dia) return null;
  return new Date(ano, mes - 1, dia);
};

export function aplicarFiltroPesquisa(isAdmin) {
  const termo = DOM.searchInput.value.toLowerCase().trim();
  const encarregadoSelecionado = DOM.filtroEncarregadoSelect.value;
  const statusSelecionado = DOM.filtroStatusSelect.value;
  const dataInicio = DOM.inputDataInicio.value
    ? parseDataFiltro(DOM.inputDataInicio.value)
    : null;
  const dataFim = DOM.inputDataFim.value
    ? parseDataFiltro(DOM.inputDataFim.value)
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
  renderizarGridLancamentos(isAdmin);
}

export function aplicarOrdenacao() {
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

export const salvarFiltros = () => {
  localStorage.setItem(
    "demap_filtros",
    JSON.stringify({
      search: DOM.searchInput.value,
      encarregadoFiltro: DOM.filtroEncarregadoSelect.value,
      statusFiltro: DOM.filtroStatusSelect.value,
      dataInicio: DOM.inputDataInicio.value,
      dataFim: DOM.inputDataFim.value,
      ordenacao: DOM.ordenacaoSelect.value,
    }),
  );
};

export const limparFiltros = () => {
  DOM.searchInput.value = "";
  if (DOM.btnClearSearch) DOM.btnClearSearch.classList.add("hidden");
  DOM.filtroEncarregadoSelect.value = "";
  DOM.filtroStatusSelect.value = "";
  DOM.inputDataInicio.value = "";
  DOM.inputDataFim.value = "";
  DOM.ordenacaoSelect.value = "data_desc";

  paginaAtual = 1;
  ordenacaoAtual = { coluna: "data", crescente: false };

  salvarFiltros();
};

export const onFiltroChange = () => {
  paginaAtual = 1;
  if (DOM.btnClearSearch) {
    if (DOM.searchInput.value.trim() !== "")
      DOM.btnClearSearch.classList.remove("hidden");
    else DOM.btnClearSearch.classList.add("hidden");
  }
  salvarFiltros();
};

// ==========================================
// FUNÇÕES DE INTERAÇÃO COM FIRESTORE
// ==========================================
export const carregarBaseDoFirestore = async function () {
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

export const carregarEncarregadosDoFirestore = function () {
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

export const removerEncarregadoSelecionado = async (isAdmin, currentUser) => {
  if (!isAdmin) {
    return showToast(
      "Apenas o administrador pode remover encarregados.",
      "error",
    );
  }
  const select = DOM.selectEncarregado;
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
        criarNotificacao(
          currentUser,
          "Encarregado Removido",
          `O encarregado "${encarregado}" foi removido.`,
          "info",
        );
      } catch (error) {
        mostrarErroFirebase(error, "Erro ao remover encarregado.");
      }
    },
    "Excluir",
  );
};
