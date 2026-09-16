// ==========================================
// PAINEL GERENCIAL (cartões-resumo e gráficos)
// ==========================================
import { state } from "./state.js";
import { atualizarTextoSeExiste, parseDataFiltro } from "./utils.js";

// Chart.js é carregado sob demanda (dynamic import) na primeira renderização
// do dashboard, para não pesar no bundle inicial de quem só usa Lançamentos.
let ChartPromise = null;
function carregarChart() {
  if (!ChartPromise) {
    ChartPromise = import("chart.js").then((mod) => {
      mod.Chart.register(
        mod.BarController,
        mod.BarElement,
        mod.CategoryScale,
        mod.LinearScale,
        mod.Tooltip,
        mod.Legend,
      );
      return mod.Chart;
    });
  }
  return ChartPromise;
}

let chartEnc = null;
let chartMat = null;

// Guarda os dados do último cálculo do painel quando a aba "dashboard" não
// está visível (Chart.js não renderiza corretamente em um canvas oculto).
// Ver renderizarGraficosPendentes(), chamado ao trocar para essa aba.
let pendingChartData = null;

// Apelidos exibidos nos rótulos dos gráficos. Configuráveis (não ficam no
// código): localStorage "demap_apelidos" = JSON de { "trecho do nome": "Apelido" },
// comparado em minúsculas. Sem configuração, usa a primeira palavra do nome
// (exceto para "José", ver formatarNome).
let apelidosEncarregados = {};
try {
  const salvos = localStorage.getItem("demap_apelidos");
  const parsed = salvos ? JSON.parse(salvos) : null;
  if (parsed && typeof parsed === "object") apelidosEncarregados = parsed;
} catch {}

// Remove acentos para comparações (ex.: "José" -> "jose"), já que os nomes
// no cadastro podem vir com ou sem acentuação.
const semAcento = (texto) => texto.normalize("NFD").replace(/[̀-ͯ]/g, "");

export const formatarNome = (nome) => {
  const n = String(nome ?? "")
    .toLowerCase()
    .trim();
  for (const [trecho, apelido] of Object.entries(apelidosEncarregados)) {
    if (trecho && n.includes(String(trecho).toLowerCase())) return apelido;
  }
  const palavras = String(nome ?? "")
    .split(" ")
    .filter(Boolean);
  // "José" sozinho não distingue bem entre pessoas diferentes no gráfico
  // (é um nome muito comum) — quando houver um segundo nome, usa-o no lugar.
  if (palavras[1] && semAcento(palavras[0] ?? "").toLowerCase() === "jose") {
    return palavras[1];
  }
  return palavras[0] ?? ""; // Padrão: primeira palavra
};

export const renderizarSkeletonDashboard = () => {
  const dashboardContent = document.getElementById("dashboard-content");
  const dashboardSkeleton = document.getElementById("dashboard-skeleton");
  if (dashboardContent) dashboardContent.classList.add("hidden");
  if (dashboardSkeleton) dashboardSkeleton.classList.remove("hidden");
};

export const esconderSkeletonDashboard = () => {
  const dashboardContent = document.getElementById("dashboard-content");
  const dashboardSkeleton = document.getElementById("dashboard-skeleton");
  if (dashboardContent) dashboardContent.classList.remove("hidden");
  if (dashboardSkeleton) dashboardSkeleton.classList.add("hidden");
};

export function atualizarDashboard() {
  if (state.isLoadingDashboard) {
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
  // Lançamentos cancelados permanecem em state.dadosAtuais (para aparecerem
  // no histórico), mas não devem contar nos indicadores/gráficos do painel.
  state.dadosAtuais
    .filter((i) => i.deleted !== true)
    .forEach((i) => {
    total += Number(i.quantidade);
    encSet.add(i.encarregado);
    matSet.add(i.codigo);
    volEnc[i.encarregado] = (volEnc[i.encarregado] || 0) + Number(i.quantidade);
    const materialNome = i.material || "";
    const matDesc =
      materialNome.length > 30
        ? materialNome.substring(0, 30) + "..."
        : materialNome;
    // Agrupa pelo nome completo (não pelo rótulo truncado) para não somar
    // materiais distintos que só compartilham o mesmo prefixo de 30 caracteres.
    if (!topMat[materialNome]) {
      topMat[materialNome] = { label: matDesc, vol: 0 };
    }
    topMat[materialNome].vol += Number(i.quantidade);

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
  let aMat = Object.values(topMat)
    .map((v) => ({ nome: v.label, vol: v.vol }))
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

// Chamado ao trocar para a aba "dashboard": se havia dados calculados
// enquanto a aba estava oculta, renderiza os gráficos agora.
export function renderizarGraficosPendentes() {
  if (!pendingChartData) return;
  renderizarGraficos(pendingChartData.aEnc, pendingChartData.aMat);
  pendingChartData = null;
}

async function renderizarGraficos(dEnc, dMat) {
  const Chart = await carregarChart();
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
    gradB.addColorStop(0, "#517f44");
    gradB.addColorStop(1, "#294321");
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
