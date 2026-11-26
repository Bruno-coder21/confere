import { describe, expect, it } from "vitest";
import { calcularDvCpf, mascararCpf, sortearCpf, validarCpf } from "../src/cpf";

describe("CPF", () => {
  // Nenhum CPF válido fica gravado aqui: os vetores fixos são sequências
  // repetidas (nunca emitidas pela Receita) e o caso válido é sorteado.
  it("calcula os dígitos (vetores com dígitos repetidos)", () => {
    expect(calcularDvCpf("111111111")).toBe("11");
    expect(calcularDvCpf("000000000")).toBe("00");
    expect(validarCpf("11111111111").valido).toBe(false); // sequência repetida é recusada
  });

  it("valida CPF sorteado e recusa dígito trocado", () => {
    for (let i = 0; i < 50; i++) {
      const cpf = sortearCpf();
      expect(validarCpf(cpf).valido).toBe(true);
      const trocado = cpf.slice(0, 10) + ((Number(cpf[10]) + 1) % 10);
      expect(validarCpf(trocado).valido).toBe(false);
    }
    expect(validarCpf("12345678900").valido).toBe(false);
  });

  it("mascara como os bancos", () => {
    expect(mascararCpf("12345678900")).toBe("***.456.789-**");
  });
});
