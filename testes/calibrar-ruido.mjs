// Calibra o ruído da parcial do motor (σu, γ, σb, σsec) por máxima verossimilhança numa apuração real reconstruída
// do boletim de urna. Modelo, por instante t e estado i: parcial − final = (1−f)·b_t + e_i,
//   e_i ~ N(0, (1−f)^(2γ)·σu² + σsec²·250/votos), b_t ~ N(0, σb²) comum a todos os estados naquele instante.
// O exterior fica de fora (apura por fuso). Rodar: node testes/calibrar-ruido.mjs [nome]   (padrão: 2022-1t, o treino)
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const nome = process.argv[2] || "2022-1t";
const D = JSON.parse(readFileSync(join(ROOT, `dados/parciais-${nome}.json`), "utf8"));
const ufs = Object.keys(D.ufs).filter((u) => u !== "ZZ");
const n = D.ufs.SP.sec.length;
// instantes a cada 10 minutos; em cada um, os estados com 0 < f < 1
const snaps = [];
for (let i = 0; i < n; i += 2) {
  const obs = [];
  for (const u of ufs) {
    const x = D.ufs[u], f = x.sec[i] / x.secoes, vv = x.A[i] + x.B[i];
    if (f <= 0 || f >= 0.999 || vv <= 0) continue;
    const fin = (100 * x.final.A) / (x.final.A + x.final.B);
    obs.push({ f, vv, d: (100 * x.A[i]) / vv - fin });
  }
  if (obs.length) snaps.push(obs);
}
function ll({ su, g, sb, ss, al = 1 }) {
  let L = 0;
  for (const obs of snaps) {
    // cov = diag(v) + σb²·h·hᵀ, h = 1−f: Sherman–Morrison para a inversa e o determinante
    let sDv = 0, sHd = 0, sHH = 0, logdet = 0;
    for (const o of obs) {
      const v = Math.pow(1 - o.f, 2 * g) * su * su + ss * ss * Math.pow(250 / o.vv, al), h = 1 - o.f; // al > 1: parciais com poucos votos erram desproporcionalmente mais
      sDv += (o.d * o.d) / v; sHd += (h * o.d) / v; sHH += (h * h) / v; logdet += Math.log(v);
    }
    const c = 1 + sb * sb * sHH;
    L += -0.5 * (sDv - (sb * sb * sHd * sHd) / c) - 0.5 * (logdet + Math.log(c));
  }
  return L;
}
let best = null;
for (const su of [2, 2.5, 3, 3.5, 4, 4.5, 5, 6]) for (const g of [0.6, 0.8, 1.0, 1.2, 1.5, 2.0]) for (const sb of [0.5, 1, 1.5, 2, 3, 4]) for (const ss of [0, 10, 20, 30, 40, 60, 80, 120]) for (const al of [1, 1.5, 2, 2.5, 3]) {
  const L = ll({ su, g, sb, ss, al });
  if (!best || L > best.L) best = { su, g, sb, ss, al, L };
}
console.log(`${nome}: ${snaps.length} instantes, ${snaps.reduce((s, o) => s + o.length, 0)} observações`);
console.log(`melhor: σu ${best.su}, γ ${best.g}, σb ${best.sb}, σsec ${best.ss}, expoente ${best.al} (log-verossimilhança ${best.L.toFixed(1)})`);
console.log(`motor atual (σu 4,5, γ 0,8, σb 2, σsec 0): ${ll({ su: 4.5, g: 0.8, sb: 2, ss: 0 }).toFixed(1)}`);
