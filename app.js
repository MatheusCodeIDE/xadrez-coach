import { Chess } from './lib/chess.js';
import { Board } from './board.js';
import { Engine, LEVELS, toCp } from './engine.js';
import { initTrain } from './train.js';
import { initEndgames } from './endgames.js';
import { initOpenings } from './openings.js';
import { openingsList, openingLines, analyzeGame, classify, summarize, evalFen, judgeAt, whyMove, bookStatus, bookSans, openingInfo, openingDesc, CLS, BAD, winPct, fmtSan, replay } from './analysis.js';

/* ---------- utilidades ---------- */
const $ = (s, r = document) => r.querySelector(s);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const store = {
  get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v === null || v === undefined ? d : v; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} },
};
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
let toastT;
function toast(msg, ms = 2600) {
  const t = $('#toast'); t.textContent = msg; t.classList.remove('hidden');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.add('hidden'), ms);
}
function openModal(html, onClose) { $('#modal-card').innerHTML = html; $('#modal').classList.remove('hidden'); $('#modal')._onClose = onClose || null; }
function closeModal() { $('#modal').classList.add('hidden'); const f = $('#modal')._onClose; $('#modal')._onClose = null; if (f) f(); }
$('#modal').addEventListener('pointerdown', (e) => { if (e.target.id === 'modal' && !$('#modal')._locked) closeModal(); });

let AC; let muted = store.get('xq.mute', false);
function beep(kind) {
  if (muted) return;
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    const o = AC.createOscillator(), g = AC.createGain();
    o.type = 'triangle'; o.frequency.value = kind === 'cap' ? 300 : kind === 'end' ? 520 : kind === 'chk' ? 620 : 440;
    g.gain.setValueAtTime(0.0001, AC.currentTime); g.gain.exponentialRampToValueAtTime(0.18, AC.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime + 0.12);
    o.connect(g).connect(AC.destination); o.start(); o.stop(AC.currentTime + 0.13);
  } catch (e) {}
}

const THEMES = { verde: ['#ebecd0', '#739552'], madeira: ['#f0d9b5', '#b58863'], azul: ['#dee3e6', '#8ca2ad'], roxo: ['#e8e4f0', '#8b7bb5'] };
function applyTheme(n) { const t = THEMES[n] || THEMES.verde; document.documentElement.style.setProperty('--light', t[0]); document.documentElement.style.setProperty('--dark', t[1]); }

function show(name) {
  for (const v of ['home', 'game', 'analysis', 'train']) $('#view-' + v).classList.toggle('hidden', v !== name);
  document.body.classList.toggle('noscroll', name !== 'home');
  $('#tabbar').classList.toggle('hidden', name !== 'home');
  $('#toast').classList.add('hidden');
  window.scrollTo(0, 0); document.body.scrollTop = 0; document.documentElement.scrollTop = 0;
}
const figSan = (san, color) => {
  const m = /^([KQRBN])(.*)$/.exec(san);
  if (!m) return san;
  return `<i class="fg pc-${color}${m[1].toLowerCase()}"></i>${m[2]}`;
};
const kingSq = (g) => {
  if (!g.isCheck()) return null;
  const t = g.turn();
  for (const row of g.board()) for (const p of row) if (p && p.type === 'k' && p.color === t) return p.square;
  return null;
};
const fmtEval = (cp) => {
  if (Math.abs(cp) >= 9000) return (cp > 0 ? '+M' : '-M') + (10000 - Math.abs(cp));
  return (cp >= 0 ? '+' : '') + (cp / 100).toFixed(2).replace('.', ',');
};
const lv = (id) => LEVELS.find((l) => l.id === id) || { name: 'Importada', elo: '' };
const lvName = (id) => lv(id).name;
const sanOf = (fen, uci) => { try { return fmtSan(new Chess(fen).move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }).san); } catch (e) { return uci; } };
const castleRook = (m) => {
  if (!m || !m.flags || !/[kq]/.test(m.flags)) return null;
  const r = m.color === 'w' ? '1' : '8';
  return m.flags.includes('k') ? { from: 'h' + r, to: 'f' + r } : { from: 'a' + r, to: 'd' + r };
};
function animList(m, rev) {
  if (!m) return null;
  const l = [{ from: m.from, to: m.to }]; const r = castleRook(m); if (r) l.push(r);
  return rev ? l.map((x) => ({ from: x.to, to: x.from })) : l;
}
const coachHTML = ({ badge, title, chip, text, extra, links }) => `
  <div class="coachrow"><div class="avatar"><div class="mascot"></div></div>
  <div class="bubble">
    <div class="top">${badge ? `<div class="bd" style="background:${badge.color}">${badge.sym}</div>` : ''}<div class="ttl">${title}</div>${chip ? `<div class="chip">${chip}</div>` : ''}</div>
    ${text ? `<div class="tx">${text}</div>` : ''}${extra ? `<div class="pv">${extra}</div>` : ''}${links ? `<div class="links">${links}</div>` : ''}
  </div></div>`;
const whyBox = (arr) => (arr && arr.length ? `<div class="why"><b>Por quê?</b> ${arr.join(' ')}</div>` : '');

function askPromotion(color) {
  return new Promise((res) => {
    const btn = (p) => `<button data-p="${p}"><div class="pc pc-${color}${p}"></div></button>`;
    $('#modal')._locked = true;
    openModal(`<h3 style="text-align:center">Promover peão para…</h3><div class="promo">${['q', 'r', 'b', 'n'].map(btn).join('')}</div>`);
    $('#modal-card').onclick = (e) => {
      const b = e.target.closest('button[data-p]'); if (!b) return;
      $('#modal')._locked = false; $('#modal-card').onclick = null; closeModal(); res(b.dataset.p);
    };
  });
}

/* ---------- motores ---------- */
let playEng = null, anaEng = null;
function getPlayEngine() { if (!playEng) playEng = new Engine(); return playEng; }
function getAnaEngine() { if (!anaEng) { anaEng = new Engine(); anaEng.setOptions({ UCI_LimitStrength: 'false', 'Skill Level': 20 }); } return anaEng; }

/* ---------- dados ---------- */
const games = () => store.get('xq.games', []);
const saveGames = (a) => store.set('xq.games', a);
let opts = Object.assign({ color: 'w', level: 3, mode: 'play', tc: 10, inc: 0, theme: 'verde', tcomm: 'all' }, store.get('xq.opts', {}));
applyTheme(opts.theme);
const saveOpts = () => store.set('xq.opts', opts);

/* =====================================================
   HOME
   ===================================================== */
let TR = null;
let tab = 'home';
const PROF_AV = ['wn', 'wk', 'wq', 'wr', 'wb', 'wp'];
const profile = () => Object.assign({ name: 'Jogador', av: 'wn' }, store.get('xq.profile', {}));
const resCls = (g) => {
  if (g.result === '1/2-1/2') return ['draw', '½'];
  const win = (g.result === '1-0') === (g.color === 'w');
  return win ? ['win', 'V'] : ['loss', 'D'];
};
function ratingOf(list) {
  let r = 800;
  for (const g of list) {
    if (!g.ranked || !g.levelId || g.mode === 'teach' || !g.result || g.result === '*') continue;
    const opp = lv(g.levelId).elo || 800; const sc = g.result === '1/2-1/2' ? 0.5 : (g.result === '1-0') === (g.color === 'w') ? 1 : 0;
    r += 32 * (sc - 1 / (1 + Math.pow(10, (opp - r) / 400)));
  }
  return Math.round(r);
}
const myRating = () => ratingOf(games());
function avgAccuracy() {
  const accs = [];
  for (const g of games()) {
    if (!g.analysis || !g.analysis.evals) continue;
    try { const r = classify(g.start, g.ucis, g.analysis.evals, g.color); accs.push(summarize(r.info, g.color, g.ucis).me.acc); } catch (e) {}
  }
  return accs.length ? Math.round(accs.reduce((a, b) => a + b, 0) / accs.length) : null;
}
function gameStats() {
  const gs = games().filter((g) => g.result && g.result !== '*'); const s = { n: gs.length, w: 0, d: 0, l: 0 };
  gs.forEach((g) => { const c = resCls(g)[0]; if (c === 'win') s.w++; else if (c === 'draw') s.d++; else s.l++; });
  return s;
}
const avHTML = (av, cls = '') => `<div class="avs me ${cls}"><div class="pc pc-${av}"></div></div>`;
const TABS = [['home', 'Início', '♟'], ['train', 'Desafios', '🧩'], ['learn', 'Aprender', '🎓'], ['me', 'Perfil', '👤']];

function renderHome(t) {
  const keep = !t || t === tab; const y = keep && !$('#view-home').classList.contains('hidden') ? window.scrollY : 0;
  if (t) tab = t;
  show('home'); stopClock();
  document.body.classList.toggle('pplay', tab === 'play');
  const nav = $('#tabbar'); nav.classList.toggle('hidden', tab === 'play');
  nav.innerHTML = TABS.map(([k, l, i]) => `<button data-t="${k}" class="${tab === k ? 'on' : ''}"><span>${i}</span>${l}</button>`).join('');
  nav.querySelectorAll('button').forEach((b) => (b.onclick = () => renderHome(b.dataset.t)));
  ({ home: pageHome, train: pageTrain, learn: pageLearn, me: pageMe, play: pagePlay }[tab] || pageHome)();
  if (y) window.scrollTo(0, y);
}

function topBar() {
  const p = profile(); const st = TR.streak();
  return `<div class="topbar">${avHTML(p.av)}<div class="who"><b>${p.name}</b><span>Rating estimado ${myRating()}</span></div><div class="flame">🔥<b>${st}</b></div></div>`;
}

function pageHome() {
  const cur = store.get('xq.current', null); const list = games().slice().reverse();
  const gs = gameStats(); const acc = avgAccuracy(); const ts = TR.totals();
  const lvlTxt = (g) => `${g.color === 'w' ? 'Brancas' : 'Pretas'} · ${lvName(g.levelId)}${g.mode === 'teach' ? ' · Ensino' : ''}`;
  const tile = (ic, big, small) => `<div class="stile"><div class="ic">${ic}</div><b>${big}</b><span>${small}</span></div>`;
  $('#view-home').innerHTML = `<div class="page">${topBar()}<div class="cols"><div class="colA">
    <div class="hero2" id="h-daily"><div><small>Desafio do dia</small><h2>Problemas</h2><p>${TR.dailyDone() ? '✅ Feito hoje! Volte amanhã.' : 'Um novo desafio tático espera por você.'}</p></div><div class="mascot" style="width:84px;height:84px"></div><button class="btn primary">${TR.dailyDone() ? 'Rever' : 'Resolva!'}</button></div>
    ${cur ? `<div class="card slim"><h3>Partida em andamento</h3><div class="row"><div class="grow muted" style="font-size:14px">${cur.ucis.length} lances · ${lvName(cur.levelId)}${cur.mode === 'teach' ? ' · Ensino' : ''}</div><button class="btn primary small" id="h-resume">Continuar</button></div></div>` : ''}
    <div class="sec"><h3>Estatísticas</h3><button class="lnk" id="h-allst">Ver todos</button></div>
    <div class="hscroll">${tile('♟', gs.n, 'Partidas')}${tile('🏆', gs.w, 'Vitórias')}${tile('🎯', acc === null ? '—' : acc + '%', 'Precisão média')}${tile('🧩', ts.solved, 'Problemas resolvidos')}${tile('📈', myRating(), 'Rating estimado')}</div>
    </div><div class="colB">
    <div class="sec"><h3>Minhas partidas</h3>${list.length > 4 ? '<button class="lnk" id="h-allg">Ver todas</button>' : ''}</div>
    <div class="card slim">${list.length ? list.slice(0, 4).map((g) => histRow(g, lvlTxt)).join('') : '<div class="muted" style="font-size:14px">Nenhuma partida ainda. Toque em <b>Jogar</b> e depois peça a análise no final!</div>'}
      <button class="btn small" id="h-import" style="width:100%;margin-top:10px">Importar PGN (de outro app)</button></div>
    </div></div>
    <div style="height:150px"></div></div>
    <button id="playbtn" class="playbtn">Jogar</button>`;
  const v = $('#view-home');
  $('#playbtn').onclick = () => renderHome('play');
  $('#h-daily').onclick = () => TR.startDaily();
  if (cur) $('#h-resume').onclick = () => startGame(cur, true);
  $('#h-allst').onclick = () => renderHome('me');
  const ag = $('#h-allg'); if (ag) ag.onclick = () => showAllGames();
  bindHist(v); $('#h-import').onclick = importPgnDialog;
}
const ACC = new Map();
function accOf(g) {
  if (!g.analysis || !g.analysis.evals) return null;
  if (ACC.has(g.id)) return ACC.get(g.id);
  let v = null; try { const r = classify(g.start, g.ucis, g.analysis.evals, g.color); v = Math.round(summarize(r.info, g.color, g.ucis).me.acc); } catch (e) {}
  ACC.set(g.id, v); return v;
}
function histRow(g, lvlTxt) {
  const [c, t] = resCls(g); const acc = accOf(g);
  return `<div class="hist" data-id="${g.id}"><div class="res ${c}">${t}</div>
    <div class="meta"><b>${lvlTxt(g)}</b><span>${new Date(g.date).toLocaleDateString('pt-BR')} · ${g.ucis.length} lances${g.ranked ? ' · ranqueada' + (g.delta !== undefined ? ' (' + (g.delta >= 0 ? '+' : '−') + Math.abs(g.delta) + ')' : '') : ''}</span></div>
    <button class="btn small ${acc !== null ? 'accb' : ''}" data-a="${g.id}">${acc !== null ? '★ ' + acc + '%' : 'Analisar'}</button><button class="ibtn" data-d="${g.id}" style="width:34px;height:34px;font-size:14px">✕</button></div>`;
}
function bindHist(v) {
  v.querySelectorAll('[data-a]').forEach((b) => (b.onclick = () => openAnalysis(games().find((g) => g.id === b.dataset.a))));
  v.querySelectorAll('[data-d]').forEach((b) => (b.onclick = () => {
    if (confirm('Excluir esta partida?')) { saveGames(games().filter((g) => g.id !== b.dataset.d)); renderHome(); }
  }));
}
function showAllGames() {
  const list = games().slice().reverse();
  const lvlTxt = (g) => `${g.color === 'w' ? 'Brancas' : 'Pretas'} · ${lvName(g.levelId)}${g.mode === 'teach' ? ' · Ensino' : ''}`;
  openModal(`<h3>Todas as partidas</h3><div style="margin-top:8px">${list.map((g) => histRow(g, lvlTxt)).join('')}</div><button class="btn" id="x-c" style="width:100%;margin-top:10px">Fechar</button>`);
  $('#x-c').onclick = closeModal; bindHist($('#modal-card'));
}

function pageTrain() {
  const ts = TR.totals();
  $('#view-home').innerHTML = `<div class="page">${topBar()}<h1 class="pgt">Desafios</h1>
    <p class="muted" style="font-size:14px;margin:-6px 2px 12px;line-height:1.4">Treine contra os erros que jogadores humanos realmente cometem.</p>
    <button class="hub" id="t-day"><i>📅</i><div><b>Desafio do dia</b><span>${TR.dailyDone() ? '✅ Feito hoje' : 'Um problema novo por dia'}</span></div><em>${TR.streak() ? '🔥 ' + TR.streak() : ''}</em></button>
    <p class="muted" style="font-size:12.5px;margin:-4px 4px 10px;line-height:1.4">🧊 Perdoa 1 dia perdido por semana: ${TR.freezeAvail() ? 'seu congelamento está disponível.' : 'já usado esta semana.'}</p>
    <button class="hub" id="t-tac"><i>♞</i><div><b>Táticas</b><span id="t-tac-s">${ts.n ? `${ts.solved}/${ts.n} resolvidos · do Fácil ao Impossível` : 'Do Fácil ao Impossível'}</span></div><em>›</em></button>
    <button class="hub" id="t-vis"><i>👁</i><div><b>Enxergar o tabuleiro</b><span>Casas, cores e peças soltas</span></div><em>›</em></button>
    <button class="hub" id="t-end"><i>♚</i><div><b>Finais</b><span>Mate com dama e torre, rei e peão, Lucena</span></div><em>›</em></button>
    <button class="hub" id="t-opn"><i>📖</i><div><b>Treino de aberturas</b><span>${OPN.mastered()} dominadas · pratique a linha de livro</span></div><em>›</em></button>
    <button class="hub" id="t-rev"><i>🔁</i><div><b>Revisar meus erros</b><span>${TR.reviewCount() ? TR.reviewCount() + ' lances das suas partidas' : 'Analise uma partida primeiro'}</span></div><em>›</em></button>
    <div style="height:90px"></div></div>`;
  const b = (id, f) => { const e = $(id); if (e) e.onclick = f; };
  b('#t-day', () => TR.startDaily()); b('#t-tac', () => TR.menuTactics()); b('#t-vis', () => TR.menuVis()); b('#t-rev', () => TR.startReview()); b('#t-end', () => EG.menu()); b('#t-opn', () => OPN.menu());
  TR.ready().then(() => { const e = $('#t-tac-s'); if (e) { const t2 = TR.totals(); e.textContent = `${t2.solved}/${t2.n} resolvidos · do Fácil ao Impossível`; } });
}

function pageLearn() {
  const ops = openingsList();
  $('#view-home').innerHTML = `<div class="page">${topBar()}<h1 class="pgt">Aprender</h1>
    <div class="hero2 teach" id="l-teach"><div><small>Modo Ensino</small><h2>Jogue e aprenda</h2><p>O treinador comenta seus lances e o Stockfish responde sozinho.</p></div><div class="mascot" style="width:84px;height:84px"></div><button class="btn primary">Começar</button></div>
    <div class="sec"><h3>Antes de cada lance</h3></div>
    <div class="card slim"><ol class="tips" style="margin-left:18px"><li><b>O que o adversário ameaça?</b> Olhe o último lance dele.</li><li><b>Xeques, capturas, ameaças</b> — nessa ordem, para os dois lados.</li><li><b>Minhas peças estão protegidas?</b> E as dele?</li></ol></div>
    <div class="sec"><h3>Aberturas</h3></div>
    <div class="card slim">${ops.map((o, i) => `<button class="oprow" data-o="${i}"><b>${o.name}</b><span>${o.moves}</span></button>`).join('')}</div>
    <div class="sec"><h3>Revisar uma partida</h3></div>
    <div class="card slim"><p class="muted" style="font-size:14px;line-height:1.4;margin-bottom:8px">Jogou contra um humano? Cole o PGN (chess.com: Compartilhar → PGN) e veja onde errou.</p><button class="btn" id="l-imp" style="width:100%">Importar PGN</button></div>
    <div style="height:90px"></div></div>`;
  $('#l-teach').onclick = () => { opts.mode = 'teach'; saveOpts(); renderHome('play'); };
  $('#l-imp').onclick = importPgnDialog;
  $('#view-home').querySelectorAll('[data-o]').forEach((b) => (b.onclick = () => { const o = ops[+b.dataset.o]; openModal(`<h3>${o.name}</h3><p class="muted" style="margin:6px 0;line-height:1.45">${o.desc}</p><div class="book" style="margin:8px 0 12px">Lances: <b>${o.moves}</b></div><button class="btn" id="x-c" style="width:100%">Fechar</button>`); $('#x-c').onclick = closeModal; }));
}


// séries para os gráficos de progresso
function ratingSeries() {
  const out = [{ r: 800 }]; let r = 800;
  for (const g of games()) {
    if (!g.ranked || !g.levelId || g.mode === 'teach' || !g.result || g.result === '*') continue;
    const opp = lv(g.levelId).elo || 800; const sc = g.result === '1/2-1/2' ? 0.5 : (g.result === '1-0') === (g.color === 'w') ? 1 : 0;
    r += 32 * (sc - 1 / (1 + Math.pow(10, (opp - r) / 400))); out.push({ r: Math.round(r) });
  }
  return out.map((o) => o.r);
}
function accSeries() {
  const out = [];
  for (const g of games()) {
    if (!g.analysis || !g.analysis.evals) continue;
    try { const r = classify(g.start, g.ucis, g.analysis.evals, g.color); out.push(Math.round(summarize(r.info, g.color, g.ucis).me.acc)); } catch (e) {}
  }
  return out;
}
function lineChart(vals, color, unit = '') {
  vals = vals.slice(-30);
  if (vals.length < 2) return '<div class="muted" style="font-size:13px;padding:6px 2px">Jogue mais partidas para ver o gráfico.</div>';
  const W = 320, H = 110, pl = 30, pr = 8, pt = 10, pb = 10;
  let lo = Math.min(...vals), hi = Math.max(...vals); if (hi - lo < 10) { lo -= 5; hi += 5; }
  const x = (i) => pl + (i * (W - pl - pr)) / (vals.length - 1), y = (v) => pt + (H - pt - pb) * (1 - (v - lo) / (hi - lo));
  const pts = vals.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const area = `${pl},${H - pb} ${pts} ${x(vals.length - 1).toFixed(1)},${H - pb}`;
  const last = vals[vals.length - 1], d = last - vals[0];
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block"><polygon points="${area}" fill="${color}" opacity=".15"/><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round"/>
    <text x="2" y="${y(hi) + 4}" fill="#8d8a83" font-size="10">${Math.round(hi)}</text><text x="2" y="${y(lo) + 3}" fill="#8d8a83" font-size="10">${Math.round(lo)}</text>
    <circle cx="${x(vals.length - 1)}" cy="${y(last)}" r="4" fill="${color}"/></svg>
    <div class="muted" style="font-size:12.5px;margin-top:2px">Agora: <b style="color:#fff">${last}${unit}</b> · ${d >= 0 ? '+' : ''}${d}${unit} no período (${vals.length} ${unit ? 'partidas' : 'pontos'})</div>`;
}

function pageMe() {
  const p = profile(); const gs = gameStats(); const acc = avgAccuracy(); const ts = TR.totals(); const pg = TR.progress();
  const row = (a, b) => `<div class="kv"><span>${a}</span><b>${b}</b></div>`;
  $('#view-home').innerHTML = `<div class="page"><h1 class="pgt">Perfil</h1>
    <div class="card slim" style="text-align:center">${avHTML(p.av, 'big')}
      <div class="avpick">${PROF_AV.map((a) => `<button data-av="${a}" class="${p.av === a ? 'on' : ''}"><div class="pc pc-${a}"></div></button>`).join('')}</div>
      <input id="p-name" class="txt" maxlength="20" value="${p.name}" placeholder="Seu nome"></div>
    <div class="sec"><h3>Estatísticas</h3></div>
    <div class="card slim">${row('Rating estimado', myRating())}${row('Partidas', gs.n)}${row('Vitórias · Empates · Derrotas', `${gs.w} · ${gs.d} · ${gs.l}`)}${row('Precisão média', acc === null ? '—' : acc + '%')}${row('Problemas resolvidos', `${ts.solved}/${ts.n}`)}${row('Sequência de dias', `${TR.streak()} (recorde ${pg.streak.best})`)}${row('🧊 Congelamento da semana', TR.freezeAvail() ? 'disponível' : 'já usado')}${row('Recorde: achar a casa', pg.vis.coord || 0)}${row('Recorde: cor da casa', pg.vis.color || 0)}${row('Recorde: peças soltas', (pg.vis.hang || 0) + '/8')}</div>
    <div class="sec"><h3>Progresso</h3></div>
    <div class="card slim"><div class="lbl" style="margin-top:0">Rating estimado (partidas ranqueadas)</div>${lineChart(ratingSeries(), '#81b64c')}
      <div class="lbl">Precisão (partidas analisadas)</div>${lineChart(accSeries(), '#5c8bb0', '%')}</div>
    <div class="sec"><h3>Seus erros mais comuns</h3></div>
    <div class="card slim" id="pat">${(() => { const pt = TR.patterns(); if (!pt.total) return '<p class="muted" style="font-size:14px;line-height:1.4">Analise suas partidas (toque em <b>Analisar</b>) para ver quais erros mais se repetem.</p>'; const mx = pt.list[0].n; return `<p class="muted" style="font-size:13px;margin-bottom:8px">Com base em ${pt.total} ${pt.total === 1 ? "erro ou capivarada" : "erros e capivaradas"} das suas partidas analisadas.</p>` + pt.list.slice(0, 5).map((o) => `<div class="patrow"><div class="pl"><b>${o.name}</b><span>${o.n}×</span></div><div class="pb"><i style="width:${Math.round((o.n / mx) * 100)}%"></i></div><small>${o.tip}</small><button class="btn small" data-pt="${o.tag}">Treinar este erro</button></div>`).join(''); })()}</div>
    <div class="sec"><h3>Ajustes</h3></div>
    <div class="card slim"><div class="lbl" style="margin-top:0">Tabuleiro</div>
      <div class="themes" id="h-themes">${Object.entries(THEMES).map(([k, t]) => `<button class="theme ${opts.theme === k ? 'on' : ''}" data-th="${k}"><i style="background:${t[0]}"></i><i style="background:${t[1]}"></i><i style="background:${t[1]}"></i><i style="background:${t[0]}"></i></button>`).join('')}</div>
      <div class="lbl">Comentários no Modo Ensino</div>
      <div class="seg" id="h-comm"><button data-q="all" class="${opts.tcomm !== 'bad' ? 'on' : ''}">Todos os lances</button><button data-q="bad" class="${opts.tcomm === 'bad' ? 'on' : ''}">Só erros e capivaradas</button></div>
      <div class="lbl">Som</div>
      <div class="seg" id="h-snd"><button data-s="1" class="${!muted ? 'on' : ''}">🔊 Ligado</button><button data-s="0" class="${muted ? 'on' : ''}">🔇 Desligado</button></div></div>
    <div class="sec"><h3>Backup dos dados</h3></div>
    <div class="card slim"><p class="muted" style="font-size:13px;line-height:1.4;margin-bottom:8px">Seus dados ficam só neste aparelho. Para trocar de celular ou não perder nada, exporte e depois importe no outro.</p>
      <div class="row"><button class="btn grow" id="b-exp">Exportar</button><button class="btn grow" id="b-imp">Importar</button></div></div>
    <p class="muted" style="text-align:center;font-size:12px;padding:12px 20px 0">Tudo roda no seu aparelho, sem internet. Motor: Stockfish 19 · Peças: Cardinal (sadsnake1)</p>
    <div style="height:90px"></div></div>`;
  const v = $('#view-home');
  v.querySelectorAll('[data-av]').forEach((b) => (b.onclick = () => { const q = profile(); q.av = b.dataset.av; store.set('xq.profile', q); renderHome(); }));
  $('#p-name').onchange = (e) => { const q = profile(); q.name = e.target.value.trim() || 'Jogador'; store.set('xq.profile', q); toast('Nome salvo'); };
  v.querySelectorAll('[data-pt]').forEach((b) => (b.onclick = () => TR.startReview(b.dataset.pt)));
  v.querySelectorAll('.theme').forEach((b) => (b.onclick = () => { opts.theme = b.dataset.th; applyTheme(opts.theme); saveOpts(); renderHome(); }));
  v.querySelectorAll('#h-comm button').forEach((b) => (b.onclick = () => { opts.tcomm = b.dataset.q; saveOpts(); renderHome(); }));
  v.querySelectorAll('#h-snd button').forEach((b) => (b.onclick = () => { muted = b.dataset.s === '0'; store.set('xq.mute', muted); renderHome(); }));
  $('#b-exp').onclick = exportData; $('#b-imp').onclick = importData;
}
function exportData() {
  const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith('xq.')) o[k] = localStorage.getItem(k); }
  const txt = JSON.stringify({ app: 'xadrez-coach', v: 1, data: o });
  try {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: 'application/json' })); a.download = 'xadrez-coach-backup.json'; document.body.appendChild(a); a.click(); a.remove();
    toast('Backup baixado.');
  } catch (e) { openModal(`<h3>Backup</h3><textarea id="bk" readonly>${txt}</textarea><button class="btn" id="x-c" style="width:100%;margin-top:8px">Fechar</button>`); $('#x-c').onclick = closeModal; }
}
function importData() {
  openModal(`<h3>Importar backup</h3><p class="muted" style="font-size:14px;margin:4px 0 8px">Escolha o arquivo de backup ou cole o conteúdo. Isso substitui os dados atuais.</p><input type="file" id="bk-f" accept=".json,application/json" style="margin-bottom:8px"><textarea id="bk" placeholder="Cole aqui o conteúdo do backup"></textarea><div class="row" style="margin-top:10px"><button class="btn grow" id="x-c">Cancelar</button><button class="btn primary grow" id="x-ok">Importar</button></div>`);
  $('#bk-f').onchange = async (e) => { const f = e.target.files[0]; if (f) $('#bk').value = await f.text(); };
  $('#x-c').onclick = closeModal;
  $('#x-ok').onclick = () => {
    try { const o = JSON.parse($('#bk').value); if (o.app !== 'xadrez-coach') throw 0; Object.entries(o.data).forEach(([k, v]) => { if (k.startsWith('xq.')) localStorage.setItem(k, v); }); closeModal(); toast('Dados importados!'); location.reload(); }
    catch (e) { toast('Arquivo de backup inválido.'); }
  };
}

const TCS = [
  ['Bullet', [[1, 0, '1 min'], [1, 1, '1 | 1'], [2, 1, '2 | 1']]],
  ['Blitz', [[3, 0, '3 min'], [3, 2, '3 | 2'], [5, 0, '5 min']]],
  ['Rápida', [[10, 0, '10 min'], [15, 10, '15 | 10'], [30, 0, '30 min']]],
];
function pagePlay() {
  const teach = opts.mode === 'teach';
  const tcBtn = ([m, i, l]) => `<button data-t="${m}" data-i="${i}" class="${opts.tc === m && (opts.inc || 0) === i ? 'on' : ''}">${l}</button>`;
  $('#view-home').innerHTML = `<div class="page"><div class="hdr" style="position:static;padding:6px 0"><button class="ibtn" id="p-back">←</button><h2 style="text-align:center">Nova partida</h2><span style="width:40px"></span></div>
    <div class="card slim"><div class="seg" id="h-mode"><button data-m="play" class="${!teach ? 'on' : ''}">♟ Partida</button><button data-m="teach" class="${teach ? 'on' : ''}">🎓 Modo Ensino</button></div>
      <p class="muted" style="font-size:13px;margin:8px 2px 0">${teach ? 'Você joga, o treinador comenta e o Stockfish responde sozinho. Dá para ver o melhor lance e tentar de novo.' : 'Partida contra o Stockfish. Os relógios rápidos (bullet e blitz) são só para treinar contra o bot, offline.'}</p></div>
    ${teach ? '' : `<div class="card slim"><div class="seg" id="h-rank"><button data-r="1" class="${opts.ranked !== false ? 'on' : ''}">🏆 Ranqueada</button><button data-r="0" class="${opts.ranked === false ? 'on' : ''}">🧪 Treino</button></div>
      <p class="muted" style="font-size:13px;margin:8px 2px 0;line-height:1.4">${opts.ranked !== false ? 'Vale rating. Sem desfazer, sem dica e sem análise durante a partida, como numa partida de verdade.' : 'Não vale rating. Você pode desfazer, pedir dica e analisar durante a partida.'}</p></div>`}
    <div class="card slim"><div class="lbl" style="margin-top:0">Jogar com</div>
      <div class="seg" id="h-color"><button data-c="w" class="${opts.color === 'w' ? 'on' : ''}">♔ Brancas</button><button data-c="r" class="${opts.color === 'r' ? 'on' : ''}">🎲 Sorteio</button><button data-c="b" class="${opts.color === 'b' ? 'on' : ''}">♚ Pretas</button></div>
      ${teach ? '' : `<div class="lbl">Relógio</div>${TCS.map(([n, l]) => `<div class="tcrow"><small>${n}</small><div class="seg small">${l.map(tcBtn).join('')}</div></div>`).join('')}<div class="tcrow"><small>Treino</small><div class="seg small"><button data-t="0" data-i="0" class="${!opts.tc ? 'on' : ''}">∞ Sem relógio</button></div></div>`}
      <div class="lbl">Adversário</div>
      <div class="levels" id="h-levels">${LEVELS.map((l) => `<button class="lv ${opts.level === l.id ? 'on' : ''}" data-l="${l.id}"><b>${l.name} <small class="muted">${l.elo}</small></b><span>${l.desc}</span></button>`).join('')}</div></div>
    <div style="height:100px"></div></div>
    <button id="playbtn" class="playbtn">${teach ? 'Começar a aprender' : 'Jogar'}</button>`;
  const v = $('#view-home');
  $('#p-back').onclick = () => renderHome('home');
  v.querySelectorAll('#h-mode button').forEach((b) => (b.onclick = () => { opts.mode = b.dataset.m; saveOpts(); renderHome(); }));
  v.querySelectorAll('#h-rank button').forEach((b) => (b.onclick = () => { opts.ranked = b.dataset.r === '1'; saveOpts(); renderHome(); }));
  v.querySelectorAll('#h-color button').forEach((b) => (b.onclick = () => { opts.color = b.dataset.c; saveOpts(); renderHome(); }));
  v.querySelectorAll('.tcrow button').forEach((b) => (b.onclick = () => { opts.tc = +b.dataset.t; opts.inc = +b.dataset.i; saveOpts(); renderHome(); }));
  v.querySelectorAll('.lv').forEach((b) => (b.onclick = () => { opts.level = +b.dataset.l; saveOpts(); renderHome(); }));
  $('#playbtn').onclick = () => {
    const c = opts.color === 'r' ? (Math.random() < 0.5 ? 'w' : 'b') : opts.color;
    startGame({ color: c, levelId: opts.level, mode: opts.mode, ranked: opts.ranked !== false, tc: opts.mode === 'teach' ? 0 : opts.tc, inc: opts.mode === 'teach' ? 0 : opts.inc || 0 });
  };
}

function importPgnDialog() {
  openModal(`<h3>Importar PGN</h3><p class="muted" style="font-size:14px;margin:4px 0 10px">Cole o PGN da partida (chess.com: Compartilhar → PGN; lichess: Exportar).</p>
    <textarea id="pgn-t" placeholder="1. e4 e5 2. Nf3 ..."></textarea>
    <div class="seg" id="pgn-c" style="margin-top:10px"><button data-c="w" class="on">Eu era as Brancas</button><button data-c="b">Eu era as Pretas</button></div>
    <div class="row" style="margin-top:12px"><button class="btn grow" id="pgn-x">Cancelar</button><button class="btn primary grow" id="pgn-ok">Analisar</button></div>`);
  let col = 'w';
  $('#pgn-c').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; col = b.dataset.c; $('#pgn-c').querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); };
  $('#pgn-x').onclick = closeModal;
  $('#pgn-ok').onclick = () => {
    const txt = $('#pgn-t').value.trim();
    try {
      const g = new Chess(); g.loadPgn(txt);
      const h = g.history({ verbose: true });
      if (!h.length) throw new Error('vazio');
      const hd = g.getHeaders();
      const start = hd.FEN && hd.SetUp !== '0' ? hd.FEN : undefined;
      const rec = { id: uid(), date: Date.now(), start, ucis: h.map((m) => m.from + m.to + (m.promotion || '')), color: col, levelId: 0, result: hd.Result || '*' };
      const all = games(); all.push(rec); saveGames(all);
      closeModal(); openAnalysis(rec);
    } catch (e) { toast('Não consegui ler esse PGN. Confira se ele está completo.'); }
  };
}

/* =====================================================
   JOGO (partida normal e Modo Ensino)
   ===================================================== */
const G = { game: null, start: undefined, color: 'w', levelId: 3, mode: 'play', tc: 0, clock: { w: 0, b: 0 }, ucis: [], fens: [], over: null, thinking: false, gen: 0, flip: false, hint: null, hintSan: '', hintWhy: [], hinting: false, view: null, msg: '', anim: null, teach: { phase: 'idle', judge: null, showBest: false, tt: 0, note: null, cp: 0, show: false, jply: -1 } };
let gBoard = null;

function startGame(cfg, resume = false) {
  tab = 'home';
  G.start = cfg.start; G.color = cfg.color; G.levelId = cfg.levelId; G.mode = cfg.mode || 'play'; G.ranked = !!cfg.ranked && G.mode !== 'teach' && !cfg.start;
  G.tc = G.mode === 'teach' ? 0 : (cfg.tc === undefined ? 10 : cfg.tc); G.inc = G.mode === 'teach' ? 0 : (cfg.inc || 0);
  G.ucis = []; G.over = null; G.thinking = false; G.hint = null; G.hinting = false; G.flip = false; G.view = null; G.anim = null; G.gen++;
  G.game = cfg.start ? new Chess(cfg.start) : new Chess(); G.fens = [G.game.fen()];
  if (resume) for (const u of cfg.ucis) { G.game.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }); G.ucis.push(u); G.fens.push(G.game.fen()); }
  G.clock = resume && cfg.clock ? cfg.clock : { w: G.tc * 60000, b: G.tc * 60000 };
  G.teach = { phase: 'idle', judge: null, showBest: false, tt: 0, note: null, cp: 0, show: false, jply: -1 };
  G.msg = resume ? 'Bem-vindo de volta! Continue de onde parou.' : G.color === 'w' ? 'Vamos jogar! Você tem as brancas, faça o primeiro lance.' : 'Você joga com as pretas. Vou começar!';
  buildGameView(); show('game');
  try {
    getPlayEngine().setOptions(Object.assign({ UCI_LimitStrength: 'false', 'Skill Level': 20 }, lv(G.levelId).opts));
  } catch (err) { toast('Não foi possível iniciar o motor de xadrez.'); }
  saveCurrent(); renderGame(); startClock();
  if (!G.over && G.game.turn() !== G.color) engineMove();
}

function saveCurrent() {
  if (G.over) return;
  store.set('xq.current', { start: G.start, color: G.color, levelId: G.levelId, mode: G.mode, ranked: G.ranked, tc: G.tc, inc: G.inc, clock: G.clock, ucis: G.ucis });
}

/* ----- relógio ----- */
let clockT = null, lastTick = 0;
function startClock() { stopClock(); if (!G.tc) return; lastTick = performance.now(); clockT = setInterval(tickClock, 100); updateClocks(); }
function stopClock() { if (clockT) clearInterval(clockT); clockT = null; }
function tickClock() {
  const now = performance.now(); const dt = now - lastTick; lastTick = now;
  if (G.over || !G.game) return;
  if (G.ucis.length >= 1) {
    const side = G.game.turn(); G.clock[side] -= dt;
    if (G.clock[side] <= 0) { G.clock[side] = 0; updateClocks(); finishGame(side === 'w' ? '0-1' : '1-0', 'Tempo esgotado.'); return; }
  }
  updateClocks();
}
const fmtClock = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
function updateClocks() {
  if (!G.tc || !G.game) return;
  for (const c of ['w', 'b']) {
    const el = $('#clk-' + c); if (!el) continue;
    el.textContent = fmtClock(G.clock[c]);
    el.classList.toggle('on', !G.over && G.ucis.length >= 1 && G.game.turn() === c);
    el.classList.toggle('low', G.clock[c] < 30000);
  }
}

/* ----- construção da tela ----- */
function buildGameView() {
  const teach = G.mode === 'teach';
  const hdr = (title) => `<div class="hdr"><button class="ibtn" id="g-back">←</button>${title}<button class="ibtn" id="g-mute">${muted ? '🔇' : '🔊'}</button></div>`;
  if (teach) {
    $('#view-game').innerHTML = `<div class="screen teach">
      ${hdr(`<h2>Modo Ensino · ${lvName(G.levelId)}</h2>`)}
      <div class="hbar" id="g-eval"></div>
      <div id="g-coach" style="display:flex;flex-direction:column;flex:1 1 auto;min-height:0"></div>
      <div class="pcard slim" id="g-top"></div>
      <div class="boardwrap"><div id="g-board"></div></div>
      <div class="pcard slim" id="g-bot"></div>
      <div class="dock"><div class="navstrip"><button class="arr" id="g-prev">‹</button><div class="strip" id="g-strip"></div><button class="arr" id="g-nextarr">›</button></div>
      <div class="tb4"><button class="t" id="g-undo"><span>↶</span>Desfazer</button><button class="t" id="g-best"><span>★</span>Melhor</button><button class="t" id="g-hint"><span>💡</span>Dica</button><button class="t" id="g-comm"><span>💬</span><em></em></button></div></div>
    </div>`;
  } else {
    $('#view-game').innerHTML = `<div class="screen play">
      ${hdr(`<div class="brand"><i class="mascot"></i><span>Xadrez <b>Coach</b></span></div>`)}
      <div class="strip bar" id="g-strip"></div>
      <div class="sp"></div>
      <div class="pcard" id="g-top"></div>
      <div class="boardwrap"><div id="g-board"></div></div>
      <div class="pcard" id="g-bot"></div>
      <div class="sp"></div>
      <div class="tbp"><button id="g-menu">☰</button><button id="g-undo">↶</button><button class="star" id="g-hint">💡</button><button id="g-prev">‹</button><button id="g-nextarr">›</button></div>
    </div>`;
  }
  gBoard = new Board($('#g-board'), {
    canSelect: (sq) => canMoveNow() && (G.game.get(sq) || {}).color === G.color,
    getTargets: (sq) => G.game.moves({ square: sq, verbose: true }).map((m) => ({ to: m.to, capture: !!m.captured })),
    onMove: userMove,
  });
  $('#g-back').onclick = () => leaveGame(() => { G.gen++; G.teach.tt++; stopClock(); renderHome(); });
  $('#g-mute').onclick = () => { muted = !muted; store.set('xq.mute', muted); $('#g-mute').textContent = muted ? '🔇' : '🔊'; };
  $('#g-undo').onclick = undoMove;
  $('#g-hint').onclick = giveHint;
  $('#g-prev').onclick = () => gNav(-1);
  $('#g-nextarr').onclick = () => gNav(1);
  $('#g-strip').onclick = (e) => { const b = e.target.closest('[data-p]'); if (b) gJump(+b.dataset.p); };
  if (teach) {
    $('#g-best').onclick = () => { if (G.teach.judge && G.teach.phase !== 'eval') { G.teach.showBest = !G.teach.showBest; renderGame(); } };
    $('#g-comm').onclick = () => { opts.tcomm = opts.tcomm === 'bad' ? 'all' : 'bad'; saveOpts(); renderGame(); toast(opts.tcomm === 'bad' ? 'Vou comentar só os erros e capivaradas.' : 'Vou comentar todos os seus lances.', 2200); };
    $('#g-coach').onclick = (e) => {
      const a = e.target.closest('[data-act]'); if (!a) return;
      if (a.dataset.act === 'best') { G.teach.showBest = true; renderGame(); }
      if (a.dataset.act === 'retry') undoMove();
      if (a.dataset.act === 'back') { G.teach.showBest = false; renderGame(); }
    };
  } else $('#g-menu').onclick = openGameMenu;
  $('#view-game').onclick = (e) => { const b = e.target.closest('#g-menu-x'); if (b) openGameMenu(); };
}
function openGameMenu() {
  openModal(`<h3>Menu</h3><div style="display:flex;flex-direction:column;gap:8px;margin-top:10px">
      <button class="btn" id="m-flip">⇅ Virar tabuleiro</button>
      <button class="btn" id="m-ana">📊 Analisar partida até aqui</button>
      <button class="btn" id="m-pgn">📋 Copiar PGN</button>
      <button class="btn danger" id="m-res">🏳 Desistir</button>
      <button class="btn" id="m-new">Nova partida</button></div>`);
}
document.addEventListener('click', (e) => {
  const id = e.target.closest('button') && e.target.closest('button').id;
  if (!id || !G.game) return;
  if (id === 'm-flip') { closeModal(); G.flip = !G.flip; renderGame(); }
  if (id === 'm-ana') { closeModal(); if (G.ucis.length < 2) return toast('Jogue alguns lances primeiro.'); if (G.ranked && !G.over) return toast('Partida ranqueada: a análise só fica disponível depois do fim.'); G.gen++; stopClock(); const rec = { id: uid(), date: Date.now(), start: G.start, ucis: G.ucis.slice(), color: G.color, levelId: G.levelId, result: '*' }; openAnalysis(rec, true); }
  if (id === 'm-pgn') { closeModal(); copyPgn(); }
  if (id === 'm-res') { closeModal(); if (!G.over && G.ucis.length) finishGame(G.color === 'w' ? '0-1' : '1-0', 'Você desistiu.'); }
  if (id === 'm-new') { closeModal(); leaveGame(() => { G.gen++; stopClock(); renderHome(); }); }
});
// sair de partida ranqueada no meio conta como derrota
function leaveGame(go) {
  const played = G.color === 'w' ? G.ucis.length >= 1 : G.ucis.length >= 2;
  if (!G.ranked || G.over || !played) return go();
  openModal(`<h3>Sair da partida ranqueada?</h3><p class="muted" style="margin:6px 0 14px;line-height:1.45">Partida ranqueada vale rating. Se sair agora, ela conta como <b>derrota</b>.</p>
    <div style="display:flex;flex-direction:column;gap:8px"><button class="btn primary" id="lv-stay">Continuar jogando</button><button class="btn" id="lv-quit">Sair e aceitar a derrota</button></div>`);
  $('#lv-stay').onclick = closeModal;
  $('#lv-quit').onclick = () => { closeModal(); finishGame(G.color === 'w' ? '0-1' : '1-0', 'Você abandonou a partida.'); };
}
function copyPgn() {
  const g = new Chess(); if (G.start) g.load(G.start);
  for (const u of G.ucis) g.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
  const pgn = g.pgn();
  (navigator.clipboard ? navigator.clipboard.writeText(pgn) : Promise.reject()).then(() => toast('PGN copiado!'), () => openModal(`<h3>PGN</h3><textarea>${pgn}</textarea>`));
}

const START_COUNT = { p: 8, n: 2, b: 2, r: 2, q: 1 };
const PV = { p: 1, n: 3, b: 3, r: 5, q: 9 };
function capturedBy(fen) {
  const board = fen.split(' ')[0]; const res = { w: [], b: [] }; let adv = 0;
  for (const side of ['w', 'b']) {
    const opp = side === 'w' ? 'b' : 'w';
    for (const t of ['q', 'r', 'b', 'n', 'p']) {
      const ch = opp === 'w' ? t.toUpperCase() : t;
      const have = (board.match(new RegExp(ch, 'g')) || []).length;
      const lost = Math.max(0, START_COUNT[t] - have);
      for (let i = 0; i < lost; i++) res[side].push(opp + t);
      adv += (side === 'w' ? 1 : -1) * lost * PV[t];
    }
  }
  return { res, adv };
}
function playerCard(color, fen) {
  const { res, adv } = capturedBy(fen);
  const lead = color === 'w' ? adv : -adv;
  const mine = color === G.color;
  const l = lv(G.levelId);
  const av = mine ? `<div class="avs me"><div class="pc pc-${color}k"></div></div>` : `<div class="avs"><div class="mascot dark"></div></div>`;
  const name = mine ? '<b>Você</b>' : `<b>Stockfish</b><span>(${l.elo})</span>`;
  const clk = G.tc ? `<div class="clock" id="clk-${color}">${fmtClock(G.clock[color])}</div>` : '';
  return `${av}<div class="pinfo"><div class="pnm">${name}</div><div class="pcap">${res[color].map((p) => `<i class="mini pc-${p}"></i>`).join('')}${lead > 0 ? `<span style="margin-left:10px">+${lead}</span>` : ''}</div></div>${clk}`;
}

const canMoveNow = () => !G.over && !G.thinking && G.game.turn() === G.color && (G.view === null || G.view === G.ucis.length) && (G.mode !== 'teach' || (G.teach.phase === 'idle' && !G.teach.showBest));

function renderGame() {
  const g = G.game; const n = G.ucis.length; const v = G.view === null ? n : G.view;
  const teach = G.mode === 'teach';
  const hist = g.history({ verbose: true });
  const orient = G.flip ? (G.color === 'w' ? 'b' : 'w') : G.color;
  let fen = G.fens[v];
  let last = v > 0 ? [hist[v - 1].from, hist[v - 1].to] : null;
  let arrows = [];
  const T = G.teach; const o = T.judge;
  if (v === n) {
    if (G.hint) arrows = [{ from: G.hint.slice(0, 2), to: G.hint.slice(2, 4), kind: 'good' }];
    if (teach && T.showBest && o && T.jply >= 0 && T.jply < n && o.uci !== o.best) {
      fen = G.fens[T.jply]; last = null;
      arrows = [{ from: o.uci.slice(0, 2), to: o.uci.slice(2, 4), kind: BAD.includes(o.cls) ? 'bad' : 'blue' }, { from: o.best.slice(0, 2), to: o.best.slice(2, 4), kind: 'good' }];
    } else if (teach && T.showBest && o && T.jply >= 0 && T.jply < n) {
      fen = G.fens[T.jply]; last = null;
      arrows = [{ from: o.uci.slice(0, 2), to: o.uci.slice(2, 4), kind: 'good' }];
    }
  }
  let chk = null; try { chk = kingSq(new Chess(fen)); } catch (e) {}
  gBoard.set({ fen, orientation: orient, last, check: chk, arrows, anim: G.anim });
  G.anim = null;
  // faixa de lances
  let h = '';
  hist.forEach((m, i) => { if (i % 2 === 0) h += `<span class="n">${i / 2 + 1}.</span>`; h += `<button class="mv ${i + 1 === v ? 'cur' : ''}" data-p="${i + 1}">${figSan(m.san, m.color)}</button>`; });
  const strip = $('#g-strip'); strip.innerHTML = h;
  const ce = strip.querySelector('.cur'); if (ce) strip.scrollLeft = ce.offsetLeft - strip.clientWidth / 2 + ce.clientWidth / 2; else strip.scrollLeft = 0;
  $('#g-prev').disabled = v === 0; $('#g-nextarr').disabled = v === n;
  if (!teach) {
    const opp = G.color === 'w' ? 'b' : 'w';
    const top = orient === G.color ? opp : G.color, bot = orient === G.color ? G.color : opp;
    $('#g-top').innerHTML = playerCard(top, G.fens[v]); $('#g-bot').innerHTML = playerCard(bot, G.fens[v]);
    updateClocks();
    $('#g-undo').disabled = n === 0 || !!G.over || !!G.ranked;
    $('#g-hint').disabled = !!G.over || G.thinking || G.hinting || g.turn() !== G.color || !!G.ranked;
    $('#g-hint').classList.toggle('on', !!G.hint);
    return;
  }
  // ----- Modo Ensino -----
  { const opp = G.color === 'w' ? 'b' : 'w'; const top = orient === G.color ? opp : G.color, bot = orient === G.color ? G.color : opp;
    $('#g-top').innerHTML = playerCard(top, G.fens[v]); $('#g-bot').innerHTML = playerCard(bot, G.fens[v]); }
  $('#g-coach').innerHTML = teachBubble();
  const cp = o ? o.cpWhite : T.cp; T.cp = cp;
  $('#g-eval').innerHTML = `<div class="w" style="width:${winPct(cp)}%"></div><b class="${cp >= 0 ? 'l' : 'r'}">${fmtEval(cp)}</b>`;
  $('#g-undo').disabled = !!G.over || n === 0;
  $('#g-best').disabled = !(o && T.phase !== 'eval'); $('#g-best').classList.toggle('on', !!(o && T.showBest));
  $('#g-hint').disabled = !!G.over || T.phase !== 'idle' || G.hinting || g.turn() !== G.color || G.thinking || T.showBest;
  $('#g-comm em').textContent = opts.tcomm === 'bad' ? 'Só erros' : 'Todos';
}

function gNav(d) {
  const n = G.ucis.length; const cur = G.view === null ? n : G.view;
  const nv = Math.max(0, Math.min(n, cur + d)); if (nv === cur) return;
  const hist = G.game.history({ verbose: true });
  G.anim = d > 0 ? animList(hist[nv - 1], false) : animList(hist[cur - 1], true);
  G.view = nv === n ? null : nv; renderGame();
}
function gJump(p) { G.view = p === G.ucis.length ? null : p; G.anim = null; renderGame(); }

/* ----- lances ----- */
async function userMove(from, to) {
  if (!canMoveNow()) return;
  const cand = G.game.moves({ square: from, verbose: true }).filter((m) => m.to === to);
  if (!cand.length) return;
  let promo; if (cand[0].promotion) promo = await askPromotion(G.color);
  const fenBefore = G.game.fen();
  const m = playMove(from, to, promo);
  G.msg = '';
  if (G.mode === 'teach') await teachAfterUserMove(fenBefore, m);
  else afterMove();
}
function playMove(from, to, promo) {
  const m = G.game.move({ from, to, promotion: promo });
  G.ucis.push(from + to + (promo || '')); G.fens.push(G.game.fen());
  G.hint = null; G.view = null; G.anim = animList(m, false);
  if (G.tc && G.inc && G.ucis.length > 2) G.clock[m.color] += G.inc * 1000;
  beep(G.game.isCheck() ? 'chk' : m.captured ? 'cap' : 'move');
  return m;
}
async function afterMove(minMs = 0) {
  saveCurrent();
  if (checkEnd()) { renderGame(); return; }
  renderGame();
  if (G.game.turn() !== G.color) await engineMove(minMs);
}
function checkEnd() {
  const g = G.game;
  if (g.isCheckmate()) { const winner = g.turn() === 'w' ? 'b' : 'w'; finishGame(winner === 'w' ? '1-0' : '0-1', 'Xeque-mate!'); return true; }
  if (g.isStalemate()) { finishGame('1/2-1/2', 'Empate por afogamento.'); return true; }
  if (g.isInsufficientMaterial()) { finishGame('1/2-1/2', 'Empate por material insuficiente.'); return true; }
  if (g.isThreefoldRepetition()) { finishGame('1/2-1/2', 'Empate por repetição de posição.'); return true; }
  if (g.isDraw()) { finishGame('1/2-1/2', 'Empate pela regra dos 50 lances.'); return true; }
  return false;
}
async function engineMove(minMs = 0) {
  const gen = ++G.gen; G.thinking = true;
  if (G.mode === 'teach') G.teach.phase = 'opp';
  renderGame();
  const l = lv(G.levelId);
  const t0 = Date.now();
  let r;
  try { r = await getPlayEngine().search(G.game.fen(), l.go); } catch (e) { G.thinking = false; toast('Erro no motor de xadrez.'); return; }
  await sleep(Math.max(0, Math.max(550, minMs) - (Date.now() - t0)));
  if (gen !== G.gen) return;
  G.thinking = false;
  if (!r.best) { renderGame(); return; }
  const fenBefore = G.game.fen();
  const m = playMove(r.best.slice(0, 2), r.best.slice(2, 4), r.best[4]);
  G.msg = `Stockfish jogou ${fmtSan(m.san)}. Sua vez!`;
  if (G.mode === 'teach') { G.teach.phase = 'idle'; G.teach.note = { san: fmtSan(m.san), why: whyMove(fenBefore, r.best, G.ucis.length - 1) }; }
  saveCurrent();
  if (checkEnd()) { renderGame(); return; }
  renderGame();
}
function undoMove() {
  if (G.over || !G.ucis.length) return;
  G.gen++; G.thinking = false; try { getPlayEngine().stop(); } catch (e) {}
  const hist = G.game.history({ verbose: true }); const last = hist[hist.length - 1];
  const pop = () => { G.game.undo(); G.ucis.pop(); G.fens.pop(); };
  if (last.color === G.color) { pop(); G.anim = animList(last, true); }
  else if (hist.length >= 2) { pop(); pop(); G.anim = null; }
  else return;
  G.hint = null; G.view = null; G.msg = 'Lance desfeito. Tente outra ideia!';
  G.teach.phase = 'idle'; G.teach.judge = null; G.teach.show = false; G.teach.showBest = false; G.teach.note = null; G.teach.tt++;
  saveCurrent(); renderGame();
}
async function giveHint() {
  if (G.hinting || G.over || G.game.turn() !== G.color) return;
  if (G.hint) { G.hint = null; renderGame(); return; }
  G.hinting = true; renderGame();
  try {
    const fen = G.game.fen();
    const ev = await evalFen(getAnaEngine(), fen, 12);
    G.hint = ev.best; G.hintSan = sanOf(fen, ev.best); G.hintWhy = whyMove(fen, ev.best, G.ucis.length, ev);
    if (G.mode !== 'teach') toast(`Dica: ${G.hintSan}. ${G.hintWhy[0] || ''}`, 5000);
  } catch (e) { toast('Não consegui calcular a dica.'); }
  G.hinting = false; renderGame();
}
function finishGame(result, text) {
  G.gen++; G.thinking = false; G.teach.tt++; stopClock();
  const win = result !== '1/2-1/2' && (result === '1-0') === (G.color === 'w');
  const title = result === '1/2-1/2' ? 'Empate' : win ? 'Você venceu! 🎉' : 'Você perdeu';
  G.over = { title, text };
  beep('end');
  const rec = { id: uid(), date: Date.now(), start: G.start, ucis: G.ucis.slice(), color: G.color, levelId: G.levelId, mode: G.mode, ranked: !!G.ranked, result };
  const all = games(); const before = ratingOf(all); all.push(rec);
  if (rec.ranked) { const after = ratingOf(all); rec.delta = after - before; rec.ratingAfter = after; }
  saveGames(all); store.del('xq.current');
  const ratingLine = rec.ranked ? `<div style="text-align:center;margin:-4px 0 12px"><span style="font-size:13px;color:var(--mut)">Rating estimado</span><div style="font-size:30px;font-weight:800">${rec.ratingAfter} <span style="color:${rec.delta >= 0 ? '#81b64c' : '#ff6b61'}">${rec.delta >= 0 ? '+' : '−'}${Math.abs(rec.delta)}</span></div></div>` : `<p class="muted" style="font-size:13px;margin:-6px 0 12px">${G.mode === 'teach' ? 'Modo Ensino não conta no rating.' : 'Partida de treino: não conta no rating.'}</p>`;
  renderGame();
  const cfg = { color: G.color === 'w' ? 'b' : 'w', levelId: G.levelId, mode: G.mode, ranked: G.ranked, tc: G.tc, inc: G.inc };
  setTimeout(() => {
    openModal(`<div class="endcard"><h3>${title}</h3><p class="muted" style="margin:2px 0 12px">${text}</p>${ratingLine}
      <div id="e-say">${coachHTML({ title: '<span class="spinner"></span>Analisando seu jogo…', text: 'Já já mostro seus acertos e erros.' })}</div>
      <div id="e-stats"></div>
      <button class="btn primary" id="e-ana" disabled style="width:100%;margin-top:12px">📊 Revisão da partida</button>
      <div class="row" style="margin-top:8px"><button class="btn grow" id="e-rev">⇄ Revanche</button><button class="btn grow" id="e-new">Nova partida</button></div>
      <button class="btn" id="e-close" style="width:100%;margin-top:8px">Ver tabuleiro</button></div>`);
    $('#e-ana').onclick = () => { closeModal(); openAnalysis(rec); };
    $('#e-new').onclick = () => { closeModal(); renderHome(); };
    $('#e-rev').onclick = () => { closeModal(); startGame(cfg); };
    $('#e-close').onclick = closeModal;
    endAnalysis(rec);
  }, 600);
}

// análise rápida logo ao fim da partida: acertos, erros e precisão
async function endAnalysis(rec) {
  const live = () => !!$('#e-say');
  if (rec.ucis.length < 4) { if (live()) { $('#e-say').innerHTML = coachHTML({ title: 'Partida curta', text: 'Jogue mais lances para ter uma análise.' }); $('#e-ana').disabled = false; } return; }
  try {
    let evals = rec.analysis && rec.analysis.evals;
    if (!evals) {
      evals = await analyzeGame(getAnaEngine(), rec.start, rec.ucis, { depth: 10, onProgress: (i, n) => { const t = $('#e-say .tx'); if (t) t.textContent = `Analisando posição ${i} de ${n}…`; } });
      rec.analysis = { evals };
      const all = games(); const k = all.findIndex((g) => g.id === rec.id); if (k >= 0) { all[k] = rec; saveGames(all); }
    }
    const r = classify(rec.start, rec.ucis, evals, rec.color); const sm = summarize(r.info, rec.color, rec.ucis);
    ACC.delete(rec.id);
    if (!live()) return;
    const me = sm.me || (rec.color === 'w' ? sm.w : sm.b); const acc = Math.round(me.acc);
    const c = me.counts;
    const chips = ['brilliant', 'great', 'best', 'excellent', 'good', 'inaccuracy', 'mistake', 'blunder'].filter((k) => c[k] > 0)
      .map((k) => `<div class="est"><i class="bd2" style="background:${CLS[k].color}">${CLS[k].sym}</i><b>${c[k]}</b><span>${CLS[k].label}</span></div>`).join('');
    const bad = c.blunder + c.mistake;
    const say = acc >= 90 ? 'Partida excelente, quase sem erros!' : bad === 0 ? 'Boa partida, sem erros graves.' : `Vamos rever alguns momentos importantes. Você teve ${c.blunder ? c.blunder + ' capivarada' + (c.blunder > 1 ? 's' : '') : ''}${c.blunder && c.mistake ? ' e ' : ''}${c.mistake ? c.mistake + ' erro' + (c.mistake > 1 ? 's' : '') : ''}.`;
    $('#e-say').innerHTML = coachHTML({ title: say });
    $('#e-stats').innerHTML = `<div class="eacc"><b>${acc}%</b><span>Sua precisão</span></div><div class="ests">${chips}</div>`;
    $('#e-ana').disabled = false;
  } catch (e) { if (live()) { $('#e-say').innerHTML = coachHTML({ title: 'Não consegui analisar agora', text: 'Use a Revisão da partida para tentar de novo.' }); $('#e-ana').disabled = false; } }
}

/* ----- Modo Ensino ----- */
const PHRASE = { book: 'é um lance de livro', best: 'é o melhor lance', great: 'é um ótimo lance', excellent: 'é excelente', good: 'é um bom lance', inaccuracy: 'é uma imprecisão', mistake: 'é um erro', blunder: 'é uma capivarada', brilliant: 'é um lance brilhante!' };

async function teachAfterUserMove(fenBefore, m) {
  const T = G.teach; const tt = ++T.tt;
  T.phase = 'eval'; T.judge = null; T.show = false; T.showBest = false; T.note = null; T.jply = G.ucis.length - 1;
  saveCurrent(); renderGame();
  const fenAfter = G.game.fen(); const ply = G.ucis.length - 1;
  try {
    const ae = getAnaEngine();
    const eb = await evalFen(ae, fenBefore, 12); if (tt !== T.tt) return;
    const ea = await evalFen(ae, fenAfter, 12); if (tt !== T.tt) return;
    const std = !G.start; const bs = std ? bookStatus(G.ucis) : { depth: 0 };
    const mv = { uci: G.ucis[ply], san: m.san, color: m.color, from: m.from, to: m.to, piece: m.piece, captured: m.captured };
    const o = judgeAt(0, [fenBefore, fenAfter], [mv], [eb, ea], { ply, inBook: std && bs.depth === G.ucis.length });
    o.cpWhite = ea.cp * (fenAfter.split(' ')[1] === 'w' ? 1 : -1);
    T.judge = o;
  } catch (e) { if (tt !== T.tt) return; T.judge = null; toast('Não consegui avaliar esse lance.'); }
  const o = T.judge;
  T.show = !!o && (opts.tcomm !== 'bad' || o.cls === 'mistake' || o.cls === 'blunder');
  T.phase = 'idle';
  // o Stockfish responde sozinho; dá um tempo para ler o comentário
  await afterMove(!T.show ? 0 : BAD.includes(o.cls) ? 3200 : 1900);
}

function bookNote() {
  if (G.start) return '';
  const n = G.ucis.length; const bs = bookStatus(G.ucis);
  if (n > 14) return '';
  if (bs.name && bs.depth === n && bs.nextUcis.length) {
    const sans = bookSans(G.fens[n], bs.nextUcis);
    return `<div class="book">📖 <b>${bs.name}</b> — ${openingDesc(bs.name)}<br>Lances comuns agora: <b>${sans.join(', ')}</b></div>`;
  }
  if (n >= 2 && bs.depth < n && bs.depth >= 2) return `<div class="book">📖 Você já saiu da teoria da <b>${bs.name}</b>. Agora vale o raciocínio: centro, peças em jogo e rei seguro.</div>`;
  return '';
}
const CHECKLIST = '<div class="book">✅ Antes de jogar: <b>1)</b> o que o adversário ameaça? <b>2)</b> tenho xeques, capturas ou ameaças? <b>3)</b> meu lance deixa alguma peça sem proteção?</div>';

function teachBubble() {
  const T = G.teach; const n = G.ucis.length;
  if (G.over) return coachHTML({ title: G.over.title, text: G.over.text });
  if (T.phase === 'eval') return coachHTML({ title: '<span class="spinner"></span>Avaliando seu lance…' });
  if (G.hint && T.phase === 'idle') return coachHTML({ badge: CLS.best, title: `Dica: ${G.hintSan}`, text: whyBox(G.hintWhy), extra: 'Toque em ★ no tabuleiro para ver a seta. Que tal jogar esse lance?' });
  const o = T.judge;
  if (o && T.show) {
    const isBest = o.uci === o.best;
    const wait = T.phase === 'opp' || G.thinking;
    const first = (t) => (t || '').split(/(?<=[.!?])\s/)[0];
    const reply = wait ? '<span class="spinner"></span>Stockfish está pensando…' : T.note ? `Stockfish jogou <b>${T.note.san}</b>. ${first(T.note.why[0])}` : '';
    if (T.showBest) {
      return coachHTML({ badge: CLS.best, title: isBest ? 'Você jogou o melhor lance!' : `O melhor era ${o.bestSan}`, chip: fmtEval(o.cpWhite),
        text: whyBox(o.why), extra: !isBest && o.pvSan.length ? `Sequência provável: ${o.pvSan.join(' ')}` : '',
        links: `<button class="linkbtn" data-act="back">← Voltar ao jogo</button>${isBest ? '' : '<button class="linkbtn" data-act="retry">↻ Tentar esse lance</button>'}` });
    }
    let text = o.text;
    if (isBest || o.cls === 'book') text = `${o.text} ${whyBox(o.why)}`;
    else if (!BAD.includes(o.cls)) text = `${o.text} O melhor era <b>${o.bestSan}</b>.`;
    const links = isBest ? '' : `<button class="linkbtn" data-act="best">★ Melhor: ${o.bestSan}</button><button class="linkbtn" data-act="retry">↻ Tentar outro</button>`;
    const extra = [reply].filter(Boolean).join('<br>');
    return coachHTML({ badge: CLS[o.cls], title: `${fmtSan(o.san)} ${PHRASE[o.cls]}`, chip: fmtEval(o.cpWhite), text, extra, links });
  }
  if (T.phase === 'opp' || G.thinking) return coachHTML({ title: '<span class="spinner"></span>Stockfish está pensando…' });
  const bn = bookNote() || (n > 14 ? CHECKLIST : '');
  if (T.note) return coachHTML({ title: `Stockfish jogou ${T.note.san}`, text: `${T.note.why[0] ? T.note.why[0] + ' ' : ''}Agora é a sua vez.${bn}` });
  return coachHTML({ title: n === 0 ? 'Modo Ensino' : 'Sua vez!', text: `${n === 0 ? 'Faça seu lance. O treinador comenta e o Stockfish responde sozinho.' : (G.msg || 'Pense bem no seu lance.')}${bn}` });
}

/* =====================================================
   ANÁLISE (Game Review)
   ===================================================== */
const A = { rec: null, fens: [], moves: [], evals: [], info: [], ply: 0, line: null, retry: null, showBest: false, flip: false, busy: false, sum: null, token: 0, anim: null };
let aBoard = null;

async function openAnalysis(rec, temp = false) {
  if (!rec) return;
  stopClock();
  A.rec = rec; A.ply = 0; A.line = null; A.retry = null; A.showBest = false; A.flip = false; A.evals = []; A.info = []; A.busy = false; A.anim = null;
  const { fens, moves } = replay(rec.start, rec.ucis);
  A.fens = fens; A.moves = moves;
  buildAnalysisView(); show('analysis');
  if (rec.analysis && rec.analysis.evals.length === fens.length) { A.evals = rec.analysis.evals; finishAnalysis(); return; }
  const token = ++A.token; A.busy = true; renderAnalysis();
  try {
    const evals = await analyzeGame(getAnaEngine(), rec.start, rec.ucis, {
      depth: 12,
      shouldStop: () => token !== A.token,
      onProgress: (i, n) => { const b = $('#a-prog'); if (b) b.style.width = (i / n) * 100 + '%'; const t = $('#a-progt'); if (t) t.textContent = `Analisando posição ${i} de ${n}…`; },
    });
    if (token !== A.token) return;
    A.evals = evals; rec.analysis = { evals };
    if (!temp) { const all = games(); const k = all.findIndex((g) => g.id === rec.id); if (k >= 0) { all[k] = rec; saveGames(all); } }
    A.busy = false; finishAnalysis(true);
  } catch (e) { if (e.message !== 'abort') toast('Erro ao analisar a partida.'); }
}

function finishAnalysis(showSum) {
  A.busy = false;
  const r = classify(A.rec.start, A.rec.ucis, A.evals, A.rec.color);
  A.info = r.info; A.sum = summarize(A.info, A.rec.color, A.rec.ucis);
  A.ply = 0; renderAnalysis();
  if (showSum) openSummary();
}

function buildAnalysisView() {
  $('#view-analysis').innerHTML = `<div class="screen">
    <div class="hdr"><button class="ibtn" id="a-back">←</button><h2>Revisão da partida</h2><button class="ibtn" id="a-flip">⇅</button></div>
    <div class="hbar" id="a-eval"></div>
    <div id="a-coach" style="display:flex;flex-direction:column;flex:1 1 auto;min-height:0"></div>
    <div class="boardwrap"><div id="a-board"></div></div>
    <div class="dock"><div class="navstrip"><button class="arr" id="a-prev">‹</button><div class="strip" id="a-strip"></div><button class="arr" id="a-nextarr">›</button></div>
    <div class="tb4"><button class="t" id="a-sum"><span>📊</span>Resumo</button><button class="t" id="a-show"><span>▶︎</span>Mostrar</button><button class="t" id="a-best"><span>★</span>Melhor</button><button class="next" id="a-next">Seguinte</button></div></div>
  </div>`;
  aBoard = new Board($('#a-board'), {
    canSelect: (sq) => !!A.retry && !A.retry.busy && !A.retry.done && (new Chess(A.fens[A.retry.base]).get(sq) || {}).color === A.rec.color,
    getTargets: (sq) => new Chess(A.fens[A.retry.base]).moves({ square: sq, verbose: true }).map((m) => ({ to: m.to, capture: !!m.captured })),
    onMove: retryMove,
  });
  $('#a-back').onclick = () => { A.token++; renderHome(); };
  $('#a-flip').onclick = () => { A.flip = !A.flip; renderAnalysis(); };
  $('#a-prev').onclick = goPrev; $('#a-next').onclick = goNext; $('#a-nextarr').onclick = goNext;
  $('#a-sum').onclick = openSummary;
  $('#a-show').onclick = toggleLine;
  $('#a-best').onclick = () => { A.line = null; A.retry = null; A.showBest = !A.showBest; renderAnalysis(); };
  $('#a-strip').onclick = (e) => { const b = e.target.closest('[data-p]'); if (b) { A.line = null; A.retry = null; A.showBest = false; A.ply = +b.dataset.p; renderAnalysis(); } };
}
document.addEventListener('keydown', (e) => {
  if ($('#view-analysis').classList.contains('hidden') || A.busy) return;
  if (e.key === 'ArrowRight') goNext(); if (e.key === 'ArrowLeft') goPrev();
});

function goNext() {
  if (A.busy) return;
  A.retry = null;
  if (A.line) {
    if (A.line.idx < A.line.fens.length - 1) { A.anim = animList(A.line.moves[A.line.idx], false); A.line.idx++; } else { A.line = null; }
    renderAnalysis(); return;
  }
  A.showBest = false;
  if (A.ply < A.moves.length) { A.anim = animList(A.moves[A.ply], false); A.ply++; }
  renderAnalysis();
}
function goPrev() {
  if (A.busy) return;
  A.retry = null;
  if (A.line) {
    if (A.line.idx > 0) { A.anim = animList(A.line.moves[A.line.idx - 1], true); A.line.idx--; } else A.line = null;
    renderAnalysis(); return;
  }
  A.showBest = false;
  if (A.ply > 0) { A.anim = animList(A.moves[A.ply - 1], true); A.ply--; }
  renderAnalysis();
}

const whiteCp = (i) => A.evals[i].cp * (A.fens[i].split(' ')[1] === 'w' ? 1 : -1);
const isMine = (o) => o.side === A.rec.color;

function lineBase() {
  const p = A.ply;
  if (p > 0 && !['brilliant', 'best', 'great', 'book'].includes(A.info[p - 1].cls)) return p - 1;
  return p;
}
function toggleLine() {
  if (A.busy) return;
  if (A.line) { A.line = null; renderAnalysis(); return; }
  A.retry = null; A.showBest = false;
  const base = lineBase(); const ev = A.evals[base];
  if (!ev || !ev.pv || !ev.pv.length) return toast('Não há linha para mostrar aqui.');
  const g = new Chess(A.fens[base]); const fens = [g.fen()], moves = [];
  try { for (const u of ev.pv) { const m = g.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }); moves.push(m); fens.push(g.fen()); } } catch (e) {}
  A.line = { base, fens, moves, idx: 0 };
  renderAnalysis();
}

function renderAnalysis() {
  const n = A.moves.length; const p = A.ply;
  const done = !A.busy && A.info.length === n;
  const side = A.flip ? (A.rec.color === 'w' ? 'b' : 'w') : A.rec.color;
  let fen = A.fens[p], last = p > 0 ? [A.moves[p - 1].from, A.moves[p - 1].to] : null, arrows = [], badge = null;
  const cur = done && p > 0 ? A.info[p - 1] : null;
  if (A.line) {
    fen = A.line.fens[A.line.idx];
    const lm = A.line.idx > 0 ? A.line.moves[A.line.idx - 1] : null; last = lm ? [lm.from, lm.to] : null;
  } else if (A.retry) {
    fen = A.retry.shown || A.fens[A.retry.base]; last = null;
    if (A.retry.reveal) arrows = [{ from: A.evals[A.retry.base].best.slice(0, 2), to: A.evals[A.retry.base].best.slice(2, 4), kind: 'good' }];
  } else if (A.showBest && done) {
    if (cur && !['brilliant', 'best', 'great', 'book'].includes(cur.cls)) {
      fen = A.fens[p - 1]; last = null; const b = A.evals[p - 1].best;
      arrows = [{ from: A.moves[p - 1].from, to: A.moves[p - 1].to, kind: BAD.includes(cur.cls) ? 'bad' : 'blue' }, { from: b.slice(0, 2), to: b.slice(2, 4), kind: 'good' }];
    } else if (A.evals[p] && A.evals[p].best) {
      const b = A.evals[p].best; arrows = [{ from: b.slice(0, 2), to: b.slice(2, 4), kind: 'blue' }];
    }
  } else if (cur) {
    badge = { sq: A.moves[p - 1].to, color: CLS[cur.cls].color, sym: CLS[cur.cls].sym };
  }
  let chk = null; try { chk = kingSq(new Chess(fen)); } catch (e) {}
  aBoard.set({ fen, orientation: side, last, check: chk, arrows, badge, anim: A.anim });
  A.anim = null;
  if (!A.busy && A.evals.length === A.fens.length) {
    const cp = A.line ? whiteCp(A.line.base) : whiteCp(p);
    $('#a-eval').innerHTML = `<div class="w" style="width:${winPct(cp)}%"></div><b class="${cp >= 0 ? 'l' : 'r'}">${fmtEval(cp)}</b>`;
  } else $('#a-eval').innerHTML = '<div class="w" style="width:50%"></div>';
  let h = '';
  A.moves.forEach((m, i) => {
    if (i % 2 === 0) h += `<span class="n">${i / 2 + 1}.</span>`;
    const o = A.info[i]; const dot = o && o.cls !== 'good' && o.cls !== 'excellent' ? `<span class="d" style="background:${CLS[o.cls].color}"></span>` : '';
    h += `<button class="mv ${i + 1 === p && !A.line ? 'cur' : ''}" data-p="${i + 1}">${dot}${figSan(m.san, m.color)}</button>`;
  });
  const strip = $('#a-strip'); strip.innerHTML = h;
  const ce = strip.querySelector('.cur');
  if (ce) strip.scrollLeft = ce.offsetLeft - strip.clientWidth / 2 + ce.clientWidth / 2; else if (p === 0) strip.scrollLeft = 0;
  $('#a-coach').innerHTML = coachBubble(done, cur);
  const bubble = $('#a-coach');
  const bind = (act, fn) => { const b = bubble.querySelector(`[data-act="${act}"]`); if (b) b.onclick = fn; };
  bind('retry', startRetry); bind('best', () => { A.showBest = true; renderAnalysis(); }); bind('nexterr', nextError);
  bind('reveal', () => { A.retry.reveal = true; renderAnalysis(); }); bind('cont', () => { A.retry = null; renderAnalysis(); }); bind('play', playFromHere);
  $('#a-prev').disabled = A.busy || (!A.line && p === 0 && !A.retry);
  $('#a-next').disabled = A.busy || (!A.line && p >= n && !A.retry);
  $('#a-nextarr').disabled = $('#a-next').disabled;
  $('#a-sum').disabled = !done; $('#a-show').disabled = !done; $('#a-best').disabled = !done;
  $('#a-show').classList.toggle('on', !!A.line); $('#a-best').classList.toggle('on', A.showBest);
}

function coachBubble(done, cur) {
  if (!done) return coachHTML({ title: 'Analisando sua partida…', text: '<span id="a-progt">Preparando o motor…</span><div class="prog"><div id="a-prog"></div></div>' });
  const p = A.ply;
  if (A.retry) {
    const r = A.retry;
    if (r.done) return coachHTML({ badge: CLS.best, title: 'Muito bem!', text: r.msg, links: `<button class="linkbtn" data-act="cont">Continuar</button>` });
    return coachHTML({ title: r.busy ? '<span class="spinner"></span>Avaliando seu lance…' : 'Tente de novo', text: r.msg || 'Encontre um lance melhor do que o que você jogou.', links: r.busy ? '' : `<button class="linkbtn" data-act="reveal">Ver solução</button>` });
  }
  if (A.line) {
    const L = A.line; const sans = L.moves.map((m, i) => `<b style="${i === L.idx - 1 ? 'color:#262421;background:#cfe8b4;border-radius:4px;padding:0 3px' : ''}">${fmtSan(m.san)}</b>`).join(' ');
    return coachHTML({ title: 'Linha recomendada', chip: fmtEval(whiteCp(L.base)), text: L.moves.length ? sans : 'Sem linha disponível.', extra: 'Toque em Seguinte ou ‹ para avançar e voltar dentro da linha.' });
  }
  if (A.showBest) {
    if (cur && !['brilliant', 'best', 'great', 'book'].includes(cur.cls) && cur.bestSan) {
      return coachHTML({ badge: CLS.best, title: `O melhor era ${cur.bestSan}`, chip: fmtEval(whiteCp(p - 1)), text: whyBox(cur.why), extra: cur.pvSan && cur.pvSan.length ? `Sequência provável: ${cur.pvSan.join(' ')}` : '' });
    }
    const ev = A.evals[p];
    if (ev && ev.best) {
      return coachHTML({ badge: CLS.best, title: `Próximo lance recomendado: ${sanOf(A.fens[p], ev.best)}`, chip: fmtEval(whiteCp(p)), text: whyBox(whyMove(A.fens[p], ev.best, p, ev)) });
    }
  }
  if (p === 0) {
    const op = openingInfo(A.rec.ucis).name; const s = A.sum;
    return coachHTML({ title: 'Vamos revisar a partida', chip: fmtEval(whiteCp(0)), text: `${op ? `Abertura: <b>${op}</b>. ` : ''}Toque em <b>Seguinte</b> para ver meu comentário sobre cada lance${s ? `. Sua precisão: <b>${s.me.acc.toFixed(0)}%</b>` : ''}.`, links: `<button class="linkbtn" data-act="nexterr">Ir ao primeiro erro ›</button>` });
  }
  const mine = isMine(cur);
  let text = cur.text; let extra = ''; let links = '';
  if (BAD.includes(cur.cls)) {
    if (mine) {
      extra = cur.pvSan && cur.pvSan.length ? `Linha do motor: ${cur.pvSan.join(' ')}` : '';
      links = `<button class="linkbtn" data-act="best">★ Melhor: ${cur.bestSan || ''} — por quê?</button><button class="linkbtn" data-act="retry">↻ Tentar de novo</button><button class="linkbtn" data-act="nexterr">Próximo erro ›</button>`;
    } else {
      text = `O adversário errou aqui${cur.bestSan ? `: o melhor seria ${cur.bestSan}` : ''}. Veja se você aproveitou!`;
      links = `<button class="linkbtn" data-act="best">★ Ver melhor lance</button>`;
    }
  } else if (mine && cur.bestSan && cur.uci !== cur.best && cur.loss >= 2) {
    links = `<button class="linkbtn" data-act="best">★ Melhor era ${cur.bestSan}</button>`;
  } else if (mine && cur.why && cur.why.length && ['brilliant', 'best', 'great'].includes(cur.cls)) {
    text += whyBox(cur.why);
  }
  if (cur.offBook) {
    text += `<div class="book">📖 ${mine ? 'Aqui você saiu' : 'O adversário saiu'} da teoria (${cur.offBook.name}). Lances comuns: <b>${cur.offBook.sans.join(', ')}</b>.</div>`;
  }
  if (p === A.moves.length) {
    if (new Chess(A.fens[p]).isCheckmate()) text += ' Xeque-mate!';
    links += `<button class="linkbtn" data-act="play">♟ Jogar daqui</button>`;
  } else if (!BAD.includes(cur.cls) && !links) links = `<button class="linkbtn" data-act="play">♟ Jogar daqui</button>`;
  return coachHTML({ badge: CLS[cur.cls], title: `${fmtSan(cur.san)} ${PHRASE[cur.cls]}`, chip: fmtEval(whiteCp(p)), text: `${mine ? '' : '<span class="muted" style="font-size:12px;display:block;margin-bottom:2px">Lance do adversário</span>'}${text}`, extra, links });
}

function nextError() {
  A.line = null; A.retry = null; A.showBest = false;
  const idx = A.info.findIndex((o, i) => i + 1 > A.ply && isMine(o) && BAD.includes(o.cls));
  if (idx < 0) { toast('Sem mais erros seus à frente!'); return; }
  A.anim = null; A.ply = idx + 1; renderAnalysis();
}
function startRetry() {
  const p = A.ply; A.line = null; A.showBest = false;
  A.retry = { base: p - 1, busy: false, done: false, msg: '', reveal: false, shown: null };
  renderAnalysis();
}
async function retryMove(from, to) {
  const R = A.retry; if (!R || R.busy) return;
  const g = new Chess(A.fens[R.base]);
  const cand = g.moves({ square: from, verbose: true }).filter((m) => m.to === to);
  if (!cand.length) return;
  let promo; if (cand[0].promotion) promo = await askPromotion(A.rec.color);
  const m = g.move({ from, to, promotion: promo });
  const uci = from + to + (promo || '');
  R.busy = true; R.shown = g.fen(); renderAnalysis();
  let wa;
  try {
    if (g.isGameOver()) wa = g.isCheckmate() ? 100 : 50;
    else { const r = await getAnaEngine().search(g.fen(), { depth: 11 }); wa = winPct(-toCp(r.lines[0])); }
  } catch (e) { wa = 0; }
  const wb = winPct(A.evals[R.base].cp);
  const loss = uci === A.evals[R.base].best ? 0 : Math.max(0, wb - wa);
  R.busy = false;
  if (loss < 5) { R.done = true; R.msg = `${fmtSan(m.san)} é um ótimo lance${uci === A.evals[R.base].best ? ' — o melhor, aliás!' : '.'}`; }
  else { R.shown = null; R.msg = `${fmtSan(m.san)} ainda não é o ideal. Tente outro lance!`; }
  renderAnalysis();
}
function playFromHere() {
  const fen = A.fens[A.ply];
  if (new Chess(fen).isGameOver()) return toast('A partida terminou nessa posição.');
  startGame({ start: fen, color: fen.split(' ')[1], levelId: opts.level, mode: 'play', tc: 0 });
}

function openSummary() {
  if (!A.sum) return;
  const s = A.sum; const me = A.rec.color;
  const mine = me === 'w' ? s.w : s.b, opp = me === 'w' ? s.b : s.w;
  const rows = ['brilliant', 'great', 'best', 'excellent', 'good', 'book', 'inaccuracy', 'mistake', 'blunder'].map((k) => `<span><i class="bd2" style="background:${CLS[k].color}">${CLS[k].sym}</i>${CLS[k].label}</span><span class="c">${mine.counts[k]}</span><span class="c">${opp.counts[k]}</span>`).join('');
  const N = A.fens.length; const W = 300, H = 80;
  const pts = A.fens.map((_, i) => [(i / Math.max(1, N - 1)) * W, H - (winPct(whiteCp(i)) / 100) * H]);
  const path = pts.map((q, i) => (i ? 'L' : 'M') + q[0].toFixed(1) + ' ' + q[1].toFixed(1)).join(' ');
  const o = s.opening;
  const opBlock = o.name ? `<div class="card" style="margin:0;background:var(--bg)"><h3 style="margin-bottom:6px">Abertura</h3><b>${o.name}</b><div class="muted" style="font-size:14px;margin-top:4px;line-height:1.4">${o.desc}</div>${o.off ? `<div style="font-size:14px;margin-top:8px;line-height:1.4">📖 Você saiu da teoria no lance ${o.off.n} (<b>${fmtSan(o.off.san)}</b>). Na teoria costuma-se jogar <b>${o.off.sans.join(' ou ')}</b>.</div>` : ''}</div>` : '';
  openModal(`<div class="sheet"><h3>Resumo da partida</h3>
    <div class="acc"><div class="a"><b>${mine.acc.toFixed(0)}%</b><span>Sua precisão</span></div><div class="a"><b>${opp.acc.toFixed(0)}%</b><span>Adversário</span></div></div>
    <div class="counts"><span></span><span class="c muted" style="font-size:12px">Você</span><span class="c muted" style="font-size:12px">Adv.</span>${rows}</div>
    <svg class="graph" id="s-graph" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><rect width="${W}" height="${H}" fill="#2a2926"/><path d="${path} L ${W} ${H} L 0 ${H} Z" fill="#e9e6df" opacity=".9"/><line x1="0" x2="${W}" y1="${H / 2}" y2="${H / 2}" stroke="#777" stroke-width=".5"/></svg>
    ${opBlock}
    <div><div class="muted" style="font-size:12px;text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px">Todos os seus lances (toque para rever)</div><div class="mychips" id="s-chips">${A.info.filter((x) => x.side === me).map((x) => `<button data-p="${x.ply + 1}"><i style="background:${CLS[x.cls].color}">${CLS[x.cls].sym}</i>${Math.floor(x.ply / 2) + 1}${me === 'w' ? '.' : '…'}${fmtSan(x.san)}</button>`).join('')}</div></div>
    <div><div class="muted" style="font-size:12px;text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px">Onde melhorar</div><ul class="tips">${s.tips.map((t) => `<li>${t}</li>`).join('')}<li>${s.repertoire}</li></ul></div>
    <div class="row"><button class="btn grow" id="s-err">Ver meus erros</button><button class="btn primary grow" id="s-go">Rever lances</button></div></div>`);
  $('#s-go').onclick = closeModal;
  $('#s-chips').onclick = (e) => { const b = e.target.closest('[data-p]'); if (!b) return; closeModal(); A.line = null; A.retry = null; A.showBest = false; A.anim = null; A.ply = +b.dataset.p; renderAnalysis(); };
  $('#s-err').onclick = () => { closeModal(); A.ply = 0; nextError(); };
  $('#s-graph').onclick = (e) => {
    const r = e.currentTarget.getBoundingClientRect(); const i = Math.round(((e.clientX - r.left) / r.width) * (N - 1));
    closeModal(); A.line = null; A.retry = null; A.anim = null; A.ply = Math.max(0, Math.min(A.moves.length, i)); renderAnalysis();
  };
}

TR = initTrain({ $, store, toast, openModal, closeModal, show, Board, Chess, coachHTML, whyBox, animList, kingSq, fmtSan, askPromotion, beep, renderHome, getAnaEngine, games, openAnalysis, winPct, classify, whyMove });
const OPN = initOpenings({ $, store, toast, openModal, closeModal, show, Board, Chess, coachHTML, animList, kingSq, fmtSan, askPromotion, beep, renderHome, openingLines, whyMove });
const EG = initEndgames({ $, store, toast, openModal, closeModal, show, Board, Chess, coachHTML, animList, kingSq, fmtSan, askPromotion, beep, renderHome, getAnaEngine });

/* ---------- início ---------- */
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
TR.touch(); renderHome();
TR.ready().then(() => { if (tab === 'me' || tab === 'home') renderHome(); });
