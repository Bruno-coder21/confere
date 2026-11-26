// Conjunto sintético do Confere: 40 casos inventados pelo time, com gabarito.
// Nenhum dado pessoal real. Empresas, pessoas, CNPJs (raiz "ZZ" ou exemplo
// oficial da Receita), CPFs, e-mails (example.com) e endereços são fictícios.
// As consultas de CNPJ são simuladas: nenhum caso chama a consulta real.
//
// Os textos de Pix e as linhas de boleto são montados aqui, com CRC e dígitos
// calculados, para que nenhum caso seja digitado à mão.

import {
  calcularDvCnpj,
  fatorDaData,
  montarLinha,
  montarPix,
  type ConsultaCnpj,
  type EntradaVeredito,
  type OpcoesPix,
  type Veredito,
} from "@confere/core";

export const CATEGORIAS = {
  pix_legitimo: "Pix legítimo",
  pix_recebedor_trocado: "Pix com recebedor trocado",
  pix_adulterado: "Pix adulterado ou malformado",
  boleto_legitimo: "Boleto legítimo",
  boleto_divergente: "Boleto com banco, valor ou vencimento divergente",
  nao_consegui_confirmar: 'Casos em que a resposta certa é "não consegui confirmar"',
} as const;

export type Categoria = keyof typeof CATEGORIAS;

/** Quantidade de casos por categoria (PLAN.md §6). */
export const QUANTIDADE: Record<Categoria, number> = {
  pix_legitimo: 8,
  pix_recebedor_trocado: 8,
  pix_adulterado: 4,
  boleto_legitimo: 6,
  boleto_divergente: 8,
  nao_consegui_confirmar: 6,
};

export interface Caso {
  id: string;
  categoria: Categoria;
  /**
   * Pode aparecer nos botões de exemplo da demo e no vídeo. Falso quando o caso
   * traz CPF (decisão do Bruno, 26/11/2026: CPF só nos testes e no placar).
   */
  demo: boolean;
  /** A cena, em linguagem simples. */
  descricao: string;
  entrada: EntradaVeredito;
  esperado: { veredito: Veredito; motivo: string };
}

export const HOJE = "2026-11-25";

const cnpj = (base12: string) => base12 + calcularDvCnpj(base12);
const ativa = (razaoSocial: string, nomeFantasia?: string, dataInicio = "2019-03-12"): ConsultaCnpj => ({
  razaoSocial,
  ...(nomeFantasia ? { nomeFantasia } : {}),
  situacao: "ATIVA",
  dataInicio,
});

/** Troca um dígito por outro (soma 1), sem refazer nenhuma verificação. */
function alterarDigito(texto: string, indice: number): string {
  return texto.slice(0, indice) + ((Number(texto[indice]) + 1) % 10) + texto.slice(indice + 1);
}

function boleto(banco: string, vencimento: string | null, valorCentavos: number, campoLivre: string): string {
  return montarLinha({ banco, fator: vencimento ? fatorDaData(vencimento) : 0, valorCentavos, campoLivre });
}

function pix(o: Omit<OpcoesPix, "cidade"> & { cidade?: string }): string {
  return montarPix({ ...o, cidade: o.cidade ?? "SAO PAULO" });
}

// Empresas fictícias.
const PADARIA = { cnpj: cnpj("ZZPAOQ010001"), consulta: ativa("PADARIA PAO QUENTE LTDA", "PAO QUENTE") };
const OFICINA = { cnpj: cnpj("ZZBOAR020001"), consulta: ativa("OFICINA BOA RODA LTDA") };
const ESCOLA = { cnpj: cnpj("ZZESCO030001"), consulta: ativa("ESCOLA PEQUENO SABER EDUCACAO INFANTIL LTDA") };
const ACME = { cnpj: "12ABC34501DE35", consulta: ativa("ACME COMERCIO LTDA", "ACME", "2026-08-03") }; // exemplo oficial da Receita
const NOVA_ERA = { cnpj: cnpj("ZZOUTR040001"), consulta: ativa("NOVA ERA INTERMEDIACOES LTDA", undefined, "2026-10-30") };
const XPTO = { cnpj: cnpj("ZZGOLP050001"), consulta: ativa("XPTO SOLUCOES DIGITAIS LTDA", undefined, "2026-11-02") };
const MERCADO = { cnpj: cnpj("ZZMERC060001"), consulta: ativa("MERCADO BOM PRECO LTDA") };
const FARMACIA = { cnpj: cnpj("ZZFARM090001"), consulta: ativa("FV DROGARIA E PERFUMARIA LTDA", "FARMACIA VIDA BOA") };
const LIVRARIA = { cnpj: cnpj("ZZLIVR100001"), consulta: ativa("LIVRARIA LETRA VIVA LTDA") };
const CONDOMINIO = { cnpj: cnpj("ZZJDFL110001"), consulta: ativa("CONDOMINIO RESIDENCIAL JARDIM DAS FLORES") };

// Pessoas fictícias. Nenhum CPF válido fica gravado (decisão do Bruno, 26/11/2026):
// um CPF com dígito válido pode ser de alguém real, e a Receita não tem faixa
// reservada para teste. Os casos guardam marcadores com 11 caracteres (o tamanho
// de um CPF); casos/carregar.ts troca por CPFs sorteados na hora e refaz a
// verificação do Pix.
export const MARCADORES_CPF = ["CPF_TESTE_1", "CPF_TESTE_2", "CPF_TESTE_3"] as const;
const [CPF_1, CPF_2, CPF_3] = MARCADORES_CPF;

const URL_COB = "psp.example.com/qr/v2/8b3da2f39a4140d1a91abd93113bd441";
const URL_COB_2 = "psp.example.com/qr/v2/5d1f0c2e9b8a47c3a6e2f1d0c9b8a7e6";
const URL_COBV = "psp.example.com/qr/v2/cobv/1a2b3c4d5e6f47a8b9c0d1e2f3a4b5c6";
const URL_REC = "psp.example.com/qr/v2/rec/2353c790eefb11eaadc10242ac120002";

const TXID = "CONFERE0SINTETICO0000000001";

function cob(chave: string, valor: string): Record<string, unknown> {
  return {
    revisao: 0,
    calendario: { criacao: "2026-11-25T12:00:00Z", apresentacao: "2026-11-25T12:01:00Z", expiracao: 3600 },
    valor: { original: valor },
    chave,
    txid: TXID,
    status: "ATIVA",
  };
}

function cobv(chave: string, valorFinal: string, recebedor: Record<string, string>): Record<string, unknown> {
  return {
    revisao: 0,
    calendario: { criacao: "2026-11-20T12:00:00Z", apresentacao: "2026-11-25T12:01:00Z", dataDeVencimento: "2026-12-10", validadeAposVencimento: 30 },
    devedor: { cnpj: cnpj("ZZDEVE120001"), nome: "EMPRESA FICTICIA DEVEDORA LTDA" },
    valor: { original: valorFinal, final: valorFinal },
    chave,
    recebedor: { ...recebedor, logradouro: "RUA FICTICIA 100", cidade: "SAO PAULO", uf: "SP", cep: "01000000" },
    txid: TXID,
    status: "ATIVA",
  };
}

const quemEmpresa = (nome: string, cnpjInformado?: string) =>
  cnpjInformado ? { nome, tipo: "empresa" as const, cnpj: cnpjInformado } : { nome, tipo: "empresa" as const };

const PIX_PADARIA = pix({ chave: PADARIA.cnpj, nome: "PADARIA PAO QUENTE", valorCentavos: 2350 });

export function gerarCasos(): Caso[] {
  const casos: Omit<Caso, "id" | "demo">[] = [
    // ---------------------------------------------------------------- Pix legítimo
    {
      categoria: "pix_legitimo",
      descricao: "Padaria cobra R$ 23,50 por Pix; a pessoa sabe o CNPJ da padaria.",
      entrada: {
        quem: quemEmpresa("Padaria Pão Quente", PADARIA.cnpj),
        informado: { valorCentavos: 2350 },
        hoje: HOJE,
        pix: PIX_PADARIA,
        consultas: { [PADARIA.cnpj]: PADARIA.consulta },
      },
      esperado: { veredito: "confere", motivo: "Chave CNPJ igual ao CNPJ informado; empresa ativa; valor igual." },
    },
    {
      categoria: "pix_legitimo",
      descricao: "Loja com CNPJ alfanumérico; a pessoa só sabe o nome.",
      entrada: {
        quem: quemEmpresa("Acme Comércio"),
        hoje: HOJE,
        pix: pix({ chave: ACME.cnpj, nome: "ACME COMERCIO" }),
        consultas: { [ACME.cnpj]: ACME.consulta },
      },
      esperado: { veredito: "confere", motivo: "Chave CNPJ; a consulta pública traz ACME COMERCIO LTDA, que bate com o nome." },
    },
    {
      categoria: "pix_legitimo",
      descricao: "Farmácia conhecida pelo nome fantasia; a razão social é outra.",
      entrada: {
        quem: quemEmpresa("Farmácia Vida Boa"),
        hoje: HOJE,
        pix: pix({ chave: FARMACIA.cnpj, nome: "FARMACIA VIDA BOA", valorCentavos: 4790 }),
        consultas: { [FARMACIA.cnpj]: FARMACIA.consulta },
      },
      esperado: { veredito: "confere", motivo: "O nome fantasia da consulta bate com o nome informado." },
    },
    {
      categoria: "pix_legitimo",
      descricao: "Escola com nome longo: o código corta o nome em 25 caracteres.",
      entrada: {
        quem: quemEmpresa("Escola Pequeno Saber Educação Infantil"),
        hoje: HOJE,
        pix: pix({ chave: ESCOLA.cnpj, nome: "ESCOLA PEQUENO SABER EDUC", valorCentavos: 98000 }),
        consultas: { [ESCOLA.cnpj]: ESCOLA.consulta },
      },
      esperado: { veredito: "confere", motivo: "Nome cortado não é diferença; a consulta do CNPJ bate com o nome." },
    },
    {
      categoria: "pix_legitimo",
      descricao: "Mercado com acento no nome escrito no código.",
      entrada: {
        quem: quemEmpresa("Mercado Bom Preço"),
        hoje: HOJE,
        pix: pix({ chave: MERCADO.cnpj, nome: "MERCADO BOM PREÇO", valorCentavos: 15690 }),
        consultas: { [MERCADO.cnpj]: MERCADO.consulta },
      },
      esperado: { veredito: "confere", motivo: "Acento não atrapalha a verificação nem a comparação." },
    },
    {
      categoria: "pix_legitimo",
      descricao: "Oficina cujo banco põe a conta Pix no campo 27 do código, não no 26.",
      entrada: {
        quem: quemEmpresa("Oficina Boa Roda", OFICINA.cnpj),
        hoje: HOJE,
        pix: pix({ chave: OFICINA.cnpj, nome: "OFICINA BOA RODA", idConta: "27", valorCentavos: 32000 }),
        consultas: { [OFICINA.cnpj]: OFICINA.consulta },
      },
      esperado: { veredito: "confere", motivo: "A conta Pix pode estar em qualquer campo de 26 a 51." },
    },
    {
      categoria: "pix_legitimo",
      descricao: "Livraria on-line gera Pix dinâmico de R$ 89,90.",
      entrada: {
        quem: quemEmpresa("Livraria Letra Viva"),
        informado: { valorCentavos: 8990 },
        hoje: HOJE,
        pix: pix({ url: URL_COB, nome: "LIVRARIA LETRA VIVA", usoUnico: true }),
        cobranca: cob(LIVRARIA.cnpj, "89.90"),
        consultas: { [LIVRARIA.cnpj]: LIVRARIA.consulta },
      },
      esperado: { veredito: "confere", motivo: "O conteúdo do Pix dinâmico traz chave CNPJ da livraria; valor igual." },
    },
    {
      categoria: "pix_legitimo",
      descricao: "Condomínio manda Pix com vencimento; a chave é e-mail, mas a cobrança assinada traz o CNPJ.",
      entrada: {
        quem: quemEmpresa("Condomínio Residencial Jardim das Flores"),
        informado: { valorCentavos: 68500 },
        hoje: HOJE,
        pix: pix({ url: URL_COBV, nome: "COND JARDIM DAS FLORES" }),
        cobranca: cobv("financeiro@jardimdasflores.example.com", "685.00", {
          cnpj: CONDOMINIO.cnpj,
          nome: "CONDOMINIO RESIDENCIAL JARDIM DAS FLORES",
        }),
        consultas: { [CONDOMINIO.cnpj]: CONDOMINIO.consulta },
      },
      esperado: { veredito: "confere", motivo: "A cobrança com vencimento traz CNPJ e nome do recebedor, e a consulta bate." },
    },

    // ---------------------------------------------------------- Pix recebedor trocado
    {
      categoria: "pix_recebedor_trocado",
      descricao: "Golpista copia o nome da padaria no código, mas a chave é o CPF dele.",
      entrada: {
        quem: quemEmpresa("Padaria Pão Quente"),
        hoje: HOJE,
        pix: pix({ chave: CPF_1, nome: "PADARIA PAO QUENTE", valorCentavos: 2350 }),
      },
      esperado: { veredito: "nao_confere", motivo: "Chave CPF quando a pessoa paga uma empresa." },
    },
    {
      categoria: "pix_recebedor_trocado",
      descricao: "A pessoa sabe o CNPJ da oficina; o código leva a outro CNPJ.",
      entrada: {
        quem: quemEmpresa("Oficina Boa Roda", OFICINA.cnpj),
        hoje: HOJE,
        pix: pix({ chave: XPTO.cnpj, nome: "OFICINA BOA RODA", valorCentavos: 32000 }),
        consultas: { [XPTO.cnpj]: XPTO.consulta },
      },
      esperado: { veredito: "nao_confere", motivo: "CNPJ da chave diferente do CNPJ informado." },
    },
    {
      categoria: "pix_recebedor_trocado",
      descricao: "Nome certo no código, mas o CNPJ da chave é de outra empresa.",
      entrada: {
        quem: quemEmpresa("Acme Comércio"),
        hoje: HOJE,
        pix: pix({ chave: NOVA_ERA.cnpj, nome: "ACME COMERCIO" }),
        consultas: { [NOVA_ERA.cnpj]: NOVA_ERA.consulta },
      },
      esperado: { veredito: "nao_confere", motivo: "A consulta mostra que o CNPJ da chave é de NOVA ERA INTERMEDIACOES LTDA." },
    },
    {
      categoria: "pix_recebedor_trocado",
      descricao: "Mensagem falsa da livraria traz Pix com e-mail e nome de uma pessoa.",
      entrada: {
        quem: quemEmpresa("Livraria Letra Viva"),
        hoje: HOJE,
        pix: pix({ chave: "marcos.alves@example.com", nome: "MARCOS ALVES", valorCentavos: 8990 }),
      },
      esperado: { veredito: "nao_confere", motivo: "Nome escrito no código claramente diferente." },
    },
    {
      categoria: "pix_recebedor_trocado",
      descricao: "A pessoa vai pagar a diarista; o Pix recebido está no nome de outra pessoa.",
      entrada: {
        quem: { nome: "Renata Lima", tipo: "pessoa" },
        hoje: HOJE,
        pix: pix({ chave: "7d9f3c2a-1b4e-4c8d-9a6f-0e5b2c7d1f3a", nome: "JOAO PEREIRA", valorCentavos: 18000 }),
      },
      esperado: { veredito: "nao_confere", motivo: "Nome escrito no código claramente diferente." },
    },
    {
      categoria: "pix_recebedor_trocado",
      descricao: "Pix dinâmico da farmácia, mas o conteúdo buscado aponta para um CPF.",
      entrada: {
        quem: quemEmpresa("Farmácia Vida Boa"),
        hoje: HOJE,
        pix: pix({ url: URL_COB_2, nome: "FARMACIA VIDA BOA", usoUnico: true }),
        cobranca: cob(CPF_2, "47.90"),
      },
      esperado: { veredito: "nao_confere", motivo: "O conteúdo do Pix dinâmico traz chave CPF; a pessoa paga uma empresa." },
    },
    {
      categoria: "pix_recebedor_trocado",
      descricao: "Boleto de mensalidade com Pix: a cobrança assinada é de outra empresa.",
      entrada: {
        quem: quemEmpresa("Escola Pequeno Saber"),
        hoje: HOJE,
        pix: pix({ url: URL_COBV, nome: "ESCOLA PEQUENO SABER" }),
        cobranca: cobv(XPTO.cnpj, "980.00", { cnpj: XPTO.cnpj, nome: "XPTO SOLUCOES DIGITAIS LTDA" }),
        consultas: { [XPTO.cnpj]: XPTO.consulta },
      },
      esperado: { veredito: "nao_confere", motivo: "A cobrança é de XPTO SOLUCOES DIGITAIS LTDA, não da escola." },
    },
    {
      categoria: "pix_recebedor_trocado",
      descricao: "A pessoa vai pagar a diarista; a chave é o CNPJ de uma empresa desconhecida.",
      entrada: {
        quem: { nome: "Renata Lima", tipo: "pessoa" },
        hoje: HOJE,
        pix: pix({ chave: NOVA_ERA.cnpj, nome: "RENATA LIMA", valorCentavos: 18000 }),
        consultas: { [NOVA_ERA.cnpj]: NOVA_ERA.consulta },
      },
      esperado: { veredito: "nao_confere", motivo: "O CNPJ da chave é de NOVA ERA INTERMEDIACOES LTDA." },
    },

    // ------------------------------------------------------------- Pix adulterado
    {
      categoria: "pix_adulterado",
      descricao: "Alguém trocou o valor de 23,50 para 28,50 no texto, sem refazer a verificação.",
      entrada: {
        quem: quemEmpresa("Padaria Pão Quente"),
        hoje: HOJE,
        pix: PIX_PADARIA.replace("540523.50", "540528.50"),
        consultas: { [PADARIA.cnpj]: PADARIA.consulta },
      },
      esperado: { veredito: "nao_confere", motivo: "A verificação (CRC) não bate." },
    },
    {
      categoria: "pix_adulterado",
      descricao: "O código chegou cortado na mensagem.",
      entrada: { quem: quemEmpresa("Padaria Pão Quente"), hoje: HOJE, pix: PIX_PADARIA.slice(0, PIX_PADARIA.length - 20) },
      esperado: { veredito: "nao_confere", motivo: "Código quebrado: os campos não fecham." },
    },
    {
      categoria: "pix_adulterado",
      descricao: "Código com verificação certa, mas com uma chave CPF de dígitos inválidos.",
      entrada: {
        quem: { nome: "Renata Lima", tipo: "pessoa" },
        hoje: HOJE,
        pix: pix({ chave: "12345678900", nome: "RENATA LIMA", valorCentavos: 18000 }),
      },
      esperado: { veredito: "nao_confere", motivo: "A chave tem dígitos inválidos." },
    },
    {
      categoria: "pix_adulterado",
      descricao: "Pix dinâmico com endereço apontando para um número de IP, fora do padrão do Banco Central.",
      entrada: {
        quem: quemEmpresa("Mercado Bom Preço"),
        hoje: HOJE,
        pix: pix({ url: "203.0.113.10/qr/v2/8b3da2f39a4140d1a91abd93113bd441", nome: "MERCADO BOM PRECO" }),
      },
      esperado: { veredito: "nao_confere", motivo: "Endereço do Pix dinâmico fora do padrão." },
    },

    // ------------------------------------------------------------- Boleto legítimo
    {
      categoria: "boleto_legitimo",
      descricao: "Condomínio de dezembro; banco, valor e vencimento batem com o boleto impresso.",
      entrada: {
        quem: quemEmpresa("Condomínio Residencial Jardim das Flores"),
        informado: { valorCentavos: 68500, vencimento: "2026-12-10", bancoCodigo: "341" },
        hoje: HOJE,
        boleto: boleto("341", "2026-12-10", 68500, "1090000123456781234567890"),
      },
      esperado: { veredito: "nao_consegui_confirmar", motivo: "Tudo bate, mas a linha não traz o nome de quem recebe." },
    },
    {
      categoria: "boleto_legitimo",
      descricao: "Mensalidade escolar com valor informado.",
      entrada: {
        quem: quemEmpresa("Escola Pequeno Saber"),
        informado: { valorCentavos: 120000 },
        hoje: HOJE,
        boleto: boleto("001", "2026-12-05", 120000, "0000002345678901234517000"),
      },
      esperado: { veredito: "nao_consegui_confirmar", motivo: "A linha não traz o nome de quem recebe." },
    },
    {
      categoria: "boleto_legitimo",
      descricao: "Conta de internet; a pessoa não informa nada além do nome.",
      entrada: {
        quem: quemEmpresa("Provedor Rede Rápida"),
        hoje: HOJE,
        boleto: boleto("237", "2026-12-15", 9990, "3381090001234567000123450"),
      },
      esperado: { veredito: "nao_consegui_confirmar", motivo: "A linha não traz o nome de quem recebe." },
    },
    {
      categoria: "boleto_legitimo",
      descricao: "Compra em loja on-line, boleto emitido por instituição de pagamento.",
      entrada: {
        quem: quemEmpresa("Acme Comércio"),
        informado: { valorCentavos: 34990, vencimento: "2026-11-30" },
        hoje: HOJE,
        boleto: boleto("260", "2026-11-30", 34990, "0001000000055500011100000"),
      },
      esperado: { veredito: "nao_consegui_confirmar", motivo: "A linha não traz o nome de quem recebe." },
    },
    {
      categoria: "boleto_legitimo",
      descricao: "Boleto de doação sem valor fixo (valor zerado na linha).",
      entrada: {
        quem: quemEmpresa("Associação Amigos do Bairro"),
        hoje: HOJE,
        boleto: boleto("104", "2026-12-20", 0, "1234567000100040000000017"),
      },
      esperado: { veredito: "nao_consegui_confirmar", motivo: "Sem valor fixo e sem nome na linha." },
    },
    {
      categoria: "boleto_legitimo",
      descricao: "Boleto sem vencimento no código (fator 0000).",
      entrada: {
        quem: quemEmpresa("Oficina Boa Roda"),
        informado: { valorCentavos: 15000 },
        hoje: HOJE,
        boleto: boleto("033", null, 15000, "9028203356661245780020101"),
      },
      esperado: { veredito: "nao_consegui_confirmar", motivo: "Sem vencimento no código e sem nome na linha." },
    },

    // ---------------------------------------------------------- Boleto divergente
    {
      categoria: "boleto_divergente",
      descricao: "A linha recebida por e-mail cobra R$ 685,00; o boleto do condomínio é de R$ 585,00.",
      entrada: {
        quem: quemEmpresa("Condomínio Residencial Jardim das Flores"),
        informado: { valorCentavos: 58500 },
        hoje: HOJE,
        boleto: boleto("341", "2026-12-10", 68500, "1090000123456781234567890"),
      },
      esperado: { veredito: "nao_confere", motivo: "Valor da linha diferente do informado." },
    },
    {
      categoria: "boleto_divergente",
      descricao: "Vencimento da linha diferente do que está impresso.",
      entrada: {
        quem: quemEmpresa("Escola Pequeno Saber"),
        informado: { vencimento: "2026-12-05" },
        hoje: HOJE,
        boleto: boleto("001", "2026-12-08", 120000, "0000002345678901234517000"),
      },
      esperado: { veredito: "nao_confere", motivo: "Vencimento da linha diferente do informado." },
    },
    {
      categoria: "boleto_divergente",
      descricao: "Boleto impresso com logo do Itaú (341), mas a linha é de outro banco, com dígitos válidos.",
      entrada: {
        quem: quemEmpresa("Condomínio Residencial Jardim das Flores"),
        informado: { valorCentavos: 68500, bancoCodigo: "341" },
        hoje: HOJE,
        boleto: boleto("237", "2026-12-10", 68500, "4441234500000055500011100"),
      },
      esperado: { veredito: "nao_confere", motivo: "Banco da linha diferente do banco impresso." },
    },
    {
      categoria: "boleto_divergente",
      descricao: "Linha com código de banco fora da lista do Banco Central; o impresso diz Caixa (104).",
      entrada: {
        quem: quemEmpresa("Associação Amigos do Bairro"),
        informado: { bancoCodigo: "104" },
        hoje: HOJE,
        boleto: boleto("999", "2026-12-20", 5000, "1234567000100040000000017"),
      },
      esperado: { veredito: "nao_confere", motivo: "Banco da linha diferente do banco impresso." },
    },
    {
      categoria: "boleto_divergente",
      descricao: "Alguém trocou o código do banco na linha sem recalcular o dígito do primeiro bloco.",
      entrada: {
        quem: quemEmpresa("Provedor Rede Rápida"),
        hoje: HOJE,
        boleto: alterarDigito(boleto("237", "2026-12-15", 9990, "3381090001234567000123450"), 2),
      },
      esperado: { veredito: "nao_confere", motivo: "Dígito do bloco 1 não bate." },
    },
    {
      categoria: "boleto_divergente",
      descricao: "Um número do segundo bloco foi trocado.",
      entrada: {
        quem: quemEmpresa("Escola Pequeno Saber"),
        hoje: HOJE,
        boleto: alterarDigito(boleto("001", "2026-12-05", 120000, "0000002345678901234517000"), 15),
      },
      esperado: { veredito: "nao_confere", motivo: "Dígito do bloco 2 não bate." },
    },
    {
      categoria: "boleto_divergente",
      descricao: "Um número do terceiro bloco foi trocado.",
      entrada: {
        quem: quemEmpresa("Acme Comércio"),
        hoje: HOJE,
        boleto: alterarDigito(boleto("260", "2026-11-30", 34990, "0001000000055500011100000"), 25),
      },
      esperado: { veredito: "nao_confere", motivo: "Dígito do bloco 3 não bate." },
    },
    {
      categoria: "boleto_divergente",
      descricao: "O valor no fim da linha foi alterado à mão.",
      entrada: {
        quem: quemEmpresa("Oficina Boa Roda"),
        hoje: HOJE,
        boleto: alterarDigito(boleto("033", "2026-12-01", 15000, "9028203356661245780020101"), 43),
      },
      esperado: { veredito: "nao_confere", motivo: "O dígito verificador geral não bate." },
    },

    // ---------------------------------------------------- Não consegui confirmar
    {
      categoria: "nao_consegui_confirmar",
      descricao: "Loja usa chave aleatória; o nome escrito no código bate, mas isso não prova nada.",
      entrada: {
        quem: quemEmpresa("Padaria Pão Quente"),
        hoje: HOJE,
        pix: pix({ chave: "3f6c1e2a-9b7d-4e5f-8a1c-2d3e4f5a6b7c", nome: "PADARIA PAO QUENTE", valorCentavos: 2350 }),
      },
      esperado: { veredito: "nao_consegui_confirmar", motivo: "Chave aleatória: só o banco mostra o dono. Orientar o print." },
    },
    {
      categoria: "nao_consegui_confirmar",
      descricao: "Pagamento à diarista pela chave CPF; o nome no código bate.",
      entrada: {
        quem: { nome: "Renata Lima", tipo: "pessoa" },
        hoje: HOJE,
        pix: pix({ chave: CPF_3, nome: "RENATA LIMA", valorCentavos: 18000 }),
      },
      esperado: { veredito: "nao_consegui_confirmar", motivo: "Não há consulta pública de CPF. Orientar o print." },
    },
    {
      categoria: "nao_consegui_confirmar",
      descricao: "Pix dinâmico cujo conteúdo não pôde ser buscado.",
      entrada: {
        quem: quemEmpresa("Livraria Letra Viva"),
        hoje: HOJE,
        pix: pix({ url: URL_COB, nome: "LIVRARIA LETRA VIVA", usoUnico: true }),
        cobranca: "indisponivel",
      },
      esperado: { veredito: "nao_consegui_confirmar", motivo: "Sem o conteúdo, não se sabe a chave." },
    },
    {
      categoria: "nao_consegui_confirmar",
      descricao: "Chave CNPJ, mas a consulta pública está fora do ar.",
      entrada: {
        quem: quemEmpresa("Mercado Bom Preço"),
        hoje: HOJE,
        pix: pix({ chave: MERCADO.cnpj, nome: "MERCADO BOM PRECO", valorCentavos: 15690 }),
        consultas: { [MERCADO.cnpj]: "indisponivel" },
      },
      esperado: { veredito: "nao_consegui_confirmar", motivo: "Consulta indisponível nunca vira confere." },
    },
    {
      categoria: "nao_consegui_confirmar",
      descricao: "Chave CNPJ de uma empresa que a Receita mostra como baixada.",
      entrada: {
        quem: quemEmpresa("Oficina Boa Roda", OFICINA.cnpj),
        hoje: HOJE,
        pix: pix({ chave: OFICINA.cnpj, nome: "OFICINA BOA RODA", valorCentavos: 32000 }),
        consultas: { [OFICINA.cnpj]: { ...OFICINA.consulta, situacao: "BAIXADA" } },
      },
      esperado: { veredito: "nao_consegui_confirmar", motivo: "Empresa com situação diferente de ATIVA." },
    },
    {
      categoria: "nao_consegui_confirmar",
      descricao: "Código de Pix Automático (autorização de débitos recorrentes).",
      entrada: {
        quem: quemEmpresa("Provedor Rede Rápida"),
        hoje: HOJE,
        pix: pix({ url: URL_COB, urlRecorrencia: URL_REC, nome: "PROVEDOR REDE RAPIDA" }),
      },
      esperado: { veredito: "nao_consegui_confirmar", motivo: "Pix Automático fica fora do mínimo." },
    },
  ];

  const contadores: Partial<Record<Categoria, number>> = {};
  const temCpf = (c: Omit<Caso, "id" | "demo">) => {
    const texto = JSON.stringify(c.entrada);
    return [...MARCADORES_CPF, "12345678900"].some((n) => texto.includes(n));
  };
  return casos.map((c) => {
    const n = (contadores[c.categoria] = (contadores[c.categoria] ?? 0) + 1);
    const { categoria, ...resto } = c;
    return { id: `${categoria}-${String(n).padStart(2, "0")}`, categoria, demo: !temCpf(c), ...resto };
  });
}
