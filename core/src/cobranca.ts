// Pix dinâmico: validação do endereço (location) e leitura do conteúdo.
// Fonte: Manual de Padrões para Iniciação do Pix 2.10.0, seções 2.5.2 e 2.7.1.
// O endereço vem sem "https://", tem até 77 caracteres e só pode ser acessado
// por HTTPS depois de validado. A busca, a verificação da assinatura JWS e o
// bloqueio de IP privado depois do DNS ficam no Worker; aqui só entra o JSON
// já verificado.

import { classificarChave, type TipoChave } from "./chave";
import { valorParaCentavos } from "./pix";

export type TipoCobranca = "cob" | "cobv" | "rec";

export interface ValidacaoLocation {
  valida: boolean;
  tipo?: TipoCobranca;
  host?: string;
  motivo?: string;
}

const CARACTERES_URI = /^[A-Za-z0-9\-._~:/?#[\]@!$&'()*+,;=%]+$/;
const ROTULO = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;
// Domínios que nunca são de um PSP na internet (RFC 6761, RFC 8375 e usos internos comuns).
// A checagem de IP privado depois da resolução de DNS fica no Worker.
const SUFIXOS_RESERVADOS = ["localhost", "local", "internal", "intranet", "lan", "corp", "home.arpa", "test", "invalid", "example", "onion"];

export function validarLocation(url: string): ValidacaoLocation {
  if (url.length === 0 || url.length > 77) return { valida: false, motivo: "O endereço precisa ter de 1 a 77 caracteres." };
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(url)) return { valida: false, motivo: "O endereço não pode trazer o protocolo (https://)." };
  if (!CARACTERES_URI.test(url)) return { valida: false, motivo: "O endereço tem caracteres inválidos." };
  const barra = url.indexOf("/");
  if (barra <= 0 || barra === url.length - 1) return { valida: false, motivo: "O endereço não tem domínio e caminho." };
  const host = url.slice(0, barra).toLowerCase();
  const rotulos = host.split(".");
  if (
    rotulos.length < 2 ||
    !rotulos.every((r) => ROTULO.test(r)) ||
    /^[0-9]+$/.test(rotulos[rotulos.length - 1] ?? "") ||
    host === "localhost"
  ) {
    return { valida: false, motivo: "O domínio do endereço não é um nome de domínio válido." };
  }
  if (SUFIXOS_RESERVADOS.some((suf) => host === suf || host.endsWith(`.${suf}`))) {
    return { valida: false, motivo: "O domínio do endereço é reservado para uso interno." };
  }
  // O parser de URL tem de enxergar exatamente o mesmo domínio.
  let analisado: URL;
  try {
    analisado = new URL(`https://${url}`);
  } catch {
    return { valida: false, motivo: "O endereço não é uma URL válida." };
  }
  if (analisado.hostname !== host || analisado.port !== "" || analisado.username !== "" || analisado.password !== "") {
    return { valida: false, motivo: "O domínio do endereço é ambíguo." };
  }
  // Tipo pelo caminho já analisado, sem consulta nem fragmento.
  const segmentos = analisado.pathname.split("/");
  const tipo: TipoCobranca = segmentos.includes("cobv") ? "cobv" : segmentos.includes("rec") ? "rec" : "cob";
  return { valida: true, tipo, host };
}

export interface RecebedorCobranca {
  cpf?: string;
  cnpj?: string;
  nome?: string;
  nomeFantasia?: string;
}

export interface Cobranca {
  tipo: "cob" | "cobv";
  chave: string;
  tipoChave: TipoChave;
  valorCentavos?: number;
  txid?: string;
  status?: string;
  /** Só na cobrança com vencimento. */
  recebedor?: RecebedorCobranca;
  vencimento?: string;
}

function texto(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : undefined;
}

function objeto(v: unknown): Record<string, unknown> | undefined {
  return typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : undefined;
}

/** Lê o JSON do conteúdo de um Pix dinâmico. Retorna undefined se faltar a chave. */
export function lerCobranca(json: unknown, tipo: "cob" | "cobv"): Cobranca | undefined {
  const raiz = objeto(json);
  const chave = texto(raiz?.chave);
  if (!raiz || !chave) return undefined;
  const valor = objeto(raiz.valor);
  const valorTxt = texto(tipo === "cobv" ? valor?.final : valor?.original);
  const cobranca: Cobranca = { tipo, chave, tipoChave: classificarChave(chave).tipo };
  const centavos = valorTxt ? valorParaCentavos(valorTxt) : undefined;
  if (centavos !== undefined) cobranca.valorCentavos = centavos;
  const txid = texto(raiz.txid);
  if (txid) cobranca.txid = txid;
  const status = texto(raiz.status);
  if (status) cobranca.status = status;
  if (tipo === "cobv") {
    const r = objeto(raiz.recebedor);
    if (r) {
      const recebedor: RecebedorCobranca = {};
      const cpf = texto(r.cpf);
      const cnpj = texto(r.cnpj);
      const nome = texto(r.nome);
      const fantasia = texto(r.nomeFantasia);
      if (cpf) recebedor.cpf = cpf;
      if (cnpj) recebedor.cnpj = cnpj.toUpperCase();
      if (nome) recebedor.nome = nome;
      if (fantasia) recebedor.nomeFantasia = fantasia;
      cobranca.recebedor = recebedor;
    }
    const venc = texto(objeto(raiz.calendario)?.dataDeVencimento);
    if (venc) cobranca.vencimento = venc;
  }
  return cobranca;
}
