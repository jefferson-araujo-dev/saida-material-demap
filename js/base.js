// ==========================================
// BASE DE MATERIAIS (código → nome do material)
// ==========================================
import {
  fetchBaseDoFirestore,
  fetchBaseMetaDoFirestore,
  salvarBaseNoFirestoreLote,
} from "./database.js";
import { showToast } from "./ui.js";
import { state } from "./state.js";
import { mostrarErroFirebase, carregarXLSX } from "./utils.js";

export let baseDados = {
  14407: "LAMINADO DE FREIJÓ DE (200 MM A 400 MM)",
  20932: "COMPENSADO VIROLA 2.750mm X 1.600mm X 4mm",
  15934: "TUBO INDUSTRIAL TIPO METALON DE 25 mm X 25 mm",
};

export function atualizarUIBaseDados(count) {
  const statusBase = document.getElementById("status-base");
  if (statusBase) {
    statusBase.classList.remove("hidden");
    statusBase.classList.add("flex");
    document.getElementById("status-base-text").textContent =
      count.toLocaleString("pt-BR") + " itens integrados";
  }
}

const savedBase = localStorage.getItem("demap_base_dados");
if (savedBase) {
  baseDados = JSON.parse(savedBase);
  atualizarUIBaseDados(Object.keys(baseDados).length);
}

export const carregarBaseDoFirestore = async function () {
  try {
    // Só rebaixa a coleção inteira se a versão em cache estiver desatualizada.
    const meta = await fetchBaseMetaDoFirestore();
    const versaoLocal = Number(localStorage.getItem("demap_base_versao") || 0);
    const temBaseLocal = Object.keys(baseDados).length > 0;
    if (
      meta &&
      temBaseLocal &&
      meta.updatedAtMs &&
      meta.updatedAtMs === versaoLocal
    ) {
      return; // Base local já está sincronizada
    }

    const newBase = await fetchBaseDoFirestore();
    if (newBase) {
      baseDados = newBase;
      localStorage.setItem("demap_base_dados", JSON.stringify(baseDados));
      if (meta?.updatedAtMs)
        localStorage.setItem("demap_base_versao", String(meta.updatedAtMs));
      atualizarUIBaseDados(Object.keys(baseDados).length);
    }
  } catch (error) {
    mostrarErroFirebase(
      error,
      "Não foi possível carregar a base de materiais.",
    );
  }
};

document
  .getElementById("input-excel-base")
  .addEventListener("change", function (e) {
    if (!state.isAdmin) {
      showToast("Apenas o administrador pode carregar a base.", "error");
      e.target.value = "";
      return;
    }
    const file = e.target.files[0];
    if (!file) return;
    showToast("Sincronizando base...", "info");
    const reader = new FileReader();
    reader.onload = async function (event) {
      try {
        const XLSX = await carregarXLSX();
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
            } catch {
              showToast("Erro ao sincronizar com a nuvem.", "error");
            }
          })();
        } else {
          showToast("Planilha inválida.", "error");
        }
      } catch {
        showToast("Erro ao ler Excel.", "error");
      }
    };
    reader.readAsArrayBuffer(file);
  });
