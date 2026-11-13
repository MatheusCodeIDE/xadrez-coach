// Treino de aberturas: você joga a linha, o app responde com os lances do livro e corrige quando você sai dela.
export function initOpenings(C) {
  const { $, store, toast, openModal, closeModal, show, Board, Chess, coachHTML, animList, kingSq, fmtSan, askPromotion, beep, renderHome, openingLines, whyMove } = C;
  const V = $('#view-train');
  let LINES = null;
  const lines = () => (LINES = LINES || openingLines());
  const st = () => store.get('xq.open', {});
  const key = (i, c) => i + ':' + c;
  const done = (i, c) => (st()[key(i, c)] || { clean: 0, runs: 0 });
  const MASTER = 3; // execuções sem erro para considerar dominada

  function menu() {
    show('train');
    const L = lines(); const s = st();
    const mastered = Object.values(s).filter((o) => o.clean >= MASTER).length;
    const badge = (i, c) => { const o = done(i, c); return o.clean >= MASTER ? '✅' : o.runs ? `${o.clean}/${MASTER}` : '·'; };
    V.innerHTML = `<div class="screen trm"><div class="hdr"><button class="ibtn" id="o-back">←</button><h2>Treino de aberturas</h2><span style="width:40px"></span></div>
      <div class="trbody"><p class="muted" style="font-size:14px;line-height:1.45;margin:2px 2px 12px">Você joga a linha e o app responde com os lances do livro. Se sair da linha, ele avisa e mostra o lance certo. Faça <b>${MASTER} vezes sem erro</b> para dominar. Dominadas: <b>${mastered}</b></p>
      ${L.map((l, i) => `<button class="oprow" data-i="${i}"><b>${l.name}</b><span>⚪ ${badge(i, 'w')} &nbsp; ⚫ ${badge(i, 'b')}</span></button>`).join('')}
      </div></div>`;
    $('#o-back').onclick = () => renderHome('train');
    V.querySelectorAll('[data-i]').forEach((b) => (b.onclick = () => pickSide(+b.dataset.i)));
  }
  function pickSide(i) {
    const l = lines()[i];
    openModal(`<h3>${l.name}</h3><p class="muted" style="margin:6px 0 12px;line-height:1.45">${l.desc}</p>
      <div class="lbl" style="margin-top:0">Você joga de</div>
      <div class="seg" id="o-side"><button data-c="w" class="on">⚪ Brancas</button><button data-c="b">⚫ Pretas</button></div>
      <div class="lbl">Modo</div>
      <div class="seg" id="o-mode"><button data-m="guided" class="on">Guiado (com seta)</button><button data-m="memory">De memória</button></div>
      <button class="btn primary" id="o-go" style="width:100%;margin-top:14px">Começar</button>`);
    let c = 'w', m = 'guided';
    document.querySelectorAll('#o-side button').forEach((b) => (b.onclick = () => { c = b.dataset.c; document.querySelectorAll('#o-side button').forEach((x) => x.classList.toggle('on', x === b)); }));
    document.querySelectorAll('#o-mode button').forEach((b) => (b.onclick = () => { m = b.dataset.m; document.querySelectorAll('#o-mode button').forEach((x) => x.classList.toggle('on', x === b)); }));
    $('#o-go').onclick = () => { closeModal(); start(i, c, m); };
  }

  /* ---------- prática ---------- */
  const P = { i: 0, color: 'w', mode: 'guided', g: null, ply: 0, errs: 0, board: null, gen: 0, locked: true, done: false, arrow: null, anim: null, flip: false, wrong: null };
  function build() {
    V.innerHTML = `<div class="screen pz"><div class="hdr"><button class="ibtn" id="q-back">←</button><h2 id="q-title"></h2><button class="ibtn" id="q-flip">⇅</button></div>
      <div class="pinfo" id="q-info"></div>
      <div id="q-coach" style="display:flex;flex-direction:column;flex:1 1 auto;min-height:0"></div>
      <div class="boardwrap"><div id="q-board"></div></div>
      <div class="dock"><div class="tb4"><button class="t" id="q-hint"><span>💡</span>Dica</button><button class="t" id="q-mode"><span>🧠</span>Modo</button><button class="t" id="q-redo"><span>↻</span>Reiniciar</button><button class="next" id="q-next">Próxima</button></div></div></div>`;
    P.board = new Board($('#q-board'), {
      canSelect: (sq) => !P.locked && !P.done && (P.g.get(sq) || {}).color === P.color && P.g.turn() === P.color,
      getTargets: (sq) => P.g.moves({ square: sq, verbose: true }).map((m) => ({ to: m.to, capture: !!m.captured })),
      onMove: userMove,
    });
    $('#q-back').onclick = () => { P.gen++; menu(); };
    $('#q-flip').onclick = () => { P.flip = !P.flip; draw(); };
    $('#q-hint').onclick = hint;
    $('#q-mode').onclick = () => { P.mode = P.mode === 'guided' ? 'memory' : 'guided'; toast(P.mode === 'guided' ? 'Modo guiado: a seta mostra o lance' : 'Modo de memória: sem seta'); showArrow(); draw(); };
    $('#q-redo').onclick = () => start(P.i, P.color, P.mode);
    $('#q-next').onclick = () => { const n = (P.i + 1) % lines().length; start(n, P.color, P.mode); };
  }
  const coach = (o) => { $('#q-coach').innerHTML = coachHTML(o); };
  const line = () => lines()[P.i].ucis;
  const sanOf = (fen, u) => { try { const t = new Chess(fen); return fmtSan(t.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }).san); } catch (e) { return u; } };
  function showArrow() {
    P.arrow = null;
    if (P.mode === 'guided' && !P.done && P.g.turn() === P.color && P.ply < line().length) { const u = line()[P.ply]; P.arrow = { from: u.slice(0, 2), to: u.slice(2, 4), kind: 'good' }; }
  }
  function draw() {
    const orient = P.flip ? (P.color === 'w' ? 'b' : 'w') : P.color;
    let last = null; const h = P.g.history({ verbose: true }); if (h.length) { const m = h[h.length - 1]; last = [m.from, m.to]; }
    let chk = null; try { chk = kingSq(P.g); } catch (e) {}
    P.board.set({ fen: P.g.fen(), orientation: orient, last, check: chk, arrows: P.arrow ? [P.arrow] : [], marks: P.wrong, anim: P.anim });
    P.anim = null;
    const L = lines()[P.i];
    $('#q-title').textContent = L.name;
    $('#q-info').innerHTML = `<span>📖 ${P.mode === 'guided' ? 'Guiado' : 'De memória'}</span><b>${P.color === 'w' ? 'Brancas' : 'Pretas'}</b><span>${Math.min(P.ply, line().length)}/${line().length} · ${P.errs} erro${P.errs === 1 ? '' : 's'}</span>`;
  }
  async function start(i, color, mode) {
    P.i = i; P.color = color; P.mode = mode; P.gen++; const gen = P.gen;
    P.g = new Chess(); P.ply = 0; P.errs = 0; P.done = false; P.locked = true; P.flip = false; P.wrong = null; P.arrow = null;
    show('train'); build();
    const L = lines()[i];
    coach({ title: L.name, text: `${L.desc}<br><br>Você joga de <b>${color === 'w' ? 'brancas' : 'pretas'}</b>. Siga a linha de livro.` });
    draw();
    if (color === 'b') { await sleep(700); if (gen !== P.gen) return; await oppMove(gen); } else { P.locked = false; showArrow(); draw(); }
  }
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  async function oppMove(gen) {
    const u = line()[P.ply]; const fen = P.g.fen();
    const m = P.g.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
    P.ply++; P.anim = animList(m, false); beep(P.g.isCheck() ? 'chk' : m.captured ? 'cap' : 'move');
    let why = []; try { why = whyMove(fen, u, P.ply - 1); } catch (e) {}
    P.locked = false; P.wrong = null; showArrow(); draw();
    if (P.ply >= line().length) return finishLine();
    coach({ title: `O adversário joga ${fmtSan(m.san)}`, text: why.length ? why[0] : 'Lance de livro.', extra: 'Sua vez: qual é o próximo lance da linha?' });
  }
  async function userMove(from, to) {
    if (P.locked || P.done) return;
    const gen = P.gen;
    const cand = P.g.moves({ square: from, verbose: true }).filter((m) => m.to === to); if (!cand.length) return;
    let promo; if (cand[0].promotion) promo = await askPromotion(P.color);
    const uci = from + to + (promo || ''); const exp = line()[P.ply]; const fen = P.g.fen();
    if (uci !== exp) {
      // lance fora da linha: avisa, mostra o certo e não aceita
      P.errs++; P.wrong = { [to]: 'bad' }; P.arrow = null;
      const sx = sanOf(fen, exp);
      let ok = true; try { const t = new Chess(fen); const m = t.move({ from, to, promotion: promo }); P.wrongSan = fmtSan(m.san); } catch (e) { ok = false; }
      beep('end'); draw();
      coach({ title: `Fora da linha${P.wrongSan ? ': ' + P.wrongSan : ''}`, badge: { color: '#ca3431', sym: '✗' }, text: `Na linha de livro o lance certo aqui é <b>${sx}</b>. Outros lances podem até ser bons, mas aqui estamos treinando esta abertura.`, extra: P.mode === 'guided' ? 'Siga a seta.' : 'Use a Dica se precisar.' });
      P.arrow = { from: exp.slice(0, 2), to: exp.slice(2, 4), kind: 'good' }; draw();
      return;
    }
    P.locked = true;
    let why = []; try { why = whyMove(fen, uci, P.ply); } catch (e) {}
    const m = P.g.move({ from, to, promotion: promo });
    P.ply++; P.anim = animList(m, false); beep(P.g.isCheck() ? 'chk' : m.captured ? 'cap' : 'move'); P.arrow = null; P.wrong = null; draw();
    if (P.ply >= line().length) return finishLine();
    coach({ title: `Certo! ${fmtSan(m.san)}`, badge: { color: '#81b64c', sym: '✓' }, text: why.length ? why.join(' ') : 'Lance de livro.' });
    await sleep(900); if (gen !== P.gen) return;
    await oppMove(gen);
  }
  function finishLine() {
    P.done = true; P.locked = true; P.arrow = null;
    const s = st(); const k = key(P.i, P.color); const o = s[k] || { clean: 0, runs: 0 };
    o.runs++; if (P.errs === 0) o.clean++; else o.clean = Math.max(0, o.clean - 0); s[k] = o; store.set('xq.open', s);
    beep('end'); draw();
    const clean = P.errs === 0;
    coach({ title: clean ? 'Linha completa, sem erros! 🎉' : 'Linha completa!', badge: { color: clean ? '#81b64c' : '#5c8bb0', sym: clean ? '✓' : '!' },
      text: clean ? (o.clean >= MASTER ? '<b>Abertura dominada!</b> Você acertou toda a linha ' + MASTER + ' vezes.' : `Sem erros: ${o.clean}/${MASTER} para dominar. Repita em modo <b>De memória</b>.`) : `Você errou ${P.errs} ${P.errs === 1 ? 'vez' : 'vezes'}. Repita até acertar tudo sem dica.`,
      extra: 'Toque em Reiniciar para repetir ou Próxima para outra abertura.' });
  }
  function hint() {
    if (P.locked || P.done) return;
    const exp = line()[P.ply]; if (!exp) return;
    P.errs++; P.arrow = { from: exp.slice(0, 2), to: exp.slice(2, 4), kind: 'good' }; draw();
    coach({ title: `Dica: ${sanOf(P.g.fen(), exp)}`, text: 'Esse é o lance da linha. Usar a dica conta como um erro nesta tentativa.' });
  }
  return { menu, mastered: () => Object.values(st()).filter((o) => o.clean >= MASTER).length };
}
