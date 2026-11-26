import { describe, expect, it } from "vitest";
import { calcularDvCnpj, formatarCnpj, validarCnpj } from "../src/cnpj";

describe("CNPJ (Receita Federal, CNPJ alfanumérico, pergunta 14)", () => {
  it("exemplo oficial da Receita: 12.ABC.345/01DE-35", () => {
    expect(calcularDvCnpj("12ABC34501DE")).toBe("35");
    expect(validarCnpj("12.ABC.345/01DE-35")).toEqual({ valido: true, normalizado: "12ABC34501DE35", formato: "alfanumerico" });
  });

  it("aceita minúsculas convertendo para maiúsculas", () => {
    expect(validarCnpj("12.abc.345/01de-35").valido).toBe(true);
  });

  it("exemplos 2 e 3 da pergunta 23 da Receita", () => {
    expect(validarCnpj("AA345678/000A-29").valido).toBe(true);
    expect(validarCnpj("12.345.678/000A-08").valido).toBe(true);
  });

  it("o exemplo 1 da pergunta 23 (AA345678/0003-29) tem dígito errado no documento; o certo é 86", () => {
    expect(validarCnpj("AA345678/0003-29").valido).toBe(false);
    expect(calcularDvCnpj("AA3456780003")).toBe("86");
  });

  it("CNPJ numérico usa a mesma conta (exemplo de chave do manual do Pix)", () => {
    expect(validarCnpj("00038166000105")).toEqual({ valido: true, normalizado: "00038166000105", formato: "numerico" });
  });

  it("recusa dígito trocado, letra nos dígitos finais e caracteres iguais", () => {
    expect(validarCnpj("12ABC34501DE36").valido).toBe(false);
    expect(validarCnpj("12ABC34501DE3A").valido).toBe(false);
    expect(validarCnpj("00000000000000").valido).toBe(false);
    expect(validarCnpj("123").valido).toBe(false);
  });

  it("formata", () => {
    expect(formatarCnpj("12ABC34501DE35")).toBe("12.ABC.345/01DE-35");
  });
});
