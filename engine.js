// Wrapper UCI para o Stockfish (WASM, thread única, roda 100% offline no aparelho)
export const SF_PATH = 'engine/stockfish-19-lite-single.js';

export const toCp = (l) => {
  if (!l) return 0;
  if (l.mate !== undefined) return l.mate > 0 ? 10000 - l.mate : -10000 - l.mate;
  return l.cp;
};

export class Engine {
  constructor(factory) {
    this.w = factory ? factory() : new Worker(SF_PATH);
    this.ls = new Set();
    this.chain = Promise.resolve();
    this.mpv = 1;
    this.w.onmessage = (e) => {
      const l = typeof e === 'string' ? e : e && e.data !== undefined ? e.data : null;
      if (typeof l !== 'string') return;
      for (const f of [...this.ls]) f(l);
    };
    this.ready = this._init();
  }
  send(c) { this.w.postMessage(c); }
  _wait(pred) {
    return new Promise((res) => {
      const f = (l) => { if (pred(l)) { this.ls.delete(f); res(l); } };
      this.ls.add(f);
    });
  }
  _queue(fn) {
    const p = this.chain.then(fn);
    this.chain = p.catch(() => {});
    return p;
  }
  async _init() {
    this.send('uci');
    await this._wait((l) => l === 'uciok');
    this.send('setoption name Hash value 16');
    this.send('setoption name Threads value 1');
    this.send('isready');
    await this._wait((l) => l === 'readyok');
  }
  setOptions(opts) {
    return this._queue(async () => {
      await this.ready;
      for (const k in opts) this.send(`setoption name ${k} value ${opts[k]}`);
      this.send('isready');
      await this._wait((l) => l === 'readyok');
    });
  }
  stop() { this.send('stop'); }
  // Busca uma posição. Placar sempre do ponto de vista de quem joga.
  search(fen, { depth, movetime, multipv = 1 } = {}) {
    return this._queue(async () => {
      await this.ready;
      if (multipv !== this.mpv) {
        this.send(`setoption name MultiPV value ${multipv}`);
        this.mpv = multipv;
      }
      const lines = [];
      const onInfo = (l) => {
        if (!l.startsWith('info') || !l.includes(' pv ')) return;
        if (/ (lowerbound|upperbound)/.test(l)) return;
        const sc = / score (cp|mate) (-?\d+)/.exec(l);
        if (!sc) return;
        const mp = / multipv (\d+)/.exec(l);
        const d = / depth (\d+)/.exec(l);
        const pv = l.slice(l.indexOf(' pv ') + 4).trim().split(' ');
        const idx = (mp ? +mp[1] : 1) - 1;
        const o = { depth: d ? +d[1] : 0, pv };
        if (sc[1] === 'cp') o.cp = +sc[2]; else o.mate = +sc[2];
        lines[idx] = o;
      };
      this.ls.add(onInfo);
      this.send('position fen ' + fen);
      let cmd = 'go';
      if (depth) cmd += ' depth ' + depth;
      if (movetime) cmd += ' movetime ' + movetime;
      if (!depth && !movetime) cmd += ' depth 10';
      this.send(cmd);
      const bm = await this._wait((l) => l.startsWith('bestmove'));
      this.ls.delete(onInfo);
      const best = bm.split(' ')[1];
      return { best: best === '(none)' ? null : best, lines: lines.filter(Boolean) };
    });
  }
  terminate() { try { this.w.terminate(); } catch (e) {} }
}

// Níveis de dificuldade do adversário
export const LEVELS = [
  { id: 1, elo: 500, name: 'Iniciante', desc: 'Comete erros bobos. Ideal para aprender as regras.', opts: { UCI_LimitStrength: 'false', 'Skill Level': 0 }, go: { depth: 1 } },
  { id: 2, elo: 900, name: 'Fácil', desc: 'Joga razoável, mas deixa peças soltas.', opts: { UCI_LimitStrength: 'false', 'Skill Level': 4 }, go: { depth: 3 } },
  { id: 3, elo: 1400, name: 'Médio', desc: 'Aproximadamente 1400 de rating.', opts: { UCI_LimitStrength: 'true', UCI_Elo: 1400 }, go: { movetime: 250 } },
  { id: 4, elo: 1800, name: 'Avançado', desc: 'Aproximadamente 1800 de rating.', opts: { UCI_LimitStrength: 'true', UCI_Elo: 1800 }, go: { movetime: 400 } },
  { id: 5, elo: 2300, name: 'Expert', desc: 'Aproximadamente 2300 de rating.', opts: { UCI_LimitStrength: 'true', UCI_Elo: 2300 }, go: { movetime: 600 } },
  { id: 6, elo: 3200, name: 'Máximo', desc: 'Força total do Stockfish. Boa sorte!', opts: { UCI_LimitStrength: 'false', 'Skill Level': 20 }, go: { movetime: 900 } },
];
