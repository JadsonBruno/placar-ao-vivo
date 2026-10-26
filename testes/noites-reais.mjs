// O motor sobre três apurações reais: 2º turno de 2022 e 1º turno de 2026 (boletim de urna oficial) e a reprise do
// 2º turno de 2026 (nacional e final oficiais; caminho dos estados estimado). Compara conjuntos de parâmetros.
// Rodar: node testes/noites-reais.mjs  → testes/noites-reais.md   (VARIANTES='{"nome":{...}}' para trocar a lista)
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { projetar, PARAMS, PARAMS_M2 } from "../src/motor.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const rd = (p) => JSON.parse(readFileSync(join(ROOT, p), "utf8"));
const est = rd("dados/estados.json");
const out = [];
const log = (s = "") => { console.log(s); out.push(s); };
const f2 = (x) => x.toFixed(2), pc = (x) => (100 * x).toFixed(0) + "%";

// cada noite: estados (base e válidos esperados), quadros [{X, q}] e o resultado real
function noiteBU(arq, baseDe, VespDe, outrosDe) {
  const D = rd(arq), ufs = est.map((r) => r.uf), tot = ufs.reduce((s, u) => s + D.ufs[u].secoes, 0);
  const A = ufs.reduce((s, u) => s + D.ufs[u].final.A, 0), B = ufs.reduce((s, u) => s + D.ufs[u].final.B, 0);
  const quadros = [];
  for (let i = 0; i < D.ufs.SP.sec.length; i++) {
    const q = Object.fromEntries(ufs.map((u) => { const x = D.ufs[u], vv = x.A[i] + x.B[i]; return [u, { f: x.sec[i] / x.secoes, A: x.A[i], B: x.B[i], vv, p: vv ? (100 * x.A[i]) / vv : null }]; }));
    quadros.push({ X: ufs.reduce((s, u) => s + D.ufs[u].sec[i], 0) / tot, q });
  }
  return { estados: est.map((r) => ({ uf: r.uf, regiao: r.regiao, base: baseDe(r), Vesp: VespDe(r, D), outros: outrosDe(r) })), quadros, real: (100 * A) / (A + B) };
}
const b22 = (r) => (100 * r.lula22_1t) / (r.lula22_1t + r.bolso22_1t), o22 = (r) => 1 - (r.lula22_1t + r.bolso22_1t) / r.validos22_1t;
const tot22 = (D) => est.reduce((s, r) => s + D.ufs[r.uf].final.A + D.ufs[r.uf].final.B, 0) / est.reduce((s, r) => s + r.lula22_1t + r.bolso22_1t, 0);
const N22 = noiteBU("dados/parciais-2022-2t.json", b22, (r, D) => (r.lula22_1t + r.bolso22_1t) * tot22(D), o22);
const N261 = noiteBU("dados/parciais-2026-1t.json", b22, (r, D) => (r.lula22_1t + r.bolso22_1t) * tot22(D), o22);
const R = rd("dados/reprise-2026-2t.json");
const N262 = {
  estados: est.map((r) => ({ uf: r.uf, regiao: r.regiao, base: r.base26, Vesp: r.validos26_2t_esp, outros: 1 - (r.lula26_1t + r.flavio26_1t) / r.validos26_1t })),
  quadros: R.quadros.filter((f) => f.X < 100).map((f) => ({ X: f.X / 100, q: Object.fromEntries(Object.entries(f.q).map(([u, [ff, A, B]]) => [u, { f: ff, A, B, vv: A + B, p: A + B ? (100 * A) / (A + B) : null }])) })),
  real: (100 * R.final.A) / (R.final.A + R.final.B),
};
// previsões de partida: as pesquisas da véspera e uma "exata"
const NOITES = [
  { nome: "2º turno 2022", N: N22, alvos: [52.0, 50.9] },
  { nome: "1º turno 2026", N: N261, alvos: [N261.real + 1.85, N261.real] },
  { nome: "2º turno 2026 (reprise)", N: N262, alvos: [49.26, 50.0] },
];
const VAR = process.env.VARIANTES ? JSON.parse(process.env.VARIANTES) : {
  "motor 1": PARAMS, "motor 2 (no ar)": PARAMS_M2, "motor 2, σb 3": { ...PARAMS_M2, sigmaB: 3 }, "motor 2, σb 4": { ...PARAMS_M2, sigmaB: 4 },
};
log("# O motor em três apurações reais");
log("");
log("Métricas por noite (média das previsões de partida). Faixa: % dos momentos em que a faixa de 80% contém o resultado. Erro no início: maior erro com menos de 5% apurado. Fim: faixa de 80% com mais de 90% apurado.");
const resumo = {};
for (const { nome, N, alvos } of NOITES) {
  log("");
  log(`## ${nome} (real: Lula ${f2(N.real)}%; previsões de partida: ${alvos.map(f2).join(" e ")})`);
  log("");
  log("| Motor | Faixa 80% | Erro médio | Maior erro < 5% | Maior erro 5–30% | Faixa 80% no fim (>90%) | Chance do vencedor com ~1% apurado |");
  log("|---|---|---|---|---|---|---|");
  for (const [k, P] of Object.entries(VAR)) {
    let c80 = 0, n = 0, erro = 0, e5 = 0, e30 = 0, fimC = 0, fimN = 0, p1 = [];
    const vence = N.real > 50;
    for (const centro of alvos) {
      let feito1 = false;
      for (const fr of N.quadros) {
        if (fr.X <= 0.001 || fr.X >= 0.999) continue;
        const r = projetar(N.estados, fr.q, { centro, meio90: 4.55 }, P).A;
        n++; if (N.real >= r.lo80 && N.real <= r.hi80) c80++; const e = Math.abs(r.media - N.real); erro += e;
        if (fr.X < 0.05) e5 = Math.max(e5, e); else if (fr.X < 0.3) e30 = Math.max(e30, e);
        if (fr.X > 0.9) { fimN++; if (N.real >= r.lo80 && N.real <= r.hi80) fimC++; }
        if (!feito1 && fr.X >= 0.01) { p1.push(vence ? r.pVence : 1 - r.pVence); feito1 = true; }
      }
    }
    (resumo[k] ??= []).push({ c80: c80 / n, erro: erro / n, e5, e30, fim: fimC / fimN });
    log(`| ${k} | ${pc(c80 / n)} | ${f2(erro / n)} | ${f2(e5)} | ${f2(e30)} | ${pc(fimC / fimN)} | ${p1.map(pc).join(" / ")} |`);
  }
}
log("");
log("## Resumo (média das três noites)");
log("");
log("| Motor | Faixa 80% | Erro médio | Maior erro < 5% | Maior erro 5–30% | Faixa no fim |");
log("|---|---|---|---|---|---|");
for (const [k, rs] of Object.entries(resumo)) { const m = (f) => rs.reduce((s, r) => s + f(r), 0) / rs.length; log(`| ${k} | ${pc(m((r) => r.c80))} | ${f2(m((r) => r.erro))} | ${f2(m((r) => r.e5))} | ${f2(m((r) => r.e30))} | ${pc(m((r) => r.fim))} |`); }
writeFileSync(join(ROOT, "testes/noites-reais.md"), out.join("\n") + "\n");
