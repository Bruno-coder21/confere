// Regras de veredito do Confere. Determinísticas: a mesma entrada dá sempre o
// mesmo resultado. Aprovadas pelo Bruno em 25/11/2026 (PLAN.md §5.5):
// - o nome escrito no código do Pix (campo 59) nunca basta para "confere";
// - "confere" exige prova por documento e consulta pública respondida;
// - boleto só com a linha nunca dá "confere".

import { formatarLinha, lerBoleto, type LeituraBoleto } from "./boleto";
import { NOME_TIPO_CHAVE, type TipoChave } from "./chave";
import { formatarCnpj, validarCnpj } from "./cnpj";
import { lerCobranca, validarLocation, type Cobranca } from "./cobranca";
import { mascararCpf } from "./cpf";
import { classificarEntrada } from "./entrada";
import { formatarData, formatarReais, mascararTelefone } from "./formato";
import { compararNomes, type ComparacaoNome } from "./nome";
import { lerPix, type LeituraPix } from "./pix";
import { lerData } from "./vencimento";

/** Sem CNPJ informado, "confere" pelo nome exige empresa aberta há pelo menos estes dias. */
export const DIAS_MINIMOS_EMPRESA = 90;

export type Veredito = "confere" | "nao_confere" | "nao_consegui_confirmar";

export const TITULO_VEREDITO: Record<Veredito, string> = {
  confere: "Confere",
  nao_confere: "Não confere",
  nao_consegui_confirmar: "Não consegui confirmar",
};

export interface QuemPagar {
  /** Nome da empresa ou da pessoa, como a pessoa escreveu. */
  nome: string;
  tipo: "empresa" | "pessoa";
  /** CNPJ, se a pessoa souber. */
  cnpj?: string;
}

export interface Informado {
  valorCentavos?: number;
  /** AAAA-MM-DD */
  vencimento?: string;
  /** Código de 3 dígitos do banco que aparece impresso no boleto. */
  bancoCodigo?: string;
}

/** Resultado da consulta pública de CNPJ, já cortado aos campos que o Confere usa. */
export interface ConsultaCnpj {
  razaoSocial: string;
  nomeFantasia?: string;
  /** Ex.: "ATIVA", "BAIXADA", "INAPTA", "SUSPENSA", "NULA". */
  situacao: string;
  /** AAAA-MM-DD */
  dataInicio?: string;
}

export interface EntradaVeredito {
  quem: QuemPagar;
  informado?: Informado;
  /** AAAA-MM-DD. Usado para ler o vencimento do boleto. */
  hoje: string;
  /** Texto do Pix copia e cola. */
  pix?: string;
  /** Linha digitável do boleto. */
  boleto?: string;
  /**
   * Consultas de CNPJ já feitas, indexadas pelo CNPJ normalizado (14 caracteres).
   * CNPJ ausente aqui = consulta não feita.
   */
  consultas?: Record<string, ConsultaCnpj | "indisponivel">;
  /** JSON do Pix dinâmico, já buscado e com assinatura verificada; ou "indisponivel". */
  cobranca?: unknown;
}

export interface Evidencia {
  rotulo: string;
  valor: string;
}

export interface Resultado {
  veredito: Veredito;
  titulo: string;
  /** Por que deu este veredito. */
  motivos: string[];
  /** O que foi lido e comparado. */
  evidencias: Evidencia[];
  /** O que a pessoa deve fazer agora. */
  orientacao?: string;
  /** CNPJs que precisam de consulta pública para decidir. */
  cnpjsParaConsultar: string[];
  leituraPix?: LeituraPix;
  leituraBoleto?: LeituraBoleto;
}

function orientacaoPrint(nome: string): string {
  return `Na tela do seu banco, antes de confirmar, o nome tem de ser ${nome}. Envie o print dessa tela para eu conferir.`;
}

function mostrarChave(chave: string, tipo: TipoChave): string {
  if (tipo === "cpf") return `CPF ${mascararCpf(chave)}`;
  if (tipo === "cnpj") return `CNPJ ${formatarCnpj(chave)}`;
  if (tipo === "telefone") return `telefone ${mascararTelefone(chave)}`;
  return `${NOME_TIPO_CHAVE[tipo]} ${chave}`;
}

function descreverConsulta(c: ConsultaCnpj): string {
  const partes = [c.razaoSocial];
  if (c.nomeFantasia) partes.push(`nome fantasia ${c.nomeFantasia}`);
  partes.push(`situação ${c.situacao}`);
  if (c.dataInicio) partes.push(`aberta em ${formatarData(c.dataInicio)}`);
  return partes.join(", ");
}

function melhorComparacao(informado: string, nomes: (string | undefined)[]): ComparacaoNome {
  const ordem: ComparacaoNome[] = ["igual", "contem", "parcial", "diferente"];
  let melhor: ComparacaoNome = "diferente";
  for (const n of nomes) {
    if (!n) continue;
    const c = compararNomes(informado, n);
    if (ordem.indexOf(c) < ordem.indexOf(melhor)) melhor = c;
  }
  return melhor;
}

/** Nunca lança erro nem fica em silêncio: entrada vazia ou estranha vira resultado com motivo. */
export function decidir(entrada: EntradaVeredito): Resultado {
  if (entrada.pix !== undefined && classificarEntrada(entrada.pix).tipo !== "vazio") return decidirPix(entrada, entrada.pix);
  if (entrada.boleto !== undefined && classificarEntrada(entrada.boleto).tipo !== "vazio") return decidirBoleto(entrada, entrada.boleto);
  return resultado(
    "nao_consegui_confirmar",
    ["Nada para conferir: cole um Pix copia e cola ou digite a linha de um boleto."],
    [{ rotulo: "Quem você pretende pagar", valor: `${entrada.quem.nome} (${entrada.quem.tipo})` }],
  );
}

function resultado(
  veredito: Veredito,
  motivos: string[],
  evidencias: Evidencia[],
  extra: Partial<Resultado> = {},
): Resultado {
  return { veredito, titulo: TITULO_VEREDITO[veredito], motivos, evidencias, cnpjsParaConsultar: [], ...extra };
}

function decidirPix(entrada: EntradaVeredito, texto: string): Resultado {
  const { quem } = entrada;
  const leitura = lerPix(texto);
  const ev: Evidencia[] = [{ rotulo: "Quem você pretende pagar", valor: `${quem.nome} (${quem.tipo})` }];
  const cnpjInformado = quem.cnpj ? validarCnpj(quem.cnpj) : undefined;
  if (cnpjInformado) {
    ev.push({ rotulo: "CNPJ informado", valor: cnpjInformado.valido ? formatarCnpj(cnpjInformado.normalizado) : `${quem.cnpj} (inválido)` });
  }

  if (leitura.crcLido) {
    ev.push({
      rotulo: "Verificação do código",
      valor: leitura.integro ? `confere (${leitura.crcLido})` : `não confere (lido ${leitura.crcLido}, calculado ${leitura.crcCalculado})`,
    });
  }

  const graves = leitura.problemas.filter((p) => p.grave);
  if (!leitura.reconhecido || graves.length > 0) {
    return resultado(
      "nao_confere",
      graves.length > 0 ? graves.map((p) => p.texto) : ["Isto não é um Pix copia e cola válido."],
      ev,
      { orientacao: "Não pague com este código. Peça um novo a quem está cobrando, por um canal que você já conhece.", leituraPix: leitura },
    );
  }

  if (leitura.nome) ev.push({ rotulo: "Nome escrito no código", valor: leitura.nome });
  if (leitura.cidade) ev.push({ rotulo: "Cidade escrita no código", valor: leitura.cidade });

  // Motivos para "não consegui confirmar" que não impedem de procurar sinais de "não confere".
  const pendencias: string[] = [];
  if (cnpjInformado && !cnpjInformado.valido) {
    pendencias.push("O CNPJ que você informou tem dígitos errados. Confira a digitação.");
  }

  // Chave, valor e recebedor efetivos.
  let chave = leitura.chave;
  let tipoChave = leitura.tipoChave;
  let valor = leitura.valorCentavos;
  let cobranca: Cobranca | undefined;

  if (leitura.modelo === "composto") {
    if (leitura.urlRecorrencia) ev.push({ rotulo: "Endereço da recorrência", valor: leitura.urlRecorrencia });
    pendencias.push("Este código pede autorização de Pix Automático (débitos recorrentes). O Confere ainda não confere esse tipo.");
    if (leitura.url) valor = undefined; // parte dinâmica: o valor do código não vale
  } else if (leitura.modelo === "dinamico") {
    const url = leitura.url ?? "";
    ev.push({ rotulo: "Tipo de Pix", valor: "dinâmico (os dados ficam no endereço do recebedor)" });
    ev.push({ rotulo: "Endereço do conteúdo", valor: url });
    const loc = validarLocation(url);
    if (!loc.valida || loc.tipo === "rec") {
      return resultado(
        "nao_confere",
        [`O endereço do Pix dinâmico está fora do padrão do Banco Central: ${loc.motivo ?? "aponta para uma recorrência, não para uma cobrança."}`],
        ev,
        { orientacao: "Não pague com este código. Peça um novo a quem está cobrando.", leituraPix: leitura },
      );
    }
    const json = entrada.cobranca;
    cobranca = json !== undefined && json !== "indisponivel" ? lerCobranca(json, loc.tipo === "cobv" ? "cobv" : "cob") : undefined;
    // No dinâmico, chave e valor só valem quando vêm do conteúdo buscado.
    chave = cobranca?.chave;
    tipoChave = cobranca?.tipoChave;
    valor = cobranca?.valorCentavos;
    if (!cobranca) {
      pendencias.push("Não consegui buscar o conteúdo deste Pix dinâmico. Sem ele não sei para quem vai o dinheiro.");
    } else {
      if (cobranca.valorCentavos === undefined) pendencias.push("A cobrança não trouxe o valor.");
      if (cobranca.status && cobranca.status.toUpperCase() !== "ATIVA") {
        pendencias.push(`Esta cobrança está com situação ${cobranca.status}; o pagamento pode não ser aceito.`);
      }
      if (cobranca.status) ev.push({ rotulo: "Situação da cobrança", valor: cobranca.status });
      if (cobranca.recebedor?.nome) ev.push({ rotulo: "Recebedor na cobrança (assinado)", valor: cobranca.recebedor.nome });
      if (cobranca.recebedor?.cnpj) ev.push({ rotulo: "CNPJ do recebedor na cobrança", valor: formatarCnpj(cobranca.recebedor.cnpj) });
      if (cobranca.vencimento) ev.push({ rotulo: "Vencimento da cobrança", valor: formatarData(cobranca.vencimento) });
    }
  } else {
    ev.push({ rotulo: "Tipo de Pix", valor: "estático (os dados estão todos no código)" });
  }

  if (chave && tipoChave) ev.push({ rotulo: "Chave Pix", valor: mostrarChave(chave, tipoChave) });
  if (valor !== undefined) ev.push({ rotulo: "Valor", valor: formatarReais(valor) });
  else if (leitura.modelo === "estatico") ev.push({ rotulo: "Valor", valor: "não vem no código; você digita no banco" });

  // CNPJ que identifica o recebedor por documento.
  const cnpjRecebedor =
    tipoChave === "cnpj" && chave ? chave.toUpperCase() : cobranca?.recebedor?.cnpj ? validarCnpj(cobranca.recebedor.cnpj).normalizado : undefined;
  const consultaBruta = cnpjRecebedor ? entrada.consultas?.[cnpjRecebedor] : undefined;
  const consulta = consultaBruta !== undefined && consultaBruta !== "indisponivel" ? consultaBruta : undefined;
  const cnpjsParaConsultar = cnpjRecebedor && consultaBruta === undefined ? [cnpjRecebedor] : [];
  if (consulta) ev.push({ rotulo: "Consulta pública do CNPJ", valor: descreverConsulta(consulta) });
  else if (consultaBruta === "indisponivel") ev.push({ rotulo: "Consulta pública do CNPJ", valor: "indisponível agora" });

  // Sinais de "não confere". Valem para todo Pix lido, inclusive dinâmico sem conteúdo e Pix Automático.
  const contra: string[] = [];
  const informadoValor = entrada.informado?.valorCentavos;
  if (informadoValor !== undefined && valor !== undefined && informadoValor !== valor) {
    contra.push(`O valor do código é ${formatarReais(valor)}, mas você informou ${formatarReais(informadoValor)}.`);
  }
  if (tipoChave === "cpf" && quem.tipo === "empresa") {
    contra.push("A chave Pix é um CPF (de uma pessoa), mas você disse que vai pagar uma empresa.");
  }
  if (cnpjInformado?.valido && cnpjRecebedor && cnpjRecebedor !== cnpjInformado.normalizado) {
    contra.push(`O dinheiro vai para o CNPJ ${formatarCnpj(cnpjRecebedor)}, e não para o CNPJ que você informou.`);
  }
  if (cobranca?.recebedor?.cpf && quem.tipo === "empresa") {
    contra.push("A cobrança é de uma pessoa (CPF), mas você disse que vai pagar uma empresa.");
  }
  // O nome do código só é sinal quando também não bate com o titular do CNPJ
  // (ex.: o código traz a razão social e a pessoa conhece o nome fantasia).
  const nomesDoTitular = [consulta?.razaoSocial, consulta?.nomeFantasia, cobranca?.recebedor?.nome, cobranca?.recebedor?.nomeFantasia].filter(
    (n): n is string => Boolean(n),
  );
  const nomeDoCodigoBateComTitular = leitura.nome !== undefined && nomesDoTitular.some((n) => compararNomes(n, leitura.nome ?? "") !== "diferente");
  if (leitura.nome && !nomeDoCodigoBateComTitular && compararNomes(quem.nome, leitura.nome) === "diferente") {
    contra.push(`O nome escrito no código é ${leitura.nome}, diferente de ${quem.nome}.`);
  }
  const cobrancaDeOutro =
    cobranca?.recebedor?.nome !== undefined &&
    melhorComparacao(quem.nome, [cobranca.recebedor.nome, cobranca.recebedor.nomeFantasia]) === "diferente";
  if (cobrancaDeOutro) {
    contra.push(`A cobrança é de ${cobranca?.recebedor?.nome}, diferente de ${quem.nome}.`);
  }
  const cnpjBateComInformado = Boolean(cnpjInformado?.valido && cnpjRecebedor === cnpjInformado.normalizado);
  // Vale mesmo com o CNPJ igual ao informado: a pessoa pode ter copiado o CNPJ da própria cobrança falsa.
  if (consulta && !cobrancaDeOutro && melhorComparacao(quem.nome, [consulta.razaoSocial, consulta.nomeFantasia]) === "diferente") {
    contra.push(`O CNPJ que recebe pertence a ${consulta.razaoSocial}, diferente de ${quem.nome}.`);
  }
  if (contra.length > 0) {
    return resultado("nao_confere", contra, ev, {
      orientacao: "Não pague. Confirme os dados com quem está cobrando, por um canal que você já conhece.",
      leituraPix: leitura,
      cnpjsParaConsultar,
    });
  }

  // Caminhos para "confere": só por documento, com consulta respondida.
  const naoConfirmado = (motivos: string[]): Resultado =>
    resultado("nao_consegui_confirmar", motivos, ev, { orientacao: orientacaoPrint(quem.nome), leituraPix: leitura, cnpjsParaConsultar });

  if (pendencias.length > 0) return naoConfirmado(pendencias);

  if (cnpjRecebedor) {
    if (consulta === undefined) {
      return naoConfirmado(["Não consegui consultar o CNPJ de quem recebe."]);
    }
    if (consulta.situacao.toUpperCase() !== "ATIVA") {
      return naoConfirmado([`O CNPJ de quem recebe está com situação ${consulta.situacao} na Receita Federal.`]);
    }
    if (cnpjBateComInformado) {
      return resultado("confere", ["O dinheiro vai para o CNPJ que você informou, e a consulta pública mostra a empresa ativa."], ev, {
        leituraPix: leitura,
      });
    }
    // Nome do cadastro público não vem cortado: só nome igual prova. Começo
    // parecido não basta (golpista pode abrir empresa com nome que começa igual).
    const comp = melhorComparacao(quem.nome, [consulta.razaoSocial, consulta.nomeFantasia]);
    if (comp === "igual") {
      // Decisão do Bruno (26/11/2026): sem CNPJ informado, nome igual só prova se a
      // empresa existe há mais de 90 dias. Golpista pode abrir empresa nova com o
      // nome fantasia da loja.
      if (!consulta.dataInicio) {
        return naoConfirmado([`O nome bate com ${consulta.razaoSocial}, mas a consulta não trouxe a data de abertura da empresa.`]);
      }
      const dias = Math.floor((lerData(entrada.hoje) - lerData(consulta.dataInicio)) / 86_400_000);
      if (dias < DIAS_MINIMOS_EMPRESA) {
        return naoConfirmado([
          `O nome bate, mas a empresa foi aberta em ${formatarData(consulta.dataInicio)}, há ${dias} dias. Empresa nova com o nome de uma loja conhecida pode ser golpe.`,
        ]);
      }
      return resultado("confere", [`O dinheiro vai para o CNPJ de ${consulta.razaoSocial}, que bate com o nome que você informou.`], ev, {
        leituraPix: leitura,
      });
    }
    return naoConfirmado([`O CNPJ de quem recebe é de ${consulta.razaoSocial}. O nome parece com o que você informou, mas não é igual. Confira se é a empresa certa.`]);
  }

  const artigo: Record<TipoChave, string> = {
    cpf: "um CPF",
    cnpj: "um CNPJ",
    telefone: "um telefone",
    email: "um e-mail",
    aleatoria: "uma chave aleatória",
    desconhecida: "de tipo desconhecido",
  };
  const motivo =
    tipoChave === "cpf"
      ? "A chave é um CPF. Não há consulta pública que diga de quem é."
      : `A chave é ${artigo[tipoChave ?? "desconhecida"]}. Só o seu banco mostra de quem ela é.`;
  return naoConfirmado([motivo, "O nome escrito dentro do código pode ser qualquer um; o que vale é o nome que o banco mostra."]);
}

function decidirBoleto(entrada: EntradaVeredito, linha: string): Resultado {
  const { quem } = entrada;
  const leitura = lerBoleto(linha, entrada.hoje);
  const ev: Evidencia[] = [{ rotulo: "Quem você pretende pagar", valor: `${quem.nome} (${quem.tipo})` }];
  if (leitura.linha.length === 47) ev.push({ rotulo: "Linha digitada", valor: formatarLinha(leitura.linha) });

  if (leitura.tipo !== "cobranca") {
    return resultado("nao_consegui_confirmar", leitura.problemas.map((p) => p.texto), ev, {
      orientacao: leitura.tipo === "arrecadacao" ? orientacaoPrint(quem.nome) : "Confira se digitou todos os números da linha do boleto.",
      leituraBoleto: leitura,
    });
  }

  ev.push({
    rotulo: "Dígitos verificadores",
    valor: leitura.integro ? "conferem" : "não conferem",
  });
  if (leitura.bancoCodigo) {
    ev.push({ rotulo: "Banco", valor: leitura.bancoNome ? `${leitura.bancoCodigo} — ${leitura.bancoNome}` : `${leitura.bancoCodigo} (fora da lista do Banco Central)` });
  }
  ev.push({ rotulo: "Vencimento", valor: leitura.vencimento ? formatarData(leitura.vencimento) : "não vem no código" });
  ev.push({ rotulo: "Valor", valor: leitura.valorCentavos !== undefined ? formatarReais(leitura.valorCentavos) : "não vem no código" });
  ev.push({ rotulo: "Nome de quem recebe", valor: "a linha do boleto não traz" });

  const graves = leitura.problemas.filter((p) => p.grave);
  if (graves.length > 0) {
    return resultado("nao_confere", [...graves.map((p) => p.texto), "A linha foi alterada ou digitada com erro."], ev, {
      orientacao: "Confira a digitação. Se os números estão certos, não pague: o boleto pode ter sido adulterado.",
      leituraBoleto: leitura,
    });
  }

  const inf = entrada.informado ?? {};
  const contra: string[] = [];
  if (inf.valorCentavos !== undefined && leitura.valorCentavos !== undefined && inf.valorCentavos !== leitura.valorCentavos) {
    contra.push(`O valor na linha é ${formatarReais(leitura.valorCentavos)}, mas você informou ${formatarReais(inf.valorCentavos)}.`);
  }
  if (inf.vencimento && leitura.vencimento && inf.vencimento !== leitura.vencimento) {
    contra.push(`O vencimento na linha é ${formatarData(leitura.vencimento)}, mas você informou ${formatarData(inf.vencimento)}.`);
  }
  if (inf.bancoCodigo && leitura.bancoCodigo && inf.bancoCodigo !== leitura.bancoCodigo) {
    contra.push(`A linha é do banco ${leitura.bancoCodigo}${leitura.bancoNome ? ` (${leitura.bancoNome})` : ""}, mas o boleto mostra o banco ${inf.bancoCodigo}.`);
  }
  if (contra.length > 0) {
    return resultado("nao_confere", contra, ev, {
      orientacao: "Não pague. Peça a segunda via direto no site ou no app de quem cobra.",
      leituraBoleto: leitura,
    });
  }

  const motivos = ["A linha do boleto não traz o nome de quem recebe. Sem o nome, não dá para confirmar."];
  if (leitura.problemas.some((p) => p.codigo === "banco-desconhecido")) {
    motivos.push(`Atenção: o código de banco ${leitura.bancoCodigo} não está na lista do Banco Central.`);
  }
  return resultado("nao_consegui_confirmar", motivos, ev, { orientacao: orientacaoPrint(quem.nome), leituraBoleto: leitura });
}
