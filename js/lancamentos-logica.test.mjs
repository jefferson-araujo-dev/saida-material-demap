import { describe, it, expect } from "vitest";
import {
  filtrarLancamentos,
  agruparLancamentos,
  ordenarLancamentos,
  calcularPaginacao,
} from "./lancamentos-logica.js";

const itemBase = (overrides = {}) => ({
  id: "1",
  data: "2026-03-05",
  codigo: "14407",
  material: "LAMINADO DE FREIJÓ",
  quantidade: 10,
  encarregado: "Carlos Silva",
  baixa: "Não",
  ...overrides,
});

describe("filtrarLancamentos", () => {
  it("sem filtros retorna todos os itens", () => {
    const itens = [itemBase(), itemBase({ id: "2" })];
    expect(filtrarLancamentos(itens, {})).toHaveLength(2);
  });

  it("filtra por texto no código, material ou encarregado (case-insensitive)", () => {
    const itens = [
      itemBase({ id: "1", material: "COMPENSADO VIROLA" }),
      itemBase({ id: "2", material: "TUBO METALON" }),
    ];
    const resultado = filtrarLancamentos(itens, { termo: "virola" });
    expect(resultado.map((i) => i.id)).toEqual(["1"]);
  });

  it("filtra por encarregado exato", () => {
    const itens = [
      itemBase({ id: "1", encarregado: "Carlos Silva" }),
      itemBase({ id: "2", encarregado: "Ana Souza" }),
    ];
    const resultado = filtrarLancamentos(itens, { encarregado: "Ana Souza" });
    expect(resultado.map((i) => i.id)).toEqual(["2"]);
  });

  it("trata baixa ausente como 'Não' ao filtrar por status", () => {
    const itens = [
      itemBase({ id: "1", baixa: undefined }),
      itemBase({ id: "2", baixa: "Sim" }),
    ];
    const resultado = filtrarLancamentos(itens, { status: "Não" });
    expect(resultado.map((i) => i.id)).toEqual(["1"]);
  });

  it("filtra por intervalo de datas (inclusive nas duas pontas)", () => {
    const itens = [
      itemBase({ id: "1", data: "2026-03-01" }),
      itemBase({ id: "2", data: "2026-03-10" }),
      itemBase({ id: "3", data: "2026-03-20" }),
    ];
    const resultado = filtrarLancamentos(itens, {
      dataInicio: new Date(2026, 2, 5),
      dataFim: new Date(2026, 2, 15),
    });
    expect(resultado.map((i) => i.id)).toEqual(["2"]);
  });

  it("combina todos os filtros com AND", () => {
    const itens = [
      itemBase({ id: "1", encarregado: "Carlos Silva", baixa: "Sim" }),
      itemBase({ id: "2", encarregado: "Carlos Silva", baixa: "Não" }),
    ];
    const resultado = filtrarLancamentos(itens, {
      encarregado: "Carlos Silva",
      status: "Não",
    });
    expect(resultado.map((i) => i.id)).toEqual(["2"]);
  });

  it("sem filtro de status, mantém lançamentos cancelados visíveis (histórico não some)", () => {
    const itens = [
      itemBase({ id: "1" }),
      itemBase({ id: "2", deleted: true, status: "cancelado" }),
    ];
    const resultado = filtrarLancamentos(itens, {});
    expect(resultado.map((i) => i.id).sort()).toEqual(["1", "2"]);
  });

  it("filtro 'Cancelado' retorna só os lançamentos cancelados", () => {
    const itens = [
      itemBase({ id: "1" }),
      itemBase({ id: "2", deleted: true }),
    ];
    const resultado = filtrarLancamentos(itens, { status: "Cancelado" });
    expect(resultado.map((i) => i.id)).toEqual(["2"]);
  });

  it("filtros de status 'Não'/'Sim' excluem lançamentos cancelados", () => {
    const itens = [
      itemBase({ id: "1", baixa: "Não" }),
      itemBase({ id: "2", baixa: "Não", deleted: true }),
    ];
    const resultado = filtrarLancamentos(itens, { status: "Não" });
    expect(resultado.map((i) => i.id)).toEqual(["1"]);
  });
});

describe("agruparLancamentos", () => {
  it("soma a quantidade de itens com mesma data/código/encarregado/status", () => {
    const itens = [
      itemBase({ id: "1", quantidade: 10 }),
      itemBase({ id: "2", quantidade: 5 }),
    ];
    const resultado = agruparLancamentos(itens);
    expect(resultado).toHaveLength(1);
    expect(resultado[0].quantidade).toBe(15);
    expect(resultado[0].ids).toEqual(["1", "2"]);
    expect(resultado[0].isGrouped).toBe(true);
  });

  it("mantém itens com chave diferente separados", () => {
    const itens = [
      itemBase({ id: "1", codigo: "111" }),
      itemBase({ id: "2", codigo: "222" }),
    ];
    const resultado = agruparLancamentos(itens);
    expect(resultado).toHaveLength(2);
    expect(resultado.every((i) => i.isGrouped === false)).toBe(true);
  });

  it("trata baixa ausente como 'Não' na chave de agrupamento", () => {
    const itens = [
      itemBase({ id: "1", baixa: undefined }),
      itemBase({ id: "2", baixa: "Não" }),
    ];
    expect(agruparLancamentos(itens)).toHaveLength(1);
  });

  it("não agrupa lançamento cancelado com um ativo de mesma chave", () => {
    const itens = [
      itemBase({ id: "1" }),
      itemBase({ id: "2", deleted: true }),
    ];
    const resultado = agruparLancamentos(itens);
    expect(resultado).toHaveLength(2);
  });
});

describe("ordenarLancamentos", () => {
  it("ordena por quantidade numericamente, não como string", () => {
    const itens = [
      itemBase({ id: "1", quantidade: 9 }),
      itemBase({ id: "2", quantidade: 10 }),
      itemBase({ id: "3", quantidade: 2 }),
    ];
    const resultado = ordenarLancamentos(itens, {
      coluna: "quantidade",
      crescente: true,
    });
    expect(resultado.map((i) => i.id)).toEqual(["3", "1", "2"]);
  });

  it("ordena por data decrescente", () => {
    const itens = [
      itemBase({ id: "1", data: "2026-01-01" }),
      itemBase({ id: "2", data: "2026-03-01" }),
    ];
    const resultado = ordenarLancamentos(itens, {
      coluna: "data",
      crescente: false,
    });
    expect(resultado.map((i) => i.id)).toEqual(["2", "1"]);
  });

  it("não muta o array recebido", () => {
    const itens = [itemBase({ id: "1" }), itemBase({ id: "2" })];
    const original = [...itens];
    ordenarLancamentos(itens, { coluna: "quantidade", crescente: false });
    expect(itens).toEqual(original);
  });
});

describe("calcularPaginacao", () => {
  it("calcula o total de páginas e a fatia da página pedida", () => {
    expect(calcularPaginacao(20, 2, 9)).toEqual({
      paginas: 3,
      paginaAtual: 2,
      start: 9,
      end: 18,
    });
  });

  it("corrige para a última página quando paginaAtual excede o total", () => {
    expect(calcularPaginacao(20, 99, 9)).toMatchObject({
      paginas: 3,
      paginaAtual: 3,
    });
  });

  it("corrige para a primeira página quando paginaAtual é menor que 1", () => {
    expect(calcularPaginacao(20, 0, 9)).toMatchObject({ paginaAtual: 1 });
  });

  it("sem itens, considera 1 página (evita divisão exibindo '0/0')", () => {
    expect(calcularPaginacao(0, 1, 9)).toMatchObject({
      paginas: 1,
      start: 0,
      end: 0,
    });
  });
});
