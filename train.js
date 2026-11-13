// Desafios: táticas (erros típicos de humanos), enxergar o tabuleiro e revisão dos seus erros
export function initTrain(C) {
  const { $, store, toast, openModal, closeModal, show, Board, Chess, coachHTML, whyBox, animList, kingSq, fmtSan, askPromotion, beep, renderHome, getAnaEngine, games, openAnalysis, winPct, classify, whyMove } = C;
  const V = $('#view-train');
  let PZ = null;
  const OK = { color: '#81b64c', sym: '✓' }, NO = { color: '#ca3431', sym: '✗' }, INFO = { color: '#5c8bb0', sym: '!' };
  const LV = { 1: ['Fácil', 'Mate em 1, peças soltas, capturas simples'], 2: ['Médio', 'Garfos, cravadas e ataques duplos'], 3: ['Difícil', 'Combinações de 2 lances e lances silenciosos'], 4: ['Muito difícil', 'Sequências longas e sacrifícios'], 5: ['Impossível', 'Só o Stockfish acha de primeira. Respire fundo!'] };
  const PN = { p: 'peão', n: 'cavalo', b: 'bispo', r: 'torre', q: 'dama', k: 'rei' };
  const VAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };
  const FEM = { p: false, n: false, b: false, r: true, q: true };
  const cap = (s) => s[0].toUpperCase() + s.slice(1);

  const THEME = {
    mate1: { name: 'Mate em 1', hint: 'Existe um xeque-mate em um lance. Procure os xeques e veja se o rei tem para onde fugir.', lesson: 'Antes de qualquer lance, procure TODOS os xeques. Se o rei não tem casa de fuga nem defesa, é mate.', err: 'ele deixou o rei sem saída e não viu o mate.' },
    mate2: { name: 'Mate em 2', hint: 'Há um mate forçado em 2 lances. Comece por xeques e lances que tiram casas do rei.', lesson: 'Com o rei adversário exposto, calcule os xeques em sequência: cada resposta dele é quase forçada.', err: 'ele expôs o rei e permitiu um ataque decisivo.' },
    mate3: { name: 'Mate em 3', hint: 'Há um mate forçado em até 3 lances. Pense em xeques que limitam o rei.', lesson: 'Mates mais longos nascem de xeques seguidos que empurram o rei para a borda.', err: 'ele deixou o rei exposto por vários lances.' },
    backrank: { name: 'Mate do corredor', hint: 'O rei está preso atrás dos próprios peões. Um xeque na última fileira pode ser mate.', lesson: 'Esse é o truque mais comum contra humanos. Abra uma casinha de fuga para o seu rei (mova um peão da frente) e vigie a última fileira.', err: 'o rei dele ficou preso atrás dos próprios peões.' },
    promo: { name: 'Promoção', hint: 'Um peão está perto de virar dama. Dá para coroá-lo?', lesson: 'Peões avançados valem muito. Calcule se consegue promover antes de o adversário parar o peão.', err: 'ele não parou o peão a tempo.' },
    fork: { name: (x) => 'Garfo de ' + PN[x], hint: 'Um único lance pode atacar duas peças ao mesmo tempo.', lesson: 'Garfo: uma peça ataca duas e o adversário só salva uma. Antes de jogar, veja onde seu cavalo pula e ataca duas peças; e confira se o do adversário pode fazer o mesmo.', err: 'ele permitiu um ataque duplo.' },
    pin: { name: 'Cravada', hint: 'Uma peça adversária não pode se mover sem expor outra mais valiosa.', lesson: 'Cravada: a peça da frente fica presa porque atrás dela há algo mais valioso. Ataque a peça cravada de novo, ou evite ficar cravado.', err: 'ele deixou uma peça cravada.' },
    skewer: { name: 'Espeto', hint: 'Ataque uma peça valiosa: ao fugir, ela deixa outra peça exposta atrás dela.', lesson: 'Espeto é o contrário da cravada: a peça valiosa foge e você captura a que estava atrás.', err: 'ele alinhou duas peças numa mesma linha.' },
    hanging: { name: (x) => `${cap(PN[x])} pendurad${FEM[x] ? 'a' : 'o'}`, hint: 'Há uma peça adversária sem nenhuma proteção. Qual?', lesson: 'Pergunte sempre: "quais peças do adversário estão soltas?" e "quais das minhas estão?". Contra humanos, muitas partidas se decidem por uma peça esquecida.', err: 'ele deixou a peça sem proteção.' },
    winexch: { name: 'Troca vantajosa', hint: 'Uma captura ganha mais do que você arrisca.', lesson: 'Conte os valores: peão 1, cavalo e bispo 3, torre 5, dama 9. Capturar algo que vale mais que a sua peça é lucro.', err: 'ele deixou uma peça valiosa ao alcance de uma peça menor.' },
    check: { name: 'Xeque decisivo', hint: 'Um xeque forçado leva ao ganho de material.', lesson: 'Xeques são lances forçados: o adversário precisa responder e você controla a sequência.', err: 'ele não viu o xeque que ganha material.' },
    sac: { name: 'Sacrifício', hint: 'Entregar material agora garante algo maior.', lesson: 'Sacrifício compensa quando o ganho é forçado (mate ou mais material). Calcule a linha inteira antes de soltar a peça.', err: 'ele não percebeu o sacrifício que vinha.' },
    winmat: { name: 'Ganhar material', hint: 'Existe uma sequência que termina com você ganhando material.', lesson: 'Procure, nessa ordem: xeques, capturas e ameaças, para os dois lados.', err: 'ele deixou material desprotegido.' },
    tactic: { name: 'Tática', hint: 'Procure xeques, capturas e ameaças, nessa ordem.', lesson: 'A rotina "xeques, capturas, ameaças" resolve a maior parte das táticas.', err: 'ele não viu a tática.' },
    defend: { name: 'Defenda-se!', hint: 'O adversário ameaça algo sério. O que ele faria se fosse a vez dele?', lesson: 'Antes de cada lance, pergunte: "o que o meu adversário quer fazer?". Quase toda derrota contra humanos vem de uma ameaça ignorada.', err: 'a ameaça dele está no ar: não ignore!' },
    review: { name: 'Seu erro', hint: 'Esse lance saiu errado na sua partida. Qual seria melhor?', lesson: 'Os erros se repetem: reveja-os até o lance certo virar reflexo.', err: '' },
  };
  const themeInfo = (t) => { const [k, x] = (t || 'tactic').split(':'); const b = THEME[k] || THEME.tactic; return { ...b, name: typeof b.name === 'function' ? b.name(x) : b.name }; };

  /* ---------- dados e progresso ---------- */
  const today = () => new Date().toISOString().slice(0, 10);
  const prog = () => Object.assign({ solved: {}, failed: {}, streak: { cur: 0, best: 0, last: '' }, vis: {}, rev: {} }, store.get('xq.train', {}));
  const saveProg = (p) => store.set('xq.train', p);
  async function load() {
    if (PZ) return PZ;
    try { const r = await fetch('puzzles.json'); PZ = (await r.json()).map((p, i) => ({ ...p, id: 'p' + (p.id || i) })); } catch (e) { PZ = []; toast('Não consegui carregar os desafios.'); }
    return PZ;
  }
  const levelList = (l) => (PZ || []).filter((p) => p.kind === 'tactic' && p.level === l);
  const defendList = () => (PZ || []).filter((p) => p.kind === 'defend');
  const stat = (list) => { const p = prog(); const s = list.filter((x) => p.solved[x.id]).length; return { s, n: list.length }; };
  function touchStreak() {
    const p = prog(); const t = today(); const y = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
    if (p.streak.last !== t) { p.streak.cur = p.streak.last === y ? p.streak.cur + 1 : 1; p.streak.last = t; p.streak.best = Math.max(p.streak.best, p.streak.cur); saveProg(p); }
  }
  const streakNow = () => { const s = prog().streak; const t = today(); const y = new Date(Date.now() - 864e5).toISOString().slice(0, 10); return s.last === t || s.last === y ? s.cur : 0; };

  const totals = () => { const l = (PZ || []).filter((p) => p.kind === 'tactic'); const p = prog(); return { n: l.length, solved: l.filter((x) => p.solved[x.id]).length }; };
  const dailyDone = () => prog().dailyDone === today();
  const reviewCount = () => reviewItems().length;

  /* ---------- menu de táticas ---------- */
  async function menuTactics() {
    await load(); show('train');
    const p = prog(); let rec = 0;
    for (let l = 1; l <= 5; l++) { const s = stat(levelList(l)); if (s.n && s.s / s.n < 0.7) { rec = l; break; } }
    const rows = [1, 2, 3, 4, 5].map((l) => { const s = stat(levelList(l)); const pc = s.n ? Math.round((s.s / s.n) * 100) : 0;
      return `<button class="lvrow ${rec === l ? 'rec' : ''}" data-l="${l}"><div class="stars">${'★'.repeat(l)}<span>${'★'.repeat(5 - l)}</span></div><div class="g"><b>Nível ${l} · ${LV[l][0]}${rec === l ? ' <em>recomendado</em>' : ''}</b><small>${LV[l][1]}</small><div class="pb"><i style="width:${pc}%"></i></div></div><div class="n">${s.s}/${s.n}</div></button>`; }).join('');
    const d = stat(defendList());
    V.innerHTML = `<div class="screen trm"><div class="hdr"><button class="ibtn" id="m-back">←</button><h2>Táticas</h2><span style="width:40px"></span></div>
      <div class="trbody"><p class="muted" style="font-size:14px;line-height:1.45;margin:2px 2px 12px">São posições de partidas em que alguém <b>errou</b>, como um humano erra. Ache o lance que pune o erro. Cada nível fica mais difícil de enxergar.</p>
      ${rows}
      <button class="lvrow def" data-d="1"><div class="stars" style="font-size:26px">🛡</div><div class="g"><b>Defenda-se!</b><small>O adversário ameaça algo: veja o perigo e ache a defesa</small><div class="pb"><i style="width:${d.n ? Math.round((d.s / d.n) * 100) : 0}%"></i></div></div><div class="n">${d.s}/${d.n}</div></button>
      <div class="muted" style="text-align:center;font-size:12px;margin-top:10px">Sequência: ${p.streak.cur ? '🔥 ' + streakNow() : '—'} · Recorde: ${p.streak.best} dias</div></div></div>`;
    $('#m-back').onclick = () => renderHome('train');
    V.querySelectorAll('[data-l]').forEach((b) => (b.onclick = () => startPuzzles(levelList(+b.dataset.l), 'Nível ' + b.dataset.l, 'tactic')));
    V.querySelector('[data-d]').onclick = () => startPuzzles(defendList(), 'Defenda-se!', 'defend');
  }

  /* ---------- tela de desafio ---------- */
  const P = { list: [], idx: 0, title: '', mode: 'tactic', pz: null, g: null, step: 0, tries: 0, side: 'w', locked: true, done: false, hintLv: 0, board: null, gen: 0, flip: false, shown: false, wrongMark: null, backTo: null };
  function buildPuzzleView() {
    V.innerHTML = `<div class="screen pz"><div class="hdr"><button class="ibtn" id="p-back">←</button><h2 id="p-title"></h2><button class="ibtn" id="p-flip">⇅</button></div>
      <div class="pinfo" id="p-info"></div>
      <div id="p-coach" style="display:flex;flex-direction:column;flex:1 1 auto;min-height:0"></div>
      <div class="boardwrap"><div id="p-board"></div></div>
      <div class="dock"><div class="tb4"><button class="t" id="p-hint"><span>💡</span>Dica</button><button class="t" id="p-sol"><span>👁</span>Solução</button><button class="t" id="p-redo"><span>↻</span>Reiniciar</button><button class="next" id="p-next">Próximo</button></div></div></div>`;
    P.board = new Board($('#p-board'), {
      canSelect: (sq) => !P.locked && !P.done && (P.g.get(sq) || {}).color === P.g.turn() && P.g.turn() === P.side,
      getTargets: (sq) => P.g.moves({ square: sq, verbose: true }).map((m) => ({ to: m.to, capture: !!m.captured })),
      onMove: userMove,
    });
    $('#p-back').onclick = () => { P.gen++; (P.backTo || menuTactics)(); };
    $('#p-flip').onclick = () => { P.flip = !P.flip; drawP(); };
    $('#p-hint').onclick = hint; $('#p-sol').onclick = showSolution; $('#p-redo').onclick = () => loadPuzzle(P.idx);
    $('#p-next').onclick = nextPuzzle;
    $('#p-coach').onclick = (e) => { const a = e.target.closest('[data-act]'); if (!a) return; if (a.dataset.act === 'next') nextPuzzle(); if (a.dataset.act === 'sol') showSolution(); if (a.dataset.act === 'hint') hint(); };
  }
  function startPuzzles(list, title, mode, opts = {}) {
    if (!list.length) return toast('Ainda não há desafios aqui.');
    P.list = list; P.title = title; P.mode = mode; P.backTo = opts.backTo || null;
    const p = prog(); let i = list.findIndex((x) => !(mode === 'review' ? p.rev[x.id] : p.solved[x.id])); if (i < 0) i = 0;
    show('train'); buildPuzzleView(); loadPuzzle(i);
  }
  const sideName = (c) => (c === 'w' ? 'Brancas' : 'Pretas');
  async function loadPuzzle(i) {
    const gen = ++P.gen; P.idx = i; const pz = P.list[i]; P.pz = pz; P.step = 0; P.tries = 0; P.done = false; P.hintLv = 0; P.shown = false; P.flip = false; P.wrongMark = null; P.locked = true;
    P.side = pz.side; P.title2 = '';
    const total = P.list.length;
    $('#p-title').textContent = `${P.title} · ${i + 1}/${total}`;
    $('#p-next').disabled = true; $('#p-sol').disabled = false; $('#p-hint').disabled = false;
    if (pz.pre) {
      P.g = new Chess(pz.pre); drawP();
      $('#p-coach').innerHTML = coachHTML({ title: 'Observe a posição…', text: `${sideName(P.side)} jogam. Veja o que o adversário vai fazer.` });
      await new Promise((r) => setTimeout(r, 650)); if (gen !== P.gen) return;
      const m = P.g.move({ from: pz.opp.slice(0, 2), to: pz.opp.slice(2, 4), promotion: pz.opp[4] });
      P.anim = animList(m, false); beep(P.g.isCheck() ? 'chk' : m.captured ? 'cap' : 'move'); drawP();
      await new Promise((r) => setTimeout(r, 450)); if (gen !== P.gen) return;
    } else { P.g = new Chess(pz.fen); drawP(); }
    P.locked = false; promptP(); drawP();
  }
  function promptP() {
    const pz = P.pz; let ttl, txt;
    if (P.mode === 'review') { ttl = `${sideName(P.side)} jogam`; txt = `Na sua partida você jogou <b>${pz.san}</b> aqui (${pz.clsLabel}). Ache um lance melhor!`; }
    else if (pz.kind === 'defend') { ttl = `${sideName(P.side)} jogam · Cuidado!`; txt = `O adversário jogou <b>${pz.oppSan}</b> e ameaça algo sério. Ache o lance que evita o perigo.`; }
    else { ttl = `${sideName(P.side)} jogam`; txt = pz.oppSan ? `O adversário acabou de jogar <b>${pz.oppSan}</b>, um erro. Ache o melhor lance e aproveite!` : 'Ache o melhor lance.'; }
    const n = pz.sol ? Math.ceil(pz.sol.length / 2) : 1;
    $('#p-coach').innerHTML = coachHTML({ title: ttl, text: txt, extra: n > 1 && P.mode !== 'review' ? `Resolução em ${n} lances seus.` : '' });
  }
  function drawP() {
    const orient = P.flip ? (P.side === 'w' ? 'b' : 'w') : P.side;
    let last = null; const h = P.g.history({ verbose: true }); if (h.length) { const m = h[h.length - 1]; last = [m.from, m.to]; }
    let chk = null; try { chk = kingSq(P.g); } catch (e) {}
    let arrows = []; if (P.arrow) arrows = [P.arrow];
    P.board.set({ fen: P.g.fen(), orientation: orient, last, check: chk, arrows, marks: P.wrongMark || (P.hintLv >= 2 && !P.done ? { [P.pz.sol[P.step].slice(0, 2)]: 'pick' } : null), anim: P.anim });
    P.anim = null;
    $('#p-info').innerHTML = `<span>${P.pz.kind === 'defend' ? '🛡 Defenda-se' : P.mode === 'review' ? '🔁 Seu erro' : '♞ Nível ' + P.pz.level}</span><b>${sideName(P.side)} jogam</b><span>${P.mode === 'review' ? '' : '★'.repeat(P.pz.level || 1)}</span>`;
  }
  async function userMove(from, to) {
    if (P.locked || P.done) return;
    const gen = P.gen; const pz = P.pz; const cand = P.g.moves({ square: from, verbose: true }).filter((m) => m.to === to); if (!cand.length) return;
    let promo; if (cand[0].promotion) promo = await askPromotion(P.side);
    const uci = from + to + (promo || ''); const exp = pz.sol[P.step];
    const t = new Chess(P.g.fen()); const mv = t.move({ from, to, promotion: promo });
    let ok = uci === exp || t.isCheckmate(); let alt = false;
    P.arrow = null;
    if (!ok && !t.isCheckmate()) {
      P.locked = true; $('#p-coach').innerHTML = coachHTML({ title: '<span class="spinner"></span>Avaliando seu lance…' });
      try {
        const r = await getAnaEngine().search(t.fen(), { depth: 10 }); if (gen !== P.gen) return;
        const w = winPct(-(r.lines[0] ? (r.lines[0].mate !== undefined ? (r.lines[0].mate > 0 ? 10000 : -10000) : r.lines[0].cp) : 0));
        const base = P.step === 0 ? winPct(pz.cp) : 72;
        if (P.mode === 'review') ok = alt = w >= base - 5;
        else if (pz.kind === 'defend') ok = alt = w >= Math.max(33, base - 10);
        else ok = alt = w >= Math.max(60, base - 8);
      } catch (e) {}
      P.locked = false;
    }
    if (!ok) { wrong(mv); return; }
    P.g.move({ from, to, promotion: promo }); P.anim = animList(mv, false); beep(P.g.isCheck() ? 'chk' : mv.captured ? 'cap' : 'move');
    P.hintLv = 0; P.wrongMark = null;
    if (alt || P.step + 1 >= pz.sol.length || P.g.isGameOver()) { drawP(); return success(alt, mv); }
    P.locked = true; P.step++; drawP();
    $('#p-coach').innerHTML = coachHTML({ badge: OK, title: 'Muito bem!', text: 'Continue: o adversário respondeu.' });
    await new Promise((r) => setTimeout(r, 600)); if (gen !== P.gen) return;
    const ru = pz.sol[P.step]; const rm = P.g.move({ from: ru.slice(0, 2), to: ru.slice(2, 4), promotion: ru[4] });
    P.anim = animList(rm, false); beep(P.g.isCheck() ? 'chk' : rm.captured ? 'cap' : 'move'); P.step++; P.locked = false; drawP();
    $('#p-coach').innerHTML = coachHTML({ title: `Adversário jogou ${fmtSan(rm.san)}`, text: 'Agora ache o próximo lance.' });
  }
  function wrong(mv) {
    const pz = P.pz; P.tries++;
    if (P.tries === 1) { const p = prog(); p.failed[pz.id] = (p.failed[pz.id] || 0) + 1; saveProg(p); }
    drawP(); const el = $('#p-board'); el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake');
    const links = `<button class="linkbtn" data-act="hint">💡 Dica</button>${P.tries >= 2 ? '<button class="linkbtn" data-act="sol">👁 Ver solução</button>' : ''}`;
    $('#p-coach').innerHTML = coachHTML({ badge: NO, title: `${fmtSan(mv.san)} não é o melhor`, text: P.tries === 1 ? 'Procure outra ideia. Lembre: xeques, capturas e ameaças.' : 'Quase lá. Use a dica ou veja a solução.', links });
    beep('cap');
  }
  function hint() {
    if (P.done || P.locked) return; P.hintLv++; const T = themeInfo(P.pz.theme); const sq = P.pz.sol[P.step].slice(0, 2);
    if (P.hintLv === 1) $('#p-coach').innerHTML = coachHTML({ badge: INFO, title: 'Dica', text: P.mode === 'review' ? THEME.review.hint : T.hint, links: '<button class="linkbtn" data-act="hint">Mostrar a peça</button>' });
    else { $('#p-coach').innerHTML = coachHTML({ badge: INFO, title: 'Dica', text: `Mexa a peça marcada em <b>${sq}</b>.`, links: '<button class="linkbtn" data-act="sol">👁 Ver solução</button>' }); }
    drawP();
  }
  function solSans() {
    const g = new Chess(P.pz.fen); const out = [];
    for (const u of P.pz.sol) { try { out.push(fmtSan(g.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }).san)); } catch (e) { break; } }
    return out;
  }
  function showSolution() {
    if (P.done || P.shown) return;
    P.shown = true; P.done = true; P.locked = true; const pz = P.pz;
    const sans = solSans(); const u = pz.sol[P.step];
    P.arrow = { from: u.slice(0, 2), to: u.slice(2, 4), kind: 'good' }; P.wrongMark = null;
    const p = prog(); if (!p.failed[pz.id]) { p.failed[pz.id] = 1; saveProg(p); }
    drawP(); P.arrow = null;
    const T = themeInfo(pz.theme);
    $('#p-coach').innerHTML = coachHTML({ badge: INFO, title: `Solução: ${P.mode === 'review' ? pz.bestSan : sans.slice(P.step).slice(0, 1)}`, text: `${whyBox(pz.why)}<div class="lesson"><b>${T.name}.</b> ${T.lesson}</div>`, extra: P.mode === 'review' ? '' : `Sequência: ${sans.join(' ')}`, links: '<button class="linkbtn" data-act="next">Próximo ›</button>' });
    $('#p-next').disabled = false; $('#p-sol').disabled = true; $('#p-hint').disabled = true;
  }
  function success(alt, mv) {
    P.done = true; P.locked = true; const pz = P.pz; const p = prog();
    if (P.mode === 'review') p.rev[pz.id] = { t: Date.now() }; else p.solved[pz.id] = { t: Date.now(), tries: P.tries, alt: !!alt };
    delete p.failed[pz.id]; if (P.title === 'Desafio do dia') p.dailyDone = today(); saveProg(p); touchStreak(); beep('end');
    const T = themeInfo(pz.theme); const sans = pz.sol ? solSans() : [];
    const extra = P.mode === 'review' ? '' : alt ? `O lance do motor era ${sans[P.step] || sans[0]}, mas o seu também funciona.` : sans.length > 1 ? `Sequência: ${sans.join(' ')}` : '';
    const err = pz.oppSan && T.err && P.mode !== 'review' && pz.kind !== 'defend' ? `<div class="lesson">👤 <b>Como o adversário errou:</b> ao jogar ${pz.oppSan}, ${T.err}</div>` : '';
    $('#p-coach').innerHTML = coachHTML({ badge: OK, title: alt ? 'Também funciona!' : `Resolvido! ${P.mode === 'review' ? '' : T.name}`, text: `${P.mode === 'review' ? whyBox(whyMove(pz.fen, pz.sol[0], 20, { best: pz.sol[0] })) : whyBox(pz.why)}<div class="lesson"><b>Lição:</b> ${T.lesson}</div>${err}`, extra, links: '<button class="linkbtn" data-act="next">Próximo ›</button>' });
    $('#p-next').disabled = false; $('#p-sol').disabled = true; $('#p-hint').disabled = true; $('#p-next').classList.add('pulse');
    setTimeout(() => { const n = $('#p-next'); if (n) n.classList.remove('pulse'); }, 1600);
  }
  function nextPuzzle() {
    const p = prog(); const n = P.list.length; const solved = (x) => (P.mode === 'review' ? p.rev[x.id] : p.solved[x.id]);
    for (let k = 1; k <= n; k++) { const i = (P.idx + k) % n; if (!solved(P.list[i]) && i !== P.idx) return loadPuzzle(i); }
    if (!solved(P.list[P.idx])) return loadPuzzle(P.idx);
    const lvl = P.pz.level; const all = P.list.length;
    openModal(`<h3 style="text-align:center">🎉 Tudo resolvido!</h3><p class="muted" style="text-align:center;margin:6px 0 14px">Você concluiu os ${all} desafios de “${P.title}”.</p><div style="display:flex;flex-direction:column;gap:8px">${P.mode === 'tactic' && lvl && lvl < 5 ? `<button class="btn primary" id="x-next">Ir para o nível ${lvl + 1}</button>` : ''}<button class="btn" id="x-menu">Voltar ao menu</button></div>`);
    const nx = $('#x-next'); if (nx) nx.onclick = () => { closeModal(); startPuzzles(levelList(lvl + 1), 'Nível ' + (lvl + 1), 'tactic'); };
    $('#x-menu').onclick = () => { closeModal(); (P.backTo || menuTactics)(); };
  }

  /* ---------- desafio do dia ---------- */
  async function startDaily() {
    await load(); const pool = PZ.filter((p) => p.kind === 'tactic' && p.level >= 2 && p.level <= 4); if (!pool.length) return toast('Ainda não há desafios.');
    let h = 0; for (const c of today()) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    startPuzzles([pool[h % pool.length]], 'Desafio do dia', 'tactic', { backTo: () => renderHome('home') });
  }

  /* ---------- revisar meus erros ---------- */
  function reviewItems() {
    const items = []; const p = prog();
    for (const rec of games().slice().reverse()) {
      if (!rec.analysis || !rec.analysis.evals) continue;
      try {
        const r = classify(rec.start, rec.ucis, rec.analysis.evals, rec.color);
        r.info.forEach((o, i) => {
          if (o.side !== rec.color || !(o.cls === 'mistake' || o.cls === 'blunder') || !o.bestSan) return;
          const ev = rec.analysis.evals[i]; if (!ev || !ev.best) return;
          items.push({ id: rec.id + ':' + i, kind: 'review', fen: r.fens[i], side: rec.color, sol: [ev.best], cp: ev.cp, san: fmtSan(o.san), clsLabel: o.cls === 'blunder' ? 'uma capivarada' : 'um erro', bestSan: o.bestSan, theme: 'review', why: o.why || [], level: 0, sev: o.loss });
        });
      } catch (e) {}
    }
    return items.slice(0, 80);
  }
  function startReview() {
    const items = reviewItems();
    if (!items.length) return openModal(`<h3>Revisar meus erros</h3><p class="muted" style="margin:8px 0 14px;line-height:1.45">Ainda não há erros para revisar. Jogue uma partida e toque em <b>Analisar</b> na tela inicial: os seus erros e capivaradas viram desafios aqui.</p><button class="btn primary" id="x-ok" style="width:100%">Ok</button>`) || ($('#x-ok').onclick = closeModal);
    startPuzzles(items, 'Meus erros', 'review', { backTo: () => renderHome('train') });
  }

  /* =====================================================
     ENXERGAR O TABULEIRO
     ===================================================== */
  function menuVis() {
    show('train'); const b = prog().vis;
    V.innerHTML = `<div class="screen trm"><div class="hdr"><button class="ibtn" id="m-back">←</button><h2>Enxergar o tabuleiro</h2><span style="width:40px"></span></div>
      <div class="trbody"><p class="muted" style="font-size:14px;line-height:1.45;margin:2px 2px 12px">Quem enxerga o tabuleiro rápido erra menos contra humanos. Treinos curtos, de 30 segundos ou 8 posições.</p>
      <button class="lvrow" data-v="coord"><div class="stars" style="font-size:26px">📍</div><div class="g"><b>Achar a casa</b><small>Toque na casa pedida (ex.: “f6”) em 30 segundos</small></div><div class="n">${b.coord || 0}</div></button>
      <button class="lvrow" data-v="color"><div class="stars" style="font-size:26px">🎨</div><div class="g"><b>Cor da casa</b><small>“c4 é clara ou escura?” em 30 segundos</small></div><div class="n">${b.color || 0}</div></button>
      <button class="lvrow" data-v="hang"><div class="stars" style="font-size:26px">🎯</div><div class="g"><b>Peças soltas</b><small>Toque nas peças que podem ser capturadas de graça</small></div><div class="n">${b.hang || 0}/8</div></button>
      <div class="muted" style="text-align:center;font-size:12px;margin-top:10px">O número à direita é o seu recorde.</div></div></div>`;
    $('#m-back').onclick = () => renderHome('train');
    V.querySelectorAll('[data-v]').forEach((e) => (e.onclick = () => ({ coord: runCoord, color: runColor, hang: runHang }[e.dataset.v]())));
  }
  const FILES = 'abcdefgh';
  const rndSq = () => FILES[Math.floor(Math.random() * 8)] + (1 + Math.floor(Math.random() * 8));
  const isLight = (sq) => (FILES.indexOf(sq[0]) + +sq[1]) % 2 === 1;
  let VT = null;
  function endTimed(kind, score) {
    clearInterval(VT); const p = prog(); const best = p.vis[kind] || 0; const nb = score > best; if (nb) { p.vis[kind] = score; saveProg(p); } touchStreak();
    openModal(`<h3 style="text-align:center">${nb ? '🏆 Novo recorde!' : 'Tempo!'}</h3><p style="text-align:center;font-size:38px;font-weight:800;margin:8px 0">${score}</p><p class="muted" style="text-align:center;margin-bottom:14px">${nb ? 'Você superou seu recorde.' : 'Recorde: ' + best}</p><div style="display:flex;flex-direction:column;gap:8px"><button class="btn primary" id="x-again">Jogar de novo</button><button class="btn" id="x-menu">Voltar</button></div>`);
    $('#x-again').onclick = () => { closeModal(); (kind === 'coord' ? runCoord : runColor)(); };
    $('#x-menu').onclick = () => { closeModal(); menuVis(); };
  }
  function runCoord() {
    show('train'); let score = 0, penalty = 0, target = rndSq(), orient = Math.random() < 0.5 ? 'w' : 'b', over = false;
    V.innerHTML = `<div class="screen vz"><div class="hdr"><button class="ibtn" id="v-back">←</button><h2>Achar a casa</h2><b id="v-score" style="width:40px;text-align:right">0</b></div>
      <div class="timebar"><i id="v-time"></i></div>
      <div class="vprompt"><small>Toque na casa</small><div id="v-target">${target}</div></div><div class="boardwrap"><div id="v-board"></div></div><div class="vfoot muted">${orient === 'w' ? 'Visto das brancas' : 'Visto das pretas'}</div></div>`;
    const bd = new Board($('#v-board'), { canSelect: () => false, onTap: tap, onMove: () => {} });
    const draw = (marks) => bd.set({ fen: '8/8/8/8/8/8/8/8 w - - 0 1', orientation: orient, noCoords: true, marks });
    draw(null);
    function tap(sq) {
      if (over) return;
      if (sq === target) { score++; beep('move'); target = rndSq(); $('#v-target').textContent = target; draw({ [sq]: 'good' }); setTimeout(() => !over && draw(null), 160); }
      else { beep('cap'); draw({ [sq]: 'bad', [target]: 'miss' }); setTimeout(() => !over && draw(null), 450); penalty++; }
      $('#v-score').textContent = score;
    }
    const t0 = Date.now(); clearInterval(VT);
    VT = setInterval(() => { const rem = 30 - penalty - (Date.now() - t0) / 1000; const bar = $('#v-time'); if (bar) bar.style.width = (Math.max(0, rem) / 30) * 100 + '%'; if (rem <= 0 && !over) { over = true; endTimed('coord', score); } }, 100);
    $('#v-back').onclick = () => { over = true; clearInterval(VT); menuVis(); };
  }
  function runColor() {
    show('train'); let score = 0, target = rndSq(), over = false; const t0 = Date.now();
    V.innerHTML = `<div class="screen vz"><div class="hdr"><button class="ibtn" id="v-back">←</button><h2>Cor da casa</h2><b id="v-score" style="width:40px;text-align:right">0</b></div>
      <div class="timebar"><i id="v-time"></i></div>
      <div class="vprompt big"><small>Essa casa é…</small><div id="v-target">${target}</div></div>
      <div class="vbtns"><button id="v-l" class="lt">Clara</button><button id="v-d" class="dk">Escura</button></div></div>`;
    const ans = (light) => { if (over) return; if (light === isLight(target)) { score++; beep('move'); } else { beep('cap'); const e = $('#v-target'); e.classList.add('bad'); setTimeout(() => e.classList.remove('bad'), 300); } target = rndSq(); $('#v-target').textContent = target; $('#v-score').textContent = score; };
    $('#v-l').onclick = () => ans(true); $('#v-d').onclick = () => ans(false);
    clearInterval(VT);
    VT = setInterval(() => { const rem = 30 - (Date.now() - t0) / 1000; const bar = $('#v-time'); if (bar) bar.style.width = (Math.max(0, rem) / 30) * 100 + '%'; if (rem <= 0 && !over) { over = true; endTimed('color', score); } }, 100);
    $('#v-back').onclick = () => { over = true; clearInterval(VT); menuVis(); };
  }
  // peças soltas: atacadas e sem defesa, ou atacadas por peça de menor valor
  function hangingOf(g, color) {
    const o = color === 'w' ? 'b' : 'w'; const out = [];
    for (const row of g.board()) for (const x of row) {
      if (!x || x.color !== color || x.type === 'k') continue;
      const att = g.attackers(x.square, o); if (!att.length) continue;
      const def = g.attackers(x.square, color).length; const minA = Math.min(...att.map((s) => VAL[g.get(s).type]));
      if (!def || minA < VAL[x.type]) out.push({ sq: x.square, type: x.type, def: !!def, minA, by: att.map((s) => g.get(s).type) });
    }
    return out;
  }
  async function runHang() {
    await load(); show('train');
    const pool = [];
    for (const p of PZ) { if (p.fen) pool.push(p.fen); if (p.pre) pool.push(p.pre); }
    let round = 0, score = 0, cur = null, picked = new Set(), checked = false; const N = 8;
    V.innerHTML = `<div class="screen pz"><div class="hdr"><button class="ibtn" id="v-back">←</button><h2 id="v-title">Peças soltas</h2><span style="width:40px"></span></div>
      <div class="pinfo" id="v-info"></div><div id="v-coach" style="display:flex;flex-direction:column;flex:1 1 auto;min-height:0"></div>
      <div class="boardwrap"><div id="v-board"></div></div>
      <div class="dock"><div class="tb4 two"><button class="t" id="v-none"><span>🚫</span>Nenhuma</button><button class="next" id="v-ok">Conferir</button></div></div></div>`;
    const bd = new Board($('#v-board'), { canSelect: () => false, onMove: () => {}, onTap: tap });
    function nextRound() {
      if (round >= N) return finish();
      let fen, color, hang;
      for (let k = 0; k < 40; k++) {
        fen = pool[Math.floor(Math.random() * pool.length)]; const g = new Chess(fen); color = Math.random() < 0.5 ? 'w' : 'b'; hang = hangingOf(g, color);
        const want = Math.random() < 0.85; if ((hang.length > 0) === want && hang.length <= 3) break;
      }
      round++; cur = { fen, color, hang }; picked = new Set(); checked = false; draw();
      $('#v-title').textContent = `Peças soltas · ${round}/${N}`;
      $('#v-info').innerHTML = `<span>🎯 ${score} acertos</span><b>Peças ${color === 'w' ? 'brancas' : 'pretas'}</b><span></span>`;
      $('#v-coach').innerHTML = coachHTML({ title: `Quais peças ${color === 'w' ? 'brancas' : 'pretas'} estão soltas?`, text: 'Toque nas peças que o adversário pode capturar ganhando material (sem proteção ou para uma peça menor). Se nenhuma estiver solta, toque em “Nenhuma”.' });
      $('#v-ok').textContent = 'Conferir'; $('#v-ok').disabled = false; $('#v-none').disabled = false;
    }
    function draw(marksExtra) {
      const marks = {}; picked.forEach((s) => (marks[s] = 'pick')); Object.assign(marks, marksExtra || {});
      bd.set({ fen: cur.fen, orientation: cur.color, noCoords: false, marks });
    }
    function tap(sq) { if (checked || !cur) return; const g = new Chess(cur.fen); const p = g.get(sq); if (!p || p.color !== cur.color || p.type === 'k') return; if (picked.has(sq)) picked.delete(sq); else picked.add(sq); draw(); }
    function check() {
      if (checked) { return nextRound(); }
      checked = true; const real = new Set(cur.hang.map((h) => h.sq)); const marks = {}; let good = true;
      picked.forEach((s) => { marks[s] = real.has(s) ? 'good' : 'bad'; if (!real.has(s)) good = false; });
      real.forEach((s) => { if (!picked.has(s)) { marks[s] = 'miss'; good = false; } });
      if (good) { score++; beep('end'); } else beep('cap');
      draw(marks);
      const why = cur.hang.map((h) => `${cap(PN[h.type])} em <b>${h.sq}</b>: ${h.def ? `atacado por ${PN[Object.keys(VAL).find((k) => VAL[k] === h.minA && h.by.includes(k)) || h.by[0]]}, que vale menos` : 'atacado e sem proteção'}.`).join('<br>');
      $('#v-coach').innerHTML = coachHTML({ badge: good ? OK : NO, title: good ? 'Isso mesmo!' : 'Quase!', text: cur.hang.length ? why : 'Nenhuma peça está solta nesta posição.', extra: good ? '' : 'Verde = certo · vermelho = errado · laranja = você não viu' });
      $('#v-info').innerHTML = `<span>🎯 ${score} acertos</span><b>Peças ${cur.color === 'w' ? 'brancas' : 'pretas'}</b><span></span>`;
      $('#v-ok').textContent = round >= N ? 'Ver resultado' : 'Próxima'; $('#v-none').disabled = true;
    }
    function finish() {
      const p = prog(); const best = p.vis.hang || 0; const nb = score > best; if (nb) { p.vis.hang = score; saveProg(p); } touchStreak();
      openModal(`<h3 style="text-align:center">${nb ? '🏆 Novo recorde!' : 'Fim da rodada'}</h3><p style="text-align:center;font-size:38px;font-weight:800;margin:8px 0">${score}/${N}</p><p class="muted" style="text-align:center;margin-bottom:14px">${score >= 7 ? 'Excelente! Você enxerga bem as peças soltas.' : 'Antes de cada lance, pergunte: “quais peças estão soltas, minhas e dele?”.'}</p><div style="display:flex;flex-direction:column;gap:8px"><button class="btn primary" id="x-again">Outra rodada</button><button class="btn" id="x-menu">Voltar</button></div>`);
      $('#x-again').onclick = () => { closeModal(); runHang(); }; $('#x-menu').onclick = () => { closeModal(); menuVis(); };
    }
    $('#v-ok').onclick = check;
    $('#v-none').onclick = () => { if (checked) return; picked = new Set(); check(); };
    $('#v-back').onclick = () => menuVis();
    nextRound();
  }

  return { menuTactics, menuVis, startReview, startDaily, streak: streakNow, totals, dailyDone, reviewCount, progress: prog, ready: load };
}
