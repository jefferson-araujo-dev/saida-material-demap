import { describe, it, expect } from "vitest";
import { formatarNome } from "./dashboard.js";

describe("formatarNome", () => {
  it("usa a primeira palavra do nome por padrão", () => {
    expect(formatarNome("Carlos Silva")).toBe("Carlos");
  });

  it("usa o segundo nome quando o primeiro é 'José' (nome comum demais para distinguir no gráfico)", () => {
    expect(formatarNome("José Willian")).toBe("Willian");
  });

  it("reconhece 'José' sem acento", () => {
    expect(formatarNome("Jose Carlos")).toBe("Carlos");
  });

  it("é insensível a maiúsculas/minúsculas", () => {
    expect(formatarNome("JOSÉ Roberto")).toBe("Roberto");
  });

  it("mantém 'José' quando não há um segundo nome", () => {
    expect(formatarNome("José")).toBe("José");
  });

  it("não afeta nomes que só contêm 'José' como parte de outra palavra", () => {
    expect(formatarNome("Josélia Nunes")).toBe("Josélia");
  });

  it("trata null/undefined como string vazia", () => {
    expect(formatarNome(null)).toBe("");
    expect(formatarNome(undefined)).toBe("");
  });
});
