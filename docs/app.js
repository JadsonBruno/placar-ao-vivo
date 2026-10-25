// Placar ao Vivo: busca o TSE direto do navegador; o motor roda num Web Worker (calculo.js),
// então a tela e os botões respondem na hora, e os números mostram um "esqueleto" enquanto o cálculo não chega.
import { projetar, PARAMS, PARAMS_M2, rotulo, definido, delta, CURVAS } from "./motor.js?v=20261025h";
import { lerArquivo, urlUF, UFS, descobrirEleicao } from "./tse.js?v=20261025h";
import { apuracao, cenario, CENARIOS, rng } from "./simulado.js?v=20261025h";

const $ = (s) => document.querySelector(s);
const NOME = { A: "Lula", B: "Flávio Bolsonaro" };
const CURTO = { A: "Lula", B: "Flávio" };
const NUM = { A: "13", B: "22" };
const COR = { A: "var(--ca)", B: "var(--cb)" };
const fmt = (x, d = 1) => (x === null || x === undefined || !Number.isFinite(x) ? "—" : x.toFixed(d).replace(".", ","));
const fmtInt = (n) => (Number.isFinite(n) ? Math.round(n).toLocaleString("pt-BR") : "—");
// chance escrita como frequência ("22 em 100"), para não confundir com % de votos
const em100 = (p) => { const v = 100 * p; return v < 0.5 ? "menos de 1 em 100" : v > 99.5 ? "mais de 99 em 100" : `${Math.round(v)} em 100`; };
const em100d = (p) => { const v = 100 * p; return v < 0.1 ? "menos de 0,1 em 100" : v > 99.9 ? "mais de 99,9 em 100" : `${fmt(v, 1)} em 100`; };
const store = { get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };

// previsões das pesquisas (seção 7 do prompt; fechamento de 24/10/2026). Intervalos de 90% para Lula; P = chance de Lula no modelo.
const ALVOS = {
  A: { centro: 49.15, meio90: 5.3, nome: "A · só pesquisas", i90: [43.8, 54.4], P: 37.5 },
  B: { centro: 49.26, meio90: 4.55, nome: "B · correção histórica", i90: [44.7, 53.8], P: 37.4 },
  C: { centro: 48.2, meio90: 5.3, nome: "C · sem faltosos do 1º turno", i90: [42.9, 53.5], P: 25 },
  E: { centro: 50, meio90: 4.55, nome: "Empate (50%)", i90: null, P: null },
  L: { centro: 50, meio90: 4.55, nome: "Valor livre", i90: null, P: null },
};
let alvoKey = store.get("pv-alvo", "B");
if (!ALVOS[alvoKey]) alvoKey = "B";
let livre = store.get("pv-livre", 50);
const alvo = () => (alvoKey === "L" ? { ...ALVOS.L, centro: Number(livre) } : ALVOS[alvoKey]);
const notaAlvo = (a) => {
  let t = `Previsão: Lula ${fmt(a.centro, 2)}% · Flávio ${fmt(100 - a.centro, 2)}% dos votos válidos.`;
  if (a.i90) t += ` Intervalo de 90%: Lula ${fmt(a.i90[0], 1)}–${fmt(a.i90[1], 1)} · Flávio ${fmt(100 - a.i90[1], 1)}–${fmt(100 - a.i90[0], 1)}.`;
  else t += " Largura da incerteza igual à da versão B.";
  if (a.P !== null) t += ` Chance no modelo das pesquisas: Lula ${fmt(a.P, 1)} · Flávio ${fmt(100 - a.P, 1)} em 100.`;
  return t;
};

let ESTADOS = [];
let modo = "vivo"; // vivo | sim
let cd = "6258";
const tse = {}; // UF -> última leitura do TSE
let br = null; // arquivo nacional do TSE
// UF ou BR -> { f, A, B }. Entradas sem votos (ex.: "Aplicar" com os campos vazios) não valem e são descartadas.
const valida = (m) => m && Number.isFinite(m.f) && m.f > 0 && m.f <= 1 && m.A >= 0 && m.B >= 0 && m.A + m.B > 0;
let manual = Object.fromEntries(Object.entries(store.get("pv-manual", {})).filter(([, m]) => valida(m)));
store.set("pv-manual", manual);
// na simulação as entradas manuais não valem (a simulação não mistura dados de fora)
const manualAtivo = () => (modo === "sim" ? {} : manual);
let hist = [];
let ultimoErro = null, ultimoOk = null, horaErro = null;
let ordem = "tamanho";

// ----------------------------------------------------------------------------- dados combinados (TSE + manual)
function parciais() {
  const out = {};
  for (const e of ESTADOS) {
    const m = manualAtivo()[e.uf], t = tse[e.uf];
    if (m) { const vv = m.A + m.B; out[e.uf] = { f: m.f, A: m.A, B: m.B, vv, p: vv ? (100 * m.A) / vv : null, restantes: t?.restantes ?? null, manual: true }; }
    else if (t) out[e.uf] = t;
  }
  return out;
}
function nacionalAtual(par) {
  if (manualAtivo().BR) { const m = manual.BR; return { f: m.f, A: m.A, B: m.B, p: m.A + m.B ? (100 * m.A) / (m.A + m.B) : null, manual: true }; }
  let A = 0, B = 0, sec = 0, tot = 0;
  for (const e of ESTADOS) { const q = par[e.uf]; if (q) { A += q.A; B += q.B; } sec += (q?.f || 0) * e.secoes; tot += e.secoes; }
  const f = br && modo === "vivo" && !Object.keys(manualAtivo()).length ? br.f : sec / tot;
  return { f, A, B, p: A + B ? (100 * A) / (A + B) : null };
}

// ----------------------------------------------------------------------------- cálculo em segundo plano (o pedido mais novo vence)
// motor 2 (efeito de região, fase 2): ?motor=2 liga, ?motor=1 desliga; sem parâmetro vale MOTOR_PADRAO
const MOTOR_PADRAO = 1;
const MOTOR = { 1: 1, 2: 2 }[new URLSearchParams(location.search).get("motor")] ?? MOTOR_PADRAO;
let worker = null;
try { worker = new Worker(new URL("./calculo.js?v=20261025h", import.meta.url), { type: "module" }); } catch { worker = null; }
let pedidoId = 0, emCurso = null, fila = null, ultimo = null;
function montarPedido() {
  const par = parciais(), nat = nacionalAtual(par);
  const temEstado = Object.values(par).some((q) => q.f > 0);
  const id = ++pedidoId;
  if (temEstado || !manualAtivo().BR) return { msg: { id, estados: ESTADOS.map((e) => ({ uf: e.uf, regiao: e.regiao, base: e.base, Vesp: e.Vesp, outros: e.outros })), parciais: par, alvo: alvo(), motor: MOTOR }, par, nat };
  // só o nacional digitado: o país inteiro vira um "estado" (menos preciso)
  const Vt = ESTADOS.reduce((s, e) => s + e.Vesp, 0), baseNat = ESTADOS.reduce((s, e) => s + e.base * e.Vesp, 0) / Vt;
  return { msg: { id, estados: [{ uf: "BR", base: baseNat, Vesp: Vt }], parciais: par, nacionalSo: { BR: { f: nat.f, p: nat.p, vv: nat.A + nat.B, A: nat.A, B: nat.B } }, alvo: alvo(), motor: MOTOR }, par, nat };
}
function calcular() {
  const ped = montarPedido();
  desenharStatus(ped.nat);
  if (emCurso) { fila = ped; return; }
  enviar(ped);
}
function enviar(ped) {
  emCurso = ped;
  $("#calc").classList.add("on");
  if (worker) worker.postMessage(ped.msg);
  else setTimeout(() => { // navegador sem Worker de módulo: calcula aqui mesmo, sem travar o toque que pediu
    const m = ped.msg; const r = projetar(m.estados, m.nacionalSo || m.parciais, m.alvo, m.motor === 2 ? PARAMS_M2 : PARAMS);
    receber({ id: m.id, r, def: definido(m.parciais) });
  }, 30);
}
function receber(d) {
  const ped = emCurso;
  emCurso = null;
  if (d.erro) { ultimoErro = "cálculo: " + d.erro; horaErro = new Date(); }
  // se já há um pedido mais novo na fila, este resultado está ultrapassado: não desenha (evita mostrar o número velho e tirar o esqueleto cedo)
  else if (ped && d.id === ped.msg.id && !fila) { ultimo = { ...ped, r: d.r, def: d.def }; desenharResultado(); }
  if (fila) { const p = fila; fila = null; enviar(p); } else $("#calc").classList.remove("on");
}
if (worker) { worker.onmessage = (e) => receber(e.data); worker.onerror = () => { worker = null; if (emCurso) { const p = emCurso; emCurso = null; enviar(p); } }; }

// ----------------------------------------------------------------------------- status (na hora) e hora relativa
// "dd/mm/aaaa hh:mm:ss" do TSE, em horário de Brasília (UTC−3) -> instante
function instanteTSE(s) {
  const m = /(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/.exec(s || "");
  return m ? new Date(Date.UTC(+m[3], +m[2] - 1, +m[1], +m[4] + 3, +m[5], +m[6])) : null;
}
const hhmmss = (d) => d.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo" });
function horaRelativa() {
  const el = $("#horaRel");
  const g = instanteTSE(br?.gerado);
  if (modo === "sim") { el.textContent = "simulação: sem horário do TSE"; el.className = ""; }
  else if (ultimoErro && horaErro && (!ultimoOk || horaErro > ultimoOk)) { el.textContent = `⚠ falha ao consultar o TSE às ${hhmmss(horaErro)}; tentando de novo`; el.className = "falha"; }
  else {
    el.className = "";
    if (!g) el.textContent = ultimoOk ? `TSE consultado às ${hhmmss(ultimoOk)}` : "conectando ao TSE…";
    else {
      const s = Math.max(0, Math.round((Date.now() - g.getTime()) / 1000));
      el.textContent = s < 60 ? `TSE atualizado há ${s} s` : s < 3600 ? `TSE atualizado há ${Math.floor(s / 60)} min` : `arquivo do TSE de ${g.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) === new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) ? "hoje" : (br.gerado || "").slice(0, 5)}, ${hhmmss(g).slice(0, 5)}`;
    }
  }
  const [dia, hora] = (br?.gerado || "").split(" ");
  $("#horaDet").textContent = `Arquivo nacional gerado pelo TSE: ${g ? `${dia} às ${hora}` : "—"} · última consulta bem-sucedida desta página: ${ultimoOk ? hhmmss(ultimoOk) : "—"}${ultimoErro ? ` · última falha: ${ultimoErro}` : ""}`;
}
setInterval(horaRelativa, 1000);
function desenharStatus(nat) {
  $("#barra").style.width = `${(100 * nat.f).toFixed(2)}%`;
  $("#secoes").innerHTML = `${fmt(100 * nat.f, 2)}% apurado <span class="sub2">das seções do país</span>`;
  const nManual = Object.keys(manualAtivo()).length;
  const falhaGeral = ultimoErro && !ultimoOk;
  const modoEl = $("#modo");
  modoEl.className = "pill " + (modo === "sim" ? "sim" : nManual ? "manual" : falhaGeral ? "erro" : "vivo");
  modoEl.textContent = modo === "sim" ? "SIMULAÇÃO" : nManual ? "manual + TSE" : falhaGeral ? "TSE fora" : "TSE ao vivo";
  $("#statusTxt").textContent = modo === "sim" ? "Apuração simulada (números inventados)" : nat.f === 0 ? "A apuração ainda não começou (a votação vai até 17h de Brasília)" : nat.f >= 1 ? "Apuração encerrada no TSE" : "Apuração em andamento";
  $("#mLista").textContent = nManual ? "Valendo agora: " + Object.entries(manual).map(([k, m]) => `${k} ${fmt(100 * m.f, 1)}% (${fmtInt(m.A)} × ${fmtInt(m.B)})`).join("; ") : "";
  horaRelativa();
}

// ----------------------------------------------------------------------------- resultado (quando o cálculo chega)
function marcarEsqueleto(on) { for (const id of ["#fav", "#duo", "#estados"]) $(id).classList.toggle("carregando", on); }
function frase(lb) {
  if (lb.texto === "definido matematicamente") return `${NOME[lb.quem]} não pode mais ser alcançado`;
  if (!lb.quem) return "Indefinido: nenhum dos dois é favorito";
  return { "levemente favorável": `${NOME[lb.quem]} é levemente favorito`, favorável: `${NOME[lb.quem]} é o favorito`, "muito favorável": `${NOME[lb.quem]} é o grande favorito` }[lb.texto];
}
function desenharResultado() {
  if (!ultimo) return;
  marcarEsqueleto(false);
  const { r, def, par, nat } = ultimo;
  const lb = rotulo(r.A.pVence, def);
  // favorito e chances (barra com o valor nas duas pontas)
  const fr = frase(lb);
  $("#favTxt").innerHTML = lb.quem ? fr.replace(NOME[lb.quem], `<span style="color:${COR[lb.quem]}">${NOME[lb.quem]}</span>`) : fr;
  const pA = r.A.pVence;
  $("#chA").textContent = em100(pA);
  $("#chB").textContent = em100(1 - pA);
  $("#pA").style.width = `${(100 * pA).toFixed(2)}%`;
  $("#pB").style.width = `${(100 * (1 - pA)).toFixed(2)}%`;
  // cartões
  const X = 100 * nat.f, a0 = alvo();
  const esp = nat.p !== null && X > 0 ? Object.keys(CURVAS).map((c) => a0.centro + delta(c, X)) : null;
  for (const k of ["A", "B"]) {
    const o = r[k], c = $(`#cand${k}`);
    c.querySelector(".big").textContent = `${fmt(o.media, 1)}%`;
    c.querySelector(".iv").innerHTML = `<span>provável (80%)</span><b>${fmt(o.lo80, 1)}–${fmt(o.hi80, 1)}%</b>`;
    c.querySelector(".iv2").innerHTML = `<span>faixa de 95%</span><b>${fmt(o.lo95, 1)}–${fmt(o.hi95, 1)}%</b>`;
    c.querySelector(".ch2").innerHTML = `<span>chance de vencer</span><b>${em100d(o.pVence)}</b>`;
    if (!esp) {
      c.querySelector(".par").textContent = modo === "sim" ? "aguardando os primeiros votos" : "votos a partir das 17h";
      c.querySelector(".esp").textContent = "";
    } else {
      const parcial = k === "A" ? nat.p : 100 - nat.p, votos = k === "A" ? nat.A : nat.B;
      c.querySelector(".par").textContent = `${fmt(parcial, 2)}% · ${fmtInt(votos)} votos`;
      const lo = Math.min(...esp), hi = Math.max(...esp), a = k === "A" ? lo : 100 - hi, b = k === "A" ? hi : 100 - lo;
      const st = parcial < a - 0.3 ? "↓ abaixo do normal" : parcial > b + 0.3 ? "↑ acima do normal" : "✓ dentro do normal";
      c.querySelector(".esp").innerHTML = `esperado agora: <b>${fmt(a, 1)}–${fmt(b, 1)}%</b><br>${st}`;
    }
  }
  // avisos
  const av = [];
  const nManual = Object.keys(manualAtivo()).length;
  if (nat.f > 0 && nat.f < 0.3) av.push("Cedo demais: SP, RJ, BA, CE e PE costumam entrar tarde. A parcial nacional agora ainda não diz muito.");
  const grandes = ["SP", "MG", "RJ", "BA", "RS", "PR", "PE", "CE"].filter((uf) => (par[uf]?.f || 0) < 0.2);
  if (nat.f > 0 && grandes.length) av.push(`Estados grandes ainda abaixo de 20% apurado: ${grandes.join(", ")}.`);
  if (def) av.push(`Definido matematicamente: a diferença já contada é maior que todos os eleitores que ainda faltam totalizar. O resultado oficial é o do TSE.`);
  if (modo === "sim") av.push(`SIMULAÇÃO: nada nesta tela é resultado real. Cenário: ${simCen ? simCen.nome : "—"}. ${simCen?.fim ? `Resultado sorteado: Lula ${fmt(simCen.nacional, 1)}% · Flávio ${fmt(100 - simCen.nacional, 1)}%.` : "O resultado sorteado aparece quando a apuração simulada terminar."}`);
  if (nManual) av.push(`Há ${nManual} entrada(s) manual(is) substituindo o TSE.`);
  $("#avisos").hidden = !av.length;
  $("#avisos").innerHTML = av.map((t) => `<p>⚠ ${t}</p>`).join("");
  // estados
  desenharEstados();
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
  $("#alvoNota").textContent = notaAlvo(a0) + ` Ajuste inicial: ${fmt(r.s0, 2)} ponto; depois dos votos contados: ${fmt(r.sPost, 2)} ± ${fmt(r.sSd, 2)}.`;
  desenharPartida();
}
function desenharPartida() {
  const a = alvo();
  const nome = alvoKey === "E" ? "empate" : alvoKey === "L" ? "valor livre" : `pesquisas, versão ${alvoKey}`;
  $("#partidaTxt").textContent = `Ponto de partida: ${nome} — Lula ${fmt(a.centro, 1)}% · Flávio ${fmt(100 - a.centro, 1)}%`;
}
function desenharEstados() {
  if (!ultimo) return;
  const { r, par } = ultimo;
  const linhas = [...r.porUF];
  if (ordem === "falta") linhas.sort((a, b) => (1 - b.f) * b.V * b.sd - (1 - a.f) * a.V * a.sd);
  else linhas.sort((a, b) => b.V - a.V);
  const pm = (u) => fmt(1.2816 * u.sd, 1);
  $("#estados").innerHTML = linhas.map((u) => `<li><div class="l1">${u.uf}${par[u.uf]?.manual ? "*" : ""} <span class="fbar"><i style="width:${(100 * u.f).toFixed(0)}%"></i></span><span class="ap">${fmt(100 * u.f, 0)}% apurado</span></div>
    <div class="l2"><span class="k">parcial</span><span class="a">13: ${fmt(u.parcial, 1)}</span><span class="b">22: ${u.parcial === null ? "—" : fmt(100 - u.parcial, 1)}</span></div>
    <div class="l3"><span class="k">projeção</span><span class="a">13: ${fmt(u.final, 1)} ±${pm(u)}</span><span class="b">22: ${fmt(100 - u.final, 1)} ±${pm(u)}</span></div></li>`).join("");
  $("#ordemNota").textContent = ordem === "falta" ? "Primeiro os estados que ainda podem mexer mais no resultado: votos que faltam contar × incerteza do estado. ± = faixa provável (80%)." : "Do estado com mais votos ao com menos. ± = faixa provável (80%).";
}

function grafico() {
  const W = 340, H = 190, L = 30, R = 46, T = 10, B = 26;
  const pts = hist.filter((h) => h.X > 0);
  if (!pts.length) {
    $("#grafico").innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Gráfico vazio: começa quando a apuração começar"><rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="12" fill="#0b1224" stroke="#273556"/><text x="${W / 2}" y="${H / 2 - 4}" text-anchor="middle" font-size="13" fill="#cbd5e1">O gráfico começa quando</text><text x="${W / 2}" y="${H / 2 + 14}" text-anchor="middle" font-size="13" fill="#cbd5e1">a apuração começar (17h)</text></svg>`;
    return;
  }
  const x = (X) => L + ((W - L - R) * X) / 100;
  const ys = pts.flatMap((h) => [h.lo, h.hi, h.p, 100 - h.lo, 100 - h.hi, 100 - h.p]).filter(Number.isFinite);
  const lo = Math.min(42, ...ys) - 0.5, hi = Math.max(58, ...ys) + 0.5;
  const y = (v) => T + ((H - T - B) * (hi - v)) / (hi - lo);
  let s = "";
  for (let v = Math.ceil(lo / 2) * 2; v <= hi; v += 2) s += `<path d="M${L} ${y(v).toFixed(1)}H${W - R}" stroke="${v === 50 ? "#94a3b8" : "#273556"}" stroke-width="${v === 50 ? 1.2 : 0.8}"/><text x="${L - 4}" y="${(y(v) + 3.5).toFixed(1)}" text-anchor="end" font-size="9" fill="#9aa8c2">${v}</text>`;
  for (const X of [0, 25, 50, 75, 100]) s += `<text x="${x(X).toFixed(1)}" y="${H - 8}" text-anchor="middle" font-size="9" fill="#9aa8c2">${X}%</text>`;
  const ultimoPt = pts[pts.length - 1];
  const fim = { A: y(ultimoPt.m), B: y(100 - ultimoPt.m) };
  if (Math.abs(fim.A - fim.B) < 12) { const mid = (fim.A + fim.B) / 2, up = fim.A <= fim.B ? "A" : "B"; fim[up] = mid - 6; fim[up === "A" ? "B" : "A"] = mid + 6; }
  for (const [k, inv] of [["A", false], ["B", true]]) {
    const v = (q) => (inv ? 100 - q : q);
    const col = k === "A" ? "#2bb3a3" : "#e08a3c";
    const band = pts.map((h) => `${x(h.X).toFixed(1)} ${y(v(inv ? h.lo : h.hi)).toFixed(1)}`).join("L") + "L" + [...pts].reverse().map((h) => `${x(h.X).toFixed(1)} ${y(v(inv ? h.hi : h.lo)).toFixed(1)}`).join("L");
    s += `<path d="M${band}Z" fill="${col}" fill-opacity=".18"/>`;
    s += `<path d="M${pts.map((h) => `${x(h.X).toFixed(1)} ${y(v(h.m)).toFixed(1)}`).join("L")}" fill="none" stroke="${col}" stroke-width="2"/>`;
    for (const h of pts) if (h.p !== null) s += `<circle cx="${x(h.X).toFixed(1)}" cy="${y(v(h.p)).toFixed(1)}" r="1.6" fill="${col}"/>`;
    // rótulo direto, à direita da área do gráfico
    s += `<text x="${W - R + 4}" y="${(fim[k] + 3.5).toFixed(1)}" font-size="10" font-weight="700" fill="${col}">${CURTO[k]}</text>`;
  }
  $("#grafico").innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Projeção de votos ao longo da noite: Lula ${fmt(ultimoPt.m, 1)}%, Flávio ${fmt(100 - ultimoPt.m, 1)}%">${s}</svg>`;
}

// ----------------------------------------------------------------------------- controles fixos (montados uma vez; nunca são recriados)
function montarControles() {
  $("#duo").innerHTML = ["A", "B"].map((k) => `<article class="cand" id="cand${k}" style="--c:${COR[k]}" aria-label="${NOME[k]}, número ${NUM[k]}"><div class="nm">${NOME[k]}</div><div class="num">nº ${NUM[k]}</div>
    <div class="lab">projeção de votos</div><div class="big">—</div><div class="cap">dos votos válidos, no fim da apuração</div>
    <div class="iv">—</div><div class="iv2">—</div><div class="ch2">—</div>
    <hr><div class="lab">parcial agora</div><div class="par">—</div><div class="esp"></div></article>`).join("");
  $("#alvos").innerHTML = Object.entries(ALVOS).map(([k, v]) => `<button type="button" data-alvo="${k}" aria-pressed="${k === alvoKey}">${v.nome}</button>`).join("");
  $("#livreRow").hidden = alvoKey !== "L";
  $("#cenario").innerHTML = `<option value="aleatorio">Aleatório (sorteia um dos abaixo)</option>` + CENARIOS.map((c) => `<option value="${c.id}">${c.nome}</option>`).join("");
  $("#livre").value = livre;
  $("#mUF").innerHTML = `<option value="BR">Brasil (só o nacional)</option>` + ESTADOS.map((e) => `<option>${e.uf}</option>`).join("");
  $("#estados").innerHTML = Array.from({ length: 6 }, () => `<li><div class="l1">—</div><div class="l2">—</div><div class="l3">—</div></li>`).join("");
  desenharPartida();
  grafico();
}
function marcarAlvo() {
  for (const b of document.querySelectorAll("[data-alvo]")) b.setAttribute("aria-pressed", String(b.dataset.alvo === alvoKey));
  $("#livreRow").hidden = alvoKey !== "L";
  desenharPartida();
}

// ----------------------------------------------------------------------------- TSE ao vivo: 1 arquivo por vez; cada um a cada ~30 s
let timer = 0, idx = 0, novos = false, ultimoCalculo = 0;
const LISTA = ["br", ...UFS]; // o nacional primeiro: hora e % apurado aparecem logo
async function proximo() {
  if (modo !== "vivo") return;
  const uf = LISTA[idx++ % LISTA.length];
  try {
    const resp = await fetch(urlUF(uf, cd), { cache: "no-cache" }); // revalida com ETag pelo cache do navegador
    if (!resp.ok) throw new Error(`HTTP ${resp.status} em ${uf}`);
    const d = lerArquivo(await resp.json(), uf, cd);
    if (modo !== "vivo") return; // a simulação começou enquanto o arquivo chegava: não mistura
    if (uf === "br") br = d; else tse[uf.toUpperCase()] = d;
    ultimoOk = new Date(); ultimoErro = null;
    novos = true;
  } catch (e) { ultimoErro = e.message; horaErro = new Date(); }
  if (modo !== "vivo") return;
  if (novos && Date.now() - ultimoCalculo > 4000) { novos = false; ultimoCalculo = Date.now(); calcular(); }
  timer = setTimeout(proximo, Math.round(30000 / LISTA.length));
}

// ----------------------------------------------------------------------------- simulação (demonstração)
let simTimer = 0, simCen = null, HIST = null;
async function simular() {
  modo = "sim"; clearTimeout(timer); clearTimeout(simTimer);
  hist = []; marcarEsqueleto(true);
  HIST ??= await (await fetch("historico.json?v=20261025h")).json();
  const R = rng(Date.now() % 100000);
  // resultado final por estado: regiões, abstenção e limites históricos (simulado.js); a apuração anda por cima dele
  simCen = cenario(ESTADOS, HIST, R, { centro: alvo().centro, id: $("#cenario").value });
  const estados = ESTADOS.map((e) => ({ uf: e.uf, apurado1752: e.ap1752, V: simCen.V[e.uf], final: simCen.final[e.uf], u: R.n() * 4.5 }));
  const sim = apuracao(estados, { b: R.n() * 2 });
  let min = 0;
  const passo = () => {
    if (modo !== "sim") return;
    const q = sim(min);
    for (const e of ESTADOS) tse[e.uf] = { ...q[e.uf] };
    br = null;
    if (min >= 380) simCen.fim = true;
    calcular();
    min += 4;
    if (min <= 380) simTimer = setTimeout(passo, 700);
  };
  passo();
  rolarPara(null);
}
function aoVivo() {
  modo = "vivo"; clearTimeout(simTimer); clearTimeout(timer);
  for (const k of Object.keys(tse)) delete tse[k];
  br = null;
  hist = store.get("pv-hist-" + cd, []);
  marcarEsqueleto(true);
  idx = 0; calcular(); proximo();
}

// rola suave; se o navegador não animar (economia de bateria, aba em segundo plano), pula direto
function rolarPara(el) {
  const alvoY = el ? el.getBoundingClientRect().top + scrollY - (document.querySelector(".top")?.offsetHeight || 0) - 8 : 0;
  const y0 = scrollY;
  window.scrollTo({ top: alvoY, behavior: "smooth" });
  setTimeout(() => { if (Math.abs(scrollY - y0) < 2 && Math.abs(alvoY - y0) > 2) window.scrollTo(0, alvoY); }, 350);
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
  if (b.dataset.ordem) {
    ordem = b.dataset.ordem;
    for (const o of document.querySelectorAll("[data-ordem]")) o.setAttribute("aria-pressed", String(o.dataset.ordem === ordem));
    desenharEstados();
  }
  if (b.id === "trocar") rolarPara($("#previsao"));
  if (b.id === "infoBtn") { const ab = b.getAttribute("aria-expanded") !== "true"; b.setAttribute("aria-expanded", String(ab)); $("#favNota").hidden = !ab; }
  if (b.id === "horaBtn") { const ab = b.getAttribute("aria-expanded") !== "true"; b.setAttribute("aria-expanded", String(ab)); $("#horaDet").hidden = !ab; }
  if (b.id === "demo") { b.textContent = "Simulando…"; setTimeout(() => (b.textContent = "Simular de novo"), 1200); simular(); }
  if (b.id === "vivo") aoVivo();
  if (b.id === "mSalvar") {
    const uf = $("#mUF").value, f = Number($("#mF").value) / 100, A = Number($("#mA").value), B = Number($("#mB").value);
    if (["#mF", "#mA", "#mB"].some((id) => $(id).value.trim() === "") || !valida({ f, A, B })) { $("#mLista").textContent = "Preencha % de seções (maior que 0) e os votos dos dois candidatos."; return; }
    manual[uf] = { f, A, B }; store.set("pv-manual", manual); marcarEsqueleto(true); calcular();
  }
  if (b.id === "mLimpar") { manual = {}; store.set("pv-manual", manual); marcarEsqueleto(true); calcular(); }
});
$("#livre").addEventListener("change", (e) => { livre = Number(e.target.value); store.set("pv-livre", livre); marcarEsqueleto(true); desenharPartida(); calcular(); });
document.addEventListener("visibilitychange", () => { if (!document.hidden && modo === "vivo") { clearTimeout(timer); proximo(); } });

// ----------------------------------------------------------------------------- início
(async function inicio() {
  const est = await (await fetch("estados.json?v=20261025h", { cache: "no-cache" })).json();
  ESTADOS = est.map((r) => ({ uf: r.uf, regiao: r.regiao, outros: 1 - (r.lula26_1t + r.flavio26_1t) / r.validos26_1t, base: r.base26, Vesp: r.validos26_2t_esp, ap1752: r.apurado_17h52_1t26, secoes: r.validos26_2t_esp }));
  montarControles();
  marcarEsqueleto(true);
  try { const el = await descobrirEleicao(); cd = el.cd; } catch { /* fica com 6258, confirmado em 24/10 */ }
  hist = store.get("pv-hist-" + cd, []);
  $("#versao").textContent = `Eleição TSE ${cd}. Página estática: o seu navegador consulta o TSE diretamente; o cálculo roda em segundo plano. Motor ${MOTOR}${MOTOR === 2 ? " (regiões, votos de outros candidatos e comparecimento por região)" : ""}.`;
  if (new URLSearchParams(location.search).has("simulado")) simular(); else aoVivo();
})();
