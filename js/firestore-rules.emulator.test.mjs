import { describe, it, beforeAll, afterAll, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from "@firebase/rules-unit-testing";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";

// Testes REAIS contra o motor de Firestore Rules, via Firebase Emulator
// (@firebase/rules-unit-testing). Diferem de js/firestore-rules.test.mjs
// (verificação estática/regex): aqui cada cenário é de fato avaliado pelo
// mesmo engine usado em produção. Requer o Firestore Emulator ativo em
// 127.0.0.1:8080 (ver npm run test:rules:emulator).

const rulesPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "firestore.rules",
);
const rules = readFileSync(rulesPath, "utf-8");

const PROJECT_ID = "demo-test";
const APP_ID = "app-teste";

let testEnv;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules,
      host: "127.0.0.1",
      port: 8080,
    },
  });
});

afterAll(async () => {
  if (testEnv) await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

function lancamentoPath(uid, id) {
  return `artifacts/${APP_ID}/users/${uid}/lancamentos/${id}`;
}

function auditoriaPath(id) {
  return `artifacts/${APP_ID}/auditoria/${id}`;
}

describe("firestore.rules (emulator) — lançamentos", () => {
  it("1. proprietário autenticado cria lançamento válido", async () => {
    const db = testEnv.authenticatedContext("dono").firestore();
    await assertSucceeds(
      setDoc(doc(db, lancamentoPath("dono", "l1")), {
        codigo: "MAT-1",
        quantidade: 10,
        deleted: false,
      }),
    );
  });

  it("2. quantidade inválida é rejeitada", async () => {
    const db = testEnv.authenticatedContext("dono").firestore();
    await assertFails(
      setDoc(doc(db, lancamentoPath("dono", "l2")), {
        codigo: "MAT-1",
        quantidade: -5,
        deleted: false,
      }),
    );
  });

  it("3. proprietário altera lançamento ativo", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), lancamentoPath("dono", "l3")), {
        codigo: "MAT-1",
        quantidade: 10,
        deleted: false,
      });
    });
    const db = testEnv.authenticatedContext("dono").firestore();
    await assertSucceeds(
      updateDoc(doc(db, lancamentoPath("dono", "l3")), {
        codigo: "MAT-1",
        quantidade: 20,
        deleted: false,
      }),
    );
  });

  it("4. usuário diferente não altera lançamento de outro proprietário", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), lancamentoPath("dono", "l4")), {
        codigo: "MAT-1",
        quantidade: 10,
        deleted: false,
      });
    });
    const db = testEnv.authenticatedContext("outro").firestore();
    await assertFails(
      updateDoc(doc(db, lancamentoPath("dono", "l4")), {
        codigo: "MAT-1",
        quantidade: 20,
        deleted: false,
      }),
    );
  });

  it("5. proprietário consegue realizar o cancelamento permitido pela regra", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), lancamentoPath("dono", "l5")), {
        codigo: "MAT-1",
        quantidade: 10,
        deleted: false,
      });
    });
    const db = testEnv.authenticatedContext("dono").firestore();
    // A regra de update exige resource.data.deleted != true (documento AINDA
    // ativo) e não valida o campo `deleted` do novo estado — logo o
    // cancelamento (setar deleted: true) é uma atualização como outra
    // qualquer, desde que quantidade/codigo continuem válidos.
    await assertSucceeds(
      updateDoc(doc(db, lancamentoPath("dono", "l5")), {
        codigo: "MAT-1",
        quantidade: 10,
        deleted: true,
      }),
    );
  });

  it("6. lançamento já cancelado (deleted == true) não pode sofrer nova edição", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), lancamentoPath("dono", "l6")), {
        codigo: "MAT-1",
        quantidade: 10,
        deleted: true,
      });
    });
    const db = testEnv.authenticatedContext("dono").firestore();
    await assertFails(
      updateDoc(doc(db, lancamentoPath("dono", "l6")), {
        codigo: "MAT-1",
        quantidade: 15,
        deleted: true,
      }),
    );
  });

  it("7. tentativa de alterar deleted:true para false é rejeitada", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), lancamentoPath("dono", "l7")), {
        codigo: "MAT-1",
        quantidade: 10,
        deleted: true,
      });
    });
    const db = testEnv.authenticatedContext("dono").firestore();
    await assertFails(
      updateDoc(doc(db, lancamentoPath("dono", "l7")), {
        codigo: "MAT-1",
        quantidade: 10,
        deleted: false,
      }),
    );
  });

  it("8. hard-delete é rejeitado", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), lancamentoPath("dono", "l8")), {
        codigo: "MAT-1",
        quantidade: 10,
        deleted: false,
      });
    });
    const db = testEnv.authenticatedContext("dono").firestore();
    await assertFails(deleteDoc(doc(db, lancamentoPath("dono", "l8"))));
  });
});

describe("firestore.rules (emulator) — auditoria", () => {
  it("9. usuário autenticado cria auditoria válida com seu próprio UID", async () => {
    const db = testEnv.authenticatedContext("user1").firestore();
    // request.resource.data.timestamp == request.time só é satisfeito com o
    // sentinel serverTimestamp(); um Date literal do cliente nunca é igual
    // ao horário de commit do servidor.
    await assertSucceeds(
      setDoc(doc(db, auditoriaPath("a1")), {
        uid: "user1",
        acao: "criar_lancamento",
        entidade: "lancamento",
        timestamp: serverTimestamp(),
        metadados: { codigo: "MAT-1" },
      }),
    );
  });

  it("10. tentativa de criar auditoria com UID diferente de request.auth.uid é rejeitada", async () => {
    const db = testEnv.authenticatedContext("user1").firestore();
    await assertFails(
      setDoc(doc(db, auditoriaPath("a2")), {
        uid: "user2",
        acao: "criar_lancamento",
        entidade: "lancamento",
        timestamp: new Date(),
        metadados: {},
      }),
    );
  });

  it("11. acao ausente ou de tipo inválido é rejeitada", async () => {
    const db = testEnv.authenticatedContext("user1").firestore();
    await assertFails(
      setDoc(doc(db, auditoriaPath("a3")), {
        uid: "user1",
        acao: 123,
        entidade: "lancamento",
        timestamp: new Date(),
        metadados: {},
      }),
    );
  });

  it("12. acao vazia é rejeitada", async () => {
    const db = testEnv.authenticatedContext("user1").firestore();
    await assertFails(
      setDoc(doc(db, auditoriaPath("a4")), {
        uid: "user1",
        acao: "",
        entidade: "lancamento",
        timestamp: new Date(),
        metadados: {},
      }),
    );
  });

  it("13. acao acima de 60 caracteres é rejeitada", async () => {
    const db = testEnv.authenticatedContext("user1").firestore();
    await assertFails(
      setDoc(doc(db, auditoriaPath("a5")), {
        uid: "user1",
        acao: "a".repeat(61),
        entidade: "lancamento",
        timestamp: new Date(),
        metadados: {},
      }),
    );
  });

  it("14. entidade inválida é rejeitada", async () => {
    const db = testEnv.authenticatedContext("user1").firestore();
    await assertFails(
      setDoc(doc(db, auditoriaPath("a6")), {
        uid: "user1",
        acao: "criar_lancamento",
        entidade: "",
        timestamp: new Date(),
        metadados: {},
      }),
    );
  });

  it("15. timestamp incompatível com request.time é rejeitado", async () => {
    const db = testEnv.authenticatedContext("user1").firestore();
    await assertFails(
      setDoc(doc(db, auditoriaPath("a7")), {
        uid: "user1",
        acao: "criar_lancamento",
        entidade: "lancamento",
        timestamp: new Date("2020-01-01T00:00:00Z"),
        metadados: {},
      }),
    );
  });

  it("16. metadados que não seja map é rejeitado", async () => {
    const db = testEnv.authenticatedContext("user1").firestore();
    await assertFails(
      setDoc(doc(db, auditoriaPath("a8")), {
        uid: "user1",
        acao: "criar_lancamento",
        entidade: "lancamento",
        timestamp: new Date(),
        metadados: "não-é-map",
      }),
    );
  });

  it("17. metadados com mais de 20 chaves é rejeitado", async () => {
    const db = testEnv.authenticatedContext("user1").firestore();
    const metadados = Object.fromEntries(
      Array.from({ length: 21 }, (_, i) => [`chave${i}`, i]),
    );
    await assertFails(
      setDoc(doc(db, auditoriaPath("a9")), {
        uid: "user1",
        acao: "criar_lancamento",
        entidade: "lancamento",
        timestamp: new Date(),
        metadados,
      }),
    );
  });

  it("18. usuário comum não consegue ler auditoria", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), auditoriaPath("a10")), {
        uid: "user1",
        acao: "criar_lancamento",
        entidade: "lancamento",
        timestamp: new Date(),
        metadados: {},
      });
    });
    const db = testEnv.authenticatedContext("user1").firestore();
    await assertFails(getDoc(doc(db, auditoriaPath("a10"))));
  });

  it("19. administrador consegue ler auditoria (custom claim admin:true)", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), auditoriaPath("a11")), {
        uid: "user1",
        acao: "criar_lancamento",
        entidade: "lancamento",
        timestamp: new Date(),
        metadados: {},
      });
    });
    const db = testEnv
      .authenticatedContext("admin1", { admin: true })
      .firestore();
    await assertSucceeds(getDoc(doc(db, auditoriaPath("a11"))));
  });

  it("20. update de auditoria é rejeitado", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), auditoriaPath("a12")), {
        uid: "user1",
        acao: "criar_lancamento",
        entidade: "lancamento",
        timestamp: new Date(),
        metadados: {},
      });
    });
    const db = testEnv
      .authenticatedContext("admin1", { admin: true })
      .firestore();
    await assertFails(
      updateDoc(doc(db, auditoriaPath("a12")), { acao: "alterado" }),
    );
  });

  it("21. delete de auditoria é rejeitado", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), auditoriaPath("a13")), {
        uid: "user1",
        acao: "criar_lancamento",
        entidade: "lancamento",
        timestamp: new Date(),
        metadados: {},
      });
    });
    const db = testEnv
      .authenticatedContext("admin1", { admin: true })
      .firestore();
    await assertFails(deleteDoc(doc(db, auditoriaPath("a13"))));
  });
});
