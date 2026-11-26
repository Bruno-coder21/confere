// Roda os 40 casos sintéticos no núcleo e imprime o acerto por categoria.
// Uso: npm run placar
import { carregarCasos } from "./carregar";
import { placar, rodarCasos } from "./rodar";

const resultados = rodarCasos(carregarCasos());

console.log("Conjunto sintético, criado pelo time do Confere. Nenhum dado real.\n");
for (const l of placar(resultados)) {
  console.log(`${String(l.acertos).padStart(2)}/${String(l.total).padEnd(2)}  ${l.nome}`);
}
const acertos = resultados.filter((r) => r.acertou).length;
console.log(`\nTotal: ${acertos}/${resultados.length}`);
for (const r of resultados.filter((x) => !x.acertou)) {
  console.log(`ERRO ${r.caso.id}: esperado ${r.caso.esperado.veredito}, obtido ${r.obtido} — ${r.caso.descricao}`);
}
if (acertos !== resultados.length) process.exitCode = 1;
