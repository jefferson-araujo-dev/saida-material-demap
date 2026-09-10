import { db, appId } from "./firebase.js";
import {
  collection,
  addDoc,
  onSnapshot,
  deleteDoc,
  doc,
  getDoc,
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

// Doc leve com metadados da base de materiais (contagem + última atualização).
// Permite ao cliente decidir se precisa rebaixar a coleção inteira.
const baseMetaRef = () =>
  doc(db, "artifacts", appId, "materiais_meta", "version");

export const fetchBaseMetaDoFirestore = async () => {
  const snap = await getDoc(baseMetaRef());
  if (!snap.exists()) return null;
  const dados = snap.data() || {};
  return {
    count: dados.count || 0,
    updatedAtMs: dados.updatedAt?.toMillis ? dados.updatedAt.toMillis() : 0,
  };
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
  await setDoc(baseMetaRef(), {
    count: keys.length,
    updatedAt: serverTimestamp(),
  });
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

// Janela padrão de registros carregados pelo listener em tempo real.
// Mantém o custo de leitura e o uso de memória limitados mesmo com a coleção crescendo.
export const LIMITE_LANCAMENTOS_PADRAO = 500;

// Retorna os N lançamentos mais recentes. O filtro de soft-delete (campo `deleted`)
// é aplicado no cliente para não exigir índice composto e para não esconder
// documentos legados criados antes desse campo existir.
export const escutarLancamentos = (
  uid,
  callback,
  limite = LIMITE_LANCAMENTOS_PADRAO,
) => {
  const ref = collection(db, "artifacts", appId, "users", uid, "lancamentos");
  const q = query(ref, orderBy("createdAt", "desc"), limit(limite));
  return onSnapshot(q, callback, (error) =>
    console.error("Erro escutando lançamentos", error),
  );
};
