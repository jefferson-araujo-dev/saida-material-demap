// ==========================================
// AUTENTICAÇÃO E PERFIL DO USUÁRIO
// ==========================================
import { auth } from "./firebase.js";
import {
  signInAnonymously,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  updateProfile,
  sendPasswordResetEmail,
} from "firebase/auth";
import { svgIcon, toggleDropdown, showToast } from "./ui.js";
import { state } from "./state.js";
import { mostrarErroFirebase } from "./utils.js";
import { abrirModal, fecharModal, abrirModalConfirmacao } from "./modal.js";
import { iniciarEscutaNotificacoes } from "./notificacoes.js";
import { carregarBaseDoFirestore } from "./base.js";
import { carregarEncarregadosDoFirestore } from "./encarregados.js";
import { iniciarEscutaDeDados } from "./lancamentos.js";

export const logout = () => {
  if (!auth) return;

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
      } catch {
        showToast("Erro ao sair.", "error");
      }
    },
    "Sair",
  );
};

export const abrirModalPerfil = () => {
  if (!state.currentUser) return;
  const dropdown = document.getElementById("user-dropdown");
  if (dropdown && !dropdown.classList.contains("opacity-0")) toggleDropdown();

  abrirModal("modal-perfil", "modal-perfil-content", () => {
    document.getElementById("input-perfil-email").value =
      state.currentUser.email || "visitante@coeng.com";
    document.getElementById("input-perfil-nome").value =
      document.getElementById("user-dropdown-name").textContent;
  });
};

export const fecharModalPerfil = () => {
  fecharModal("modal-perfil", "modal-perfil-content");
};

export const salvarPerfil = async () => {
  if (!state.currentUser) return;
  const novoNome = document.getElementById("input-perfil-nome").value.trim();
  if (!novoNome) return showToast("O nome não pode ficar vazio.", "error");

  const btn = document.getElementById("btn-salvar-perfil");
  const originalText = btn.innerHTML;
  btn.innerHTML = `${svgIcon("spinner", "w-4 h-4 animate-spin")} Salvando...`;
  btn.disabled = true;
  try {
    await updateProfile(state.currentUser, { displayName: novoNome });
    const headerNameEl = document.getElementById("header-user-name");
    if (headerNameEl) headerNameEl.textContent = novoNome.split(" ")[0];
    const dropNameEl = document.getElementById("user-dropdown-name");
    if (dropNameEl) dropNameEl.textContent = novoNome;
    const avatarBtnEl = document.getElementById("user-avatar-btn");
    if (avatarBtnEl) avatarBtnEl.textContent = novoNome.charAt(0).toUpperCase();
    showToast("Perfil atualizado com sucesso!", "success");
    fecharModalPerfil();
  } catch {
    showToast("Erro ao atualizar perfil.", "error");
  } finally {
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
};

export const enviarEmailTrocaSenha = async () => {
  if (!state.currentUser || !state.currentUser.email) {
    showToast("Apenas contas com e-mail podem alterar a senha.", "error");
    return;
  }
  const btn = document.getElementById("btn-trocar-senha");
  const originalText = btn.innerHTML;
  btn.innerHTML = `${svgIcon("spinner", "w-3.5 h-3.5 animate-spin")} ...`;
  btn.disabled = true;

  try {
    await sendPasswordResetEmail(auth, state.currentUser.email);
    showToast("Link de redefinição enviado para o seu e-mail!", "success");
  } catch {
    showToast("Erro ao processar solicitação de troca de senha.", "error");
  } finally {
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
};

try {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      state.currentUser = user;

      // O papel de administrador vem de uma Custom Claim (admin: true) no token
      // de ID, definida pelo Firebase Admin SDK (ver README). Não há mais e-mail
      // fixo no código.
      try {
        const tokenResult = await user.getIdTokenResult();
        state.isAdmin = tokenResult.claims.admin === true;
      } catch {
        state.isAdmin = false;
      }

      const capitalizar = (texto) =>
        texto ? texto.charAt(0).toUpperCase() + texto.slice(1) : texto;
      const userEmail = user.email || "visitante@coeng.com";
      const nomeBase =
        (user.displayName && user.displayName.trim()) ||
        (user.email ? user.email.split("@")[0].split(".")[0] : "Visitante");

      let roleName, roleClass;
      if (state.isAdmin) {
        roleName = "Administrador";
        roleClass =
          "text-xs text-brand-600 font-bold bg-brand-50 inline-block px-2 py-0.5 rounded-md mt-0.5";
      } else if (!user.email) {
        roleName = "Visitante";
        roleClass =
          "text-xs text-slate-500 font-bold bg-slate-100 inline-block px-2 py-0.5 rounded-md mt-0.5";
      } else {
        roleName = "Usuário Padrão";
        roleClass =
          "text-xs text-amber-700 font-bold bg-amber-50 inline-block px-2 py-0.5 rounded-md mt-0.5";
      }

      const displayNameFull =
        (user.displayName && user.displayName.trim()) || capitalizar(nomeBase);
      const displayNameHeader = capitalizar(displayNameFull.split(" ")[0]);
      const initial = displayNameHeader.charAt(0).toUpperCase();

      const headerNameEl = document.getElementById("header-user-name");
      if (headerNameEl) headerNameEl.textContent = displayNameHeader;

      const dropNameEl = document.getElementById("user-dropdown-name");
      if (dropNameEl) dropNameEl.textContent = displayNameFull;

      const dropEmailEl = document.getElementById("user-dropdown-email");
      if (dropEmailEl) dropEmailEl.textContent = userEmail;

      const roleEl = document.getElementById("header-user-role");
      if (roleEl) {
        roleEl.textContent = roleName;
        roleEl.className = roleClass;
      }

      const avatarBtnEl = document.getElementById("user-avatar-btn");
      if (avatarBtnEl) avatarBtnEl.textContent = initial;

      const btnConfig = document.getElementById("btn-menu-configuracoes");
      if (btnConfig) btnConfig.style.display = state.isAdmin ? "" : "none";

      const btnRemoverEnc = document.getElementById("btn-remover-encarregado");
      if (btnRemoverEnc)
        btnRemoverEnc.style.display = state.isAdmin ? "" : "none";

      const btnCarregarBase = document.getElementById("btn-carregar-base");
      if (btnCarregarBase)
        btnCarregarBase.style.display = state.isAdmin ? "" : "none";

      const loginScreen = document.getElementById("login-screen");
      if (loginScreen) {
        loginScreen.classList.add("opacity-0");
        setTimeout(() => loginScreen.classList.add("hidden"), 500);
      }
      iniciarEscutaNotificacoes();
      carregarBaseDoFirestore();
      carregarEncarregadosDoFirestore();
      iniciarEscutaDeDados();
    } else {
      const loginScreen = document.getElementById("login-screen");
      if (loginScreen) {
        loginScreen.classList.remove("hidden");
        setTimeout(() => loginScreen.classList.remove("opacity-0"), 10);
      }
    }
  });
} catch (error) {
  mostrarErroFirebase(error, "Falha de conexão com a nuvem.");
}

// Lógica do formulário de acesso
document.getElementById("form-login").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("login-email").value;
  const pass = document.getElementById("login-password").value;
  const btn = document.getElementById("btn-login");
  const originalText = btn.innerHTML;

  btn.innerHTML = `${svgIcon("spinner", "w-5 h-5 animate-spin")} Autenticando...`;
  btn.disabled = true;

  try {
    await signInWithEmailAndPassword(auth, email, pass);
    showToast("Acesso realizado com sucesso!", "success");
    // O onAuthStateChanged lidará com o fechamento da tela automaticamente
  } catch (error) {
    mostrarErroFirebase(error, "Não foi possível entrar no sistema.");
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
});

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
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
};
