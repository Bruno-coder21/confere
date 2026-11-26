import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { crc16Utf8, lerPix, validarCpf } from "@confere/core";
import { describe, expect, it } from "vitest";
import { carregarCasos, lerCasosGuardados, prepararCaso, sortearCpfsDeTeste } from "./carregar";
import { CATEGORIAS, MARCADORES_CPF, QUANTIDADE, gerarCasos, type Categoria } from "./definicoes";
import { rodarCasos } from "./rodar";

const casos = lerCasosGuardados();
const RAIZ = fileURLToPath(new URL("..", import.meta.url));

describe("conjunto sintético", () => {
  it("casos.json é exatamente o que o gerador produz (ninguém editou à mão)", () => {
    expect(casos).toEqual(JSON.parse(JSON.stringify(gerarCasos())));
  });

  it("tem 40 casos na divisão do PLAN.md §6", () => {
    expect(casos).toHaveLength(40);
    for (const categoria of Object.keys(CATEGORIAS) as Categoria[]) {
      expect(casos.filter((c) => c.categoria === categoria), categoria).toHaveLength(QUANTIDADE[categoria]);
    }
  });

  it("casos com CPF ficam fora da demo", () => {
    for (const c of casos) {
      const texto = JSON.stringify(c.entrada);
      const temCpf = [...MARCADORES_CPF, "12345678900"].some((m) => texto.includes(m));
      expect(c.demo, c.id).toBe(!temCpf);
    }
    expect(casos.filter((c) => c.demo).length).toBeGreaterThanOrEqual(30);
  });

  it("ids únicos", () => {
    expect(new Set(casos.map((c) => c.id)).size).toBe(casos.length);
  });

  it("e-mails e endereços só em example.com (ou na faixa de IP de documentação)", () => {
    const emails: string[] = [];
    const enderecos: string[] = [];
    for (const c of casos) {
      if (c.entrada.pix) {
        const l = lerPix(c.entrada.pix);
        if (l.tipoChave === "email" && l.chave) emails.push(l.chave);
        if (l.url) enderecos.push(l.url);
        if (l.urlRecorrencia) enderecos.push(l.urlRecorrencia);
      }
      const chaveCobranca = (c.entrada.cobranca as { chave?: string } | undefined)?.chave;
      if (chaveCobranca?.includes("@")) emails.push(chaveCobranca);
    }
    expect(emails.length).toBeGreaterThan(0);
    for (const e of emails) expect(e).toMatch(/[@.]example\.com$/);
    for (const u of enderecos) expect(u).toMatch(/^(psp\.example\.com|203\.0\.113\.\d+)\//);
  });

  it("a troca de marcador refaz a verificação do Pix só quando ela estava certa", () => {
    const cpfs = sortearCpfsDeTeste();
    for (const c of casos.filter((x) => MARCADORES_CPF.some((m) => JSON.stringify(x.entrada).includes(m)))) {
      const pronto = prepararCaso(c, cpfs);
      expect(JSON.stringify(pronto.entrada)).not.toMatch(/CPF_TESTE_/);
      if (c.entrada.pix) {
        const guardadoCerto = crc16Utf8(c.entrada.pix.slice(0, -4)) === c.entrada.pix.slice(-4);
        const prontoCerto = crc16Utf8(pronto.entrada.pix!.slice(0, -4)) === pronto.entrada.pix!.slice(-4);
        expect(prontoCerto).toBe(guardadoCerto);
      }
    }
  });

  describe.each(rodarCasos(carregarCasos()).map((r) => [r.caso.id, r] as const))("%s", (_id, r) => {
    it(r.caso.descricao, () => {
      expect(r.obtido, r.caso.esperado.motivo).toBe(r.caso.esperado.veredito);
    });
  });
});

describe("nenhum CPF válido nem telefone gravado no repositório", () => {
  const arquivos = [
    ...["core", "casos"].flatMap((d) =>
      (readdirSync(join(RAIZ, d), { recursive: true }) as string[])
        .filter((f) => /\.(ts|json|md)$/.test(f) && !f.endsWith("bancos.json"))
        .map((f) => join(d, f)),
    ),
    "PLAN.md",
    "CLAUDE.md",
  ];

  it.each(arquivos)("%s", (arquivo) => {
    const texto = readFileSync(join(RAIZ, arquivo), "utf8");
    const cpfs = [...texto.matchAll(/(?<![0-9])(\d{3}\.?\d{3}\.?\d{3}-?\d{2})(?![0-9])/g)]
      .map((m) => (m[1] ?? "").replace(/\D/g, ""))
      .filter((d) => validarCpf(d).valido);
    expect(cpfs, "CPF com dígito válido").toEqual([]);
    const telefones = [...texto.matchAll(/\+55\s?\(?([0-9]{2})\)?\s?9?\d{4}-?\d{4}/g)].filter((m) => m[1] !== "00");
    expect(telefones.map((m) => m[0]), "telefone com DDD real").toEqual([]);
  });
});
