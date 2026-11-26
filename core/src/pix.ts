// Leitura do Pix copia e cola (BR Code).
// Fontes: Manual de Padrões para Iniciação do Pix 2.10.0 (BCB), seções 2.5 a 2.8;
// Manual do BR Code 2.0.1 (BCB), tabela 1.

import { classificarChave, type TipoChave } from "./chave";
import { crc16Latin1, crc16Utf8 } from "./crc16";
import { limparColagem, QUEBRA } from "./entrada";
import type { Problema } from "./problema";
import { campo, idsRepetidos, lerTlv, lerTlvBytes, type CampoTlv, type ResultadoTlv } from "./tlv";

export type ModeloPix = "estatico" | "dinamico" | "composto";

export type { Problema as ProblemaPix } from "./problema";

export interface LeituraPix {
  /** É um Pix que deu para ler: campos encadeados íntegros e conta Pix presente. */
  reconhecido: boolean;
  /** A verificação (CRC) confere. */
  integro: boolean;
  crcLido?: string;
  crcCalculado?: string;
  modelo?: ModeloPix;
  /** Identificador raiz (26 a 51) onde está a conta Pix. */
  idConta?: string;
  chave?: string;
  tipoChave?: TipoChave;
  chaveValida?: boolean;
  /** Endereço do conteúdo do Pix dinâmico (subcampo 25), sem "https://". */
  url?: string;
  /** Endereço da recorrência do Pix Automático (IDs 80 a 99, subcampo 25). */
  urlRecorrencia?: string;
  infoAdicional?: string;
  /** ISPB do facilitador de saque (Pix Saque). */
  fss?: string;
  nome?: string;
  cidade?: string;
  cep?: string;
  /** Valor em centavos. No Pix dinâmico este valor deve ser ignorado. */
  valorCentavos?: number;
  /** Identificador da transação (62-05). Ausente quando "***". */
  txid?: string;
  usoUnico: boolean;
  problemas: Problema[];
}

const GUI_PIX = "br.gov.bcb.pix";

function ehContaPix(c: CampoTlv, ler: (t: string) => ResultadoTlv): CampoTlv[] | undefined {
  const sub = ler(c.valor);
  if (sub.erro) return undefined;
  const gui = campo(sub.campos, "00");
  return gui && gui.valor.toLowerCase() === GUI_PIX ? sub.campos : undefined;
}

/** "123.45" → 12345. Aceita "0", "1.0", "1.00". */
export function valorParaCentavos(texto: string): number | undefined {
  const m = /^(\d{1,10})(?:\.(\d{1,2}))?$/.exec(texto);
  if (!m) return undefined;
  const inteiro = Number(m[1]);
  const fracao = Number((m[2] ?? "").padEnd(2, "0"));
  return inteiro * 100 + fracao;
}

/**
 * Lê um Pix copia e cola. Tolera o que copiar e colar costuma trazer: espaço nas
 * pontas, caracteres invisíveis de editor e quebra de linha no meio do código.
 * Com quebra de linha, tenta três formas de juntar as partes (sem nada, sem os
 * espaços em volta, ou com um espaço no lugar) e só aceita a forma cuja
 * verificação (CRC) confere. Se nenhuma confere, devolve a primeira, com o erro.
 */
export function lerPix(entrada: string): LeituraPix {
  const bases = [limparColagem(entrada).trim()];
  if (entrada.includes("\u00A0")) bases.push(entrada.replace(/[\u200B-\u200D\u2060\uFEFF\u00AD]/g, "").trim());
  const temQuebra = bases.some((b) => QUEBRA.test(b));
  if (!temQuebra && bases.length === 1) return lerPixUmaForma(bases[0] ?? "");
  const junta = /[ \t]*(?:\r\n|\r|\n|\u2028|\u2029)+[ \t]*/g;
  const candidatos = bases.flatMap((b) => [b.replace(/\r\n|\r|\n|\u2028|\u2029/g, ""), b.replace(junta, ""), b.replace(junta, " ")]);
  const leituras = [...new Set(candidatos)].map(lerPixUmaForma);
  const escolhida = leituras.find((l) => l.integro && !temProblemaGrave(l)) ?? leituras[0] ?? lerPixUmaForma("");
  if (temQuebra) {
    escolhida.problemas.push({ codigo: "quebra-de-linha", texto: "O código veio com quebra de linha no meio; as partes foram juntadas.", grave: false });
  }
  return escolhida;
}

function lerPixUmaForma(texto: string): LeituraPix {
  const problemas: Problema[] = [];
  const leitura: LeituraPix = { reconhecido: false, integro: false, usoUnico: false, problemas };
  const grave = (codigo: string, t: string) => problemas.push({ codigo, texto: t, grave: true });
  const aviso = (codigo: string, t: string) => problemas.push({ codigo, texto: t, grave: false });

  if (texto.length === 0) {
    grave("vazio", "Nada foi colado.");
    return leitura;
  }

  let ler = lerTlv;
  let raiz = lerTlv(texto);
  if (raiz.erro && /[^\x00-\x7f]/.test(texto)) {
    const emBytes = lerTlvBytes(texto);
    if (!emBytes.erro) {
      ler = lerTlvBytes;
      raiz = emBytes;
      aviso("tamanho-bytes", "O código conta o tamanho dos campos em bytes, não em caracteres. Aceito.");
    }
  }
  if (raiz.erro) {
    grave("estrutura", `O código está quebrado. ${raiz.erro}`);
    return leitura;
  }
  const campos = raiz.campos;

  // Verificação (CRC): último campo, ID 63, tamanho 4.
  const ultimo = campos[campos.length - 1];
  if (!ultimo || ultimo.id !== "63" || ultimo.tamanho !== 4) {
    grave("sem-crc", "Falta a verificação no fim do código (campo 63).");
  } else {
    const semCrc = texto.slice(0, texto.length - 4);
    leitura.crcLido = ultimo.valor.toUpperCase();
    leitura.crcCalculado = crc16Utf8(semCrc);
    if (leitura.crcLido === leitura.crcCalculado) {
      leitura.integro = true;
    } else {
      const latin1 = crc16Latin1(semCrc);
      if (latin1 && latin1 !== leitura.crcCalculado && latin1 === leitura.crcLido) {
        leitura.integro = true;
        leitura.crcCalculado = latin1;
        aviso("crc-latin1", "A verificação foi feita contando acentos como um byte. Aceito.");
      } else {
        grave("crc", "A verificação não bate: o código foi alterado ou copiado com erro.");
      }
    }
  }

  const repetidos = idsRepetidos(campos);
  if (repetidos.length > 0) grave("repetido", `Campo repetido: ${repetidos.join(", ")}.`);

  if (campos[0]?.id !== "00" || campos[0].valor !== "01") {
    grave("versao", "O código não começa com a versão do BR Code (campo 00 = 01).");
  }

  const pontoIniciacao = campo(campos, "01");
  if (pontoIniciacao) {
    if (pontoIniciacao.valor === "12") leitura.usoUnico = true;
    else if (pontoIniciacao.valor !== "11") aviso("01", "Campo 01 com valor fora do padrão.");
  }

  // Conta Pix: qualquer ID de 26 a 51 com o GUI do Pix.
  const contasPix = campos
    .filter((c) => Number(c.id) >= 26 && Number(c.id) <= 51)
    .map((c) => ({ c, sub: ehContaPix(c, ler) }))
    .filter((x): x is { c: CampoTlv; sub: CampoTlv[] } => x.sub !== undefined);
  const recorrencias = campos
    .filter((c) => Number(c.id) >= 80 && Number(c.id) <= 99)
    .map((c) => ehContaPix(c, ler))
    .filter((s): s is CampoTlv[] => s !== undefined);

  if (contasPix.length > 1) grave("contas", "O código traz mais de uma conta Pix.");

  const conta = contasPix[0];
  // Subcampo repetido (duas chaves, dois endereços) deixa ambíguo para onde vai o dinheiro.
  for (const sub of [...contasPix.map((x) => x.sub), ...recorrencias]) {
    const rep = idsRepetidos(sub);
    if (rep.length > 0) grave("subcampo-repetido", `A conta Pix traz subcampo repetido (${rep.join(", ")}): não dá para saber para onde vai o dinheiro.`);
  }
  if (conta) {
    leitura.idConta = conta.c.id;
    const chave = campo(conta.sub, "01")?.valor;
    const url = campo(conta.sub, "25")?.valor;
    if (chave !== undefined) {
      leitura.chave = chave;
      const cls = classificarChave(chave);
      leitura.tipoChave = cls.tipo;
      leitura.chaveValida = cls.valida;
    }
    if (url !== undefined) leitura.url = url;
    const info = campo(conta.sub, "02")?.valor;
    if (info !== undefined) leitura.infoAdicional = info;
    const fss = campo(conta.sub, "03")?.valor;
    if (fss !== undefined) leitura.fss = fss;
    if (chave !== undefined && url !== undefined) {
      aviso("chave-e-url", "O código traz chave e endereço ao mesmo tempo; vale o endereço.");
    }
  }
  const recorrencia = recorrencias[0];
  const urlRec = recorrencia ? campo(recorrencia, "25")?.valor : undefined;
  if (urlRec !== undefined) leitura.urlRecorrencia = urlRec;

  if (urlRec !== undefined) leitura.modelo = "composto";
  else if (leitura.url !== undefined) leitura.modelo = "dinamico";
  else if (leitura.chave !== undefined) leitura.modelo = "estatico";

  if (!conta && urlRec === undefined) {
    grave("sem-pix", "Não há conta Pix no código (identificador br.gov.bcb.pix).");
  } else if (conta && leitura.modelo === undefined) {
    grave("sem-chave", "A conta Pix não traz chave nem endereço.");
  }

  if (leitura.chave !== undefined && leitura.chaveValida === false) {
    grave("chave", "A chave Pix tem formato ou dígitos inválidos.");
  }

  // Campos obrigatórios do BR Code.
  const mcc = campo(campos, "52");
  const moeda = campo(campos, "53");
  const pais = campo(campos, "58");
  const nome = campo(campos, "59");
  const cidade = campo(campos, "60");
  const adicional = campo(campos, "62");
  if (!mcc || !/^\d{4}$/.test(mcc.valor)) grave("52", "Falta o código de categoria (campo 52).");
  if (!moeda || moeda.valor !== "986") grave("53", "A moeda não é o real (campo 53 = 986).");
  if (!pais || pais.valor !== "BR") grave("58", "O país não é BR (campo 58).");
  if (!nome) grave("59", "Falta o nome do recebedor (campo 59).");
  else {
    leitura.nome = nome.valor;
    if (nome.tamanho > 25) aviso("59-tamanho", "O nome passa de 25 caracteres, fora do padrão.");
  }
  if (!cidade) grave("60", "Falta a cidade (campo 60).");
  else {
    leitura.cidade = cidade.valor;
    if (cidade.tamanho > 15) aviso("60-tamanho", "A cidade passa de 15 caracteres, fora do padrão.");
  }
  const cep = campo(campos, "61");
  if (cep) leitura.cep = cep.valor;

  if (!adicional) {
    grave("62", "Falta o campo de dados adicionais (campo 62).");
  } else {
    const sub = ler(adicional.valor);
    const txid = sub.erro ? undefined : campo(sub.campos, "05");
    if (!sub.erro && idsRepetidos(sub.campos).length > 0) grave("62-repetido", "O campo 62 traz subcampo repetido.");
    if (!txid) grave("62-05", "Falta o identificador da transação (campo 62, subcampo 05).");
    else if (txid.valor !== "***") leitura.txid = txid.valor;
  }

  // Valor (54). No dinâmico o campo é ignorado (manual, seção 2.7): formato ruim vira só aviso.
  const valor = campo(campos, "54");
  if (valor) {
    const centavos = valorParaCentavos(valor.valor);
    if (centavos === undefined) {
      if (leitura.modelo === "estatico") grave("54", "O valor (campo 54) está fora do formato.");
      else aviso("54", "O valor (campo 54) está fora do formato; no Pix dinâmico ele é ignorado.");
    } else if (centavos === 0) {
      aviso("54-zero", "Valor zerado no código: o valor é digitado no banco.");
    } else {
      leitura.valorCentavos = centavos;
    }
  }

  leitura.reconhecido = leitura.modelo !== undefined;
  return leitura;
}

export function temProblemaGrave(leitura: LeituraPix): boolean {
  return leitura.problemas.some((p) => p.grave);
}
