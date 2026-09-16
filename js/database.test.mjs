import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./firebase.js", () => ({
  db: {},
  appId: "test-app",
}));

// Simula o SDK do Firestore o suficiente para testar a lógica de
// particionamento de batches, sem precisar de um Firestore real.
const commits = [];
const updateDocCalls = [];
const addDocCalls = [];
let docAntesDeAtualizar = {};
vi.mock("firebase/firestore", () => ({
  collection: (...args) => ({ path: args.slice(1).join("/") }),
  doc: (...args) => ({ path: args.slice(1).join("/") || "auto-id" }),
  serverTimestamp: () => "SERVER_TIMESTAMP",
  writeBatch: () => {
    const ops = [];
    const batch = {
      set: (ref, data) => ops.push({ type: "set", ref, data }),
      update: (ref, data) => ops.push({ type: "update", ref, data }),
      commit: vi.fn(async () => {
        commits.push(ops.slice());
      }),
    };
    return batch;
  },
  updateDoc: vi.fn(async (ref, data) => {
    updateDocCalls.push(data);
  }),
  addDoc: vi.fn(async (ref, data) => {
    addDocCalls.push(data);
  }),
  getDoc: vi.fn(async () => ({
    exists: () => Object.keys(docAntesDeAtualizar).length > 0,
    data: () => docAntesDeAtualizar,
  })),
  arrayUnion: (value) => ({ __arrayUnion: value }),
}));

const {
  salvarLancamentosEmLote,
  alternarBaixaNoFirestore,
  atualizarLancamentoNoFirestore,
  softDeletarLancamentoNoFirestore,
  registrarAuditoria,
} = await import("./database.js");

beforeEach(() => {
  commits.length = 0;
  updateDocCalls.length = 0;
  addDocCalls.length = 0;
  docAntesDeAtualizar = {};
});

describe("salvarLancamentosEmLote", () => {
  it("faz um único commit quando há 500 ou menos lançamentos", async () => {
    const lancamentos = Array.from({ length: 500 }, (_, i) => ({
      codigo: String(i),
    }));
    await salvarLancamentosEmLote("uid1", lancamentos, "Fulano", "uid1");
    expect(commits).toHaveLength(1);
    expect(commits[0]).toHaveLength(500);
  });

  it("particiona em múltiplos batches ao passar do limite de 500 escritas do Firestore", async () => {
    const lancamentos = Array.from({ length: 1201 }, (_, i) => ({
      codigo: String(i),
    }));
    const total = await salvarLancamentosEmLote(
      "uid1",
      lancamentos,
      "Fulano",
      "uid1",
    );
    expect(total).toBe(1201);
    expect(commits).toHaveLength(3);
    expect(commits[0]).toHaveLength(500);
    expect(commits[1]).toHaveLength(500);
    expect(commits[2]).toHaveLength(201);
  });

  it("não faz nenhum commit para uma lista vazia", async () => {
    await salvarLancamentosEmLote("uid1", [], "Fulano", "uid1");
    expect(commits).toHaveLength(0);
  });
});

describe("alternarBaixaNoFirestore (seleção em massa)", () => {
  it("particiona ids em lotes de 500 ao alternar baixa de muitos lançamentos", async () => {
    const ids = Array.from({ length: 750 }, (_, i) => `id-${i}`);
    await alternarBaixaNoFirestore("uid1", ids, "Sim", "Fulano", "uid1");
    expect(commits).toHaveLength(2);
    expect(commits[0]).toHaveLength(500);
    expect(commits[1]).toHaveLength(250);
  });
});

describe("atualizarLancamentoNoFirestore (correção auditável)", () => {
  it("grava historicoEdicoes com valores antes/depois apenas dos campos alterados", async () => {
    docAntesDeAtualizar = {
      quantidade: 10,
      encarregado: "Carlos Silva",
      data: "2026-03-01",
    };
    await atualizarLancamentoNoFirestore(
      "uid1",
      "doc1",
      { quantidade: 20, encarregado: "Carlos Silva" },
      "Admin",
      "uidAdmin",
    );
    expect(updateDocCalls).toHaveLength(1);
    const payload = updateDocCalls[0];
    expect(payload.quantidade).toBe(20);
    expect(payload.historicoEdicoes.__arrayUnion.campos).toEqual([
      "quantidade",
    ]);
    expect(payload.historicoEdicoes.__arrayUnion.valoresAnteriores).toEqual({
      quantidade: 10,
    });
    expect(payload.historicoEdicoes.__arrayUnion.valoresNovos).toEqual({
      quantidade: 20,
    });
    expect(payload.historicoEdicoes.__arrayUnion.modificadoPorUid).toBe(
      "uidAdmin",
    );
  });

  it("não grava historicoEdicoes quando nenhum valor muda de fato", async () => {
    docAntesDeAtualizar = { quantidade: 10 };
    await atualizarLancamentoNoFirestore(
      "uid1",
      "doc1",
      { quantidade: 10 },
      "Admin",
      "uidAdmin",
    );
    expect(updateDocCalls[0].historicoEdicoes).toBeUndefined();
  });

  it("exige uid e docId", async () => {
    await expect(
      atualizarLancamentoNoFirestore(null, "doc1", {}, "Admin", "uidAdmin"),
    ).rejects.toThrow();
  });
});

describe("softDeletarLancamentoNoFirestore (cancelamento, não exclusão)", () => {
  it("marca o registro como cancelado preservando o documento (sem hard-delete)", async () => {
    await softDeletarLancamentoNoFirestore(
      "uid1",
      "doc1",
      "Admin",
      "uidAdmin",
      "Registro duplicado",
    );
    expect(updateDocCalls).toHaveLength(1);
    const payload = updateDocCalls[0];
    expect(payload.deleted).toBe(true);
    expect(payload.status).toBe("cancelado");
    expect(payload.motivoCancelamento).toBe("Registro duplicado");
    expect(payload.canceladoPor).toBe("Admin");
    expect(payload.canceladoPorUid).toBe("uidAdmin");
  });

  it("motivo é opcional (null quando não informado)", async () => {
    await softDeletarLancamentoNoFirestore("uid1", "doc1", "Admin", "uidAdmin");
    expect(updateDocCalls[0].motivoCancelamento).toBeNull();
  });
});

describe("registrarAuditoria", () => {
  it("grava um evento de auditoria com usuário, ação, entidade e metadados", async () => {
    await registrarAuditoria(
      "uid1",
      "cancelamento_lancamento",
      "lancamento",
      "doc1",
      "Admin",
      "uidAdmin",
      { motivo: "teste" },
    );
    expect(addDocCalls).toHaveLength(1);
    expect(addDocCalls[0]).toMatchObject({
      uid: "uid1",
      acao: "cancelamento_lancamento",
      entidade: "lancamento",
      entidadeId: "doc1",
      usuario: "Admin",
      usuarioUid: "uidAdmin",
      metadados: { motivo: "teste" },
    });
  });

  it("não lança erro quando a escrita falha (auditoria não bloqueia a ação principal)", async () => {
    const { addDoc } = await import("firebase/firestore");
    addDoc.mockImplementationOnce(async () => {
      throw new Error("Firestore indisponível");
    });
    await expect(
      registrarAuditoria("uid1", "acao", "entidade", "id", "Admin", "uid"),
    ).resolves.toBeUndefined();
  });
});
