export const normalizarTexto = (value) => {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/^['"]|['"]$/g, "")
    .trim();
};

export const normalizarData = (value) => {
  const texto = normalizarTexto(value);
  if (!texto) return "";

  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) return texto;

  const partes = texto.split(/[\/\-]/).filter(Boolean);
  if (partes.length === 3) {
    const [a, b, c] = partes;
    const possivelData = new Date(
      Number(a.length === 4 ? a : c),
      Number(a.length === 4 ? Number(b) - 1 : Number(a) - 1),
      Number(a.length === 4 ? Number(c) : Number(b)),
    );

    if (!Number.isNaN(possivelData.getTime())) {
      const ano = possivelData.getFullYear();
      const mes = `${possivelData.getMonth() + 1}`.padStart(2, "0");
      const dia = `${possivelData.getDate()}`.padStart(2, "0");
      return `${ano}-${mes}-${dia}`;
    }
  }

  const data = new Date(texto);
  if (!Number.isNaN(data.getTime())) {
    return data.toISOString().slice(0, 10);
  }

  return texto;
};

export const normalizarQuantidade = (value) => {
  const texto = normalizarTexto(value).replace(/,/g, ".");
  const numero = Number(texto);
  return Number.isFinite(numero) ? numero : 0;
};

export const normalizarStatus = (value) => {
  const texto = normalizarTexto(value).toLowerCase();
  const positivos = [
    "1",
    "sim",
    "s",
    "yes",
    "true",
    "baixado",
    "concluido",
    "concluído",
  ];
  return positivos.includes(texto) ? "Sim" : "Não";
};

export const normalizarLancamentoImportado = (row) => {
  const data = normalizarData(row["Data"] ?? row["data"] ?? row["DATA"] ?? "");
  const codigo = normalizarTexto(
    row["Código Almox."] ?? row["Código"] ?? row["codigo"] ?? "",
  );
  const material = normalizarTexto(
    row["Material"] ?? row["material"] ?? row["MATERIAL"] ?? "",
  );
  const quantidade = normalizarQuantidade(
    row["Quantidade"] ?? row["quantidade"] ?? row["Qtd"] ?? row["qtd"] ?? 0,
  );
  const encarregado = normalizarTexto(
    row["Encarregado"] ?? row["encarregado"] ?? row["ENCARREGADO"] ?? "",
  );
  const baixa = normalizarStatus(
    row["Status"] ?? row["status"] ?? row["Baixa"] ?? row["baixa"] ?? "",
  );

  return { data, codigo, material, quantidade, encarregado, baixa };
};
