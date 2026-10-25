// Apuração sintética: respeita a ordem por estado medida às 17h52 do 1º turno de 2026 e a curva nacional de
// % de seções daquela noite. Serve para o modo --simulado e para os testes da seção 6.

// % de seções totalizadas no país ao longo do 1º turno de 2026 (seção 4 do prompt). Minutos desde 17h00.
export const CURVA_NACIONAL = [[0, 0], [27, 1.5], [52, 7.6], [76, 21.96], [110, 41], [126, 64.81], [165, 84.96], [191, 88.46], [201, 90.61], [221, 92.58], [235, 96.44], [252, 98.97], [270, 99.37], [292, 99.69], [351, 99.95], [400, 100]];
// a mesma noite, em votos de dois candidatos (Lula ÷ (Lula + Flávio)), a partir da tabela do prompt
export const LINHA_1T26 = [[27, 1.5, 49.2, 42.2], [52, 7.6, 50.7, 41.0], [76, 21.96, 51.07, 40.82], [110, 41, 50.41, 41.44], [126, 64.81, 49.58, 42.25], [165, 84.96, 48.47, 43.49], [191, 88.46, 48.19, 43.8], [201, 90.61, 48.02, 44.01], [221, 92.58, 47.84, 44.2], [235, 96.44, 47.51, 44.59], [252, 98.97, 47.22, 44.94], [270, 99.37, 47.15, 45.01], [292, 99.69, 47.1, 45.08], [351, 99.95, 47.04, 45.15]].map(([min, X, F, L]) => ({ min, X, lula2c: (100 * L) / (L + F) }));

const interp = (tab, x) => {
  if (x <= tab[0][0]) return tab[0][1];
  for (let i = 1; i < tab.length; i++) if (x <= tab[i][0]) { const [x0, y0] = tab[i - 1], [x1, y1] = tab[i]; return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0); }
  return tab[tab.length - 1][1];
};
export const gNacional = (min) => interp(CURVA_NACIONAL, min) / 100;
// inverso: em que minuto a curva nacional chega a uma fração
const gInv = (frac) => { let lo = 0, hi = 400; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (gNacional(m) < frac) lo = m; else hi = m; } return (lo + hi) / 2; };

// gerador de números pseudoaleatórios com semente (Mulberry32) e normal de Box-Muller
export function rng(seed = 1) {
  let a = seed >>> 0;
  const u = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return { u, n: () => Math.sqrt(-2 * Math.log(u() + 1e-12)) * Math.cos(2 * Math.PI * u()) };
}

// ----------------------------------------------------------------------------- cenários de resultado final
// Cada cenário tem um espelho (o mesmo efeito a favor do outro candidato, ou a região oposta) e os dois têm a
// mesma chance de sair no "aleatório"; "Sem surpresa" e "Empate" são espelhos de si mesmos.
// regiao: deslocamento extra em logit (+ = Lula); validos: variação extra dos votos válidos da região (− = mais abstenção).
// 0,12 em logit é o tamanho dos deslocamentos regionais de 2014 e 2018; 3% de válidos é próximo do maior visto (Norte, 2014 e 2018).
export const CENARIOS = [
  { id: "normal", nome: "Sem surpresa" },
  { id: "empate", nome: "Empate técnico", empate: true },
  { id: "abstSul", par: "abstNE", nome: "Mais abstenção no Sul, menos no Nordeste", validos: { Sul: -0.03, Nordeste: 0.03 } },
  { id: "abstNE", par: "abstSul", nome: "Mais abstenção no Nordeste, menos no Sul", validos: { Nordeste: -0.03, Sul: 0.03 } },
  { id: "pesqA", par: "pesqB", nome: "Pesquisas subestimam Lula em 3 pontos", erro: 3 },
  { id: "pesqB", par: "pesqA", nome: "Pesquisas subestimam Flávio em 3 pontos", erro: -3 },
  { id: "neA", par: "neB", nome: "Nordeste vai mais para Lula do que no 1º turno", regiao: { Nordeste: 0.12 } },
  { id: "neB", par: "neA", nome: "Nordeste vai mais para Flávio do que no 1º turno", regiao: { Nordeste: -0.12 } },
  { id: "seA", par: "seB", nome: "Sudeste vai mais para Lula do que no 1º turno", regiao: { Sudeste: 0.12 } },
  { id: "seB", par: "seA", nome: "Sudeste vai mais para Flávio do que no 1º turno", regiao: { Sudeste: -0.12 } },
];
export const MARGEM_LIMITE = 5; // pontos além do mínimo e do máximo históricos de cada estado

const logit = (p) => Math.log(p / (1 - p));
const expit = (x) => 1 / (1 + Math.exp(-x));

// Sorteia o resultado final de cada estado num cenário.
// estados: [{ uf, regiao, base (% de Lula nos 2 candidatos, 1º turno de 2026), Vesp }]
// hist: dados/historico.json (calibragem e limites); centro: % nacional de Lula na previsão escolhida
// Passos: (1) alvo nacional = previsão + erro das pesquisas (±1,5); (2) desvios de região e de estado, em logit e nos
// válidos, do tamanho medido no TSE; (3) um deslocamento nacional único, achado para bater o alvo; (4) o efeito do
// cenário por cima (ele move o nacional); (5) estado fora dos limites históricos ± 5 pontos tem o desvio sorteado de novo.
export function cenario(estados, hist, R, { centro, id = "aleatorio" }) {
  const C = id === "aleatorio" ? CENARIOS[Math.floor(R.u() * CENARIOS.length)] : CENARIOS.find((c) => c.id === id);
  const { sigRegiao, sigEstado, sigRegiaoValidos, sigEstadoValidos } = hist.calib;
  const alvo = C.empate ? 50 + R.n() * 0.3 : centro + (C.erro ?? 0) + R.n() * 1.5;
  const regioes = [...new Set(estados.map((e) => e.regiao))];
  const dReg = Object.fromEntries(regioes.map((r) => [r, R.n() * sigRegiao]));
  const tReg = Object.fromEntries(regioes.map((r) => [r, R.n() * sigRegiaoValidos]));
  const dUF = {}, V = {};
  for (const e of estados) { dUF[e.uf] = R.n() * sigEstado; V[e.uf] = Math.round(e.Vesp * Math.exp(tReg[e.regiao] + R.n() * sigEstadoValidos)); }
  const lim = Object.fromEntries(estados.map((e) => { const h = hist.porUF[e.uf]; return [e.uf, [Math.max(0.5, h.min - MARGEM_LIMITE), Math.min(99.5, h.max + MARGEM_LIMITE)]]; }));
  const xBase = (e) => logit(e.base / 100) + dReg[e.regiao] + dUF[e.uf];
  const nac = (c) => { let a = 0, v = 0; for (const e of estados) { a += V[e.uf] * expit(xBase(e) + c); v += V[e.uf]; } return (100 * a) / v; };
  let final = {}, resorteios = 0, cortados = 0;
  for (let volta = 0; ; volta++) {
    let lo = -4, hi = 4;
    for (let i = 0; i < 50; i++) { const m = (lo + hi) / 2; if (nac(m) < alvo) lo = m; else hi = m; }
    const c = (lo + hi) / 2;
    const Vf = {};
    for (const e of estados) {
      final[e.uf] = 100 * expit(xBase(e) + c + (C.regiao?.[e.regiao] ?? 0));
      Vf[e.uf] = Math.round(V[e.uf] * (1 + (C.validos?.[e.regiao] ?? 0)));
    }
    const fora = estados.filter((e) => final[e.uf] < lim[e.uf][0] || final[e.uf] > lim[e.uf][1]);
    if (!fora.length || volta === 30) {
      // se o alvo pedido é extremo demais para o histórico, o que sobrar é cortado no limite (e contado)
      for (const e of fora) { final[e.uf] = Math.min(lim[e.uf][1], Math.max(lim[e.uf][0], final[e.uf])); cortados++; }
      Object.assign(V, Vf);
      break;
    }
    for (const e of fora) { dUF[e.uf] = R.n() * sigEstado; resorteios++; }
  }
  const W = estados.reduce((s, e) => s + V[e.uf], 0);
  const nacional = estados.reduce((s, e) => s + V[e.uf] * final[e.uf], 0) / W;
  return { id: C.id, nome: C.nome, alvo, nacional, final, V, lim, resorteios, cortados };
}

// estados: [{ uf, apurado1752 (%), V (válidos que terá), final (% de A), u (ruído da parcial do estado) }]
// b: viés comum de ordem; gamma: como o ruído cai com f
export function apuracao(estados, { b = 0, gamma = 0.8, apuradoNacional1752 = 9.08 } = {}) {
  // cada estado segue a curva nacional deslocada no tempo, para bater o % que tinha às 17h52
  const m1752 = gInv(apuradoNacional1752 / 100);
  const desloc = Object.fromEntries(estados.map((e) => [e.uf, gInv(Math.max(0.001, e.apurado1752 / 100)) - m1752]));
  return (min) => {
    const out = {};
    for (const e of estados) {
      const f = Math.min(1, gNacional(min + desloc[e.uf]));
      const p = Math.min(99.9, Math.max(0.1, e.final + (1 - f) * b + Math.pow(1 - f, gamma) * e.u));
      const vv = Math.round(f * e.V);
      const A = Math.round((vv * p) / 100);
      out[e.uf] = { f, p: vv > 0 ? (100 * A) / vv : null, A, B: vv - A, vv, restantes: Math.round(((1 - f) * e.V) / 0.75) };
    }
    return out;
  };
}

export function nacional(parciais) {
  let A = 0, B = 0, vv = 0, V = 0;
  for (const q of Object.values(parciais)) { A += q.A; B += q.B; vv += q.vv; }
  void V;
  return { A, B, vv, p: A + B ? (100 * A) / (A + B) : null };
}
