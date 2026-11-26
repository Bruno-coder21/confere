import { describe, expect, it } from "vitest";
import { montarLinha } from "../src/boleto";
import { sortearCpf } from "../src/cpf";
import { montarPix } from "../src/montar";
import { decidir, type ConsultaCnpj, type EntradaVeredito, type Resultado } from "../src/veredito";

const HOJE = "2026-11-25";
const CNPJ_ACME = "12ABC34501DE35"; // exemplo oficial da Receita
const ACME: ConsultaCnpj = { razaoSocial: "ACME COMERCIO LTDA", nomeFantasia: "ACME", situacao: "ATIVA", dataInicio: "2026-08-03" };

function pix(o: Partial<Parameters<typeof montarPix>[0]> = {}): string {
  return montarPix({ chave: CNPJ_ACME, nome: "ACME COMERCIO", cidade: "SAO PAULO", ...o });
}

function rodar(e: Partial<EntradaVeredito>): Resultado {
  return decidir({ quem: { nome: "Acme Comércio", tipo: "empresa" }, hoje: HOJE, ...e });
}

describe("Pix: confere só com prova por documento", () => {
  it("chave CNPJ igual ao CNPJ informado e consulta ativa → confere", () => {
    const r = rodar({ quem: { nome: "Acme", tipo: "empresa", cnpj: "12.ABC.345/01DE-35" }, pix: pix(), consultas: { [CNPJ_ACME]: ACME } });
    expect(r.veredito).toBe("confere");
  });

  it("chave CNPJ sem CNPJ informado, nome da consulta bate → confere", () => {
    expect(rodar({ pix: pix(), consultas: { [CNPJ_ACME]: ACME } }).veredito).toBe("confere");
  });

  it("nome da consulta só começa igual (empresa de nome parecido) → não consegui confirmar", () => {
    const parecida: ConsultaCnpj = { razaoSocial: "ACME COMERCIO E SERVICOS DIGITAIS LTDA", situacao: "ATIVA" };
    const r = rodar({ pix: pix(), consultas: { [CNPJ_ACME]: parecida } });
    expect(r.veredito).toBe("nao_consegui_confirmar");
  });

  it("só pelo nome, empresa aberta há menos de 90 dias → não consegui confirmar", () => {
    const nova: ConsultaCnpj = { ...ACME, dataInicio: "2026-10-27" }; // 29 dias antes de HOJE
    const r = rodar({ pix: pix(), consultas: { [CNPJ_ACME]: nova } });
    expect(r.veredito).toBe("nao_consegui_confirmar");
    expect(r.motivos.join(" ")).toContain("há 29 dias");
  });

  it("empresa nova, mas com CNPJ informado igual → confere", () => {
    const nova: ConsultaCnpj = { ...ACME, dataInicio: "2026-10-27" };
    const r = rodar({ quem: { nome: "Acme Comércio", tipo: "empresa", cnpj: CNPJ_ACME }, pix: pix(), consultas: { [CNPJ_ACME]: nova } });
    expect(r.veredito).toBe("confere");
  });

  it("só pelo nome, consulta sem data de abertura → não consegui confirmar", () => {
    const { dataInicio: _, ...semData } = ACME;
    expect(rodar({ pix: pix(), consultas: { [CNPJ_ACME]: semData } }).veredito).toBe("nao_consegui_confirmar");
  });

  it("chave CNPJ e consulta indisponível → não consegui confirmar", () => {
    const r = rodar({ pix: pix(), consultas: { [CNPJ_ACME]: "indisponivel" } });
    expect(r.veredito).toBe("nao_consegui_confirmar");
  });

  it("chave CNPJ sem consulta feita → não consegui confirmar e pede a consulta", () => {
    const r = rodar({ pix: pix() });
    expect(r.veredito).toBe("nao_consegui_confirmar");
    expect(r.cnpjsParaConsultar).toEqual([CNPJ_ACME]);
  });

  it("CNPJ baixado → não consegui confirmar", () => {
    const r = rodar({ pix: pix(), consultas: { [CNPJ_ACME]: { ...ACME, situacao: "BAIXADA" } } });
    expect(r.veredito).toBe("nao_consegui_confirmar");
  });

  it("chave aleatória com nome do código igual → não consegui confirmar (o nome do código não prova nada)", () => {
    const r = rodar({ pix: pix({ chave: "4b7b4eb3-d426-48f1-8ecf-998bda62c0a1" }) });
    expect(r.veredito).toBe("nao_consegui_confirmar");
    expect(r.orientacao).toContain("Acme Comércio");
  });
});

describe("Pix: não confere", () => {
  it("CRC adulterado", () => {
    const t = pix();
    expect(rodar({ pix: t.slice(0, -4) + (t.endsWith("0000") ? "0001" : "0000") }).veredito).toBe("nao_confere");
  });

  it("chave CPF quando a pessoa paga empresa", () => {
    expect(rodar({ pix: pix({ chave: sortearCpf() }) }).veredito).toBe("nao_confere");
  });

  it("CNPJ da chave diferente do informado", () => {
    const r = rodar({ quem: { nome: "Acme", tipo: "empresa", cnpj: "AA345678000A29" }, pix: pix(), consultas: { [CNPJ_ACME]: ACME } });
    expect(r.veredito).toBe("nao_confere");
  });

  it("consulta mostra outra empresa", () => {
    const r = rodar({ pix: pix({ nome: "ACME" }), consultas: { [CNPJ_ACME]: { ...ACME, razaoSocial: "OUTRA COISA LTDA", nomeFantasia: "" } } });
    expect(r.veredito).toBe("nao_confere");
  });

  it("nome do código claramente diferente", () => {
    expect(rodar({ pix: pix({ chave: "joao@example.com", nome: "JOAO PEREIRA" }) }).veredito).toBe("nao_confere");
  });

  it("valor diferente do informado", () => {
    const r = rodar({ pix: pix({ valorCentavos: 15000 }), informado: { valorCentavos: 1500 }, consultas: { [CNPJ_ACME]: ACME } });
    expect(r.veredito).toBe("nao_confere");
  });
});

describe("Pix dinâmico e composto", () => {
  const url = "pix.example.com/qr/v2/8b3da2f39a4140d1a91abd93113bd441";

  it("conteúdo não buscado → não consegui confirmar", () => {
    expect(rodar({ pix: pix({ chave: undefined, url }) }).veredito).toBe("nao_consegui_confirmar");
  });

  it("conteúdo buscado com chave CNPJ que bate → confere; valor do código é ignorado", () => {
    const r = rodar({
      pix: pix({ chave: undefined, url, valorCentavos: 999 }),
      cobranca: { chave: CNPJ_ACME, valor: { original: "50.00" }, txid: "a".repeat(26), status: "ATIVA" },
      informado: { valorCentavos: 5000 },
      consultas: { [CNPJ_ACME]: ACME },
    });
    expect(r.veredito).toBe("confere");
  });

  it("endereço com protocolo → não confere", () => {
    expect(rodar({ pix: pix({ chave: undefined, url: "https://pix.example.com/abc" }) }).veredito).toBe("nao_confere");
  });

  it("QR composto (Pix Automático) → não consegui confirmar", () => {
    const r = rodar({ pix: pix({ chave: undefined, url, urlRecorrencia: "pix.example.com/rec/2353c790eefb11eaadc10242ac120002" }) });
    expect(r.veredito).toBe("nao_consegui_confirmar");
  });
});

describe("Boleto: nunca confere só com a linha", () => {
  const linha = montarLinha({ banco: "341", fator: 1650, valorCentavos: 18990, campoLivre: "1090000012345678901234567" });

  it("linha íntegra → não consegui confirmar, com banco, vencimento e valor", () => {
    const r = rodar({ boleto: linha });
    expect(r.veredito).toBe("nao_consegui_confirmar");
    expect(r.evidencias.map((e) => e.valor)).toEqual(expect.arrayContaining(["341 — ITAÚ UNIBANCO S.A.", "04/12/2026", "R$ 189,90"]));
  });

  it("valor, vencimento ou banco divergente → não confere", () => {
    expect(rodar({ boleto: linha, informado: { valorCentavos: 18900 } }).veredito).toBe("nao_confere");
    expect(rodar({ boleto: linha, informado: { vencimento: "2026-12-05" } }).veredito).toBe("nao_confere");
    expect(rodar({ boleto: linha, informado: { bancoCodigo: "237" } }).veredito).toBe("nao_confere");
  });

  it("dígito adulterado → não confere", () => {
    const adulterada = linha.slice(0, 40) + ((Number(linha[40]) + 1) % 10) + linha.slice(41);
    expect(rodar({ boleto: adulterada }).veredito).toBe("nao_confere");
  });
});

describe("linguagem", () => {
  it("nunca usa 'seguro' nem 'pode pagar'", () => {
    const resultados = [
      rodar({ pix: pix(), consultas: { [CNPJ_ACME]: ACME } }),
      rodar({ pix: pix({ chave: sortearCpf() }) }),
      rodar({ pix: pix({ chave: "4b7b4eb3-d426-48f1-8ecf-998bda62c0a1" }) }),
    ];
    const texto = JSON.stringify(resultados.map(({ leituraPix, leituraBoleto, ...r }) => r)).toLowerCase();
    expect(texto).not.toMatch(/seguro|pode pagar/);
  });
});
