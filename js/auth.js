/**
 * @file Módulo para gerenciamento de autenticação de usuários.
 */

import { auth } from "./firebase.js";
import {
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  sendPasswordResetEmail,
} from "firebase/auth";
import { showToast, toggleDropdown } from "./ui.js";
import { abrirModal, fecharModal, abrirModalConfirmacao } from "./modals.js";
import { mostrarErroFirebase, svgIcon } from "./domUtils.js";

// ==========================================
// FUNÇÕES DE AUTENTICAÇÃO
// ==========================================
export const logout = (currentUser) => {
  if (!auth || !currentUser) return;

  const dropdown = document.getElementById("user-dropdown");
  if (dropdown && !dropdown.classList.contains("opacity-0")) toggleDropdown();

  abrirModalConfirmacao(
    "Sair do Sistema",
    "Tem certeza de que deseja encerrar a sua sessão agora?",
    async () => {
      try {
        await signOut(auth);
        showToast("Sessão encerrada com sucesso.", "success");
        setTimeout(() => window.location.reload(), 1000);
      } catch (error) {
        mostrarErroFirebase(error, "Erro ao sair.");
      }
    },
    "Sair",
  );
};

export const abrirModalPerfil = (currentUser) => {
  if (!currentUser) return;
  const dropdown = document.getElementById("user-dropdown");
  if (dropdown && !dropdown.classList.contains("opacity-0")) toggleDropdown();

  abrirModal("modal-perfil", "modal-perfil-content", () => {
    document.getElementById("input-perfil-email").value =
      currentUser.email || "visitante@coeng.com";
    document.getElementById("input-perfil-nome").value =
      document.getElementById("user-dropdown-name").textContent;
  });
};

export const fecharModalPerfil = () => {
  fecharModal("modal-perfil", "modal-perfil-content");
};

export const salvarPerfil = async (currentUser) => {
  if (!currentUser) return;
  const novoNome = document.getElementById("input-perfil-nome").value.trim();
  if (!novoNome) return showToast("O nome não pode ficar vazio.", "error");

  const btn = document.getElementById("btn-salvar-perfil");
  const originalText = btn.innerHTML;
  btn.innerHTML = `${svgIcon("spinner", "w-4 h-4 animate-spin")} Salvando...`;
  btn.disabled = true;
  try {
    await updateProfile(currentUser, { displayName: novoNome });
    const headerNameEl = document.getElementById("header-user-name");
    if (headerNameEl) headerNameEl.textContent = novoNome.split(" ")[0];
    const dropNameEl = document.getElementById("user-dropdown-name");
    if (dropNameEl) dropNameEl.textContent = novoNome;
    const avatarBtnEl = document.getElementById("user-avatar-btn");
    if (avatarBtnEl) avatarBtnEl.textContent = novoNome.charAt(0).toUpperCase();
    showToast("Perfil atualizado com sucesso!", "success");
    fecharModalPerfil();
  } catch (error) {
    mostrarErroFirebase(error, "Erro ao atualizar perfil.");
  } finally {
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
};

export const enviarEmailTrocaSenha = async (currentUser) => {
  if (!currentUser || !currentUser.email) {
    showToast("Apenas contas com e-mail podem alterar a senha.", "error");
    return;
  }
  const btn = document.getElementById("btn-trocar-senha");
  const originalText = btn.innerHTML;
  btn.innerHTML = `${svgIcon("spinner", "w-3.5 h-3.5 animate-spin")} ...`;
  btn.disabled = true;

  try {
    await sendPasswordResetEmail(auth, currentUser.email);
    showToast("Link de redefinição enviado para o seu e-mail!", "success");
  } catch (error) {
    mostrarErroFirebase(
      error,
      "Erro ao processar solicitação de troca de senha.",
    );
  } finally {
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
};

export const loginAnonimo = async () => {
  const btn = document.getElementById("btn-login-anonimo");
  const originalText = btn.innerHTML;
  btn.innerHTML = `${svgIcon("spinner", "w-4 h-4 animate-spin")} Aguarde...`;
  btn.disabled = true;
  try {
    await signInAnonymously(auth);
    showToast("Acesso Visitante liberado.", "success");
  } catch (error) {
    mostrarErroFirebase(error, "Erro ao acessar anonimamente.");
  } finally {
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
};

export { signInWithEmailAndPassword };
