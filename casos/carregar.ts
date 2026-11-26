// Carrega os casos e troca os marcadores de CPF por CPFs sorteados na hora.
// Nenhum CPF válido fica gravado no repositório; o veredito não depende de qual
// CPF é, só de a chave ser um CPF.

import { readFileSync } from "node:fs";
import { crc16Utf8, sortearCpf } from "@confere/core";
import { MARCADORES_CPF, type Caso } from "./definicoes";

export type CpfsDeTeste = Record<(typeof MARCADORES_CPF)[number], string>;

export function sortearCpfsDeTeste(): CpfsDeTeste {
  const usados = new Set<string>();
  const sortear = () => {
    let c = sortearCpf();
    while (usados.has(c)) c = sortearCpf();
    usados.add(c);
    return c;
  };
  return { CPF_TESTE_1: sortear(), CPF_TESTE_2: sortear(), CPF_TESTE_3: sortear() };
}

/**
 * Troca os marcadores. Se o Pix guardado tinha a verificação certa, ela é
 * refeita depois da troca; se estava errada de propósito, continua errada.
 */
export function prepararCaso(caso: Caso, cpfs: CpfsDeTeste): Caso {
  const original = JSON.stringify(caso.entrada);
  if (!MARCADORES_CPF.some((m) => original.includes(m))) return caso;
  let json = original;
  for (const m of MARCADORES_CPF) json = json.split(m).join(cpfs[m]);
  const entrada = JSON.parse(json) as Caso["entrada"];
  const pixGuardado = caso.entrada.pix;
  if (pixGuardado && entrada.pix && MARCADORES_CPF.some((m) => pixGuardado.includes(m))) {
    const verificacaoCerta = crc16Utf8(pixGuardado.slice(0, -4)) === pixGuardado.slice(-4);
    if (verificacaoCerta) entrada.pix = entrada.pix.slice(0, -4) + crc16Utf8(entrada.pix.slice(0, -4));
  }
  return { ...caso, entrada };
}

export function lerCasosGuardados(): Caso[] {
  return JSON.parse(readFileSync(new URL("./casos.json", import.meta.url), "utf8")) as Caso[];
}

/** Casos prontos para rodar, com CPFs sorteados agora. */
export function carregarCasos(cpfs: CpfsDeTeste = sortearCpfsDeTeste()): Caso[] {
  return lerCasosGuardados().map((c) => prepararCaso(c, cpfs));
}
