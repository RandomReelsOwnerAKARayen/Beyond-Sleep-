'use strict';
// Title screen: Eli's hospital room at night, in layers that shift with the cursor (or the right
// stick, or a slow drift when neither is moving). Rain and lightning in the window, the monitor,
// the IV, the ribbon on the rail, and motes of The Between leaking into the room.
// Things in the room answer a click: the window, the ribbon, the monitor, Eli, the clock.
// Touch the clock six times and its minute hand walks to midnight (a secret ending).

// Window glass, in screen coordinates at rest.
const TW = { x: 118, y: 54, w: 88, h: 80 };
// How far each layer slides at full look. Nearer layers slide further.
const DEPTH = { sky: 3, far: 5, near: 7, wall: 9, mid: 13, bed: 17 };
const TM = 22; // margin baked around cached layers so sliding never shows an edge

const TitleScene = {
  t: 0, look: { x: 0, y: 0 }, motes: [], sparks: [], trail: [], flash: 0, bolt: null, thunderAt: 0, nextStorm: 400,
  shooting: null, nextShoot: 300, ribbon: { a: 0, v: 0 }, curtains: [{ p: 0, v: 0 }, { p: 0, v: 0 }],
  ecg: [], hr: 62, hrBoost: 0, drip: 0, hot: null, built: null, clockTouches: 0, clockKick: 0,

  // Offset of a layer for the current look.
  off(d) { return [-this.look.x * d, -this.look.y * d * 0.6]; },

  // ---------------- Update ----------------
  update(menu) {
    this.t++;
    const m = Input.mouse, t = this.t;
    // Where the camera is looking.
    let tx, ty;
    if (m.active && m.still < 600) { tx = (m.x / W) * 2 - 1; ty = (m.y / H) * 2 - 1; }
    else if (Input.stick) [tx, ty] = Input.stick;
    else { tx = Math.sin(t * 0.004) * 0.35; ty = Math.sin(t * 0.0027) * 0.25; }
    this.look.x += (clamp(tx, -1, 1) - this.look.x) * 0.05;
    this.look.y += (clamp(ty, -1, 1) - this.look.y) * 0.05;

    if (!this.motes.length) for (let i = 0; i < (Game.options.lowFx ? 24 : 56); i++) this.motes.push(this.newMote(true));
    for (const p of this.motes) {
      p.ph += 0.02;
      p.x += p.vx + Math.sin(p.ph) * 0.06 * p.z;
      p.y += p.vy;
      // The cursor parts them like a hand through dust.
      if (m.active) {
        const [ox, oy] = this.off(p.z * 14), dx = p.x + ox - m.x, dy = p.y + oy - m.y, d = Math.hypot(dx, dy);
        if (d < 30 && d > 0.1) { const f = (1 - d / 30) * 0.12; p.vx += (dx / d) * f; p.vy += (dy / d) * f; }
      }
      p.vx *= 0.97; p.vy += (-0.05 * p.z - p.vy) * 0.03;
      if (p.y < -TM || p.x < -TM - 10 || p.x > W + TM + 10) Object.assign(p, this.newMote(false));
    }
    this.sparks = this.sparks.filter((s) => { s.x += s.vx; s.y += s.vy; s.vx *= 0.94; s.vy = s.vy * 0.94 - 0.01; return ++s.t < s.life; });

    // Weather: lightning now and then, the thunder arriving a moment later.
    if (this.flash > 0) this.flash--;
    if (--this.nextStorm <= 0) this.strike();
    if (this.thunderAt && t >= this.thunderAt) { this.thunderAt = 0; Sound.play('thunder'); Game.shake(1.5); }
    if (this.shooting) { const s = this.shooting; s.x += s.vx; s.y += s.vy; if (++s.t > 50) this.shooting = null; }
    else if (--this.nextShoot <= 0) this.shoot();

    // Ribbon: a damped pendulum the cursor can brush.
    const rb = this.ribbon, [bx, by] = this.off(DEPTH.bed);
    rb.v += -rb.a * 0.012 - rb.v * 0.025 + Math.sin(t * 0.011) * 0.0006;
    if (m.active && m.moved && Math.hypot(m.x - (228 + bx), m.y - (142 + by)) < 14 && this.trail[1]) rb.v += (m.x - this.trail[1][0]) * 0.006;
    rb.a = clamp(rb.a + rb.v, -1.1, 1.1);
    // Curtains breathe in the draft from the old window frame, and shy away from the cursor.
    const [wx, wy] = this.off(DEPTH.wall);
    this.curtains.forEach((c, k) => {
      const cx = (k ? 212 : 112) + wx;
      let push = 0;
      if (m.active && m.y > TW.y + wy && m.y < TW.y + TW.h + 16 + wy && Math.abs(m.x - cx) < 18) push = (cx - m.x) * 0.2;
      c.v += (Math.sin(t * 0.017 + k * 2) * 1.2 + push - c.p) * 0.02; c.v *= 0.93; c.p += c.v;
    });

    // Monitor.
    this.hrBoost *= 0.995;
    this.hr = 62 + Math.round(Math.sin(t * 0.003) * 2 + this.hrBoost);
    const beatLen = Math.round(3600 / Math.max(40, this.hr) / 1.6);
    const ph = t % beatLen;
    this.ecg.push(ph === 6 ? -1 : ph === 7 ? -8 : ph === 8 ? 5 : ph === 9 ? 1 : ph >= 14 && ph < 18 ? -2 : 0);
    if (this.ecg.length > 24) this.ecg.shift();
    if (ph === 7 && this.hrBoost > 2) Sound.tone(980, 0.06, 'sine', 0.02);
    this.drip = (this.drip + 1) % 110;
    if (this.clockKick > 0) this.clockKick--;

    // What the cursor is over, and what a click there does.
    this.hot = m.active ? this.hitTest(m.x, m.y) : null;
    if (m.click && !(menu && menu.clicked)) this.click(m.x, m.y);
  },

  // Every non-play state: keeps the cursor trail going, and forgets what was under it.
  tickCursor() {
    const m = Input.mouse;
    if (m.active) { this.trail.unshift([m.x, m.y]); this.trail.length = Math.min(this.trail.length, 8); } else this.trail.length = 0;
    this.hot = null;
  },

  newMote(anywhere) {
    const z = 0.25 + Math.random() * 1.25;
    return {
      x: rand(-TM, W + TM), y: anywhere ? rand(-TM, H + TM) : H + TM + rand(0, 20), z, ph: rand(0, 7),
      vx: rand(-0.05, 0.05), vy: -0.05 * z, c: ['#c9b8ff', '#ff8ac6', '#eef1ff', '#9fe0ff', '#c9b8ff'][(Math.random() * 5) | 0],
    };
  },

  strike(near) {
    this.flash = 22;
    this.nextStorm = (rand(9, 22) * 60) | 0;
    // A jagged bolt somewhere in the sky behind the glass.
    const pts = [[rand(TW.x + 10, TW.x + TW.w - 10), TW.y - 10]];
    while (pts[pts.length - 1][1] < TW.y + TW.h * 0.7) { const [x, y] = pts[pts.length - 1]; pts.push([x + rand(-7, 7), y + rand(5, 10)]); }
    this.bolt = pts;
    this.thunderAt = this.t + (near ? 20 : (rand(40, 110) | 0));
  },

  shoot() {
    this.nextShoot = (rand(8, 20) * 60) | 0;
    this.shooting = { x: rand(TW.x + 30, TW.x + TW.w + 20), y: rand(TW.y - 6, TW.y + 14), vx: -rand(1.4, 2.2), vy: rand(0.5, 0.9), t: 0 };
  },

  hitTest(x, y) {
    const [wx, wy] = this.off(DEPTH.wall), [mx, my] = this.off(DEPTH.mid), [bx, by] = this.off(DEPTH.bed);
    if (Math.hypot(x - (228 + bx), y - (142 + by)) < 10) return 'ribbon';
    if (Math.hypot(x - (292 + wx), y - (28 + wy)) < 11) return 'clock';
    if (x > 256 + bx && x < 318 + bx && y > 112 + by && y < 134 + by) return 'eli';
    if (x > 258 + mx && x < 300 + mx && y > 56 + my && y < 88 + my) return 'monitor';
    if (x > TW.x + wx && x < TW.x + TW.w + wx && y > TW.y + wy && y < TW.y + TW.h + wy) return 'window';
    return null;
  },

  click(x, y) {
    if (ROOM_THINGS.includes(this.hot)) Achievements.mark('touched', this.hot, ROOM_THINGS);
    switch (this.hot) {
      case 'window':
        if (this.flash < 8) this.strike(true);
        break;
      case 'ribbon':
        this.ribbon.v += (this.ribbon.a >= 0 ? 1 : -1) * 0.09 + rand(-0.02, 0.02);
        Sound.play('chime');
        break;
      case 'eli':
        // He can't wake yet. But he hears you.
        Achievements.unlock('listen');
        this.hrBoost = Math.min(this.hrBoost + 10, 30);
        Sound.play('heartbeat');
        for (let i = 0; i < 6; i++) this.sparks.push({ x: 300 + this.off(DEPTH.bed)[0], y: 116 + this.off(DEPTH.bed)[1], vx: rand(-0.5, 0.5), vy: rand(-1, -0.3), t: 0, life: 60, c: '#ff8ac6' });
        return;
      case 'clock': {
        if (Game.state !== 'title') break;
        // Each touch stops it and walks the minute hand on: 11:50, 11:52... and the sixth is midnight.
        const n = ++this.clockTouches;
        this.clockKick = 8;
        if (n % 2) Sound.tone(2400, 0.03, 'square', 0.05); else Sound.tone(1600, 0.04, 'square', 0.05);
        Sound.tone(n % 2 ? 900 : 600, 0.06, 'triangle', 0.06);
        if (n >= 6) {
          Game.shake(1);
          Game.fadeTo(() => Game.tiktokEnding(), 50);
          return;
        }
        break;
      }
      case 'monitor':
        Sound.tone(1320, 0.08, 'sine', 0.04); Sound.tone(1320, 0.08, 'sine', 0.04, 0, 0.14);
        break;
      default:
        Sound.play('twinkle');
    }
    for (let i = 0; i < 14; i++) {
      const a = rand(0, Math.PI * 2), s = rand(0.4, 1.8);
      this.sparks.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, life: (rand(25, 50)) | 0, c: i % 3 ? '#c9b8ff' : '#ff8ac6' });
    }
  },

  // ---------------- Cached layers ----------------
  build() {
    const dawn = Achievements.has('end_true');
    if (this.built && this.built.dawn === dawn) return this.built;
    const L = { dawn };
    L.far = this.buildCity(0, dawn);
    L.near = this.buildCity(1, dawn);
    L.wall = this.buildWall();
    L.bed = this.buildBed();
    L.curtain = this.buildCurtain();
    L.light = makeCanvas(W, H);
    return (this.built = L);
  },

  buildCity(layer, dawn) {
    const w = TW.w + 2 * TM + 20, h = 60, c = makeCanvas(w, h), g = c.getContext('2d');
    g.fillStyle = layer ? '#070a16' : (dawn ? '#3a3050' : '#141c34');
    for (let x = 0; x < w;) {
      const bw = 6 + ((hash(x, layer + 3) * (layer ? 14 : 10)) | 0), bh = (layer ? 14 : 22) + hash(x, layer + 7) * (layer ? 30 : 24);
      g.fillRect(x, h - bh, bw - 1, bh);
      if (hash(x, layer + 9) > 0.7) g.fillRect(x + (bw >> 1) - 1, h - bh - 5, 1, 5);
      if (layer) {
        for (let yy = h - bh + 3; yy < h - 2; yy += 3) for (let xx = x + 1; xx < x + bw - 2; xx += 2) {
          const r = hash(xx, yy, 5);
          if (r > 0.8) { g.fillStyle = r > 0.95 ? '#ffe9b0' : '#e8c870'; g.fillRect(xx, yy, 1, 1); g.fillStyle = '#070a16'; }
        }
      }
      x += bw;
    }
    return c;
  },

  buildWall() {
    const c = makeCanvas(W + TM * 2, H + TM * 2), g = c.getContext('2d'), M = TM;
    const R = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x + M, y + M, w, h); };
    // Wall, with a faint panel texture and a chair rail.
    const wg = g.createLinearGradient(0, 0, 0, H + 2 * M);
    wg.addColorStop(0, '#0a0f1c'); wg.addColorStop(1, '#121a2c');
    g.fillStyle = wg; g.fillRect(0, 0, c.width, c.height);
    for (let x = -M; x < W + M; x += 22) R(x, -M, 1, 168 + M, 'rgba(255,255,255,0.025)');
    for (let i = 0; i < 400; i++) R(((hash(i, 1, 3) * (W + 2 * M)) | 0) - M, ((hash(i, 2, 3) * 150) | 0) - M, 1, 1, 'rgba(255,255,255,0.03)');
    R(-M, 118, W + 2 * M, 2, '#1c2438'); R(-M, 120, W + 2 * M, 1, '#080b14');
    // Floor.
    R(-M, 152, W + 2 * M, H - 152 + M, '#090c16');
    R(-M, 150, W + 2 * M, 3, '#1a2034'); R(-M, 153, W + 2 * M, 1, '#05070e');
    for (let k = 0; k < 6; k++) R(-M, 158 + k * k * 1.2, W + 2 * M, 1, 'rgba(255,255,255,0.025)');
    // Window: frame, mullions, sill, and the curtain rod.
    g.clearRect(TW.x + M, TW.y + M, TW.w, TW.h);
    const { x, y, w, h } = TW;
    R(x - 5, y - 5, w + 10, 5, '#1e263c'); R(x - 5, y + h, w + 10, 4, '#1e263c'); R(x - 5, y, 5, h, '#1e263c'); R(x + w, y, 5, h, '#1e263c');
    R(x - 5, y - 5, w + 10, 1, '#2e3854'); R(x - 1, y, 1, h, '#121828'); R(x + w, y, 1, h, '#121828');
    R(x + w / 2 - 1, y, 3, h, '#1e263c'); R(x + w / 2 - 1, y, 1, h, '#2e3854'); R(x, y + 34, w, 2, '#1e263c'); R(x, y + 34, w, 1, '#2e3854');
    R(x - 9, y + h + 4, w + 18, 3, '#2a3450'); R(x - 9, y + h + 4, w + 18, 1, '#3c4868'); R(x - 9, y + h + 7, w + 18, 1, '#070a12');
    R(x - 22, y - 10, w + 44, 2, '#3a4460'); R(x - 24, y - 11, 3, 4, '#4a5470'); R(x + w + 21, y - 11, 3, 4, '#4a5470');
    // On the sill: a get-well card and a paper cup of flowers from the gift shop.
    R(x + 8, y + h - 3, 9, 7, '#e8dcc8'); R(x + 9, y + h - 2, 7, 1, '#ff8ac6'); R(x + 10, y + h, 4, 1, '#a8a0b8'); R(x + 12, y + h - 3, 1, 7, '#c8bca8');
    R(x + w - 16, y + h - 2, 6, 6, '#d8dce8'); R(x + w - 16, y + h - 2, 6, 1, '#ffffff');
    R(x + w - 14, y + h - 9, 1, 7, '#4a7a50'); R(x + w - 12, y + h - 11, 1, 9, '#4a7a50');
    R(x + w - 16, y + h - 11, 3, 3, '#ffcf6b'); R(x + w - 13, y + h - 13, 3, 3, '#ff8ac6'); R(x + w - 15, y + h - 10, 1, 1, '#ffe9a8');
    // Wall clock frame; hands are drawn live.
    g.fillStyle = '#1e263c'; g.beginPath(); g.arc(292 + M, 28 + M, 10, 0, 7); g.fill();
    g.fillStyle = '#c8ccd8'; g.beginPath(); g.arc(292 + M, 28 + M, 8, 0, 7); g.fill();
    for (let k = 0; k < 12; k++) { const a = k * Math.PI / 6; R(Math.round(292 + Math.cos(a) * 6.5), Math.round(28 + Math.sin(a) * 6.5), 1, 1, '#4a5068'); }
    // Call button panel and outlet by the bed.
    R(250, 108, 10, 7, '#1a2032'); R(252, 110, 2, 2, '#ff6b6b'); R(256, 110, 2, 2, '#7aff9a');
    return c;
  },

  buildCurtain() {
    const w = 18, h = 100, c = makeCanvas(w, h), g = c.getContext('2d');
    for (let x = 0; x < w; x++) {
      const f = Math.sin(x * 0.85) * 0.5 + 0.5;
      g.fillStyle = rgb(mixc(hex('#1a1e3a'), hex('#3a4270'), f)); g.fillRect(x, 0, 1, h);
    }
    g.fillStyle = 'rgba(0,0,0,0.25)'; for (let y = 4; y < h; y += 9) g.fillRect(0, y, w, 1);
    g.fillStyle = '#4a5478'; g.fillRect(0, h - 2, w, 2);
    for (let x = 1; x < w; x += 4) { g.fillStyle = '#5a6488'; g.fillRect(x, 0, 2, 2); }
    return c;
  },

  buildBed() {
    const c = makeCanvas(W + TM * 2, H + TM * 2), g = c.getContext('2d'), M = TM;
    const R = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x + M, y + M, w, h); };
    // Headboard and footboard.
    R(314, 98, 30, 50, '#2a3046'); R(314, 98, 30, 2, '#4a5270'); R(316, 102, 2, 44, '#1e2236');
    R(178, 114, 7, 36, '#2a3046'); R(178, 114, 7, 2, '#4a5270');
    // Frame, wheels, the shadow beneath.
    R(180, 146, 150, 8, '#1a1f30'); R(180, 146, 150, 1, '#2e3650');
    R(186, 154, 3, 16, '#22283c'); R(300, 154, 3, 16, '#22283c');
    R(182, 170, 10, 4, '#0c0f18'); R(296, 170, 10, 4, '#0c0f18');
    g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(170 + M, 174 + M, 170, 4);
    // Mattress and pillow.
    R(184, 132, 132, 14, '#c8cee0'); R(184, 132, 132, 2, '#e4e8f2'); R(184, 144, 132, 2, '#9aa2bc');
    R(290, 118, 26, 15, '#dfe4f0'); R(290, 118, 26, 2, '#f4f6fb'); R(291, 131, 24, 2, '#b0b8cc');
    return c;
  },

  // ---------------- Draw ----------------
  draw(g) {
    const L = this.build(), t = this.t, lowFx = Game.options.lowFx;
    const [wx, wy] = this.off(DEPTH.wall);

    // ----- Through the window -----
    g.save();
    g.beginPath(); g.rect(Math.round(TW.x + wx), Math.round(TW.y + wy), TW.w, TW.h); g.clip();
    this.drawSky(g, L);
    g.restore();

    // ----- The room -----
    g.drawImage(L.wall, Math.round(wx - TM), Math.round(wy - TM));
    this.drawGlass(g, wx, wy);
    this.drawClock(g, wx, wy);
    this.drawCurtains(g, L, wx, wy);
    this.drawMonitor(g);
    this.drawBed(g, L);
    if (!lowFx) this.drawLight(g, L);
    this.drawMotes(g, lowFx);
    if (this.flash > 12 && !Game.options.calm) { g.fillStyle = `rgba(200,220,255,${(this.flash - 12) * 0.012})`; g.fillRect(0, 0, W, H); }
    g.drawImage(Art.vignette, 0, 0);
  },

  drawSky(g, L) {
    const t = this.t, [sx, sy] = this.off(DEPTH.sky);
    const top = TW.y - TM, bot = TW.y + TW.h + TM;
    const sk = g.createLinearGradient(0, top + sy, 0, bot + sy);
    sk.addColorStop(0, '#040714'); sk.addColorStop(0.6, '#101a38'); sk.addColorStop(1, L.dawn ? '#b0687a' : '#26355e');
    g.fillStyle = sk; g.fillRect(TW.x - TM, top, TW.w + 2 * TM, bot - top);
    // Stars, each on its own slow twinkle.
    for (let i = 0; i < 70; i++) {
      const x = TW.x - 14 + hash(i, 1, 7) * (TW.w + 28) + sx, y = TW.y - 8 + hash(i, 2, 7) * TW.h * 0.6 + sy;
      const a = 0.25 + 0.6 * (0.5 + 0.5 * Math.sin(t * (0.02 + hash(i, 3, 7) * 0.05) + i));
      g.fillStyle = `rgba(230,236,255,${a})`; g.fillRect(x | 0, y | 0, 1, 1);
      if (hash(i, 4, 7) > 0.93) { g.globalAlpha = a * 0.5; g.fillRect((x - 1) | 0, y | 0, 3, 1); g.fillRect(x | 0, (y - 1) | 0, 1, 3); g.globalAlpha = 1; }
    }
    // Moon.
    const mx = 186 + sx, my = 70 + sy;
    g.globalCompositeOperation = 'lighter';
    Art.glow(g, mx, my, 26, '#6a80c0', 0.5);
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = '#eef0f8'; g.beginPath(); g.arc(mx, my, 7, 0, 7); g.fill();
    g.fillStyle = '#c8cce0'; g.fillRect((mx - 3) | 0, (my - 2) | 0, 2, 2); g.fillRect((mx + 2) | 0, (my + 2) | 0, 3, 2); g.fillRect((mx - 1) | 0, (my + 3) | 0, 1, 1);
    // Clouds drifting past it.
    for (let k = 0; k < 4; k++) {
      const cx = TW.x - 40 + ((hash(k, 5) * 200 + t * (0.03 + k * 0.012)) % (TW.w + 80)) + sx * 1.3, cy = TW.y + 8 + k * 9 + sy;
      g.fillStyle = `rgba(${L.dawn ? '60,50,80' : '22,30,58'},0.75)`;
      g.beginPath(); g.ellipse(cx, cy, 18 + k * 3, 3.5, 0, 0, 7); g.ellipse(cx + 8, cy - 2, 10, 3, 0, 0, 7); g.fill();
    }
    if (this.shooting) {
      const s = this.shooting, a = Math.min(1, (50 - s.t) / 20);
      for (let k = 0; k < 10; k++) { g.fillStyle = `rgba(255,255,255,${a * (1 - k / 10)})`; g.fillRect((s.x - s.vx * k * 0.7 + sx) | 0, (s.y - s.vy * k * 0.7 + sy) | 0, 1, 1); }
    }
    // Lightning: the bolt, then the whole sky.
    if (this.flash > 0) {
      g.fillStyle = `rgba(190,210,255,${this.flash / (Game.options.calm ? 120 : 30)})`; g.fillRect(TW.x - TM, top, TW.w + 2 * TM, bot - top);
      if (this.flash > 14 && this.bolt) {
        g.strokeStyle = '#ffffff'; g.lineWidth = 1; g.beginPath();
        this.bolt.forEach(([x, y], k) => (k ? g.lineTo(x + sx, y + sy) : g.moveTo(x + sx, y + sy))); g.stroke();
      }
    }
    // The city, far then near.
    const [fx, fy] = this.off(DEPTH.far), [nx, ny] = this.off(DEPTH.near);
    g.drawImage(L.far, Math.round(TW.x - TM - 10 + fx), Math.round(TW.y + TW.h - 60 + 4 + fy));
    g.drawImage(L.near, Math.round(TW.x - TM - 10 + nx), Math.round(TW.y + TW.h - 60 + 10 + ny));
    if ((t >> 5) % 2) { g.fillStyle = '#ff4d4d'; g.fillRect(Math.round(TW.x + 61 + nx), Math.round(TW.y + TW.h - 38 + ny), 1, 1); }
    // Rain, slanting in the wind.
    g.fillStyle = 'rgba(170,200,240,0.32)';
    for (let i = 0; i < 46; i++) {
      const x = TW.x - 10 + ((hash(i, 7) * (TW.w + 20) - t * 0.9) % (TW.w + 20) + TW.w + 20) % (TW.w + 20) + nx;
      const y = TW.y + ((hash(i, 8) * TW.h + t * (3 + hash(i, 9) * 2)) % TW.h) + ny;
      g.fillRect(x | 0, y | 0, 1, 2); g.fillRect((x - 1) | 0, (y + 2) | 0, 1, 2);
    }
  },

  drawGlass(g, wx, wy) {
    // Drops crawling down the pane, each leaving a short trail.
    for (let i = 0; i < 18; i++) {
      const sp = 0.05 + hash(i, 12) * 0.12, x = TW.x + 2 + hash(i, 10) * (TW.w - 4) + wx, y = TW.y + ((hash(i, 11) * TW.h + this.t * sp) % TW.h) + wy;
      g.fillStyle = 'rgba(200,220,255,0.4)'; g.fillRect(x | 0, y | 0, 2, 2);
      g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(x | 0, y | 0, 1, 1);
      g.fillStyle = 'rgba(200,220,255,0.13)'; g.fillRect(x | 0, (y - 6) | 0, 1, 6);
    }
    // A cold sheen on the glass.
    g.fillStyle = 'rgba(160,190,255,0.04)';
    g.beginPath(); g.moveTo(TW.x + 10 + wx, TW.y + wy); g.lineTo(TW.x + 30 + wx, TW.y + wy); g.lineTo(TW.x + wx, TW.y + 40 + wy); g.lineTo(TW.x + wx, TW.y + 20 + wy); g.fill();
  },

  drawClock(g, wx, wy) {
    // It keeps the player's own time, until someone touches it: then it stops at 11:48
    // plus two minutes a touch, the minute hand trembling a moment after each jump.
    const d = new Date(), cx = 292 + wx, cy = 28 + wy;
    const hand = (a, len, col) => { g.strokeStyle = col; g.lineWidth = 1; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.sin(a) * len, cy - Math.cos(a) * len); g.stroke(); };
    if (this.clockTouches) {
      const min = 48 + this.clockTouches * 2, kick = Math.sin(this.clockKick * 1.6) * this.clockKick * 0.025;
      hand((11 + min / 60) * Math.PI / 6, 3.5, '#1a1f30');
      hand(min * Math.PI / 30 + kick, 5.5, '#1a1f30');
      return;
    }
    hand(((d.getHours() % 12) + d.getMinutes() / 60) * Math.PI / 6, 3.5, '#1a1f30');
    hand((d.getMinutes() + d.getSeconds() / 60) * Math.PI / 30, 5.5, '#1a1f30');
    hand(d.getSeconds() * Math.PI / 30, 6, '#ff4d6d');
  },

  drawCurtains(g, L, wx, wy) {
    this.curtains.forEach((c, k) => {
      const x0 = (k ? 204 : 102) + wx, y0 = TW.y - 9 + wy, h = L.curtain.height;
      for (let y = 0; y < h; y++) {
        const f = (y / h) ** 2, dx = c.p * f * (k ? 1 : -1) * 0.8 + (k ? 1 : -1) * f * 3;
        g.drawImage(L.curtain, 0, y, L.curtain.width, 1, Math.round(x0 + dx), Math.round(y0 + y), L.curtain.width, 1);
      }
    });
  },

  drawMonitor(g) {
    const t = this.t, [ox, oy] = this.off(DEPTH.mid), R = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x + ox), Math.round(y + oy), w, h); };
    // IV pole, bag, drip chamber and line.
    R(243, 38, 2, 128, '#3a4058'); R(238, 166, 12, 2, '#2a3048'); R(237, 168, 2, 2, '#14182a'); R(249, 168, 2, 2, '#14182a');
    R(240, 38, 8, 1, '#5a6080');
    R(237, 42, 10, 15, 'rgba(200,220,240,0.45)'); R(237, 42, 10, 1, '#d8e4f0'); R(238, 48, 8, 9, 'rgba(180,220,255,0.35)'); R(239, 45, 6, 2, '#e8ecf4');
    R(241, 57, 2, 3, '#a8b0c8'); R(240, 60, 4, 7, 'rgba(200,220,240,0.5)'); R(240, 64, 4, 3, 'rgba(160,210,255,0.6)');
    if (this.drip < 18) R(241.5, 61 + this.drip * 0.2, 1, 1, '#d8f0ff');
    g.strokeStyle = 'rgba(200,215,235,0.45)'; g.lineWidth = 1; g.beginPath();
    g.moveTo(242 + ox, 67 + oy); g.bezierCurveTo(240 + ox, 110 + oy, 262 + ox, 118 + oy, 272 + this.off(DEPTH.bed)[0], 127 + this.off(DEPTH.bed)[1]); g.stroke();
    // Monitor on its arm.
    R(278, 86, 3, 18, '#2a3046'); R(278, 102, 40, 3, '#2a3046');
    R(258, 56, 42, 31, '#141824'); R(258, 56, 42, 1, '#2a3048'); R(261, 59, 36, 22, '#03100a'); R(285, 60, 1, 20, '#0c2416');
    for (let k = 0; k < this.ecg.length; k++) {
      const a = (k + 1) / this.ecg.length, y = 70 + this.ecg[k];
      g.fillStyle = k > this.ecg.length - 3 ? '#e0ffe8' : `rgba(122,255,154,${0.2 + a * 0.8})`;
      g.fillRect(Math.round(261 + k + ox), Math.round(y + oy), 1, 1);
      const prev = this.ecg[k - 1];
      if (prev !== undefined && Math.abs(prev - this.ecg[k]) > 1) g.fillRect(Math.round(261 + k + ox), Math.round(Math.min(y, 70 + prev) + oy), 1, Math.abs(prev - this.ecg[k]));
    }
    g.font = `6px ${FONT}`; g.fillStyle = this.hrBoost > 2 ? '#ffffff' : '#7aff9a'; g.fillText(String(this.hr), 286 + ox, 65 + oy);
    g.fillStyle = '#7ac8ff'; g.fillText('98', 286 + ox, 79 + oy);
    if ((t >> 4) % 4 === 0) R(296, 83, 2, 2, '#ff4d4d'); R(262, 83, 2, 2, '#7aff9a');
  },

  drawBed(g, L) {
    const t = this.t, [ox, oy] = this.off(DEPTH.bed);
    const X = (x) => Math.round(x + ox), Y = (y) => Math.round(y + oy), R = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(X(x), Y(y), w, h); };
    g.drawImage(L.bed, X(-TM), Y(-TM));
    // Eli: bandaged, asleep, breathing.
    const br = Math.sin(t * 0.035);
    R(295, 114, 12, 9, '#f2c8a0'); R(294, 116, 1, 5, '#f2c8a0'); R(303, 113, 6, 11, '#4a2f2a'); R(306, 115, 5, 8, '#4a2f2a'); R(304, 113, 3, 1, '#6e4a3c');
    R(296, 114, 9, 2, '#eef0f6'); R(296, 115, 9, 1, '#c8ccd8');
    R(297, 118, 3, 1, '#7a4a3c'); R(293, 119, 2, 1, '#e0b090');
    // Blanket over the body, chest rising and falling.
    const top = (x) => {
      const chest = Math.exp(-(((x - 276) / 12) ** 2)) * (3.5 + br * 0.8), knees = Math.exp(-(((x - 222) / 14) ** 2)) * 2.5, feet = Math.exp(-(((x - 196) / 5) ** 2)) * 3;
      return 128 - chest - knees - feet;
    };
    g.fillStyle = '#3c4c74'; g.beginPath(); g.moveTo(X(186), Y(146));
    for (let x = 186; x <= 292; x += 2) g.lineTo(X(x), Y(top(x)));
    g.lineTo(X(294), Y(126)); g.lineTo(X(294), Y(146)); g.closePath(); g.fill();
    for (let x = 186; x <= 292; x += 1) R(x, top(x), 1, 1, '#6a7ca8');
    g.fillStyle = 'rgba(0,0,0,0.18)'; for (let x = 200; x < 290; x += 17) g.fillRect(X(x), Y(top(x) + 3), 1, 12);
    R(288, 123 - br * 0.3, 8, 4, '#dfe4f0'); // folded sheet edge at the chest
    // An arm out on top, with the IV taped in.
    R(262, 126, 14, 3, '#f2c8a0'); R(262, 128, 14, 1, '#cf9a7c'); R(271, 126, 3, 2, '#eef0f6');
    // Rail and ribbon in front.
    R(196, 136, 104, 3, '#8a90a8'); R(196, 136, 104, 1, '#b0b6cc'); R(196, 139, 104, 1, '#4a5068');
    R(198, 130, 3, 18, '#7a8098'); R(296, 130, 3, 18, '#7a8098'); R(196, 130, 104, 2, '#7a8098');
    const a = this.ribbon.a, bx = 228, by = 136;
    const tail = (off, len) => {
      for (let j = 0; j < len; j++) { const s = j / len; R(bx + off + Math.sin(a) * j * (0.5 + s), by + 4 + Math.cos(a * s) * j, 2, 1, j > len - 3 ? '#b8203c' : '#ff3b5c'); }
    };
    tail(-2, 11); tail(1, 13);
    R(bx - 2, by - 3, 5, 5, '#ff3b5c'); R(bx - 6, by - 2, 4, 3, '#ff3b5c'); R(bx + 3, by - 2, 4, 3, '#ff3b5c'); R(bx - 1, by - 2, 3, 3, '#b8203c');
    R(bx - 5, by - 2, 1, 1, '#ff8a9c'); R(bx + 4, by - 2, 1, 1, '#ff8a9c');
  },

  // Room darkness, with light cut out where the moon, the monitor and the cursor reach.
  drawLight(g, L) {
    const lg = L.light.getContext('2d'), m = Input.mouse;
    const [wx, wy] = this.off(DEPTH.wall), [mx, my] = this.off(DEPTH.mid), [bx, by] = this.off(DEPTH.bed);
    const fl = this.flash / (Game.options.calm ? 88 : 22);
    lg.globalCompositeOperation = 'source-over'; lg.clearRect(0, 0, W, H);
    lg.fillStyle = `rgba(2,3,10,${0.6 - fl * 0.35})`; lg.fillRect(0, 0, W, H);
    lg.globalCompositeOperation = 'destination-out';
    // Moonlight through the glass, falling across the floor.
    const pane = (a) => {
      lg.globalAlpha = a;
      lg.beginPath();
      lg.moveTo(TW.x + wx, TW.y + TW.h + wy); lg.lineTo(TW.x + TW.w + wx, TW.y + TW.h + wy);
      lg.lineTo(TW.x + TW.w - 46 + wx * 1.4, H + 4); lg.lineTo(TW.x - 70 + wx * 1.4, H + 4); lg.closePath(); lg.fill();
    };
    lg.fillStyle = '#fff'; pane(0.35 + fl * 0.5);
    lg.globalAlpha = 0.85; lg.fillRect(TW.x + wx, TW.y + wy, TW.w, TW.h);
    const hole = (x, y, r, a) => { lg.globalAlpha = a; lg.drawImage(Art.glowSprite(r, '#ffffff'), Math.round(x - r), Math.round(y - r)); };
    hole(279 + mx, 72 + my, 44, 0.85);
    hole(228 + bx, 140 + by, 18, 0.5);
    hole(300 + bx, 120 + by, 26, 0.5);
    if (m.active && m.still < 600) hole(m.x, m.y, 42, 0.6 * Math.min(1, (600 - m.still) / 120));
    lg.globalAlpha = 1; lg.globalCompositeOperation = 'source-over';
    g.drawImage(L.light, 0, 0);
    // Coloured light on top.
    g.globalCompositeOperation = 'lighter';
    g.fillStyle = `rgba(110,140,255,${0.05 + fl * 0.15})`;
    g.beginPath(); g.moveTo(TW.x + wx, TW.y + TW.h + wy); g.lineTo(TW.x + TW.w + wx, TW.y + TW.h + wy); g.lineTo(TW.x + TW.w - 46 + wx * 1.4, H + 4); g.lineTo(TW.x - 70 + wx * 1.4, H + 4); g.fill();
    Art.glow(g, 279 + mx, 72 + my, 34, '#7aff9a', 0.16);
    Art.glow(g, 228 + bx, 140 + by, 16, '#ff3b5c', 0.3 + 0.08 * Math.sin(this.t * 0.05));
    if (this.hrBoost > 1) Art.glow(g, 300 + bx, 118 + by, 22, '#ff8ac6', Math.min(0.35, this.hrBoost * 0.02));
    if (m.active && m.still < 600) Art.glow(g, m.x, m.y, 30, this.hot ? '#ffd0e0' : '#c9b8ff', 0.18);
    g.globalCompositeOperation = 'source-over';
  },

  drawMotes(g, lowFx) {
    g.globalCompositeOperation = 'lighter';
    for (const p of this.motes) {
      const [ox, oy] = this.off(p.z * 14), x = p.x + ox, y = p.y + oy;
      const tw = 0.5 + 0.5 * Math.sin(p.ph * 3);
      if (p.z > 1.25 && !lowFx) { Art.glow(g, x, y, 5, p.c, 0.18 + tw * 0.1); continue; } // out-of-focus, close to the eye
      g.globalAlpha = (0.35 + tw * 0.5) * Math.min(1, p.z);
      g.fillStyle = p.c; g.fillRect(x | 0, y | 0, p.z > 0.9 ? 2 : 1, p.z > 0.9 ? 2 : 1);
      if (!lowFx && p.z > 0.7) Art.glow(g, x, y, 4, p.c, 0.12);
    }
    g.globalAlpha = 1;
    for (const s of this.sparks) {
      const a = 1 - s.t / s.life;
      g.globalAlpha = a; g.fillStyle = s.c; g.fillRect(s.x | 0, s.y | 0, 1, 1);
      if (!lowFx) Art.glow(g, s.x, s.y, 3, s.c, a * 0.4);
    }
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  },

  // A little light for a cursor, with a short trail. Drawn over every menu.
  drawCursor(g) {
    const m = Input.mouse;
    if (!m.active || m.still > 600) return;
    const a = Math.min(1, (600 - m.still) / 120), hot = this.hot || (Game.state === 'options' ? OptionsScreen.hot() : Game.state === 'achievements' ? AchScreen.hot() : (Game.state === 'title' || Game.state === 'pause') && Game.menu.hover() >= 0);
    g.globalCompositeOperation = 'lighter';
    this.trail.forEach(([x, y], k) => { g.globalAlpha = a * 0.35 * (1 - k / 8); g.fillStyle = '#c9b8ff'; g.fillRect(x | 0, y | 0, 1, 1); });
    g.globalAlpha = a;
    Art.glow(g, m.x, m.y, hot ? 9 : 6, hot ? '#ff8ac6' : '#c9b8ff', 0.6);
    g.globalCompositeOperation = 'source-over';
    const x = Math.round(m.x), y = Math.round(m.y), r = hot ? 3 + Math.round(Math.sin(Game.frame * 0.2)) : 2;
    g.fillStyle = hot ? '#ff8ac6' : '#c9b8ff';
    g.fillRect(x - r, y, r * 2 + 1, 1); g.fillRect(x, y - r, 1, r * 2 + 1);
    g.fillStyle = '#ffffff'; g.fillRect(x, y, 1, 1);
    g.globalAlpha = 1;
  },
};
