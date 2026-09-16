export const normalizarTexto = (value) => {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/^['"]|['"]$/g, "")
    .trim();
};

// Formata um objeto Date no fuso local como YYYY-MM-DD.
// Usar toISOString() aqui converteria para UTC e poderia deslocar a data em um dia.
const formatarDataLocal = (data) => {
  const ano = data.getFullYear();
  const mes = `${data.getMonth() + 1}`.padStart(2, "0");
  const dia = `${data.getDate()}`.padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
};

export const normalizarData = (value) => {
  const texto = normalizarTexto(value);
  if (!texto) return "";

  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) return texto;

  const partes = texto.split(/[\/\-]/).filter(Boolean);
  if (partes.length === 3) {
    const [a, b, c] = partes;
    // Quando o primeiro token não é o ano (4 dígitos), assume-se o padrão
    // brasileiro DD/MM/AAAA — não MM/DD/AAAA (formato dos EUA).
    const ano = Number(a.length === 4 ? a : c);
    const mes = Number(b) - 1;
    const dia = Number(a.length === 4 ? c : a);
    const possivelData = new Date(ano, mes, dia);

    // new Date() "rola" dias/meses inválidos (ex.: 30/02) para o mês
    // seguinte em vez de falhar; conferimos os componentes de volta para
    // rejeitar datas que na verdade não existem.
    if (
      !Number.isNaN(possivelData.getTime()) &&
      possivelData.getFullYear() === ano &&
      possivelData.getMonth() === mes &&
      possivelData.getDate() === dia
    ) {
      return formatarDataLocal(possivelData);
    }
  }

  const data = new Date(texto);
  if (!Number.isNaN(data.getTime())) {
    return formatarDataLocal(data);
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
