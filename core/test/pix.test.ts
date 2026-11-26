import { describe, expect, it } from "vitest";
import { classificarChave } from "../src/chave";
import { crc16Utf8 } from "../src/crc16";
import { lerPix, temProblemaGrave, valorParaCentavos } from "../src/pix";

// Exemplos do Manual de Padrões para Iniciação do Pix 2.10.0 (BCB).
const ESTATICO =
  "00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***63041D3D";
const DINAMICO =
  "00020101021226700014br.gov.bcb.pix2548pix.example.com/8b3da2f39a4140d1a91abd93113bd4415204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***630464E4";
const COMPOSTO =
  "00020101021226700014br.gov.bcb.pix2548pix.example.com/8b3da2f39a4140d1a91abd93113bd4415204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***80740014br.gov.bcb.pix2552pix.example.com/rec/2353c790eefb11eaadc10242ac1200026304FB42";

describe("CRC16 do BR Code", () => {
  it("bate com os três exemplos do manual", () => {
    expect(crc16Utf8(ESTATICO.slice(0, -4))).toBe("1D3D");
    expect(crc16Utf8(DINAMICO.slice(0, -4))).toBe("64E4");
    expect(crc16Utf8(COMPOSTO.slice(0, -4))).toBe("FB42");
  });
});

describe("lerPix", () => {
  it("Pix estático do manual (seção 2.6.3)", () => {
    const l = lerPix(ESTATICO);
    expect(l.reconhecido).toBe(true);
    expect(l.integro).toBe(true);
    expect(l.modelo).toBe("estatico");
    expect(l.idConta).toBe("26");
    expect(l.chave).toBe("123e4567-e12b-12d1-a456-426655440000");
    expect(l.tipoChave).toBe("aleatoria");
    expect(l.nome).toBe("Fulano de Tal");
    expect(l.cidade).toBe("BRASILIA");
    expect(l.valorCentavos).toBeUndefined();
    expect(l.txid).toBeUndefined();
    expect(l.usoUnico).toBe(false);
    expect(temProblemaGrave(l)).toBe(false);
  });

  it("Pix dinâmico do manual (seção 2.7.2)", () => {
    const l = lerPix(DINAMICO);
    expect(l.integro).toBe(true);
    expect(l.modelo).toBe("dinamico");
    expect(l.url).toBe("pix.example.com/8b3da2f39a4140d1a91abd93113bd441");
    expect(l.chave).toBeUndefined();
    expect(l.usoUnico).toBe(true);
    expect(temProblemaGrave(l)).toBe(false);
  });

  it("QR composto do manual (seção 2.8.5): URL de recorrência nos IDs 80 a 99", () => {
    const l = lerPix(COMPOSTO);
    expect(l.integro).toBe(true);
    expect(l.modelo).toBe("composto");
    expect(l.url).toBe("pix.example.com/8b3da2f39a4140d1a91abd93113bd441");
    expect(l.urlRecorrencia).toBe("pix.example.com/rec/2353c790eefb11eaadc10242ac120002");
    expect(temProblemaGrave(l)).toBe(false);
  });

  it("aceita quebra de linha e espaço nas pontas ao colar", () => {
    const l = lerPix(`  ${ESTATICO.slice(0, 60)}\n${ESTATICO.slice(60)}\n`);
    expect(l.integro).toBe(true);
  });

  it("aceita CRC em minúsculas", () => {
    expect(lerPix(ESTATICO.slice(0, -4) + "1d3d").integro).toBe(true);
  });

  it("acusa CRC adulterado", () => {
    const l = lerPix(ESTATICO.slice(0, -4) + "1D3E");
    expect(l.integro).toBe(false);
    expect(l.problemas.map((p) => p.codigo)).toContain("crc");
  });

  it("acusa nome trocado sem refazer o CRC", () => {
    const l = lerPix(ESTATICO.replace("5913Fulano de Tal", "5913Beltrano Tal"));
    expect(l.integro).toBe(false);
  });

  it("acusa código cortado", () => {
    const l = lerPix(ESTATICO.slice(0, 50));
    expect(l.reconhecido).toBe(false);
    expect(temProblemaGrave(l)).toBe(true);
  });

  it("não é Pix: texto qualquer", () => {
    const l = lerPix("oi, me paga 50 reais");
    expect(l.reconhecido).toBe(false);
    expect(temProblemaGrave(l)).toBe(true);
  });

  it("acha a conta Pix fora do ID 26 e com GUI em maiúsculas", () => {
    const corpo =
      "000201" +
      "2740" + "0014BR.GOV.BCB.PIX" + "0118fulano@example.com" +
      "52040000530398654041.505802BR5906FULANO6008BRASILIA62070503***6304";
    const l = lerPix(corpo + crc16Utf8(corpo));
    expect(l.integro).toBe(true);
    expect(l.idConta).toBe("27");
    expect(l.tipoChave).toBe("email");
    expect(l.valorCentavos).toBe(150);
  });
});

describe("classificarChave (manual, seção 2.5.1)", () => {
  it("exemplos do manual", () => {
    expect(classificarChave("fulano_da_silva.recebedor@example.com")).toEqual({ tipo: "email", valida: true });
    expect(classificarChave("00038166000105")).toEqual({ tipo: "cnpj", valida: true });
    expect(classificarChave("12ABC34501DE35")).toEqual({ tipo: "cnpj", valida: true });
    // Mesmo formato do exemplo do manual do BC, com DDD 00, que não existe, para não ser número real.
    expect(classificarChave("+5500912345678")).toEqual({ tipo: "telefone", valida: true });
    expect(classificarChave("123e4567-e12b-12d1-a456-426655440000")).toEqual({ tipo: "aleatoria", valida: true });
  });

  it("CPF com dígito errado é inválido", () => {
    expect(classificarChave("12345678900")).toEqual({ tipo: "cpf", valida: false });
  });
});

describe("valorParaCentavos", () => {
  it("formatos do manual do BR Code", () => {
    expect(valorParaCentavos("0")).toBe(0);
    expect(valorParaCentavos("1.00")).toBe(100);
    expect(valorParaCentavos("123.99")).toBe(12399);
    expect(valorParaCentavos("1.5")).toBe(150);
    expect(valorParaCentavos("1,50")).toBeUndefined();
  });
});
