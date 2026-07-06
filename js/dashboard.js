/**
 * @file Módulo para gerenciamento do painel gerencial e gráficos.
 */

import {
  Chart,
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from "chart.js";
import {
  DOM,
  atualizarTextoSeExiste,
  formatarNome,
  renderizarSkeletonDashboard,
  esconderSkeletonDashboard,
  formatarDataParaDisplay,
} from "./domUtils.js";
import { dadosAtuais } from "./dataManagement.js";

Chart.register(
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
);

// ==========================================
// ESTADO GLOBAL DO DASHBOARD
// ==========================================
let chartEnc = null;
let chartMat = null;
export let pendingChartData = null;
export let isLoadingDashboard = true;

export function setIsLoadingDashboard(isLoading) {
  isLoadingDashboard = isLoading;
}

// ==========================================
// FUNÇÕES DO DASHBOARD
// ==========================================
export function atualizarDashboard() {
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

    const dataItem = formatarDataParaDisplay(i.data); // Usar formatarDataParaDisplay para consistência
    if (dataItem) {
      const [dia, mes, ano] = dataItem.split("/").map(Number);
      const dataObj = new Date(ano, mes - 1, dia);
      if (dataObj >= inicio7) resumo7d += Number(i.quantidade);
      if (dataObj >= inicio30) resumo30d += Number(i.quantidade);
      if (dataObj >= inicioMes) resumoMes += Number(i.quantidade);
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

export function renderizarGraficos(dEnc, dMat) {
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
          x: { grid: { display: false }, ticks: { font: { weight: "bold" } } },
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
          y: { grid: { display: false }, ticks: { font: { weight: "bold" } } },
        },
      },
    });
  }
}
