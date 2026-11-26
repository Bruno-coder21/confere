// Monta códigos Pix copia e cola válidos, para testes, casos sintéticos e
// exemplos da tela. Segue a ordem dos campos do Manual do BR Code.

import { crc16Utf8 } from "./crc16";

export function tlv(id: string, valor: string): string {
  const tamanho = Array.from(valor).length;
  if (!/^\d{2}$/.test(id) || tamanho > 99) throw new Error(`Campo ${id} inválido ou com mais de 99 caracteres.`);
  return id + String(tamanho).padStart(2, "0") + valor;
}

export interface OpcoesPix {
  chave?: string;
  /** Endereço do Pix dinâmico, sem "https://". */
  url?: string;
  /** Endereço da recorrência (Pix Automático). */
  urlRecorrencia?: string;
  infoAdicional?: string;
  nome: string;
  cidade: string;
  valorCentavos?: number;
  txid?: string;
  usoUnico?: boolean;
  /** ID raiz da conta Pix (26 a 51). Padrão 26. */
  idConta?: string;
}

export function centavosParaValor(centavos: number): string {
  return `${Math.floor(centavos / 100)}.${String(centavos % 100).padStart(2, "0")}`;
}

/** Monta o texto sem o CRC (termina em "6304"). */
export function montarPixSemCrc(o: OpcoesPix): string {
  let conta = tlv("00", "br.gov.bcb.pix");
  if (o.chave !== undefined) conta += tlv("01", o.chave);
  if (o.infoAdicional !== undefined) conta += tlv("02", o.infoAdicional);
  if (o.url !== undefined) conta += tlv("25", o.url);
  let s = tlv("00", "01");
  if (o.usoUnico) s += tlv("01", "12");
  s += tlv(o.idConta ?? "26", conta);
  s += tlv("52", "0000") + tlv("53", "986");
  if (o.valorCentavos !== undefined) s += tlv("54", centavosParaValor(o.valorCentavos));
  s += tlv("58", "BR") + tlv("59", o.nome) + tlv("60", o.cidade);
  s += tlv("62", tlv("05", o.txid ?? "***"));
  if (o.urlRecorrencia !== undefined) s += tlv("80", tlv("00", "br.gov.bcb.pix") + tlv("25", o.urlRecorrencia));
  return s + "6304";
}

export function montarPix(o: OpcoesPix): string {
  const semCrc = montarPixSemCrc(o);
  return semCrc + crc16Utf8(semCrc);
}
