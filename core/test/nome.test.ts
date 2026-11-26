import { describe, expect, it } from "vitest";
import { compararNomes, normalizarNome } from "../src/nome";

describe("normalizarNome", () => {
  it("tira acento, pontuação e sufixos de empresa", () => {
    expect(normalizarNome("Padaria São João Ltda.")).toBe("PADARIA SAO JOAO");
    expect(normalizarNome("Acme Comércio S.A.")).toBe("ACME COMERCIO");
    expect(normalizarNome("ACME COMERCIO S/A")).toBe("ACME COMERCIO");
    expect(normalizarNome("Zé das Couves ME")).toBe("ZE DAS COUVES");
    expect(normalizarNome("Fulano EIRELI - EPP")).toBe("FULANO");
  });
});

describe("compararNomes", () => {
  it("igual depois de normalizar", () => {
    expect(compararNomes("Padaria São João", "PADARIA SAO JOAO LTDA")).toBe("igual");
  });

  it("nome cortado em 25 caracteres no meio da palavra", () => {
    // "PADARIA E CONFEITARIA SAN" tem 25 caracteres: o corte caiu no meio de SANTOS.
    expect("PADARIA E CONFEITARIA SAN".length).toBe(25);
    expect(compararNomes("Padaria e Confeitaria Santos", "PADARIA E CONFEITARIA SAN")).toBe("contem");
  });

  it("nome abreviado em palavra inteira", () => {
    expect(compararNomes("Padaria do Zé", "PADARIA DO ZE COMERCIO DE")).toBe("contem");
  });

  it("prefixo curto no meio da palavra não conta como corte", () => {
    expect(compararNomes("Marcenaria Silva", "MARC")).not.toBe("contem");
  });

  it("parcial: dividem uma palavra significativa", () => {
    expect(compararNomes("Loja do João", "JOAO PEREIRA")).toBe("parcial");
  });

  it("diferente: nenhuma palavra significativa em comum", () => {
    expect(compararNomes("Padaria Pão Quente", "MARIA SOUZA")).toBe("diferente");
    expect(compararNomes("Comércio de Roupas Lua", "COMERCIO DE PECAS SOL")).toBe("diferente");
  });
});
