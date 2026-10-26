// Grava o resultado oficial do 2º turno de 2026 por estado (arquivos do TSE) em dados/final-2026-2t.json.
// Rodar: node scripts/montar-final-2026-2t.mjs
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { lerArquivo, urlUF, UFS } from "../src/tse.mjs";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = { fonte: "TSE, arquivos de resultado do 2º turno (eleição 6258), lidos em 25/10/2026", ufs: {} };
for (const uf of ["br", ...UFS]) {
  const d = lerArquivo(await (await fetch(`${urlUF(uf, 6258)}?x=${Date.now()}`)).json(), uf, 6258);
  out.ufs[uf.toUpperCase()] = { A: d.A, B: d.B, f: d.f, gerado: d.gerado, secoes: d.secoes ?? null };
}
writeFileSync(join(ROOT, "dados/final-2026-2t.json"), JSON.stringify(out, null, 1));
const b = out.ufs.BR; console.log("BR", b.gerado, (100 * b.f).toFixed(2) + "%", "Lula", ((100 * b.A) / (b.A + b.B)).toFixed(3));
const soma = Object.entries(out.ufs).filter(([k]) => k !== "BR").reduce((s, [, u]) => [s[0] + u.A, s[1] + u.B], [0, 0]);
console.log("soma dos estados", soma, "nacional", b.A, b.B);
