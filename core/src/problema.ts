export interface Problema {
  codigo: string;
  texto: string;
  /** Grave: o código está quebrado ou foi alterado. Leva a "não confere". */
  grave: boolean;
}
