// Copia o motor, o leitor do TSE, o simulador e os dados para docs/ (a página estática do GitHub Pages).
import { copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
for (const [de, para] of [["src/motor.mjs", "docs/motor.js"], ["src/tse.mjs", "docs/tse.js"], ["src/simulado.mjs", "docs/simulado.js"], ["dados/estados.json", "docs/estados.json"]]) copyFileSync(join(ROOT, de), join(ROOT, para));
console.log("docs/ atualizado");
