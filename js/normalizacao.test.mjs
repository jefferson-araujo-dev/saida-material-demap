import { describe, it, expect } from "vitest";
import {
  normalizarTexto,
  normalizarData,
  normalizarQuantidade,
  normalizarStatus,
  normalizarLancamentoImportado,
} from "./normalizacao.mjs";

describe("normalizarTexto", () => {
  it("remove aspas nas pontas e espaços em excesso", () => {
    expect(normalizarTexto('  "Charles Vasques"  ')).toBe("Charles Vasques");
  });

  it("trata null/undefined como string vazia", () => {
    expect(normalizarTexto(null)).toBe("");
    expect(normalizarTexto(undefined)).toBe("");
  });
});

describe("normalizarData", () => {
  it("mantém datas já no formato ISO (YYYY-MM-DD)", () => {
    expect(normalizarData("2026-03-05")).toBe("2026-03-05");
  });

  it("interpreta datas ambíguas como DD/MM/AAAA (padrão brasileiro), não MM/DD", () => {
    // 05/03/2024 deve ser 5 de março, não 3 de maio.
    expect(normalizarData("05/03/2024")).toBe("2024-03-05");
  });

  it("interpreta corretamente dias acima de 12 (só fazem sentido como dia, não mês)", () => {
    expect(normalizarData("25/03/2024")).toBe("2024-03-25");
  });

  it("rejeita datas inválidas em vez de rolar para o mês seguinte", () => {
    // 30 de fevereiro não existe; new Date() "rolaria" isso para março
    // silenciosamente se não validássemos os componentes de volta.
    expect(normalizarData("30/02/2024")).toBe("30/02/2024");
  });

  it("aceita separador por hífen também", () => {
    expect(normalizarData("05-03-2024")).toBe("2024-03-05");
  });

  it("retorna string vazia para entrada vazia", () => {
    expect(normalizarData("")).toBe("");
    expect(normalizarData(null)).toBe("");
  });
});

describe("normalizarQuantidade", () => {
  it("converte vírgula decimal (padrão brasileiro) para número", () => {
    expect(normalizarQuantidade("1,5")).toBe(1.5);
  });

  it("converte string numérica simples", () => {
    expect(normalizarQuantidade("42")).toBe(42);
  });

  it("retorna 0 para valores não numéricos", () => {
    expect(normalizarQuantidade("abc")).toBe(0);
    expect(normalizarQuantidade("")).toBe(0);
  });
});

describe("normalizarStatus", () => {
  it("reconhece variações de 'concluído' como Sim", () => {
    for (const v of ["1", "sim", "s", "yes", "true", "baixado", "concluido", "concluído"]) {
      expect(normalizarStatus(v)).toBe("Sim");
    }
  });

  it("qualquer outro valor (incluindo vazio) é Não", () => {
    expect(normalizarStatus("")).toBe("Não");
    expect(normalizarStatus("pendente")).toBe("Não");
    expect(normalizarStatus("0")).toBe("Não");
  });

  it("é case-insensitive", () => {
    expect(normalizarStatus("SIM")).toBe("Sim");
  });
});

describe("normalizarLancamentoImportado", () => {
  it("lê colunas em qualquer variação de capitalização/nome", () => {
    const linha = {
      Data: "05/03/2024",
      "Código Almox.": "14407",
      Material: "Prancha de madeira",
      Quantidade: "2,5",
      Encarregado: "Charles Vasques",
      Status: "Sim",
    };
    expect(normalizarLancamentoImportado(linha)).toEqual({
      data: "2024-03-05",
      codigo: "14407",
      material: "Prancha de madeira",
      quantidade: 2.5,
      encarregado: "Charles Vasques",
      baixa: "Sim",
    });
  });

  it("usa valores default sensatos quando colunas faltam", () => {
    const resultado = normalizarLancamentoImportado({});
    expect(resultado.codigo).toBe("");
    expect(resultado.quantidade).toBe(0);
    expect(resultado.baixa).toBe("Não");
  });
});
