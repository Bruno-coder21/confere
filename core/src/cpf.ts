// CPF: 11 dígitos; dois dígitos verificadores em módulo 11
// (pesos 10 a 2 e 11 a 2; resto menor que 2 dá 0, senão 11 − resto).

export interface ResultadoCpf {
  valido: boolean;
  normalizado: string;
  motivo?: string;
}

export function normalizarCpf(entrada: string): string {
  return entrada.replace(/[\s.-]/g, "");
}

function dv(digitos: number[], pesoInicial: number): number {
  let soma = 0;
  digitos.forEach((d, i) => {
    soma += d * (pesoInicial - i);
  });
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

export function calcularDvCpf(base9: string): string {
  if (!/^[0-9]{9}$/.test(base9)) throw new Error("A base do CPF precisa de 9 dígitos.");
  const d = Array.from(base9, Number);
  const dv1 = dv(d, 10);
  const dv2 = dv([...d, dv1], 11);
  return `${dv1}${dv2}`;
}

export function validarCpf(entrada: string): ResultadoCpf {
  const normalizado = normalizarCpf(entrada);
  if (!/^[0-9]{11}$/.test(normalizado)) {
    return { valido: false, normalizado: "", motivo: "Não tem a forma de um CPF (11 dígitos)." };
  }
  if (/^(\d)\1{10}$/.test(normalizado)) {
    return { valido: false, normalizado, motivo: "Todos os dígitos são iguais." };
  }
  if (normalizado.slice(9) !== calcularDvCpf(normalizado.slice(0, 9))) {
    return { valido: false, normalizado, motivo: "Os dígitos verificadores não batem." };
  }
  return { valido: true, normalizado };
}

/**
 * Sorteia um CPF com dígito válido, para testes. Nunca grave o resultado no
 * repositório: um CPF válido pode pertencer a alguém real, e a Receita não tem
 * faixa reservada para teste.
 */
export function sortearCpf(aleatorio: () => number = Math.random): string {
  for (;;) {
    const base = Array.from({ length: 9 }, () => Math.floor(aleatorio() * 10)).join("");
    if (!/^(\d)\1{8}$/.test(base)) return base + calcularDvCpf(base);
  }
}

/** Mostra só o miolo, como os bancos: ***.456.789-** */
export function mascararCpf(cpf11: string): string {
  const c = normalizarCpf(cpf11);
  if (c.length !== 11) return "***";
  return `***.${c.slice(3, 6)}.${c.slice(6, 9)}-**`;
}
