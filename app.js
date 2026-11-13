import { Chess } from './lib/chess.js';
import { Board } from './board.js';
import { Engine, LEVELS, toCp } from './engine.js';
import { analyzeGame, classify, summarize, evalFen, judgeAt, whyMove, bookStatus, bookSans, openingInfo, openingDesc, CLS, BAD, winPct, fmtSan, replay } from './analysis.js';

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
  for (const v of ['home', 'game', 'analysis']) $('#view-' + v).classList.toggle('hidden', v !== name);
  document.body.classList.toggle('noscroll', name !== 'home');
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
let opts = Object.assign({ color: 'w', level: 3, mode: 'play', tc: 10, theme: 'verde', tcomm: 'all' }, store.get('xq.opts', {}));
applyTheme(opts.theme);
const saveOpts = () => store.set('xq.opts', opts);

/* =====================================================
   HOME
   ===================================================== */
function renderHome() {
  show('home'); stopClock();
  const cur = store.get('xq.current', null);
  const list = games();
  const resCls = (g) => {
    if (g.result === '1/2-1/2') return ['draw', '½'];
    const win = (g.result === '1-0') === (g.color === 'w');
    return win ? ['win', 'V'] : ['loss', 'D'];
  };
  const tcs = [[0, '∞'], [3, '3 min'], [10, '10 min'], [30, '30 min']];
  $('#view-home').innerHTML = `
    <div class="hero"><div class="mascot" style="width:96px;height:96px;margin:0 auto"></div>
      <h1>Xadrez Coach</h1><p>Jogue contra o Stockfish e aprenda com um treinador</p></div>
    ${cur ? `<div class="card"><h3>Partida em andamento</h3><div class="row"><div class="grow muted" style="font-size:14px">${cur.ucis.length} lances · ${lvName(cur.levelId)}${cur.mode === 'teach' ? ' · Ensino' : ''}</div><button class="btn primary small" id="h-resume">Continuar</button></div></div>` : ''}
    <div class="card"><h3>Nova partida</h3>
      <div class="seg" id="h-mode"><button data-m="play" class="${opts.mode === 'play' ? 'on' : ''}">♟ Partida</button><button data-m="teach" class="${opts.mode === 'teach' ? 'on' : ''}">🎓 Modo Ensino</button></div>
      <p class="muted" style="font-size:13px;margin:8px 2px 0">${opts.mode === 'teach' ? 'Você joga, o treinador comenta e o Stockfish responde sozinho. Dá para ver o melhor lance e tentar de novo.' : 'Partida normal contra o motor, com relógio opcional. Análise completa no final.'}</p>
      ${opts.mode === 'teach' ? `<div class="lbl">Comentários do treinador</div><div class="seg" id="h-comm"><button data-q="all" class="${opts.tcomm !== 'bad' ? 'on' : ''}">Todos os meus lances</button><button data-q="bad" class="${opts.tcomm === 'bad' ? 'on' : ''}">Só erros e capivaradas</button></div>` : ''}
      <div class="lbl">Jogar com</div>
      <div class="seg" id="h-color">
        <button data-c="w" class="${opts.color === 'w' ? 'on' : ''}">♔ Brancas</button>
        <button data-c="r" class="${opts.color === 'r' ? 'on' : ''}">🎲 Sorteio</button>
        <button data-c="b" class="${opts.color === 'b' ? 'on' : ''}">♚ Pretas</button></div>
      ${opts.mode === 'play' ? `<div class="lbl">Tempo</div><div class="seg small" id="h-tc">${tcs.map(([v, l]) => `<button data-t="${v}" class="${opts.tc === v ? 'on' : ''}">${l}</button>`).join('')}</div>` : ''}
      <div class="lbl">Adversário</div>
      <div class="levels" id="h-levels">${LEVELS.map((l) => `<button class="lv ${opts.level === l.id ? 'on' : ''}" data-l="${l.id}"><b>${l.name} <small class="muted">${l.elo}</small></b><span>${l.desc}</span></button>`).join('')}</div>
      <div class="lbl">Tabuleiro</div>
      <div class="themes" id="h-themes">${Object.entries(THEMES).map(([k, t]) => `<button class="theme ${opts.theme === k ? 'on' : ''}" data-th="${k}"><i style="background:${t[0]}"></i><i style="background:${t[1]}"></i><i style="background:${t[1]}"></i><i style="background:${t[0]}"></i></button>`).join('')}</div>
      <button class="btn primary" id="h-start" style="width:100%;margin-top:16px;font-size:17px">${opts.mode === 'teach' ? 'Começar a aprender' : 'Jogar'}</button></div>
    <div class="card"><h3>Minhas partidas</h3>
      ${list.length ? list.slice().reverse().map((g) => { const [c, t] = resCls(g); return `<div class="hist" data-id="${g.id}">
        <div class="res ${c}">${t}</div>
        <div class="meta"><b>${g.color === 'w' ? 'Brancas' : 'Pretas'} · ${lvName(g.levelId)}${g.mode === 'teach' ? ' · Ensino' : ''}</b><span>${new Date(g.date).toLocaleDateString('pt-BR')} · ${g.ucis.length} lances${g.analysis ? ' · analisada' : ''}</span></div>
        <button class="btn small" data-a="${g.id}">Analisar</button><button class="ibtn" data-d="${g.id}" style="width:34px;height:34px;font-size:14px">✕</button></div>`; }).join('') : '<div class="muted" style="font-size:14px">Nenhuma partida ainda. Jogue uma e peça a análise no final!</div>'}
      <button class="btn small" id="h-import" style="width:100%;margin-top:10px">Importar PGN (de outro app)</button></div>
    <p class="muted" style="text-align:center;font-size:12px;padding:0 20px">Tudo roda no seu aparelho, sem internet. Motor: Stockfish 19 · Peças: Cardinal (sadsnake1)</p>`;
  const v = $('#view-home');
  v.querySelectorAll('#h-mode button').forEach((b) => (b.onclick = () => { opts.mode = b.dataset.m; saveOpts(); renderHome(); }));
  v.querySelectorAll('#h-comm button').forEach((b) => (b.onclick = () => { opts.tcomm = b.dataset.q; saveOpts(); renderHome(); }));
  v.querySelectorAll('#h-color button').forEach((b) => (b.onclick = () => { opts.color = b.dataset.c; saveOpts(); renderHome(); }));
  v.querySelectorAll('#h-tc button').forEach((b) => (b.onclick = () => { opts.tc = +b.dataset.t; saveOpts(); renderHome(); }));
  v.querySelectorAll('.lv').forEach((b) => (b.onclick = () => { opts.level = +b.dataset.l; saveOpts(); renderHome(); }));
  v.querySelectorAll('.theme').forEach((b) => (b.onclick = () => { opts.theme = b.dataset.th; applyTheme(opts.theme); saveOpts(); renderHome(); }));
  $('#h-start').onclick = () => {
    const c = opts.color === 'r' ? (Math.random() < 0.5 ? 'w' : 'b') : opts.color;
    startGame({ color: c, levelId: opts.level, mode: opts.mode, tc: opts.mode === 'teach' ? 0 : opts.tc });
  };
  if (cur) $('#h-resume').onclick = () => startGame(cur, true);
  v.querySelectorAll('[data-a]').forEach((b) => (b.onclick = () => openAnalysis(games().find((g) => g.id === b.dataset.a))));
  v.querySelectorAll('[data-d]').forEach((b) => (b.onclick = () => {
    if (confirm('Excluir esta partida?')) { saveGames(games().filter((g) => g.id !== b.dataset.d)); renderHome(); }
  }));
  $('#h-import').onclick = importPgnDialog;
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
  G.start = cfg.start; G.color = cfg.color; G.levelId = cfg.levelId; G.mode = cfg.mode || 'play';
  G.tc = G.mode === 'teach' ? 0 : (cfg.tc === undefined ? 10 : cfg.tc);
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
  store.set('xq.current', { start: G.start, color: G.color, levelId: G.levelId, mode: G.mode, tc: G.tc, clock: G.clock, ucis: G.ucis });
}

/* ----- relógio ----- */
let clockT = null, lastTick = 0;
function startClock() { stopClock(); if (!G.tc) return; lastTick = performance.now(); clockT = setInterval(tickClock, 100); updateClocks(); }
function stopClock() { if (clockT) clearInterval(clockT); clockT = null; }
function tickClock() {
  const now = performance.now(); const dt = now - lastTick; lastTick = now;
  if (G.over || !G.game) return;
  if (G.ucis.length >= 2) {
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
    el.classList.toggle('on', !G.over && G.ucis.length >= 2 && G.game.turn() === c);
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
  $('#g-back').onclick = () => { G.gen++; G.teach.tt++; stopClock(); renderHome(); };
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
  if (id === 'm-ana') { closeModal(); if (G.ucis.length < 2) return toast('Jogue alguns lances primeiro.'); G.gen++; stopClock(); const rec = { id: uid(), date: Date.now(), start: G.start, ucis: G.ucis.slice(), color: G.color, levelId: G.levelId, result: '*' }; openAnalysis(rec, true); }
  if (id === 'm-pgn') { closeModal(); copyPgn(); }
  if (id === 'm-res') { closeModal(); if (!G.over && G.ucis.length) finishGame(G.color === 'w' ? '0-1' : '1-0', 'Você desistiu.'); }
  if (id === 'm-new') { closeModal(); G.gen++; stopClock(); renderHome(); }
});
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
    $('#g-undo').disabled = n === 0 || !!G.over;
    $('#g-hint').disabled = !!G.over || G.thinking || G.hinting || g.turn() !== G.color;
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
  const rec = { id: uid(), date: Date.now(), start: G.start, ucis: G.ucis.slice(), color: G.color, levelId: G.levelId, mode: G.mode, result };
  const all = games(); all.push(rec); saveGames(all); store.del('xq.current');
  renderGame();
  setTimeout(() => {
    openModal(`<h3>${title}</h3><p class="muted" style="margin:4px 0 14px">${text}</p>
      <div style="display:flex;flex-direction:column;gap:8px"><button class="btn primary" id="e-ana">📊 Ver análise completa</button><button class="btn" id="e-new">Nova partida</button><button class="btn" id="e-close">Ver tabuleiro</button></div>`);
    $('#e-ana').onclick = () => { closeModal(); openAnalysis(rec); };
    $('#e-new').onclick = () => { closeModal(); renderHome(); };
    $('#e-close').onclick = closeModal;
  }, 600);
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

/* ---------- início ---------- */
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
renderHome();
