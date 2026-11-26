// Baixa a lista de participantes do STR do Banco Central e grava
// core/src/bancos.json (código de 3 dígitos → nome reduzido).
// Fonte: https://dadosabertos.bcb.gov.br/dataset/lista-de-participantes-do-str
// Licença dos dados: Open Database License (ODbL).
// Uso: npm run atualizar-bancos

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const URL_CSV = "https://www.bcb.gov.br/content/estabilidadefinanceira/str1/ParticipantesSTR.csv";

function lerLinhaCsv(linha: string): string[] {
  const campos: string[] = [];
  let atual = "";
  let aspas = false;
  for (const c of linha) {
    if (c === '"') aspas = !aspas;
    else if (c === "," && !aspas) {
      campos.push(atual);
      atual = "";
    } else atual += c;
  }
  campos.push(atual);
  return campos.map((s) => s.trim());
}

const resposta = await fetch(URL_CSV);
if (!resposta.ok) throw new Error(`BCB respondeu ${resposta.status}`);
const texto = new TextDecoder("utf-8").decode(await resposta.arrayBuffer());
const linhas = texto.split(/\r?\n/).filter((l) => l.trim() !== "");
const cabecalho = lerLinhaCsv(linhas[0] ?? "");
const iCodigo = cabecalho.indexOf("Número_Código");
const iNome = cabecalho.indexOf("Nome_Reduzido");
if (iCodigo < 0 || iNome < 0) throw new Error(`Cabeçalho inesperado: ${cabecalho.join(",")}`);

const bancos: Record<string, string> = {};
for (const linha of linhas.slice(1)) {
  const campos = lerLinhaCsv(linha);
  const codigo = campos[iCodigo] ?? "";
  const nome = campos[iNome] ?? "";
  if (/^\d{3}$/.test(codigo) && nome) bancos[codigo] = nome;
}

const ordenado = Object.fromEntries(Object.entries(bancos).sort(([a], [b]) => a.localeCompare(b)));
const saida = {
  fonte: "Banco Central do Brasil, Lista de participantes do STR",
  url: URL_CSV,
  licenca: "Open Database License (ODbL) 1.0 — https://opendatacommons.org/licenses/odbl/1-0/",
  baixadoEm: new Date().toISOString().slice(0, 10),
  bancos: ordenado,
};
const destino = fileURLToPath(new URL("../src/bancos.json", import.meta.url));
writeFileSync(destino, JSON.stringify(saida, null, 2) + "\n");
console.log(`${Object.keys(ordenado).length} códigos gravados em ${destino}`);
