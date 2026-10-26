// Reprise da apuração do 2º turno de 25/10/2026, para a página e para os testes.
// Oficial: o total nacional minuto a minuto (dados/apuracao-2026-2t-nacional.json, lido do TSE durante a noite) e o
// resultado final de cada estado (dados/final-2026-2t.json). Estimado: o caminho de cada estado. Vem do boletim de urna
// oficial do 1º turno de 2026 (dados/parciais-2026-1t.json): em que ordem cada estado chega quando o país está em X%, e
// quanto a parcial do estado se afasta do final dele nessa altura. Um ajuste comum por instante faz a soma dos
// estados bater com a parcial nacional oficial daquele instante.
// Quando o TSE publicar o boletim de urna do 2º turno, a reprise deve ser refeita com ele (scripts/montar-parciais-bu.mjs).
// Rodar: node scripts/montar-reprise-2026-2t.mjs  → dados/reprise-2026-2t.json e docs/reprise-2026-2t.json
import { copyFileSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const rd = (p) => JSON.parse(readFileSync(join(ROOT, p), "utf8"));
const NAC = rd("dados/apuracao-2026-2t-nacional.json"), FIN = rd("dados/final-2026-2t.json"), T1 = rd("dados/parciais-2026-1t.json");
const ufs = Object.keys(T1.ufs);
const n1 = T1.ufs.SP.sec.length, tot1 = ufs.reduce((s, u) => s + T1.ufs[u].secoes, 0);
// 1º turno: % nacional de seções e, por estado, f e desvio da parcial em cada instante
const X1 = Array.from({ length: n1 }, (_, i) => ufs.reduce((s, u) => s + T1.ufs[u].sec[i], 0) / tot1);
const fin1 = Object.fromEntries(ufs.map((u) => { const x = T1.ufs[u].final; return [u, (100 * x.A) / (x.A + x.B)]; }));
const em1 = (u, i) => { const x = T1.ufs[u], f = x.sec[i] / x.secoes, vv = x.A[i] + x.B[i]; return { f, dev: vv > 0 ? (100 * x.A[i]) / vv - fin1[u] : 0 }; };
// instante do 1º turno (fracionário) em que o país estava em X
const tau = (X) => { if (X <= X1[0]) return 0; for (let i = 1; i < n1; i++) if (X1[i] >= X) return i - 1 + (X - X1[i - 1]) / Math.max(1e-9, X1[i] - X1[i - 1]); return n1 - 1; };
const interp = (u, t) => { const i = Math.floor(t), j = Math.min(n1 - 1, i + 1), w = t - i, a = em1(u, i), b = em1(u, j); return { f: a.f + w * (b.f - a.f), dev: a.dev + w * (b.dev - a.dev) }; };

const fin2 = Object.fromEntries(ufs.map((u) => [u, FIN.ufs[u]]));
const V2 = Object.fromEntries(ufs.map((u) => [u, fin2[u].A + fin2[u].B]));
const p2 = Object.fromEntries(ufs.map((u) => [u, (100 * fin2[u].A) / V2[u]]));
const quadros = [];
let ultimoX = -1;
for (const [t, Xp, pNac] of NAC.pontos) {
  if (Xp - ultimoX < 0.4 && Xp < 99.9) continue; // um quadro a cada ~0,4 ponto apurado
  ultimoX = Xp;
  const X = Xp / 100, tt = tau(X);
  const base = ufs.map((u) => { const e = interp(u, tt); return { u, f: Math.min(1, e.f), dev: e.dev }; });
  // ajuste comum c: Σ vv·(p2 + dev + c·(1−f)) / Σ vv = parcial nacional oficial
  let num = 0, den = 0, vvT = 0;
  for (const b of base) { const vv = b.f * V2[b.u]; num += vv * (p2[b.u] + b.dev); den += vv * (1 - b.f); vvT += vv; }
  const c = den > 0 ? (pNac * vvT - num) / den : 0;
  const q = {};
  for (const b of base) {
    const vv = Math.round(b.f * V2[b.u]);
    const p = Math.min(99, Math.max(1, p2[b.u] + b.dev + c * (1 - b.f)));
    const A = Math.round((vv * p) / 100);
    q[b.u] = [+b.f.toFixed(5), A, vv - A];
  }
  quadros.push({ t, X: Xp, p: pNac, c: +c.toFixed(3), q });
}
// quadro final: o resultado oficial
quadros.push({ t: NAC.pontos.at(-1)[0] + 60, X: 100, p: (100 * FIN.ufs.BR.A) / (FIN.ufs.BR.A + FIN.ufs.BR.B), c: 0, q: Object.fromEntries(ufs.map((u) => [u, [1, fin2[u].A, fin2[u].B]])) });
const out = {
  fonte: "Reprise de 25/10/2026. Oficial: total nacional minuto a minuto e resultado final por estado (TSE). Estimado: o caminho de cada estado, pelo boletim de urna do 1º turno de 2026.",
  final: { A: FIN.ufs.BR.A, B: FIN.ufs.BR.B }, ufs, quadros,
};
writeFileSync(join(ROOT, "dados/reprise-2026-2t.json"), JSON.stringify(out));
copyFileSync(join(ROOT, "dados/reprise-2026-2t.json"), join(ROOT, "docs/reprise-2026-2t.json"));
// conferência: a soma dos estados reproduz a parcial nacional oficial?
let maxDif = 0;
for (const fr of quadros) { let A = 0, B = 0; for (const u of ufs) { A += fr.q[u][1]; B += fr.q[u][2]; } maxDif = Math.max(maxDif, Math.abs((100 * A) / (A + B) - fr.p)); }
console.log(`${quadros.length} quadros; maior diferença entre a soma dos estados e a parcial nacional oficial: ${maxDif.toFixed(3)} ponto; ajuste comum de ${Math.min(...quadros.map((f) => f.c)).toFixed(2)} a ${Math.max(...quadros.map((f) => f.c)).toFixed(2)}`);
