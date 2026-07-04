import { db, appId } from "./firebase.js";
import {
  collection,
  addDoc,
  onSnapshot,
  deleteDoc,
  where, // Adicionado para filtrar documentos excluídos
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
export const adicionarLancamentoNoFirestore = async (
  uid,
  dados,
  createdBy,
  createdByUid,
) => {
  const ref = collection(db, "artifacts", appId, "users", uid, "lancamentos");
  await addDoc(ref, {
    ...dados,
    createdAt: serverTimestamp(),
    createdBy: createdBy,
    createdByUid: createdByUid,
    lastModifiedAt: serverTimestamp(), // Inicialmente, é o mesmo que createdAt
    lastModifiedBy: createdBy,
    lastModifiedByUid: createdByUid,
    deleted: false, // Marca como não excluído
  });
};

// Renomeada para softDeletarLancamentoNoFirestore para exclusão lógica
export const softDeletarLancamentoNoFirestore = async (
  uid,
  docId,
  deletedBy,
  deletedByUid,
) => {
  const docRef = doc(
    db,
    "artifacts",
    appId,
    "users",
    uid,
    "lancamentos",
    docId,
  );
  await updateDoc(docRef, {
    deleted: true,
    deletedAt: serverTimestamp(),
    deletedBy: deletedBy,
    deletedByUid: deletedByUid,
    lastModifiedAt: serverTimestamp(), // Atualiza o timestamp de modificação
    lastModifiedBy: deletedBy,
    lastModifiedByUid: deletedByUid,
  });
};

export const atualizarLancamentoNoFirestore = async (
  uid,
  docId,
  novosDados,
  modifiedBy,
  modifiedByUid,
) => {
  if (!uid || !docId)
    throw new Error("UID do usuário e ID do documento são obrigatórios.");
  const docRef = doc(
    db,
    "artifacts",
    appId,
    "users",
    uid,
    "lancamentos",
    docId,
  );

  await updateDoc(docRef, {
    ...novosDados,
    lastModifiedAt: serverTimestamp(),
    lastModifiedBy: modifiedBy,
    lastModifiedByUid: modifiedByUid,
  });
};

export const alternarBaixaNoFirestore = async (
  uid,
  idOuIds,
  novoStatus,
  modifiedBy,
  modifiedByUid,
) => {
  const updateData = {
    baixa: novoStatus,
    lastModifiedAt: serverTimestamp(),
    lastModifiedBy: modifiedBy,
    lastModifiedByUid: modifiedByUid,
  };

  if (Array.isArray(idOuIds)) {
    const batch = writeBatch(db);
    idOuIds.forEach((id) => {
      const ref = doc(db, "artifacts", appId, "users", uid, "lancamentos", id);
      batch.update(ref, updateData);
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
    await updateDoc(ref, updateData);
  }
};

export const salvarLancamentosEmLote = async (
  uid,
  lancamentos,
  createdBy,
  createdByUid,
) => {
  const batch = writeBatch(db);
  const ref = collection(db, "artifacts", appId, "users", uid, "lancamentos");
  lancamentos.forEach((l) =>
    batch.set(doc(ref), {
      ...l,
      createdAt: serverTimestamp(),
      createdBy: createdBy,
      createdByUid: createdByUid,
      lastModifiedAt: serverTimestamp(),
      lastModifiedBy: createdBy,
      lastModifiedByUid: createdByUid,
      deleted: false,
    }),
  );
  if (lancamentos.length > 0) await batch.commit();
  return lancamentos.length;
};

export const escutarLancamentos = (uid, callback) => {
  const ref = collection(db, "artifacts", appId, "users", uid, "lancamentos");
  // Filtra documentos que não foram marcados como excluídos
  const q = query(
    ref,
    where("deleted", "==", false),
    orderBy("createdAt", "desc"), // Alterado de "timestamp" para "createdAt"
  );
  return onSnapshot(q, callback, (error) =>
    console.error("Erro escutando lançamentos", error),
  );
};
