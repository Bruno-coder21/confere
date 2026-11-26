// Entrada colada ou digitada com formatação de editor, espaços, pontos e
// quebras de linha. Regra: nunca silêncio; entrada estranha vira resposta visível.
import { describe, expect, it } from "vitest";
import { relatorio } from "../scripts/relatorio";
import { lerBoleto } from "../src/boleto";
import { classificarEntrada, separarEntradas } from "../src/entrada";
import { lerPix, temProblemaGrave } from "../src/pix";
import { decidir } from "../src/veredito";

const HOJE = "2026-11-25";
// Exemplo estático do Manual de Padrões para Iniciação do Pix 2.10.0 (dados fictícios).
const PIX =
  "00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***63041D3D";
// Exemplo do manual de código de barras Santander v36 (dados fictícios).
const BOLETO = "03399028270335666124357800201014820460000027371";
const BOLETO_FORMATADO = "03399.02827 03356.661243 57800.201014 8 20460000027371";

const ZW = "\u200B"; // espaço de largura zero
const BOM = "\uFEFF";
const NBSP = "\u00A0";
const SHY = "\u00AD"; // hífen invisível
const EN_DASH = "\u2013";

const pixIntegro = (t: string) => {
  const l = lerPix(t);
  return l.integro && !temProblemaGrave(l);
};

describe("lerPix com formatação de colagem", () => {
  const meio = PIX.indexOf("5204");
  const quebrar = (sep: string) => PIX.slice(0, meio) + sep + PIX.slice(meio);

  it.each([
    ["LF no meio", quebrar("\n")],
    ["CRLF no meio", quebrar("\r\n")],
    ["CR no meio", quebrar("\r")],
    ["quebra com recuo de editor", quebrar("\n    ")],
    ["várias quebras", PIX.slice(0, 30) + "\n" + PIX.slice(30, 80) + "\r\n" + PIX.slice(80)],
    ["BOM no começo", BOM + PIX],
    ["espaço de largura zero no meio", PIX.slice(0, 40) + ZW + PIX.slice(40)],
    ["hífen invisível", PIX.slice(0, 50) + SHY + PIX.slice(50)],
    ["espaços e tabs nas pontas", ` \t ${PIX} \t\n`],
    ["quebra no lugar do espaço do nome", PIX.replace("Fulano de Tal", "Fulano de\nTal")],
    ["espaço não separável no nome", PIX.replace("Fulano de Tal", `Fulano${NBSP}de Tal`)],
  ])("%s → lê e a verificação confere", (_nome, texto) => {
    expect(pixIntegro(texto)).toBe(true);
    expect(lerPix(texto).chave).toBe("123e4567-e12b-12d1-a456-426655440000");
  });

  it("avisa que juntou as partes", () => {
    expect(lerPix(quebrar("\n")).problemas.map((p) => p.codigo)).toContain("quebra-de-linha");
  });

  it("juntar as partes não conserta código adulterado", () => {
    const adulterado = quebrar("\n").replace("BRASILIA", "BRASILIO");
    expect(lerPix(adulterado).integro).toBe(false);
  });
});

describe("lerBoleto com formatação de digitação", () => {
  it.each([
    ["só números", BOLETO],
    ["pontos e espaços", BOLETO_FORMATADO],
    ["quebra de linha entre blocos", BOLETO_FORMATADO.replace(" 57800", "\n57800")],
    ["tabs", BOLETO_FORMATADO.replace(/ /g, "\t")],
    ["traço de editor (\u2013)", BOLETO_FORMATADO.replace(/ /g, EN_DASH)],
    ["invisíveis e espaço não separável", BOM + BOLETO_FORMATADO.replace(/ /g, NBSP) + ZW],
  ])("%s → lê os 47 números", (_nome, texto) => {
    const l = lerBoleto(texto, HOJE);
    expect(l.linha).toBe(BOLETO);
    expect(l.integro).toBe(true);
  });

  it("letra no lugar de número → diz qual caractere achou", () => {
    const l = lerBoleto(BOLETO_FORMATADO.replace("03399", "O3399"), HOJE);
    expect(l.tipo).toBe("desconhecido");
    expect(l.problemas[0]?.texto).toContain('"O"');
  });

  it("vazio → diz que nada foi digitado", () => {
    expect(lerBoleto(" . - ", HOJE).problemas[0]?.codigo).toBe("vazio");
  });
});

describe("classificarEntrada", () => {
  it.each([
    ["", "vazio"],
    ["   \n\t ", "vazio"],
    [ZW + BOM, "vazio"],
    [PIX, "pix"],
    [BOM + PIX, "pix"],
    [BOLETO_FORMATADO, "boleto"],
    ["oi, me paga 50 reais", "desconhecido"],
    ["https://exemplo.example.com/boleto.pdf", "desconhecido"],
  ])("%j → %s", (texto, tipo) => {
    expect(classificarEntrada(texto).tipo).toBe(tipo);
  });

  it("tipo desconhecido sempre traz motivo", () => {
    expect(classificarEntrada("texto qualquer").motivo).toMatch(/Não parece/);
  });
});

describe("decidir nunca fica em silêncio", () => {
  const quem = { nome: "Fulano de Tal", tipo: "pessoa" as const };

  it("sem nada → não consegui confirmar, com motivo", () => {
    const r = decidir({ quem, hoje: HOJE });
    expect(r.veredito).toBe("nao_consegui_confirmar");
    expect(r.motivos[0]).toMatch(/Nada para conferir/);
    expect(decidir({ quem, hoje: HOJE, pix: "  \n ", boleto: ZW }).veredito).toBe("nao_consegui_confirmar");
  });

  it("texto qualquer no campo do Pix → não confere, com motivo", () => {
    const r = decidir({ quem, hoje: HOJE, pix: "oi, me paga 50 reais" });
    expect(r.veredito).toBe("nao_confere");
    expect(r.motivos.length).toBeGreaterThan(0);
  });

  it("letras no campo do boleto → não consegui confirmar, dizendo o que achou", () => {
    const r = decidir({ quem, hoje: HOJE, boleto: "linha do boleto" });
    expect(r.veredito).toBe("nao_consegui_confirmar");
    expect(r.motivos.join(" ")).toMatch(/Encontrei/);
  });

  it("Pix com quebra de linha chega ao veredito normal", () => {
    const r = decidir({ quem, hoje: HOJE, pix: PIX.slice(0, 60) + "\n" + PIX.slice(60) });
    expect(r.veredito).toBe("nao_consegui_confirmar"); // chave aleatória: só o banco mostra o dono
  });
});

describe("arquivo do script conferir", () => {
  // O modelo que o próprio Confere criou em privado/reais.txt: só comentários.
  const MODELO =
    "# Cole aqui, uma por linha, um Pix copia e cola e uma linha de boleto reais.\n" +
    "# Esta pasta está fora do git. Depois rode, no seu terminal (fora do Claude Code):\n" +
    "#   npm run conferir -- privado/reais.txt\n" +
    "# e compare chave, valor, banco e vencimento com o app do seu banco.\n";

  it("defeito de 26/11: arquivo só com comentários avisa em vez de ficar em silêncio", () => {
    expect(Buffer.byteLength(MODELO)).toBe(272);
    const r = relatorio(MODELO, HOJE, "privado/reais.txt");
    expect(r.reconhecidas).toBe(0);
    expect(r.linhas.join("\n")).toMatch(/NENHUM Pix nem boleto foi lido/);
    expect(r.linhas.join("\n")).toMatch(/4 comentário/);
  });

  it("arquivo vazio avisa", () => {
    expect(relatorio("", HOJE).linhas.join("\n")).toMatch(/NENHUM Pix nem boleto/);
  });

  it("final de linha CR (Mac antigo), CRLF e BOM", () => {
    for (const sep of ["\r", "\r\n", "\n"]) {
      const r = separarEntradas(BOM + MODELO.replace(/\n/g, sep) + PIX + sep + BOLETO_FORMATADO + sep, pixIntegro);
      expect(r.entradas.map((e) => e.tipo)).toEqual(["pix", "boleto"]);
    }
  });

  it("Pix quebrado em três linhas vira uma entrada só", () => {
    const texto = `${PIX.slice(0, 40)}\n${PIX.slice(40, 90)}\n${PIX.slice(90)}\n${BOLETO}\n`;
    const r = separarEntradas(texto, pixIntegro);
    expect(r.entradas).toHaveLength(2);
    expect(r.entradas[0]).toMatchObject({ tipo: "pix", linhaInicial: 1, linhaFinal: 3 });
    expect(pixIntegro(r.entradas[0]?.texto ?? "")).toBe(true);
    expect(r.entradas[1]).toMatchObject({ tipo: "boleto", linhaInicial: 4 });
  });

  it("boleto quebrado em duas linhas vira uma entrada só", () => {
    const r = separarEntradas("03399.02827 03356.661243\n57800.201014 8 20460000027371\n", pixIntegro);
    expect(r.entradas).toHaveLength(1);
    expect(lerBoleto(r.entradas[0]?.texto ?? "", HOJE).integro).toBe(true);
  });

  it("comentário com código dentro é avisado", () => {
    const r = relatorio(`# ${PIX}\n`, HOJE);
    expect(r.avisos).toBe(1);
    expect(r.linhas.join("\n")).toMatch(/linha 1: NÃO RECONHECIDA.*Tire o # do começo/);
  });

  it("linha não reconhecida é avisada com número e motivo, sem repetir o conteúdo", () => {
    const r = relatorio(`${PIX}\ntexto qualquer com dado sensível\n${BOLETO}\n`, HOJE);
    const saida = r.linhas.join("\n");
    expect(r.reconhecidas).toBe(2);
    expect(r.avisos).toBe(1);
    expect(saida).toMatch(/linha 2: NÃO RECONHECIDA \(32 caracteres\)/);
    expect(saida).not.toContain("dado sensível");
  });

  it("toda entrada lida aparece no relatório", () => {
    const r = relatorio(`${PIX}\n\n${BOLETO_FORMATADO}\n`, HOJE);
    const saida = r.linhas.join("\n");
    expect(saida).toMatch(/Entrada 1 \(linha 1\)/);
    expect(saida).toMatch(/Entrada 2 \(linha 3\)/);
    expect(saida).toMatch(/Banco: 033 BCO SANTANDER/);
  });
});
