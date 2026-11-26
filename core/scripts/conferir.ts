// Lê Pix copia e cola e linhas de boleto reais de um arquivo local e mostra o
// que o núcleo entendeu, para comparar com o app do banco. Não usa rede e não
// grava nada. O arquivo fica em privado/, que está fora do git.
//
// Uso (rode no seu terminal, fora do Claude Code, para os dados reais não
// passarem pela conversa):
//   npm run conferir -- privado/reais.txt
// Uma entrada por linha (Pix ou boleto quebrado em várias linhas também é
// aceito). Linhas começando com # são comentários. Toda linha recebe resposta;
// se nada for lido, o script avisa e sai com código 1.

import { readFileSync } from "node:fs";
import { relatorio } from "./relatorio";

const arquivo = process.argv[2];
if (!arquivo) {
  console.error("Uso: npm run conferir -- privado/reais.txt");
  process.exit(1);
}

let conteudo: string;
try {
  conteudo = readFileSync(arquivo, "utf8");
} catch (erro) {
  console.error(`Não consegui abrir ${arquivo}: ${(erro as Error).message}`);
  process.exit(1);
}

const hoje = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
const r = relatorio(conteudo, hoje, arquivo);
console.log(r.linhas.join("\n"));
if (r.reconhecidas === 0 || r.avisos > 0) process.exitCode = 1;
