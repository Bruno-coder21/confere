import { describe, expect, it } from "vitest";
import { lerCobranca, validarLocation } from "../src/cobranca";

describe("validarLocation (manual do Pix, seção 2.5.2)", () => {
  it("aceita os exemplos do manual", () => {
    expect(validarLocation("pix.example.com/8b3da2f39a4140d1a91abd93113bd441")).toEqual({ valida: true, tipo: "cob", host: "pix.example.com" });
    expect(validarLocation("pix.example.com/rec/2353c790eefb11eaadc10242ac120002").tipo).toBe("rec");
    expect(validarLocation("pix.example.com/qr/v2/cobv/abc123").tipo).toBe("cobv");
  });

  it("recusa protocolo, IP, localhost, porta, tamanho e caracteres inválidos", () => {
    expect(validarLocation("https://pix.example.com/abc").valida).toBe(false);
    expect(validarLocation("192.168.0.1/abc").valida).toBe(false);
    expect(validarLocation("localhost/abc").valida).toBe(false);
    expect(validarLocation("pix.example.com:8443/abc").valida).toBe(false);
    expect(validarLocation("pix.example.com/" + "a".repeat(70)).valida).toBe(false);
    expect(validarLocation("pix.example.com/a b").valida).toBe(false);
    expect(validarLocation("pix.example.com").valida).toBe(false);
  });

  it("recusa domínio reservado, IP disfarçado e credencial antes do domínio", () => {
    expect(validarLocation("psp.local/qr/abc").valida).toBe(false);
    expect(validarLocation("metadata.internal/abc").valida).toBe(false);
    expect(validarLocation("a.localhost/abc").valida).toBe(false);
    expect(validarLocation("2130706433/abc").valida).toBe(false);
    expect(validarLocation("0x7f.1/abc").valida).toBe(false);
    expect(validarLocation("[::1]/abc").valida).toBe(false);
    expect(validarLocation("user@pix.example.com/abc").valida).toBe(false);
    expect(validarLocation("pix.example.com./abc").valida).toBe(false);
  });
});

describe("lerCobranca (manual do Pix, seção 2.7.1)", () => {
  it("cobrança imediata: chave e valor original, sem nome do recebedor", () => {
    const c = lerCobranca({ revisao: 0, chave: "12ABC34501DE35", txid: "x".repeat(26), valor: { original: "123.45" }, status: "ATIVA" }, "cob");
    expect(c).toEqual({ tipo: "cob", chave: "12ABC34501DE35", tipoChave: "cnpj", valorCentavos: 12345, txid: "x".repeat(26), status: "ATIVA" });
  });

  it("cobrança com vencimento: valor final e recebedor", () => {
    const c = lerCobranca(
      {
        chave: "fulano@example.com",
        valor: { original: "100.00", final: "102.50" },
        calendario: { dataDeVencimento: "2026-12-10" },
        recebedor: { cnpj: "12abc34501de35", nome: "ACME LTDA", nomeFantasia: "ACME" },
        status: "ATIVA",
      },
      "cobv",
    );
    expect(c?.valorCentavos).toBe(10250);
    expect(c?.recebedor).toEqual({ cnpj: "12ABC34501DE35", nome: "ACME LTDA", nomeFantasia: "ACME" });
    expect(c?.vencimento).toBe("2026-12-10");
  });

  it("sem chave não é cobrança", () => {
    expect(lerCobranca({ valor: { original: "1.00" } }, "cob")).toBeUndefined();
    expect(lerCobranca("texto", "cob")).toBeUndefined();
  });
});
