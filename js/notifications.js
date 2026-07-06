/**
 * @file Módulo para gerenciamento de notificações.
 */

import { showToast } from "./ui.js";
import {
  limparNotificacoesNoFirestore,
  criarNotificacaoNoFirestore,
  escutarNotificacoes,
} from "./database.js";
import { mostrarErroFirebase, svgIcon } from "./domUtils.js";

let notificacoesNaoLidas = [];

export const toggleNotifications = function () {
  const dropdown = document.getElementById("notifications-dropdown");
  if (dropdown) {
    dropdown.classList.toggle("opacity-0");
    dropdown.classList.toggle("pointer-events-none");
    dropdown.classList.toggle("scale-95");
  }
};

export const limparNotificacoes = async function (currentUser) {
  if (!notificacoesNaoLidas.length || !currentUser) return;
  try {
    await limparNotificacoesNoFirestore(currentUser.uid, notificacoesNaoLidas);
    showToast("Notificações lidas com sucesso!", "success");
    toggleNotifications();
  } catch (error) {
    mostrarErroFirebase(error, "Erro ao limpar notificações.");
  }
};

export const criarNotificacao = async function (
  currentUser,
  titulo,
  mensagem,
  tipo = "info",
) {
  if (!currentUser) return;
  try {
    await criarNotificacaoNoFirestore(currentUser.uid, titulo, mensagem, tipo);
  } catch (error) {
    mostrarErroFirebase(error, "Erro ao criar notificação.");
  }
};

export const iniciarEscutaNotificacoes = function (currentUser) {
  if (!currentUser) return;
  escutarNotificacoes(
    currentUser.uid,
    (snapshot) => {
      const lista = document.getElementById("lista-notificacoes");
      const badge = document.getElementById("badge-notificacoes");
      let html = "";
      notificacoesNaoLidas = [];

      if (snapshot.empty) {
        html = `
              <div class="p-8 text-center text-slate-400">
                <div class="bg-slate-50 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-300">
                  ${svgIcon("checkDouble", "w-6 h-6")}
                </div>
                <p class="text-xs font-bold text-slate-600">Tudo limpo por aqui</p>
                <p class="text-[10px] mt-1 font-medium">Você não possui novas notificações.</p>
              </div>
            `;
      } else {
        snapshot.forEach((docSnap) => {
          const notif = docSnap.data();
          if (!notif.lida) notificacoesNaoLidas.push(docSnap.id);

          const date = notif.timestamp ? notif.timestamp.toDate() : new Date();
          const timeStr =
            date.toLocaleDateString("pt-BR") +
            " às " +
            date.toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
            });

          const bgHover = notif.lida
            ? "hover:bg-slate-50"
            : "bg-brand-50/30 hover:bg-brand-50/50 cursor-pointer";
          const dot = notif.lida
            ? ""
            : `<div class="w-1.5 h-1.5 bg-brand-500 rounded-full mt-1.5 flex-shrink-0"></div>`;
          const textColor = notif.lida ? "text-slate-800" : "text-brand-700";

          html += `
                <div class="p-3 ${bgHover} rounded-xl transition-colors mb-1 border border-transparent hover:border-slate-100 group flex gap-2 items-start">
                  ${dot}<div><p class="text-xs font-bold ${textColor} transition-colors">${notif.titulo}</p><p class="text-[10px] text-slate-500 mt-1">${notif.mensagem}</p><p class="text-[9px] text-slate-400 mt-2 font-semibold uppercase tracking-wider">${timeStr}</p></div>
                </div>`;
        });
      }
      if (lista) lista.innerHTML = html;
      if (badge) {
        if (notificacoesNaoLidas.length > 0)
          badge.classList.remove("opacity-0");
        else badge.classList.add("opacity-0");
      }
    },
    (error) => mostrarErroFirebase(error, "Erro ao escutar notificações."),
  );
};
