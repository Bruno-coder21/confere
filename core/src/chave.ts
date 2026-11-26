// Tipos de chave Pix como aparecem no BR Code.
// Fonte: Manual de Padrões para Iniciação do Pix 2.10.0, seção 2.5.1.
// CPF e CNPJ só com caracteres (CNPJ pode ter letras); telefone em formato
// internacional com "+"; e-mail; chave aleatória com hífens.

import { validarCnpj } from "./cnpj";
import { validarCpf } from "./cpf";

export type TipoChave = "cpf" | "cnpj" | "telefone" | "email" | "aleatoria" | "desconhecida";

export interface ClassificacaoChave {
  tipo: TipoChave;
  /** Para CPF e CNPJ: dígitos verificadores conferem. Para os outros: formato conferem. */
  valida: boolean;
}

const EVP = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TELEFONE = /^\+[1-9][0-9]{1,14}$/;
const EMAIL = /^[^\s@]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;

export function classificarChave(chave: string): ClassificacaoChave {
  if (/^[0-9]{11}$/.test(chave)) return { tipo: "cpf", valida: validarCpf(chave).valido };
  if (/^[0-9A-Z]{12}[0-9]{2}$/.test(chave)) return { tipo: "cnpj", valida: validarCnpj(chave).valido };
  if (TELEFONE.test(chave)) return { tipo: "telefone", valida: chave.startsWith("+55") && chave.length >= 13 && chave.length <= 14 };
  if (EVP.test(chave)) return { tipo: "aleatoria", valida: true };
  if (chave.includes("@")) return { tipo: "email", valida: chave.length <= 77 && EMAIL.test(chave) };
  return { tipo: "desconhecida", valida: false };
}

export const NOME_TIPO_CHAVE: Record<TipoChave, string> = {
  cpf: "CPF",
  cnpj: "CNPJ",
  telefone: "telefone",
  email: "e-mail",
  aleatoria: "chave aleatória",
  desconhecida: "formato desconhecido",
};
