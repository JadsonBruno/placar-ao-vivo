// Validação da fase 2 (efeito de região no motor). Rodar:
//   FASE=grade node testes/fase2.mjs   → compara vários (σε, σr) e indica o menor que passa (testes/fase2-grade.md)
//   node testes/fase2.mjs              → motor atual × PARAMS2, critérios V2, V3, V4, V6 e conferência do modelo (testes/fase2.md)
// V1 e V5 são os testes de testes/validacao.mjs rodados com MOTOR=2 (testes/resultados-motor2.md).
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { projetar, PARAMS, PARAMS2 } from "../src/motor.mjs";
import { CENARIOS, apuracao, cenario, gNacional, rng } from "../src/simulado.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const est = JSON.parse(readFileSync(join(ROOT, "dados/estados.json"), "utf8"));
const hist = JSON.parse(readFileSync(join(ROOT, "dados/historico.json"), "utf8"));
const ESTADOS = est.map((r) => ({ uf: r.uf, regiao: r.regiao, base: r.base26, Vesp: r.validos26_2t_esp, ap1752: r.apurado_17h52_1t26 }));
const out = [];
const log = (s = "") => { console.log(s); out.push(s); };
const f2 = (x) => x.toFixed(2);
const pc = (x) => (100 * x).toFixed(0) + "%";
const gInv = (x) => { let lo = 0, hi = 400; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (gNacional(m) < x) lo = m; else hi = m; } return (lo + hi) / 2; };
const FRACS = [0.1, 0.3, 0.6, 0.9], MINS = FRACS.map(gInv);
const ALVO = { centro: 49.26, meio90: 4.55 };
const motor = ESTADOS.map((e) => ({ uf: e.uf, regiao: e.regiao, base: e.base, Vesp: e.Vesp }));

// placar de uma projeção contra a verdade
const novo = () => ({ c80: 0, c95: 0, n: 0, erro: 0, larg: FRACS.map(() => 0), nl: FRACS.map(() => 0) });
const marcar = (A, r, verdade, iF) => { A.n++; if (verdade >= r.lo80 && verdade <= r.hi80) A.c80++; if (verdade >= r.lo95 && verdade <= r.hi95) A.c95++; A.erro += Math.abs(r.media - verdade); A.larg[iF] += r.hi80 - r.lo80; A.nl[iF]++; };

// V2: apurações do simulador de cenários (mesmos sorteios para todo conjunto de parâmetros)
function v2(P, reps) {
  const tot = novo(), por = {};
  for (const c of CENARIOS) {
    const R = rng(300 + CENARIOS.indexOf(c)); por[c.id] = novo();
    for (let i = 0; i < reps; i++) {
      const s = cenario(ESTADOS, hist, R, { centro: ALVO.centro, id: c.id });
      const sim = apuracao(ESTADOS.map((e) => ({ uf: e.uf, apurado1752: e.ap1752, V: s.V[e.uf], final: s.final[e.uf], u: R.n() * 4.5 })), { b: R.n() * 2 });
      MINS.forEach((m, iF) => { const r = projetar(motor, sim(m), ALVO, P).A; marcar(tot, r, s.nacional, iF); marcar(por[c.id], r, s.nacional, iF); });
    }
  }
  return { tot, por };
}

// V3: fora da amostra. Base = 1º turno real do ano, verdade = 2º turno real, apuração na ordem de 2026.
// Os desvios do motor são reescalados pela fatia de "outros" do 1º turno daquele ano (como na calibragem).
function v3(P, reps) {
  const res = {};
  for (const ano of ["2014", "2018", "2022"]) {
    const fator = hist.transicoes[ano].outros1t / hist.calib.outros26;
    const PY = { ...P, sigmaEps: P.sigmaEps * fator, sigmaR: (P.sigmaR || 0) * fator };
    const eAno = ESTADOS.map((e) => { const a = hist.porUF[e.uf].anos[ano]; return { ...e, base: a.t1, Vesp: a.v2, final: a.t2 }; });
    const verdade = eAno.reduce((s, e) => s + e.final * e.Vesp, 0) / eAno.reduce((s, e) => s + e.Vesp, 0);
    const R = rng(Number(ano)); const A = novo();
    for (let i = 0; i < reps; i++) {
      const alvo = { centro: verdade + R.n() * (ALVO.meio90 / 1.645), meio90: ALVO.meio90 }; // pesquisas com o erro que a faixa de 90% supõe
      const sim = apuracao(eAno.map((e) => ({ uf: e.uf, apurado1752: e.ap1752, V: e.Vesp, final: e.final, u: R.n() * 4.5 })), { b: R.n() * 2 });
      MINS.forEach((m, iF) => marcar(A, projetar(eAno.map(({ uf, regiao, base, Vesp }) => ({ uf, regiao, base, Vesp })), sim(m), alvo, PY).A, verdade, iF));
    }
    res[ano] = A;
  }
  return res;
}

function criterios(r, ref) {
  const c80 = r.v2.tot.c80 / r.v2.tot.n, c95 = r.v2.tot.c95 / r.v2.tot.n;
  const ok = {
    V2: c80 >= 0.75 && c80 <= 0.88 && c95 >= 0.91 && c95 <= 0.98,
    V3: Object.values(r.v3).every((a) => a.c80 / a.n >= 0.7),
    V4: !ref || (r.v2.tot.larg[1] / r.v2.tot.nl[1] <= 1.6 * (ref.v2.tot.larg[1] / ref.v2.tot.nl[1]) && r.v2.tot.erro / r.v2.tot.n <= ref.v2.tot.erro / ref.v2.tot.n + 0.02
      // o erro médio também não pode piorar nas eleições reais (mais de 0,03 ponto em algum ano)
      && Object.keys(r.v3).every((a) => r.v3[a].erro / r.v3[a].n <= ref.v3[a].erro / ref.v3[a].n + 0.03)),
  };
  return { c80, c95, ok, todos: Object.values(ok).every(Boolean) };
}
const linhaV3 = (r) => Object.entries(r.v3).map(([a, x]) => `${a}: ${pc(x.c80 / x.n)}/${pc(x.c95 / x.n)} erro ${f2(x.erro / x.n)}`).join(" · ");

if (process.env.FASE === "grade") {
  const reps = 20, repsB = 30;
  log("# Fase 2: escolha de σε e σr (grade)");
  log("");
  log(`V2 com ${reps} apurações por cenário; V3 com ${repsB} por ano; 4 momentos (10, 30, 60, 90% das seções). Critérios: V2 80% em 75–88% e 95% em 91–98%; V3 80% ≥ 70% em cada ano; V4 largura com 30% ≤ 1,6× a atual e erro médio não pior.`);
  log("");
  log("| Motor | V2 80% / 95% | V3 80% / 95% por ano | Largura 80% com 30% | Erro médio | V2 | V3 | V4 |");
  log("|---|---|---|---|---|---|---|---|");
  const ref = { v2: v2(PARAMS, reps), v3: v3(PARAMS, repsB) };
  const linha = (nome, r) => { const c = criterios(r, nome === "atual" ? null : ref); log(`| ${nome} | ${pc(c.c80)} / ${pc(c.c95)} | ${linhaV3(r)} | ${f2(r.v2.tot.larg[1] / r.v2.tot.nl[1])} | ${f2(r.v2.tot.erro / r.v2.tot.n)} | ${c.ok.V2 ? "✔" : "✘"} | ${c.ok.V3 ? "✔" : "✘"} | ${nome === "atual" ? "—" : c.ok.V4 ? "✔" : "✘"} |`); return c; };
  linha("atual", ref);
  let escolhido = null;
  // 1ª rodada: escala logística (grade 0,7/1,0 × 0–1,5). 2ª rodada (V4 também nas eleições reais): sem escala logística.
  const conjuntos = process.env.SEM_LOGIT
    ? [0.65, 1.0].flatMap((sigmaEps) => [0.75, 1.0, 1.25, 1.5].map((sigmaR) => ({ sigmaEps, sigmaR, escalaLogit: false }))).concat([1.25, 1.5].map((sigmaR) => ({ sigmaEps: 1.0, sigmaR, escalaLogit: true })))
    : [0.7, 1.0].flatMap((sigmaEps) => [0, 0.5, 0.75, 1.0, 1.25, 1.5].map((sigmaR) => ({ sigmaEps, sigmaR, escalaLogit: true })));
  for (const k of conjuntos) {
    const P = { ...PARAMS, ...k };
    const r = { v2: v2(P, reps), v3: v3(P, repsB) };
    const c = linha(`σε ${k.sigmaEps}, σr ${k.sigmaR}${k.escalaLogit ? ", logit" : ", pontos"}`, r);
    if (c.todos && !escolhido) escolhido = k;
  }
  log("");
  log(escolhido ? `Primeiro conjunto (na ordem da grade) que passa em V2, V3 e V4: σε ${escolhido.sigmaEps}, σr ${escolhido.sigmaR}, ${escolhido.escalaLogit ? "escala logística" : "em pontos"}.` : "Nenhum conjunto passou em V2, V3 e V4 ao mesmo tempo.");
  writeFileSync(join(ROOT, "testes/fase2-grade.md"), out.join("\n") + "\n");
} else {
  const reps = 40, repsB = 60;
  let falhas = 0;
  const ok = (c, msg) => { log(`${c ? "✔" : "✘"} ${msg}`); if (!c) falhas++; };
  log("# Fase 2: motor atual × motor com efeito de região");
  log("");
  log(`PARAMS2: σε ${PARAMS2.sigmaEps} (vezes c = 4p(1−p)), σr ${PARAMS2.sigmaR} ponto a 50%, escala logística. Motor atual: σε ${PARAMS.sigmaEps}, sem região.`);

  // conferência do modelo: dados sorteados do próprio modelo novo têm de cair na faixa com a frequência anunciada
  log("");
  log("## Conferência do modelo novo (dados sorteados do próprio modelo)");
  {
    const R = rng(77), N = 300; let c80 = 0, c95 = 0;
    const escala = ALVO.meio90 / PARAMS2.t90, regioes = [...new Set(ESTADOS.map((e) => e.regiao))];
    for (let i = 0; i < N; i++) {
      const chi = (R.n() ** 2 + R.n() ** 2 + R.n() ** 2 + R.n() ** 2) / 4;
      const Vt = ESTADOS.reduce((a, e) => a + e.Vesp, 0), baseNat = ESTADOS.reduce((a, e) => a + e.base * e.Vesp, 0) / Vt;
      const s = ALVO.centro - baseNat + (escala * R.n()) / Math.sqrt(chi);
      const r = Object.fromEntries(regioes.map((g) => [g, R.n() * PARAMS2.sigmaR]));
      const fin = ESTADOS.map((e) => { const c = (4 * e.base * (100 - e.base)) / 1e4; return { ...e, final: e.base + s + c * r[e.regiao] + c * PARAMS2.sigmaEps * R.n() }; });
      const verdade = fin.reduce((a, e) => a + e.final * e.Vesp, 0) / Vt;
      const sim = apuracao(fin.map((e) => ({ uf: e.uf, apurado1752: e.ap1752, V: e.Vesp, final: e.final, u: R.n() * PARAMS2.sigmaU })), { b: R.n() * PARAMS2.sigmaB, gamma: PARAMS2.gamma });
      const q = projetar(motor, sim(MINS[i % 4]), ALVO, PARAMS2).A;
      if (verdade >= q.lo80 && verdade <= q.hi80) c80++;
      if (verdade >= q.lo95 && verdade <= q.hi95) c95++;
    }
    ok(Math.abs(c80 / N - 0.8) <= 0.06 && Math.abs(c95 / N - 0.95) <= 0.04, `${N} apurações sorteadas do modelo novo: faixa de 80% acerta ${pc(c80 / N)}, de 95% acerta ${pc(c95 / N)} (o cálculo exato confere com o modelo)`);
  }

  const t0 = Date.now();
  const A = { v2: v2(PARAMS, reps), v3: v3(PARAMS, repsB) };
  const B = { v2: v2(PARAMS2, reps), v3: v3(PARAMS2, repsB) };
  const cA = criterios(A, null), cB = criterios(B, A);
  log("");
  log(`## V2: simulador de cenários (${reps} apurações por cenário × 4 momentos)`);
  log("");
  log("| Cenário | Atual 80% / 95% | Novo 80% / 95% | Erro médio atual → novo |");
  log("|---|---|---|---|");
  for (const c of CENARIOS) { const a = A.v2.por[c.id], b = B.v2.por[c.id]; log(`| ${c.nome} | ${pc(a.c80 / a.n)} / ${pc(a.c95 / a.n)} | ${pc(b.c80 / b.n)} / ${pc(b.c95 / b.n)} | ${f2(a.erro / a.n)} → ${f2(b.erro / b.n)} |`); }
  log(`| **Todos** | **${pc(cA.c80)} / ${pc(cA.c95)}** | **${pc(cB.c80)} / ${pc(cB.c95)}** | ${f2(A.v2.tot.erro / A.v2.tot.n)} → ${f2(B.v2.tot.erro / B.v2.tot.n)} |`);
  ok(cB.ok.V2, `V2: faixa de 80% acerta ${pc(cB.c80)} (meta 75–88%); de 95%, ${pc(cB.c95)} (meta 91–98%)`);
  log("");
  log(`## V3: eleições reais fora da amostra (${repsB} apurações por ano × 4 momentos)`);
  log("");
  log("| Ano | Atual 80% / 95% | Novo 80% / 95% | Erro médio atual → novo |");
  log("|---|---|---|---|");
  for (const ano of Object.keys(A.v3)) { const a = A.v3[ano], b = B.v3[ano]; log(`| ${ano} | ${pc(a.c80 / a.n)} / ${pc(a.c95 / a.n)} | ${pc(b.c80 / b.n)} / ${pc(b.c95 / b.n)} | ${f2(a.erro / a.n)} → ${f2(b.erro / b.n)} |`); }
  ok(cB.ok.V3, `V3: faixa de 80% acerta ≥ 70% em cada ano (${linhaV3(B)})`);
  log("");
  log("## V4: largura da faixa de 80% (média, pontos)");
  log("");
  log(`| | ${FRACS.map((f) => `${f * 100}% apurado`).join(" | ")} |`);
  log(`|---|${FRACS.map(() => "---").join("|")}|`);
  log(`| atual | ${FRACS.map((_, i) => f2(A.v2.tot.larg[i] / A.v2.tot.nl[i])).join(" | ")} |`);
  log(`| novo | ${FRACS.map((_, i) => f2(B.v2.tot.larg[i] / B.v2.tot.nl[i])).join(" | ")} |`);
  ok(cB.ok.V4, `V4: com 30% apurado a faixa fica ${f2((B.v2.tot.larg[1] / B.v2.tot.nl[1]) / (A.v2.tot.larg[1] / A.v2.tot.nl[1]))}× a atual (limite 1,6×); erro médio ${f2(A.v2.tot.erro / A.v2.tot.n)} → ${f2(B.v2.tot.erro / B.v2.tot.n)}`);
  log("");
  log("## V6: tempo do cálculo (Node, todos os estados com 30% apurado)");
  {
    const R = rng(9); const s = cenario(ESTADOS, hist, R, { centro: 50, id: "normal" });
    const q = apuracao(ESTADOS.map((e) => ({ uf: e.uf, apurado1752: 30, V: s.V[e.uf], final: s.final[e.uf], u: R.n() * 4.5 })), {})(200);
    const t = (P) => { projetar(motor, q, ALVO, P); const a = performance.now(); for (let i = 0; i < 40; i++) projetar(motor, q, ALVO, P); return (performance.now() - a) / 40; };
    const ta = t(PARAMS), tb = t(PARAMS2);
    ok(tb <= 1.3 * ta, `atual ${f2(ta)} ms, novo ${f2(tb)} ms por cálculo (${f2(tb / ta)}×; limite 1,3×)`);
  }
  log("");
  log(`(${((Date.now() - t0) / 1000).toFixed(0)} s.) V1 e V5: ver testes/resultados-motor2.md.`);
  log("");
  log(falhas ? `**${falhas} critério(s) falharam.**` : "**Todos os critérios desta página passaram.**");
  writeFileSync(join(ROOT, "testes/fase2.md"), out.join("\n") + "\n");
  process.exit(falhas ? 1 : 0);
}
