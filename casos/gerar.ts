// Gera casos/casos.json a partir de casos/definicoes.ts.
// Uso: npm run gerar-casos
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { gerarCasos } from "./definicoes";

const destino = fileURLToPath(new URL("./casos.json", import.meta.url));
const casos = gerarCasos();
writeFileSync(destino, JSON.stringify(casos, null, 2) + "\n");
console.log(`${casos.length} casos gravados em ${destino}`);
