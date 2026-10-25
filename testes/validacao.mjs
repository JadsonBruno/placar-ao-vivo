// Validação obrigatória (seção 6 do prompt). Rodar: node testes/validacao.mjs
// Escreve testes/resultados.md, que o README resume.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { projetar, PARAMS, delta, rotulo } from "../src/motor.mjs";
import { apuracao, LINHA_1T26, gNacional, rng } from "../src/simulado.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
if (process.env.SB) PARAMS.sigmaB = Number(process.env.SB);
const est = JSON.parse(readFileSync(join(ROOT, "dados/estados.json"), "utf8"));
const out = [];
const log = (s = "") => { console.log(s); out.push(s); };
const f2 = (x) => (x === null || x === undefined ? "—" : x.toFixed(2));
const pct = (x) => (100 * x).toFixed(1) + "%";
let falhas = 0;
const ok = (cond, msg) => { log(`${cond ? "✔" : "✘"} ${msg}`); if (!cond) falhas++; };

// ---------------------------------------------------------------- 6.1 dados batem com o TSE
log("## 6.1 Dados batem com o TSE");
const sum = (k) => est.reduce((s, r) => s + r[k], 0);
ok(sum("lula26_1t") === 53879538 && sum("flavio26_1t") === 56104503, `1º turno 2026: Lula ${sum("lula26_1t")}, Flávio ${sum("flavio26_1t")}`);
ok(sum("lula22_2t") === 60345999 && sum("bolso22_2t") === 58206354, `2º turno 2022: Lula ${sum("lula22_2t")}, Bolsonaro ${sum("bolso22_2t")}`);
ok(sum("lula22_1t") === 57259504 && sum("bolso22_1t") === 51072345, `1º turno 2022: Lula ${sum("lula22_1t")}, Bolsonaro ${sum("bolso22_1t")}`);
const V2 = sum("validos26_2t_esp");
const baseNat = est.reduce((s, r) => s + r.base26 * r.validos26_2t_esp, 0) / V2;
ok(Math.abs(baseNat - 48.726) < 0.0005, `média nacional da base ponderada pelos válidos esperados do 2º turno = ${baseNat.toFixed(3)} (prompt: 48,726)`);

// ---------------------------------------------------------------- base do teste de 2026 1º turno: prior = 1º turno de 2022 + ajuste uniforme
const truth1T = (100 * sum("lula26_1t")) / (sum("lula26_1t") + sum("flavio26_1t"));
// no 1º turno há outros candidatos: o peso de cada estado são os votos dos DOIS (no 2º turno isso é igual aos válidos)
const V2c = (r) => r.lula26_1t + r.flavio26_1t;
const est1T = est.map((r) => ({ uf: r.uf, base: (100 * r.lula22_1t) / (r.lula22_1t + r.bolso22_1t), Vesp: V2c(r) }));
// alvo do teste: as pesquisas do 1º turno superestimaram a margem Lula − Flávio em 3,7 pontos (seção 7) ≈ +1,85 na fatia de 2 candidatos
const alvo1T = { centro: truth1T + 1.85, meio90: 4.55 };
const swingErr = est.map((r) => { const b = (100 * r.lula22_1t) / (r.lula22_1t + r.bolso22_1t); return r.base26 - b; });
const meanSwing = swingErr.reduce((a, b) => a + b, 0) / swingErr.length;
const maeSwing = swingErr.reduce((a, b) => a + Math.abs(b - meanSwing), 0) / swingErr.length;
log("");
log(`Base do teste: 1º turno 2022 → 1º turno 2026 com ajuste uniforme erra em média ${maeSwing.toFixed(2)} pt por estado (no prompt, 1º → 2º turno de 2022: 0,51). Final real do 1º turno 2026 em votos de 2 candidatos: Lula ${truth1T.toFixed(2)}.`);
const P1T = { ...PARAMS, sigmaEps: Math.max(PARAMS.sigmaEps, maeSwing * 1.25) };
log(`No teste do 1º turno uso σε = ${P1T.sigmaEps.toFixed(2)} (o erro desse prior é maior que o do 2º turno); no 2º turno de 2026 o motor usa σε = ${PARAMS.sigmaEps}.`);

// ---------------------------------------------------------------- 6.2 por estado, com as parciais estaduais das 17h52
log("");
log("## 6.2 Por estado: parciais estaduais das 17h52 do 1º turno de 2026");
log("Parcial por estado reconstruída do Mix Vale (o artigo dá só o % do líder; o % do outro é estimado supondo que os demais candidatos tinham na parcial a mesma fatia do final — ver README).");
const parc1752 = Object.fromEntries(est.map((r) => { const f = r.apurado_17h52_1t26 / 100, vv = Math.round(f * V2c(r)); return [r.uf, { f, p: r.parcial2c_17h52_1t26, vv, A: Math.round((vv * r.parcial2c_17h52_1t26) / 100), B: vv - Math.round((vv * r.parcial2c_17h52_1t26) / 100) }]; }));
const variantes = [["modelo (k calibrado)", P1T], ["w(f) = f", { ...P1T, wFn: (f) => f }], ["w(f) = 0 (só ajuste uniforme)", { ...P1T, wFn: () => 0 }]];
for (const [nome, P] of variantes) {
  const r = projetar(est1T, parc1752, alvo1T, P);
  let mae = 0, c80 = 0, c95 = 0;
  for (const u of r.porUF) { const t = est.find((x) => x.uf === u.uf).base26; mae += Math.abs(u.final - t); if (t >= u.lo80 && t <= u.hi80) c80++; if (t >= u.lo95 && t <= u.hi95) c95++; }
  const n = r.porUF.length;
  log(`- ${nome}: erro médio por estado ${(mae / n).toFixed(2)} pt; o final real cai no intervalo de 80% em ${c80}/${n} (${pct(c80 / n)}) e no de 95% em ${c95}/${n} (${pct(c95 / n)}); nacional ${f2(r.A.media)} [${f2(r.A.lo95)}–${f2(r.A.hi95)}], real ${f2(truth1T)}`);
}
// ruído da parcial em função de f: modelo × observado
log("");
log("Ruído da parcial do estado em relação ao final do estado (pontos), modelo × observado:");
const sdModel = (f) => Math.sqrt(((1 - f) * PARAMS.sigmaB) ** 2 + (Math.pow(1 - f, PARAMS.gamma) * PARAMS.sigmaU) ** 2);
const errs = est.map((r) => ({ f: r.apurado_17h52_1t26 / 100, e: r.parcial2c_17h52_1t26 - r.base26 }));
for (const [a, b] of [[0, 0.05], [0.05, 0.15], [0.15, 0.4], [0.4, 1]]) {
  const s = errs.filter((x) => x.f >= a && x.f < b), rms = Math.sqrt(s.reduce((t, x) => t + x.e * x.e, 0) / s.length), fm = s.reduce((t, x) => t + x.f, 0) / s.length;
  log(`- f ${a * 100}–${b * 100}%: ${s.length} estados, RMS observado ${rms.toFixed(2)}, modelo ${sdModel(fm).toFixed(2)}`);
}
log(`- faixas do prompt (outro momento da noite): 40–80% erro abs. médio 1,7 → RMS ≈ 2,1, modelo em f=0,6: ${sdModel(0.6).toFixed(2)}; ≥80%: 0,6 → RMS ≈ 0,75, modelo em f=0,9: ${sdModel(0.9).toFixed(2)}`);

// ---------------------------------------------------------------- 6.3 noite inteira sintética (1º turno de 2026)
log("");
log("## 6.3 Noite sintética do 1º turno de 2026");
// u de cada estado tirado da parcial das 17h52; b comum ajustado para reproduzir a curva nacional medida
const SEED = Number(process.env.SEED || 3);
const RU = rng(SEED); const uDraw = Object.fromEntries(est.map((r) => [r.uf, RU.n() * PARAMS.sigmaU]));
// ruído de cada estado sorteado do próprio modelo (semente fixa); ordem e ritmo dos estados vêm das 17h52 reais
const mkStates = (b) => est.map((r) => ({ uf: r.uf, apurado1752: r.apurado_17h52_1t26, V: V2c(r), final: r.base26, u: uDraw[r.uf] }));
const natOf = (sim, min) => { const q = sim(min); let A = 0, B = 0, cont = 0, tot = 0; for (const r of est) { A += q[r.uf].A; B += q[r.uf].B; cont += q[r.uf].f * V2c(r); tot += V2c(r); } return { X: (100 * cont) / tot, p: (100 * A) / (A + B), q }; };
let best = null;
for (let b = -14; b <= 14.001; b += 0.25) {
  const sim = apuracao(mkStates(b), { b });
  const err = LINHA_1T26.reduce((s, pt) => s + (natOf(sim, pt.min).p - pt.lula2c) ** 2, 0);
  if (!best || err < best.err) best = { b, err };
}
const sim = apuracao(mkStates(best.b), { b: best.b });
log(`Semente ${SEED}. Ruído de cada estado sorteado de N(0, ${PARAMS.sigmaU}); viés comum ajustado à curva medida: b = ${best.b.toFixed(2)}. Curva nacional reproduzida × medida:`);
log("| hora | % seções medido | % sintético | Lula 2c medido | Lula 2c sintético |");
log("|---|---|---|---|---|");
for (const pt of LINHA_1T26) { const n = natOf(sim, pt.min); const h = 17 * 60 + pt.min; log(`| ${Math.floor(h / 60)}h${String(h % 60).padStart(2, "0")} | ${pt.X} | ${n.X.toFixed(1)} | ${pt.lula2c.toFixed(2)} | ${n.p.toFixed(2)} |`); }
log("");
log(`Motor sobre a noite sintética (prior = 1º turno 2022 + ajuste; alvo = ${alvo1T.centro.toFixed(2)}, de propósito 1,85 acima do real, como erraram as pesquisas; real = ${truth1T.toFixed(2)}):`);
log("| hora | % seções | parcial nacional | extrapolação ingênua | projeção | 80% | 95% | P(Lula > 50) | rótulo |");
log("|---|---|---|---|---|---|---|---|---|");
const traj = [];
for (let min = 10; min <= 360; min += 10) {
  const n = natOf(sim, min);
  const r = projetar(est1T, n.q, alvo1T, P1T);
  traj.push({ min, X: n.X, p: n.p, r });
  if (min % 20 === 0 || min <= 60) {
    const h = 17 * 60 + min, lb = rotulo(r.A.pVence, null);
    log(`| ${Math.floor(h / 60)}h${String(h % 60).padStart(2, "0")} | ${n.X.toFixed(1)} | ${f2(n.p)} | ${f2(n.p)} | ${f2(r.A.media)} | ${f2(r.A.lo80)}–${f2(r.A.hi80)} | ${f2(r.A.lo95)}–${f2(r.A.hi95)} | ${pct(r.A.pVence)} | ${lb.quem ? (lb.quem === "A" ? "Lula " : "Flávio ") : ""}${lb.texto} |`);
  }
}
const last = traj[traj.length - 1];
ok(Math.abs(last.r.A.media - truth1T) < 0.3, `converge: projeção final ${f2(last.r.A.media)} × real ${f2(truth1T)}`);
const cov95 = traj.filter((t) => truth1T >= t.r.A.lo95 && truth1T <= t.r.A.hi95).length, cov80 = traj.filter((t) => truth1T >= t.r.A.lo80 && truth1T <= t.r.A.hi80).length;
ok(cov95 / traj.length >= 0.9, `intervalo de 95% contém o real em ${cov95}/${traj.length} momentos da noite; 80% em ${cov80}/${traj.length}`);
const early = traj.filter((t) => t.X < 30);
ok(early.every((t) => t.r.A.hi95 - t.r.A.lo95 > 2), `no começo da noite (< 30% apurado) os intervalos de 95% não ficam estreitos: menor largura ${f2(Math.min(...early.map((t) => t.r.A.hi95 - t.r.A.lo95)))} pt`);
const naiveWrong = early.map((t) => Math.abs(t.p - truth1T)), motorWrong = early.map((t) => Math.abs(t.r.A.media - truth1T));
ok(Math.max(...motorWrong) < Math.max(...naiveWrong), `antes de 30% apurado, o motor erra no máximo ${f2(Math.max(...motorWrong))} pt; a parcial nacional crua erra até ${f2(Math.max(...naiveWrong))} pt`);
// "virar de favorito por causa da ordem": sair de favorável (P ≥ 70%) para um lado e depois ir a favorável para o outro mais de uma vez
const lado = (p) => (p >= 0.7 ? 1 : p <= 0.3 ? -1 : 0);
let viradas = 0, ult = 0; for (const t of traj) { const l = lado(t.r.A.pVence); if (l && ult && l !== ult) viradas++; if (l) ult = l; }
let cruzou50 = 0; for (let i = 1; i < traj.length; i++) if ((traj[i].r.A.pVence > 0.5) !== (traj[i - 1].r.A.pVence > 0.5)) cruzou50++;
ok(viradas <= 1, `trocas de favorito "de verdade" (de ≥ 70% para um lado a ≥ 70% para o outro): ${viradas}; cruzou 50% ${cruzou50} vez(es), sempre passando por "indefinido"`);
// mesmo teste com o prior errado para o outro lado
const alvoB = { centro: truth1T - 1.85, meio90: 4.55 };
const trajB = []; for (let min = 10; min <= 360; min += 10) { const n = natOf(sim, min); trajB.push(projetar(est1T, n.q, alvoB, P1T)); }
let virB = 0; for (let i = 1; i < trajB.length; i++) if ((trajB[i].A.pVence > 0.5) !== (trajB[i - 1].A.pVence > 0.5)) virB++;
ok(Math.abs(trajB[trajB.length - 1].A.media - truth1T) < 0.3 && virB <= 1, `com o prior errado para o outro lado (${f2(alvoB.centro)}): termina em ${f2(trajB[trajB.length - 1].A.media)}, ${virB} troca(s) de favorito`);

// ---------------------------------------------------------------- 6.4 2º turno de 2022 na checagem simples
log("");
log("## 6.4 2º turno de 2022 na checagem simples (5.3)");
log("Final estimado = parcial − Δ(X), com as duas curvas. Resultado real: Lula 50,90.");
const p22 = [[15.34, 48.32], [50.9, 49.7], [67.76, 50.01], [98.91, 50.83]];
for (const [X, p] of p22) {
  const a = p - delta("1º turno 2026", X), b = p - delta("2º turno 2022", X), lo = Math.min(a, b), hi = Math.max(a, b);
  ok(50.9 >= lo - 0.05 && 50.9 <= hi + 0.05, `${X}% apurado, parcial ${p}: faixa ${f2(lo)}–${f2(hi)}`);
}
log("Ressalva: a curva de 2022 foi medida nesses mesmos pontos, então ela sempre acerta 2022 (teste circular); o que o teste mostra é que a faixa entre as duas curvas contém o real.");

// ---------------------------------------------------------------- 6.5 simetria
log("");
log("## 6.5 Simetria");
const est2 = est.map((r) => ({ uf: r.uf, base: r.base26, Vesp: r.validos26_2t_esp }));
const R = rng(7);
let maxDiff = 0;
for (let trial = 0; trial < 5; trial++) {
  const parc = {};
  for (const r of est) if (R.u() < 0.7) { const f = R.u(); const p = r.base26 + R.n() * 3; const vv = Math.round(f * r.validos26_2t_esp); parc[r.uf] = { f, p, vv, A: Math.round((vv * p) / 100), B: vv - Math.round((vv * p) / 100) }; }
  const alvo = { centro: 46 + 6 * R.u(), meio90: 4.55 };
  const a = projetar(est2, parc, alvo);
  const b = projetar(est2.map((e) => ({ ...e, base: 100 - e.base })), Object.fromEntries(Object.entries(parc).map(([k, v]) => [k, { ...v, p: 100 - v.p, A: v.B, B: v.A }])), { centro: 100 - alvo.centro, meio90: alvo.meio90 });
  for (const k of ["media", "lo80", "hi80", "lo95", "hi95", "pVence"]) maxDiff = Math.max(maxDiff, Math.abs(a.A[k] - b.B[k]), Math.abs(a.B[k] - b.A[k]));
}
ok(maxDiff < 1e-9, `trocar os rótulos espelha as saídas: maior diferença ${maxDiff.toExponential(1)} (5 cenários aleatórios)`);

// ---------------------------------------------------------------- conferência com Monte Carlo de 20 mil sorteios
log("");
log("## Conferência: mistura analítica × Monte Carlo de 20 mil sorteios");
{
  const q = natOf(sim, 76).q;
  const r = projetar(est1T, q, alvo1T, P1T);
  // Monte Carlo: sorteia (s, b) da posterior por amostragem por importância e ε de cada estado
  const MC = rng(11), Ns = 20000, draws = [];
  const ufs = est1T.map((e) => { const x = q[e.uf]; const f = x.f, V = x.vv + (1 - f) * e.Vesp; const varD = P1T.sigmaEps ** 2 + Math.pow(1 - f, 2 * P1T.gamma) * P1T.sigmaU ** 2; return { ...e, f, p: x.vv > 0 ? x.p : null, V, varD, k: x.vv > 0 ? P1T.sigmaEps ** 2 / varD : 0 }; });
  const Vt = ufs.reduce((a, x) => a + x.V, 0);
  const sc = alvo1T.meio90 / P1T.t90, s0 = r.s0;
  const cand = [];
  for (let i = 0; i < 400000; i++) {
    const chi = (MC.n() ** 2 + MC.n() ** 2 + MC.n() ** 2 + MC.n() ** 2) / 4; const s = s0 + (sc * MC.n()) / Math.sqrt(chi); const b = MC.n() * P1T.sigmaB;
    let ll = 0; for (const x of ufs) if (x.p !== null) { const d = x.p - x.base - s - (1 - x.f) * b; ll -= (d * d) / (2 * x.varD); }
    cand.push([s, b, ll]);
  }
  let mx = -Infinity; for (const c of cand) if (c[2] > mx) mx = c[2]; const ws = cand.map((c) => Math.exp(c[2] - mx)); const W = ws.reduce((a, b) => a + b, 0);
  const cum = []; let acc = 0; for (const w of ws) { acc += w / W; cum.push(acc); }
  for (let i = 0; i < Ns; i++) {
    const t = MC.u(); let lo = 0, hi = cum.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (cum[m] < t) lo = m + 1; else hi = m; }
    const [s, b] = cand[lo]; let nat = 0;
    for (const x of ufs) { const d = x.p !== null ? x.p - x.base - s - (1 - x.f) * b : 0; const mu = x.base + s + x.k * d; nat += (x.V / Vt) * (mu + MC.n() * P1T.sigmaEps * Math.sqrt(1 - x.k)); }
    draws.push(nat);
  }
  draws.sort((a, b) => a - b);
  const qmc = (p) => draws[Math.floor(p * (Ns - 1))];
  log(`- 18h16 sintético: analítico média ${f2(r.A.media)}, 80% ${f2(r.A.lo80)}–${f2(r.A.hi80)}, P(A) ${pct(r.A.pVence)}; Monte Carlo média ${f2(draws.reduce((a, b) => a + b, 0) / Ns)}, 80% ${f2(qmc(0.1))}–${f2(qmc(0.9))}, P(A) ${pct(draws.filter((x) => x > 50).length / Ns)}`);
}

log("");
log(falhas ? `**${falhas} verificação(ões) falharam.**` : "**Todas as verificações passaram.**");
writeFileSync(join(ROOT, "testes/resultados.md"), "# Resultados da validação (gerado por testes/validacao.mjs)\n\n" + out.join("\n") + "\n");
void gNacional;
process.exitCode = falhas ? 1 : 0;
