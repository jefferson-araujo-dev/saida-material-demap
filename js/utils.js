// ==========================================
// UTILITÁRIOS GENÉRICOS (data, desempenho, erros do Firebase)
// ==========================================
import { showToast } from "./ui.js";
import { normalizarData } from "./normalizacao.mjs";

// XLSX (SheetJS) é carregado sob demanda, só quando o usuário importa ou
// exporta uma planilha (base de materiais, histórico ou relatório).
let XLSXPromise = null;
export function carregarXLSX() {
  if (!XLSXPromise) {
    XLSXPromise = import("xlsx");
  }
  return XLSXPromise;
}

export const debounce = (func, wait) => {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

// Retorna a data de hoje no fuso local no formato YYYY-MM-DD
// (evita o deslocamento de um dia causado por new Date().toISOString(), que usa UTC)
export const obterDataLocalFormatada = (data = new Date()) => {
  const ano = data.getFullYear();
  const mes = `${data.getMonth() + 1}`.padStart(2, "0");
  const dia = `${data.getDate()}`.padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
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

// Converte uma data de filtro (qualquer formato aceito por normalizarData)
// em um objeto Date local, usado tanto pelos filtros da grade de
// lançamentos quanto pelos resumos de 7/30 dias e mês do painel.
export const parseDataFiltro = (valor) => {
  const dataNormal = normalizarData(valor);
  if (!dataNormal) return null;
  const [ano, mes, dia] = dataNormal.split("-").map(Number);
  if (!ano || !mes || !dia) return null;
  return new Date(ano, mes - 1, dia);
};

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

export const mostrarErroFirebase = (
  error,
  fallback = "Não foi possível concluir a operação.",
) => {
  const mensagem = obterMensagemErroFirebase(error, fallback);
  showToast(mensagem, "error");
  return mensagem;
};
