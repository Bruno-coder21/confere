// Limpeza e reconhecimento do que a pessoa colou ou digitou.
// Regra: entrada não reconhecida vira resposta visível, nunca silêncio.

/** Caracteres invisíveis que editores e apps de mensagem inserem (nunca fazem parte de Pix ou boleto). */
const INVISIVEIS = /[\u200B-\u200D\u2060\uFEFF\u00AD]/g;
/** Quebras de linha de qualquer sistema (CRLF, LF, CR, separadores Unicode). */
export const QUEBRA = /\r\n|\r|\n|\u2028|\u2029/;
const QUEBRAS_GLOBAL = /\r\n|\r|\n|\u2028|\u2029/g;

/** Tira invisíveis e troca espaço não separável por espaço comum. */
export function limparColagem(texto: string): string {
  return texto.replace(INVISIVEIS, "").replace(/\u00A0/g, " ");
}

/** Separadores aceitos numa linha de boleto: espaço, tab, quebra, ponto e traços. */
const SEPARADORES_BOLETO = /[\s.\-\u2010-\u2015\u2212]/g;

export function digitosDoBoleto(texto: string): string {
  return limparColagem(texto).replace(SEPARADORES_BOLETO, "");
}

/** Caracteres que sobram numa linha de boleto e não são dígitos (para a mensagem de erro). */
export function caracteresEstranhosBoleto(texto: string): string[] {
  return [...new Set(Array.from(digitosDoBoleto(texto)).filter((c) => !/[0-9]/.test(c)))];
}

export type TipoEntrada = "pix" | "boleto" | "vazio" | "desconhecido";

export interface Reconhecimento {
  tipo: TipoEntrada;
  /** Explicação em linguagem simples, sempre preenchida quando o tipo não é pix nem boleto. */
  motivo?: string;
}

function pareceInicioDePix(t: string): boolean {
  return /^000201/.test(t) || /br\.gov\.bcb\.pix/i.test(t);
}

/** Diz se o texto parece Pix copia e cola, linha de boleto ou nada disso. */
export function classificarEntrada(texto: string): Reconhecimento {
  const t = limparColagem(texto).trim();
  if (t === "") return { tipo: "vazio", motivo: "Nada foi colado ou digitado." };
  if (pareceInicioDePix(t.replace(QUEBRAS_GLOBAL, ""))) return { tipo: "pix" };
  const digitos = digitosDoBoleto(t);
  if (/^[0-9]+$/.test(digitos)) return { tipo: "boleto" };
  if (/^[0-9]/.test(digitos) && digitos.replace(/[^0-9]/g, "").length >= 40) {
    return {
      tipo: "boleto",
      motivo: `Parece uma linha de boleto, mas tem caracteres que não são números: ${caracteresEstranhosBoleto(t).join(" ")}`,
    };
  }
  return {
    tipo: "desconhecido",
    motivo: "Não parece um Pix copia e cola (que começa com 000201) nem a linha de um boleto (47 ou 48 números).",
  };
}

// ---------------------------------------------------------------------------
// Arquivo com várias entradas (usado pelo script conferir).

export interface EntradaArquivo {
  tipo: "pix" | "boleto" | "desconhecido" | "comentario-com-codigo";
  linhaInicial: number;
  linhaFinal: number;
  /** Texto da entrada; linhas de continuação juntas com quebra de linha (Pix) ou espaço (boleto). */
  texto: string;
  motivo?: string;
}

export interface LeituraArquivo {
  entradas: EntradaArquivo[];
  totalLinhas: number;
  linhasEmBranco: number;
  linhasDeComentario: number;
}

function boletoCompleto(t: string): boolean {
  const d = digitosDoBoleto(t);
  return /^[0-9]+$/.test(d) && (d.length === 47 || d.length === 48);
}

/**
 * Separa um arquivo em entradas. Aceita CRLF, CR ou LF; ignora linhas em
 * branco e comentários (#), mas avisa comentário que contém código; junta
 * Pix ou boleto quebrados em mais de uma linha.
 * @param pixCompleto diz se um Pix já está inteiro (verificação confere); usado para saber se a linha seguinte é continuação.
 */
export function separarEntradas(arquivo: string, pixCompleto: (texto: string) => boolean): LeituraArquivo {
  const linhas = limparColagem(arquivo).split(QUEBRA);
  // Um arquivo que termina em quebra de linha gera uma última linha vazia que não conta.
  if (linhas.length > 0 && linhas[linhas.length - 1] === "") linhas.pop();
  const entradas: EntradaArquivo[] = [];
  let atual: EntradaArquivo | undefined;
  let linhasEmBranco = 0;
  let linhasDeComentario = 0;

  const fechar = () => {
    if (atual) entradas.push(atual);
    atual = undefined;
  };

  linhas.forEach((bruta, i) => {
    const n = i + 1;
    const linha = bruta.trim();
    if (linha === "") {
      linhasEmBranco++;
      fechar();
      return;
    }
    if (linha.startsWith("#")) {
      linhasDeComentario++;
      fechar();
      const resto = linha.replace(/^#+/, "").trim();
      if (pareceInicioDePix(resto) || digitosDoBoleto(resto).replace(/[^0-9]/g, "").length >= 40) {
        entradas.push({
          tipo: "comentario-com-codigo",
          linhaInicial: n,
          linhaFinal: n,
          texto: resto,
          motivo: "A linha começa com # e por isso é tratada como comentário, mas parece ter um código. Tire o # do começo.",
        });
      }
      return;
    }

    const tipo = classificarEntrada(linha).tipo;

    // Continuação de um Pix que ainda não fechou (quebra de linha no meio do código).
    if (atual?.tipo === "pix" && !pareceInicioDePix(linha) && !boletoCompleto(linha) && !pixCompleto(atual.texto)) {
      atual.texto += "\n" + bruta;
      atual.linhaFinal = n;
      return;
    }
    if (tipo === "pix") {
      fechar();
      atual = { tipo: "pix", linhaInicial: n, linhaFinal: n, texto: bruta };
      return;
    }
    // Continuação de um boleto quebrado em mais de uma linha.
    if (tipo === "boleto" && atual?.tipo === "boleto") {
      const juntos = digitosDoBoleto(atual.texto + linha);
      if (!boletoCompleto(atual.texto) && /^[0-9]+$/.test(juntos) && juntos.length <= 48) {
        atual.texto += " " + linha;
        atual.linhaFinal = n;
        return;
      }
    }
    fechar();
    if (tipo === "boleto") {
      atual = { tipo: "boleto", linhaInicial: n, linhaFinal: n, texto: linha };
      return;
    }
    const motivo = classificarEntrada(linha).motivo;
    entradas.push({ tipo: "desconhecido", linhaInicial: n, linhaFinal: n, texto: linha, ...(motivo ? { motivo } : {}) });
  });
  fechar();

  return { entradas, totalLinhas: linhas.length, linhasEmBranco, linhasDeComentario };
}
