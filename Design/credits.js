'use strict';
// The credits, as a short film. A heart monitor finds its rhythm; Eli runs back through all four
// chapters while the names go by, passing the Echoes he met (lit up if he helped them); everyone he
// met lines up and the ribbon ties them together; the player's own night is tallied; he walks home
// with Mom in the morning; and it ends on whichever morning (or night) the last ending earned.
// Hold confirm to hurry it along, back to skip to the last shot. Names and lines live in CREDITS (ui.js).

const Credits = {
  T: 0, A: 1, scenes: [], save: null, done: false, dip: 0, fast: false,
  GY: 150, EX: 100, SPD: 1.2, TR: 60,
  PROPS: {
    1: ['chairs', 'plant', 'chairs', 'plant', 'chairs'],
    2: ['lamppost', 'bench', 'crate', 'antenna', 'phone'],
    3: ['bookpile', 'candle', 'globe', 'readlamp', 'lectern', 'bookpile'],
    4: ['monitor', 'iv', 'monitor', 'iv'],
    5: ['tree', 'bush', 'tree', 'bench', 'bush', 'lamppost'],
  },

  start(save) {
    this.save = save && save.frags ? save : null;
    this.echoes = (this.save && this.save.echoes) || {};
    this.endKey = this.save && this.save.done ? this.save.ending : null;
    // Spoilers (who Remi is, what the Hollow is) only once an ending has been seen.
    this.spoil = ENDING_GALLERY.some((e) => Achievements.has(e.end.ach));
    this.T = 0; this.done = false; this.dip = 0; this.fast = false;
    this.eli = { x: this.EX, y: this.GY, f: 'run0', vx: 2, vy: 0, dash: 0 };
    this.ribbon = Array.from({ length: 7 }, () => ({ x: this.EX - 2, y: this.GY - 6 }));
    const list = [
      { kind: 'open', len: 470 },
      { kind: 'run', ch: 1, len: 620, echo: 'walt' },
      { kind: 'run', ch: 2, len: 620, echo: 'juno' },
      { kind: 'run', ch: 3, len: 620, echo: 'hester' },
      { kind: 'run', ch: 4, len: 660, echo: 'pip', hollow: true },
      { kind: 'cast', len: CREDITS.cast.length * 100 + 300 },
    ];
    if (this.save) list.push({ kind: 'you', len: 620 });
    list.push({ kind: 'run', ch: 5, len: 760, walk: true });
    list.push({ kind: 'final', len: Infinity });
    let t = 0;
    for (const s of list) {
      s.start = t; t += s.len - this.TR;
      if (s.echo) s.meet = s.start + Math.round(s.len * 0.5);
      // Cards share the chapter evenly, after the location stamp has had a moment.
      const cards = (s.kind === 'run' && CREDITS.cards[s.ch]) || [];
      const from = 70, slot = (s.len - this.TR - from) / Math.max(1, cards.length);
      s.cards = cards.map((c, i) => ({ c, at: Math.round(from + i * slot), len: Math.round(slot - 24) }));
    }
    this.scenes = list;
  },

  sceneAt(T) { let s = this.scenes[0]; for (const x of this.scenes) if (x.start <= T) s = x; return s; },
  last() { return this.scenes[this.scenes.length - 1]; },

  // Returns true once, when the credits are over.
  update() {
    if (this.done) return false;
    const fin = this.last(), atEnd = this.T >= fin.start + this.TR;
    if (this.dip) {
      if (++this.dip === 24) this.T = fin.start + this.TR;
      if (this.dip >= 48) this.dip = 0;
      return false;
    }
    if (atEnd && (Input.pressed('back') || (Input.pressed('confirm') && this.T - fin.start > 240)) || (atEnd && this.T - fin.start > 3000)) {
      this.done = true;
      return true;
    }
    if (!atEnd && Input.pressed('back')) { Input.flush(); this.dip = 1; Sound.play('select'); return false; }
    this.fast = !atEnd && this.T > 30 && (Input.held('confirm') || Input.held('jump'));
    const n = this.fast ? 4 : 1;
    for (let i = 0; i < n; i++) this.tick(i === 0);
    return false;
  },

  tick(audible) {
    const T = ++this.T;
    this.pose(T);
    const e = this.eli, wind = Math.sin(T * 0.12) * 0.25;
    let px = e.x - 2, py = e.y - 6;
    for (let i = 0; i < this.ribbon.length; i++) {
      const k = this.ribbon[i];
      const tx = px - 1.3 - e.vx * 0.35, ty = py + 0.35 - e.vy * 0.2 + wind * (i / 3);
      k.x += (tx - k.x) * 0.55; k.y += (ty - k.y) * 0.55;
      px = k.x; py = k.y;
    }
    if (audible) this.sounds(T);
  },

  // Where Eli is and what he's doing. Shared by every scene drawn this frame, so crossfades line up.
  pose(T) {
    const s = this.sceneAt(T), e = this.eli, lt = T - s.start, oy = e.y;
    e.x = this.EX; e.y = this.GY; e.dash = 0;
    if (s.walk) { e.f = `run${((T / 11) | 0) % 4}`; e.vx = 0.7; e.x = this.EX + 12; }
    else {
      e.f = `run${((T / 5) | 0) % 4}`; e.vx = 2;
      const ph = (T + 60) % 230;
      if (ph < 34) { const p = ph / 34; e.y -= 56 * p * (1 - p); e.f = p < 0.5 ? 'jump' : 'fall'; }
      // In the Heart he dashes once, the way he learned to, and the Hollow falls back.
      if (s.hollow) {
        if (lt >= 460 && lt < 476) { e.f = 'dash'; e.y = this.GY - 2; e.x += (lt - 460) * 1.6; e.dash = 1; }
        else if (lt >= 476) e.x += 25.6 * Math.max(0, 1 - (lt - 476) / 100);
      }
    }
    e.vy = e.y - oy;
  },

  sounds(T) {
    for (const s of this.scenes) {
      const lt = T - s.start;
      if (lt < 0 || lt >= s.len) continue;
      if (s.kind === 'open') {
        // A beep each time the trace crosses a spike.
        for (let k = 0; k < 4; k++) { const sx = 40 + k * 80; if ((lt - 1) * 1.9 < sx && lt * 1.9 >= sx) Sound.tone(988, 0.09, 'sine', 0.03); }
      } else if (s.kind === 'you') {
        const r = Math.floor((lt - 40) / 45), d = (lt - 40) % 45;
        if (r >= 0 && r < 5 && d > 6 && d < 34 && d % 4 === 0) Sound.tone(1500 + r * 120, 0.025, 'square', 0.008);
      } else if (s.kind === 'final' && this.endKey !== 'stay' && lt > 60 && lt % 96 === 0) Sound.tone(988, 0.09, 'sine', 0.016);
    }
  },

  // ---------- Drawing helpers (alpha is always scaled by the scene's crossfade, this.A) ----------
  al(g, v) { g.globalAlpha = clamp(v, 0, 1) * this.A; },
  glow(g, x, y, r, color, a) {
    const op = g.globalCompositeOperation;
    g.globalCompositeOperation = 'lighter';
    this.al(g, a); g.drawImage(Art.glowSprite(r, color), Math.round(x - r), Math.round(y - r));
    g.globalCompositeOperation = op; this.al(g, 1);
  },
  // Text whose letters arrive one by one, each rising a few pixels as it fades in.
  spell(g, s, x, y, color, lt, rate = 3) {
    const w = g.measureText(s).width, base = g.globalAlpha;
    let cx = x - w / 2;
    g.textAlign = 'left';
    for (let i = 0; i < s.length; i++) {
      const a = clamp((lt - i * rate) / 14, 0, 1), cw = g.measureText(s[i]).width;
      if (a > 0 && s[i] !== ' ') {
        const yy = Math.round(y + (1 - a) * 4);
        g.globalAlpha = base * a;
        g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillText(s[i], cx + 0.5, yy + 0.5);
        g.fillStyle = color; g.fillText(s[i], cx, yy);
      }
      cx += cw;
    }
    g.globalAlpha = base;
  },
  stars(g, T, n, color, speed = 1) {
    for (let i = 0; i < n; i++) {
      const y = (hash(i, 1) * H - T * (0.1 + hash(i, 2) * 0.3) * speed) % H;
      this.al(g, 0.3 + 0.5 * hash(i, 5) * (0.6 + 0.4 * Math.sin(T * 0.05 + i)));
      g.fillStyle = color; g.fillRect((hash(i, 3) * W) | 0, ((y + H) % H) | 0, 1 + ((hash(i, 4) * 1.6) | 0), 1);
    }
    this.al(g, 1);
  },
  // A centred line of dialogue at the bottom of the frame: NAME  line.
  subtitle(g, name, color, text, lt, len) {
    const a = Math.min(clamp(lt / 20, 0, 1), clamp((len - lt) / 20, 0, 1));
    if (a <= 0) return;
    setFont(g, 11);
    const nw = g.measureText(`${name}  `).width, tw = g.measureText(text).width, x = Math.round(W / 2 - (nw + tw) / 2), y = H - 9;
    this.al(g, a * 0.7); g.fillStyle = '#05060c'; g.fillRect(x - 6, y - 9, nw + tw + 12, 12);
    this.al(g, a); g.textAlign = 'left';
    g.fillStyle = color; g.fillText(name, x, y);
    g.fillStyle = '#e6e8f4'; g.fillText(text, x + nw, y);
    this.al(g, 1);
  },
  ease(p) { p = clamp(p, 0, 1); return 1 - (1 - p) ** 3; },

  // ---------- Frame ----------
  draw(g) {
    const T = this.T, wt = World.t;
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    World.t = T; // animated props read the world clock
    for (const s of this.scenes) {
      const lt = T - s.start;
      if (lt < 0 || lt >= s.len) continue;
      this.A = clamp(lt / this.TR, 0, 1);
      g.globalAlpha = this.A;
      if (s.kind === 'open') this.drawOpen(g, s, lt, T);
      else if (s.kind === 'run') this.drawRun(g, s, lt, T);
      else if (s.kind === 'cast') this.drawCast(g, s, lt, T);
      else if (s.kind === 'you') this.drawYou(g, s, lt, T);
      else this.drawFinal(g, s, lt, T);
    }
    World.t = wt;
    this.A = 1; g.globalAlpha = 1;
    g.drawImage(Art.vignette, 0, 0);
    // Hurrying, and how to.
    if (this.fast) {
      setFont(g, 9); g.globalAlpha = 0.6 + 0.3 * Math.sin(Game.frame * 0.3);
      g.fillStyle = '#eef1ff'; g.textAlign = 'right'; g.fillText('▸▸', W - 6, 10); g.textAlign = 'left';
    }
    const hint = clamp(Math.min((T - 60) / 30, (360 - T) / 40), 0, 1);
    if (hint > 0) { g.globalAlpha = hint * 0.55; setFont(g, 9); g.textAlign = 'right'; g.fillStyle = '#8a90b0'; g.fillText('hold C to hurry   Esc to skip', W - 6, H - 4); g.textAlign = 'left'; }
    if (this.dip) { g.globalAlpha = 1; g.fillStyle = `rgba(5,6,12,${this.dip < 24 ? this.dip / 24 : (48 - this.dip) / 24})`; g.fillRect(0, 0, W, H); }
    g.globalAlpha = 1;
  },

  // ---------- 1. A heartbeat in the dark, then the title ----------
  drawOpen(g, s, lt, T) {
    const R = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
    R(0, 0, W, H, '#030308');
    this.stars(g, T, 40, '#7a76a0', 0.6);
    // The trace: flat, then a spike every 80 pixels.
    const SPIKE = [-1, -6, -14, -17, 8, 4, 0, -2, -1], base = 96, head = Math.min(W, lt * 1.9);
    const ecg = (x) => { const d = Math.round(((((x - 40) % 80) + 80) % 80 + 40) % 80 - 40); return base + (d >= -4 && d <= 4 ? SPIKE[d + 4] : 0); };
    this.al(g, 1 - 0.8 * clamp((lt - 200) / 90, 0, 1));
    g.strokeStyle = '#3fd17a'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, base + 0.5);
    for (let x = 0; x <= head; x++) g.lineTo(x + 0.5, ecg(x) + 0.5);
    g.stroke();
    if (head < W) this.glow(g, head, ecg(head), 10, '#7aff9a', 0.7);
    this.al(g, 1);
    // BEYOND SLEEP drops in letter by letter, with red and blue ghosts that settle.
    const text = 'BEYOND SLEEP';
    setFont(g, 16, true);
    const cw = g.measureText(text).width / text.length, x0 = W / 2 - (cw * text.length) / 2;
    if (lt > 180) this.glow(g, W / 2, 70, 80, '#5a3a80', 0.35 * clamp((lt - 180) / 80, 0, 1));
    g.textAlign = 'left';
    for (let i = 0; i < text.length; i++) {
      if (text[i] === ' ') continue;
      const p = clamp((lt - 180 - i * 4) / 30, 0, 1), e = this.ease(p);
      if (p <= 0) continue;
      const lx = x0 + i * cw, y = Math.round(76 + Math.sin(T * 0.04 + i * 0.45) * 1.5 - (1 - e) * 14), split = Math.round((1 - e) * 4) + 1;
      this.al(g, e * 0.5); g.fillStyle = '#ff4d6d'; g.fillText(text[i], lx + split, y);
      this.al(g, e * 0.4); g.fillStyle = '#5a8cff'; g.fillText(text[i], lx - split, y);
      this.al(g, e); g.fillStyle = 'rgba(0,0,0,0.7)'; g.fillText(text[i], lx + 1, y + 2);
      g.fillStyle = '#dfe4ff'; g.fillText(text[i], lx, y);
    }
    this.al(g, 1);
    const sub = 'a story about waking up', n = clamp(Math.floor((lt - 270) / 2), 0, sub.length);
    setFont(g, 11);
    if (n > 0) textC(g, sub.slice(0, n), W / 2, 92, '#9fb4ff');
    // The four suits, one per chapter.
    ['club', 'spade', 'diamond', 'heart'].forEach((k, i) => {
      const a = clamp((lt - 330 - i * 16) / 20, 0, 1);
      if (a <= 0) return;
      this.al(g, a);
      drawAchIcon(g, k, Math.round(W / 2 - 34 + i * 18), Math.round(104 + (1 - a) * 4), 1, CHAPTERS[i + 1].color, true);
    });
    this.al(g, 1);
  },

  // ---------- 2. The run back through the chapters (and, slower, the walk home) ----------
  drawRun(g, s, lt, T) {
    const ch = s.ch, P = PAL[ch], L = Art.layersFor(ch), BW = L.mid.width, GY = this.GY;
    const scroll = s.walk ? T * 0.5 : T * this.SPD, calm = Game.options.calm, low = Game.options.lowFx;
    const R = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w, h); };
    const wrapX = (v, m) => ((v % m) + m) % m;
    const tile = (c, f, y) => { const o = -Math.floor(wrapX(scroll * f, BW)); g.drawImage(c, o, y); g.drawImage(c, o + BW, y); };
    g.drawImage(L.far, -32, -12);
    // Sky.
    if (ch === 1 && !calm && T % 523 < 7) { this.al(g, (7 - (T % 523)) / 7 * 0.22); R(0, 0, W, GY, '#c8f0ff'); this.al(g, 1); }
    if (ch === 4) {
      const t = (T % 66) / 66, b = Math.max(0, 1 - t * 9) + 0.6 * Math.max(0, 1 - Math.abs(t - 0.22) * 9), sc = 1 + b * 0.06;
      g.save(); g.translate(W / 2, 70); g.scale(sc, sc);
      this.al(g, 0.16 + b * 0.22); g.fillStyle = '#ff2a4a';
      g.beginPath(); g.arc(-22, -10, 26, Math.PI, 0); g.arc(22, -10, 26, Math.PI, 0); g.lineTo(0, 46); g.closePath(); g.fill();
      g.restore();
      this.al(g, 0.35); g.strokeStyle = '#ff7896'; g.lineWidth = 1; g.beginPath();
      for (let x = 0; x <= W; x += 2) {
        const ph = ((x + T * 2) % 160) / 160;
        let y = 24;
        if (ph > 0.4 && ph < 0.44) y -= 12; else if (ph >= 0.44 && ph < 0.48) y += 8; else if (ph > 0.6 && ph < 0.66) y -= 3;
        if (x === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.stroke(); this.al(g, 1);
    }
    if (ch === 5) {
      for (let k = 0; k < 5; k++) {
        const x = wrapX(hash(k, 1) * (W + 90) + T * (0.08 + hash(k, 3) * 0.12), W + 90) - 70, y = 16 + hash(k, 2) * 44, w = 30 + hash(k, 4) * 30;
        this.al(g, 0.5); R(x, y, w, 4, '#fff0e6'); R(x + 4, y - 3, w - 12, 3, '#fff0e6'); R(x + 10, y - 5, w / 3, 2, '#fff0e6');
        R(x + 2, y + 4, w - 4, 1, '#ffc8b4');
      }
      // Birds, heading the same way.
      for (let k = 0; k < 3; k++) {
        const bx = wrapX(hash(k, 9) * W + T * 0.45, W + 40) - 20, by = 30 + k * 9 + Math.sin(T * 0.05 + k) * 3, f = ((T >> 3) + k) % 2;
        this.al(g, 0.8); R(bx, by, 1, 1, '#4a3a4a'); R(bx - 2, by - f, 2, 1, '#4a3a4a'); R(bx + 1, by - f, 2, 1, '#4a3a4a');
      }
      this.al(g, 1);
    }
    tile(L.mid, 0.25, -26);
    // Pieces of the city falling up.
    if (ch === 2) {
      for (let k = 0; k < (low ? 4 : 7); k++) {
        const w = 10 + ((hash(k, 1) * 16) | 0), h = 8 + ((hash(k, 2) * 14) | 0), v = 0.15 + hash(k, 3) * 0.3;
        const x = wrapX(hash(k, 4) * (W + 60) - scroll * 0.15, W + 60) - 30, y = H + 20 - ((T * v + hash(k, 5) * 400) % (H + 60));
        R(x, y, w, h, '#1b2148'); R(x, y, w, 1, '#2a3266');
        for (let j = 0; j < 4; j++) if (hash(k, j + 10) > 0.4) R(x + 2 + ((hash(k, j + 20) * (w - 4)) | 0), y + 2 + ((hash(k, j + 30) * (h - 4)) | 0), 1, 1, '#ffd36b');
        this.al(g, 0.3); R(x + w / 2, y + h, 1, 3 + ((T >> 3) % 3), '#a0b4ff'); this.al(g, 1);
      }
    }
    // Lost pages, drifting between the shelves.
    if (ch === 3) {
      for (let k = 0; k < 6; k++) {
        const x = wrapX(hash(k, 1) * (W + 40) - scroll * 0.4, W + 40) - 20, y = 34 + hash(k, 2) * 70 + Math.sin(T * 0.02 + k * 2) * 6, f = ((T >> 3) + k) % 2;
        this.al(g, 0.75); R(x, y, 4, f ? 3 : 2, '#f4ead0'); R(x + (f ? 3 : 0), y, 1, f ? 3 : 2, '#c8b890');
      }
      this.al(g, 1);
    }
    tile(L.near, 0.55, -26);
    // St. Brigid's, where all of this happened, going by on the walk home.
    if (s.walk) {
      const hx = 0.5 * (s.start + 380) + 60 - scroll;
      if (hx > -60 && hx < W + 10) { g.save(); g.translate(Math.round(hx), GY); Art.drawProp(g, { kind: 'hospital', x: 0, y: 0, c: 3, r: -1 }, true); g.restore(); this.al(g, 1); }
    }
    // Props along the way.
    const echoW = s.echo ? this.SPD * s.meet + this.EX : -1e9, list = this.PROPS[ch];
    for (let k = Math.floor((scroll - 80) / 74); k * 74 < scroll + W + 40; k++) {
      const wx = k * 74 + hash(k, ch) * 30, x = Math.round(wx - scroll);
      if (Math.abs(wx - echoW) < 40) continue;
      if (s.walk && Math.abs(wx - (0.5 * (s.start + 380) + 60) - 20) < 60) continue;
      const p = { kind: list[(hash(k, ch + 9) * list.length) | 0], x: 0, y: 0, c: k, r: -1 };
      g.save(); g.translate(x, GY); Art.drawProp(g, p, true); this.al(g, 1);
      // The lectern's glow sets its own alpha, so it waits for the fade to finish.
      if (p.kind !== 'lectern' || this.A >= 1) Art.drawProp(g, p, false);
      g.restore();
      this.al(g, 1);
    }
    if (s.echo) this.drawEcho(g, s, T);
    // Ground.
    R(0, GY, W, H - GY, P.deep); R(0, GY, W, 1, P.top); R(0, GY + 1, W, 2, P.base); R(0, GY + 3, W, 5, P.mid); R(0, GY + 8, W, 6, P.dark);
    for (let wx = Math.floor(scroll / 16) * 16; wx < scroll + W + 16; wx += 16) {
      const x = Math.round(wx - scroll), h = hash(wx, ch);
      R(x, GY + 3, 1, 11, P.dark);
      if (h > 0.5) R(x + 5, GY + 5, 2, 1, P.base);
      if (h > 0.7) R(x + 10, GY + 10, 1, 1, P.mid);
      if (ch === 5 && h > 0.3) { R(x + 3, GY - 1, 1, 1, P.top); R(x + 4, GY - 2, 1, 2, P.top); if (h > 0.85) R(x + 12, GY - 2, 1, 1, '#ff8ab0'); }
    }
    if (s.hollow) this.drawHollow(g, lt, T);
    if (s.walk) {
      // Mom, a step behind, keeping up.
      const mb = ((T / 11) | 0) % 2;
      Sprites.draw(g, 'mom', T % 200 < 8 ? 'blink' : 'idle0', this.EX - 4, GY - mb);
    }
    this.drawEli(g, T);
    // Weather in front of everything.
    if (ch === 1 || ch === 2) {
      g.fillStyle = '#aac8e6';
      for (let i = 0; i < (low ? 30 : 64); i++) {
        const x = wrapX(hash(i, 1) * (W + 60) - T * 1.4 - scroll * 0.3, W + 60) - 30, y = wrapX(hash(i, 2) * H + T * (5 + hash(i, 3) * 2), H + 10) - 10;
        this.al(g, ch === 1 ? 0.35 : 0.22); g.fillRect(Math.round(x), Math.round(y), 1, 3); g.fillRect(Math.round(x) - 1, Math.round(y) + 3, 1, 2);
      }
      this.al(g, 1);
    } else {
      const col = P.mote, n = low ? 14 : 30;
      for (let i = 0; i < n; i++) {
        const x = wrapX(hash(i, 1) * (W + 20) - scroll * (0.6 + hash(i, 4) * 0.6) + Math.sin(T * 0.02 + i) * 6, W + 20) - 10;
        const y = ch === 4 ? wrapX(hash(i, 2) * H - T * (0.2 + hash(i, 3) * 0.4), H) : wrapX(hash(i, 2) * GY + Math.sin(T * 0.015 + i * 3) * 10 - T * 0.08, GY);
        this.al(g, 0.25 + 0.45 * hash(i, 5) * (0.5 + 0.5 * Math.sin(T * 0.06 + i)));
        g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), 1, 1);
      }
      this.al(g, 1);
    }
    // The Heart glitches as he gets closer to waking.
    if (ch === 4 && !calm && !low && hash((T >> 2), 9) > 0.92) { this.al(g, 0.25); R(0, (hash(T >> 2, 3) * GY) | 0, W, 2, '#ff4d6d'); this.al(g, 1); }
    // Where we are, typed out in the corner.
    const c = CHAPTERS[ch], stamp = `${c.suit}  ${c.title}`, n = clamp(Math.floor((lt - 24) / 2), 0, stamp.length);
    if (n > 0) {
      this.al(g, clamp((300 - lt) / 40, 0, 1));
      setFont(g, 11); g.textAlign = 'left';
      g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillText(stamp.slice(0, n), 8.5, 14.5);
      g.fillStyle = c.color; g.fillText(stamp.slice(0, n), 8, 14);
      this.al(g, 1);
    }
    for (const k of s.cards) if (lt >= k.at && lt < k.at + k.len) this.drawCard(g, k.c, lt - k.at, k.len, ch === 5 ? '#ffe9a8' : c.color);
    if (s.hollow) this.subtitle(g, 'HOLLOW', '#ff4d6d', CREDITS.hollowLine, lt - 50, 220);
    if (s.echo && this.echoes[s.echo] !== undefined) {
      const e = CREDITS.echoes[s.echo];
      this.subtitle(g, s.echo.toUpperCase(), this.castColor(s.echo), this.echoes[s.echo] ? e.helped : e.not, T - s.meet + 10, 250);
    }
  },

  castColor(id) { const c = CREDITS.cast.find((m) => m.id === id); return c ? c.color : '#eef1ff'; },

  // An Echo stands where Eli left them. If he helped them, they take on their real colours as he passes.
  drawEcho(g, s, T) {
    const k = s.echo, st = this.echoes[k], x = this.EX + (s.meet - T) * this.SPD;
    if (x < -20 || x > W + 20) return;
    const turned = st === true ? clamp((T - s.meet + 16) / 40, 0, 1) : 0, y = this.GY;
    this.glow(g, x, y - 8, 14, st === true ? '#ffe9a8' : '#c9c2ec', 0.12 + turned * 0.15);
    this.al(g, (st === false ? 0.55 : 0.85) * (1 - turned));
    Sprites.draw(g, k, 'idle0', x, y - Math.round(Math.sin(T * 0.04) * 0.6), x < this.EX);
    if (turned > 0) {
      this.al(g, turned); Sprites.draw(g, `${k}@real`, 'idle0', x, y, x < this.EX);
      if (turned < 1) {
        // A ring of sparks as they come back to themselves.
        const r = 4 + turned * 16;
        this.al(g, 1 - turned); g.fillStyle = '#fff6d0';
        for (let i = 0; i < 10; i++) { const a = i * 0.628 + turned; g.fillRect(Math.round(x + Math.cos(a) * r), Math.round(y - 8 + Math.sin(a) * r * 0.8), 1, 1); }
      }
    }
    this.al(g, 1);
  },

  drawHollow(g, lt, T) {
    const enter = clamp(lt / 80, 0, 1), back = lt > 476 ? 34 * Math.min(1, (lt - 476) / 50) : 0;
    const x = Math.round(this.EX - 50 - (1 - this.ease(enter)) * 60 + Math.sin(lt * 0.021) * 10 - back), y = this.GY;
    const f = `run${(((T / 5) | 0) + 2) % 4}`;
    // Smoke peeling off it.
    for (let k = 0; k < 10; k++) {
      const p = ((T * 0.9 + k * 13) % 40) / 40;
      this.al(g, (1 - p) * 0.5); g.fillStyle = k % 3 ? '#1a0c1e' : '#2c1434';
      g.fillRect(Math.round(x - 3 - p * 16 + Math.sin(T * 0.1 + k) * 2), Math.round(y - 4 - p * 10 - hash(k, 2) * 8), 2, 2);
    }
    const jit = !Game.options.calm && hash(T >> 2, 5) > 0.9 ? 1 : 0;
    this.al(g, 0.92); Sprites.draw(g, 'hollow', f, x + jit, y);
    this.glow(g, x + 2, y - 11, 6, '#ff2a4a', 0.35 + 0.15 * Math.sin(T * 0.2));
    this.al(g, 1);
  },

  drawEli(g, T) {
    const e = this.eli, r = this.ribbon, n = r.length;
    if (e.dash) {
      for (let k = 1; k <= 4; k++) { this.al(g, 0.5 - k * 0.1); Sprites.draw(g, 'eli_ghost', 'dash', Math.round(e.x - k * 5), Math.round(e.y)); }
      this.al(g, 1);
    }
    for (let i = n - 1; i >= 0; i--) {
      const k = r[i];
      g.fillStyle = e.dash ? '#ffffff' : i === n - 1 || i % 2 ? '#ff4d6d' : '#ffb0bc';
      g.fillRect(Math.round(k.x), Math.round(k.y), i < 2 ? 2 : 1, i < 2 ? 2 : 1);
      if (i === n - 1) g.fillRect(Math.round(k.x), Math.round(k.y) + 1, 1, 1);
    }
    Sprites.draw(g, 'eli', e.f, Math.round(e.x), Math.round(e.y));
  },

  // A credit card: a heading in the chapter's colour between two rules, then the names.
  drawCard(g, card, lt, len, color) {
    const fin = clamp(lt / 30, 0, 1), fout = clamp((len - lt) / 30, 0, 1), a = Math.min(fin, fout);
    const lines = typeof card.body === 'function' ? card.body() : card.body, y0 = 40;
    this.al(g, a);
    setFont(g, 6, true);
    const hw = g.measureText(card.head).width / 2, rule = Math.round(26 * this.ease(lt / 40));
    textC(g, card.head, W / 2, y0, color);
    g.fillStyle = color;
    g.fillRect(Math.round(W / 2 - hw - 8 - rule), y0 - 3, rule, 1); g.fillRect(Math.round(W / 2 + hw + 8), y0 - 3, rule, 1);
    if (rule > 2) { diamond(g, W / 2 - hw - 10 - rule, y0 - 2.5, 1.5, 2, color); diamond(g, W / 2 + hw + 10 + rule, y0 - 2.5, 1.5, 2, color); }
    lines.forEach((ln, i) => {
      const la = clamp((lt - 16 - i * 14) / 24, 0, 1) * fout;
      if (la <= 0) return;
      if (card.big) {
        setFont(g, 16);
        this.al(g, fout); this.spell(g, ln, W / 2, y0 + 20 + i * 16, '#ffffff', lt - 16 - i * 14);
      } else {
        setFont(g, 13);
        this.al(g, la); textC(g, ln, W / 2, Math.round(y0 + 18 + i * 12 + (1 - la) * 3), i === 0 ? '#eef1ff' : '#c8cce0');
      }
    });
    this.al(g, 1);
  },

  // ---------- 3. Everyone he met, in a row, tied together ----------
  drawCast(g, s, lt, T) {
    const cast = CREDITS.cast, n = cast.length, gap = 36, x0 = W / 2 - ((n - 1) * gap) / 2, base = 120, last = 50 + n * 100;
    const R = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w, h); };
    R(0, 0, W, H, '#07050e');
    const sky = g.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, 'rgba(20,12,40,0)'); sky.addColorStop(1, 'rgba(60,30,90,0.45)');
    g.fillStyle = sky; g.fillRect(0, 0, W, H);
    this.stars(g, T, 60, '#b7b0d8');
    this.al(g, clamp(lt / 40, 0, 1));
    setFont(g, 8, true); textC(g, 'THE SLEEPERS', W / 2, 22, '#ffe9a8');
    setFont(g, 9); textC(g, 'and the people who waited with them', W / 2, 33, '#8a90b0', false);
    this.al(g, 0.4); R(16, base + 1, W - 32, 1, '#3a3060'); this.al(g, 1);
    const hands = [];
    cast.forEach((m, i) => {
      const at = 50 + i * 100, k = clamp((lt - at) / 30, 0, 1), x = Math.round(x0 + i * gap);
      hands.push([x, base - 13]);
      if (k <= 0) return;
      // A beam of light from nowhere (or, for the Hollow, a pool of dark).
      const col = hex(m.color);
      if (m.id === 'hollow') {
        this.al(g, k * 0.6); g.fillStyle = '#000000';
        g.beginPath(); g.ellipse(x, base, 15, 4, 0, 0, 7); g.fill();
      } else {
        const beam = g.createLinearGradient(0, 40, 0, base);
        beam.addColorStop(0, rgb(col, 0)); beam.addColorStop(1, rgb(col, 0.22));
        g.globalCompositeOperation = 'lighter'; this.al(g, k);
        g.fillStyle = beam; g.beginPath(); g.moveTo(x - 4, 40); g.lineTo(x + 4, 40); g.lineTo(x + 15, base + 2); g.lineTo(x - 15, base + 2); g.closePath(); g.fill();
        g.fillStyle = rgb(col, 0.25); g.beginPath(); g.ellipse(x, base + 1, 15, 3, 0, 0, 7); g.fill();
        g.globalCompositeOperation = 'source-over';
      }
      const e = this.ease(k), y = Math.round(base - (1 - e) * 10);
      let spr = m.id, fr = 'idle0';
      if (m.id === 'eli' || m.id === 'remi' || m.id === 'hollow') fr = (T + i * 20) % 64 < 32 ? 'idle0' : 'idle1';
      if (m.id === 'mom') fr = T % 190 < 8 ? 'blink' : 'idle0';
      if (['walt', 'juno', 'hester', 'pip'].includes(m.id) && this.echoes[m.id] === true) spr = `${m.id}@real`;
      const jit = m.id === 'hollow' && !Game.options.calm && hash(T >> 2, i) > 0.92 ? 1 : 0;
      this.al(g, e); Sprites.draw(g, spr, fr, x + jit, y, false, 2, 2);
      if (m.id === 'hollow') this.glow(g, x + 3, y - 21, 8, '#ff2a4a', e * (0.3 + 0.1 * Math.sin(T * 0.15)));
      this.al(g, e); setFont(g, 9); textC(g, m.name, x, base + 11, m.color);
    });
    // Who each one is, one at a time.
    const i = clamp(Math.floor((lt - 50) / 100), 0, n - 1), d = lt - 50 - i * 100, m = cast[i];
    const da = lt < 50 ? 0 : Math.min(clamp((d - 8) / 20, 0, 1), i < n - 1 ? clamp((100 - d) / 12, 0, 1) : clamp((last + 40 - lt) / 20, 0, 1));
    if (da > 0) {
      this.al(g, da);
      setFont(g, 6, true); textC(g, m.full || m.name, W / 2, 148, m.color);
      setFont(g, 13); textC(g, (this.spoil && m.after) || m.line, W / 2, 163, '#e6e8f4');
    }
    // Then the ribbon, threaded from hand to hand.
    const p = clamp((lt - last) / 110, 0, 1);
    if (p > 0) {
      const sag = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t + Math.sin(t * Math.PI) * 5 + Math.sin(T * 0.05 + a[0]) * 0.6];
      const total = (n - 1) * p;
      this.al(g, 1); g.fillStyle = '#ff3b5c';
      for (let j = 0; j < n - 1; j++) {
        const upto = clamp(total - j, 0, 1);
        for (let t = 0; t <= upto; t += 1 / gap) { const [px, py] = sag(hands[j], hands[j + 1], t); g.fillRect(Math.round(px), Math.round(py), 1, 1); }
      }
      const [hx, hy] = (() => { const j = Math.min(n - 2, Math.floor(total)); return sag(hands[j], hands[j + 1], total - j); })();
      if (p < 1) this.glow(g, hx, hy, 6, '#ff8ab0', 0.6);
      this.al(g, clamp((lt - last - 120) / 40, 0, 1));
      setFont(g, 13); textC(g, CREDITS.castCoda, W / 2, 163, '#ffd6de');
    }
    this.al(g, 1);
  },

  // ---------- 4. The player's own night ----------
  drawYou(g, s, lt, T) {
    const sv = this.save, R = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w, h); };
    R(0, 0, W, H, '#06070f');
    this.stars(g, T, 40, '#9a96c0', 0.5);
    this.al(g, clamp(lt / 40, 0, 1));
    setFont(g, 8, true); textC(g, sv.done ? 'YOUR NIGHT IN THE BETWEEN' : 'YOUR NIGHT, SO FAR', W / 2, 26, '#ffe9a8');
    const frags = Object.keys(sv.frags || {}).length, helped = ['walt', 'juno', 'hester', 'pip'].filter((k) => this.echoes[k] === true);
    const rows = [
      ['TIME ASLEEP', (e) => fmtTime(Math.round((sv.time || 0) * e))],
      ['TIMES YOU GOT BACK UP', (e) => `${Math.round((sv.deaths || 0) * e)}`],
      ['MEMORIES CARRIED', (e) => `${Math.round(frags * e)}/${TOTAL_FRAGMENTS}`],
      ['ECHOES HELPED', (e) => `${Math.round(helped.length * e)}/4`],
      ['ACHIEVEMENTS', (e) => `${Math.round(Achievements.count() * e)}/${ACHIEVEMENTS.length}`],
    ];
    rows.forEach(([label, val], r) => {
      const at = 40 + r * 45, a = clamp((lt - at) / 16, 0, 1), e = this.ease((lt - at - 6) / 28), y = 52 + r * 18;
      if (a <= 0) return;
      this.al(g, a * 0.35); R(36, y + 4, W - 72, 1, '#3a3f5c');
      this.al(g, a);
      setFont(g, 11); g.textAlign = 'left'; g.fillStyle = '#9aa0bc'; g.fillText(label, 40, y);
      setFont(g, 13); g.textAlign = 'right'; g.fillStyle = '#eef1ff'; g.fillText(val(e), W - 40, y); g.textAlign = 'left';
      if (r === 2) {
        // One shard per memory, lit if he carried it.
        for (let k = 0; k < TOTAL_FRAGMENTS; k++) {
          const lit = k < Math.round(frags * e), dx = 140 + k * 5;
          diamond(g, dx, y - 4, 1.8, 2.6, lit ? '#7ff6ff' : '#2a3048');
          if (lit && !Game.options.lowFx) this.glow(g, dx, y - 4, 4, '#7ff6ff', a * 0.25);
          this.al(g, a);
        }
      } else if (r === 3) {
        ['walt', 'juno', 'hester', 'pip'].forEach((k, j) => {
          const on = helped.includes(k) && e > 0.5;
          this.al(g, a * (on ? 1 : 0.4)); Sprites.draw(g, on ? `${k}@real` : k, 'idle0', 160 + j * 16, y + 3);
        });
        this.al(g, a);
      }
    });
    if (sv.done && ENDINGS[sv.ending]) {
      const a = clamp((lt - 290) / 30, 0, 1);
      this.al(g, a); setFont(g, 6, true); textC(g, ENDINGS[sv.ending].title, W / 2, 152, '#ffe9a8');
      this.al(g, clamp((lt - 340) / 30, 0, 1)); setFont(g, 11);
      textC(g, sv.deaths ? `${sv.deaths} falls. You got up from every one.` : 'Not a single fall. Show-off.', W / 2, 166, '#8a90b0', false);
    }
    this.al(g, 1);
  },

  // ---------- 5. The last shot: whichever morning the ending earned ----------
  drawFinal(g, s, lt, T) {
    if (this.endKey === 'stay') { this.drawNight(g, lt, T); return; }
    const cold = this.endKey === 'hollow', k = this.ease(lt / 700);
    const R = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w, h); };
    const mix = (a, b) => rgb(mixc(hex(a), hex(b), k));
    // The room.
    R(0, 0, W, H, cold ? mix('#0e1016', '#262c36') : mix('#110b16', '#3a2834'));
    for (let x = 6; x < W; x += 22) { this.al(g, 0.25); R(x, 0, 1, 150, cold ? '#1a1e28' : '#22161e'); }
    this.al(g, 1);
    // The window and the sky through it.
    const wx = 110, wy = 16, ww = 100, wh = 82;
    const sky = g.createLinearGradient(0, wy, 0, wy + wh);
    sky.addColorStop(0, cold ? mix('#0a1020', '#7088a8') : mix('#0a1430', '#5a7ac0'));
    sky.addColorStop(1, cold ? mix('#141c2c', '#b8c0c8') : mix('#1c2a48', '#ffc890'));
    g.fillStyle = sky; g.fillRect(wx, wy, ww, wh);
    g.save(); g.beginPath(); g.rect(wx, wy, ww, wh); g.clip();
    this.glow(g, wx + ww / 2, wy + wh + 10 - k * 34, 40, cold ? '#c8d0e0' : '#ffd8a0', 0.5 * k);
    g.fillStyle = cold ? '#e8ecf4' : '#fff6e0'; g.beginPath(); g.arc(wx + ww / 2, wy + wh + 12 - k * 36, 10, 0, 7); g.fill();
    for (let x = 0; x < ww; x += 9) { const h = 6 + hash(x, 7) * 18; R(wx + x, wy + wh - h, 8, h, cold ? mix('#0a0e18', '#4a5260') : mix('#0a0e1c', '#7a5068')); }
    // Birds crossing, once the sun is up.
    if (k > 0.5) for (let j = 0; j < 2; j++) { const bx = wx + ((lt * 0.3 + j * 40) % (ww + 20)) - 10, by = wy + 24 + j * 8, f = (lt >> 3) % 2; R(bx, by, 1, 1, '#3a2a3a'); R(bx - 2, by - f, 2, 1, '#3a2a3a'); R(bx + 1, by - f, 2, 1, '#3a2a3a'); }
    // In the glass, for a moment, a girl with a red ribbon.
    if (this.endKey === 'true') {
      const ra = clamp((lt - 420) / 80, 0, 1) * clamp((760 - lt) / 80, 0, 1);
      if (ra > 0) { this.al(g, ra * 0.3); Sprites.draw(g, 'remi', (lt >> 5) % 2 ? 'idle1' : 'idle0', wx + 30, wy + wh - 6); this.al(g, 1); }
    }
    g.restore();
    const frame = cold ? '#161a22' : '#1c1420';
    R(wx - 3, wy - 3, ww + 6, 3, frame); R(wx - 3, wy + wh, ww + 6, 3, frame); R(wx - 3, wy, 3, wh, frame); R(wx + ww, wy, 3, wh, frame);
    R(wx + ww / 2 - 1, wy, 2, wh, frame); R(wx, wy + wh / 2 - 1, ww, 2, frame);
    R(wx - 6, wy + wh + 3, ww + 12, 3, cold ? mix('#20242c', '#5a6068') : mix('#2a1c22', '#6a5048'));
    // Curtains.
    for (const cx of [wx - 14, wx + ww + 4]) { R(cx, wy - 6, 10, wh + 14, cold ? mix('#1a2030', '#4a5468') : mix('#1e2438', '#5a6a8a')); for (let j = 2; j < 10; j += 3) R(cx + j, wy - 6, 1, wh + 14, cold ? '#141824' : '#161a2a'); }
    // Light through the window, across the floor.
    g.globalCompositeOperation = 'lighter';
    const shaft = g.createLinearGradient(0, wy + wh, 0, 150);
    shaft.addColorStop(0, rgb(hex(cold ? '#a0b0c8' : '#ffd8a0'), 0.16 * k)); shaft.addColorStop(1, rgb(hex(cold ? '#a0b0c8' : '#ffd8a0'), 0.04 * k));
    this.al(g, 1); g.fillStyle = shaft;
    g.beginPath(); g.moveTo(wx, wy + wh); g.lineTo(wx + ww, wy + wh); g.lineTo(wx + ww + 60, 150); g.lineTo(wx + 20, 150); g.closePath(); g.fill();
    g.globalCompositeOperation = 'source-over';
    // Floor.
    R(0, 150, W, H - 150, cold ? mix('#0a0c10', '#1e2228') : mix('#0c0810', '#2a1c22')); R(0, 150, W, 1, cold ? mix('#1a1e26', '#40464e') : mix('#1e1418', '#4a3436'));
    if (k > 0.2) { this.al(g, (k - 0.2) * 0.35); R(wx + 20, 151, ww + 40, 1, cold ? '#c8d0e0' : '#ffe0b0'); this.al(g, 1); }
    // The bed, the monitor and the IV.
    const bx = 226;
    R(bx, 134, 66, 6, '#e8e4f0'); R(bx, 134, 66, 1, '#ffffff'); R(bx, 140, 66, 2, '#8a8aa0'); R(bx + 2, 142, 2, 8, '#6a6a7a'); R(bx + 62, 142, 2, 8, '#6a6a7a');
    R(bx + 50, 130, 14, 4, '#ffffff'); R(bx + 4, 132, 40, 3, cold ? '#a0a8c0' : '#c8c0e0');
    R(bx - 1, 124, 1, 18, '#a0a0b0'); R(bx - 1, 124, 6, 1, '#a0a0b0');
    if (!cold) {
      const sw = Math.sin(T * 0.07);
      R(bx - 2, 125, 3, 3, '#ff3b5c'); R(bx - 3, Math.round(127 + sw), 1, 6, '#ff3b5c'); R(bx, Math.round(127 - sw), 1, 5, '#b8203c');
    }
    R(300, 118, 1, 32, '#a0a0b0'); R(297, 149, 7, 1, '#7a7a8a'); R(298, 112, 7, 9, 'rgba(220,230,255,0.6)');
    R(206, 112, 16, 12, '#2a1a24'); R(207, 113, 14, 10, '#061008'); R(213, 124, 2, 26, '#5a3a48');
    g.fillStyle = '#7aff9a';
    for (let j = 0; j < 14; j++) { const ph = ((j + lt * 0.15) % 14) | 0; g.fillRect(207 + j, 118 + (ph === 6 ? -3 : ph === 7 ? 2 : 0), 1, 1); }
    // Dust turning in the light.
    for (let i = 0; i < 24; i++) {
      const x = wx + 10 + ((hash(i, 1) * (ww + 30) + Math.sin(T * 0.01 + i) * 8) | 0), y = wy + wh + ((hash(i, 2) * 50 + T * 0.05 * (0.5 + hash(i, 3))) % 52);
      this.al(g, k * (0.3 + 0.4 * Math.sin(T * 0.05 + i))); R(x, y, 1, 1, cold ? '#dfe6f2' : '#fff1d0');
    }
    this.al(g, 1);
    // Eli, up, standing in the light. Mom beside him.
    Sprites.draw(g, 'mom', T % 220 < 8 ? 'blink' : 'idle0', 162, 150, false);
    Sprites.draw(g, 'eli', T % 260 < 8 ? 'blink' : (T >> 5) % 2 ? 'idle1' : 'idle0', 182, 150, !cold);
    // The words.
    const line = cold ? 'Morning.' : this.endKey === 'true' ? 'Good morning, Eli.' : 'Good morning.';
    if (lt > 150) { setFont(g, 8, true); this.al(g, 1); this.spell(g, line, W / 2, 168, '#ffe9a8', lt - 150, 5); }
    this.al(g, clamp((lt - 320) / 60, 0, 1)); setFont(g, 11);
    textC(g, cold ? 'Some things are still waiting for you in The Between.' : 'thank you for playing', W / 2, 180, '#9aa0bc', false);
    if (lt > 420) { this.al(g, 0.4 + 0.3 * Math.sin(T * 0.08)); setFont(g, 9); g.textAlign = 'right'; g.fillStyle = '#6a7090'; g.fillText('C', W - 6, H - 4); g.textAlign = 'left'; }
    this.al(g, 1);
  },

  // Keeper of the Between: no morning. Eli and Remi on the edge of a world that stopped falling.
  drawNight(g, lt, T) {
    const R = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w, h); };
    R(0, 0, W, H, '#07040e');
    this.stars(g, T, 90, '#b7b0d8', 0.4);
    // Far away, a heart monitor slows to a whisper.
    this.al(g, 0.12); g.strokeStyle = '#7aff9a'; g.lineWidth = 1; g.beginPath();
    for (let x = 0; x <= W; x += 2) { const ph = ((x + lt * 0.6) % 320) / 320; const y = 40 + (ph > 0.5 && ph < 0.52 ? -6 : ph >= 0.52 && ph < 0.54 ? 3 : 0); if (x === 0) g.moveTo(x, y); else g.lineTo(x, y); }
    g.stroke(); this.al(g, 1);
    R(0, 138, 190, 46, '#120c1c'); R(0, 138, 190, 1, '#3a2e50'); R(186, 138, 4, 46, '#0c0814');
    for (let i = 0; i < 6; i++) { const y = 150 + i * 6 + ((lt * 0.2 + i * 9) % 30); this.al(g, 0.3); R(188 + hash(i, 4) * 4, y, 1, 1, '#3a2e50'); }
    this.al(g, 1);
    Sprites.draw(g, 'eli', (T >> 6) % 2 ? 'sit1' : 'sit0', 170, 138);
    Sprites.draw(g, 'remi', (T >> 5) % 2 ? 'idle1' : 'idle0', 180, 138);
    this.glow(g, 182, 126, 8, '#ff3b5c', 0.15);
    if (lt > 150) { setFont(g, 8, true); this.spell(g, 'Goodnight, Eli.', W / 2, 74, '#c9c2ec', lt - 150, 5); }
    this.al(g, clamp((lt - 320) / 60, 0, 1)); setFont(g, 11);
    textC(g, 'Some things are still waiting for you in The Between.', W / 2, 92, '#8a90b0', false);
    if (lt > 420) { this.al(g, 0.4 + 0.3 * Math.sin(T * 0.08)); setFont(g, 9); g.textAlign = 'right'; g.fillStyle = '#6a7090'; g.fillText('C', W - 6, H - 4); g.textAlign = 'left'; }
    this.al(g, 1);
  },
};
