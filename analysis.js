// Análise pós-partida: classifica lances, calcula precisão e explica os erros em português
import { Chess } from './lib/chess.js';
import { toCp } from './engine.js';

export const CLS = {
  brilliant:   { label: 'Brilhante',  color: '#1baca6', sym: '!!' },
  book:        { label: 'Teoria',     color: '#a88865', sym: '📖' },
  best:        { label: 'Melhor',     color: '#81b64c', sym: '★' },
  great:       { label: 'Ótimo',      color: '#5c8bb0', sym: '!' },
  excellent:   { label: 'Excelente',  color: '#96bc4b', sym: '👍' },
  good:        { label: 'Bom',        color: '#97a36b', sym: '✓' },
  inaccuracy:  { label: 'Imprecisão', color: '#f7c631', sym: '?!' },
  mistake:     { label: 'Erro',       color: '#e58f2a', sym: '?' },
  blunder:     { label: 'Capivarada', color: '#ca3431', sym: '??' },
};
export const BAD = ['inaccuracy', 'mistake', 'blunder'];

export const winPct = (cp) => 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
const moveAcc = (loss) => Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * loss) - 3.1669));

const MATV = { p: 1, n: 3, b: 3, r: 5, q: 9 };
const matFor = (g, c) => { let t = 0; for (const row of g.board()) for (const x of row) if (x && x.type !== 'k') t += (x.color === c ? 1 : -1) * MATV[x.type]; return t; };
// Sacrifício: perde ≥3 de material no 1º par de lances da linha do motor e continua ≥2 abaixo no fim dela
function isSacrifice(fen, pv, color) {
  if (!pv || pv.length < 2) return false;
  try {
    const g = new Chess(fen); const base = matFor(g, color);
    const n = pv.length >= 6 ? 6 : pv.length - (pv.length % 2); let m2 = null;
    for (let k = 0; k < n; k++) { const u = pv[k]; g.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }); if (k === 1) m2 = matFor(g, color); }
    return m2 !== null && base - m2 >= 3 && base - matFor(g, color) >= 2;
  } catch (e) { return false; }
}

const VAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const PT = { p: 'o peão', n: 'o cavalo', b: 'o bispo', r: 'a torre', q: 'a dama', k: 'o rei' };
const PT_FEM = { p: false, n: false, b: false, r: true, q: true, k: false };

// Notação em português (T, C, B, D, R) apenas para exibição
export function fmtSan(san, pt = true) {
  if (!san || !pt) return san || '';
  return san.replace(/^[KQRBN]/, (c) => ({ K: 'R', Q: 'D', R: 'T', B: 'B', N: 'C' }[c])).replace(/=([QRBN])/, (m, c) => '=' + { Q: 'D', R: 'T', B: 'B', N: 'C' }[c]);
}

// ---------- Teoria de aberturas (sequências em UCI) ----------
const OPENINGS = [
  ['Italiana (Giuoco Piano)', 'e2e4 e7e5 g1f3 b8c6 f1c4 f8c5 c2c3 g8f6 d2d4 e5d4 c3d4 c5b4'],
  ['Gambito Evans', 'e2e4 e7e5 g1f3 b8c6 f1c4 f8c5 b2b4 c5b4 c2c3 b4a5 d2d4 e5d4 e1g1'],
  ['Defesa dos Dois Cavalos', 'e2e4 e7e5 g1f3 b8c6 f1c4 g8f6 f3g5 d7d5 e4d5 c6a5'],
  ['Ruy Lopez', 'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f8e7 f1e1 b7b5 a4b3 d7d6 c2c3 e8g8'],
  ['Ruy Lopez (Berlim)', 'e2e4 e7e5 g1f3 b8c6 f1b5 g8f6 e1g1 f6e4 d2d4 e4d6 b5c6 d7c6 d4e5 d6f5 d1d8 e8d8'],
  ['Abertura Escocesa', 'e2e4 e7e5 g1f3 b8c6 d2d4 e5d4 f3d4 g8f6 d4c6 b7c6 e4e5'],
  ['Defesa Petrov', 'e2e4 e7e5 g1f3 g8f6 f3e5 d7d6 e5f3 f6e4 d2d4 d6d5 f1d3 f8e7'],
  ['Defesa Philidor', 'e2e4 e7e5 g1f3 d7d6 d2d4 g8f6 b1c3 b8d7 f1c4 f8e7'],
  ['Quatro Cavalos', 'e2e4 e7e5 g1f3 b8c6 b1c3 g8f6 f1b5 f8b4 e1g1 e8g8 d2d3 d7d6'],
  ['Gambito do Rei', 'e2e4 e7e5 f2f4 e5f4 g1f3 g7g5 h2h4 g5g4 f3e5'],
  ['Abertura Vienense', 'e2e4 e7e5 b1c3 g8f6 f2f4 d7d5 f4e5 f6e4 g1f3 f8e7'],
  ['Abertura do Bispo', 'e2e4 e7e5 f1c4 g8f6 d2d3 c7c6 g1f3 d7d5 c4b3'],
  ['Siciliana Najdorf', 'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 a7a6 c1e3 e7e5'],
  ['Siciliana Dragão', 'e2e4 c7c5 g1f3 d7d6 d2d4 c5d4 f3d4 g8f6 b1c3 g7g6 c1e3 f8g7'],
  ['Siciliana Scheveningen', 'e2e4 c7c5 g1f3 e7e6 d2d4 c5d4 f3d4 g8f6 b1c3 d7d6'],
  ['Siciliana Fechada', 'e2e4 c7c5 b1c3 b8c6 g2g3 g7g6 f1g2 f8g7'],
  ['Siciliana Alapin', 'e2e4 c7c5 c2c3 d7d5 e4d5 d8d5 d2d4 g8f6'],
  ['Defesa Francesa', 'e2e4 e7e6 d2d4 d7d5 b1c3 g8f6 c1g5 f8e7 e4e5 f6d7 g5e7 d8e7'],
  ['Francesa (Avanço)', 'e2e4 e7e6 d2d4 d7d5 e4e5 c7c5 c2c3 b8c6 g1f3 d8b6'],
  ['Francesa (Troca)', 'e2e4 e7e6 d2d4 d7d5 e4d5 e6d5 g1f3 g8f6 f1d3 f8d6'],
  ['Defesa Caro-Kann', 'e2e4 c7c6 d2d4 d7d5 b1c3 d5e4 c3e4 c8f5 e4g3 f5g6 h2h4 h7h6'],
  ['Caro-Kann (Avanço)', 'e2e4 c7c6 d2d4 d7d5 e4e5 c8f5 g1f3 e7e6 f1e2 c6c5'],
  ['Defesa Escandinava', 'e2e4 d7d5 e4d5 d8d5 b1c3 d5a5 d2d4 g8f6 g1f3 c7c6'],
  ['Defesa Pirc', 'e2e4 d7d6 d2d4 g8f6 b1c3 g7g6 g1f3 f8g7'],
  ['Defesa Moderna', 'e2e4 g7g6 d2d4 f8g7 b1c3 d7d6'],
  ['Defesa Alekhine', 'e2e4 g8f6 e4e5 f6d5 d2d4 d7d6 g1f3 c8g4'],
  ['Gambito da Dama Recusado', 'd2d4 d7d5 c2c4 e7e6 b1c3 g8f6 c1g5 f8e7 e2e3 e8g8 g1f3 b8d7'],
  ['Gambito da Dama Aceito', 'd2d4 d7d5 c2c4 d5c4 g1f3 g8f6 e2e3 e7e6 f1c4 c7c5'],
  ['Defesa Eslava', 'd2d4 d7d5 c2c4 c7c6 g1f3 g8f6 b1c3 d5c4 a2a4 c8f5'],
  ['Defesa Índia do Rei', 'd2d4 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4 d7d6 g1f3 e8g8 f1e2 e7e5'],
  ['Defesa Grünfeld', 'd2d4 g8f6 c2c4 g7g6 b1c3 d7d5 c4d5 f6d5 e2e4 d5c3 b2c3 f8g7'],
  ['Defesa Nimzo-Índia', 'd2d4 g8f6 c2c4 e7e6 b1c3 f8b4 e2e3 e8g8 f1d3 d7d5 g1f3 c7c5'],
  ['Índia da Dama', 'd2d4 g8f6 c2c4 e7e6 g1f3 b7b6 g2g3 c8b7 f1g2 f8e7 e1g1 e8g8'],
  ['Abertura Catalã', 'd2d4 g8f6 c2c4 e7e6 g2g3 d7d5 f1g2 f8e7 g1f3 e8g8 e1g1 d5c4'],
  ['Sistema Londres', 'd2d4 d7d5 g1f3 g8f6 c1f4 e7e6 e2e3 c7c5 c2c3 b8c6 b1d2 f8d6 f4g3'],
  ['Sistema Londres', 'd2d4 d7d5 c1f4 g8f6 e2e3 c7c5 c2c3 b8c6 g1f3 e7e6'],
  ['Defesa Holandesa', 'd2d4 f7f5 g2g3 g8f6 f1g2 g7g6 g1f3 f8g7 e1g1 e8g8'],
  ['Abertura Inglesa', 'c2c4 e7e5 b1c3 g8f6 g1f3 b8c6 g2g3 d7d5 c4d5 f6d5 f1g2 d5b6'],
  ['Inglesa Simétrica', 'c2c4 c7c5 g1f3 g8f6 b1c3 b8c6 g2g3 g7g6 f1g2 f8g7'],
  ['Abertura Réti', 'g1f3 d7d5 c2c4 e7e6 g2g3 g8f6 f1g2 f8e7 e1g1 e8g8 b2b3'],
  ['Abertura Réti', 'g1f3 g8f6 c2c4 g7g6 b1c3 f8g7 e2e4 d7d6'],
  ['Abertura Larsen', 'b2b3 e7e5 c1b2 b8c6 e2e3 d7d5'],
];

export function openingInfo(ucis) {
  const b = bookStatus(ucis);
  return { name: b.name, depth: b.depth };
}

// ---------- Reprodução da partida ----------
export function replay(startFen, ucis) {
  const g = startFen ? new Chess(startFen) : new Chess();
  const fens = [g.fen()];
  const moves = [];
  for (const u of ucis) {
    const m = g.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
    moves.push({ uci: u, san: m.san, from: m.from, to: m.to, piece: m.piece, color: m.color, captured: m.captured, flags: m.flags, promotion: m.promotion });
    fens.push(g.fen());
  }
  return { fens, moves };
}

function terminalEval(g) {
  if (g.isCheckmate()) return { cp: -10000, mate: 0, best: null, pv: [], second: null };
  return { cp: 0, best: null, pv: [], second: null };
}

// Avalia uma posição (multipv 2 para detectar "lances únicos")
export async function evalFen(engine, fen, depth = 12) {
  const g = new Chess(fen);
  if (g.isGameOver()) return terminalEval(g);
  const r = await engine.search(fen, { depth, multipv: 2 });
  const l0 = r.lines[0] || { cp: 0, pv: [r.best] };
  return { cp: toCp(l0), mate: l0.mate, best: r.best || l0.pv[0], pv: (l0.pv || []).slice(0, 6), second: r.lines[1] ? toCp(r.lines[1]) : null };
}

// Roda o motor em cada posição da partida
export async function analyzeGame(engine, startFen, ucis, { depth = 12, onProgress, shouldStop } = {}) {
  const { fens } = replay(startFen, ucis);
  const evals = [];
  for (let i = 0; i < fens.length; i++) {
    if (shouldStop && shouldStop()) throw new Error('abort');
    evals.push(await evalFen(engine, fens[i], depth));
    if (onProgress) onProgress(i + 1, fens.length);
  }
  return evals;
}

const phaseOf = (fen, ply) => {
  const board = fen.split(' ')[0];
  const pieces = (board.match(/[nbrqNBRQ]/g) || []).length;
  if (pieces <= 6) return 'final';
  if (ply < 20) return 'abertura';
  return 'meio';
};
const sqName = (s) => s;
const unit = (t) => PT[t];

function tryMove(fen, uci) {
  try {
    const g = new Chess(fen);
    const m = g.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
    return { g, m };
  } catch (e) { return null; }
}

function matBal(g, color) { let t = 0; for (const row of g.board()) for (const x of row) if (x && x.type !== 'k') t += (x.color === color ? 1 : -1) * VAL[x.type]; return t; }
// Gera a explicação textual (em português) para um lance ruim
function explain(i, fens, moves, evals, info, pt) {
  const fen = fens[i], afterFen = fens[i + 1];
  const mv = moves[i], eb = evals[i], ea = evals[i + 1];
  const reasons = []; const tags = [];
  const bestTry = eb.best ? tryMove(fen, eb.best) : null;
  const bestMv = bestTry && bestTry.m;
  const bestSan = bestMv ? fmtSan(bestMv.san, pt) : null;
  const mover = mv.color;
  const gAfter = new Chess(afterFen);
  const replyTry = ea.best ? tryMove(afterFen, ea.best) : null;
  const reply = replyTry && replyTry.m;

  if (ea.mate !== undefined && ea.mate > 0) {
    reasons.push(`Esse lance permite xeque-mate do adversário em ${ea.mate} ${ea.mate === 1 ? 'lance' : 'lances'}.`);
    tags.push('mate');
  } else if (eb.mate !== undefined && eb.mate > 0 && bestSan) {
    reasons.push(`Você tinha xeque-mate em ${eb.mate} ${eb.mate === 1 ? 'lance' : 'lances'} com ${bestSan}.`);
    tags.push('missedmate');
  }
  if (!reasons.length && reply && reply.captured) {
    const defenders = gAfter.attackers(reply.to, mover).length;
    const gain = VAL[reply.captured] - (defenders ? VAL[reply.piece] : 0);
    if (gain > 0 || (!defenders && VAL[reply.captured] >= 1)) {
      const fem = PT_FEM[reply.captured];
      const nm = unit(reply.captured);
      let ignored = false;
      try { ignored = reply.to !== mv.to && threatenedPieces(new Chess(fen), mover).some((p) => p.sq === reply.to); } catch (e) {}
      if (ignored) {
        reasons.push(`Você ignorou uma ameaça: ${nm} em ${reply.to} já estava atacad${fem ? 'a' : 'o'} e o adversário captura com ${fmtSan(reply.san, pt)}. Antes de mover, veja o que ele está ameaçando.`);
        tags.push('ignoredthreat');
      } else if (reply.to === mv.to) {
        reasons.push(`Sua peça em ${reply.to} ficou ${defenders ? 'mal protegida' : 'sem proteção'}: o adversário pode capturar com ${fmtSan(reply.san, pt)}.`);
      } else {
        reasons.push(`Esse lance deixou ${nm} em ${reply.to} ${defenders ? (fem ? 'mal protegida' : 'mal protegido') : (fem ? 'desprotegida' : 'desprotegido')}; o adversário captura com ${fmtSan(reply.san, pt)}.`);
      }
      if (!tags.includes('ignoredthreat')) tags.push('hanging');
    }
  }
  if (!reasons.length && reply && !reply.captured) {
    // garfo?
    try {
      const gg = new Chess(replyTry.g.fen());
      const parts = gg.fen().split(' ');
      parts[1] = reply.color; parts[3] = '-';
      const flipped = new Chess(parts.join(' '));
      const tg = flipped.moves({ square: reply.to, verbose: true }).filter((m) => m.captured && (VAL[m.captured] >= 3 || m.captured === 'k'));
      const uniq = new Set(tg.map((m) => m.to));
      if (uniq.size >= 2) {
        reasons.push(`O adversário responde com um garfo: ${unit(reply.piece)} em ${reply.to} ataca duas peças ao mesmo tempo.`);
        tags.push('fork');
      }
    } catch (e) {}
  }
  if (bestMv && bestMv.captured && !mv.captured && VAL[bestMv.captured] >= 1 && info.loss >= 10 && !reasons.length) {
    reasons.push(`Você deixou passar a chance de capturar ${unit(bestMv.captured)} em ${bestMv.to} com ${bestSan}.`);
    tags.push('missedcapture');
  }
  if (bestMv && /[+#]/.test(bestMv.san) && !reasons.length) {
    reasons.push(`Havia um xeque forte disponível: ${bestSan}.`);
    tags.push('missedcheck');
  }
  if (bestMv && /[kq]/.test(bestMv.flags) && !reasons.length) {
    reasons.push(`Era hora de rocar (${bestSan}) e colocar o rei em segurança.`);
    tags.push('king');
  }
  if (!reasons.length && mv.captured && reply && reply.captured && reply.to === mv.to && VAL[reply.captured] > VAL[mv.captured] + 0) {
    reasons.push(`Você capturou ${unit(mv.captured)}, mas o adversário recaptura ${unit(reply.captured)}: uma troca desfavorável. Conte os valores antes de trocar.`);
    tags.push('badtrade');
  }
  if (!reasons.length && eb.pv && eb.pv.length >= 3 && info.loss >= 12) {
    try {
      const gp = new Chess(fen); const base = matBal(gp, mover);
      for (const u of eb.pv.slice(0, 4)) gp.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
      if (matBal(gp, mover) - base >= 2) {
        reasons.push(`Havia uma combinação que ganhava material: ${bestSan}${eb.pv.length > 1 ? ' e a sequência seguinte' : ''}. Antes de jogar, procure xeques, capturas e ameaças.`);
        tags.push('missedtactic');
      }
    } catch (e) {}
  }
  if (!reasons.length && info.ply < 16 && (mv.piece === 'n' || mv.piece === 'b') && moves.slice(0, i).some((x) => x.color === mover && x.to === mv.from && x.piece === mv.piece)) {
    reasons.push('Você moveu a mesma peça duas vezes na abertura enquanto outras ficaram paradas. Desenvolva uma peça nova a cada lance.');
    tags.push('twice');
  }
  if (!reasons.length && mv.piece === 'q' && info.ply < 12) {
    reasons.push('Mover a dama cedo na abertura costuma perder tempo: ela pode ser atacada e você atrasa o desenvolvimento das outras peças.');
    tags.push('earlyqueen');
  }
  if (!reasons.length && info.wb >= 75 && info.wa < 62) {
    reasons.push('Você estava com vantagem clara e esse lance a deixou escapar.');
    tags.push('thrownadv');
  }
  if (!reasons.length && info.wb >= 40 && info.wa < 30) {
    reasons.push('Depois desse lance, a posição passou a favorecer o adversário.');
    tags.push('worse');
  }
  if (!reasons.length && info.ply < 14 && mv.piece === 'p' && /^f[36]$/.test(mv.to) && mv.from[0] === 'f') {
    reasons.push('Mover o peão f cedo enfraquece a diagonal do seu rei e não ajuda a desenvolver nenhuma peça.');
    tags.push('openingpawn');
  }
  if (!reasons.length && info.ply < 14 && mv.piece === 'p' && bestMv && ['n', 'b'].includes(bestMv.piece)) {
    reasons.push('Esse lance de peão não desenvolve nenhuma peça. Na abertura, priorize cavalos e bispos.');
    tags.push('openingpawn');
  }
  if (!reasons.length) {
    let idea = '';
    try { if (eb.best) { const w = whyMove(fen, eb.best, info.ply, eb); if (w.length && !/Melhora a posição/.test(w[0])) idea = ' ' + w[0]; } } catch (e) {}
    reasons.push(bestSan ? `O melhor era ${bestSan}.${idea || ' Ele mantém a posição mais sólida.'}` : 'Havia uma continuação melhor.');
    tags.push('generic');
  }
  const pvSan = [];
  try {
    const g = new Chess(fen);
    for (const u of (eb.pv || []).slice(0, 4)) {
      const m = g.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
      pvSan.push(fmtSan(m.san, pt));
    }
  } catch (e) {}
  return { text: reasons[0], tags, bestSan, pvSan };
}

// ---------- Classificação ----------
export function judgeAt(i, fens, moves, evals, { ply = i, inBook = false, pt = true } = {}) {
  const mv = moves[i];
  const eb = evals[i], ea = evals[i + 1];
  const wb = winPct(eb.cp);
  const wa = winPct(-ea.cp);
  const isBest = mv.uci === eb.best;
  const loss = isBest ? 0 : Math.max(0, wb - wa);
  let cls;
  if (inBook && loss < 6) cls = 'book';
  else if (isBest) {
    cls = 'best';
    if (eb.second !== null && wb - winPct(eb.second) >= 15 && wb < 93) cls = 'great';
    if (wb < 85 && wa >= 40 && isSacrifice(fens[i], eb.pv, mv.color)) cls = 'brilliant';
  } else if (loss < 2) cls = 'excellent';
  else if (loss < 5) cls = 'good';
  else if (loss < 10) cls = 'inaccuracy';
  else if (loss < 20) cls = 'mistake';
  else cls = 'blunder';
  const o = { i: ply, ply, side: mv.color, uci: mv.uci, san: mv.san, cls, loss, wb, wa, acc: moveAcc(loss), phase: phaseOf(fens[i], ply), best: eb.best };
  if (BAD.includes(cls)) Object.assign(o, explain(i, fens, moves, evals, o, pt));
  else if (cls === 'brilliant') o.text = 'Um sacrifício brilhante! Você abriu mão de material em troca de uma posição muito melhor.';
  else if (cls === 'great') o.text = 'Era o único lance forte na posição. Muito bem!';
  else if (cls === 'best') o.text = 'Esse foi o melhor lance segundo o Stockfish.';
  else if (cls === 'book') o.text = 'Lance teórico de abertura.';
  else if (cls === 'excellent') o.text = 'Lance excelente, quase igual ao melhor.';
  else o.text = 'Lance sólido.';
  if (!isBest && eb.best) {
    const t = tryMove(fens[i], eb.best);
    if (t) { o.bestSan = fmtSan(t.m.san, pt); o.why = whyMove(fens[i], eb.best, ply, eb); }
  } else if (isBest) o.why = whyMove(fens[i], mv.uci, ply, eb);
  if (!o.pvSan) {
    const pvSan = [];
    try {
      const g = new Chess(fens[i]);
      for (const u of (eb.pv || []).slice(0, 4)) { const m = g.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }); pvSan.push(fmtSan(m.san, pt)); }
    } catch (e) {}
    o.pvSan = pvSan;
  }
  return o;
}

export function classify(startFen, ucis, evals, userColor, pt = true) {
  const { fens, moves } = replay(startFen, ucis);
  const standard = !startFen || startFen.split(' ')[0] === 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';
  const bs = standard ? bookStatus(ucis) : { depth: 0, nextUcis: [], name: null };
  const info = [];
  for (let i = 0; i < moves.length; i++) info.push(judgeAt(i, fens, moves, evals, { ply: i, inBook: i < bs.depth, pt }));
  if (standard && bs.depth >= 2 && bs.depth < ucis.length && bs.depth < 14 && bs.nextUcis.length) {
    const sans = bookSans(fens[bs.depth], bs.nextUcis, pt);
    info[bs.depth].offBook = { name: bs.name, sans };
  }
  return { fens, moves, info };
}

export function summarize(info, userColor, ucis = []) {
  const sides = { w: [], b: [] };
  info.forEach((o) => sides[o.side].push(o));
  const stat = (arr) => {
    const counts = {};
    Object.keys(CLS).forEach((k) => (counts[k] = 0));
    arr.forEach((o) => counts[o.cls]++);
    const acc = arr.length ? arr.reduce((s, o) => s + o.acc, 0) / arr.length : 0;
    return { counts, acc, n: arr.length };
  };
  const w = stat(sides.w), b = stat(sides.b);
  const me = userColor === 'w' ? w : b;
  const mine = sides[userColor];
  const tags = {};
  mine.forEach((o) => (o.tags || []).forEach((t) => (tags[t] = (tags[t] || 0) + 1)));
  const phaseLoss = {};
  ['abertura', 'meio', 'final'].forEach((p) => {
    const a = mine.filter((o) => o.phase === p);
    phaseLoss[p] = a.length ? { avg: a.reduce((s, o) => s + o.loss, 0) / a.length, n: a.length, bad: a.filter((o) => BAD.includes(o.cls) && o.cls !== 'inaccuracy').length } : null;
  });
  const tips = [];
  if (tags.mate || tags.missedmate) tips.push('Xeque-mate: antes de mover, sempre veja se o adversário tem xeques e se você tem algum xeque-mate possível.');
  if (tags.hanging >= 1) tips.push(`Você deixou peças penduradas ${tags.hanging}x. Antes de cada lance, pergunte: "o que meu adversário pode capturar depois disso?".`);
  if (tags.fork) tips.push('Cuidado com garfos: cavalos e peões atacam duas peças de uma vez. Veja onde o cavalo adversário pode pular.');
  if (tags.missedcapture) tips.push(`Você perdeu ${tags.missedcapture} captura(s) boa(s). Use a rotina: xeques, capturas, ameaças (nessa ordem), para os dois lados.`);
  if (tags.missedcheck) tips.push('Procure xeques forçados: muitas vezes eles ganham tempo ou material.');
  if (tags.king) tips.push('Roque cedo: um rei no centro vira alvo fácil.');
  if (tags.earlyqueen) tips.push('Na abertura, desenvolva cavalos e bispos antes de sair com a dama.');
  if (tags.thrownadv) tips.push('Quando estiver melhor, simplifique: troque peças, evite riscos e procure o caminho mais seguro.');
  let worst = null;
  for (const p of ['abertura', 'meio', 'final']) if (phaseLoss[p] && phaseLoss[p].n >= 3 && (!worst || phaseLoss[p].avg > phaseLoss[worst].avg)) worst = p;
  const phaseTip = {
    abertura: 'Seus maiores erros foram na abertura: controle o centro, desenvolva as peças menores e role cedo.',
    meio: 'Seus maiores erros foram no meio-jogo: antes de cada lance, olhe as ameaças do adversário e a segurança das suas peças.',
    final: 'Seus maiores erros foram no final: estude finais básicos (rei e peão, torres) e ative o rei.',
  };
  if (worst && phaseLoss[worst].avg > 4) tips.push(phaseTip[worst]);
  if (me.counts.blunder >= 3) tips.push('Várias capivaradas: jogue mais devagar e confira cada lance antes de soltar a peça.');
  if (!tips.length) tips.push('Boa partida! Continue jogando e revisando para manter a consistência.');
  const op = openingInfo(ucis);
  const off = info.find((o) => o.offBook && o.side === userColor);
  const opening = { name: op.name, desc: op.name ? openingDesc(op.name) : '', depth: op.depth, off: off ? { n: Math.floor(off.ply / 2) + 1, san: off.san, name: off.offBook.name, sans: off.offBook.sans } : null };
  const repertoire = userColor === 'w'
    ? 'Para começar de brancas: jogue e4 e, depois, Cf3 e Bc4 (Italiana), ou d4 com o Sistema Londres (Bf4). São fáceis de aprender e cheias de ideias úteis.'
    : 'Para começar de pretas: contra e4 responda e5; contra d4 responda d5. Desenvolva os cavalos, role cedo e só então pense em atacar.';
  return { w, b, me, tags, phaseLoss, opening, repertoire, tips: tips.slice(0, 4) };
}

// ---------- Teoria de abertura (continuações e descrições) ----------
const GENERIC = [
  ['e2e4 e7e5', 'Jogo Aberto (1.e4 e5)'],
  ['e2e4 c7c5', 'Siciliana'],
  ['e2e4 e7e6', 'Defesa Francesa'],
  ['e2e4 c7c6', 'Defesa Caro-Kann'],
  ['d2d4 d7d5', 'Jogo do Peão da Dama (1.d4 d5)'],
  ['d2d4 g8f6', 'Defesas Índias (1.d4 Cf6)'],
];
export function bookStatus(ucis) {
  const seq = ucis.slice(0, 20);
  let name = null, depth = 0;
  for (let n = 1; n <= seq.length; n++) {
    const pre = seq.slice(0, n).join(' ');
    const hits = OPENINGS.filter(([, l]) => (l + ' ').startsWith(pre + ' ') || l === pre);
    if (!hits.length) break;
    depth = n;
    const names = [...new Set(hits.map((h) => h[0]))];
    if (names.length === 1) name = names[0];
    else {
      const g = GENERIC.find(([k]) => (pre + ' ').startsWith(k + ' '));
      if (g) name = g[1]; else if (n >= 2) name = name; else name = null;
    }
  }
  const pre = seq.slice(0, depth);
  const nextUcis = [];
  for (const [, l] of OPENINGS) {
    const mv = l.split(' ');
    if (mv.length > depth && pre.every((u, k) => mv[k] === u) && !nextUcis.includes(mv[depth])) nextUcis.push(mv[depth]);
  }
  return { name, depth, nextUcis: nextUcis.slice(0, 4) };
}
export function bookSans(fen, ucis, pt = true) {
  const out = [];
  for (const u of ucis) {
    try { out.push(fmtSan(new Chess(fen).move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }).san, pt)); } catch (e) {}
  }
  return out;
}
const OP_DESC = [
  ['Jogo Aberto', 'Os dois lados ocupam o centro com e4 e e5. Jogo aberto e tático, ótimo para aprender os princípios: centro, desenvolvimento e rei seguro.'],
  ['Peão da Dama', 'Estrutura d4/d5: jogo mais posicional, com luta por casas centrais e planos de longo prazo.'],
  ['Defesas Índias', 'As pretas respondem d4 com Cf6 e controlam o centro com as peças, sem ocupá-lo com peões de imediato.'],
  ['Italiana', 'O bispo vai para c4 mirando o ponto fraco f7. Plano: rocar, jogar c3 e depois d4 para ocupar o centro.'],
  ['Evans', 'Sacrifica o peão b4 para ganhar tempo e centro contra o bispo adversário. Ataque rápido.'],
  ['Dois Cavalos', 'As pretas contra-atacam com Cf6 em vez de se defender. Posição aguda e cheia de táticas.'],
  ['Ruy Lopez', 'O bispo pressiona o cavalo que defende e5. Uma das aberturas mais estudadas, com planos de longo prazo.'],
  ['Escocesa', 'As brancas abrem o centro rápido com d4 e trocam peões para ganhar atividade.'],
  ['Petrov', 'Defesa simétrica e sólida: as pretas contra-atacam o peão e4 logo cedo.'],
  ['Philidor', 'As pretas defendem e5 com d6. Sólida, porém um pouco passiva.'],
  ['Quatro Cavalos', 'Desenvolvimento simétrico e natural, ótimo para entender os princípios básicos.'],
  ['Gambito do Rei', 'As brancas sacrificam o peão f4 em busca de ataque rápido. Divertida, mas arriscada.'],
  ['Vienense', 'As brancas desenvolvem o cavalo de b1 antes e preparam f4 com ataque.'],
  ['Bispo', 'Desenvolvimento rápido do bispo em c4, deixando o cavalo livre para escolher a melhor casa.'],
  ['Siciliana', 'Resposta agressiva ao e4: as pretas lutam pelo centro com o peão c e criam jogo desequilibrado.'],
  ['Francesa', 'Estrutura sólida das pretas (e6 + d5) com contra-ataque no flanco da dama. Cuidado com o bispo de c8, que fica preso.'],
  ['Caro-Kann', 'Muito sólida: c6 prepara d5 sem trancar o bispo de c8.'],
  ['Escandinava', 'Ataca o centro cedo com d5. A dama sai cedo, então cuidado para não perder tempo.'],
  ['Pirc', 'As pretas cedem o centro e depois o atacam com bispos e cavalos.'],
  ['Moderna', 'As pretas cedem o centro e depois o atacam com bispos e cavalos fianquetados.'],
  ['Alekhine', 'As pretas provocam o avanço dos peões brancos para depois atacá-los.'],
  ['Gambito da Dama', 'As brancas oferecem o peão c4 para dominar o centro. É um gambito falso: o peão é fácil de recuperar.'],
  ['Eslava', 'O peão c6 protege d5 sem trancar o bispo de c8. Sólida e confiável.'],
  ['Índia do Rei', 'As pretas deixam o centro para as brancas e depois o atacam, com o bispo em g7 muito forte.'],
  ['Grünfeld', 'As pretas permitem um grande centro e o atacam com pressão das peças.'],
  ['Nimzo', 'O bispo prende o cavalo de c3 para controlar a casa e4. Muito respeitada.'],
  ['Índia da Dama', 'O bispo vai para b7 e controla e4 de longe. Posicional e segura.'],
  ['Catalã', 'O bispo em g2 pressiona a ala da dama. Jogo posicional, de pequenas vantagens.'],
  ['Londres', 'Sistema simples: d4, Cf3, Bf4, e3, c3. Fácil de aprender e funciona contra quase tudo.'],
  ['Holandesa', 'O peão f5 controla e4. Agressiva, mas enfraquece o rei.'],
  ['Inglesa', 'Começa com c4 controlando d5. Flexível e posicional.'],
  ['Réti', 'Cf3 e c4: controla o centro com peças em vez de peões, deixando as pretas ocuparem o meio primeiro.'],
  ['Larsen', 'O bispo em b2 mira a grande diagonal. Fora do comum, mas sólida.'],
];
export function openingsList() {
  const out = [];
  for (const [name, line] of OPENINGS) {
    try {
      const g = new Chess(); const sans = [];
      for (const u of line.split(' ').slice(0, 8)) sans.push(fmtSan(g.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }).san));
      out.push({ name, moves: sans.map((s, i) => (i % 2 === 0 ? (i / 2 + 1) + '.' : '') + s).join(' '), desc: openingDesc(name) });
    } catch (e) {}
  }
  return out;
}
export function openingLines() {
  return OPENINGS.map(([name, line]) => ({ name, desc: openingDesc(name), ucis: line.split(' ') }));
}
export function openingDesc(name) {
  const h = OP_DESC.find(([k]) => name.includes(k));
  return h ? h[1] : 'Abertura de livro: siga os princípios — controle o centro, desenvolva peças e role cedo.';
}

// ---------- Por que esse lance é bom? ----------
const SQ_CENTER = ['d4', 'e4', 'd5', 'e5'];
function flipTurn(fen, color) {
  const p = fen.split(' '); p[1] = color; p[3] = '-';
  return new Chess(p.join(' '));
}
function threatenedPieces(g, color) {
  // peças de `color` atacadas por menor valor ou sem proteção
  const opp = color === 'w' ? 'b' : 'w';
  const res = [];
  for (const row of g.board()) for (const p of row) {
    if (!p || p.color !== color || p.type === 'k') continue;
    const att = g.attackers(p.square, opp);
    if (!att.length) continue;
    const def = g.attackers(p.square, color).length;
    const minAtt = Math.min(...att.map((s) => VAL[g.get(s).type] || 99));
    if (!def || minAtt < VAL[p.type]) res.push({ sq: p.square, type: p.type });
  }
  return res;
}
export function whyMove(fen, uci, ply = 0, ev = {}) {
  const out = [];
  let g, m;
  try { g = new Chess(fen); m = g.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }); } catch (e) { return out; }
  const me = m.color, opp = me === 'w' ? 'b' : 'w';
  if (g.isCheckmate()) return ['Dá xeque-mate e termina a partida!'];
  if (ev.mate !== undefined && ev.mate > 0 && ev.best === uci) out.push(`Leva a xeque-mate em ${ev.mate} ${ev.mate === 1 ? 'lance' : 'lances'}: o adversário não consegue escapar.`);
  if (m.promotion) out.push(`Promove o peão a ${PT[m.promotion].replace(/^o |^a /, '')}: uma peça muito mais forte.`);
  if (m.captured) {
    const defended = g.attackers(m.to, opp).length > 0;
    if (!defended) out.push(`Captura ${PT[m.captured]} em ${m.to} sem risco de ser recapturado.`);
    else if (VAL[m.captured] > VAL[m.piece]) out.push(`Captura ${PT[m.captured]}, que vale mais que a sua peça: uma troca favorável.`);
    else out.push(`Captura ${PT[m.captured]} em ${m.to} e simplifica a posição.`);
  }
  if (/[kq]/.test(m.flags)) out.push('Roca: coloca o rei em segurança e põe a torre em jogo.');
  // escapar de ameaça
  const before = new Chess(fen);
  if (!m.captured && m.piece !== 'k' && before.attackers(m.from, opp).length && VAL[m.piece] >= 3) {
    const att = before.attackers(m.from, opp).map((s) => VAL[before.get(s).type]);
    if (!before.attackers(m.from, me).length || Math.min(...att) < VAL[m.piece]) out.push(`Tira ${PT[m.piece]} de uma casa onde estava ameaçado.`);
  }
  // proteger peça ameaçada
  const was = threatenedPieces(before, me).filter((p) => p.sq !== m.from);
  if (was.length) {
    const now = threatenedPieces(g, me).map((p) => p.sq);
    const solved = was.filter((p) => !now.includes(p.sq));
    if (solved.length) out.push(`Protege ${PT[solved[0].type]} em ${solved[0].sq}, que estava ameaçado.`);
  }
  if (g.isCheck()) out.push('Dá xeque, obrigando o adversário a responder.');
  // ameaças criadas pela peça movida
  try {
    const f = flipTurn(g.fen(), me);
    const tg = f.moves({ square: m.to, verbose: true }).filter((x) => x.captured && x.captured !== 'k' && (VAL[x.captured] >= 3 || !f.attackers(x.to, opp).length || VAL[x.captured] > VAL[m.piece]));
    if (tg.length >= 2) out.push(`Ataca duas peças ao mesmo tempo (${PT[tg[0].captured]} e ${PT[tg[1].captured]}): um garfo.`);
    else if (tg.length === 1 && !m.captured) out.push(`Cria uma ameaça: ataca ${PT[tg[0].captured]} em ${tg[0].to}.`);
  } catch (e) {}
  // princípios de abertura
  const backRank = me === 'w' ? '1' : '8';
  if (ply < 20 && (m.piece === 'n' || m.piece === 'b') && m.from[1] === backRank) out.push(`Desenvolve ${PT[m.piece]}: tira da casa inicial e coloca em jogo, mirando o centro.`);
  if (ply < 16 && m.piece === 'p' && SQ_CENTER.includes(m.to)) out.push('Ocupa o centro com um peão, ganha espaço e abre caminho para o bispo e a dama.');
  if (ply < 16 && m.piece === 'p' && ['c4', 'c5', 'f4', 'f5'].includes(m.to) && !out.length) out.push('Disputa o controle do centro com um peão lateral.');
  if (phaseOf(fen, ply) === 'final' && m.piece === 'k') out.push('Ativa o rei: no final de jogo ele vira uma peça forte.');
  if (m.piece === 'r' && !m.captured && ply >= 16 && !out.length) out.push('Coloca a torre numa coluna mais ativa.');
  if (before.isCheck()) out.unshift('Responde ao xeque protegendo o rei.');
  if (!out.length) out.push('Melhora a posição das suas peças e mantém a vantagem.');
  return out.slice(0, 2);
}
