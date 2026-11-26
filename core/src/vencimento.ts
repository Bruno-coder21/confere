// Fator de vencimento do boleto (posições 6 a 9 do código de barras).
// Fonte: BCB, Carta-Circular 2.926/2000: dias desde 07/10/1997; "0000" indica
// que o código de barras não traz vencimento.
// Reinício: o fator chegou a 9999 em 21/02/2025 e voltou a 1000 em 22/02/2025
// (regra da FEBRABAN; comunicado oficial não localizado, conferido em fontes
// secundárias e na conta: 07/10/1997 + 9999 dias = 21/02/2025).
// Um mesmo fator pode cair nos dois ciclos; escolhemos a data mais perto de hoje.

const DIA = 86_400_000;
const BASE_1997 = Date.UTC(1997, 9, 7);
const BASE_2025 = Date.UTC(2025, 1, 22); // fator 1000 do segundo ciclo
const FIM_1997 = Date.UTC(2025, 1, 21); // fator 9999 do primeiro ciclo

export type CicloFator = "1997" | "2025";

export interface Vencimento {
  /** AAAA-MM-DD */
  data: string;
  ciclo: CicloFator;
}

function paraData(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function lerData(iso: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) throw new Error(`Data fora do formato AAAA-MM-DD: ${iso}`);
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/**
 * Converte o fator em data. Fator 0 = sem vencimento (retorna null).
 * Fatores de 1 a 999 não são usados por nenhum dos ciclos (retorna undefined).
 */
export function vencimentoDoFator(fator: number, hoje: string): Vencimento | null | undefined {
  if (fator === 0) return null;
  if (!Number.isInteger(fator) || fator < 1000 || fator > 9999) return undefined;
  const ref = lerData(hoje);
  const candidatos: Vencimento[] = [
    { data: paraData(BASE_1997 + fator * DIA), ciclo: "1997" },
    { data: paraData(BASE_2025 + (fator - 1000) * DIA), ciclo: "2025" },
  ];
  candidatos.sort((a, b) => Math.abs(lerData(a.data) - ref) - Math.abs(lerData(b.data) - ref));
  return candidatos[0];
}

/** Inverso, para montar boletos de teste. */
export function fatorDaData(iso: string): number {
  const ms = lerData(iso);
  if (ms >= BASE_2025) {
    const fator = 1000 + Math.round((ms - BASE_2025) / DIA);
    if (fator > 9999) throw new Error("Data além do segundo ciclo do fator.");
    return fator;
  }
  if (ms > FIM_1997) throw new Error("Data impossível.");
  const fator = Math.round((ms - BASE_1997) / DIA);
  if (fator < 1000) throw new Error("Data anterior aos fatores usados (03/07/2000).");
  return fator;
}
