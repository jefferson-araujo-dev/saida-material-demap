// ==========================================
// ESTADO COMPARTILHADO ENTRE MÓDULOS
// ==========================================
// Um único objeto mutável, importado por referência em cada módulo que
// precisa ler ou escrever esses campos. Módulos ES não permitem reatribuir
// um binding importado (`import { x } from ...; x = 1` é erro), então o
// padrão aqui é sempre mutar propriedades do objeto (`state.currentUser = ...`)
// em vez de reatribuir a importação inteira.
export const state = {
  // Preenchido por auth.js a partir do onAuthStateChanged do Firebase.
  currentUser: null,
  isAdmin: false,

  // Preenchido por lancamentos.js (listener em tempo real do Firestore) e
  // lido também por dashboard.js para montar os cartões e gráficos do painel.
  dadosAtuais: [],
  isLoadingDashboard: true,
};
