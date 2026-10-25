// Placar ao Vivo: busca o TSE direto do navegador; o motor roda num Web Worker (calculo.js),
// então a tela e os botões respondem na hora, e os números mostram um "esqueleto" enquanto o cálculo não chega.
import { projetar, rotulo, definido, delta, CURVAS } from "./motor.js?v=20261025b";
import { lerArquivo, urlUF, UFS, descobrirEleicao } from "./tse.js?v=20261025b";
import { apuracao, rng } from "./simulado.js?v=20261025b";

const $ = (s) => document.querySelector(s);
const NOME = { A: "Lula", B: "Flávio Bolsonaro" };
const NUM = { A: "13", B: "22" };
const COR = { A: "var(--ca)", B: "var(--cb)" };
const fmt = (x, d = 1) => (x === null || x === undefined || !Number.isFinite(x) ? "—" : x.toFixed(d).replace(".", ","));
const fmtPct = (p) => { const v = 100 * p; return v > 99.9 ? "> 99,9%" : v < 0.1 ? "< 0,1%" : fmt(v, 1) + "%"; };
const fmtInt = (n) => (Number.isFinite(n) ? Math.round(n).toLocaleString("pt-BR") : "—");
const store = { get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };

// previsões das pesquisas (seção 7 do prompt; fechamento de 24/10/2026)
const ALVOS = {
  A: { centro: 49.15, meio90: 5.3, nome: "A · só pesquisas", nota: "49,15% para Lula (90%: 43,8–54,4); P(Lula) 37,5%." },
  B: { centro: 49.26, meio90: 4.55, nome: "B · correção histórica", nota: "Padrão. 49,26% para Lula (90%: 44,7–53,8); P(Lula) 37,4%." },
  C: { centro: 48.2, meio90: 4.55, nome: "C · sem faltosos do 1º turno", nota: "48,2% para Lula; P(Lula) 26%. O intervalo dessa versão não veio no fechamento: usei a mesma largura da B (verificar)." },
  E: { centro: 50, meio90: 4.55, nome: "Empate (50%)", nota: "Ponto de partida neutro: 50% para cada um, com a largura da B." },
  L: { centro: 50, meio90: 4.55, nome: "Valor livre", nota: "Valor digitado, com a largura da B." },
};
let alvoKey = store.get("pv-alvo", "B");
if (!ALVOS[alvoKey]) alvoKey = "B";
let livre = store.get("pv-livre", 50);
const alvo = () => (alvoKey === "L" ? { ...ALVOS.L, centro: Number(livre) } : ALVOS[alvoKey]);

let ESTADOS = [];
let modo = "vivo"; // vivo | sim
let cd = "6258";
const tse = {}; // UF -> última leitura do TSE
let br = null; // arquivo nacional do TSE
let manual = store.get("pv-manual", {}); // UF ou BR -> { f, A, B }
let hist = [];
let ultimoErro = null, ultimoOk = null;

// ----------------------------------------------------------------------------- dados combinados (TSE + manual)
function parciais() {
  const out = {};
  for (const e of ESTADOS) {
    const m = manual[e.uf], t = tse[e.uf];
    if (m) { const vv = m.A + m.B; out[e.uf] = { f: m.f, A: m.A, B: m.B, vv, p: vv ? (100 * m.A) / vv : null, restantes: t?.restantes ?? null, manual: true }; }
    else if (t) out[e.uf] = t;
  }
  return out;
}
function nacionalAtual(par) {
  if (manual.BR) { const m = manual.BR; return { f: m.f, A: m.A, B: m.B, p: m.A + m.B ? (100 * m.A) / (m.A + m.B) : null, manual: true }; }
  let A = 0, B = 0, sec = 0, tot = 0;
  for (const e of ESTADOS) { const q = par[e.uf]; if (q) { A += q.A; B += q.B; } sec += (q?.f || 0) * e.secoes; tot += e.secoes; }
  const f = br && modo === "vivo" && !Object.keys(manual).length ? br.f : sec / tot;
  return { f, A, B, p: A + B ? (100 * A) / (A + B) : null };
}

// ----------------------------------------------------------------------------- cálculo em segundo plano (o pedido mais novo vence)
let worker = null;
try { worker = new Worker(new URL("./calculo.js?v=20261025b", import.meta.url), { type: "module" }); } catch { worker = null; }
let pedidoId = 0, emCurso = null, fila = null, ultimo = null, esqueleto = true;
function montarPedido() {
  const par = parciais(), nat = nacionalAtual(par);
  const temEstado = Object.values(par).some((q) => q.f > 0);
  const id = ++pedidoId;
  if (temEstado || !manual.BR) return { msg: { id, estados: ESTADOS.map((e) => ({ uf: e.uf, base: e.base, Vesp: e.Vesp })), parciais: par, alvo: alvo() }, par, nat, alvoKey };
  // só o nacional digitado: o país inteiro vira um "estado" (menos preciso)
  const Vt = ESTADOS.reduce((s, e) => s + e.Vesp, 0), baseNat = ESTADOS.reduce((s, e) => s + e.base * e.Vesp, 0) / Vt;
  return { msg: { id, estados: [{ uf: "BR", base: baseNat, Vesp: Vt }], parciais: par, nacionalSo: { BR: { f: nat.f, p: nat.p, vv: nat.A + nat.B, A: nat.A, B: nat.B } }, alvo: alvo() }, par, nat, alvoKey };
}
function calcular() {
  const ped = montarPedido();
  desenharStatus(ped.par, ped.nat);
  if (emCurso) { fila = ped; return; }
  enviar(ped);
}
function enviar(ped) {
  emCurso = ped;
  $("#calc").classList.add("on");
  if (worker) worker.postMessage(ped.msg);
  else setTimeout(() => { // navegador sem Worker de módulo: calcula aqui mesmo, sem travar o toque que pediu
    const m = ped.msg; const r = projetar(m.estados, m.nacionalSo || m.parciais, m.alvo);
    receber({ id: m.id, r, def: definido(m.parciais) });
  }, 30);
}
function receber(d) {
  const ped = emCurso;
  emCurso = null;
  if (d.erro) { ultimoErro = "cálculo: " + d.erro; }
  else if (ped && d.id === ped.msg.id) { ultimo = { ...ped, r: d.r, def: d.def }; esqueleto = false; desenharResultado(); }
  if (fila) { const p = fila; fila = null; enviar(p); } else $("#calc").classList.remove("on");
}
if (worker) { worker.onmessage = (e) => receber(e.data); worker.onerror = () => { worker = null; if (emCurso) { const p = emCurso; emCurso = null; enviar(p); } }; }

// ----------------------------------------------------------------------------- desenho: status (na hora) e resultado (quando o cálculo chega)
function desenharStatus(par, nat) {
  $("#barra").style.width = `${(100 * nat.f).toFixed(2)}%`;
  $("#secoes").textContent = `${fmt(100 * nat.f, 2)}% das seções totalizadas`;
  $("#hora").textContent = modo === "sim" ? "" : br?.gerado ? `TSE gerou às ${br.gerado.split(" ")[1] || br.gerado}` : "";
  const nManual = Object.keys(manual).length;
  const modoEl = $("#modo");
  modoEl.className = "pill " + (modo === "sim" ? "sim" : nManual ? "manual" : ultimoErro && !ultimoOk ? "erro" : "vivo");
  modoEl.textContent = modo === "sim" ? "SIMULAÇÃO" : nManual ? "manual + TSE" : ultimoErro && !ultimoOk ? "TSE fora" : "TSE ao vivo";
  $("#statusTxt").textContent = modo === "sim" ? "Apuração simulada (números inventados)" : nat.f === 0 ? "Apuração ainda não começou (a votação vai até 17h de Brasília)" : nat.f >= 1 ? "Apuração encerrada no TSE" : "Apuração em andamento";
  $("#fonteTxt").textContent = modo === "sim" ? "" : ultimoErro ? `última falha: ${ultimoErro}` : ultimoOk ? `TSE consultado às ${ultimoOk}` : "";
  $("#mLista").textContent = nManual ? "Manuais: " + Object.entries(manual).map(([k, m]) => `${k} ${fmt(100 * m.f, 1)}% (${fmtInt(m.A)} × ${fmtInt(m.B)})`).join("; ") : "";
}
function marcarEsqueleto(on) {
  esqueleto = on;
  for (const id of ["#fav", "#duo", "#checagem", "#tabela"]) $(id).classList.toggle("carregando", on);
}
function desenharResultado() {
  if (!ultimo) return;
  marcarEsqueleto(false);
  const { r, def, par, nat } = ultimo;
  const lb = rotulo(r.A.pVence, def);
  const pA = r.A.pVence;
  $("#pA").style.width = `${(100 * pA).toFixed(2)}%`;
  $("#pB").style.width = `${(100 * (1 - pA)).toFixed(2)}%`;
  $("#favTxt").innerHTML = lb.quem ? `<span style="color:${COR[lb.quem]}">${NOME[lb.quem]}</span>: ${lb.texto}` : `Indefinido`;
  for (const k of ["A", "B"]) {
    const o = r[k], parcial = nat.p === null ? null : k === "A" ? nat.p : 100 - nat.p, votos = k === "A" ? nat.A : nat.B;
    const c = $(`#cand${k}`);
    c.querySelector(".big").textContent = fmtPct(o.pVence);
    c.querySelector(".mid").textContent = `${fmt(o.media, 1)}%`;
    c.querySelector(".iv").textContent = `80%: ${fmt(o.lo80, 1)}–${fmt(o.hi80, 1)} · 95%: ${fmt(o.lo95, 1)}–${fmt(o.hi95, 1)}`;
    c.querySelector(".par").textContent = `${fmt(parcial, 2)}% · ${fmtInt(votos)} votos`;
  }
  // avisos
  const av = [];
  const nManual = Object.keys(manual).length;
  if (nat.f > 0 && nat.f < 0.3) av.push("Cedo demais: SP, RJ, BA, CE e PE costumam entrar tarde. A parcial nacional agora ainda não diz muito.");
  const grandes = ["SP", "MG", "RJ", "BA", "RS", "PR", "PE", "CE"].filter((uf) => (par[uf]?.f || 0) < 0.2);
  if (nat.f > 0 && grandes.length) av.push(`Estados grandes ainda abaixo de 20% apurado: ${grandes.join(", ")}.`);
  if (def) av.push(`Definido matematicamente: a diferença já contada é maior que todos os eleitores que ainda faltam totalizar.`);
  if (modo === "sim") av.push("SIMULAÇÃO: nada nesta tela é resultado real.");
  if (nManual) av.push(`Há ${nManual} entrada(s) manual(is) substituindo o TSE.`);
  $("#avisos").hidden = !av.length;
  $("#avisos").innerHTML = av.map((t) => `<p>⚠ ${t}</p>`).join("");
  // checagem simples
  const X = 100 * nat.f;
  const a0 = alvo();
  if (nat.p !== null && X > 0) {
    const esp = Object.keys(CURVAS).map((c) => a0.centro + delta(c, X));
    const lo = Math.min(...esp), hi = Math.max(...esp);
    const cell = (k) => {
      const p = k === "A" ? nat.p : 100 - nat.p, a = k === "A" ? lo : 100 - hi, b = k === "A" ? hi : 100 - lo;
      const st = p < a - 0.3 ? "abaixo do esperado" : p > b + 0.3 ? "acima do esperado" : "dentro do esperado";
      return `<div style="--c:${COR[k]}"><b>${NOME[k]}</b><br>parcial ${fmt(p, 2)}%<br>esperado agora: ${fmt(a, 1)}–${fmt(b, 1)}%<br><span class="muted small">${st}</span></div>`;
    };
    $("#checagem").innerHTML = `<div class="check">${cell("A")}${cell("B")}</div><p class="muted small">Faixa = previsão de partida (${fmt(a0.centro, 2)}% para Lula) + o quanto a parcial costumava ficar longe do final com ${fmt(X, 1)}% apurado, no 1º turno de 2026 e no 2º turno de 2022. As duas curvas discordam em até 2 pontos no começo da noite, e em 2022 o desvio do 2º turno foi cerca de metade do do 1º. É só uma conferência; a projeção de verdade é a por estado.</p>`;
  } else $("#checagem").innerHTML = `<p class="muted">Aparece quando a apuração começar.</p>`;
  // tabela por estado
  const linhas = [...r.porUF].sort((a, b) => b.V - a.V);
  $("#tabela").innerHTML = `<thead><tr><th>UF</th><th>apurado</th><th>parcial 13</th><th>parcial 22</th><th>final 13</th><th>final 22</th></tr></thead><tbody>${linhas.map((u) => `<tr><td>${u.uf}${par[u.uf]?.manual ? "*" : ""}</td><td>${fmt(100 * u.f, 0)}%<span class="fbar"><i style="width:${(100 * u.f).toFixed(0)}%"></i></span></td><td>${fmt(u.parcial, 1)}</td><td>${u.parcial === null ? "—" : fmt(100 - u.parcial, 1)}</td><td style="color:var(--ca)">${fmt(u.final, 1)} <span class="muted">±${fmt(1.2816 * u.sd, 1)}</span></td><td style="color:var(--cb)">${fmt(100 - u.final, 1)}</td></tr>`).join("")}</tbody>`;
  // histórico e gráfico
  if (nat.f > 0) {
    const last = hist[hist.length - 1];
    if (!last || Math.abs(last.X - X) > 0.05 || Math.abs(last.m - r.A.media) > 0.02) {
      hist.push({ t: Date.now(), X, p: nat.p, m: r.A.media, lo: r.A.lo80, hi: r.A.hi80, pA: r.A.pVence });
      if (hist.length > 2000) hist = hist.slice(-2000);
      if (modo === "vivo") store.set("pv-hist-" + cd, hist);
    }
  }
  grafico();
  $("#alvoNota").textContent = a0.nota + ` Ajuste inicial s0 = ${fmt(r.s0, 2)} ponto; depois da apuração: ${fmt(r.sPost, 2)} ± ${fmt(r.sSd, 2)}.`;
}

function grafico() {
  const W = 340, H = 190, L = 30, R = 8, T = 10, B = 26;
  const pts = hist.filter((h) => h.X > 0);
  const x = (X) => L + ((W - L - R) * X) / 100;
  const ys = pts.flatMap((h) => [h.lo, h.hi, h.p, 100 - h.lo, 100 - h.hi, 100 - h.p]).filter(Number.isFinite);
  const lo = Math.min(42, ...ys) - 0.5, hi = Math.max(58, ...ys) + 0.5;
  const y = (v) => T + ((H - T - B) * (hi - v)) / (hi - lo);
  let s = "";
  for (let v = Math.ceil(lo / 2) * 2; v <= hi; v += 2) s += `<path d="M${L} ${y(v).toFixed(1)}H${W - R}" stroke="${v === 50 ? "#94a3b8" : "#273556"}" stroke-width="${v === 50 ? 1.2 : 0.8}"/><text x="${L - 4}" y="${(y(v) + 3.5).toFixed(1)}" text-anchor="end" font-size="9" fill="#9aa8c2">${v}</text>`;
  for (const X of [0, 25, 50, 75, 100]) s += `<text x="${x(X).toFixed(1)}" y="${H - 8}" text-anchor="middle" font-size="9" fill="#9aa8c2">${X}%</text>`;
  if (pts.length) {
    for (const [k, inv] of [["A", false], ["B", true]]) {
      const v = (q) => (inv ? 100 - q : q);
      const col = k === "A" ? "#2bb3a3" : "#e08a3c";
      const band = pts.map((h) => `${x(h.X).toFixed(1)} ${y(v(inv ? h.lo : h.hi)).toFixed(1)}`).join("L") + "L" + [...pts].reverse().map((h) => `${x(h.X).toFixed(1)} ${y(v(inv ? h.hi : h.lo)).toFixed(1)}`).join("L");
      s += `<path d="M${band}Z" fill="${col}" fill-opacity=".18"/>`;
      s += `<path d="M${pts.map((h) => `${x(h.X).toFixed(1)} ${y(v(h.m)).toFixed(1)}`).join("L")}" fill="none" stroke="${col}" stroke-width="2"/>`;
      for (const h of pts) if (h.p !== null) s += `<circle cx="${x(h.X).toFixed(1)}" cy="${y(v(h.p)).toFixed(1)}" r="1.6" fill="${col}"/>`;
    }
  } else s += `<text x="${W / 2}" y="${H / 2}" text-anchor="middle" font-size="11" fill="#9aa8c2">o gráfico começa quando a apuração começar</text>`;
  $("#grafico").innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Projeção ao longo da noite">${s}</svg>`;
}

// ----------------------------------------------------------------------------- controles fixos (montados uma vez; nunca são recriados)
function montarControles() {
  $("#duo").innerHTML = ["A", "B"].map((k) => `<article class="cand" id="cand${k}" style="--c:${COR[k]}"><div class="nm">${NOME[k]}</div><div class="num">nº ${NUM[k]}</div>
    <div class="lab">chance de vencer</div><div class="big sk">—</div>
    <div class="lab">projeção final</div><div class="mid sk">—</div>
    <div class="iv sk">—</div>
    <div class="lab">parcial agora</div><div class="par sk">—</div></article>`).join("");
  $("#alvos").innerHTML = Object.entries(ALVOS).map(([k, v]) => `<button type="button" data-alvo="${k}" aria-pressed="${k === alvoKey}">${v.nome}</button>`).join("");
  $("#livreRow").hidden = alvoKey !== "L";
  $("#livre").value = livre;
  $("#mUF").innerHTML = `<option value="BR">Brasil (só o nacional)</option>` + ESTADOS.map((e) => `<option>${e.uf}</option>`).join("");
}
function marcarAlvo() {
  for (const b of document.querySelectorAll("[data-alvo]")) b.setAttribute("aria-pressed", String(b.dataset.alvo === alvoKey));
  $("#livreRow").hidden = alvoKey !== "L";
}

// ----------------------------------------------------------------------------- TSE ao vivo: 1 arquivo por vez; cada um a cada ~30 s
let timer = 0, idx = 0, novos = false, ultimoCalculo = 0;
const LISTA = [...UFS, "br"];
async function proximo() {
  if (modo !== "vivo") return;
  const uf = LISTA[idx++ % LISTA.length];
  try {
    const resp = await fetch(urlUF(uf, cd), { cache: "no-cache" }); // revalida com ETag pelo cache do navegador
    if (!resp.ok) throw new Error(`HTTP ${resp.status} em ${uf}`);
    const d = lerArquivo(await resp.json(), uf, cd);
    if (uf === "br") br = d; else tse[uf.toUpperCase()] = d;
    ultimoOk = new Date().toLocaleTimeString("pt-BR"); ultimoErro = null;
    novos = true;
  } catch (e) { ultimoErro = e.message; }
  if (modo !== "vivo") return;
  if (novos && Date.now() - ultimoCalculo > 4000) { novos = false; ultimoCalculo = Date.now(); calcular(); }
  timer = setTimeout(proximo, Math.round(30000 / LISTA.length));
}

// ----------------------------------------------------------------------------- simulação (demonstração)
let simTimer = 0;
function simular() {
  modo = "sim"; clearTimeout(timer); clearTimeout(simTimer);
  hist = []; marcarEsqueleto(true);
  const R = rng(Date.now() % 100000);
  const a = alvo();
  const s = a.centro - 48.726 + R.n() * 1.5, b = R.n() * 2;
  const estados = ESTADOS.map((e) => ({ uf: e.uf, apurado1752: e.ap1752, V: e.Vesp, final: e.base + s + R.n() * 0.65, u: R.n() * 4.5 }));
  const sim = apuracao(estados, { b });
  let min = 0;
  const passo = () => {
    if (modo !== "sim") return;
    const q = sim(min);
    for (const e of ESTADOS) tse[e.uf] = { ...q[e.uf] };
    br = null;
    calcular();
    min += 4;
    if (min <= 380) simTimer = setTimeout(passo, 700);
  };
  passo();
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function aoVivo() {
  modo = "vivo"; clearTimeout(simTimer); clearTimeout(timer);
  for (const k of Object.keys(tse)) delete tse[k];
  br = null;
  hist = store.get("pv-hist-" + cd, []);
  marcarEsqueleto(true);
  idx = 0; calcular(); proximo();
}

// ----------------------------------------------------------------------------- eventos (resposta visual imediata; o cálculo vem depois)
document.addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.alvo) {
    if (b.dataset.alvo === alvoKey) return;
    alvoKey = b.dataset.alvo; store.set("pv-alvo", alvoKey);
    marcarAlvo(); marcarEsqueleto(true);
    if (modo === "sim") hist = [];
    calcular();
  }
  if (b.id === "demo") { b.textContent = "Simulando…"; setTimeout(() => (b.textContent = "Simular de novo"), 1200); simular(); }
  if (b.id === "vivo") aoVivo();
  if (b.id === "mSalvar") {
    const uf = $("#mUF").value, f = Number($("#mF").value) / 100, A = Number($("#mA").value), B = Number($("#mB").value);
    if (!(f >= 0 && f <= 1) || !(A >= 0) || !(B >= 0)) return;
    manual[uf] = { f, A, B }; store.set("pv-manual", manual); marcarEsqueleto(true); calcular();
  }
  if (b.id === "mLimpar") { manual = {}; store.set("pv-manual", manual); marcarEsqueleto(true); calcular(); }
});
$("#livre").addEventListener("change", (e) => { livre = Number(e.target.value); store.set("pv-livre", livre); marcarEsqueleto(true); calcular(); });
document.addEventListener("visibilitychange", () => { if (!document.hidden && modo === "vivo") { clearTimeout(timer); proximo(); } });

// ----------------------------------------------------------------------------- início
(async function inicio() {
  const est = await (await fetch("estados.json?v=20261025b", { cache: "no-cache" })).json();
  ESTADOS = est.map((r) => ({ uf: r.uf, base: r.base26, Vesp: r.validos26_2t_esp, ap1752: r.apurado_17h52_1t26, secoes: r.validos26_2t_esp }));
  montarControles();
  marcarEsqueleto(true);
  try { const el = await descobrirEleicao(); cd = el.cd; } catch { /* fica com 6258, confirmado em 24/10 */ }
  hist = store.get("pv-hist-" + cd, []);
  $("#versao").textContent = `Eleição TSE ${cd}. Página estática: o seu navegador consulta o TSE diretamente; o cálculo roda em segundo plano.`;
  if (new URLSearchParams(location.search).has("simulado")) simular(); else aoVivo();
})();
