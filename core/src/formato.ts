export function formatarReais(centavos: number): string {
  const reais = Math.floor(centavos / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `R$ ${reais},${String(centavos % 100).padStart(2, "0")}`;
}

/** AAAA-MM-DD → DD/MM/AAAA */
export function formatarData(iso: string): string {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

/** +5500912345678 → +55 00 9****-5678 */
export function mascararTelefone(tel: string): string {
  if (!/^\+55\d{10,11}$/.test(tel)) return tel.slice(0, 4) + "****";
  return `+55 ${tel.slice(3, 5)} ${tel.slice(5, 6)}****-${tel.slice(-4)}`;
}
