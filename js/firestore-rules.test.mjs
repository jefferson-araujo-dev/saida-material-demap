import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// Verificação ESTÁTICA e rápida de firestore.rules (regex sobre o texto das
// regras). Serve de guarda contra regressão acidental no texto do arquivo,
// mas NÃO avalia as regras pelo motor do Firestore — não substitui uma
// validação real de permissões.
//
// A suíte autoritativa, que executa os cenários de allow/deny pelo motor
// real do Firestore Emulator (via @firebase/rules-unit-testing), está em
// js/firestore-rules.emulator.test.mjs. Para validar permissões, use aquela
// suíte (npm run test:rules:emulator, com o emulator ativo).

const rulesPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "firestore.rules",
);
const rulesText = readFileSync(rulesPath, "utf-8");

function getBlock(matchPath) {
  const start = rulesText.indexOf(matchPath);
  expect(start).toBeGreaterThan(-1);
  // Pega até o próximo "match /" ou até 40 linhas à frente, o que vier primeiro.
  const rest = rulesText.slice(start);
  const nextMatch = rest.indexOf("\n      match /", 1);
  return nextMatch === -1 ? rest : rest.slice(0, nextMatch);
}

describe("firestore.rules — lançamentos (estático)", () => {
  const bloco = getBlock("match /users/{uid}/lancamentos/{lancamentoId}");

  it("lançamento ativo: update continua liberado para o dono (isOwner)", () => {
    expect(bloco).toMatch(/allow update:\s*if isOwner\(uid\)/);
  });

  it("lançamento cancelado não pode ser alterado: update exige resource.data.deleted != true", () => {
    // A cláusula precisa estar no bloco de "allow update", não em outro lugar.
    const updateClause = bloco.match(/allow update:[\s\S]*?;/)[0];
    expect(updateClause).toMatch(/resource\.data\.deleted\s*!=\s*true/);
  });

  it("reversão de deleted:true para false não é permitida por usuário comum (mesma cláusula bloqueia qualquer update pós-cancelamento)", () => {
    const updateClause = bloco.match(/allow update:[\s\S]*?;/)[0];
    // Como resource.data.deleted != true é obrigatório, nenhuma escrita
    // (incluindo uma que tentasse setar deleted de volta para false) passa
    // quando o documento já está cancelado.
    expect(updateClause).toMatch(/resource\.data\.deleted\s*!=\s*true/);
  });

  it("nunca existe hard-delete pelo cliente (delete: if false)", () => {
    expect(bloco).toMatch(/allow delete:\s*if false/);
  });
});

describe("firestore.rules — auditoria (estático)", () => {
  const bloco = getBlock("match /auditoria/{registroId}");

  it("create exige uid == request.auth.uid (não é possível forjar auditoria em nome de outro usuário)", () => {
    expect(bloco).toMatch(
      /request\.resource\.data\.uid\s*==\s*request\.auth\.uid/,
    );
  });

  it("create valida acao e entidade como string não-vazia e limitada em tamanho", () => {
    expect(bloco).toMatch(/request\.resource\.data\.acao is string/);
    expect(bloco).toMatch(/request\.resource\.data\.acao\.size\(\) > 0/);
    expect(bloco).toMatch(/request\.resource\.data\.acao\.size\(\) <= 60/);
    expect(bloco).toMatch(/request\.resource\.data\.entidade is string/);
    expect(bloco).toMatch(/request\.resource\.data\.entidade\.size\(\) > 0/);
    expect(bloco).toMatch(
      /request\.resource\.data\.entidade\.size\(\) <= 60/,
    );
  });

  it("create exige timestamp de servidor (request.resource.data.timestamp == request.time)", () => {
    expect(bloco).toMatch(
      /request\.resource\.data\.timestamp\s*==\s*request\.time/,
    );
  });

  it("create limita metadados a um map com no máximo 20 chaves (evita payload arbitrariamente grande)", () => {
    expect(bloco).toMatch(/request\.resource\.data\.metadados is map/);
    expect(bloco).toMatch(
      /request\.resource\.data\.metadados\.size\(\) <= 20/,
    );
  });

  it("read é restrito a admin; update e delete nunca são permitidos", () => {
    expect(bloco).toMatch(/allow read:\s*if isAdmin\(\)/);
    expect(bloco).toMatch(/allow update, delete:\s*if false/);
  });
});
