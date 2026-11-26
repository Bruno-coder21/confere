// Leitura da linha digitável do boleto de cobrança (47 dígitos).
// Fonte: BCB, Carta-Circular 2.926/2000 (leiaute do código de barras e da
// representação numérica). O módulo 10 dos três primeiros campos segue as
// especificações dos bancos. A linha não traz o nome de quem recebe.

import bancosJson from "./bancos.json";
import { caracteresEstranhosBoleto, digitosDoBoleto } from "./entrada";
import type { Problema } from "./problema";
import { vencimentoDoFator, type CicloFator } from "./vencimento";

const BANCOS: Record<string, string> = bancosJson.bancos;

export type TipoBoleto = "cobranca" | "arrecadacao" | "desconhecido";

export interface LeituraBoleto {
  tipo: TipoBoleto;
  /** Só os dígitos digitados. */
  linha: string;
  /** Todos os dígitos verificadores conferem. */
  integro: boolean;
  blocosOk?: [boolean, boolean, boolean];
  dvGeralOk?: boolean;
  /** Código de barras (44 dígitos) remontado a partir da linha. */
  codigoBarras?: string;
  bancoCodigo?: string;
  /** Nome reduzido na lista do STR do Banco Central. Ausente se o código não está na lista. */
  bancoNome?: string;
  fator?: number;
  /** AAAA-MM-DD. Ausente quando o boleto não tem vencimento no código. */
  vencimento?: string;
  cicloVencimento?: CicloFator;
  semVencimento: boolean;
  valorCentavos?: number;
  /** Valor zerado: quem paga informa o valor. */
  semValor: boolean;
  problemas: Problema[];
}

export function nomeDoBanco(codigo: string): string | undefined {
  return BANCOS[codigo];
}

/** Dígito do módulo 10: pesos 2 e 1 da direita para a esquerda, somando os algarismos. */
export function dvMod10(digitos: string): number {
  let soma = 0;
  let peso = 2;
  for (let i = digitos.length - 1; i >= 0; i--) {
    let p = Number(digitos[i]) * peso;
    if (p > 9) p -= 9;
    soma += p;
    peso = peso === 2 ? 1 : 2;
  }
  return (10 - (soma % 10)) % 10;
}

/** Dígito geral (Carta-Circular 2.926, nota 1): módulo 11, pesos 2 a 9; 0, 10 ou 11 viram 1. */
export function dvGeralMod11(codigo43: string): number {
  let soma = 0;
  let peso = 2;
  for (let i = codigo43.length - 1; i >= 0; i--) {
    soma += Number(codigo43[i]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const dv = 11 - (soma % 11);
  return dv === 0 || dv === 10 || dv === 11 ? 1 : dv;
}

export function lerBoleto(entrada: string, hoje: string): LeituraBoleto {
  // Aceita espaços, pontos, traços, quebras de linha e invisíveis de editor.
  const linha = digitosDoBoleto(entrada);
  const problemas: Problema[] = [];
  const base: LeituraBoleto = { tipo: "desconhecido", linha, integro: false, semVencimento: false, semValor: false, problemas };

  if (linha === "") {
    problemas.push({ codigo: "vazio", texto: "Nenhum número foi digitado.", grave: false });
    return base;
  }
  if (!/^\d+$/.test(linha)) {
    const estranhos = caracteresEstranhosBoleto(entrada).map((c) => `"${c}"`).join(", ");
    problemas.push({ codigo: "caracteres", texto: `A linha só pode ter números. Encontrei: ${estranhos}.`, grave: false });
    return base;
  }
  if (linha.length === 48 && linha.startsWith("8")) {
    problemas.push({
      codigo: "arrecadacao",
      texto: "É conta de consumo ou tributo (48 números começando com 8). O Confere ainda não confere esse tipo.",
      grave: false,
    });
    return { ...base, tipo: "arrecadacao" };
  }
  if (linha.length !== 47) {
    problemas.push({
      codigo: "tamanho",
      texto: `A linha de um boleto de cobrança tem 47 números; foram digitados ${linha.length}.`,
      grave: false,
    });
    return base;
  }

  const c1 = linha.slice(0, 9);
  const c2 = linha.slice(10, 20);
  const c3 = linha.slice(21, 31);
  const blocosOk: [boolean, boolean, boolean] = [
    dvMod10(c1) === Number(linha[9]),
    dvMod10(c2) === Number(linha[20]),
    dvMod10(c3) === Number(linha[31]),
  ];
  const dvGeral = linha.slice(32, 33);
  const fatorTxt = linha.slice(33, 37);
  const valorTxt = linha.slice(37, 47);
  const bancoCodigo = linha.slice(0, 3);
  const moeda = linha.slice(3, 4);
  const livre = linha.slice(4, 9) + c2 + c3;
  const codigoBarras = bancoCodigo + moeda + dvGeral + fatorTxt + valorTxt + livre;
  const dvGeralOk = dvGeralMod11(codigoBarras.slice(0, 4) + codigoBarras.slice(5)) === Number(dvGeral);

  blocosOk.forEach((ok, i) => {
    if (!ok) problemas.push({ codigo: `bloco${i + 1}`, texto: `O dígito do bloco ${i + 1} não bate.`, grave: true });
  });
  if (!dvGeralOk) problemas.push({ codigo: "dv-geral", texto: "O dígito verificador geral não bate.", grave: true });
  if (moeda !== "9") problemas.push({ codigo: "moeda", texto: "O código de moeda não é o do real (9).", grave: true });

  const leitura: LeituraBoleto = {
    ...base,
    tipo: "cobranca",
    integro: blocosOk.every(Boolean) && dvGeralOk && moeda === "9",
    blocosOk,
    dvGeralOk,
    codigoBarras,
    bancoCodigo,
    semVencimento: false,
    semValor: false,
  };

  const nome = nomeDoBanco(bancoCodigo);
  if (nome) leitura.bancoNome = nome;
  else problemas.push({ codigo: "banco-desconhecido", texto: `O código de banco ${bancoCodigo} não está na lista do Banco Central.`, grave: false });

  const fator = Number(fatorTxt);
  leitura.fator = fator;
  const venc = vencimentoDoFator(fator, hoje);
  if (venc === null) leitura.semVencimento = true;
  else if (venc === undefined) problemas.push({ codigo: "fator", texto: "O fator de vencimento está fora do padrão.", grave: false });
  else {
    leitura.vencimento = venc.data;
    leitura.cicloVencimento = venc.ciclo;
  }

  const valor = Number(valorTxt);
  if (valor === 0) leitura.semValor = true;
  else leitura.valorCentavos = valor;

  return leitura;
}

/** Monta uma linha digitável válida (para casos de teste). */
export function montarLinha(p: { banco: string; fator: number; valorCentavos: number; campoLivre: string }): string {
  if (!/^\d{3}$/.test(p.banco) || !/^\d{25}$/.test(p.campoLivre)) throw new Error("Banco ou campo livre inválido.");
  const fator = String(p.fator).padStart(4, "0");
  const valor = String(p.valorCentavos).padStart(10, "0");
  const semDv = p.banco + "9" + fator + valor + p.campoLivre;
  const dv = dvGeralMod11(semDv);
  const c1 = p.banco + "9" + p.campoLivre.slice(0, 5);
  const c2 = p.campoLivre.slice(5, 15);
  const c3 = p.campoLivre.slice(15, 25);
  return `${c1}${dvMod10(c1)}${c2}${dvMod10(c2)}${c3}${dvMod10(c3)}${dv}${fator}${valor}`;
}

/** 47 dígitos → AAAAA.AAAAA BBBBB.BBBBBB CCCCC.CCCCCC D EEEEEEEEEEEEEE */
export function formatarLinha(l: string): string {
  if (l.length !== 47) return l;
  return `${l.slice(0, 5)}.${l.slice(5, 10)} ${l.slice(10, 15)}.${l.slice(15, 21)} ${l.slice(21, 26)}.${l.slice(26, 32)} ${l[32]} ${l.slice(33)}`;
}
