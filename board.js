// Tabuleiro: toque para selecionar/mover ou arraste a peça
const FILES = 'abcdefgh';
const ARROW_COLORS = { good: 'rgba(129,182,76,.85)', bad: 'rgba(202,52,49,.8)', blue: 'rgba(92,139,176,.85)' };

export function parseFen(fen) {
  const map = {};
  const rows = fen.split(' ')[0].split('/');
  rows.forEach((row, r) => {
    let c = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) c += +ch;
      else {
        map[FILES[c] + (8 - r)] = (ch === ch.toUpperCase() ? 'w' : 'b') + ch.toLowerCase();
        c++;
      }
    }
  });
  return map;
}

export class Board {
  constructor(root, opts = {}) {
    this.root = root;
    this.opts = opts;
    this.state = { fen: '8/8/8/8/8/8/8/8 w - - 0 1', orientation: 'w' };
    this.selected = null;
    this.targets = [];
    this.drag = null;
    this._prev = {};
    this._noAnim = false;
    root.classList.add('board');
    root.addEventListener('pointerdown', (e) => this._down(e));
    window.addEventListener('pointermove', (e) => this._move(e));
    window.addEventListener('pointerup', (e) => this._up(e));
    window.addEventListener('pointercancel', () => this._cancelDrag());
  }

  set(state, keepSelection = false) {
    this.state = Object.assign({ orientation: this.state.orientation }, state);
    if (!keepSelection) { this.selected = null; this.targets = []; }
    this.render();
  }

  sqAt(x, y) {
    const rect = this.root.getBoundingClientRect();
    const c = Math.floor(((x - rect.left) / rect.width) * 8);
    const r = Math.floor(((y - rect.top) / rect.height) * 8);
    if (c < 0 || c > 7 || r < 0 || r > 7) return null;
    return this._name(c, r);
  }
  _name(c, r) {
    const o = this.state.orientation;
    const file = o === 'w' ? c : 7 - c;
    const rank = o === 'w' ? 7 - r : r;
    return FILES[file] + (rank + 1);
  }
  _pos(sq) {
    const o = this.state.orientation;
    const f = FILES.indexOf(sq[0]), rk = +sq[1] - 1;
    return { c: o === 'w' ? f : 7 - f, r: o === 'w' ? 7 - rk : rk };
  }

  render() {
    if (this.state.anim && this.state.anim.length) { if (this._defT) { clearTimeout(this._defT); this._defT = null; } }
    else if (this._animAt && Date.now() - this._animAt < 560) {
      if (!this._defT) this._defT = setTimeout(() => { this._defT = null; this.render(); }, 570 - (Date.now() - this._animAt));
      return;
    }
    const { fen, last, check, arrows, badge, marks, noCoords } = this.state;
    const emptyBoard = fen.startsWith('8/8/8/8/8/8/8/8');
    const pieces = parseFen(fen);
    let h = '';
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const sq = this._name(c, r);
        const light = (FILES.indexOf(sq[0]) + +sq[1]) % 2 === 1;
        let cls = 'sq ' + (light ? 'l' : 'd');
        if (last && (last[0] === sq || last[1] === sq)) cls += ' last';
        if (this.selected === sq) cls += ' sel';
        if (marks && marks[sq]) cls += ' mk mk-' + marks[sq];
        if (check === sq) cls += ' chk';
        const t = this.targets.find((x) => x.to === sq);
        if (t) cls += t.capture ? ' tcap' : ' tgt';
        const p = pieces[sq];
        h += `<div class="${cls}" data-sq="${sq}" style="left:${c * 12.5}%;top:${r * 12.5}%">`;
        if (p) h += `<div class="pc pc-${p}"></div>`;
        if (!noCoords && c === 0) h += `<i class="rk">${sq[1]}</i>`;
        if (!noCoords && r === 7) h += `<i class="fl">${sq[0]}</i>`;
        if (badge && badge.sq === sq) h += `<b class="badge" style="background:${badge.color}">${badge.sym}</b>`;
        h += '</div>';
      }
    }
    if (arrows && arrows.length) {
      h += '<svg class="arrows" viewBox="0 0 8 8">';
      for (const a of arrows) h += this._arrow(a);
      h += '</svg>';
    }
    this.root.innerHTML = h;
    const prev = this._prev; this._prev = pieces;
    const anim = this.state.anim;
    if (anim && anim.length && !this._noAnim) this._animate(anim, prev, pieces);
    this._noAnim = false; this._dropPt = null;
    this.state.anim = null;
  }

  _animate(list, prev, now) {
    this._animAt = Date.now();
    list.forEach((a, idx) => {
      const sq = this.root.querySelector(`[data-sq="${a.to}"]`);
      const el = sq && sq.querySelector('.pc');
      if (!el) return;
      const A = this._pos(a.from), B = this._pos(a.to);
      el.style.transition = 'none';
      const dp = this._dropPt;
      if (idx === 0 && dp && dp.to === a.to) {
        const r = sq.getBoundingClientRect();
        el.style.transform = `translate(${((dp.x - (r.left + r.width / 2)) / r.width) * 100}%,${((dp.y - (r.top + r.height / 2)) / r.height) * 100}%)`;
      } else el.style.transform = `translate(${(A.c - B.c) * 100}%,${(A.r - B.r) * 100}%)`;
      el.style.zIndex = 6;
      if (idx === 0 && prev[a.to] && prev[a.to] !== now[a.to]) {
        const g = document.createElement('div');
        g.className = 'pc pc-' + prev[a.to];
        g.style.transition = 'opacity .45s ease, transform .45s ease';
        sq.appendChild(g);
        requestAnimationFrame(() => { g.style.opacity = '0'; g.style.transform = 'scale(.55)'; });
        setTimeout(() => g.remove(), 500);
      }
      el.getBoundingClientRect();
      requestAnimationFrame(() => {
        el.style.transition = 'transform .5s cubic-bezier(.4,.0,.2,1)';
        el.style.transform = 'translate(0,0)';
        setTimeout(() => { el.style.zIndex = ''; el.style.transition = ''; el.style.transform = ''; }, 560);
      });
    });
  }

  _arrow(a) {
    const A = this._pos(a.from), B = this._pos(a.to);
    const x1 = A.c + 0.5, y1 = A.r + 0.5, x2 = B.c + 0.5, y2 = B.r + 0.5;
    const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len;
    const head = 0.34, w = 0.14;
    const ex = x2 - ux * head, ey = y2 - uy * head;
    const col = ARROW_COLORS[a.kind || 'good'];
    const px = -uy, py = ux;
    return `<line x1="${x1}" y1="${y1}" x2="${ex}" y2="${ey}" stroke="${col}" stroke-width="${w}" stroke-linecap="round"/>` +
      `<polygon fill="${col}" points="${x2},${y2} ${ex + px * 0.2},${ey + py * 0.2} ${ex - px * 0.2},${ey - py * 0.2}"/>`;
  }

  // ---- interação ----
  _down(e) {
    if (this.opts.onTap) { const q = this.sqAt(e.clientX, e.clientY); if (q) { e.preventDefault(); this.opts.onTap(q); } return; }
    if (!this.opts.canSelect) return;
    const sq = this.sqAt(e.clientX, e.clientY);
    if (!sq) return;
    e.preventDefault();
    if (this.selected && this.targets.some((t) => t.to === sq)) {
      const from = this.selected;
      this.selected = null; this.targets = [];
      this.render();
      this.opts.onMove(from, sq);
      return;
    }
    if (this.opts.canSelect(sq)) {
      this.selected = sq;
      this.targets = this.opts.getTargets(sq);
      this.render();
      this._startDrag(sq, e);
    } else {
      this.selected = null; this.targets = [];
      this.render();
    }
  }
  _startDrag(sq, e) {
    const el = this.root.querySelector(`[data-sq="${sq}"] .pc`);
    if (!el) return;
    const size = this.root.getBoundingClientRect().width / 8;
    const ghost = el.cloneNode();
    ghost.className = el.className + ' ghost';
    ghost.style.width = ghost.style.height = size * 1.1 + 'px';
    document.body.appendChild(ghost);
    el.style.opacity = '0.25';
    this.drag = { from: sq, ghost, el, size: size * 1.1, moved: false, sx: e.clientX, sy: e.clientY };
    this._place(e);
  }
  _place(e) {
    const d = this.drag;
    d.ghost.style.left = e.clientX - d.size / 2 + 'px';
    d.ghost.style.top = e.clientY - d.size / 2 + 'px';
  }
  _move(e) {
    if (!this.drag) return;
    if (Math.hypot(e.clientX - this.drag.sx, e.clientY - this.drag.sy) > 6) this.drag.moved = true;
    this._place(e);
  }
  _up(e) {
    const d = this.drag;
    if (!d) return;
    const to = this.sqAt(e.clientX, e.clientY);
    this._cancelDrag();
    if (d.moved && to && to !== d.from && this.targets.some((t) => t.to === to)) {
      const from = d.from;
      this.selected = null; this.targets = [];
      this._dropPt = { x: e.clientX, y: e.clientY, to };
      this.opts.onMove(from, to);
    }
  }
  _cancelDrag() {
    if (!this.drag) return;
    this.drag.ghost.remove();
    if (this.drag.el) this.drag.el.style.opacity = '';
    this.drag = null;
  }
}
