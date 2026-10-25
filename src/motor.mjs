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

export const PARAMS = {
  sigmaEps: 0.65, // desvio próprio de cada estado (teste de 2022: erro médio 0,51 → dp ≈ 0,64)
  sigmaU: 4.5, // ruído da parcial dentro do estado (17h52 do 1º turno de 2026 + faixas do prompt)
  sigmaB: 2.0, // viés comum de ordem de apuração (testei 2, 3 e 4: 2 teve menor erro por estado e cobertura de 95% completa; ver README)
  gamma: 0.8, // como o ruído da parcial cai com f
  t90: 2.132, // quantil 95% da t(4): converte o intervalo de 90% das pesquisas em escala
  grid: { sHalf: 18, bHalf: 10, coarse: [145, 41], fine: [121, 31] }, // grade adaptativa: grossa para achar a massa, fina só ali
};

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
  const ufs = estados.map((e) => {
    const q = parciais[e.uf] || {};
    const f = Math.min(1, Math.max(0, q.f || 0));
    const has = f > 0 && Number.isFinite(q.p);
    const V = (q.vv || 0) + (1 - f) * e.Vesp; // válidos que o estado terá no fim
    const g2 = Math.pow(1 - f, 2 * P.gamma);
    const varD = P.sigmaEps ** 2 + g2 * P.sigmaU ** 2;
    const k = !has ? 0 : P.wFn ? P.wFn(f) : P.sigmaEps ** 2 / varD; // wFn: alternativa só para comparação nos testes
    return { uf: e.uf, base: e.base, f, p: has ? q.p : null, has, V, varD, k, vv: q.vv || 0, A: q.A || 0, B: q.B || 0 };
  });
  const Vtot = ufs.reduce((s, x) => s + x.V, 0);
  for (const x of ufs) x.w = x.V / Vtot;
  const baseNat = ufs.reduce((s, x) => s + x.w * x.base, 0);
  const s0 = alvo.centro - baseNat;
  const escala = alvo.meio90 / P.t90;
  const obs = ufs.filter((x) => x.has);

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
        for (const x of obs) { const d = x.p - x.base - s - (1 - x.f) * b; ll -= (d * d) / (2 * x.varD); }
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
    let m = 0, v = 0;
    for (const x of ufs) {
      const d = x.has ? x.p - x.base - s - (1 - x.f) * b : 0;
      const mu = x.base + s + x.k * d;
      const va = P.sigmaEps ** 2 * (1 - x.k);
      m += x.w * mu; v += x.w * x.w * va;
    }
    return { w: w / Z, s, b, m, sd: Math.sqrt(Math.max(v + varPasso * (1 - kMed) ** 2, 1e-12)) };
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
    for (const c of mix) {
      const d = x.has ? x.p - x.base - c.s - (1 - x.f) * c.b : 0;
      const mu = x.base + c.s + x.k * d;
      const va = P.sigmaEps ** 2 * (1 - x.k);
      m1 += c.w * mu; m2 += c.w * (va + mu * mu);
    }
    const sd = Math.sqrt(Math.max(0, m2 - m1 * m1));
    return { uf: x.uf, f: x.f, parcial: x.p, k: x.k, final: m1, sd, lo80: m1 - 1.2816 * sd, hi80: m1 + 1.2816 * sd, lo95: m1 - 1.96 * sd, hi95: m1 + 1.96 * sd, V: x.V };
  });
  return {
    A: { media, lo80: quant(0.1), hi80: quant(0.9), lo95: quant(0.025), hi95: quant(0.975), pVence: pA },
    B: { media: 100 - media, lo80: 100 - quant(0.9), hi80: 100 - quant(0.1), lo95: 100 - quant(0.975), hi95: 100 - quant(0.025), pVence: 1 - pA },
    s0, baseNat, sPost, sSd, bPost, porUF, celulas: mix.length,
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
