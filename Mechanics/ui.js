'use strict';
// UI is drawn on the display canvas in logical 320x184 coordinates, scaled, so text stays crisp.
const FONT = "'VT323', 'Courier New', monospace";
const TITLE_FONT = "'Press Start 2P', 'Courier New', monospace";

// Who made this. Shown on the title screen and in the credits film (Design/credits.js).
const CREDITS = {
  by: 'Rayen Zayani',
  // Cards shown over each chapter as Eli runs back through it (5 is the walk home). A body can be a
  // function, read when the card appears. big: the names are spelled out letter by letter.
  cards: {
    1: [
      { head: 'A GAME BY', body: () => [CREDITS.by], big: true },
      { head: 'STORY  DESIGN  CODE', body: () => [CREDITS.by] },
    ],
    2: [
      { head: 'PIXEL ART  ANIMATION  SOUND', body: () => [CREDITS.by] },
      { head: 'MUSIC', body: () => (Music.ok ? ['"The Breeze"'] : ['Original synthesized score', 'written for The Between']) },
    ],
    3: [
      { head: 'TYPEFACES', body: ['Press Start 2P  by CodeMan38', 'VT323  by Peter Hull'] },
      { head: 'INSPIRED BY', body: ['Celeste  ·  Undertale  ·  Life is Strange'] },
    ],
    4: [
      { head: 'HONORABLE MENTIONS', body: ['Melodih  ·  Seni  ·  Lau Lau', 'Hassnani  ·  Alina  ·  Yahya', 'Yameen'] },
    ],
    5: [
      { head: 'THANK YOU', body: ['to everyone who has ever sat in a waiting room', 'for someone they love.'] },
      { head: 'AND YOU', body: ['for every jump,', 'and every time you got back up.'] },
    ],
  },
  // The line-up. after: what's shown instead once the player has seen an ending.
  cast: [
    { id: 'eli', name: 'ELI', color: '#9aa9cf', line: 'Thirteen. Still learning how to say sorry.' },
    { id: 'remi', name: 'REMI', color: '#ff3b5c', line: 'The girl with the red ribbon.', after: 'Everything he couldn\'t carry. The other half.' },
    { id: 'mom', name: 'MOM', color: '#5fb8b0', line: 'Night shifts. A ribbon tied to the bed rail.' },
    { id: 'walt', name: 'WALT', color: '#e8b890', line: 'Twenty-two years on the road. Treasure Island.' },
    { id: 'juno', name: 'JUNO', color: '#ff7a7a', line: 'Fourteen meters up when the hold spun.' },
    { id: 'hester', name: 'HESTER', color: '#c0a0e0', line: 'Forty-one years of third grade. One c, two s\'s.' },
    { id: 'pip', name: 'PIP', color: '#e8c040', line: 'Six and three-quarters. Biscuit has one white ear.' },
    { id: 'hollow', name: 'HOLLOW', full: 'THE HOLLOW', color: '#ff4d6d', line: 'Right behind him. Always.', after: 'The worst thing he ever believed about himself.' },
  ],
  castCoda: 'Nobody in The Between was ever really alone.',
  // What each Echo says as Eli runs past, depending on whether he helped them.
  echoes: {
    walt: { helped: 'I\'m gonna be there for the ending.', not: 'Gate\'s that way, kid. Don\'t let me keep you.' },
    juno: { helped: 'Turns out you can be scared and jump anyway.', not: 'Go on. I\'m fine here. I\'m always fine here.' },
    hester: { helped: 'N-E-C-E-S-S-A-R-Y. I\'ll never lose it again.', not: 'Hm? Oh. I\'m sorry, dear. Have we met?' },
    pip: { helped: 'Biscuit is brown with one white ear.', not: 'I\'m being very good at waiting.' },
  },
  hollowLine: 'Run, then. I\'ll be right behind you. I always am.',
};

// Voice blips per speaker: [pitch, waveform].
const VOICES = {
  ELI: [420, 'square'], '???': [560, 'triangle'], REMI: [560, 'triangle'], WALT: [190, 'square'], JUNO: [500, 'square'],
  HESTER: [330, 'triangle'], PIP: [700, 'square'], HOLLOW: [110, 'sawtooth'], MOM: [360, 'triangle'], VOICE: [360, 'sine'],
};

// Frames (60 a second) as m:ss.d, or h:mm:ss past an hour.
function fmtTime(f) {
  const s = Math.floor(f / 60), m = Math.floor(s / 60), p = (n) => String(n).padStart(2, '0');
  return m >= 60 ? `${Math.floor(m / 60)}:${p(m % 60)}:${p(s % 60)}` : `${m}:${p(s % 60)}.${Math.floor((f % 60) / 6)}`;
}

function setFont(g, size, title) { g.font = `${size}px ${title ? TITLE_FONT : FONT}`; }

function wrap(g, text, maxW) {
  const out = [];
  for (const para of String(text).split('\n')) {
    let line = '';
    for (const word of para.split(' ')) {
      const test = line ? line + ' ' + word : word;
      if (g.measureText(test).width > maxW && line) { out.push(line); line = word; } else line = test;
    }
    out.push(line);
  }
  return out;
}

function textC(g, s, x, y, color, shadow = true) {
  g.textAlign = 'center';
  if (shadow) { g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillText(s, x + 0.5, y + 0.5); }
  g.fillStyle = color; g.fillText(s, x, y);
  g.textAlign = 'left';
}

function panel(g, x, y, w, h, border = '#5a6488') {
  g.fillStyle = 'rgba(6,7,16,0.92)'; g.fillRect(x, y, w, h);
  g.strokeStyle = border; g.lineWidth = 0.5; g.strokeRect(x + 1.25, y + 1.25, w - 2.5, h - 2.5);
  g.fillStyle = border; g.fillRect(x + 1, y + 1, 2, 2); g.fillRect(x + w - 3, y + 1, 2, 2); g.fillRect(x + 1, y + h - 3, 2, 2); g.fillRect(x + w - 3, y + h - 3, 2, 2);
}

// ---------- Dialogue ----------
const Dialog = {
  active: false, lines: [], i: 0, shown: 0, acc: 0, choiceSel: 0, onDone: null, pause: 0,
  start(lines, onDone) {
    this.lines = lines.slice(); this.i = -1; this.onDone = onDone; this.active = true;
    Input.flush();
    this.advance();
  },
  current() { return this.lines[this.i]; },
  advance() {
    this.i++;
    while (this.i < this.lines.length) {
      const L = this.lines[this.i];
      if (L.give === 'dash') { Game.giveDash(); this.i++; continue; }
      if (L.name) { Game.save.herName = L.name; Achievements.unlock('name'); this.i++; continue; }
      if (L.final) { this.i++; continue; }
      if (L.fragmentsLine) this.lines[this.i] = Game.fragCount() >= TOTAL_FRAGMENTS / 2 ? FRAGMENT_LINES.many : FRAGMENT_LINES.few;
      if (L.bondLine) this.lines[this.i] = (Game.save.bond || 0) >= 2 ? BOND_LINES.high : BOND_LINES.low;
      break;
    }
    if (this.i >= this.lines.length) { this.active = false; Input.flush(); if (this.onDone) this.onDone(); return; }
    this.shown = 0; this.acc = 0; this.choiceSel = 0; this.pause = 0;
  },
  update() {
    const L = this.current();
    if (!L) return;
    if (L.choice) {
      if (Input.pressed('up') || Input.pressed('down')) { this.choiceSel = (this.choiceSel + 1) % L.choice.length; Sound.play('select'); }
      if (Input.pressed('confirm')) {
        const c = L.choice[this.choiceSel];
        Game.applyChoice(c.set);
        HUD.showNotice('This choice will have consequences.');
        this.lines.splice(this.i + 1, 0, ...c.then);
        Sound.play('confirm');
        this.advance();
      }
      return;
    }
    if (this.shown < L.t.length) {
      if (this.pause > 0) this.pause--;
      else {
        const fast = Input.held('confirm'), rate = TEXT_SPEEDS[Game.options.textSpeed] ?? 1;
        if (rate === Infinity) { this.shown = L.t.length; if (L.s && VOICES[L.s]) Sound.talk(...VOICES[L.s]); }
        this.acc += fast ? Math.max(2, rate) : rate;
        let blip = false;
        while (this.acc >= 1 && this.shown < L.t.length && this.pause <= 0) {
          this.acc--;
          const ch = L.t[this.shown++];
          // Breathe on punctuation, like someone actually talking.
          if (!fast && '.,?!'.includes(ch) && L.t[this.shown] === ' ') this.pause = ch === ',' ? 4 : 9;
          if (this.shown % 2 === 0 && ch !== ' ') blip = true;
        }
        if (this.pause > 0) this.acc = 0;
        if (blip && L.s) { const v = VOICES[L.s]; if (v) Sound.talk(v[0], v[1]); }
      }
    }
    if (Input.pressed('confirm') || Input.pressed('jump')) {
      if (this.shown < L.t.length) this.shown = L.t.length; else { Sound.play('select'); this.advance(); }
    }
  },
  draw(g) {
    const L = this.current();
    if (!L) return;
    const x = 6, y = H - 52, w = W - 12, h = 47;
    if (L.choice) {
      const ch = 16 + L.choice.length * 14;
      panel(g, 30, H - ch - 6, W - 60, ch, '#ffe9a8');
      setFont(g, 11);
      L.choice.forEach((c, k) => {
        const sel = k === this.choiceSel;
        if (sel) { g.fillStyle = 'rgba(255,233,168,0.12)'; g.fillRect(36, H - ch + 4 + k * 14, W - 72, 12); }
        g.fillStyle = sel ? '#ffe9a8' : '#8a90a8';
        if (sel) { g.fillStyle = '#ff4d6d'; g.fillRect(40, H - ch + 8 + k * 14, 3, 3); g.fillStyle = '#ffe9a8'; }
        g.fillText(c.t, 48, H - ch + 13 + k * 14);
      });
      return;
    }
    const sp = L.s, col = SPEAKERS[sp] || '#ffffff', hasPortrait = sp && sp !== 'VOICE';
    panel(g, x, y, w, h, sp ? col : '#ffe9a8');
    let tx = x + 10;
    if (hasPortrait) {
      g.fillStyle = '#0b0e1a'; g.fillRect(x + 7, y + 8, 32, 32);
      const tint = ['WALT', 'JUNO', 'HESTER', 'PIP'].includes(sp) && World.chapter !== 5;
      Portraits.draw(g, sp, L.e, x + 8, y + 9, tint);
      g.strokeStyle = col; g.lineWidth = 0.5; g.strokeRect(x + 7.25, y + 8.25, 31.5, 31.5);
      tx = x + 46;
    }
    if (sp) {
      setFont(g, 10);
      g.fillStyle = col;
      g.fillText(SPEAKER_NAMES[sp] || sp, tx, y + 11);
    }
    setFont(g, 11);
    g.fillStyle = sp === 'VOICE' ? '#bfeee8' : sp ? '#eef1ff' : '#ffe9a8';
    const body = (sp ? '' : '* ') + L.t;
    const shown = body.slice(0, this.shown + (sp ? 0 : 2));
    const lines = wrap(g, shown, w - (tx - x) - 10);
    lines.slice(0, 4).forEach((ln, k) => g.fillText(ln, tx, y + (sp ? 22 : 14) + k * 9));
    if (this.shown >= L.t.length && (Game.frame >> 4) % 2) { g.fillStyle = col; g.fillRect(x + w - 10, y + h - 8, 4, 2); g.fillRect(x + w - 9, y + h - 6, 2, 1); }
  },
};

// ---------- Full-screen slides (prologue, chapter cards, endings, credits) ----------
// Entries are strings or {t, scene}.
const Slides = {
  active: false, list: [], i: 0, t: 0, onDone: null, color: '#eef1ff', scenePanel: null,
  show(list, onDone, opts = {}) {
    this.list = list; this.i = 0; this.t = 0; this.onDone = onDone; this.active = true;
    this.color = opts.color || '#eef1ff'; this.big = !!opts.big; this.sub = opts.sub || null; this.auto = opts.auto || 0;
    Input.flush();
  },
  update() {
    this.t++;
    if ((this.t > 20 && (Input.pressed('confirm') || Input.pressed('jump'))) || (this.auto && this.t > this.auto)) {
      Sound.play('select');
      this.i++; this.t = 0;
      if (this.i >= this.list.length) { this.active = false; Input.flush(); if (this.onDone) this.onDone(); }
    }
  },
  draw(g) {
    g.fillStyle = '#05060c'; g.fillRect(0, 0, W, H);
    let s = this.list[this.i];
    if (s === undefined) return;
    if (typeof s === 'string') s = { t: s };
    const a = Math.min(1, this.t / 30);
    g.globalAlpha = a;
    let ty = H / 2;
    if (s.scene) {
      if (!this.scenePanel) this.scenePanel = makeCanvas(160, 80);
      const sg = this.scenePanel.getContext('2d');
      sg.clearRect(0, 0, 160, 80);
      Art.scene(sg, s.scene, this.t);
      g.drawImage(this.scenePanel, 80, 14);
      g.strokeStyle = '#2a2e44'; g.lineWidth = 1; g.strokeRect(79.5, 13.5, 161, 81);
      ty = 128;
    }
    if (this.big) {
      setFont(g, 8, true);
      const lines = s.t.split('\n');
      lines.forEach((ln, k) => textC(g, ln, W / 2, ty - (lines.length - 1) * 8 + k * 16 - (this.sub ? 8 : 0), k === 0 ? this.color : '#eef1ff'));
      if (this.sub) { g.globalAlpha = a * Math.min(1, Math.max(0, (this.t - 30) / 30)); setFont(g, 11); textC(g, this.sub, W / 2, ty + lines.length * 8 + 6, '#9aa0bc'); }
    } else {
      setFont(g, 13);
      const lines = wrap(g, s.t, W - 50);
      lines.forEach((ln, k) => textC(g, ln, W / 2, ty - (lines.length - 1) * 6 + k * 12 + 4, this.color));
    }
    if (!this.auto) {
      g.globalAlpha = a * (0.4 + 0.3 * Math.sin(Game.frame * 0.08));
      setFont(g, 9); textC(g, 'C / Enter', W / 2, H - 6, '#6a7090', false);
    }
    g.globalAlpha = 1;
  },
};

// ---------- Menus ----------
class Menu {
  // opts: gap, onBack, align ('center' | 'left'), intro (frames the items take to slide in).
  constructor(title, items, opts = {}) {
    this.title = title; this.items = items; this.sel = 0; this.opts = opts; this.gap = opts.gap || 13;
    this.skip(1);
    this.fsel = this.sel; this.t = 0; this.hit = null; this.lean = items.map(() => 0);
  }
  skip(dir) {
    for (let n = 0; n < this.items.length && this.items[this.sel].disabled; n++) this.sel = (this.sel + dir + this.items.length) % this.items.length;
  }
  label(it) { return typeof it.label === 'function' ? it.label() : it.label; }
  // Which item the mouse is over (rows are laid out by the last draw), or -1.
  hover() {
    const m = Input.mouse;
    if (!m.active || !this.hit) return -1;
    return this.hit.findIndex((r) => m.x >= r.x0 && m.x <= r.x1 && m.y >= r.y0 && m.y < r.y1);
  }
  activate(it) { if (!it.disabled) { Sound.play('confirm'); Input.flush(); it.action(); return true; } return false; }
  update() {
    this.t++;
    this.clicked = false;
    if (Input.pressed('down')) { this.sel = (this.sel + 1) % this.items.length; this.skip(1); Sound.play('select'); }
    if (Input.pressed('up')) { this.sel = (this.sel - 1 + this.items.length) % this.items.length; this.skip(-1); Sound.play('select'); }
    const h = this.hover(), m = Input.mouse;
    if (h >= 0 && m.moved && h !== this.sel && !this.items[h].disabled) { this.sel = h; Sound.play('select'); }
    this.fsel += (this.sel - this.fsel) * 0.28;
    this.lean = this.lean.map((v, k) => v + ((k === this.sel ? 1 : 0) - v) * 0.22);
    const it = this.items[this.sel];
    if (m.click && h >= 0) {
      // A click lands on the row it's over. Right half of an adjustable row turns it up, left half down.
      this.clicked = true;
      const row = this.items[h];
      if (row.adjust) { const r = this.hit[h]; row.adjust(m.x > (r.x0 + r.x1) / 2 ? 1 : -1); Sound.play('select'); } else this.activate(row);
      return;
    }
    if (it.adjust && (Input.pressed('left') || Input.pressed('right'))) { it.adjust(Input.pressed('right') ? 1 : -1); Sound.play('select'); }
    if (Input.pressed('confirm')) this.activate(it);
    else if (Input.pressed('back') && this.opts.onBack) { Input.flush(); this.opts.onBack(); }
  }
  draw(g, y0 = 90, x = W / 2) {
    const left = this.opts.align === 'left', intro = this.opts.intro || 0;
    if (this.title) { setFont(g, 8, true); textC(g, this.title, x, y0 - 16, '#ffe9a8'); }
    setFont(g, 12);
    const widths = this.items.map((it) => g.measureText(this.label(it)).width);
    const span = Math.max(...widths) + 28;
    const x0 = left ? x - 10 : x - span / 2, x1 = left ? x + span : x + span / 2;
    this.hit = this.items.map((it, k) => ({ x0, x1, y0: y0 + k * this.gap - 4 - this.gap / 2, y1: y0 + k * this.gap - 4 + this.gap / 2 }));
    // Highlight bar glides between rows.
    const hy = Math.round(y0 + this.fsel * this.gap - 4), hl = this.hover() === this.sel ? 1 : 0;
    const bar = g.createLinearGradient(x0, 0, x1, 0);
    if (left) { bar.addColorStop(0, `rgba(255,77,109,${0.32 + hl * 0.1})`); bar.addColorStop(0.6, 'rgba(255,77,109,0.08)'); bar.addColorStop(1, 'rgba(255,77,109,0)'); }
    else { bar.addColorStop(0, 'rgba(255,77,109,0)'); bar.addColorStop(0.5, `rgba(255,77,109,${0.22 + hl * 0.1})`); bar.addColorStop(1, 'rgba(255,77,109,0)'); }
    g.fillStyle = bar; g.fillRect(x0, hy - 5, x1 - x0, 10);
    g.fillStyle = 'rgba(255,140,160,0.35)'; g.fillRect(x0, hy + 5, left ? (x1 - x0) * 0.5 : x1 - x0, 1);
    if (left) { g.fillStyle = '#ff4d6d'; g.fillRect(x0, hy - 5, 2, 10); }
    this.items.forEach((it, k) => {
      const sel = k === this.sel, label = this.label(it);
      // Items slide in one after another when the menu opens.
      const p = intro ? clamp((this.t - k * 4) / intro, 0, 1) : 1, e = 1 - (1 - p) ** 3;
      if (p <= 0) return;
      g.globalAlpha = e;
      const yy = y0 + k * this.gap, push = Math.round(this.lean[k] * (left ? 5 : 0) - (1 - e) * 18);
      const tx = left ? x + push : x;
      if (sel) {
        // Ribbon-red bow marker, the bob shared with the rest of the game.
        const bob = Math.round(Math.sin(Game.frame * 0.15));
        g.fillStyle = '#ff4d6d';
        if (left) {
          const bx = tx - 10 + bob, by = yy - 7;
          g.fillRect(bx, by, 2, 5); g.fillRect(bx + 2, by + 1, 1, 3); g.fillRect(bx + 4, by + 1, 1, 3); g.fillRect(bx + 5, by, 2, 5);
          g.fillStyle = '#b8203c'; g.fillRect(bx + 3, by + 1, 1, 3);
        }
        else { const w = widths[k]; g.fillRect(x - w / 2 - 9 + bob, yy - 5, 3, 3); g.fillRect(x + w / 2 + 6 - bob, yy - 5, 3, 3); }
      }
      g.textAlign = left ? 'left' : 'center';
      g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillText(label, tx + 0.5, yy + 0.5);
      g.fillStyle = it.disabled ? '#4a5068' : sel ? '#ffffff' : '#9aa0bc'; g.fillText(label, tx, yy);
      g.textAlign = 'left';
    });
    g.globalAlpha = 1;
  }
}

// ---------- HUD, toasts, memory popups ----------
const HUD = {
  memory: null, roomName: null, notice: null,
  showMemory(text) { this.memory = { text, t: 0 }; },
  // Telltale-style whisper after a dialogue choice.
  showNotice(text) { this.notice = { text, t: 0 }; },
  showRoom(name) { this.roomName = { name, t: 0 }; },
  update() {
    if (this.memory && ++this.memory.t > 360) this.memory = null;
    if (this.roomName && ++this.roomName.t > 180) this.roomName = null;
    if (this.notice && ++this.notice.t > 200) this.notice = null;
  },
  draw(g, p) {
    const cap = CHAPTERS[World.chapter];
    if (World.chapter !== 5) {
      setFont(g, 10);
      g.fillStyle = 'rgba(6,7,16,0.55)'; g.fillRect(2, 2, 58, 12);
      diamond(g, 9, 8, 2.5, 4, '#ffe6f6'); diamond(g, 9.5, 8.5, 1, 2, '#ff8ac6');
      g.fillStyle = '#eef1ff'; g.fillText(`${Game.fragCount()}/${TOTAL_FRAGMENTS}`, 15, 11.5);
      g.fillStyle = cap.color; g.fillText(cap.suit, 50, 11.5);
    }
    // Right corner: the run timer and anything changing how the game plays.
    const tags = [];
    if (Game.options.timer) tags.push([fmtTime(Game.save.time), '#eef1ff']);
    if (Game.options.assist) tags.push(['ASSIST', '#ffb46b']);
    if (Game.options.speed < 1) tags.push([`${Math.round(Game.options.speed * 100)}% SPEED`, '#ffb46b']);
    setFont(g, 10); g.textAlign = 'right';
    tags.forEach(([s, c], k) => {
      const w = g.measureText(s).width;
      g.fillStyle = 'rgba(6,7,16,0.55)'; g.fillRect(W - w - 6, 2 + k * 11, w + 4, 11);
      g.fillStyle = c; g.fillText(s, W - 4, 11 + k * 11);
    });
    g.textAlign = 'left';
    if (this.roomName) {
      const r = this.roomName, a = Math.min(1, r.t / 20, (180 - r.t) / 30);
      g.globalAlpha = a; setFont(g, 11); textC(g, r.name, W / 2, 14, '#eef1ff'); g.globalAlpha = 1;
    }
    if (p && !p.dead && p.stamina < PHYS.STAMINA) {
      const r = clamp(p.stamina / PHYS.STAMINA, 0, 1);
      g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(p.x - 2, p.y - 7, 10, 3);
      g.fillStyle = r < 0.25 ? ((Game.frame >> 2) % 2 ? '#ff5a5a' : '#ffb0b0') : '#7fd1a8'; g.fillRect(p.x - 1, p.y - 6, 8 * r, 1);
    }
    if (this.notice) {
      const n = this.notice, a = Math.min(1, n.t / 25, (200 - n.t) / 40);
      setFont(g, 10);
      const w = g.measureText(n.text).width, y = World.chapter !== 5 ? 17 : 3;
      g.globalAlpha = a;
      g.fillStyle = 'rgba(6,7,16,0.55)'; g.fillRect(2, y, w + 18, 12);
      // A small eye that blinks once as the line appears.
      const open = n.t < 30 && n.t > 20 ? 0.5 : 2;
      g.fillStyle = '#ffe9a8'; g.fillRect(5, y + 6 - open / 2, 8, open);
      g.fillStyle = '#ff4d6d'; g.fillRect(8, y + 5, 2, 2);
      g.fillStyle = '#ffe9a8'; g.fillText(n.text, 16, y + 9.5);
      g.globalAlpha = 1;
    }
    if (this.memory) {
      const m = this.memory, a = Math.min(1, m.t / 20, (360 - m.t) / 30);
      g.globalAlpha = a;
      setFont(g, 11);
      const lines = wrap(g, m.text, 250);
      panel(g, W / 2 - 136, 18, 272, 20 + lines.length * 10, '#ff8ac6');
      setFont(g, 6, true); textC(g, 'MEMORY RECOVERED', W / 2, 29, '#ff8ac6');
      setFont(g, 11);
      lines.forEach((ln, k) => textC(g, ln, W / 2, 41 + k * 10, '#ffe6f6'));
      g.globalAlpha = 1;
    }
  },
};

// Achievement toast: slides in from the right with the achievement's icon, edged in its tier color.
function drawToasts(g) {
  const t = Achievements.toasts[0];
  if (!t) return;
  const a = t.a, tier = ACH_TIERS[a.tier] || ACH_TIERS.gold, plat = a.tier === 'platinum';
  const life = plat ? 260 : 200, slide = t.t < 15 ? (15 - t.t) ** 2 * 0.7 : t.t > life - 15 ? (t.t - (life - 15)) ** 2 * 0.7 : 0;
  const w = 146, x = Math.round(W - w - 4 + slide), y = H - 34;
  panel(g, x, y, w, 30, tier.color);
  // Icon in its frame, with a soft glow that breathes.
  const glow = g.createRadialGradient(x + 15, y + 15, 0, x + 15, y + 15, 16);
  glow.addColorStop(0, tint(tier.color, 0.35 + 0.15 * Math.sin(t.t * 0.12))); glow.addColorStop(1, tint(tier.color, 0));
  g.fillStyle = glow; g.fillRect(x + 1, y + 1, 30, 28);
  g.fillStyle = tier.dark; g.fillRect(x + 6, y + 6, 18, 18);
  g.strokeStyle = tier.color; g.lineWidth = 1; g.strokeRect(x + 5.5, y + 5.5, 19, 19);
  if (a.icon) drawAchIcon(g, a.icon, x + 7, y + 7, 2, tier.color, true);
  else { g.fillStyle = '#2a2010'; g.fillRect(x + 11, y + 10, 8, 6); g.fillRect(x + 13, y + 16, 4, 3); g.fillRect(x + 11, y + 19, 8, 1); }
  const head = t.head || (a.cat === 'ending' ? 'ENDING FOUND' : a.hidden ? 'SECRET FOUND' : plat ? 'PLATINUM UNLOCKED' : 'ACHIEVEMENT UNLOCKED');
  setFont(g, 9); g.fillStyle = tier.color; g.fillText(head, x + 30, y + 12);
  setFont(g, 11); g.fillStyle = '#ffffff';
  let name = a.name;
  while (g.measureText(name).width > w - 36 && name.length > 4) name = name.slice(0, -2) + '…';
  g.fillText(name, x + 30, y + 23);
  // A glint sweeps across once it has settled.
  const k = (t.t - 18) / 26;
  if (k > 0 && k < 1) {
    const sx = x + k * (w + 30) - 15, sh = g.createLinearGradient(sx - 10, 0, sx + 10, 0);
    sh.addColorStop(0, 'rgba(255,255,255,0)'); sh.addColorStop(0.5, 'rgba(255,255,255,0.22)'); sh.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = sh; g.fillRect(Math.max(x + 1, sx - 10), y + 1, Math.min(20, x + w - 1 - Math.max(x + 1, sx - 10)), 28);
  }
  if (Achievements.toasts.length > 1) { setFont(g, 9); g.fillStyle = '#8a90a8'; g.textAlign = 'right'; g.fillText(`+${Achievements.toasts.length - 1}`, x + w - 5, y + 12); g.textAlign = 'left'; }
}

// ---------- Achievements screen ----------
// Category tabs on top; the list on the left; the selected achievement up close on the right,
// with its tier, a progress bar while it's locked, and Eli's note and the date once it isn't.
const ACH = { listX: 8, listW: 156, top: 36, rowH: 18, rows: 7, detX: 170, detW: 142 };
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const AchScreen = {
  tab: 0, sel: 0, fsel: 0, scroll: 0, fscroll: 0, t: 0, tabT: 0, selT: 0, dir: 0, tabX: null, holdT: 0, hit: null, from: 'title',

  open(from) {
    this.from = from;
    this.t = from === 'pause' ? 16 : 0;
    this.setTab(this.tab, 0, true);
  },

  list() {
    const id = ACH_TABS[this.tab].id;
    return id === 'all' ? ACHIEVEMENTS : ACHIEVEMENTS.filter((a) => a.cat === id);
  },
  color() { return ACH_TABS[this.tab].color; },

  setTab(i, dir, quiet) {
    this.tab = i; this.dir = dir; this.tabT = 0;
    // Land on the first thing that's new, if there is one.
    const l = this.list(), n = l.findIndex((a) => Achievements.isNew(a.id));
    this.select(n >= 0 ? n : 0, true);
    this.fscroll = this.scroll; this.fsel = this.sel;
    if (!quiet) Sound.play('select');
  },

  select(i, snap) {
    const n = this.list().length;
    if (i === this.sel && !snap) return;
    this.sel = clamp(i, 0, n - 1); this.selT = 0;
    // Keep the selection a row away from the edges while there's more to scroll.
    if (this.sel < this.scroll + 1) this.scroll = this.sel - 1;
    if (this.sel > this.scroll + ACH.rows - 2) this.scroll = this.sel - ACH.rows + 2;
    this.scroll = clamp(this.scroll, 0, Math.max(0, n - ACH.rows));
  },

  move(d) {
    const n = this.list().length;
    this.select((this.sel + d + n) % n);
    Sound.play('select');
  },

  back() {
    Input.flush();
    if (this.from === 'title') Game.fadeTo(() => Game.toTitle()); else Game.fadeTo(() => Game.openPause(), 12);
  },

  hover() {
    const m = Input.mouse, h = { tab: -1, row: -1, back: false };
    if (!m.active || !this.hit) return h;
    const inside = (r) => m.x >= r.x0 && m.x <= r.x1 && m.y >= r.y0 && m.y < r.y1;
    h.tab = this.hit.tabs.findIndex(inside);
    h.row = this.hit.rows.findIndex(inside);
    h.back = inside(this.hit.back);
    return h;
  },
  hot() { const h = this.hover(); return h.tab >= 0 || h.row >= 0 || h.back; },

  update() {
    this.t++; this.tabT++; this.selT++;
    const l = this.list(), m = Input.mouse, h = this.hover();
    this.fsel += (this.sel - this.fsel) * 0.3;
    this.fscroll += (this.scroll - this.fscroll) * 0.25;
    if (this.selT === 40) Achievements.markSeen(l[this.sel].id);

    const td = Input.pressed('tabPrev') || Input.pressed('left') ? -1 : Input.pressed('tabNext') || Input.pressed('right') ? 1 : 0;
    if (td) { this.setTab((this.tab + td + ACH_TABS.length) % ACH_TABS.length, td); return; }
    const ud = (Input.held('down') ? 1 : 0) - (Input.held('up') ? 1 : 0);
    if (Input.pressed('down') || Input.pressed('up')) { this.holdT = 0; this.move(ud); }
    else if (ud) { if (++this.holdT > 18 && this.holdT % 4 === 0) this.move(ud); }
    else this.holdT = 0;
    if (m.wheel) { this.select(this.sel + m.wheel); Sound.play('select'); }
    if (m.moved && h.row >= 0 && h.row !== this.sel) { this.select(h.row); Sound.play('select'); }
    if (m.click) {
      if (h.tab >= 0 && h.tab !== this.tab) this.setTab(h.tab, Math.sign(h.tab - this.tab));
      else if (h.back) { Sound.play('confirm'); this.back(); }
      return;
    }
    if (Input.pressed('back')) this.back();
  },

  // ---------- Drawing ----------
  draw(g) {
    const e = (p) => 1 - (1 - clamp(p, 0, 1)) ** 3, intro = e(this.t / 16);
    g.fillStyle = Game.save ? `rgba(5,6,12,${0.86 * intro})` : `rgba(3,4,10,${0.62 * intro})`;
    g.fillRect(0, 0, W, H);
    g.globalAlpha = intro;
    setFont(g, 8, true); textC(g, 'ACHIEVEMENTS', W / 2, 13 - Math.round((1 - intro) * 6), '#ffe9a8');
    this.hit = { tabs: [], rows: [], back: { x0: 4, x1: 46, y0: H - 12, y1: H } };
    this.drawSummary(g);
    this.drawTabs(g);
    this.drawList(g, intro);
    this.drawDetail(g, intro);
    this.drawFooter(g);
    g.globalAlpha = 1;
  },

  // Overall completion on the right of the title; how many of each tier on the left.
  drawSummary(g) {
    const got = Achievements.count(), n = ACHIEVEMENTS.length, pct = Math.floor((got / n) * 100);
    setFont(g, 9); g.textAlign = 'right'; g.fillStyle = '#c9cde0'; g.fillText(`${got}/${n}  ${pct}%`, W - 8, 9);
    g.textAlign = 'left';
    const bw = 52, bx = W - 8 - bw;
    g.fillStyle = '#1c1f30'; g.fillRect(bx, 11, bw, 2);
    g.fillStyle = got === n ? ACH_TIERS.platinum.color : '#ffd36b'; g.fillRect(bx, 11, Math.round(bw * got / n), 2);
    let x = 8;
    for (const k of ['bronze', 'silver', 'gold', 'platinum']) {
      const tr = ACH_TIERS[k], all = ACHIEVEMENTS.filter((a) => a.tier === k), c = Achievements.count(all);
      g.fillStyle = tr.color; g.fillRect(x, 5, 3, 3); g.fillRect(x + 1, 4, 1, 5); g.fillRect(x - 1, 6, 5, 1);
      setFont(g, 9); g.fillStyle = c ? '#c9cde0' : '#5a6078'; g.fillText(String(c), x + 6, 9);
      x += 14 + g.measureText(String(c)).width;
    }
  },

  drawTabs(g) {
    const n = ACH_TABS.length, gap = 2, tw = Math.floor((W - 16 - (n - 1) * gap) / n), x0 = Math.round((W - (n * tw + (n - 1) * gap)) / 2), y = 18, h = 14;
    const hv = this.hover();
    const target = x0 + this.tab * (tw + gap);
    this.tabX = this.tabX === null ? target : this.tabX + (target - this.tabX) * 0.3;
    ACH_TABS.forEach((tb, i) => {
      const x = x0 + i * (tw + gap), on = i === this.tab, hov = hv.tab === i;
      const l = tb.id === 'all' ? ACHIEVEMENTS : ACHIEVEMENTS.filter((a) => a.cat === tb.id), c = Achievements.count(l);
      this.hit.tabs.push({ x0: x, x1: x + tw, y0: y, y1: y + h });
      g.fillStyle = on ? tint(tb.color, 0.16) : hov ? 'rgba(255,255,255,0.06)' : 'rgba(6,7,16,0.6)';
      g.fillRect(x, y, tw, h);
      setFont(g, 10);
      textC(g, tb.name, x + tw / 2, y + 8, on ? '#ffffff' : hov ? '#c8cce0' : '#6a7090', false);
      // A thin bar per tab: how much of it is done. Full tabs glow in their color.
      g.fillStyle = '#1c1f30'; g.fillRect(x + 3, y + 10, tw - 6, 1);
      g.fillStyle = c === l.length ? tb.color : tint(tb.color, on ? 0.9 : 0.5); g.fillRect(x + 3, y + 10, Math.round((tw - 6) * c / l.length), 1);
      if (l.some((a) => Achievements.isNew(a.id)) && (Game.frame >> 4) % 2) { g.fillStyle = '#ff4d6d'; g.fillRect(x + tw - 4, y + 2, 2, 2); }
    });
    g.fillStyle = this.color(); g.fillRect(Math.round(this.tabX), y + h - 1, tw, 1);
  },

  drawList(g, intro) {
    const l = this.list(), { listX: x, listW: w, top, rowH, rows } = ACH, col = this.color(), hv = this.hover();
    const bottom = top + rows * rowH;
    g.fillStyle = 'rgba(6,7,16,0.82)'; g.fillRect(x, top - 1, w, bottom - top + 2);
    g.strokeStyle = '#2a2e44'; g.lineWidth = 0.5; g.strokeRect(x + 0.25, top - 0.75, w - 0.5, bottom - top + 1.5);
    g.save();
    g.beginPath(); g.rect(x, top, w, bottom - top); g.clip();
    const off = this.fscroll * rowH;
    // Highlight bar, gliding between rows.
    const hy = Math.round(top + this.fsel * rowH - off);
    const bar = g.createLinearGradient(x, 0, x + w, 0);
    bar.addColorStop(0, tint(col, 0.24)); bar.addColorStop(0.6, tint(col, 0.06)); bar.addColorStop(1, tint(col, 0.02));
    g.fillStyle = bar; g.fillRect(x + 1, hy, w - 2, rowH);
    g.fillStyle = col; g.fillRect(x + 1, hy, 2, rowH);
    l.forEach((a, k) => {
      const y = Math.round(top + k * rowH - off);
      if (y < top - rowH || y > bottom) return;
      const p = clamp((this.tabT - k * 1.5) / 10, 0, 1), pe = 1 - (1 - p) ** 3;
      if (pe <= 0) return;
      g.globalAlpha = intro * pe;
      const ox = Math.round(this.dir * 12 * (1 - pe));
      this.drawRow(g, a, x + ox, y, w, k === this.sel);
    });
    g.globalAlpha = intro;
    g.restore();
    this.hit.rows = l.map((_, k) => {
      const y = top + k * rowH - this.scroll * rowH;
      return y >= top && y + rowH <= bottom ? { x0: x, x1: x + w, y0: y, y1: y + rowH } : { x0: 0, x1: -1, y0: 0, y1: -1 };
    });
    // Scroll thumb.
    if (l.length > rows) {
      const th = Math.max(8, (bottom - top) * rows / l.length), ty = top + (bottom - top - th) * this.fscroll / (l.length - rows);
      g.fillStyle = '#1c1f30'; g.fillRect(x + w - 3, top + 1, 1, bottom - top - 2);
      g.fillStyle = tint(col, 0.7); g.fillRect(x + w - 3, Math.round(ty), 1, Math.round(th));
    }
    if (hv.row < 0 && !l.length) { setFont(g, 10); textC(g, 'Nothing here yet.', x + w / 2, top + 30, '#5a6078', false); }
  },

  drawRow(g, a, x, y, w, sel) {
    const got = Achievements.has(a.id), hide = a.hidden && !got, tr = ACH_TIERS[a.tier];
    // Icon in a small frame: tier-colored when unlocked, slate when not.
    const fx = x + 5, fy = y + 2;
    g.fillStyle = got ? tr.dark : '#121522'; g.fillRect(fx, fy, 14, 14);
    g.strokeStyle = got ? tr.color : '#2a2e44'; g.lineWidth = 1; g.strokeRect(fx + 0.5, fy + 0.5, 13, 13);
    drawAchIcon(g, hide ? 'locked' : a.icon, fx + 3, fy + 3, 1, tr.color, got);
    if (got && (a.tier === 'gold' || a.tier === 'platinum')) this.glint(g, fx + 1, fy + 1, 12, 12, a.id);
    // Name, shortened to fit.
    setFont(g, 11);
    let name = hide ? '???' : a.name;
    const maxW = w - 30 - (Achievements.isNew(a.id) ? 18 : 0);
    while (g.measureText(name).width > maxW && name.length > 4) name = name.slice(0, -2) + '…';
    g.fillStyle = got ? (sel ? '#ffffff' : '#e6e8f4') : sel ? '#aab0c8' : '#7a8098';
    g.fillText(name, x + 23, y + 9);
    // Status line.
    setFont(g, 9);
    const pr = Achievements.progress(a);
    if (got) {
      const d = new Date(Achievements.got[a.id]);
      g.fillStyle = tr.color; g.fillText(tr.name, x + 23, y + 16);
      const tw = g.measureText(tr.name).width;
      g.fillStyle = '#6a7090'; g.fillText(`·  ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}`, x + 27 + tw, y + 16);
    } else if (pr && !hide) {
      const bw = 44;
      g.fillStyle = '#1c1f30'; g.fillRect(x + 23, y + 13, bw, 2);
      g.fillStyle = tint(tr.color, 0.75); g.fillRect(x + 23, y + 13, Math.round(bw * pr[0] / pr[1]), 2);
      g.fillStyle = '#6a7090'; g.fillText(this.fmtProgress(a, pr), x + 27 + bw, y + 16);
    } else {
      g.fillStyle = '#4a5068'; g.fillText(hide ? (a.cat === 'ending' ? 'Hidden ending' : 'Hidden') : 'Locked', x + 23, y + 16);
    }
    if (Achievements.isNew(a.id)) {
      const pulse = 0.6 + 0.4 * Math.sin(Game.frame * 0.15);
      g.globalAlpha *= pulse; setFont(g, 9); g.fillStyle = '#ff8ac6'; g.textAlign = 'right'; g.fillText('NEW', x + w - 6, y + 9); g.textAlign = 'left'; g.globalAlpha /= pulse;
    }
  },

  fmtProgress(a, [c, n]) {
    if (a.unit !== 'time') return `${c}/${n}`;
    const s = (f) => { const t = Math.floor(f / 60); return t >= 60 ? `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}` : `${t}s`; };
    return `${s(c)} / ${s(n)}`;
  },

  // A white sweep across a frame now and then, staggered per achievement so they don't all flash together.
  glint(g, x, y, w, h, seed) {
    let o = 0;
    for (const ch of seed) o += ch.charCodeAt(0);
    const k = ((Game.frame + o * 37) % 240) / 24;
    if (k > 1 || Game.options.calm) return;
    g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
    g.fillStyle = 'rgba(255,255,255,0.35)';
    const sx = x - 6 + k * (w + 12);
    for (let i = 0; i < h; i++) g.fillRect(Math.round(sx - i * 0.5), y + i, 2, 1);
    g.restore();
  },

  drawDetail(g, intro) {
    const l = this.list(), a = l[this.sel];
    const { detX: x, detW: w, top, rowH, rows } = ACH, bottom = top + rows * rowH;
    if (!a) return;
    const got = Achievements.has(a.id), hide = a.hidden && !got, tr = ACH_TIERS[a.tier], cx = x + w / 2;
    panel(g, x, top - 1, w, bottom - top + 2, got ? tr.color : '#3a3f5c');
    const p = clamp(this.selT / 12, 0, 1), pe = 1 - (1 - p) ** 3;
    g.globalAlpha = intro * pe;
    const dy = Math.round((1 - pe) * 4);

    // Big icon, with a halo when unlocked (and a ring of sparks for platinum).
    const iy = top + 6 + dy, ix = Math.round(cx - 15);
    if (got) {
      const halo = g.createRadialGradient(cx, iy + 15, 2, cx, iy + 15, 28);
      halo.addColorStop(0, tint(tr.color, 0.32 + 0.1 * Math.sin(Game.frame * 0.06))); halo.addColorStop(1, tint(tr.color, 0));
      g.fillStyle = halo; g.fillRect(x + 2, iy - 8, w - 4, 46);
      if (a.tier === 'platinum' && !Game.options.lowFx) {
        for (let i = 0; i < 6; i++) {
          const ang = Game.frame * 0.02 + i * Math.PI / 3, r = 21 + Math.sin(Game.frame * 0.05 + i) * 1.5;
          g.fillStyle = i % 2 ? '#ffffff' : tr.color;
          g.fillRect(Math.round(cx + Math.cos(ang) * r), Math.round(iy + 15 + Math.sin(ang) * r * 0.8), 1, 1);
        }
      }
    }
    g.fillStyle = got ? tr.dark : '#121522'; g.fillRect(ix, iy, 30, 30);
    g.strokeStyle = got ? tr.color : '#2a2e44'; g.lineWidth = 1; g.strokeRect(ix + 0.5, iy + 0.5, 29, 29);
    drawAchIcon(g, hide ? 'locked' : a.icon, ix + 3, iy + 3, 3, tr.color, got);
    if (got && (a.tier === 'gold' || a.tier === 'platinum')) this.glint(g, ix + 1, iy + 1, 28, 28, a.id);

    // Name and tier.
    let y = iy + 42;
    setFont(g, 13);
    for (const ln of wrap(g, hide ? '???' : a.name, w - 14)) { textC(g, ln, cx, y, got ? '#ffffff' : '#9aa0bc'); y += 11; }
    setFont(g, 9);
    const cat = ACH_TABS.find((tb) => tb.id === a.cat);
    textC(g, `${hide ? 'HIDDEN' : tr.name}  ·  ${cat.name}`, cx, y, hide ? '#6a7090' : got ? tr.color : tint(tr.color, 0.6), false);
    y += 11;

    // What to do (or, for a hidden one, a hint).
    setFont(g, 10);
    const desc = hide ? a.hint || 'Not yet found.' : a.desc;
    for (const ln of wrap(g, desc, w - 16)) { textC(g, ln, cx, y, hide ? '#9a8ab8' : '#c9cde0', false); y += 9; }

    // Bottom: Eli's note and the date, or progress, or just "Locked".
    if (got) {
      y += 3;
      g.fillStyle = tint(tr.color, 0.3); g.fillRect(cx - 20, y - 6, 40, 1);
      setFont(g, 10);
      const lines = wrap(g, a.note || '', w - 18).slice(0, Math.max(1, Math.floor((bottom - 14 - y) / 9) + 1));
      for (const ln of lines) { textC(g, ln, cx, y + 2, '#ffd9ec', false); y += 9; }
      const d = new Date(Achievements.got[a.id]);
      setFont(g, 9); textC(g, `Unlocked ${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`, cx, bottom - 4, '#6a7090', false);
    } else {
      const pr = Achievements.progress(a);
      if (pr && !hide) {
        const bw = w - 40, bx = Math.round(cx - bw / 2), by = bottom - 16;
        g.fillStyle = '#1c1f30'; g.fillRect(bx, by, bw, 4);
        g.fillStyle = tr.color; g.fillRect(bx, by, Math.round(bw * pr[0] / pr[1]), 4);
        g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(bx, by, Math.round(bw * pr[0] / pr[1]), 1);
        setFont(g, 9); textC(g, this.fmtProgress(a, pr), cx, bottom - 4, '#8a90a8', false);
      } else { setFont(g, 9); textC(g, hide ? 'Keep dreaming.' : 'Locked', cx, bottom - 4, '#4a5068', false); }
    }
    g.globalAlpha = intro;
  },

  drawFooter(g) {
    const hb = this.hover().back;
    OptionsScreen.arrow(g, 9 - (hb ? 1 : 0), H - 7, -1, hb ? '#ff8ac6' : '#8a90a8');
    setFont(g, 10); g.fillStyle = hb ? '#ffffff' : '#8a90a8'; g.fillText('Back', 15, H - 4);
    setFont(g, 9); g.textAlign = 'right'; g.fillStyle = '#6a7090';
    g.fillText('← → category    ↑ ↓ choose    X back', W - 8, H - 4);
    g.textAlign = 'left';
  },
};

// Endings gallery: the selected ending large on top, a row of cards below.
// Endings not found yet stay black rectangles. t counts frames since the selection changed.
const EndingArt = { panel: null };
function drawEndingGallery(g, sel, t) {
  g.fillStyle = 'rgba(5,6,12,0.94)'; g.fillRect(0, 0, W, H);
  const found = (e) => Achievements.has(e.end.ach);
  const count = ENDING_GALLERY.filter(found).length;
  setFont(g, 8, true); textC(g, `ENDINGS  ${count}/${ENDING_GALLERY.length}`, W / 2, 16, '#ffe9a8');
  if (!EndingArt.panel) EndingArt.panel = makeCanvas(160, 80);
  const pg = EndingArt.panel.getContext('2d');
  const scene = (e, tt) => { pg.clearRect(0, 0, 160, 80); Art.scene(pg, e.scene, tt); return EndingArt.panel; };

  const cur = ENDING_GALLERY[sel], open = found(cur);
  g.fillStyle = '#000'; g.fillRect(80, 24, 160, 80);
  if (open) g.drawImage(scene(cur, t), 80, 24);
  g.strokeStyle = open ? '#5a6488' : '#1c1f2e'; g.lineWidth = 1; g.strokeRect(79.5, 23.5, 161, 81);
  const [kind, name] = cur.end.title.split(': ');
  setFont(g, 9); textC(g, open ? kind : '???', W / 2, 115, open ? '#9aa0bc' : '#4a5068', false);
  setFont(g, 13); textC(g, open ? name : 'Not yet found.', W / 2, 127, open ? '#ffffff' : '#5a6078');

  const cw = 44, ch = 22, gap = 6, x0 = (W - (ENDING_GALLERY.length * cw + (ENDING_GALLERY.length - 1) * gap)) / 2, y = 138;
  ENDING_GALLERY.forEach((e, k) => {
    const x = x0 + k * (cw + gap);
    g.fillStyle = '#000'; g.fillRect(x, y, cw, ch);
    if (found(e)) g.drawImage(scene(e, 400 + Game.frame), x, y, cw, ch);
    if (k === sel) {
      const bob = Math.round(Math.sin(Game.frame * 0.15));
      g.strokeStyle = '#ff4d6d'; g.strokeRect(x - 1.5, y - 1.5, cw + 3, ch + 3);
      g.fillStyle = '#ff4d6d'; g.fillRect(x + cw / 2 - 1, y + ch + 4 + bob, 3, 3);
    } else { g.strokeStyle = found(e) ? '#3a4060' : '#15172280'; g.strokeRect(x - 0.5, y - 0.5, cw + 1, ch + 1); }
  });
  setFont(g, 9); textC(g, open ? '← → choose    C relive    X / Esc back' : '← → choose    X / Esc back', W / 2, H - 4, '#8a90a8', false);
}
