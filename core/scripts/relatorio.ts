// Relatório do script conferir. Regra: toda linha vira uma resposta visível.
// Para não espalhar dado real, linha não reconhecida é descrita só pelo
// número da linha, pelo tamanho e pelo motivo, nunca pelo conteúdo.

import {
  formatarData,
  formatarReais,
  lerBoleto,
  lerPix,
  mascararCpf,
  NOME_TIPO_CHAVE,
  separarEntradas,
  temProblemaGrave,
} from "@confere/core";

export interface Relatorio {
  linhas: string[];
  reconhecidas: number;
  avisos: number;
}

const pixCompleto = (t: string) => {
  const l = lerPix(t);
  return l.integro && !temProblemaGrave(l);
};

export function relatorio(arquivo: string, hoje: string, nomeArquivo = "o arquivo"): Relatorio {
  const leitura = separarEntradas(arquivo, pixCompleto);
  const out: string[] = [];
  let reconhecidas = 0;
  let avisos = 0;

  const faixa = (a: number, b: number) => (a === b ? `linha ${a}` : `linhas ${a} a ${b}`);

  for (const e of leitura.entradas) {
    if (e.tipo === "desconhecido" || e.tipo === "comentario-com-codigo") {
      avisos++;
      out.push(`\n!!! ${faixa(e.linhaInicial, e.linhaFinal)}: NÃO RECONHECIDA (${Array.from(e.texto).length} caracteres). ${e.motivo ?? ""}`.trimEnd());
      continue;
    }
    reconhecidas++;
    out.push(`\n=== Entrada ${reconhecidas} (${faixa(e.linhaInicial, e.linhaFinal)}) ===`);
    if (e.tipo === "pix") {
      const l = lerPix(e.texto);
      const modelo = { estatico: "estático", dinamico: "dinâmico", composto: "composto (Pix Automático)" } as const;
      out.push(`Pix ${l.modelo ? modelo[l.modelo] : "não reconhecido"}`);
      out.push(`Verificação: ${l.integro ? "confere" : "NÃO confere"} (lido ${l.crcLido ?? "-"}, calculado ${l.crcCalculado ?? "-"})`);
      if (l.idConta) out.push(`Conta Pix no campo: ${l.idConta}`);
      if (l.chave && l.tipoChave) {
        const chave = l.tipoChave === "cpf" ? mascararCpf(l.chave) : l.chave;
        out.push(`Chave: ${NOME_TIPO_CHAVE[l.tipoChave]} ${chave} (${l.chaveValida ? "válida" : "inválida"})`);
      }
      if (l.url) out.push(`Endereço do dinâmico: ${l.url}`);
      if (l.urlRecorrencia) out.push(`Endereço da recorrência: ${l.urlRecorrencia}`);
      out.push(`Nome no código: ${l.nome ?? "-"} | Cidade: ${l.cidade ?? "-"}`);
      out.push(`Valor: ${l.valorCentavos !== undefined ? formatarReais(l.valorCentavos) : "não vem no código"}`);
      out.push(`Identificador (txid): ${l.txid ? "presente" : "não"} | Uso único: ${l.usoUnico ? "sim" : "não"}`);
      for (const p of l.problemas) out.push(`${p.grave ? "PROBLEMA" : "aviso"}: ${p.texto}`);
    } else {
      const l = lerBoleto(e.texto, hoje);
      const tipo = { cobranca: "cobrança", arrecadacao: "conta de consumo ou tributo", desconhecido: "não reconhecido" } as const;
      out.push(`Boleto (${tipo[l.tipo]}, ${l.linha.length} números)`);
      if (l.tipo === "cobranca") {
        out.push(`Dígitos: blocos ${l.blocosOk?.map((ok) => (ok ? "ok" : "ERRO")).join(", ")}; geral ${l.dvGeralOk ? "ok" : "ERRO"}`);
        out.push(`Banco: ${l.bancoCodigo} ${l.bancoNome ?? "(fora da lista do BC)"}`);
        out.push(`Vencimento: ${l.vencimento ? `${formatarData(l.vencimento)} (fator ${l.fator}, ciclo ${l.cicloVencimento})` : "sem vencimento no código"}`);
        out.push(`Valor: ${l.valorCentavos !== undefined ? formatarReais(l.valorCentavos) : "sem valor no código"}`);
      }
      for (const p of l.problemas) out.push(`${p.grave ? "PROBLEMA" : "aviso"}: ${p.texto}`);
    }
  }

  const resumo = [
    `Arquivo ${nomeArquivo}: ${leitura.totalLinhas} linha(s).`,
    `${reconhecidas} entrada(s) lida(s), ${avisos} linha(s) não reconhecida(s), ${leitura.linhasDeComentario} comentário(s) (#), ${leitura.linhasEmBranco} em branco.`,
  ];
  out.unshift(...resumo);
  if (reconhecidas === 0) {
    out.push(
      `\n!!! NENHUM Pix nem boleto foi lido em ${nomeArquivo}.`,
      "    Cole um por linha, sem # no começo. Linhas que começam com # são ignoradas.",
    );
  } else {
    out.push("\nCompare com o app do banco: chave, valor, banco e vencimento devem ser os mesmos.");
  }
  return { linhas: out, reconhecidas, avisos };
}
