// CNPJ numérico e alfanumérico.
// Fonte: Receita Federal, "CNPJ alfanumérico — perguntas e respostas", pergunta 14,
// e Serpro, "Cálculo dos dígitos verificadores de CNPJ alfanumérico".
// Regra: cada caractere vale (código ASCII − 48); pesos 2 a 9 da direita para a
// esquerda; resto 0 ou 1 dá dígito 0, senão 11 − resto. Os dois dígitos finais
// são sempre numéricos. A mesma conta vale para o CNPJ só com números.

export type FormatoCnpj = "numerico" | "alfanumerico";

export interface ResultadoCnpj {
  valido: boolean;
  /** 14 caracteres, maiúsculos, sem pontuação. Vazio se a entrada não tinha forma de CNPJ. */
  normalizado: string;
  formato?: FormatoCnpj;
  motivo?: string;
}

const FORMA_CNPJ = /^[0-9A-Z]{12}[0-9]{2}$/;

/** Tira espaços, ponto, barra e hífen e passa letras para maiúsculas. */
export function normalizarCnpj(entrada: string): string {
  return entrada.replace(/[\s./-]/g, "").toUpperCase();
}

function digitoMod11(valores: number[]): number {
  let soma = 0;
  let peso = 2;
  for (let i = valores.length - 1; i >= 0; i--) {
    soma += (valores[i] ?? 0) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

/** Calcula os dois dígitos verificadores a partir dos 12 primeiros caracteres. */
export function calcularDvCnpj(base12: string): string {
  const base = base12.toUpperCase();
  if (!/^[0-9A-Z]{12}$/.test(base)) {
    throw new Error("A base do CNPJ precisa de 12 letras ou números.");
  }
  const valores = Array.from(base, (c) => c.charCodeAt(0) - 48);
  const dv1 = digitoMod11(valores);
  const dv2 = digitoMod11([...valores, dv1]);
  return `${dv1}${dv2}`;
}

export function validarCnpj(entrada: string): ResultadoCnpj {
  const normalizado = normalizarCnpj(entrada);
  if (!FORMA_CNPJ.test(normalizado)) {
    return { valido: false, normalizado: "", motivo: "Não tem a forma de um CNPJ (14 caracteres, os 2 últimos números)." };
  }
  const formato: FormatoCnpj = /^[0-9]{14}$/.test(normalizado) ? "numerico" : "alfanumerico";
  if (/^(.)\1{13}$/.test(normalizado)) {
    return { valido: false, normalizado, formato, motivo: "Todos os caracteres são iguais." };
  }
  const esperado = calcularDvCnpj(normalizado.slice(0, 12));
  if (normalizado.slice(12) !== esperado) {
    return { valido: false, normalizado, formato, motivo: "Os dígitos verificadores não batem." };
  }
  return { valido: true, normalizado, formato };
}

/** 12ABC34501DE35 → 12.ABC.345/01DE-35 */
export function formatarCnpj(cnpj14: string): string {
  const c = normalizarCnpj(cnpj14);
  if (c.length !== 14) return cnpj14;
  return `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8, 12)}-${c.slice(12)}`;
}
