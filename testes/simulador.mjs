// Testes do simulador de cenários. Rodar: node testes/simulador.mjs
// Escreve testes/simulador.md. Confere: (1) simetria entre os candidatos e entre cenários espelhados; (2) limites
// históricos por estado; (3) tamanho dos desvios; e mede (4) se a faixa do motor cobre o resultado em cada cenário
// (só medição: o motor não é alterado aqui).
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { projetar } from "../src/motor.mjs";
import { CENARIOS, MARGEM_LIMITE, apuracao, cenario, gNacional, rng } from "../src/simulado.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const est = JSON.parse(readFileSync(join(ROOT, "dados/estados.json"), "utf8"));
const hist = JSON.parse(readFileSync(join(ROOT, "dados/historico.json"), "utf8"));
const ESTADOS = est.map((r) => ({ uf: r.uf, regiao: r.regiao, base: r.base26, Vesp: r.validos26_2t_esp, ap1752: r.apurado_17h52_1t26 }));
const out = [];
const log = (s = "") => { console.log(s); out.push(s); };
let falhas = 0;
const ok = (cond, msg) => { log(`${cond ? "✔" : "✘"} ${msg}`); if (!cond) falhas++; };
const media = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const f2 = (x) => x.toFixed(2);

log("# Testes do simulador de cenários");
log("");
log(`Calibragem (dados/historico.json): região ${hist.calib.sigRegiao} e estado ${hist.calib.sigEstado} em logit; válidos: região ${(100 * hist.calib.sigRegiaoValidos).toFixed(1)}%, estado ${(100 * hist.calib.sigEstadoValidos).toFixed(1)}%.`);

// ---------------------------------------------------------------- 1. simetria
log("");
log("## 1. Simetria");
const N = 4000;
const R = rng(11);
const sorteios = Array.from({ length: N }, () => cenario(ESTADOS, hist, R, { centro: 50 }));
const mNac = media(sorteios.map((s) => s.nacional));
const pA = sorteios.filter((s) => s.nacional > 50).length / N;
ok(Math.abs(mNac - 50) < 0.15, `"Aleatório" com previsão de empate: média nacional de Lula ${f2(mNac)}% em ${N} sorteios (esperado 50)`);
ok(Math.abs(pA - 0.5) < 0.03, `Lula vence em ${(100 * pA).toFixed(1)}% dos sorteios (esperado 50%)`);
const freq = Object.fromEntries(CENARIOS.map((c) => [c.id, sorteios.filter((s) => s.id === c.id).length / N]));
ok(CENARIOS.every((c) => Math.abs(freq[c.id] - 1 / CENARIOS.length) < 0.02), `cada cenário sai com a mesma frequência (${CENARIOS.map((c) => c.id + " " + (100 * freq[c.id]).toFixed(1) + "%").join(", ")})`);
log("");
log("| Cenário | Média nacional de Lula | Espelho | Média do espelho | Desvio de 50 (soma) |");
log("|---|---|---|---|---|");
const efeito = {};
for (const c of CENARIOS) {
  const Rc = rng(100 + CENARIOS.indexOf(c));
  efeito[c.id] = media(Array.from({ length: 1500 }, () => cenario(ESTADOS, hist, Rc, { centro: 50, id: c.id }).nacional));
}
for (const c of CENARIOS) {
  if (c.par && CENARIOS.indexOf(c) > CENARIOS.findIndex((x) => x.id === c.par)) continue;
  const m = efeito[c.id], e = c.par ? efeito[c.par] : m;
  log(`| ${c.nome} | ${f2(m)}% | ${c.par ? CENARIOS.find((x) => x.id === c.par).nome : "(ele mesmo)"} | ${f2(e)}% | ${f2(m - 50 + (e - 50))} |`);
  if (c.par) ok(Math.abs(m - 50 + (e - 50)) < 0.35, `${c.id} × ${c.par}: efeitos opostos (${f2(m - 50)} e ${f2(e - 50)} pontos)`);
}

// ---------------------------------------------------------------- 2. limites históricos
log("");
log("## 2. Limites históricos por estado");
log(`Limite = mínimo e máximo do PT nos 2º turnos de 2014, 2018, 2022 e no 1º turno de 2026, ± ${MARGEM_LIMITE} pontos. Um estado que passa do limite tem o desvio sorteado de novo.`);
let fora = 0, cortados = 0, resorteios = 0;
for (const s of sorteios) { resorteios += s.resorteios; cortados += s.cortados; for (const e of ESTADOS) if (s.final[e.uf] < s.lim[e.uf][0] - 1e-9 || s.final[e.uf] > s.lim[e.uf][1] + 1e-9) fora++; }
ok(fora === 0, `nenhum estado fora do limite em ${N} sorteios × ${ESTADOS.length} estados`);
log(`- ressorteios: ${resorteios} (${((100 * resorteios) / (N * ESTADOS.length)).toFixed(2)}% dos estados sorteados); cortes no limite: ${cortados}`);
// alvo extremo: o histórico não deixa e o corte é contado
const ext = cenario(ESTADOS, hist, rng(5), { centro: 65, id: "normal" });
ok(ext.cortados > 0, `previsão extrema (Lula 65%): ${ext.cortados} estados param no limite, e isso é contado, não escondido`);
log("");
log("| Estado | 2º t. 2014 | 2º t. 2018 | 2º t. 2022 | 1º t. 2026 | Limite do simulador | Menor e maior sorteados |");
log("|---|---|---|---|---|---|---|");
for (const uf of ["PI", "BA", "CE", "MA", "AL", "SP", "SC", "RO", "AC", "RR"]) {
  const h = hist.porUF[uf], xs = sorteios.map((s) => s.final[uf]);
  log(`| ${uf} | ${h.t2_2014} | ${h.t2_2018} | ${h.t2_2022} | ${h.t1_2026} | ${f2(Math.max(0.5, h.min - MARGEM_LIMITE))}–${f2(Math.min(99.5, h.max + MARGEM_LIMITE))} | ${f2(Math.min(...xs))}–${f2(Math.max(...xs))} |`);
}

// ---------------------------------------------------------------- 3. tamanho dos desvios
log("");
log("## 3. Tamanho dos desvios (cenário sem surpresa)");
const Rn = rng(21);
const normais = Array.from({ length: 2000 }, () => cenario(ESTADOS, hist, Rn, { centro: 50, id: "normal" }));
// desvio de cada estado em relação ao deslocamento uniforme que daria o mesmo nacional
const dUnif = [];
for (const s of normais) { const sh = s.nacional - ESTADOS.reduce((a, e) => a + e.base * s.V[e.uf], 0) / ESTADOS.reduce((a, e) => a + s.V[e.uf], 0); for (const e of ESTADOS) if (e.uf !== "ZZ") dUnif.push(s.final[e.uf] - e.base - sh); }
const dpUnif = Math.sqrt(media(dUnif.map((x) => x * x)));
log(`- Desvio típico de um estado em relação ao deslocamento uniforme: ${f2(dpUnif)} ponto (em 2022, do 1º para o 2º turno: 0,51; o motor supõe 0,65).`);
ok(dpUnif > 0.4 && dpUnif < 2.5, "desvio por estado na faixa plausível (0,4 a 2,5 pontos)");

// ---------------------------------------------------------------- 4. cobertura do motor
log("");
log("## 4. A faixa do motor cobre o resultado? (medição, motor inalterado)");
log("Previsão de partida B (49,26 ± 4,55). Para cada cenário, 40 apurações simuladas; o motor roda com 10%, 30%, 60% e 90% das seções.");
log("");
log("| Cenário | Dentro da faixa provável (80%) | Dentro da faixa de 95% | Erro médio da projeção (pontos) |");
log("|---|---|---|---|");
const alvo = { centro: 49.26, meio90: 4.55 };
const gInv = (x) => { let lo = 0, hi = 400; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (gNacional(m) < x) lo = m; else hi = m; } return (lo + hi) / 2; };
const mins = [0.1, 0.3, 0.6, 0.9].map(gInv);
const estMotor = ESTADOS.map((e) => ({ uf: e.uf, base: e.base, Vesp: e.Vesp }));
const tCob = Date.now();
let cob80T = 0, cob95T = 0, nT = 0;
for (const c of CENARIOS) {
  const Rc = rng(300 + CENARIOS.indexOf(c));
  let c80 = 0, c95 = 0, n = 0, erro = 0;
  for (let i = 0; i < 40; i++) {
    const s = cenario(ESTADOS, hist, Rc, { centro: alvo.centro, id: c.id });
    const sim = apuracao(ESTADOS.map((e) => ({ uf: e.uf, apurado1752: e.ap1752, V: s.V[e.uf], final: s.final[e.uf], u: Rc.n() * 4.5 })), { b: Rc.n() * 2 });
    for (const m of mins) {
      const r = projetar(estMotor, sim(m), alvo).A;
      if (s.nacional >= r.lo80 && s.nacional <= r.hi80) c80++;
      if (s.nacional >= r.lo95 && s.nacional <= r.hi95) c95++;
      erro += Math.abs(r.media - s.nacional); n++;
    }
  }
  cob80T += c80; cob95T += c95; nT += n;
  log(`| ${c.nome} | ${((100 * c80) / n).toFixed(0)}% | ${((100 * c95) / n).toFixed(0)}% | ${f2(erro / n)} |`);
}
log(`| **Todos** | **${((100 * cob80T) / nT).toFixed(0)}%** | **${((100 * cob95T) / nT).toFixed(0)}%** | |`);
log("");
log(`(${nT} projeções em ${((Date.now() - tCob) / 1000).toFixed(0)} s.) Uma faixa de 80% bem calibrada acerta perto de 80% no total; num cenário de surpresa é esperado acertar menos.`);

log("");
log(falhas ? `**${falhas} verificação(ões) falharam.**` : "**Todas as verificações passaram.**");
writeFileSync(join(ROOT, "testes/simulador.md"), out.join("\n") + "\n");
process.exit(falhas ? 1 : 0);
