// Coleta dos resultados no TSE: descobre o código da eleição pela configuração, lê os arquivos por UF
// com cabeçalhos condicionais, recua em erro e guarda a última resposta boa. Leitor defensivo.
export const BASE = "https://resultados.tse.jus.br";
export const UFS = ["ac", "al", "ap", "am", "ba", "ce", "df", "es", "go", "ma", "mt", "ms", "mg", "pa", "pb", "pr", "pe", "pi", "rj", "rn", "rs", "ro", "rr", "sc", "sp", "se", "to", "zz"];
export const CAND = { A: "13", B: "22" }; // conferido no arquivo do 2º turno: 13 = LULA, 22 = FLAVIO BOLSONARO

export class FormatoMudou extends Error {}

// Número do TSE: "12,34" ou "12.34" ou "1234". Vírgula é decimal; ponto como milhar só se houver vírgula também.
export function num(v) {
  if (v === undefined || v === null || v === "") return NaN;
  let s = String(v).trim();
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  return Number(s);
}

export async function descobrirEleicao(ciclo = "ele2026", dataPleito = "25/10/2026") {
  const r = await fetch(`${BASE}/oficial/comum/config/ele-c.json`);
  if (!r.ok) throw new Error(`config do TSE respondeu ${r.status}`);
  const j = await r.json();
  for (const p of j.pl || []) {
    if (p.c !== ciclo || p.dt !== dataPleito) continue;
    for (const e of p.e || []) if (String(e.t) === "2" && /federal/i.test(e.nm || "") && (e.abr || []).some((a) => (a.cp || []).some((c) => String(c.cd) === "1"))) return { cd: String(e.cd), nm: e.nm, ciclo };
  }
  throw new Error("não achei a eleição presidencial do 2º turno na configuração do TSE");
}

export const urlUF = (uf, cd, ciclo = "ele2026", ambiente = "oficial") => `${BASE}/${ambiente}/${ciclo}/${cd}/dados/${uf}/${uf}-c0001-e${String(cd).padStart(6, "0")}-u.json`;

// Lê um arquivo "-u.json" de uma UF (ou br). Lança FormatoMudou com mensagem clara se algo faltar.
export function lerArquivo(j, ufEsperada, cdEsperado) {
  const falta = (o) => { throw new FormatoMudou(`formato do TSE mudou em ${ufEsperada}: ${o}`); };
  if (!j || typeof j !== "object") falta("não é JSON");
  if (cdEsperado && String(j.ele) !== String(cdEsperado)) falta(`eleição ${j.ele}, esperava ${cdEsperado}`);
  if (j.cdabr && ufEsperada && j.cdabr.toLowerCase() !== ufEsperada) falta(`abrangência ${j.cdabr}`);
  const carg = (j.carg || []).find((c) => String(c.cd) === "1") || falta("sem cargo 1 (presidente)");
  const cands = [];
  for (const a of carg.agr || []) for (const p of a.par || []) for (const c of p.cand || []) cands.push(c);
  const ca = cands.find((c) => String(c.n) === CAND.A) || falta(`sem candidato ${CAND.A}`);
  const cb = cands.find((c) => String(c.n) === CAND.B) || falta(`sem candidato ${CAND.B}`);
  const A = num(ca.vap), B = num(cb.vap);
  const st = num(j.s?.st), ts = num(j.s?.ts), vv = num(j.v?.vv);
  const te = num(j.e?.te), est = num(j.e?.est);
  for (const [k, v] of Object.entries({ A, B, st, ts, vv })) if (!Number.isFinite(v)) falta(`campo ${k} ilegível`);
  if (ts <= 0 || st > ts) falta(`seções ${st}/${ts}`);
  return {
    f: st / ts, pst: num(j.s?.pst), A, B, vv, restantes: Number.isFinite(te) && Number.isFinite(est) ? Math.max(0, te - est) : null,
    p: A + B > 0 ? (100 * A) / (A + B) : null, nomeA: ca.nmu, nomeB: cb.nmu, gerado: `${j.dg || ""} ${j.hg || ""}`.trim(), totalizado: j.tf === "s",
  };
}

// Coletor educado: um arquivo de cada vez, cada arquivo no máximo a cada `intervalo` s, ETag/Last-Modified, backoff.
export function coletor({ cd, ciclo = "ele2026", intervalo = 30, aoReceber, aoErro, gravarBruto }) {
  const estado = Object.fromEntries([...UFS, "br"].map((uf) => [uf, { etag: null, lm: null, prox: 0, falhas: 0, ultimo: null }]));
  let parar = false, i = 0;
  const lista = [...UFS, "br"];
  const passo = Math.max(250, Math.floor((intervalo * 1000) / lista.length));
  async function um(uf) {
    const e = estado[uf];
    if (Date.now() < e.prox) return;
    const h = { "user-agent": "placar-ao-vivo (uso pessoal; 1 consulta por arquivo a cada 30 s)" };
    if (e.etag) h["if-none-match"] = e.etag;
    if (e.lm) h["if-modified-since"] = e.lm;
    try {
      const r = await fetch(urlUF(uf, cd, ciclo), { headers: h });
      if (r.status === 304) { e.prox = Date.now() + intervalo * 1000; e.falhas = 0; return; }
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const texto = await r.text();
      const dados = lerArquivo(JSON.parse(texto), uf, cd);
      e.etag = r.headers.get("etag"); e.lm = r.headers.get("last-modified");
      e.falhas = 0; e.prox = Date.now() + intervalo * 1000; e.ultimo = dados;
      gravarBruto?.(uf, texto);
      aoReceber(uf, dados);
    } catch (err) {
      e.falhas++;
      const espera = Math.min(600, intervalo * 2 ** e.falhas);
      e.prox = Date.now() + espera * 1000;
      aoErro?.(uf, err, espera);
    }
  }
  (async function laco() {
    while (!parar) {
      await um(lista[i % lista.length]);
      i++;
      await new Promise((res) => setTimeout(res, passo));
    }
  })();
  return { parar: () => { parar = true; }, estado };
}
