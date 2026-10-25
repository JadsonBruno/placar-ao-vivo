// Servidor estático mínimo para testar docs/ localmente: node scripts/servir-web.mjs [porta]
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, join, normalize, extname } from "node:path";
import { fileURLToPath } from "node:url";
const DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "docs");
const TIPOS = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8" };
const porta = Number(process.argv[2] || 8090);
createServer(async (req, res) => {
  const caminho = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^[/\\]+/, "") || "index.html";
  const arq = join(DIR, caminho.endsWith("/") || caminho === "" ? "index.html" : caminho);
  if (!arq.startsWith(DIR)) { res.writeHead(403).end(); return; }
  try { const b = await readFile(arq); res.writeHead(200, { "content-type": TIPOS[extname(arq)] || "application/octet-stream", "cache-control": "no-store" }).end(b); }
  catch { res.writeHead(404).end("não encontrado"); }
}).listen(porta, () => console.log(`docs/ em http://localhost:${porta}`));
