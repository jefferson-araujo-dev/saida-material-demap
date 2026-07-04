import { db, appId } from "./firebase.js";
import {
  collection,
  addDoc,
  onSnapshot,
  deleteDoc,
  doc,
  serverTimestamp,
  writeBatch,
  updateDoc,
  getDocs,
  setDoc,
  query,
  orderBy,
  limit,
} from "firebase/firestore";

// ==========================================
// NOTIFICAÇÕES
// ==========================================
export const limparNotificacoesNoFirestore = async (uid, ids) => {
  const batch = writeBatch(db);
  ids.forEach((id) => {
    const ref = doc(db, "artifacts", appId, "users", uid, "notificacoes", id);
    batch.update(ref, { lida: true });
  });
  await batch.commit();
};

export const criarNotificacaoNoFirestore = async (
  uid,
  titulo,
  mensagem,
  tipo = "info",
) => {
  const ref = collection(db, "artifacts", appId, "users", uid, "notificacoes");
  await addDoc(ref, {
    titulo,
    mensagem,
    tipo,
    lida: false,
    timestamp: serverTimestamp(),
  });
};

export const escutarNotificacoes = (uid, callback) => {
  const ref = collection(db, "artifacts", appId, "users", uid, "notificacoes");
  const q = query(ref, orderBy("timestamp", "desc"), limit(20));
  return onSnapshot(q, callback, (error) =>
    console.error("Erro escuta notificações", error),
  );
};

// ==========================================
// ENCARREGADOS E BASE DE MATERIAIS
// ==========================================
export const salvarEncarregadoNoFirestore = async (nome) => {
  await setDoc(doc(db, "artifacts", appId, "encarregados", nome), { nome });
};

export const removerEncarregadoNoFirestore = async (nome) => {
  await deleteDoc(doc(db, "artifacts", appId, "encarregados", nome));
};

export const escutarEncarregados = (callback) => {
  return onSnapshot(
    collection(db, "artifacts", appId, "encarregados"),
    callback,
    (err) => console.error("Erro encarregados", err),
  );
};

export const fetchBaseDoFirestore = async () => {
  const snap = await getDocs(collection(db, "artifacts", appId, "materiais"));
  let base = {};
  snap.forEach((d) => (base[d.id] = d.data().nome));
  return Object.keys(base).length > 0 ? base : null;
};

export const salvarBaseNoFirestoreLote = async (baseDados) => {
  const keys = Object.keys(baseDados);
  for (let i = 0; i < keys.length; i += 500) {
    const chunk = keys.slice(i, i + 500);
    const batch = writeBatch(db);
    chunk.forEach((cod) => {
      batch.set(doc(db, "artifacts", appId, "materiais", cod), {
        nome: baseDados[cod],
      });
    });
    await batch.commit();
  }
  return keys.length;
};

// ==========================================
// LANÇAMENTOS E HISTÓRICO
// ==========================================
export const adicionarLancamentoNoFirestore = async (uid, dados) => {
  const ref = collection(db, "artifacts", appId, "users", uid, "lancamentos");
  await addDoc(ref, { ...dados, timestamp: serverTimestamp() });
};

export const deletarLancamentoNoFirestore = async (uid, docId) => {
  await deleteDoc(
    doc(db, "artifacts", appId, "users", uid, "lancamentos", docId),
  );
};

export const alternarBaixaNoFirestore = async (uid, idOuIds, novoStatus) => {
  if (Array.isArray(idOuIds)) {
    const batch = writeBatch(db);
    idOuIds.forEach((id) => {
      const ref = doc(db, "artifacts", appId, "users", uid, "lancamentos", id);
      batch.update(ref, { baixa: novoStatus });
    });
    await batch.commit();
  } else {
    const ref = doc(
      db,
      "artifacts",
      appId,
      "users",
      uid,
      "lancamentos",
      idOuIds,
    );
    await updateDoc(ref, { baixa: novoStatus });
  }
};

export const salvarLancamentosEmLote = async (uid, lancamentos) => {
  const batch = writeBatch(db);
  const ref = collection(db, "artifacts", appId, "users", uid, "lancamentos");
  lancamentos.forEach((l) =>
    batch.set(doc(ref), { ...l, timestamp: serverTimestamp() }),
  );
  if (lancamentos.length > 0) await batch.commit();
  return lancamentos.length;
};

export const escutarLancamentos = (uid, callback) => {
  const ref = collection(db, "artifacts", appId, "users", uid, "lancamentos");
  return onSnapshot(ref, callback, (error) =>
    console.error("Erro escutando lançamentos", error),
  );
};
