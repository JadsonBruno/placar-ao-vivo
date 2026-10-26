// Reconstrói a apuração real de uma eleição passada, estado por estado, a partir do boletim de urna do TSE
// (dados abertos, bweb_*): cada seção entra na parcial no instante DT_BU_RECEBIDO (horário de Brasília).
// Saída: dados/parciais-<nome>.json com, por estado e a cada 5 minutos desde as 17h, as seções recebidas e os votos
// de 13 e do adversário acumulados, e o total final. Rodar: node scripts/montar-parciais-bu.mjs <pasta-dos-zips> <nome> <adversário> <dd/mm/aaaa>
import { spawn } from "node:child_process";
import { readdirSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const [pasta, nome, rival = "22", dia] = process.argv.slice(2);
const PASSO = 5, FIM = 600; // minutos depois das 17h00 de Brasília, de 5 em 5, até 03h00
const [d0, m0, a0] = dia.split("/").map(Number);
const inicio = Date.UTC(a0, m0 - 1, d0, 17 + 3, 0, 0); // 17h00 BRT = 20h00 UTC
// aceita "dd/mm/aaaa hh:mm:ss" (até 2022) e "aaaa-mm-dd hh:mm:ss" (2026)
const minuto = (s) => {
  let m = /(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2}):(\d{2})/.exec(s), d;
  if (m) d = [+m[3], +m[2], +m[1], +m[4], +m[5], +m[6]];
  else if ((m = /(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})/.exec(s))) d = m.slice(1).map(Number);
  return d ? (Date.UTC(d[0], d[1] - 1, d[2], d[3] + 3, d[4], d[5]) - inicio) / 60000 : null;
};

async function lerUF(zip) {
  const secoes = new Map(); // seção -> { t, A, B }
  const p = spawn("unzip", ["-p", zip, "*.csv"]);
  const rl = createInterface({ input: p.stdout.setEncoding("latin1"), crlfDelay: Infinity });
  let cab = null, iCargo, iT, iNum, iQt, iMun, iZona, iSec, iUF, uf = null;
  for await (const linha of rl) {
    const v = linha.split(";").map((c) => c.replace(/^"|"$/g, ""));
    if (!cab) { cab = v; [iCargo, iT, iNum, iQt, iMun, iZona, iSec, iUF] = ["DS_CARGO_PERGUNTA", "DT_BU_RECEBIDO", "NR_VOTAVEL", "QT_VOTOS", "CD_MUNICIPIO", "NR_ZONA", "NR_SECAO", "SG_UF"].map((k) => cab.indexOf(k)); continue; }
    if (v[iCargo] !== "Presidente") continue;
    uf ??= v[iUF];
    const k = `${v[iMun]}|${v[iZona]}|${v[iSec]}`;
    let s = secoes.get(k);
    if (!s) { s = { t: minuto(v[iT]), A: 0, B: 0 }; secoes.set(k, s); }
    if (v[iNum] === "13") s.A += +v[iQt];
    else if (v[iNum] === rival) s.B += +v[iQt];
  }
  const n = Math.ceil(FIM / PASSO) + 1, sec = new Array(n).fill(0), A = new Array(n).fill(0), B = new Array(n).fill(0);
  let fA = 0, fB = 0, semHora = 0;
  for (const s of secoes.values()) {
    fA += s.A; fB += s.B;
    if (s.t === null) { semHora++; continue; }
    for (let i = Math.max(0, Math.ceil(s.t / PASSO)); i < n; i++) { sec[i]++; A[i] += s.A; B[i] += s.B; }
  }
  return { uf, secoes: secoes.size, semHora, final: { A: fA, B: fB }, sec, A, B };
}

const zips = readdirSync(pasta).filter((f) => f.endsWith(".zip")).sort();
const out = { fonte: `TSE, boletim de urna (bweb), ${nome}; parcial = seções com DT_BU_RECEBIDO até o instante`, passoMin: PASSO, inicio: "17h00 de Brasília", ufs: {} };
for (const z of zips) {
  const r = await lerUF(join(pasta, z));
  out.ufs[r.uf] = r;
  const i60 = 60 / PASSO;
  console.log(`${r.uf}: ${r.secoes} seções, sem hora ${r.semHora}; 13 ${r.final.A} × ${rival} ${r.final.B}; às 18h ${((100 * r.sec[i60]) / r.secoes).toFixed(1)}% recebido`);
}
const tA = Object.values(out.ufs).reduce((s, u) => s + u.final.A, 0), tB = Object.values(out.ufs).reduce((s, u) => s + u.final.B, 0);
console.log(`total: 13 ${tA} × ${rival} ${tB}`);
writeFileSync(join(ROOT, `dados/parciais-${nome}.json`), JSON.stringify(out));
