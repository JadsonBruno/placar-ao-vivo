// Motor de projeção por estado. Função pura: (dados dos estados, parciais, configuração) -> projeção.
// Tudo é escrito em termos da fatia de UM candidato ("A") nos votos dos dois; o outro é 100 − A.
// Trocar os rótulos (A ↔ B) espelha as saídas exatamente: o modelo é linear e as distribuições são simétricas.
//
// Modelo (seção 5 do prompt, calibrado no README):
//   final do estado      F_uf = base_uf + s + ε_uf,                  ε_uf ~ N(0, σε)
//   parcial do estado    p_uf = F_uf + (1−f)·b + (1−f)^γ·u_uf,       u_uf ~ N(0, σu)   (viés de ordem dentro do estado)
//   ajuste nacional      s ~ s0 + escala·t(4)                           (previsão das pesquisas)
//   viés comum de ordem  b ~ N(0, σb)                                   (as primeiras seções de todos os estados puxam juntas)
// Dado (s, b), cada F_uf é normal com média base + s + k·d e variância σε²(1−k), onde
//   d = p − base − s − (1−f)·b   e   k = σε² / (σε² + (1−f)^(2γ)·σu²).
// Ou seja: w(f) = k(f) é o peso da parcial do estado, e ele vai a 1 quando o estado termina (f → 1).
// A posterior de (s, b) é calculada numa grade; o nacional é uma mistura de normais (sem sorteio, sem ruído de Monte Carlo).
//
// Fase 2 (PARAMS2, opcional): F_uf = base + s + c_uf·r_região + ε_uf, com r_região ~ N(0, σr) comum aos estados da
// região e c_uf = 4·p(1−p) (p = base): um deslocamento em escala logística vale menos ponto perto dos extremos.
// Com escalaLogit, σε também vira σε·c_uf. Dado (s, b), r é integrado de forma exata, região a região:
//   precisão = 1/σr² + Σ c²/varD,  média = (Σ c·d/varD)/precisão
//   F_uf | dados ~ N(base + s + k·d + (1−k)·c·média, σε_uf²(1−k) + ((1−k)·c)²/precisão)
// e a verossimilhança de (s, b) ganha +½(Σ c·d/varD)²/precisão por região. Com σr = 0 e sem escalaLogit, é o modelo acima.

export const PARAMS = {
  sigmaEps: 0.65, // desvio próprio de cada estado (teste de 2022: erro médio 0,51 → dp ≈ 0,64)
  sigmaU: 4.5, // ruído da parcial dentro do estado (17h52 do 1º turno de 2026 + faixas do prompt)
  sigmaB: 2.0, // viés comum de ordem de apuração (testei 2, 3 e 4: 2 teve menor erro por estado e cobertura de 95% completa; ver README)
  gamma: 0.8, // como o ruído da parcial cai com f
  t90: 2.132, // quantil 95% da t(4): converte o intervalo de 90% das pesquisas em escala
  grid: { sHalf: 18, bHalf: 10, coarse: [145, 41], fine: [121, 31] }, // grade adaptativa: grossa para achar a massa, fina só ali
};

// Fase 2: efeito de região, só com ?motor=2 (não passou em todos os critérios; ver testes/fase2.md e FASE2-PLANO.md).
export const PARAMS2 = { ...PARAMS, sigmaR: 0.75 }; // σε 0,65 como o atual, em pontos (a escala logística piorou o erro em 2014 e 2018)

const SQRT2PI = Math.sqrt(2 * Math.PI);
export function normCdf(x) {
  // Abramowitz–Stegun 7.1.26 via erf, erro < 1,5e-7
  const z = Math.abs(x) / Math.SQRT2, t = 1 / (1 + 0.3275911 * z);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-z * z);
  return x >= 0 ? 0.5 * (1 + y) : 0.5 * (1 - y);
}
// densidade da t de Student com 4 graus de liberdade (sem constante)
const t4 = (x) => Math.pow(1 + (x * x) / 4, -2.5);

// estados: [{ uf, base, Vesp }]  (base = fatia de A em %, Vesp = válidos esperados no 2º turno)
// parciais: { UF: { f (0..1), p (% de A nos votos dos dois), vv (válidos contados), restantes (eleitores ainda não totalizados) } }
// alvo: { centro (% de A), meio90 (meia-largura do intervalo de 90%) }
export function projetar(estados, parciais, alvo, P = PARAMS) {
  if (P.versao === 2) return projetar2(estados, parciais, alvo, P);
  const ufs = estados.map((e) => {
    const q = parciais[e.uf] || {};
    const f = Math.min(1, Math.max(0, q.f || 0));
    const has = f > 0 && Number.isFinite(q.p);
    const V = (q.vv || 0) + (1 - f) * e.Vesp; // válidos que o estado terá no fim
    const g2 = Math.pow(1 - f, 2 * P.gamma);
    const c = P.escalaLogit ? (4 * e.base * (100 - e.base)) / 1e4 : 1; // 1 a 50%; menor perto dos extremos
    const se2 = (P.sigmaEps * (P.escalaLogit ? c : 1)) ** 2;
    const varD = se2 + g2 * P.sigmaU ** 2;
    const k = !has ? 0 : P.wFn ? P.wFn(f) : se2 / varD; // wFn: alternativa só para comparação nos testes
    return { uf: e.uf, base: e.base, reg: P.sigmaR ? e.regiao ?? e.uf : null, c, se2, f, p: has ? q.p : null, has, V, varD, k, vv: q.vv || 0, A: q.A || 0, B: q.B || 0 };
  });
  const Vtot = ufs.reduce((s, x) => s + x.V, 0);
  for (const x of ufs) x.w = x.V / Vtot;
  const baseNat = ufs.reduce((s, x) => s + x.w * x.base, 0);
  const s0 = alvo.centro - baseNat;
  const escala = alvo.meio90 / P.t90;
  const obs = ufs.filter((x) => x.has);
  // fase 2: regiões (só com σr > 0). prec não depende de (s, b); a média do efeito de região, sim.
  const regs = [];
  if (P.sigmaR) {
    const por = new Map();
    for (const x of ufs) { if (!por.has(x.reg)) por.set(x.reg, { prec: 1 / P.sigmaR ** 2, obs: [], todos: [] }); const R = por.get(x.reg); R.todos.push(x); if (x.has) { R.obs.push(x); R.prec += (x.c * x.c) / x.varD; } x.R = R; }
    regs.push(...por.values());
  }
  // R.S = soma de c·d/varD da região, dado (s, b); calculada no mesmo laço da verossimilhança
  const somarReg = (s, b) => { for (const R of regs) R.S = 0; for (const x of obs) if (x.R) x.R.S += (x.c * (x.p - x.base - s - (1 - x.f) * b)) / x.varD; };
  // variância do nacional que vem da incerteza que sobra em cada efeito de região (igual em todas as células)
  const vRegNat = regs.reduce((a, R) => { const t = R.todos.reduce((u, x) => u + x.w * (1 - x.k) * x.c, 0); return a + (t * t) / R.prec; }, 0);

  // ---- posterior de (s, b): grade grossa para achar onde está a massa, depois grade fina só ali
  // (as duas grades são simétricas em torno de s0 e de b = 0, então a troca de rótulos continua exata)
  const G = P.grid;
  const grade = (sLo, sHi, sN, bLo, bHi, bN) => {
    const out = [];
    let mx = -Infinity;
    for (let i = 0; i < sN; i++) {
      const s = sLo + ((sHi - sLo) * i) / (sN - 1);
      const lp = Math.log(t4((s - s0) / escala));
      for (let j = 0; j < bN; j++) {
        const b = bLo + ((bHi - bLo) * j) / (bN - 1);
        let ll = lp - (b * b) / (2 * P.sigmaB ** 2);
        if (regs.length) for (const R of regs) R.S = 0;
        for (const x of obs) { const d = x.p - x.base - s - (1 - x.f) * b; ll -= (d * d) / (2 * x.varD); if (x.R) x.R.S += (x.c * d) / x.varD; }
        for (const R of regs) ll += (R.S * R.S) / (2 * R.prec);
        out.push([s, b, ll]);
        if (ll > mx) mx = ll;
      }
    }
    return { out, mx };
  };
  const gs = G.coarse;
  const g1 = grade(s0 - G.sHalf, s0 + G.sHalf, gs[0], -G.bHalf, G.bHalf, gs[1]);
  const ds = (2 * G.sHalf) / (gs[0] - 1), db = (2 * G.bHalf) / (gs[1] - 1);
  let sLo = Infinity, sHi = -Infinity, bLo = Infinity, bHi = -Infinity;
  for (const [s, b, ll] of g1.out) if (ll > g1.mx - 25) { sLo = Math.min(sLo, s); sHi = Math.max(sHi, s); bLo = Math.min(bLo, b); bHi = Math.max(bHi, b); }
  const { out: cells, mx: maxL } = grade(sLo - ds, sHi + ds, G.fine[0], bLo - db, bHi + db, G.fine[1]);
  // cada ponto da grade representa uma faixa de s: soma a variância de uma uniforme do tamanho do passo,
  // para a mistura ficar contínua mesmo com poucos pontos (sem isso a probabilidade fica "em degraus")
  const passoS = (sHi - sLo + 2 * ds) / (G.fine[0] - 1);
  const varPasso = (passoS * passoS) / 12;
  // normaliza e descarta o que não pesa nada
  let Z = 0;
  const live = [];
  for (const c of cells) { const w = Math.exp(c[2] - maxL); if (w > 1e-10) { live.push([c[0], c[1], w]); Z += w; } }
  // ---- para cada célula: nacional ~ N(m, v); estados ~ N(mu, var)
  const kMed = ufs.reduce((a, x) => a + x.w * x.k, 0); // quanto o nacional ainda depende de s
  const mix = live.map(([s, b, w]) => {
    let m = 0, v = vRegNat;
    if (regs.length) { somarReg(s, b); for (const R of regs) R.m = R.S / R.prec; }
    for (const x of ufs) {
      const d = x.has ? x.p - x.base - s - (1 - x.f) * b : 0;
      const mu = x.base + s + x.k * d + (x.R ? (1 - x.k) * x.c * x.R.m : 0);
      const va = x.se2 * (1 - x.k);
      m += x.w * mu; v += x.w * x.w * va;
    }
    return { w: w / Z, s, b, m, sd: Math.sqrt(Math.max(v + varPasso * (1 - kMed) ** 2, 1e-12)), mr: regs.map((R) => R.m) };
  });
  const cdf = (y) => mix.reduce((acc, c) => acc + c.w * normCdf((y - c.m) / c.sd), 0);
  const quant = (q) => { let lo = 0, hi = 100; for (let it = 0; it < 50; it++) { const mid = (lo + hi) / 2; if (cdf(mid) < q) lo = mid; else hi = mid; } return (lo + hi) / 2; };
  const media = mix.reduce((a, c) => a + c.w * c.m, 0);
  const pA = 1 - cdf(50);
  const sPost = mix.reduce((a, c) => a + c.w * c.s, 0), bPost = mix.reduce((a, c) => a + c.w * c.b, 0);
  const sSd = Math.sqrt(mix.reduce((a, c) => a + c.w * (c.s - sPost) ** 2, 0));
  // estado a estado (média e intervalo aproximado pela variância total)
  const porUF = ufs.map((x) => {
    let m1 = 0, m2 = 0;
    const iR = x.R ? regs.indexOf(x.R) : -1;
    const vR = x.R ? ((1 - x.k) * x.c) ** 2 / x.R.prec : 0;
    for (const c of mix) {
      const d = x.has ? x.p - x.base - c.s - (1 - x.f) * c.b : 0;
      const mu = x.base + c.s + x.k * d + (iR >= 0 ? (1 - x.k) * x.c * c.mr[iR] : 0);
      const va = x.se2 * (1 - x.k) + vR;
      m1 += c.w * mu; m2 += c.w * (va + mu * mu);
    }
    const sd = Math.sqrt(Math.max(0, m2 - m1 * m1));
    return { uf: x.uf, f: x.f, parcial: x.p, k: x.k, final: m1, sd, lo80: m1 - 1.2816 * sd, hi80: m1 + 1.2816 * sd, lo95: m1 - 1.96 * sd, hi95: m1 + 1.96 * sd, V: x.V };
  });
  return {
    A: { media, lo80: quant(0.1), hi80: quant(0.9), lo95: quant(0.025), hi95: quant(0.975), pVence: pA, qs: P.quantis?.map(quant) },
    B: { media: 100 - media, lo80: 100 - quant(0.9), hi80: 100 - quant(0.1), lo95: 100 - quant(0.975), hi95: 100 - quant(0.025), pVence: 1 - pA },
    s0, baseNat, sPost, sSd, bPost, porUF, celulas: mix.length,
  };
}

// ----------------------------------------------------------------------------- motor 2 (?motor=2)
// Igual ao modelo acima, mais três peças, todas lineares e normais (a conta continua exata e simétrica):
//   F_uf = base'_uf + s + a_uf·τ + c·r_região + ε_uf
//   base' = base·(1−o) + 50·o: o 2º turno parte do 1º com os votos dos outros candidatos (fatia o) divididos ao meio;
//   τ ~ N(0, σt): quanto desses votos vai mais para um lado; a_uf = 100·(o_uf − ō) é centrado no nacional,
//     então τ só redistribui entre estados e não mexe na previsão das pesquisas;
//   r_região ~ N(0, σr), com σr incerto: a grade P.sigmaRs é ponderada pela própria apuração (verossimilhança
//     marginal, com o termo de determinante), então a faixa abre se as regiões se movem juntas e fecha se não;
//   comparecimento: válidos contados ÷ esperados nos estados já apurados corrigem os que faltam na mesma região.
// Dado (s, b, σr), o vetor (τ, r_1..r_n) é normal; a precisão tem forma de "seta" (τ ligado a todas as regiões),
// resolvida pelo complemento de Schur: nada depende de (s, b) a não ser as médias.
export const PARAMS_M2 = {
  // τ e a mistura 50/50 ficam desligados: pioraram 2014 e 2018 no teste peça por peça (testes/rodada2.md)
  ...PARAMS, versao: 2, sigmaT: 0, misturaOutros: false, sigmaRs: [0, 0.75, 1.5], encolheComp: 0.3,
  grid: { sHalf: 18, bHalf: 10, coarse: [73, 21], fine: [91, 25] },
};

export function projetar2(estados, parciais, alvo, P = PARAMS_M2) {
  const comO = estados.every((e) => Number.isFinite(e.outros));
  // comparecimento por região: razão válidos contados ÷ esperados, encolhida para 1 quando há pouco apurado
  const rho = {};
  if (P.encolheComp) {
    const g = {};
    for (const e of estados) {
      const q = parciais[e.uf] || {}, f = Math.min(1, Math.max(0, q.f || 0)), R = e.regiao ?? e.uf;
      g[R] ??= { num: 0, den: 0, tot: 0 };
      g[R].tot += e.Vesp;
      if (f > 0 && q.vv > 0) { g[R].num += q.vv; g[R].den += f * e.Vesp; }
    }
    for (const [R, x] of Object.entries(g)) { const F = x.den / x.tot; rho[R] = x.den > 0 ? 1 + (x.num / x.den - 1) * (F / (F + P.encolheComp)) : 1; }
  }
  const ufs = estados.map((e) => {
    const q = parciais[e.uf] || {};
    const f = Math.min(1, Math.max(0, q.f || 0));
    const has = f > 0 && Number.isFinite(q.p);
    const reg = e.regiao ?? e.uf;
    const V = (q.vv || 0) + (1 - f) * e.Vesp * (rho[reg] ?? 1);
    const varD = P.sigmaEps ** 2 + Math.pow(1 - f, 2 * P.gamma) * P.sigmaU ** 2;
    const k = has ? P.sigmaEps ** 2 / varD : 0;
    const o = comO ? e.outros : 0;
    return { uf: e.uf, reg, base: P.misturaOutros === false ? e.base : e.base * (1 - o) + 50 * o, o, f, p: has ? q.p : null, has, V, varD, k, c: 1 };
  });
  const Vtot = ufs.reduce((s, x) => s + x.V, 0);
  for (const x of ufs) x.w = x.V / Vtot;
  const oNat = ufs.reduce((s, x) => s + x.w * x.o, 0);
  const usaT = comO && P.sigmaT > 0;
  for (const x of ufs) x.a = usaT ? 100 * (x.o - oNat) : 0;
  const baseNat = ufs.reduce((s, x) => s + x.w * x.base, 0);
  const s0 = alvo.centro - baseNat;
  const escala = alvo.meio90 / P.t90;
  const obs = ufs.filter((x) => x.has);
  const nomesReg = [...new Set(ufs.map((x) => x.reg))];
  const iReg = Object.fromEntries(nomesReg.map((r, i) => [r, i]));
  for (const x of ufs) x.ir = iReg[x.reg];
  const nR = nomesReg.length;

  // estruturas que não dependem de (s, b): uma por valor de σr
  const H = P.sigmaRs.map((sr) => {
    const LRR = new Float64Array(nR), LtR = new Float64Array(nR);
    let Ltt = usaT ? 1 / P.sigmaT ** 2 : 0;
    for (let i = 0; i < nR; i++) LRR[i] = sr > 0 ? 1 / sr ** 2 : 0;
    for (const x of obs) { if (sr > 0) { LRR[x.ir] += 1 / x.varD; LtR[x.ir] += x.a / x.varD; } if (usaT) Ltt += (x.a * x.a) / x.varD; }
    const alfa = new Float64Array(nR);
    let LttS = Ltt;
    if (sr > 0) for (let i = 0; i < nR; i++) { alfa[i] = LtR[i] / LRR[i]; LttS -= LtR[i] * alfa[i]; }
    const Vt = usaT ? 1 / LttS : 0;
    // log|Σθ| + log|Λ| (lema do determinante): entra na verossimilhança marginal de cada σr
    let logdet = 0;
    if (usaT) logdet += Math.log(P.sigmaT ** 2) + Math.log(LttS);
    if (sr > 0) for (let i = 0; i < nR; i++) logdet += Math.log(sr ** 2) + Math.log(LRR[i]);
    // variância que sobra no nacional e em cada estado por causa de (τ, r)
    let gT = 0; const gR = new Float64Array(nR);
    for (const x of ufs) { gT += x.w * (1 - x.k) * x.a; gR[x.ir] += x.w * (1 - x.k); }
    let coefT = gT, vNat = 0;
    if (sr > 0) for (let i = 0; i < nR; i++) { coefT -= gR[i] * alfa[i]; vNat += (gR[i] * gR[i]) / LRR[i]; }
    vNat += coefT * coefT * Vt;
    const vUF = ufs.map((x) => (1 - x.k) ** 2 * ((x.a - (sr > 0 ? alfa[x.ir] : 0)) ** 2 * Vt + (sr > 0 ? 1 / LRR[x.ir] : 0)));
    return { sr, LRR, LtR, LttS, alfa, Vt, cte: -0.5 * logdet, vNat, vUF, hR: new Float64Array(nR) };
  });

  // dado (s, b) e um σr: médias de τ e r e o acréscimo na log-verossimilhança
  const latente = (h, s, b) => {
    const hR = h.hR; hR.fill(0);
    let hT = 0, ll = 0;
    for (const x of obs) { const d = x.p - x.base - s - (1 - x.f) * b; ll -= (d * d) / (2 * x.varD); hT += (x.a * d) / x.varD; if (h.sr > 0) hR[x.ir] += d / x.varD; }
    let hTS = hT;
    if (h.sr > 0) for (let i = 0; i < nR; i++) hTS -= h.alfa[i] * hR[i];
    const mT = usaT ? hTS / h.LttS : 0;
    if (usaT) ll += (hTS * hTS) / (2 * h.LttS);
    if (h.sr > 0) for (let i = 0; i < nR; i++) ll += (hR[i] * hR[i]) / (2 * h.LRR[i]);
    return { ll: ll + h.cte, mT };
  };
  const mediasR = (h, mT) => { const m = new Float64Array(nR); if (h.sr > 0) for (let i = 0; i < nR; i++) m[i] = (h.hR[i] - h.LtR[i] * mT) / h.LRR[i]; return m; };

  const G = P.grid;
  const grade = (sLo, sHi, sN, bLo, bHi, bN, guardar) => {
    const out = [];
    let mx = -Infinity;
    for (let i = 0; i < sN; i++) {
      const s = sLo + ((sHi - sLo) * i) / (sN - 1);
      const lp = Math.log(t4((s - s0) / escala));
      for (let j = 0; j < bN; j++) {
        const b = bLo + ((bHi - bLo) * j) / (bN - 1);
        const lb = lp - (b * b) / (2 * P.sigmaB ** 2);
        for (let hi = 0; hi < H.length; hi++) {
          const L = latente(H[hi], s, b);
          const ll = lb + L.ll;
          if (guardar) out.push({ s, b, hi, ll, mT: L.mT, mR: mediasR(H[hi], L.mT) });
          else out.push({ s, b, ll });
          if (ll > mx) mx = ll;
        }
      }
    }
    return { out, mx };
  };
  const g1 = grade(s0 - G.sHalf, s0 + G.sHalf, G.coarse[0], -G.bHalf, G.bHalf, G.coarse[1], false);
  const ds = (2 * G.sHalf) / (G.coarse[0] - 1), db = (2 * G.bHalf) / (G.coarse[1] - 1);
  let sLo = Infinity, sHi = -Infinity, bLo = Infinity, bHi = -Infinity;
  for (const c of g1.out) if (c.ll > g1.mx - 25) { sLo = Math.min(sLo, c.s); sHi = Math.max(sHi, c.s); bLo = Math.min(bLo, c.b); bHi = Math.max(bHi, c.b); }
  const { out: cells, mx: maxL } = grade(sLo - ds, sHi + ds, G.fine[0], bLo - db, bHi + db, G.fine[1], true);
  const passoS = (sHi - sLo + 2 * ds) / (G.fine[0] - 1);
  const varPasso = (passoS * passoS) / 12;
  let Z = 0;
  const live = [];
  for (const c of cells) { const w = Math.exp(c.ll - maxL); if (w > 1e-10) { c.w = w; live.push(c); Z += w; } }
  const kMed = ufs.reduce((a, x) => a + x.w * x.k, 0);
  const muUF = (x, c) => { const d = x.has ? x.p - x.base - c.s - (1 - x.f) * c.b : 0; return x.base + c.s + x.k * d + (1 - x.k) * (x.a * c.mT + c.mR[x.ir]); };
  const mix = live.map((c) => {
    let m = 0, v = H[c.hi].vNat;
    for (const x of ufs) { m += x.w * muUF(x, c); v += x.w * x.w * P.sigmaEps ** 2 * (1 - x.k); }
    return { w: c.w / Z, s: c.s, b: c.b, m, sd: Math.sqrt(Math.max(v + varPasso * (1 - kMed) ** 2, 1e-12)), c };
  });
  const cdf = (y) => mix.reduce((acc, c) => acc + c.w * normCdf((y - c.m) / c.sd), 0);
  const quant = (q) => { let lo = 0, hi = 100; for (let it = 0; it < 50; it++) { const mid = (lo + hi) / 2; if (cdf(mid) < q) lo = mid; else hi = mid; } return (lo + hi) / 2; };
  const media = mix.reduce((a, c) => a + c.w * c.m, 0);
  const pA = 1 - cdf(50);
  const sPost = mix.reduce((a, c) => a + c.w * c.s, 0), bPost = mix.reduce((a, c) => a + c.w * c.b, 0);
  const sSd = Math.sqrt(mix.reduce((a, c) => a + c.w * (c.s - sPost) ** 2, 0));
  const pesoSigmaR = H.map((h, i) => mix.reduce((a, c) => a + (c.c.hi === i ? c.w : 0), 0));
  const porUF = ufs.map((x, j) => {
    let m1 = 0, m2 = 0;
    for (const c of mix) { const mu = muUF(x, c.c); const va = P.sigmaEps ** 2 * (1 - x.k) + H[c.c.hi].vUF[j]; m1 += c.w * mu; m2 += c.w * (va + mu * mu); }
    const sd = Math.sqrt(Math.max(0, m2 - m1 * m1));
    return { uf: x.uf, f: x.f, parcial: x.p, k: x.k, final: m1, sd, lo80: m1 - 1.2816 * sd, hi80: m1 + 1.2816 * sd, lo95: m1 - 1.96 * sd, hi95: m1 + 1.96 * sd, V: x.V };
  });
  return {
    A: { media, lo80: quant(0.1), hi80: quant(0.9), lo95: quant(0.025), hi95: quant(0.975), pVence: pA, qs: P.quantis?.map(quant) },
    B: { media: 100 - media, lo80: 100 - quant(0.9), hi80: 100 - quant(0.1), lo95: 100 - quant(0.975), hi95: 100 - quant(0.025), pVence: 1 - pA },
    s0, baseNat, sPost, sSd, bPost, porUF, celulas: mix.length, pesoSigmaR: Object.fromEntries(H.map((h, i) => [h.sr, pesoSigmaR[i]])),
  };
}

// Rótulo simétrico a partir da probabilidade do candidato à frente (convenção de exibição).
export function rotulo(pA, definido) {
  if (definido) return { quem: definido, texto: "definido matematicamente" };
  const p = Math.max(pA, 1 - pA), quem = pA >= 0.5 ? "A" : "B";
  if (p < 0.55) return { quem: null, texto: "indefinido" };
  if (p < 0.7) return { quem, texto: "levemente favorável" };
  if (p < 0.9) return { quem, texto: "favorável" };
  return { quem, texto: "muito favorável" };
}

// "Definido matematicamente": a diferença já contada é maior que todos os eleitores que ainda faltam totalizar.
export function definido(parciais) {
  let A = 0, B = 0, falta = 0;
  for (const q of Object.values(parciais)) { A += q.A || 0; B += q.B || 0; falta += q.restantes ?? Infinity; }
  if (!Number.isFinite(falta)) return null;
  if (A - B > falta) return "A";
  if (B - A > falta) return "B";
  return null;
}

// Checagem simples (5.3): parcial esperada nacional = alvo + Δ(X), com as duas curvas medidas.
// Δ em pontos da fatia do candidato da esquerda (Lula) nos votos dos dois; X em % de seções.
export const CURVAS = {
  "1º turno 2026": [[0, -2.8], [1.5, -2.82], [7.6, -4.27], [21.96, -4.56], [41, -3.87], [64.81, -2.98], [84.96, -1.69], [90.61, -1.16], [96.44, -0.57], [99.69, -0.08], [100, 0]],
  "2º turno 2022": [[0, -2.6], [15.34, -2.58], [50.9, -1.2], [67.76, -0.89], [98.91, -0.07], [100, 0]],
};
export function delta(curva, X) {
  const c = CURVAS[curva];
  for (let i = 1; i < c.length; i++) if (X <= c[i][0]) { const [x0, y0] = c[i - 1], [x1, y1] = c[i]; return y0 + ((y1 - y0) * (X - x0)) / (x1 - x0); }
  return 0;
}
