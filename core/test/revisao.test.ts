// Cenários achados na revisão independente da etapa 2 (26/11/2026).
import { describe, expect, it } from "vitest";
import { crc16Utf8 } from "../src/crc16";
import { centavosParaValor, montarPix, tlv } from "../src/montar";
import { escolherLeitura, lerPix } from "../src/pix";
import { validarLocation } from "../src/cobranca";
import { decidir, type ConsultaCnpj, type EntradaVeredito } from "../src/veredito";

const HOJE = "2026-11-25";
const CNPJ = "ZZPAOQ01000188";
const PADARIA: ConsultaCnpj = { razaoSocial: "PADARIA PAO QUENTE LTDA", nomeFantasia: "PAO QUENTE", situacao: "ATIVA", dataInicio: "2019-03-12" };
const XPTO: ConsultaCnpj = { razaoSocial: "XPTO SOLUCOES DIGITAIS LTDA", situacao: "ATIVA" };
const URL = "psp.example.com/qr/v2/8b3da2f39a4140d1a91abd93113bd441";

function rodar(e: Partial<EntradaVeredito>) {
  return decidir({ quem: { nome: "Padaria Pão Quente", tipo: "empresa" }, hoje: HOJE, ...e });
}

/** Monta um Pix com a conta Pix escrita à mão (para subcampos fora do padrão). */
function pixComConta(conta: string, extra = ""): string {
  const s = tlv("00", "01") + tlv("26", conta) + "52040000" + "5303986" + extra + "5802BR" + tlv("59", "PADARIA PAO QUENTE") + tlv("60", "SAO PAULO") + tlv("62", tlv("05", "***")) + "6304";
  return s + crc16Utf8(s);
}

describe("achado 1: consulta mostra outra empresa mesmo com o CNPJ igual ao informado", () => {
  it("não confere (a pessoa pode ter copiado o CNPJ da cobrança falsa)", () => {
    const r = rodar({
      quem: { nome: "Padaria Pão Quente", tipo: "empresa", cnpj: CNPJ },
      pix: montarPix({ chave: CNPJ, nome: "PADARIA PAO QUENTE", cidade: "SAO PAULO" }),
      consultas: { [CNPJ]: XPTO },
    });
    expect(r.veredito).toBe("nao_confere");
  });
});

describe("achado 2: subcampo repetido na conta Pix", () => {
  it("duas chaves → não confere", () => {
    const conta = tlv("00", "br.gov.bcb.pix") + tlv("01", CNPJ) + tlv("01", "golpista@example.com");
    const t = pixComConta(conta);
    expect(lerPix(t).problemas.map((p) => p.codigo)).toContain("subcampo-repetido");
    expect(rodar({ pix: t, consultas: { [CNPJ]: PADARIA } }).veredito).toBe("nao_confere");
  });

  it("dois endereços → não confere", () => {
    const conta = tlv("00", "br.gov.bcb.pix") + tlv("25", "psp.example.com/qr/a") + tlv("25", "psp2.example.com/qr/b");
    expect(rodar({ pix: pixComConta(conta) }).veredito).toBe("nao_confere");
  });
});

describe("achado 3: dado que não pôde ser comparado não vira confere", () => {
  it("CNPJ informado com dígito errado → não consegui confirmar", () => {
    const r = rodar({
      quem: { nome: "Padaria Pão Quente", tipo: "empresa", cnpj: "11.111.111/0001-00" },
      pix: montarPix({ chave: CNPJ, nome: "PADARIA PAO QUENTE", cidade: "SAO PAULO" }),
      consultas: { [CNPJ]: PADARIA },
    });
    expect(r.veredito).toBe("nao_consegui_confirmar");
  });

  it("cobrança sem valor → não consegui confirmar", () => {
    const r = rodar({
      pix: montarPix({ url: URL, nome: "PADARIA PAO QUENTE", cidade: "SAO PAULO" }),
      cobranca: { chave: CNPJ, txid: "a".repeat(26), status: "ATIVA" },
      informado: { valorCentavos: 5000 },
      consultas: { [CNPJ]: PADARIA },
    });
    expect(r.veredito).toBe("nao_consegui_confirmar");
  });

  it("'/cobv/' na consulta da URL não muda o tipo da cobrança", () => {
    expect(validarLocation("psp.example.com/qr/v2/abc?x=/cobv/").tipo).toBe("cob");
    const r = rodar({
      pix: montarPix({ url: "psp.example.com/qr/v2/abc?x=/cobv/", nome: "PADARIA PAO QUENTE", cidade: "SAO PAULO" }),
      cobranca: { chave: CNPJ, valor: { original: "999.00" }, status: "ATIVA" },
      informado: { valorCentavos: 5000 },
      consultas: { [CNPJ]: PADARIA },
    });
    expect(r.veredito).toBe("nao_confere");
  });

  it("cobrança removida → não consegui confirmar", () => {
    const r = rodar({
      pix: montarPix({ url: URL, nome: "PADARIA PAO QUENTE", cidade: "SAO PAULO" }),
      cobranca: { chave: CNPJ, valor: { original: "50.00" }, status: "REMOVIDA_PELO_USUARIO_RECEBEDOR" },
      consultas: { [CNPJ]: PADARIA },
    });
    expect(r.veredito).toBe("nao_consegui_confirmar");
  });
});

describe("achado 5: sinais valem também sem conteúdo dinâmico e no Pix Automático", () => {
  it("dinâmico sem conteúdo com nome do código claramente diferente → não confere", () => {
    const r = rodar({ quem: { nome: "Livraria Letra Viva", tipo: "empresa" }, pix: montarPix({ url: URL, nome: "MARCOS ALVES", cidade: "SAO PAULO" }), cobranca: "indisponivel" });
    expect(r.veredito).toBe("nao_confere");
  });

  it("Pix Automático com nome diferente → não confere", () => {
    const r = rodar({
      quem: { nome: "Livraria Letra Viva", tipo: "empresa" },
      pix: montarPix({ url: URL, urlRecorrencia: "psp.example.com/qr/v2/rec/2353c790eefb11eaadc10242ac120002", nome: "MARCOS ALVES", cidade: "SAO PAULO" }),
    });
    expect(r.veredito).toBe("nao_confere");
  });
});

describe("achado 6: falsos 'não confere' em pagamento legítimo", () => {
  const FARMACIA = "ZZFARM09000164";
  const consultaFarmacia: ConsultaCnpj = { razaoSocial: "FV DROGARIA E PERFUMARIA LTDA", nomeFantasia: "FARMACIA VIDA BOA", situacao: "ATIVA" };

  it("código com a razão social, pessoa conhece o nome fantasia → confere", () => {
    const r = decidir({
      quem: { nome: "Farmácia Vida Boa", tipo: "empresa", cnpj: FARMACIA },
      hoje: HOJE,
      pix: montarPix({ chave: FARMACIA, nome: "FV DROGARIA E PERFUMARIA", cidade: "SAO PAULO" }),
      consultas: { [FARMACIA]: consultaFarmacia },
    });
    expect(r.veredito).toBe("confere");
  });

  it("valor 0.00 no código não é divergência", () => {
    const corpo = montarPix({ chave: CNPJ, nome: "PADARIA PAO QUENTE", cidade: "SAO PAULO", valorCentavos: 0 });
    expect(corpo).toContain(tlv("54", centavosParaValor(0)));
    const r = rodar({ pix: corpo, informado: { valorCentavos: 2350 }, consultas: { [CNPJ]: PADARIA } });
    expect(r.veredito).toBe("confere");
  });

  it("campo 54 malformado no dinâmico é ignorado", () => {
    const conta = tlv("00", "br.gov.bcb.pix") + tlv("25", URL);
    const t = pixComConta(conta, tlv("54", "10,00"));
    expect(lerPix(t).problemas.filter((p) => p.grave)).toEqual([]);
    const r = rodar({ pix: t, cobranca: { chave: CNPJ, valor: { original: "10.00" }, status: "ATIVA" }, consultas: { [CNPJ]: PADARIA } });
    expect(r.veredito).toBe("confere");
  });
});

describe("tamanho dos campos contado em bytes (nome com acento)", () => {
  it("lê e aceita, com aviso", () => {
    const nome = "PÃO QUENTE";
    const nomeBytes = new TextEncoder().encode(nome).length; // 11, não 10
    const s =
      tlv("00", "01") + tlv("26", tlv("00", "br.gov.bcb.pix") + tlv("01", CNPJ)) + "52040000" + "5303986" + "5802BR" +
      "59" + String(nomeBytes).padStart(2, "0") + nome + tlv("60", "SAO PAULO") + tlv("62", tlv("05", "***")) + "6304";
    const l = lerPix(s + crc16Utf8(s));
    expect(l.integro).toBe(true);
    expect(l.nome).toBe(nome);
    expect(l.problemas.map((p) => p.codigo)).toContain("tamanho-bytes");
  });
});

// Revisão de segurança do push (26/11/2026).
describe("CNPJ do recebedor escrito na cobrança não prova nada", () => {
  it("cobrança com vencimento, chave e-mail e CNPJ legítimo no campo recebedor → não consegui confirmar", () => {
    // Um servidor falso pode escrever o CNPJ da loja no campo recebedor; o dinheiro vai para a chave.
    const r = rodar({
      pix: montarPix({ url: "psp.example.com/qr/v2/cobv/1a2b3c4d5e6f47a8b9c0d1e2f3a4b5c6", nome: "PADARIA PAO QUENTE", cidade: "SAO PAULO" }),
      cobranca: {
        chave: "golpista@example.com",
        valor: { original: "50.00", final: "50.00" },
        recebedor: { cnpj: CNPJ, nome: "PADARIA PAO QUENTE LTDA" },
        status: "ATIVA",
      },
      consultas: { [CNPJ]: PADARIA },
    });
    expect(r.veredito).toBe("nao_consegui_confirmar");
    expect(r.cnpjsParaConsultar).toEqual([]);
  });
});

describe("código ambíguo", () => {
  it("tamanho em caracteres e em bytes válidos, com destinos diferentes → não confere", () => {
    // Campo 59 com 8 de tamanho: em caracteres, lê "ÃÃÃÃ0100"; em bytes, lê "ÃÃÃÃ" e
    // sobra "0100" (campo 01 vazio). As duas leituras fecham e passam na verificação.
    const s =
      tlv("00", "01") + tlv("26", tlv("00", "br.gov.bcb.pix") + tlv("01", CNPJ)) + "52040000" + "5303986" + "5802BR" +
      "5908" + "ÃÃÃÃ0100" + tlv("60", "SAO PAULO") + tlv("62", tlv("05", "***")) + "6304";
    const l = lerPix(s + crc16Utf8(s));
    expect(l.integro).toBe(true);
    expect(l.problemas.map((p) => p.codigo)).toContain("ambiguo");
    expect(rodar({ pix: s + crc16Utf8(s), consultas: { [CNPJ]: PADARIA } }).veredito).toBe("nao_confere");
  });

  it("escolherLeitura marca ambiguidade quando duas leituras válidas discordam no destino", () => {
    const a = lerPix(montarPix({ chave: CNPJ, nome: "PADARIA PAO QUENTE", cidade: "SAO PAULO" }));
    const b = lerPix(montarPix({ chave: "golpista@example.com", nome: "PADARIA PAO QUENTE", cidade: "SAO PAULO" }));
    const c = lerPix(montarPix({ chave: CNPJ, nome: "PADARIA PAO QUENTE", cidade: "SAO PAULO" }));
    expect(escolherLeitura([a, b], "ambíguo").problemas.some((p) => p.codigo === "ambiguo")).toBe(true);
    expect(escolherLeitura([c, lerPix("lixo")], "ambíguo").problemas.some((p) => p.codigo === "ambiguo")).toBe(false);
  });
});
