// Normalização e comparação de nomes.
// O nome no Pix (campo 59) tem no máximo 25 caracteres e pode vir cortado.

const SUFIXOS = new Set(["LTDA", "ME", "EPP", "EIRELI", "MEI", "SA", "S/A"]);
const LIGACOES = new Set(["DE", "DA", "DO", "DAS", "DOS", "E", "A", "O"]);
const GENERICAS = new Set(["COMERCIO", "SERVICOS", "SERVICO", "LOJA", "EMPRESA", "INDUSTRIA", "BRASIL", "CIA"]);

export type ComparacaoNome = "igual" | "contem" | "parcial" | "diferente";

function semAcento(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Maiúsculas, sem acento, sem pontuação e sem LTDA, S.A., S/A, ME, EPP, EIRELI, MEI. */
export function normalizarNome(nome: string): string {
  let s = semAcento(nome).toUpperCase();
  s = s.replace(/\bS\s*[./]\s*A\b\.?/g, " SA ");
  s = s.replace(/[^A-Z0-9 ]+/g, " ");
  const tokens = s.split(/\s+/).filter((t) => t !== "" && !SUFIXOS.has(t));
  return tokens.join(" ");
}

function significativas(normalizado: string): string[] {
  return normalizado.split(" ").filter((t) => t.length >= 3 && !LIGACOES.has(t) && !GENERICAS.has(t));
}

/**
 * Compara o nome informado pela pessoa com o nome lido.
 * - igual: mesmo nome depois de normalizar.
 * - contem: um começa com o outro (nome cortado em 25 caracteres ou abreviado).
 * - parcial: dividem ao menos uma palavra significativa.
 * - diferente: nenhuma palavra significativa em comum.
 * @param lidoBruto nome como veio no código; se tem 25 caracteres, aceita corte no meio da palavra.
 */
export function compararNomes(informado: string, lidoBruto: string): ComparacaoNome {
  const a = normalizarNome(informado);
  const b = normalizarNome(lidoBruto);
  if (a === "" || b === "") return "diferente";
  if (a === b) return "igual";
  const [maior, menor] = a.length >= b.length ? [a, b] : [b, a];
  if (maior.startsWith(menor)) {
    const limiteDePalavra = maior.length === menor.length || maior[menor.length] === " ";
    const cortadoEm25 = menor === b && Array.from(lidoBruto.trim()).length >= 24;
    if (limiteDePalavra || cortadoEm25) return "contem";
  }
  const pa = new Set(significativas(a));
  if (significativas(b).some((t) => pa.has(t))) return "parcial";
  return "diferente";
}
