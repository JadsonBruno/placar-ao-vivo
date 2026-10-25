// Monta dados/historico.json a partir dos arquivos oficiais do TSE (dados abertos) de 2014, 2018 e 2022:
// - o % do PT nos votos de 2 candidatos, por estado, em cada turno (limites históricos do simulador);
// - o quanto cada estado e cada região se moveram do 1º para o 2º turno, em escala logit (calibra os desvios);
// - o quanto os votos válidos de cada estado e região mudaram do 1º para o 2º turno (calibra a abstenção).
// Rodar: node scripts/montar-historico.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ESTADOS = JSON.parse(readFileSync(join(ROOT, "dados/estados.json"), "utf8"));
const REGIAO = Object.fromEntries(ESTADOS.map((e) => [e.uf, e.regiao]));

// lê um CSV do TSE (latin1, ";" e aspas) e chama fn(linha) com um objeto por linha
function lerCSV(rel, fn) {
  const txt = readFileSync(join(ROOT, rel), "latin1");
  const linhas = txt.split(/\r?\n/);
  const cab = linhas[0].split(";").map((c) => c.replace(/"/g, ""));
  for (let i = 1; i < linhas.length; i++) {
    if (!linhas[i]) continue;
    const v = linhas[i].split(";").map((c) => c.replace(/"/g, ""));
    fn(Object.fromEntries(cab.map((c, j) => [c, v[j]])));
  }
}

// votos por estado e turno: { [turno]: { [uf]: { pt, rival, validos } } }
const ELEICOES = {
  2014: { arq: "fontes-tse/2014/votacao_partido_munzona_2014_BR.csv", rival: "45", votos: (r) => +r.QT_VOTOS_NOMINAIS + +r.QT_VOTOS_LEGENDA, det: "fontes-tse/2014/detalhe_votacao_munzona_2014_BR.csv" },
  2018: { arq: "fontes-tse/2018/votacao_partido_munzona_2018_BR.csv", rival: "17", votos: (r) => +r.QT_VOTOS_NOMINAIS_VALIDOS + +r.QT_TOTAL_VOTOS_LEG_VALIDOS, det: "fontes-tse/2018/detalhe_votacao_munzona_2018_BR.csv" },
  2022: { arq: "fontes-tse/2022/votacao_partido_munzona_2022_BR.csv", rival: "22", votos: (r) => +r.QT_VOTOS_NOMINAIS_VALIDOS + +r.QT_TOTAL_VOTOS_LEG_VALIDOS, det: "fontes-tse/2022/detalhe_votacao_munzona_2022_BRASIL.csv" },
};
// totais nacionais oficiais (TSE) para conferir a leitura
const CONFERE = {
  2014: { 1: [43267668, 34897211], 2: [54501118, 51041155] },
  2018: { 1: [31342051, 49277010], 2: [47040906, 57797847] },
  2022: { 1: [57259504, 51072345], 2: [60345999, 58206354] },
};

const dados = {};
for (const [ano, E] of Object.entries(ELEICOES)) {
  const d = { 1: {}, 2: {} };
  const uf0 = (t, uf) => (d[t][uf] ??= { pt: 0, rival: 0, validos: 0, comparecimento: 0, aptos: 0 });
  lerCSV(E.arq, (r) => {
    if (r.CD_CARGO !== "1") return;
    const o = uf0(r.NR_TURNO, r.SG_UF), v = E.votos(r);
    if (r.NR_PARTIDO === "13") o.pt += v;
    else if (r.NR_PARTIDO === E.rival) o.rival += v;
  });
  lerCSV(E.det, (r) => {
    if (r.CD_CARGO !== "1") return;
    const o = uf0(r.NR_TURNO, r.SG_UF);
    o.validos += +r.QT_TOTAL_VOTOS_VALIDOS || +r.QT_VOTOS_NOMINAIS || 0;
    o.comparecimento += +r.QT_COMPARECIMENTO;
    o.aptos += +r.QT_APTOS;
  });
  for (const t of [1, 2]) {
    const pt = Object.values(d[t]).reduce((s, o) => s + o.pt, 0), rv = Object.values(d[t]).reduce((s, o) => s + o.rival, 0);
    const [ePt, eRv] = CONFERE[ano][t];
    console.log(`${ano} ${t}º turno: PT ${pt} ${pt === ePt ? "ok" : "≠ " + ePt} | rival ${rv} ${rv === eRv ? "ok" : "≠ " + eRv}`);
  }
  dados[ano] = d;
}

const logit = (p) => Math.log(p / (1 - p));
const ufs = ESTADOS.map((e) => e.uf);
const regioes = [...new Set(ESTADOS.map((e) => e.regiao))];
const pt2c = (o) => o.pt / (o.pt + o.rival);

// decompõe uma mudança por estado (x[uf]) em nacional + região + resíduo do estado, ponderando por peso[uf]
function decompor(x, peso) {
  const W = ufs.reduce((s, u) => s + peso[u], 0);
  const nac = ufs.reduce((s, u) => s + peso[u] * x[u], 0) / W;
  const reg = {};
  for (const r of regioes) {
    const us = ufs.filter((u) => REGIAO[u] === r), w = us.reduce((s, u) => s + peso[u], 0);
    reg[r] = us.reduce((s, u) => s + peso[u] * x[u], 0) / w - nac;
  }
  const res = Object.fromEntries(ufs.map((u) => [u, x[u] - nac - reg[REGIAO[u]]]));
  return { nac, reg, res };
}
// desvio-padrão em torno de zero (os componentes já são desvios), sem e com peso
const dp0 = (xs) => Math.sqrt(xs.reduce((s, x) => s + x * x, 0) / xs.length);
const dp0w = (xs, ws) => Math.sqrt(xs.reduce((s, x, i) => s + ws[i] * x * x, 0) / ws.reduce((s, w) => s + w, 0));

// O voto que muda do 1º para o 2º turno é, em grande parte, o dos outros candidatos do 1º turno. Em 2014 e 2018 eles
// tinham ~25% dos válidos (Marina, Ciro…), em 2022 ~8%, em 2026 ~7,8%. Por isso o deslocamento de voto é medido por
// ponto de "outros" e depois reescalado para 2026. A mudança de votos válidos (abstenção) não é reescalada.
const ts = Object.values(ESTADOS);
const outros26 = 1 - ts.reduce((s, e) => s + e.lula26_1t + e.flavio26_1t, 0) / ts.reduce((s, e) => s + e.validos26_1t, 0);
const transicoes = {};
const regV = [], resV = [], resW = [], regT = [], resT = [], resTW = [];
for (const ano of Object.keys(dados)) {
  const d = dados[ano];
  const peso = Object.fromEntries(ufs.map((u) => [u, d[2][u].pt + d[2][u].rival]));
  const tot1 = Object.values(d[1]), outros = 1 - tot1.reduce((s, o) => s + o.pt + o.rival, 0) / tot1.reduce((s, o) => s + o.validos, 0);
  const voto = decompor(Object.fromEntries(ufs.map((u) => [u, logit(pt2c(d[2][u])) - logit(pt2c(d[1][u]))])), peso);
  const valid = decompor(Object.fromEntries(ufs.map((u) => [u, Math.log(d[2][u].validos / d[1][u].validos)])), peso);
  // a região "Exterior" tem um único estado: o resíduo dela vira efeito de região; fica de fora da calibragem
  const regs = regioes.filter((r) => r !== "Exterior"), us = ufs.filter((u) => u !== "ZZ");
  regV.push(...regs.map((r) => voto.reg[r] / outros)); regT.push(...regs.map((r) => valid.reg[r]));
  resV.push(...us.map((u) => voto.res[u] / outros)); resT.push(...us.map((u) => valid.res[u]));
  resW.push(...us.map((u) => peso[u])); resTW.push(...us.map((u) => peso[u]));
  transicoes[ano] = {
    outros1t: +outros.toFixed(4),
    sigRegiao: +dp0(regs.map((r) => voto.reg[r])).toFixed(4), sigEstado: +dp0w(us.map((u) => voto.res[u]), us.map((u) => peso[u])).toFixed(4),
    nacional: { logit: +voto.nac.toFixed(4), validos: +valid.nac.toFixed(4) },
    regiao: Object.fromEntries(regioes.map((r) => [r, { logit: +voto.reg[r].toFixed(4), validos: +valid.reg[r].toFixed(4) }])),
  };
}
const calib = {
  outros26: +outros26.toFixed(4),
  sigRegiao: +(dp0(regV) * outros26).toFixed(4), // logit: quanto uma região se desloca além do nacional
  sigEstado: +(dp0w(resV, resW) * outros26).toFixed(4), // logit: quanto um estado se desloca além da sua região (ponderado por votos)
  sigRegiaoValidos: +dp0(regT).toFixed(4), // log da razão de válidos (2º ÷ 1º turno), por região
  sigEstadoValidos: +dp0w(resT, resTW).toFixed(4),
};

// limites históricos: % do PT nos 2 candidatos, por estado, nos 2º turnos de 2014/2018/2022 e na base do 1º turno de 2026
const porUF = Object.fromEntries(ESTADOS.map((e) => {
  const h = { t2_2014: pt2c(dados[2014][2][e.uf]), t2_2018: pt2c(dados[2018][2][e.uf]), t2_2022: pt2c(dados[2022][2][e.uf]), t1_2026: e.base26 / 100 };
  const xs = Object.values(h).map((x) => 100 * x);
  return [e.uf, { ...Object.fromEntries(Object.entries(h).map(([k, v]) => [k, +(100 * v).toFixed(2)])), min: +Math.min(...xs).toFixed(2), max: +Math.max(...xs).toFixed(2) }];
}));

const saida = {
  fonte: "TSE, dados abertos: votacao_partido_munzona e detalhe_votacao_munzona de 2014, 2018 e 2022 (Presidente); base de 2026 de dados/estados.json",
  nota: "% do PT nos votos dos 2 candidatos (PT × PSDB em 2014, PT × PSL em 2018, PT × PL em 2022, Lula × Flávio no 1º turno de 2026). Calibragem: mudança do 1º para o 2º turno nas 3 eleições.",
  calib, transicoes, porUF,
};
writeFileSync(join(ROOT, "dados/historico.json"), JSON.stringify(saida, null, 1));
console.log("calibragem:", calib);
for (const u of ["PI", "BA", "CE", "MA", "AL", "SC", "RO", "AC", "RR", "SP"]) console.log(u, porUF[u]);
