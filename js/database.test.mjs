import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./firebase.js", () => ({
  db: {},
  appId: "test-app",
}));

// Simula o SDK do Firestore o suficiente para testar a lógica de
// particionamento de batches, sem precisar de um Firestore real.
const commits = [];
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
  updateDoc: vi.fn(async () => {}),
}));

const { salvarLancamentosEmLote, alternarBaixaNoFirestore } =
  await import("./database.js");

beforeEach(() => {
  commits.length = 0;
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
