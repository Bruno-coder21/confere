import { decidir, type Veredito } from "@confere/core";
import { CATEGORIAS, type Caso, type Categoria } from "./definicoes";

export interface ResultadoCaso {
  caso: Caso;
  obtido: Veredito;
  acertou: boolean;
}

export function rodarCasos(casos: Caso[]): ResultadoCaso[] {
  return casos.map((caso) => {
    const obtido = decidir(caso.entrada).veredito;
    return { caso, obtido, acertou: obtido === caso.esperado.veredito };
  });
}

export interface LinhaPlacar {
  categoria: Categoria;
  nome: string;
  acertos: number;
  total: number;
}

export function placar(resultados: ResultadoCaso[]): LinhaPlacar[] {
  return (Object.keys(CATEGORIAS) as Categoria[]).map((categoria) => {
    const daCategoria = resultados.filter((r) => r.caso.categoria === categoria);
    return {
      categoria,
      nome: CATEGORIAS[categoria],
      acertos: daCategoria.filter((r) => r.acertou).length,
      total: daCategoria.length,
    };
  });
}
