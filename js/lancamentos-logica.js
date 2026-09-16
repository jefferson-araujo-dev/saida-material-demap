// ==========================================
// LÓGICA PURA DE LANÇAMENTOS (sem DOM)
// ==========================================
// Filtro, agrupamento, ordenação e paginação extraídos de lancamentos.js
// para funções puras (mesma entrada sempre produz a mesma saída, sem tocar
// no documento) — o que permite testar essas regras isoladamente.
import { parseDataFiltro } from "./utils.js";

// Filtra os lançamentos por texto livre (código/material/encarregado),
// encarregado, status de baixa e intervalo de datas.
// filtros.dataInicio/dataFim já vêm como Date (ou null), pois são calculados
// uma única vez pelo chamador, não por item.
export function filtrarLancamentos(itens, filtros = {}) {
  const {
    termo = "",
    encarregado = "",
    status = "",
    dataInicio = null,
    dataFim = null,
  } = filtros;
  const termoNormalizado = termo.toLowerCase().trim();
  const contemTermo = (valor) =>
    String(valor ?? "")
      .toLowerCase()
      .includes(termoNormalizado);

  return itens.filter((item) => {
    const matchTexto =
      termoNormalizado === "" ||
      contemTermo(item.codigo) ||
      contemTermo(item.material) ||
      contemTermo(item.encarregado);

    const matchEncarregado = !encarregado || item.encarregado === encarregado;
    const matchStatus = !status || (item.baixa || "Não") === status;

    let matchData = true;
    if (dataInicio || dataFim) {
      const dataItem = parseDataFiltro(item.data);
      matchData = false;
      if (dataItem) {
        const depoisDoInicio = !dataInicio || dataItem >= dataInicio;
        const antesDoFim = !dataFim || dataItem <= dataFim;
        matchData = depoisDoInicio && antesDoFim;
      }
    }

    return matchTexto && matchEncarregado && matchStatus && matchData;
  });
}

// Soma lançamentos do mesmo dia/código/encarregado/status num único cartão
// ("Somatório Diário Inteligente"), guardando os ids originais em `ids` para
// que ações como alternar baixa afetem todos de uma vez.
export function agruparLancamentos(itens) {
  const agrupados = {};
  itens.forEach((item) => {
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
  return Object.values(agrupados);
}

// Ordena (sem mutar a lista recebida) por uma coluna, numérica para
// "quantidade" e alfabética (case-insensitive) para as demais.
export function ordenarLancamentos(itens, ordenacao) {
  const { coluna, crescente } = ordenacao;
  return [...itens].sort((a, b) => {
    const vA =
      coluna === "quantidade"
        ? Number(a[coluna]) || 0
        : String(a[coluna] || "").toLowerCase();
    const vB =
      coluna === "quantidade"
        ? Number(b[coluna]) || 0
        : String(b[coluna] || "").toLowerCase();
    if (vA < vB) return crescente ? -1 : 1;
    if (vA > vB) return crescente ? 1 : -1;
    return 0;
  });
}

// Calcula o total de páginas e a fatia [start, end) da página atual,
// corrigindo paginaAtual para os limites válidos [1, paginas].
export function calcularPaginacao(totalItens, paginaAtual, itensPorPagina) {
  const paginas = Math.ceil(totalItens / itensPorPagina) || 1;
  let pagina = paginaAtual;
  if (pagina > paginas) pagina = paginas;
  if (pagina < 1) pagina = 1;
  const start = (pagina - 1) * itensPorPagina;
  const end = Math.min(start + itensPorPagina, totalItens);
  return { paginas, paginaAtual: pagina, start, end };
}
