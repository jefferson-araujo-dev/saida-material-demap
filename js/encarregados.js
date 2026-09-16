// ==========================================
// ENCARREGADOS (responsáveis pelas saídas de material)
// ==========================================
import {
  salvarEncarregadoNoFirestore,
  removerEncarregadoNoFirestore,
  escutarEncarregados,
} from "./database.js";
import { showToast } from "./ui.js";
import { state } from "./state.js";
import { mostrarErroFirebase } from "./utils.js";
import { abrirModalConfirmacao, fecharModalPrompt } from "./modal.js";
import { criarNotificacao } from "./notificacoes.js";

export let encarregados = [];

export function renderizarSelectEncarregados() {
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

export const confirmarModalPrompt = async () => {
  const input = document.getElementById("input-modal-prompt");
  const novoNome = input.value.trim();
  if (novoNome) {
    if (!encarregados.includes(novoNome)) {
      encarregados.push(novoNome);
      renderizarSelectEncarregados();
      document.getElementById("select-encarregado").value = novoNome;
      fecharModalPrompt();

      // Salvar na nuvem (Firestore). Se falhar, desfaz a adição local para
      // não deixar o usuário achando que foi salvo quando não foi.
      try {
        await salvarEncarregadoNoFirestore(novoNome);
        showToast(`Encarregado "${novoNome}" adicionado!`, "success");
        criarNotificacao(
          "Novo Responsável",
          `O encarregado "${novoNome}" foi adicionado.`,
          "info",
        );
      } catch (e) {
        encarregados = encarregados.filter((nome) => nome !== novoNome);
        renderizarSelectEncarregados();
        mostrarErroFirebase(e, "Não foi possível salvar o encarregado.");
      }
    } else {
      showToast("Este encarregado já existe.", "error");
    }
  } else {
    input.focus();
  }
};

export const removerEncarregadoSelecionado = () => {
  if (!state.isAdmin) {
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
      } catch {
        showToast("Erro ao remover encarregado.", "error");
      }
    },
    "Excluir",
  );
};
