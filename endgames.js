// Treino de finais: mates básicos, rei e peão, Lucena. O adversário defende com o Stockfish.
export function initEndgames(C) {
  const { $, store, toast, openModal, closeModal, show, Board, Chess, coachHTML, animList, kingSq, fmtSan, askPromotion, beep, renderHome, getAnaEngine } = C;
  const V = $('#view-train');
  const FILES = 'abcdefgh';
  const LES = [
    { id: 'kqk', name: 'Mate com dama', ic: '♛', sub: 'Rei e dama contra rei', kind: 'mate', pieces: ['q'], limit: 12,
      tip: '<b>Como fazer:</b> 1) Com a dama, fique a um "salto de cavalo" do rei adversário: ele não escapa e é empurrado para a borda. 2) Traga o seu rei para perto. 3) Só dê xeque quando for mate. <b>Cuidado:</b> se o adversário não tem lance e não está em xeque, é afogamento (empate)!' },
    { id: 'krk', name: 'Mate com torre', ic: '♜', sub: 'Rei e torre contra rei', kind: 'mate', pieces: ['r'], limit: 28,
      tip: '<b>Como fazer:</b> 1) Use a torre como uma parede: ela corta o rei adversário em uma fileira ou coluna. 2) Aproxime o seu rei até ficar de frente para o dele (oposição). 3) Aí a torre dá xeque na borda: mate. Nunca deixe a torre ao alcance do rei.' },
    { id: 'k2r', name: 'Mate da escada', ic: '♜♜', sub: 'Rei e duas torres contra rei', kind: 'mate', pieces: ['r', 'r'], limit: 12,
      tip: '<b>Como fazer:</b> as duas torres se revezam dando xeque em fileiras seguidas, como uma escada, empurrando o rei até a borda. Uma torre dá xeque e a outra já se prepara na fileira vizinha.' },
    { id: 'kpk', name: 'Rei e peão: promover', ic: '♙', sub: 'Leve o peão até virar dama', kind: 'win', pieces: ['p'], limit: 40,
      tip: '<b>Como fazer:</b> o rei vai <b>na frente</b> do peão, não atrás! Com o seu rei à frente e a oposição a seu favor, o peão passa. Se o treinador disser que o lance desperdiça a vitória, desfaça e tente outro.' },
    { id: 'lucena', name: 'Posição de Lucena', ic: '🌉', sub: 'Torre e peão na 7ª fileira', kind: 'win', fixed: '3K4/3P1k2/8/8/8/8/r7/4R3 w - - 0 1', limit: 40,
      tip: '<b>A ponte:</b> seu rei está na frente do peão, mas preso pelas torres. A ideia é levar a torre para a 4ª fileira e usá-la como "ponte" para o rei escapar dos xeques. Use a Dica à vontade: é uma posição famosa para decorar.' },
  ];
  const PN = { q: 'dama', r: 'torre', p: 'peão' };
  const st = () => store.get('xq.endg', {});
  const bump = (id, n) => { const s = st(); const o = s[id] || { wins: 0, best: 0 }; o.wins++; if (!o.best || n < o.best) o.best = n; s[id] = o; store.set('xq.endg', s); };

  /* ---------- posições aleatórias ---------- */
  const rnd = (n) => Math.floor(Math.random() * n);
  const sqOf = (f, r) => FILES[f] + (r + 1);
  const cheb = (a, b) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]));
  function fenOf(map, turn) {
    let s = '';
    for (let r = 7; r >= 0; r--) {
      let e = 0;
      for (let f = 0; f < 8; f++) {
        const p = map[sqOf(f, r)];
        if (!p) { e++; continue; }
        if (e) { s += e; e = 0; }
        s += p.color === 'w' ? p.type.toUpperCase() : p.type;
      }
      if (e) s += e;
      if (r) s += '/';
    }
    return `${s} ${turn} - - 0 1`;
  }
  function randomFen(les, me) {
    const opp = me === 'w' ? 'b' : 'w';
    for (let tries = 0; tries < 800; tries++) {
      const used = [];
      const pick = (fn) => { for (let k = 0; k < 60; k++) { const c = fn(); if (!used.some((u) => u[0] === c[0] && u[1] === c[1])) { used.push(c); return c; } } return null; };
      const wk = pick(() => [rnd(8), rnd(8)]);
      const bk = pick(() => [rnd(8), rnd(8)]);
      if (!wk || !bk || cheb(wk, bk) < 2) continue;
      const map = {};
      const myK = me === 'w' ? wk : bk, oppK = me === 'w' ? bk : wk;
      map[sqOf(...myK)] = { type: 'k', color: me }; map[sqOf(...oppK)] = { type: 'k', color: opp };
      let bad = false;
      for (const t of les.pieces) {
        let c;
        if (t === 'p') { const rel = 3 + rnd(3); c = pick(() => [rnd(8), me === 'w' ? rel : 7 - rel]); } else c = pick(() => [rnd(8), rnd(8)]);
        if (!c) { bad = true; break; }
        map[sqOf(...c)] = { type: t, color: me };
      }
      if (bad) continue;
      let g;
      try { g = new Chess(fenOf(map, me)); } catch (e) { continue; }
      const oppKs = kingOf(g, opp);
      if (!oppKs || g.attackers(oppKs, me).length) continue; // adversário em xeque: posição ilegal
      if (g.isGameOver()) continue;
      if (les.kind === 'mate' && g.moves({ verbose: true }).some((m) => m.san.includes('#'))) continue;
      // peças do usuário não podem estar capturáveis de graça logo no início
      const fenOpp = fenOf(map, opp);
      let go; try { go = new Chess(fenOpp); } catch (e) { continue; }
      if (go.moves({ verbose: true }).some((m) => m.captured && m.captured !== 'k')) continue;
      return g.fen();
    }
    return null;
  }
  const kingOf = (g, color) => { for (const row of g.board()) for (const p of row) if (p && p.type === 'k' && p.color === color) return p.square; return null; };

  /* ---------- menu ---------- */
  function menu() {
    show('train');
    const s = st();
    V.innerHTML = `<div class="screen trm"><div class="hdr"><button class="ibtn" id="e-back">←</button><h2>Finais</h2><span style="width:40px"></span></div>
      <div class="trbody"><p class="muted" style="font-size:14px;line-height:1.45;margin:2px 2px 12px">Finais são onde mais se perde ponto contra humanos. Aqui o Stockfish defende o melhor possível e o treinador te corrige se você <b>desperdiçar a vitória</b>.</p>
      ${LES.map((l) => { const o = s[l.id]; return `<button class="hub" data-l="${l.id}"><i>${l.ic}</i><div><b>${l.name}</b><span>${l.sub}${o ? ` · ${o.wins}× feito · melhor: ${o.best} lances` : ''}</span></div><em>${o ? '✅' : '›'}</em></button>`; }).join('')}
      </div></div>`;
    $('#e-back').onclick = () => renderHome('train');
    V.querySelectorAll('[data-l]').forEach((b) => (b.onclick = () => start(LES.find((l) => l.id === b.dataset.l))));
  }

  /* ---------- partida de treino ---------- */
  const P = window.__egP = { les: null, g: null, me: 'w', board: null, n: 0, gen: 0, locked: true, done: false, hist: [], arrow: null, anim: null, flip: false, msg: null };
  function build() {
    V.innerHTML = `<div class="screen pz"><div class="hdr"><button class="ibtn" id="g-back2">←</button><h2 id="g-title"></h2><button class="ibtn" id="g-flip2">⇅</button></div>
      <div class="pinfo" id="g-info"></div>
      <div id="g-coach" style="display:flex;flex-direction:column;flex:1 1 auto;min-height:0"></div>
      <div class="boardwrap"><div id="g-board2"></div></div>
      <div class="dock"><div class="tb4"><button class="t" id="g-hint2"><span>💡</span>Dica</button><button class="t" id="g-undo2"><span>↩</span>Desfazer</button><button class="t" id="g-redo2"><span>↻</span>Reiniciar</button><button class="next" id="g-next2">Nova</button></div></div></div>`;
    P.board = new Board($('#g-board2'), {
      canSelect: (sq) => !P.locked && !P.done && (P.g.get(sq) || {}).color === P.me && P.g.turn() === P.me,
      getTargets: (sq) => P.g.moves({ square: sq, verbose: true }).map((m) => ({ to: m.to, capture: !!m.captured })),
      onMove: userMove,
    });
    $('#g-back2').onclick = () => { P.gen++; menu(); };
    $('#g-flip2').onclick = () => { P.flip = !P.flip; draw(); };
    $('#g-hint2').onclick = hint;
    $('#g-undo2').onclick = undo;
    $('#g-redo2').onclick = () => load(P.startFen, P.me);
    $('#g-next2').onclick = () => start(P.les);
  }
  const coach = (o) => { $('#g-coach').innerHTML = coachHTML(o); };
  function draw() {
    const orient = P.flip ? (P.me === 'w' ? 'b' : 'w') : P.me;
    let last = null; const h = P.g.history({ verbose: true }); if (h.length) { const m = h[h.length - 1]; last = [m.from, m.to]; }
    let chk = null; try { chk = kingSq(P.g); } catch (e) {}
    P.board.set({ fen: P.g.fen(), orientation: orient, last, check: chk, arrows: P.arrow ? [P.arrow] : [], anim: P.anim });
    P.anim = null;
    $('#g-title').textContent = P.les.name;
    $('#g-info').innerHTML = `<span>♟ Final</span><b>${P.me === 'w' ? 'Brancas' : 'Pretas'} jogam</b><span>Lance ${Math.min(P.n + (P.done ? 0 : 1), P.les.limit)}/${P.les.limit}</span>`;
    $('#g-next2').disabled = !P.done;
  }
  async function start(les) {
    P.les = les; P.gen++; const gen = P.gen; P.locked = true; P.done = true;
    show('train'); build();
    coach({ title: '<span class="spinner"></span>Preparando a posição…', text: '' });
    const me = Math.random() < 0.5 ? 'w' : 'b';
    let fen = les.fixed ? les.fixed : null; let color = les.fixed ? 'w' : me;
    if (!fen) {
      for (let k = 0; k < 14 && !fen; k++) {
        const f = randomFen(les, color); if (!f) continue;
        if (les.kind === 'win') { // só aceita posições realmente vencidas
          const r = await getAnaEngine().search(f, { movetime: 280 }); if (gen !== P.gen) return;
          const l = r.lines[0]; if (l && ((l.mate !== undefined && l.mate > 0) || (l.cp !== undefined && l.cp >= 300))) fen = f;
        } else fen = f;
      }
    }
    if (!fen) { color = 'w'; fen = les.fixed || '8/8/8/8/8/2K5/2P1k3/8 w - - 0 1'; }
    P.startFen = fen; P.me = color;
    load(fen, color, true);
  }
  function load(fen, color, intro) {
    P.gen++; P.g = new Chess(fen); P.me = color; P.n = 0; P.done = false; P.locked = false; P.hist = []; P.arrow = null; P.flip = false; P.msg = null;
    P.engGen = P.gen;
    coach({ title: `${P.les.name}`, text: P.les.tip, extra: P.les.kind === 'mate' ? `Dê mate em até ${P.les.limit} lances.` : 'Leve o peão até a promoção sem desperdiçar a vitória.' });
    draw();
  }
  async function userMove(from, to) {
    if (P.locked || P.done) return;
    const gen = P.gen;
    const cand = P.g.moves({ square: from, verbose: true }).filter((m) => m.to === to); if (!cand.length) return;
    let promo; if (cand[0].promotion) promo = await askPromotion(P.me);
    const before = P.g.fen();
    P.locked = true; P.arrow = null;
    const m = P.g.move({ from, to, promotion: promo });
    P.anim = animList(m, false); beep(P.g.isCheck() ? 'chk' : m.captured ? 'cap' : 'move'); draw();
    const reject = (why) => { P.g = new Chess(before); P.locked = false; P.anim = null; draw(); coach({ title: 'Esse lance não serve', badge: { color: '#ca3431', sym: '✗' }, text: why, extra: 'O lance foi desfeito: tente outro.' }); };
    // mate!
    if (P.g.isCheckmate()) { P.n++; return finish(true, 'Xeque-mate! 🎉'); }
    if (P.g.isStalemate()) return reject('Isso é <b>afogamento</b>: o rei adversário não tem lance e não está em xeque, então a partida empata. Deixe sempre uma casa de fuga, ou dê o mate de uma vez.');
    if (P.g.isInsufficientMaterial()) return reject('Você perdeu a sua peça: sobrou só rei contra rei, que é empate.');
    P.n++;
    P.hist.push(before);
    if (P.les.kind === 'mate') {
      if (P.g.moves({ verbose: true }).some((x) => x.captured && x.captured !== 'k')) { P.n--; P.hist.pop(); return reject('Sua peça ficou <b>sem proteção</b> ao lado do rei adversário, e ele a captura de graça. Mantenha a peça longe do rei ou protegida pelo seu rei.'); }
    } else {
      // posição vencida: veja se o lance joga a vitória fora
      let r; try { r = await getAnaEngine().search(P.g.fen(), { movetime: 260 }); } catch (e) { r = null; }
      if (gen !== P.gen) return;
      const l = r && r.lines[0];
      const lost = l && !((l.mate !== undefined && l.mate < 0) || (l.cp !== undefined && l.cp <= -130));
      if (lost && !m.promotion) { P.n--; P.hist.pop(); return reject('Esse lance <b>desperdiça a vitória</b>: o adversário consegue o empate (ou até algo pior). Pense em manter o rei na frente do peão e a oposição.'); }
      if (lost && m.promotion) { P.n--; P.hist.pop(); return reject('Promover aqui perde a peça ou deixa o empate. Prepare melhor antes de promover.'); }
      if (m.promotion) return finish(true, `Promoveu a ${PN[m.promotion] || 'peça'}! 🎉`);
    }
    if (P.n >= P.les.limit) return finish(false, 'Passou do limite de lances. Tente de novo ou peça uma Dica.');
    // vez do adversário
    coach({ title: '<span class="spinner"></span>Adversário pensando…', text: '' }); draw();
    let r2; try { r2 = await getAnaEngine().search(P.g.fen(), { movetime: 160 }); } catch (e) { r2 = null; }
    if (gen !== P.gen) return;
    await new Promise((res) => setTimeout(res, 350)); if (gen !== P.gen) return;
    if (!r2 || !r2.best) return finish(false, 'Algo deu errado com o motor. Reinicie.');
    const om = P.g.move({ from: r2.best.slice(0, 2), to: r2.best.slice(2, 4), promotion: r2.best[4] });
    P.anim = animList(om, false); beep(P.g.isCheck() ? 'chk' : om.captured ? 'cap' : 'move');
    if (P.g.isDraw() || P.g.isStalemate() || P.g.isInsufficientMaterial()) { P.locked = false; draw(); return finish(false, 'A partida acabou empatada. Desfaça ou reinicie.'); }
    P.locked = false; draw();
    coach({ title: `${P.les.name}`, text: `O adversário jogou <b>${fmtSan(om.san)}</b>. Sua vez.`, extra: P.les.kind === 'mate' ? `Lance ${P.n + 1} de ${P.les.limit}` : '' });
  }
  function finish(ok, txt) {
    P.done = true; P.locked = true; draw();
    if (ok) { bump(P.les.id, P.n || 1); beep('end'); }
    coach({ title: txt, badge: ok ? { color: '#81b64c', sym: '✓' } : { color: '#ca3431', sym: '✗' }, text: ok ? `Você fez em <b>${P.n}</b> ${P.n === 1 ? 'lance' : 'lances'}. Toque em <b>Nova</b> para treinar com outra posição.` : 'Toque em <b>Reiniciar</b> para tentar esta posição de novo, ou <b>Nova</b> para outra.' });
    if (!ok) { P.locked = true; $('#g-next2').disabled = false; }
  }
  function undo() {
    if (P.hist.length === 0 || P.locked && !P.done) return;
    P.gen++; const f = P.hist.pop(); P.g = new Chess(f); P.n = Math.max(0, P.n - 1); P.done = false; P.locked = false; P.arrow = null; draw();
    coach({ title: 'Lance desfeito', text: 'Tente outra ideia.' });
  }
  async function hint() {
    if (P.locked || P.done) return;
    const gen = P.gen; P.locked = true;
    coach({ title: '<span class="spinner"></span>Pensando…', text: '' });
    let r; try { r = await getAnaEngine().search(P.g.fen(), { movetime: 350 }); } catch (e) { r = null; }
    if (gen !== P.gen) return;
    P.locked = false;
    if (!r || !r.best) return coach({ title: 'Sem dica agora', text: 'Tente de novo.' });
    const t = new Chess(P.g.fen()); const mv = t.move({ from: r.best.slice(0, 2), to: r.best.slice(2, 4), promotion: r.best[4] });
    P.arrow = { from: r.best.slice(0, 2), to: r.best.slice(2, 4), kind: 'good' }; draw();
    const why = t.isCheckmate() ? 'É xeque-mate!' : P.les.kind === 'mate' ? 'Esse lance aperta a rede em volta do rei adversário sem deixar a peça solta.' : 'Esse lance mantém a vitória: rei bem colocado e peão seguro.';
    coach({ title: `Dica: ${fmtSan(mv.san)}`, text: why, extra: 'A seta mostra o lance sugerido.' });
  }
  return { menu, count: () => Object.keys(st()).length, total: LES.length };
}
