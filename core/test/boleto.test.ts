import { describe, expect, it } from "vitest";
import { dvGeralMod11, dvMod10, formatarLinha, lerBoleto, montarLinha } from "../src/boleto";
import { fatorDaData, vencimentoDoFator } from "../src/vencimento";

// Exemplo do manual "Código de barras Santander", abril 2025, v36 (págs. 7 a 14):
// banco 033, fator 2046, valor 273,71, campo livre 9 0282033 5666124578002 0 101.
// Dígitos publicados no manual: bloco 1 = 7, bloco 2 = 3, bloco 3 = 4, geral = 8.
const SANTANDER = "03399028270335666124357800201014820460000027371";

describe("dígitos do boleto (manual Santander v36)", () => {
  it("módulo 10 dos três blocos", () => {
    expect(dvMod10("033990282")).toBe(7);
    expect(dvMod10("0335666124")).toBe(3);
    expect(dvMod10("5780020101")).toBe(4);
  });

  it("módulo 11 do dígito geral", () => {
    expect(dvGeralMod11("0339" + "20460000027371" + "9028203356661245780020101")).toBe(8);
  });

  it("montarLinha reproduz a linha do manual", () => {
    expect(montarLinha({ banco: "033", fator: 2046, valorCentavos: 27371, campoLivre: "9028203356661245780020101" })).toBe(SANTANDER);
  });
});

describe("lerBoleto", () => {
  it("lê a linha do manual Santander", () => {
    const l = lerBoleto(formatarLinha(SANTANDER), "2003-05-01");
    expect(l.tipo).toBe("cobranca");
    expect(l.integro).toBe(true);
    expect(l.bancoCodigo).toBe("033");
    expect(l.bancoNome).toBe("BCO SANTANDER (BRASIL) S.A.");
    expect(l.valorCentavos).toBe(27371);
    expect(l.codigoBarras).toBe("03398204600000273719028203356661245780020101");
    expect(l.vencimento).toBe("2003-05-15");
    expect(l.cicloVencimento).toBe("1997");
    expect(l.problemas).toEqual([]);
  });

  it("o mesmo fator, lido hoje, cai no ciclo de 2025", () => {
    const l = lerBoleto(SANTANDER, "2026-11-25");
    expect(l.vencimento).toBe("2028-01-04");
    expect(l.cicloVencimento).toBe("2025");
  });

  it("acusa cada dígito adulterado", () => {
    const trocar = (i: number) => SANTANDER.slice(0, i) + ((Number(SANTANDER[i]) + 1) % 10) + SANTANDER.slice(i + 1);
    expect(lerBoleto(trocar(5), "2026-11-25").blocosOk).toEqual([false, true, true]);
    expect(lerBoleto(trocar(12), "2026-11-25").blocosOk).toEqual([true, false, true]);
    expect(lerBoleto(trocar(25), "2026-11-25").blocosOk).toEqual([true, true, false]);
    const valorTrocado = lerBoleto(trocar(45), "2026-11-25");
    expect(valorTrocado.dvGeralOk).toBe(false);
    expect(valorTrocado.integro).toBe(false);
  });

  it("valor e vencimento zerados", () => {
    const linha = montarLinha({ banco: "001", fator: 0, valorCentavos: 0, campoLivre: "0".repeat(25) });
    const l = lerBoleto(linha, "2026-11-25");
    expect(l.integro).toBe(true);
    expect(l.semVencimento).toBe(true);
    expect(l.semValor).toBe(true);
  });

  it("banco fora da lista do Banco Central vira alerta, não erro de dígito", () => {
    const linha = montarLinha({ banco: "999", fator: 1640, valorCentavos: 100, campoLivre: "1".repeat(25) });
    const l = lerBoleto(linha, "2026-11-25");
    expect(l.integro).toBe(true);
    expect(l.bancoNome).toBeUndefined();
    expect(l.problemas.map((p) => p.codigo)).toEqual(["banco-desconhecido"]);
  });

  it("linha de 48 dígitos começando com 8 é arrecadação, fora do mínimo", () => {
    expect(lerBoleto("8".padEnd(48, "0"), "2026-11-25").tipo).toBe("arrecadacao");
  });

  it("tamanho errado", () => {
    const l = lerBoleto(SANTANDER.slice(0, 46), "2026-11-25");
    expect(l.tipo).toBe("desconhecido");
    expect(l.problemas[0]?.codigo).toBe("tamanho");
  });
});

describe("fator de vencimento", () => {
  it("exemplos do manual Santander: ciclo de 1997", () => {
    expect(fatorDaData("2000-12-06")).toBe(1156);
    expect(fatorDaData("2000-12-15")).toBe(1165);
    expect(fatorDaData("2000-12-30")).toBe(1180);
  });

  it("exemplos do manual Santander: reinício em 22/02/2025", () => {
    expect(fatorDaData("2025-02-22")).toBe(1000);
    expect(fatorDaData("2025-02-23")).toBe(1001);
    expect(fatorDaData("2025-02-24")).toBe(1002);
    expect(fatorDaData("2025-02-21")).toBe(9999);
    expect(vencimentoDoFator(1000, "2025-03-01")).toEqual({ data: "2025-02-22", ciclo: "2025" });
    expect(vencimentoDoFator(9999, "2025-02-01")).toEqual({ data: "2025-02-21", ciclo: "1997" });
  });

  it("fator 0000 = sem vencimento; 1 a 999 fora do padrão", () => {
    expect(vencimentoDoFator(0, "2026-11-25")).toBeNull();
    expect(vencimentoDoFator(500, "2026-11-25")).toBeUndefined();
  });
});
