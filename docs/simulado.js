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
