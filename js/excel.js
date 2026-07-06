/**
 * @file Módulo para importação e exportação de dados Excel.
 */

import * as XLSX from "xlsx";
import { showToast } from "./ui.js";
import {
  normalizarData,
  normalizarLancamentoImportado,
} from "./normalizacao.mjs";
import { dadosFiltrados, dadosAtuais } from "./dataManagement.js";

// ==========================================
// ESTADO GLOBAL DO EXCEL
// ==========================================
export const colunasExportacaoMeta = {
  data: "Data",
  codigo: "Código",
  material: "Material",
  quantidade: "Quantidade",
  encarregado: "Encarregado",
  baixa: "Baixa",
};
export let colunasExportacaoSelecionadas = [];

export const setColunasExportacaoSelecionadas = (cols) => {
  colunasExportacaoSelecionadas = cols;
};

// ==========================================
// FUNÇÕES DE EXCEL
// ==========================================
export const carregarColunasExportacao = () => {
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
carregarColunasExportacao();

export const exportarExcel = () => {
  if (!dadosFiltrados.length)
    return showToast("Sem dados para exportar.", "info");

  const searchInput = document.getElementById("input-search");
  const filtroEncarregadoSelect = document.getElementById(
    "select-filtro-encarregado",
  );
  const filtroStatusSelect = document.getElementById("select-filtro-status");
  const inputDataInicio = document.getElementById("input-data-de");
  const inputDataFim = document.getElementById("input-data-ate");

  const filtrosResumo = [
    searchInput.value ? `Busca: ${searchInput.value}` : "",
    filtroEncarregadoSelect.value
      ? `Encarregado: ${filtroEncarregadoSelect.value}`
      : "",
    filtroStatusSelect.value ? `Status: ${filtroStatusSelect.value}` : "",
    inputDataInicio.value ? `De: ${inputDataInicio.value}` : "",
    inputDataFim.value ? `Até: ${inputDataFim.value}` : "",
  ].filter(Boolean);

  const colunasValidas = (colunasExportacaoSelecionadas || []).filter(
    (coluna) =>
      Object.prototype.hasOwnProperty.call(colunasExportacaoMeta, coluna),
  );

  const data = dadosFiltrados.map((i) => {
    const linha = {};
    (colunasValidas.length
      ? colunasValidas
      : Object.keys(colunasExportacaoMeta)
    ).forEach((coluna) => {
      if (coluna === "data") {
        linha[colunasExportacaoMeta[coluna]] = normalizarData(i.data); // Usar normalizarData para garantir formato YYYY-MM-DD
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
