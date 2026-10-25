// O motor sobre a apuração REAL do 2º turno de 2022, reconstruída do boletim de urna (dados/parciais-2022-2t.json).
// Ponto de partida = 1º turno de 2022 por estado; previsão das pesquisas = parâmetro (padrão 52,0: Datafolha da véspera).
// Rodar: node testes/parciais-reais.mjs  → testes/parciais-reais.md
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { projetar, PARAMS, PARAMS_M2, rotulo } from "../src/motor.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const est = JSON.parse(readFileSync(join(ROOT, "dados/estados.json"), "utf8"));
const P22 = JSON.parse(readFileSync(join(ROOT, "dados/parciais-2022-2t.json"), "utf8"));
const out = [];
const log = (s = "") => { console.log(s); out.push(s); };
const f2 = (x) => x.toFixed(2), pc = (x) => (100 * x).toFixed(0) + "%";

const ufs = est.map((r) => r.uf);
const tot1 = est.reduce((s, r) => s + r.lula22_1t + r.bolso22_1t, 0);
const tot2 = Object.values(P22.ufs).reduce((s, u) => s + u.final.A + u.final.B, 0);
const ESTADOS = est.map((r) => ({ uf: r.uf, regiao: r.regiao, base: (100 * r.lula22_1t) / (r.lula22_1t + r.bolso22_1t), Vesp: ((r.lula22_1t + r.bolso22_1t) * tot2) / tot1, outros: 1 - (r.lula22_1t + r.bolso22_1t) / r.validos22_1t }));
const final = Object.fromEntries(ufs.map((u) => { const x = P22.ufs[u].final; return [u, (100 * x.A) / (x.A + x.B)]; }));
const VERDADE = (100 * Object.values(P22.ufs).reduce((s, u) => s + u.final.A, 0)) / tot2;
const n = P22.ufs.SP.sec.length;
const parciaisEm = (i) => Object.fromEntries(ufs.map((u) => { const x = P22.ufs[u], vv = x.A[i] + x.B[i]; return [u, { f: x.sec[i] / x.secoes, A: x.A[i], B: x.B[i], vv, p: vv ? (100 * x.A[i]) / vv : null }]; }));
const nacional = (q) => { let A = 0, B = 0, s = 0, t = 0; for (const u of ufs) { A += q[u].A; B += q[u].B; s += P22.ufs[u].sec[0] * 0 + q[u].f * P22.ufs[u].secoes; t += P22.ufs[u].secoes; } return { f: s / t, p: A + B ? (100 * A) / (A + B) : null }; };
const hora = (i) => { const m = 17 * 60 + i * P22.passoMin; return `${Math.floor(m / 60) % 24}h${String(m % 60).padStart(2, "0")}`; };

log("# O motor sobre a apuração real do 2º turno de 2022");
log("");
log(`Parciais reconstruídas do boletim de urna (seção entra quando o TSE recebeu o BU). Resultado real: Lula ${f2(VERDADE)}%. Ponto de partida: 1º turno de 2022 por estado.`);
// conferência da reconstrução com parciais publicadas naquela noite
log("");
log("Conferência com parciais publicadas (Lula, % dos válidos): ");
for (const [X, p] of [[15.34, 48.32], [50.9, 49.7], [67.76, 50.01], [98.91, 50.83]]) {
  let best = null; for (let i = 0; i < n; i++) { const q = nacional(parciaisEm(i)); if (!best || Math.abs(100 * q.f - X) < Math.abs(100 * best.f - X)) best = { ...q, i }; }
  log(`- publicado ${X}% apurado → ${p}; reconstruído ${f2(100 * best.f)}% apurado (${hora(best.i)}) → ${f2(best.p)}`);
}

const SEC = { ...(process.env.SEC ? { sigmaSec: Number(process.env.SEC) } : {}), ...(process.env.ZZ ? { zzFator: Number(process.env.ZZ) } : {}) };
const MOT = { "motor 1": { ...PARAMS, ...SEC }, "motor 2": { ...PARAMS_M2, ...SEC } };
for (const centro of (process.env.CENTROS || "52.0,50.9,49.0").split(",").map(Number)) {
  const alvo = { centro, meio90: 4.55 };
  log("");
  log(`## Previsão de partida: Lula ${f2(centro)}% (± 4,55)`);
  log("");
  log("| hora | % apurado | parcial | motor 1: projeção [80%] · P(Lula) | motor 2: projeção [80%] · P(Lula) |");
  log("|---|---|---|---|---|");
  const resumo = Object.fromEntries(Object.keys(MOT).map((k) => [k, { c80: 0, c95: 0, n: 0, erro: [], maxErroAntes30: 0, viradas: 0, lado: 0 }]));
  for (let i = 0; i < n; i++) {
    const q = parciaisEm(i), nat = nacional(q);
    if (nat.f <= 0 || nat.f >= 0.999) continue;
    const cel = [];
    for (const [k, P] of Object.entries(MOT)) {
      const r = projetar(ESTADOS, q, alvo, P).A, R = resumo[k];
      R.n++; if (VERDADE >= r.lo80 && VERDADE <= r.hi80) R.c80++; if (VERDADE >= r.lo95 && VERDADE <= r.hi95) R.c95++;
      R.erro.push(Math.abs(r.media - VERDADE)); if (nat.f < 0.3) R.maxErroAntes30 = Math.max(R.maxErroAntes30, Math.abs(r.media - VERDADE));
      const l = r.pVence >= 0.7 ? 1 : r.pVence <= 0.3 ? -1 : 0; if (l && R.lado && l !== R.lado) R.viradas++; if (l) R.lado = l;
      cel.push(`${f2(r.media)} [${f2(r.lo80)}–${f2(r.hi80)}] · ${pc(r.pVence)}${VERDADE < r.lo95 || VERDADE > r.hi95 ? " ✘95" : VERDADE < r.lo80 || VERDADE > r.hi80 ? " ✘80" : ""}`);
    }
    if (i % 3 === 0 || nat.f < 0.4) log(`| ${hora(i)} | ${f2(100 * nat.f)} | ${f2(nat.p)} | ${cel.join(" | ")} |`);
  }
  log("");
  for (const [k, R] of Object.entries(resumo)) log(`- **${k}:** faixa de 80% contém o real em ${R.c80}/${R.n} momentos (${pc(R.c80 / R.n)}); 95% em ${R.c95}/${R.n} (${pc(R.c95 / R.n)}); erro médio ${f2(R.erro.reduce((a, b) => a + b, 0) / R.n)}; maior erro antes de 30% apurado ${f2(R.maxErroAntes30)}; trocas de favorito "de verdade" ${R.viradas}.`);
}

// diagnóstico do modelo da parcial: quanto a parcial de cada estado se afasta do final do estado, por faixa de f
log("");
log("## Diagnóstico: parcial do estado × final do estado (dado real)");
log("Modelo do motor: desvio = (1−f)·b + (1−f)^γ·u, com σb = 2, σu = 4,5, γ = 0,8.");
log("");
log("| % apurado no estado | n | média do desvio (pró-Lula) | desvio-padrão real | desvio-padrão do modelo |");
log("|---|---|---|---|---|");
const faixas = [[0.01, 0.1], [0.1, 0.25], [0.25, 0.5], [0.5, 0.75], [0.75, 0.9], [0.9, 0.99]];
for (const [a, b] of faixas) {
  const ds = [], fs = [];
  for (let i = 0; i < n; i++) { const q = parciaisEm(i); for (const u of ufs) { const x = q[u]; if (x.f >= a && x.f < b && x.p !== null) { ds.push(x.p - final[u]); fs.push(x.f); } } }
  const m = ds.reduce((s, x) => s + x, 0) / ds.length, sd = Math.sqrt(ds.reduce((s, x) => s + (x - m) ** 2, 0) / ds.length);
  const fm = fs.reduce((s, x) => s + x, 0) / fs.length, sdm = Math.sqrt(((1 - fm) * PARAMS.sigmaB) ** 2 + (Math.pow(1 - fm, PARAMS.gamma) * PARAMS.sigmaU) ** 2);
  log(`| ${a * 100}–${b * 100}% | ${ds.length} | ${f2(m)} | ${f2(sd)} | ${f2(sdm)} |`);
}
log("");
log("(Cada estado aparece várias vezes por faixa, uma por momento da noite; os pontos não são independentes.)");
log("");
log("Desvio do ponto de partida (1º turno + ajuste uniforme) × final, por estado, em 2022 1º → 2º turno:");
const sh = VERDADE - ESTADOS.reduce((s, e) => s + e.base * (P22.ufs[e.uf].final.A + P22.ufs[e.uf].final.B), 0) / tot2;
const res = ESTADOS.map((e) => final[e.uf] - e.base - sh);
log(`- desvio-padrão ${f2(Math.sqrt(res.reduce((s, x) => s + x * x, 0) / res.length))} ponto (o motor 1 supõe 0,65); maiores: ${ESTADOS.map((e, i) => [e.uf, res[i]]).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 5).map(([u, x]) => `${u} ${x > 0 ? "+" : ""}${f2(x)}`).join(", ")}`);
writeFileSync(join(ROOT, "testes/parciais-reais.md"), out.join("\n") + "\n");
