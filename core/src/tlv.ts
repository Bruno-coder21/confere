// Campos encadeados do BR Code (EMV MPM): 2 dígitos de identificador,
// 2 dígitos de tamanho e o valor. Pelo Manual do BR Code (BCB, seção 2.1),
// "tamanho especifica quantos caracteres na sequência compõem o valor".
// Alguns geradores contam bytes UTF-8 em nomes com acento; lerTlvBytes cobre esse caso.

export interface CampoTlv {
  id: string;
  tamanho: number;
  valor: string;
}

export interface ResultadoTlv {
  campos: CampoTlv[];
  erro?: string;
}

export function lerTlv(texto: string): ResultadoTlv {
  const chars = Array.from(texto);
  const campos: CampoTlv[] = [];
  let pos = 0;
  while (pos < chars.length) {
    if (pos + 4 > chars.length) {
      return { campos, erro: `Texto termina no meio de um campo (posição ${pos + 1}).` };
    }
    const id = chars.slice(pos, pos + 2).join("");
    const tam = chars.slice(pos + 2, pos + 4).join("");
    if (!/^\d{2}$/.test(id) || !/^\d{2}$/.test(tam)) {
      return { campos, erro: `Campo sem identificador ou tamanho numérico (posição ${pos + 1}).` };
    }
    const tamanho = Number(tam);
    if (pos + 4 + tamanho > chars.length) {
      return { campos, erro: `O campo ${id} diz ter ${tamanho} caracteres, mas o texto acaba antes.` };
    }
    campos.push({ id, tamanho, valor: chars.slice(pos + 4, pos + 4 + tamanho).join("") });
    pos += 4 + tamanho;
  }
  return { campos };
}

export function campo(campos: CampoTlv[], id: string): CampoTlv | undefined {
  return campos.find((c) => c.id === id);
}

/** Mesma leitura, contando o tamanho em bytes UTF-8. */
export function lerTlvBytes(texto: string): ResultadoTlv {
  const bytes = new TextEncoder().encode(texto);
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const ascii = (a: number, b: number) => String.fromCharCode(...bytes.slice(a, b));
  const campos: CampoTlv[] = [];
  let pos = 0;
  while (pos < bytes.length) {
    if (pos + 4 > bytes.length) return { campos, erro: `Texto termina no meio de um campo (byte ${pos + 1}).` };
    const id = ascii(pos, pos + 2);
    const tam = ascii(pos + 2, pos + 4);
    if (!/^\d{2}$/.test(id) || !/^\d{2}$/.test(tam)) return { campos, erro: `Campo sem identificador ou tamanho numérico (byte ${pos + 1}).` };
    const tamanho = Number(tam);
    if (pos + 4 + tamanho > bytes.length) return { campos, erro: `O campo ${id} diz ter ${tamanho} bytes, mas o texto acaba antes.` };
    let valor: string;
    try {
      valor = decoder.decode(bytes.slice(pos + 4, pos + 4 + tamanho));
    } catch {
      return { campos, erro: `O campo ${id} corta um caractere no meio.` };
    }
    campos.push({ id, tamanho, valor });
    pos += 4 + tamanho;
  }
  return { campos };
}

/** IDs que aparecem mais de uma vez. */
export function idsRepetidos(campos: CampoTlv[]): string[] {
  const ids = campos.map((c) => c.id);
  return [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
}
