// Rodada 2 da fase 2: motor atual × motor 2 (projetar2), com a regra de adoção escrita em FASE2-PLANO.md antes de rodar.
// Rodar: node testes/rodada2.mjs  → testes/rodada2.md. V1/V5: MOTOR=2 node testes/validacao.mjs.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { projetar, PARAMS, PARAMS_M2 } from "../src/motor.mjs";
import { CENARIOS, apuracao, cenario, gNacional, rng } from "../src/simulado.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const est = JSON.parse(readFileSync(join(ROOT, "dados/estados.json"), "utf8"));
const hist = JSON.parse(readFileSync(join(ROOT, "dados/historico.json"), "utf8"));
const ESTADOS = est.map((r) => ({ uf: r.uf, regiao: r.regiao, base: r.base26, Vesp: r.validos26_2t_esp, ap1752: r.apurado_17h52_1t26, outros: 1 - (r.lula26_1t + r.flavio26_1t) / r.validos26_1t }));
const out = [];
const log = (s = "") => { console.log(s); out.push(s); };
const f2 = (x) => x.toFixed(2), f3 = (x) => x.toFixed(3);
const pc = (x) => (100 * x).toFixed(0) + "%";
const gInv = (x) => { let lo = 0, hi = 400; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (gNacional(m) < x) lo = m; else hi = m; } return (lo + hi) / 2; };
const FRACS = [0.1, 0.3, 0.6, 0.9], MINS = FRACS.map(gInv);
const ALVO = { centro: 49.26, meio90: 4.55 };
const QS = Array.from({ length: 19 }, (_, i) => 0.05 * (i + 1));
// CRPS ≈ 2 × média da perda de quantil (pinball) nos 19 quantis
const crps = (qs, y) => (2 * qs.reduce((a, q, i) => a + ((y < q ? 1 : 0) - QS[i]) * (q - y), 0)) / QS.length;
const motorDe = (es) => es.map(({ uf, regiao, base, Vesp, outros }) => ({ uf, regiao, base, Vesp, outros }));
const VAR = process.env.VARIANTE ? JSON.parse(process.env.VARIANTE) : {};
const MOT = { atual: { ...PARAMS, quantis: QS }, m2: { ...PARAMS_M2, ...VAR, quantis: QS } };
const novo = () => ({ c80: 0, c95: 0, n: 0, crps: [], erro: 0, larg: 0 });
const marcar = (A, r, y) => { A.n++; if (y >= r.lo80 && y <= r.hi80) A.c80++; if (y >= r.lo95 && y <= r.hi95) A.c95++; A.crps.push(crps(r.qs, y)); A.erro += Math.abs(r.media - y); A.larg += r.hi80 - r.lo80; };
const media = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const dif = (a, b) => { const d = a.map((x, i) => x - b[i]); const m = media(d); const se = Math.sqrt(media(d.map((x) => (x - m) ** 2)) / d.length); return { m, se }; };

log("# Rodada 2: motor atual × motor 2");
log("");
log(`Motor 2: transferência dos votos de outros (σt ${PARAMS_M2.sigmaT}), σr aprendido entre ${PARAMS_M2.sigmaRs.join(", ")}, comparecimento por região (encolhimento ${PARAMS_M2.encolheComp}). CRPS por 19 quantis; comparação pareada (mesmas apurações).`);
const t0 = Date.now();

// ---- eleições reais
const REPS_REAL = Number(process.env.REPS || 200);
log("");
log(`## Eleições reais (${REPS_REAL} apurações por ano × 4 momentos; base = 1º turno, verdade = 2º turno)`);
log("");
log("| Ano | CRPS atual | CRPS motor 2 | Diferença (± 2 erros-padrão) | Faixa 80% atual → m2 | 95% atual → m2 | Erro médio atual → m2 | Largura 80% atual → m2 |");
log("|---|---|---|---|---|---|---|---|");
const real = {};
for (const ano of ["2014", "2018", "2022"]) {
  const fator = hist.transicoes[ano].outros1t / hist.calib.outros26;
  const P = { atual: { ...MOT.atual, sigmaEps: PARAMS.sigmaEps * fator }, m2: { ...MOT.m2, sigmaEps: (VAR.sigmaEps ?? PARAMS_M2.sigmaEps) * fator, sigmaRs: (VAR.sigmaRs ?? PARAMS_M2.sigmaRs).map((x) => x * fator) } };
  const eAno = ESTADOS.map((e) => { const a = hist.porUF[e.uf].anos[ano]; return { ...e, base: a.t1, Vesp: a.v2, final: a.t2, outros: a.o1 }; });
  const y = eAno.reduce((s, e) => s + e.final * e.Vesp, 0) / eAno.reduce((s, e) => s + e.Vesp, 0);
  const R = rng(Number(ano)); const A = { atual: novo(), m2: novo() };
  for (let i = 0; i < REPS_REAL; i++) {
    const alvo = { centro: y + R.n() * (ALVO.meio90 / 1.645), meio90: ALVO.meio90 };
    const sim = apuracao(eAno.map((e) => ({ uf: e.uf, apurado1752: e.ap1752, V: e.Vesp, final: e.final, u: R.n() * 4.5 })), { b: R.n() * 2 });
    for (const m of MINS) { const q = sim(m); for (const k of ["atual", "m2"]) marcar(A[k], projetar(motorDe(eAno), q, alvo, P[k]).A, y); }
  }
  const d = dif(A.m2.crps, A.atual.crps);
  real[ano] = { A, d };
  log(`| ${ano} | ${f3(media(A.atual.crps))} | ${f3(media(A.m2.crps))} | ${f3(d.m)} ± ${f3(2 * d.se)} | ${pc(A.atual.c80 / A.atual.n)} → ${pc(A.m2.c80 / A.m2.n)} | ${pc(A.atual.c95 / A.atual.n)} → ${pc(A.m2.c95 / A.m2.n)} | ${f2(A.atual.erro / A.atual.n)} → ${f2(A.m2.erro / A.m2.n)} | ${f2(A.atual.larg / A.atual.n)} → ${f2(A.m2.larg / A.m2.n)} |`);
}

// ---- simulador de cenários
const REPS_SIM = Number(process.env.REPS_SIM || 40);
log("");
log(`## Simulador de cenários (${REPS_SIM} apurações por cenário × 4 momentos)`);
log("");
log("| Cenário | Faixa 80% atual → m2 | 95% atual → m2 | CRPS atual → m2 |");
log("|---|---|---|---|");
const S = { atual: novo(), m2: novo() };
for (const c of CENARIOS) {
  const R = rng(300 + CENARIOS.indexOf(c)); const A = { atual: novo(), m2: novo() };
  for (let i = 0; i < REPS_SIM; i++) {
    const s = cenario(ESTADOS, hist, R, { centro: ALVO.centro, id: c.id });
    const sim = apuracao(ESTADOS.map((e) => ({ uf: e.uf, apurado1752: e.ap1752, V: s.V[e.uf], final: s.final[e.uf], u: R.n() * 4.5 })), { b: R.n() * 2 });
    for (const m of MINS) { const q = sim(m); for (const k of ["atual", "m2"]) { const r = projetar(motorDe(ESTADOS), q, ALVO, MOT[k]).A; marcar(A[k], r, s.nacional); marcar(S[k], r, s.nacional); } }
  }
  log(`| ${c.nome} | ${pc(A.atual.c80 / A.atual.n)} → ${pc(A.m2.c80 / A.m2.n)} | ${pc(A.atual.c95 / A.atual.n)} → ${pc(A.m2.c95 / A.m2.n)} | ${f3(media(A.atual.crps))} → ${f3(media(A.m2.crps))} |`);
}
const dS = dif(S.m2.crps, S.atual.crps);
log(`| **Todos** | **${pc(S.atual.c80 / S.atual.n)} → ${pc(S.m2.c80 / S.m2.n)}** | **${pc(S.atual.c95 / S.atual.n)} → ${pc(S.m2.c95 / S.m2.n)}** | **${f3(media(S.atual.crps))} → ${f3(media(S.m2.crps))}** (dif. ${f3(dS.m)} ± ${f3(2 * dS.se)}) |`);

// ---- tempo
const R = rng(9); const s = cenario(ESTADOS, hist, R, { centro: 50, id: "normal" });
const q = apuracao(ESTADOS.map((e) => ({ uf: e.uf, apurado1752: 30, V: s.V[e.uf], final: s.final[e.uf], u: R.n() * 4.5 })), {})(200);
const tempo = (P) => { projetar(motorDe(ESTADOS), q, ALVO, P); const a = performance.now(); for (let i = 0; i < 30; i++) projetar(motorDe(ESTADOS), q, ALVO, P); return (performance.now() - a) / 30; };
const ta = tempo(PARAMS), tb = tempo(PARAMS_M2);

// ---- regra de adoção (FASE2-PLANO.md, rodada 2)
log("");
log("## Regra de adoção");
const anos = Object.values(real);
const melhor = anos.filter((x) => x.d.m < 0).length, piorSig = anos.filter((x) => x.d.m - 2 * x.d.se > 0).length;
const ok = [];
const reg = (c, msg) => { ok.push(c); log(`${c ? "✔" : "✘"} ${msg}`); };
reg(melhor >= 2 && piorSig === 0, `(a) CRPS menor em ${melhor} de 3 anos reais; pior com significância em ${piorSig}`);
const cobReal = anos.map((x) => x.A.m2.c80 / x.A.m2.n), cobSim = S.m2.c80 / S.m2.n;
reg(cobReal.every((c) => c >= 0.72) && cobSim >= 0.72 && cobSim <= 0.9, `(b) faixa de 80% nas eleições reais: ${cobReal.map(pc).join(", ")} (≥ 72%); no simulador: ${pc(cobSim)} (72–90%)`);
reg(tb <= 2 * ta, `(d) tempo: atual ${f2(ta)} ms, motor 2 ${f2(tb)} ms (${f2(tb / ta)}×; limite 2×)`);
log("(c) V1/V5: testes/resultados-motor2.md.");
log("");
log(`(${((Date.now() - t0) / 1000).toFixed(0)} s.)`);
writeFileSync(join(ROOT, "testes/rodada2.md"), out.join("\n") + "\n");
process.exit(ok.every(Boolean) ? 0 : 1);
