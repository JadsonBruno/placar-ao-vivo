// Monta dados/estados.csv e dados/estados.json só a partir das fontes oficiais do TSE guardadas em fontes-tse/,
// e confere linha a linha contra a tabela que veio no prompt (dados/fornecido-no-prompt.csv).
// Rodar: node scripts/montar-dados.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const rd = (p) => readFileSync(join(ROOT, p), "utf8");

const NOMES = {
  AC: ["Acre", "Norte"], AL: ["Alagoas", "Nordeste"], AP: ["Amapá", "Norte"], AM: ["Amazonas", "Norte"], BA: ["Bahia", "Nordeste"],
  CE: ["Ceará", "Nordeste"], ES: ["Espírito Santo", "Sudeste"], DF: ["Distrito Federal", "Centro-Oeste"], GO: ["Goiás", "Centro-Oeste"],
  MA: ["Maranhão", "Nordeste"], MT: ["Mato Grosso", "Centro-Oeste"], MS: ["Mato Grosso do Sul", "Centro-Oeste"], MG: ["Minas Gerais", "Sudeste"],
  PA: ["Pará", "Norte"], PB: ["Paraíba", "Nordeste"], PR: ["Paraná", "Sul"], PE: ["Pernambuco", "Nordeste"], PI: ["Piauí", "Nordeste"],
  RJ: ["Rio de Janeiro", "Sudeste"], RN: ["Rio Grande do Norte", "Nordeste"], RS: ["Rio Grande do Sul", "Sul"], RO: ["Rondônia", "Norte"],
  RR: ["Roraima", "Norte"], SC: ["Santa Catarina", "Sul"], SP: ["São Paulo", "Sudeste"], SE: ["Sergipe", "Nordeste"], TO: ["Tocantins", "Norte"],
  ZZ: ["Exterior", "Exterior"],
};
// % de seções totalizadas às 17h52 do 1º turno de 2026 (Mix Vale, 04/10/2026; seção 4 do prompt)
const APURADO_1752 = { DF: 61.9, ZZ: 60.62, TO: 47.67, PB: 32.73, PR: 29.71, MS: 27.29, RO: 26.29, AC: 24.85, MT: 22.25, AM: 21.63, PA: 19.21, ES: 16.49, RS: 14.02, AP: 10.03, PI: 9.03, SC: 8.74, RN: 8.45, MA: 7.57, MG: 7.12, GO: 7.03, RR: 6.45, PE: 4.82, BA: 3.36, CE: 3.17, AL: 2.21, SE: 1.67, SP: 1.37, RJ: 1.24 };
// % dos votos válidos do candidato que liderava o estado às 17h52 (mesma fonte; o artigo só dá o do líder)
const LIDER_1752 = { AC: ["F", 63.07], AP: ["L", 54.06], AM: ["F", 50.83], PA: ["L", 47.47], RO: ["F", 60.78], RR: ["F", 65.81], TO: ["F", 49.96], AL: ["L", 56.33], BA: ["L", 64.52], CE: ["L", 61.18], MA: ["L", 61.1], PB: ["L", 60.39], PE: ["L", 62.15], PI: ["L", 67.55], RN: ["L", 61.35], SE: ["L", 57.13], DF: ["F", 51.13], GO: ["F", 57.17], MT: ["F", 64.34], MS: ["F", 59.62], ES: ["F", 56.95], MG: ["F", 48.49], RJ: ["F", 54.15], SP: ["F", 59.99], PR: ["F", 59.49], RS: ["F", 58.97], SC: ["F", 58.44], ZZ: ["L", 52.52] };

const t26 = JSON.parse(rd("fontes-tse/2026-1t/t1-2026-uf.json"));
const t22 = JSON.parse(rd("fontes-tse/2022-por-uf.json"));
const r3 = (x) => Math.round(x * 1000) / 1000;
const rows = Object.keys(NOMES).map((uf) => {
  const a = t26[uf.toLowerCase()], b = t22[uf];
  const base26 = (100 * a.lula) / (a.lula + a.flavio);
  const outros = 100 * (1 - (a.lula + a.flavio) / a.vv); // % dos válidos de outros candidatos no estado (final)
  // parcial das 17h52 em votos de 2 candidatos, estimada: o artigo só dá o % do líder; supomos que os
  // outros candidatos tinham na parcial o mesmo % que tiveram no final do estado (aproximação, ver README)
  const [quem, pct] = LIDER_1752[uf];
  const outro = 100 - pct - outros;
  const lulaP = quem === "L" ? pct : outro, flP = quem === "F" ? pct : outro;
  return {
    uf, nome: NOMES[uf][0], regiao: NOMES[uf][1],
    lula26_1t: a.lula, flavio26_1t: a.flavio, validos26_1t: a.vv, base26: r3(base26),
    validos26_2t_esp: Math.round(a.vv * (b[2].validos / b[1].validos)),
    lula22_2t: b[2].lula, bolso22_2t: b[2].bolso, lula22_2t_pct: Math.round((10000 * b[2].lula) / (b[2].lula + b[2].bolso)) / 100,
    lula22_1t: b[1].lula, bolso22_1t: b[1].bolso, validos22_1t: b[1].validos, validos22_2t: b[2].validos,
    apurado_17h52_1t26: APURADO_1752[uf], parcial2c_17h52_1t26: r3((100 * lulaP) / (lulaP + flP)),
  };
});
const cols = Object.keys(rows[0]);
writeFileSync(join(ROOT, "dados/estados.csv"), [cols.join(","), ...rows.map((r) => cols.map((c) => r[c]).join(","))].join("\n") + "\n");
writeFileSync(join(ROOT, "dados/estados.json"), JSON.stringify(rows, null, 1));

// conferências
const sum = (k) => rows.reduce((s, r) => s + r[k], 0);
const tot = { lula26: sum("lula26_1t"), flavio26: sum("flavio26_1t"), lula22_2t: sum("lula22_2t"), bolso22_2t: sum("bolso22_2t"), lula22_1t: sum("lula22_1t"), bolso22_1t: sum("bolso22_1t") };
const ESPERADO = { lula26: 53879538, flavio26: 56104503, lula22_2t: 60345999, bolso22_2t: 58206354, lula22_1t: 57259504, bolso22_1t: 51072345 };
for (const k in ESPERADO) console.log(`${k.padEnd(10)} ${tot[k]} ${tot[k] === ESPERADO[k] ? "ok" : "DIFERENTE de " + ESPERADO[k]}`);
const V = sum("validos26_2t_esp");
console.log("média nacional da base (ponderada pelos válidos esperados no 2º turno):", r3(rows.reduce((s, r) => s + r.base26 * r.validos26_2t_esp, 0) / V), "| prompt: 48,726");
// linha a linha contra o prompt
const given = rd("dados/fornecido-no-prompt.csv").trim().split("\n");
const gh = given[0].split(",");
let diffs = 0;
for (const line of given.slice(1)) {
  const g = Object.fromEntries(line.split(",").map((v, i) => [gh[i], v]));
  const r = rows.find((x) => x.uf === g.uf);
  for (const k of gh.slice(3)) {
    const a = Number(g[k]), b = r[k];
    const tol = ["base26", "lula22_2t_pct", "apurado_17h52_1t26"].includes(k) ? 0.006 : 0.5;
    if (Math.abs(a - b) > tol) { diffs++; console.log(`  ${g.uf} ${k}: prompt ${a} × TSE ${b}`); }
  }
}
console.log(diffs ? `${diffs} diferenças contra o prompt` : `as ${given.length - 1} linhas do prompt batem com o TSE`);
