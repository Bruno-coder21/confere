// CRC16 do BR Code: polinômio 0x1021, valor inicial 0xFFFF (CRC-16/CCITT-FALSE).
// Fonte: Manual do BR Code (BCB), tabela 1, nota 10; Manual de Padrões para
// Iniciação do Pix 2.10.0, seção 2.6.3, nota 28. O cálculo cobre o texto até
// "6304", inclusive. Resultado em 4 hexadecimais maiúsculos.

export function crc16(bytes: Uint8Array): number {
  let crc = 0xffff;
  for (const byte of bytes) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc;
}

export function hex4(valor: number): string {
  return valor.toString(16).toUpperCase().padStart(4, "0");
}

/** CRC sobre os bytes UTF-8 do texto. */
export function crc16Utf8(texto: string): string {
  return hex4(crc16(new TextEncoder().encode(texto)));
}

/**
 * CRC sobre um byte por caractere (Latin-1). Alguns geradores contam assim
 * nomes com acento. Retorna undefined se houver caractere fora do Latin-1.
 */
export function crc16Latin1(texto: string): string | undefined {
  const bytes: number[] = [];
  for (const c of texto) {
    const code = c.codePointAt(0) ?? 0;
    if (code > 0xff) return undefined;
    bytes.push(code);
  }
  return hex4(crc16(Uint8Array.from(bytes)));
}
