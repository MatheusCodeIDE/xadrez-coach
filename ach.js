// Conquistas e níveis (tudo calculado a partir dos dados locais)
export function initAch(C) {
  const { weeks, store, games, TR, EG, OPN, accOf, myRating, toast, Chess, blitzBest } = C;
  const mateCache = new Map();
  const wonByMate = (g) => {
    if (mateCache.has(g.id)) return mateCache.get(g.id);
    let r = false;
    try {
      const won = (g.result === '1-0') === (g.color === 'w') && g.result !== '1/2-1/2';
      if (won) { const c = g.start ? new Chess(g.start) : new Chess(); for (const u of g.ucis) c.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }); r = c.isCheckmate(); }
    } catch (e) {}
    mateCache.set(g.id, r); return r;
  };
  const S = () => {
    const gs = games(); const pg = TR.progress(); const ts = TR.totals();
    const wins = gs.filter((g) => g.result !== '1/2-1/2' && (g.result === '1-0') === (g.color === 'w')).length;
    const accs = gs.map(accOf).filter((v) => v !== null);
    return {
      n: gs.length, wins, mates: gs.filter(wonByMate).length, bestAcc: accs.length ? Math.max(...accs) : 0, analyzed: accs.length,
      solved: ts.solved, revd: Object.keys(pg.rev || {}).length, streak: Math.max(pg.streak.best || 0, pg.streak.cur || 0),
      hang: (pg.vis && pg.vis.hang) || 0, endg: EG.count(), endgAll: EG.total, opn: OPN.mastered(), rating: myRating(), blitz: blitzBest(), weeks: weeks(),
    };
  };
  const LIST = [
    ['first_game', '♟', 'Primeira partida', 'Jogue sua primeira partida.', (s) => s.n >= 1],
    ['games10', '🎲', 'Veterano', 'Jogue 10 partidas.', (s) => s.n >= 10],
    ['games25', '🏟', 'Habitué', 'Jogue 25 partidas.', (s) => s.n >= 25],
    ['first_win', '🏆', 'Primeira vitória', 'Vença uma partida.', (s) => s.wins >= 1],
    ['wins10', '🥇', 'Dez vitórias', 'Vença 10 partidas.', (s) => s.wins >= 10],
    ['mate', '👑', 'Xeque-mate!', 'Vença dando xeque-mate.', (s) => s.mates >= 1],
    ['acc80', '🎯', 'Precisão 80%', 'Termine uma partida com 80% de precisão.', (s) => s.bestAcc >= 80],
    ['acc90', '💎', 'Precisão 90%', 'Termine uma partida com 90% de precisão.', (s) => s.bestAcc >= 90],
    ['an5', '🔍', 'Analista', 'Analise 5 partidas.', (s) => s.analyzed >= 5],
    ['streak3', '🔥', '3 dias seguidos', 'Sequência de 3 dias.', (s) => s.streak >= 3],
    ['streak7', '🔥', 'Semana de fogo', 'Sequência de 7 dias.', (s) => s.streak >= 7],
    ['streak30', '☄️', 'Mês imparável', 'Sequência de 30 dias.', (s) => s.streak >= 30],
    ['puz10', '🧩', '10 problemas', 'Resolva 10 problemas.', (s) => s.solved >= 10],
    ['puz50', '🧠', '50 problemas', 'Resolva 50 problemas.', (s) => s.solved >= 50],
    ['puz150', '🦉', '150 problemas', 'Resolva 150 problemas.', (s) => s.solved >= 150],
    ['rev5', '🔁', 'Aprendendo com erros', 'Revise 5 dos seus erros.', (s) => s.revd >= 5],
    ['hang8', '👁', 'Olho de águia', 'Ache as 8 peças soltas.', (s) => s.hang >= 8],
    ['endg1', '♚', 'Finalista', 'Conclua uma lição de finais.', (s) => s.endg >= 1],
    ['endgall', '🎓', 'Mestre dos finais', 'Conclua todas as lições de finais.', (s) => s.endg >= s.endgAll && s.endgAll > 0],
    ['opn1', '📖', 'Livro aberto', 'Domine 1 linha de abertura.', (s) => s.opn >= 1],
    ['opn5', '📚', 'Bibliotecário', 'Domine 5 linhas de abertura.', (s) => s.opn >= 5],
    ['blitz10', '⚡', 'Relâmpago', 'Faça 10 pontos no treino relâmpago.', (s) => s.blitz >= 10],
    ['week1', '📅', 'Semana cumprida', 'Cumpra a meta da semana (5 partidas e 20 problemas).', (s) => s.weeks >= 1],
    ['week4', '🗓', 'Mês de disciplina', 'Cumpra a meta da semana 4 vezes.', (s) => s.weeks >= 4],
    ['r1000', '📈', 'Rating 1000', 'Chegue a 1000 de rating estimado.', (s) => s.rating >= 1000],
    ['r1200', '🚀', 'Rating 1200', 'Chegue a 1200 de rating estimado.', (s) => s.rating >= 1200],
  ];
  const TITLES = ['Peão', 'Peão', 'Cavalo', 'Cavalo', 'Bispo', 'Bispo', 'Torre', 'Torre', 'Dama', 'Dama', 'Rei'];
  const xpOf = (s) => s.n * 10 + s.wins * 20 + s.analyzed * 10 + s.solved * 5 + s.revd * 5 + s.endg * 25 + s.opn * 25 + s.streak * 5 + s.blitz * 3;
  function level() {
    const s = S(); const xp = xpOf(s); const lvl = Math.floor(Math.sqrt(xp / 40)) + 1;
    const lo = 40 * (lvl - 1) ** 2, hi = 40 * lvl ** 2;
    return { lvl, xp, lo, hi, pct: Math.round(((xp - lo) / (hi - lo)) * 100), title: TITLES[Math.min(lvl, TITLES.length) - 1] };
  }
  const saved = () => store.get('xq.ach', {});
  function status() { const s = S(); const sv = saved(); return LIST.map(([id, ic, name, desc, f]) => ({ id, ic, name, desc, ok: f(s) || !!sv[id], at: sv[id] })); }
  // chamado ao montar a home: avisa conquistas novas
  function check() {
    try {
      const sv = saved(); const s = S(); const novas = [];
      for (const [id, ic, name, , f] of LIST) if (!sv[id] && f(s)) { sv[id] = Date.now(); novas.push(`${ic} ${name}`); }
      if (novas.length) { store.set('xq.ach', sv); toast('🏅 Conquista: ' + novas.join(' · '), 4200); }
      return novas;
    } catch (e) { return []; }
  }
  return { level, status, check, total: LIST.length };
}
