'use strict';
// Art: everything the world looks like. Terrain is autotiled per pixel and pre-rendered once per
// room; backgrounds are parallax layers cached per chapter; lights are composited every frame.

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const rgb = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
// Deterministic hash in [0, 1).
function hash(x, y, s = 0) {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const PAL = [
  null,
  { name: 'waiting', sky1: '#081316', sky2: '#16302f', light: '#bfe8d4', top: '#e2f4e8', base: '#3d6460', mid: '#2c4b48', dark: '#173030', deep: '#0b1a19', accent: '#e8f4a0', dust: '#b8d8cc', ambient: 'rgba(4,12,14,0.5)', mote: '#cfe9e0', spike: ['#e6f2ee', '#8fb0a8'] },
  { name: 'city', sky1: '#05081a', sky2: '#1f2858', light: '#b8c4ff', top: '#d8deff', base: '#3c4370', mid: '#2b3158', dark: '#161a36', deep: '#0b0e22', accent: '#ffd36b', dust: '#aab4e6', ambient: 'rgba(3,5,18,0.55)', mote: '#9fb4ff', spike: ['#d0d6f0', '#6a7090'] },
  { name: 'library', sky1: '#140a05', sky2: '#3a2214', light: '#ffd48a', top: '#ffe2a8', base: '#5c3a22', mid: '#45291a', dark: '#26160c', deep: '#160c06', accent: '#ffcf6b', dust: '#e6c9a0', ambient: 'rgba(12,6,2,0.46)', mote: '#fff1d0', spike: ['#f4e6c8', '#a08860'] },
  { name: 'heart', sky1: '#0c0306', sky2: '#3e0c1e', light: '#ff8a9c', top: '#ffd0dc', base: '#4e1a2e', mid: '#381222', dark: '#1e0811', deep: '#110409', accent: '#ff4d6d', dust: '#ff9aa8', ambient: 'rgba(10,1,5,0.6)', mote: '#ff9aa8', spike: ['#ffc0cc', '#b03050'] },
  { name: 'morning', sky1: '#3a5a9a', sky2: '#ffc890', light: '#fff0c0', top: '#9ee070', base: '#8a6448', mid: '#6e4e3a', dark: '#4a3428', deep: '#33241c', accent: '#ffe9a8', dust: '#fff1d0', ambient: null, mote: '#fff6d8', spike: ['#ffffff', '#c0c0c0'] },
];
for (const p of PAL) if (p) p.rgb = Object.fromEntries(Object.entries(p).filter(([, v]) => typeof v === 'string' && v[0] === '#').map(([k, v]) => [k, hex(v)]));

const Art = {
  ch: 1, P: PAL[1], bg: {}, glowCache: {}, lightCache: {}, ambient: [], weather: [],
  pal() { return this.P; },

  init() {
    this.tileCanvas = makeCanvas(W, H);
    this.backCanvas = makeCanvas(W, H);
    this.propCanvas = makeCanvas(W, H);
    this.lightCanvas = makeCanvas(W, H);
    this.vignette = makeCanvas(W, H);
    const g = this.vignette.getContext('2d');
    const grad = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.62);
    grad.addColorStop(0, 'rgba(0,0,0,0)'); grad.addColorStop(1, 'rgba(0,0,0,0.55)');
    g.fillStyle = grad; g.fillRect(0, 0, W, H);
  },

  buildRoom() {
    this.ch = World.chapter;
    this.P = PAL[this.ch];
    const top = World.chars[0].filter((c) => c === '#').length;
    // Indoor rooms get a back wall; open-sky rooms show the parallax background.
    this.indoor = this.ch === 1 || this.ch === 3 || (top > 30 && this.ch !== 5);
    this.buildBack();
    this.buildTiles();
    this.buildProps();
    this.initWeather();
  },

  // ======================= Terrain =======================
  buildTiles() {
    const g = this.tileCanvas.getContext('2d'), P = this.P.rgb, ch = this.ch;
    g.clearRect(0, 0, W, H);
    const isS = (c, r) => {
      c = clamp(c, 0, COLS - 1); r = clamp(r, 0, ROWS - 1);
      return World.chars[r][c] === '#';
    };
    // Distance (in tiles) from each solid tile to open air, for depth shading.
    const depth = new Uint8Array(COLS * ROWS);
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      if (!isS(c, r)) continue;
      let d = 1;
      for (; d < 5; d++) {
        let open = false;
        for (let dy = -d; dy <= d && !open; dy++) for (let dx = -d; dx <= d; dx++) {
          const cc = c + dx, rr = r + dy;
          if (cc < 0 || cc >= COLS || rr < 0 || rr >= ROWS) continue;
          if (!isS(cc, rr)) { open = true; break; }
        }
        if (open) break;
      }
      depth[r * COLS + c] = d;
    }
    const img = g.createImageData(W, H), data = img.data;
    const books = [hex('#7a2e2a'), hex('#2f4a6a'), hex('#6a5a24'), hex('#3e2f5a'), hex('#2a5a44'), hex('#8a4a2a'), hex('#5a2a4a')];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      if (!isS(c, r)) continue;
      const et = !isS(c, r - 1), eb = !isS(c, r + 1), el = !isS(c - 1, r), er = !isS(c + 1, r);
      const dep = depth[r * COLS + c];
      const hc = hash(c, r, ch);
      for (let py = 0; py < 8; py++) for (let px = 0; px < 8; px++) {
        const X = c * 8 + px, Y = r * 8 + py;
        let col, alpha = 255;
        // ---- material ----
        if (ch === 1) {
          const grout = px === 0 || py === 0;
          col = grout ? P.dark : mixc(P.base, P.light, hc < 0.2 ? 0.12 : hc > 0.9 ? -0.08 : 0.04 * hash(X, Y));
          if (!grout && hc < 0.07 && Math.abs(px - py) < 1) col = P.dark;
        } else if (ch === 2) {
          const row = Y >> 2, off = (row & 1) * 4;
          const mortar = (Y & 3) === 3 || ((X + off) & 7) === 7;
          const bh = hash((X + off) >> 3, row, 7);
          col = mortar ? P.dark : mixc(P.base, bh > 0.5 ? P.mid : P.light, bh > 0.5 ? (bh - 0.5) : 0.08 * bh);
          if (dep >= 2 && hc > 0.72 && px >= 2 && px <= 5 && py >= 2 && py <= 5) {
            col = hash(c, r, 3) > 0.45 ? (py === 2 ? hex('#fff0b0') : hex('#ffd36b')) : hex('#1a1e3a');
            if (px === 2 || py === 5) col = mixc(col, P.deep, 0.35);
          }
        } else if (ch === 3) {
          if (py === 7) col = mixc(hex('#7a4a28'), hex('#a06a3a'), px === 0 ? 0 : 0.2);
          else {
            const shift = (hash(r, 0, 11) * 6) | 0;
            const spine = (X + shift) >> 1;
            const bh = hash(spine, r, 5);
            const topGap = 1 + ((bh * 3) | 0);
            if (py < topGap) col = hex('#1a0e07');
            else {
              col = books[(bh * 7) | 0];
              if (py === topGap) col = mixc(col, hex('#ffffff'), 0.18);
              if (py === 4 && bh > 0.55) col = hex('#c8a040');
              if (((X + shift) & 1) === 1) col = mixc(col, hex('#000000'), 0.25);
            }
          }
        } else if (ch === 4) {
          const n = Math.sin(X * 0.33 + Math.sin(Y * 0.21) * 2.2) * Math.cos(Y * 0.27 + X * 0.06);
          col = mixc(P.base, P.mid, 0.5 + 0.5 * Math.sin(X * 0.11 + Y * 0.17));
          if (Math.abs(n) < 0.07) col = mixc(P.light, P.base, 0.45);
          if (hash(X, Y, 4) > 0.985) col = P.accent;
        } else {
          col = mixc(P.base, P.mid, hash(X >> 1, Y >> 1, 9) * 0.6);
          if (hash(X >> 2, Y >> 2, 2) > 0.9) col = mixc(hex('#b8a090'), P.base, 0.3);
        }
        // ---- depth: the further from air, the darker ----
        if (dep > 1) col = mixc(col, P.deep, Math.min(0.75, (dep - 1) * 0.24));
        // ---- edges ----
        if (et && py < 3) {
          if (ch === 5) col = py === 0 ? P.top : py === 1 ? hex('#6ab048') : hex('#3e7a30');
          else if (ch === 3) col = py === 0 ? hex('#e0a868') : py === 1 ? hex('#a06a3a') : hex('#4a2a14');
          else if (ch === 2) col = py === 0 ? P.top : py === 1 ? P.light : P.dark;
          else col = py === 0 ? P.top : py === 1 ? mixc(P.light, P.base, 0.4) : P.dark;
        }
        if (el && px === 0) col = ch === 3 ? hex('#6a4024') : P.deep;
        else if (el && px === 1 && !(et && py < 3)) col = ch === 3 ? hex('#8a5a34') : mixc(col, P.light, 0.18);
        if (er && px === 7) col = ch === 3 ? hex('#4a2a14') : P.deep;
        else if (er && px === 6 && ch === 3) col = hex('#6a4024');
        if (eb && py === 7) col = P.deep;
        else if (eb && py === 6) col = mixc(col, P.deep, 0.4);
        if (et && el && px === 0 && py === 0 && (ch === 4 || ch === 5)) alpha = 0;
        if (et && er && px === 7 && py === 0 && (ch === 4 || ch === 5)) alpha = 0;
        if (et && (el && px === 0 || er && px === 7) && py < 2 && ch !== 4 && ch !== 5) col = P.deep;
        const i = (Y * W + X) * 4;
        data[i] = col[0]; data[i + 1] = col[1]; data[i + 2] = col[2]; data[i + 3] = alpha;
      }
    }
    g.putImageData(img, 0, 0);
    this.decorateSurfaces(g, isS);
    this.drawSpikes(g);
  },

  // Little things growing on, lying on, or hanging from surfaces.
  decorateSurfaces(g, isS) {
    const ch = this.ch, P = this.P;
    const px = (x, y, c) => { g.fillStyle = c; g.fillRect(x, y, 1, 1); };
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      if (!isS(c, r)) continue;
      const x = c * 8, y = r * 8, h1 = hash(c, r, 21), h2 = hash(c, r, 22);
      const airAbove = r > 0 && World.chars[r - 1][c] === '.';
      const airBelow = r < ROWS - 1 && World.chars[r + 1][c] === '.';
      if (airAbove) {
        if (ch === 5) {
          for (let k = 0; k < 8; k++) {
            const hb = hash(x + k, r, 5);
            if (hb > 0.45) { const hh = 1 + ((hb * 3) | 0); g.fillStyle = hb > 0.8 ? '#b8f088' : '#7fc85a'; g.fillRect(x + k, y - hh, 1, hh); }
            if (hb > 0.94) px(x + k, y - 4, ['#ff8ab0', '#ffe066', '#ffffff', '#a0b0ff'][(hb * 400) & 3]);
          }
        } else if (ch === 4 && h1 > 0.55) {
          const k = (h2 * 6) | 0, hh = 2 + ((h1 * 4) | 0);
          g.fillStyle = '#ff9ab0'; g.fillRect(x + k, y - hh, 1, hh); g.fillStyle = '#ffe0e8'; g.fillRect(x + k, y - hh, 1, 1);
          if (h2 > 0.5) { g.fillStyle = '#d04a6a'; g.fillRect(x + k + 1, y - 2, 1, 2); }
        } else if (ch === 3 && h1 > 0.82) {
          g.fillStyle = ['#7a2e2a', '#2f4a6a', '#6a5a24'][(h2 * 3) | 0]; g.fillRect(x + 1, y - 2, 6, 2);
          g.fillStyle = '#e8dcc0'; g.fillRect(x + 2, y - 2, 4, 1);
        } else if (ch === 2 && h1 > 0.7) {
          px(x + ((h2 * 7) | 0), y - 1, '#8a90b0'); if (h1 > 0.88) px(x + ((h2 * 5) | 0) + 2, y - 1, '#5a6080');
        } else if (ch === 1 && h1 > 0.9) {
          g.fillStyle = '#d8e4dc'; g.fillRect(x + 2, y - 1, 4, 1); g.fillStyle = '#9ab0a8'; g.fillRect(x + 3, y - 1, 2, 1);
        }
      }
      if (airBelow) {
        if (ch === 4 && h1 > 0.6) { g.fillStyle = 'rgba(200,40,80,0.8)'; g.fillRect(x + ((h2 * 7) | 0), y + 8, 1, 2 + ((h1 * 5) | 0)); }
        else if (ch === 5 && h1 > 0.55) { g.fillStyle = '#5aa040'; g.fillRect(x + ((h2 * 7) | 0), y + 8, 1, 1 + ((h1 * 4) | 0)); }
        else if (ch === 3 && h1 > 0.85) { g.strokeStyle = 'rgba(230,220,200,0.35)'; g.lineWidth = 0.5; g.beginPath(); g.moveTo(x, y + 8); g.lineTo(x + 5, y + 13); g.lineTo(x + 8, y + 8); g.stroke(); }
        else if (ch === 2 && h1 > 0.8) { g.fillStyle = '#5a6080'; g.fillRect(x + ((h2 * 7) | 0), y + 8, 1, 3); }
        else if (ch === 1 && h1 > 0.92) { g.fillStyle = 'rgba(160,200,190,0.5)'; g.fillRect(x + 3, y + 8, 1, 2); }
      }
    }
  },

  drawSpikes(g) {
    const [lt, dk] = this.P.spike, base = this.P.dark;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const t = World.chars[r][c];
      if (t !== '^' && t !== 'v') continue;
      const x = c * 8, y = r * 8, up = t === '^';
      for (let s = 0; s < 2; s++) {
        const sx = x + s * 4, hgt = 5 + ((hash(c, r, s) * 2) | 0);
        for (let k = 0; k < hgt; k++) {
          const w = Math.max(1, 4 - Math.floor((k * 4) / hgt));
          const yy = up ? y + 7 - k : y + k;
          const xx = sx + Math.floor((4 - w) / 2);
          g.fillStyle = lt; g.fillRect(xx, yy, Math.max(1, Math.ceil(w / 2)), 1);
          g.fillStyle = dk; if (w > 1) g.fillRect(xx + Math.ceil(w / 2), yy, Math.floor(w / 2), 1);
        }
      }
      g.fillStyle = base; g.fillRect(x, up ? y + 7 : y, 8, 1);
    }
  },

  // ======================= Back wall (indoor rooms) =======================
  buildBack() {
    const g = this.backCanvas.getContext('2d'), ch = this.ch, P = this.P;
    g.clearRect(0, 0, W, H);
    if (!this.indoor) return;
    const img = g.createImageData(W, H), d = img.data;
    for (let Y = 0; Y < H; Y++) for (let X = 0; X < W; X++) {
      let col;
      if (ch === 1) {
        // Hospital wallpaper: stripes, a little diamond motif, panelling below a chair rail.
        const rail = 120;
        if (Y > rail) col = ((X % 24) === 0 || Y === rail + 1) ? hex('#10221f') : (X % 24 === 1 ? hex('#22403b') : hex('#18302c'));
        else if (Y === rail || Y === rail - 1) col = hex('#2c4c46');
        else {
          col = (X % 8) < 4 ? hex('#1c3632') : hex('#19322e');
          if (((X + 4) % 12 === 0 && (Y % 12) === 6) || ((X + 4) % 12 < 2 && Math.abs((Y % 12) - 6) < 1)) col = hex('#284842');
        }
        col = mixc(col, hex('#050c0c'), Math.max(0, 0.6 - Y / H));
      } else if (ch === 3) {
        // Distant shelves fading into the dark.
        const shelf = Y % 14;
        if (shelf === 13) col = hex('#2a180c');
        else if (shelf < 3) col = hex('#120a05');
        else {
          const sp = hash(X >> 1, (Y / 14) | 0, 3);
          col = mixc(hex('#1e120a'), [hex('#3a1814'), hex('#18243a'), hex('#34301a'), hex('#24183a')][(sp * 4) | 0], 0.55);
          if ((X & 1) === 1) col = mixc(col, hex('#000000'), 0.3);
          if (shelf < 3 + ((sp * 3) | 0)) col = hex('#120a05');
        }
        if (X % 64 < 3) col = hex('#2c1a0e');
        col = mixc(col, hex('#000000'), 0.15 + 0.3 * Math.abs(Y / H - 0.5));
      } else if (ch === 2) {
        const row = Y >> 2, off = (row & 1) * 4;
        col = ((Y & 3) === 3 || ((X + off) & 7) === 7) ? hex('#0c1024') : mixc(hex('#1a1f3c'), hex('#141830'), hash((X + off) >> 3, row));
      } else {
        const n = Math.sin(X * 0.08 + Math.sin(Y * 0.05) * 3) * Math.cos(Y * 0.07);
        col = mixc(hex('#2a0a16'), hex('#160409'), 0.5 + 0.5 * n);
        if (Math.abs(n) < 0.03) col = hex('#4a1426');
      }
      const i = (Y * W + X) * 4;
      d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = ch === 4 ? 200 : 255;
    }
    g.putImageData(img, 0, 0);
    // Windows: cut holes so the parallax world shows through, then frame them.
    for (const p of World.props) {
      if (p.kind !== 'window') continue;
      const cx = p.c * 8 + 4, cy = p.r * 8 + 4, w = 26, h = 30, x = cx - w / 2, y = cy - h / 2;
      g.clearRect(x, y, w, h);
      g.fillStyle = '#0e1c1c'; g.fillRect(x - 2, y - 2, w + 4, 2); g.fillRect(x - 2, y + h, w + 4, 3); g.fillRect(x - 2, y, 2, h); g.fillRect(x + w, y, 2, h);
      g.fillStyle = '#3c5c56'; g.fillRect(x - 3, y + h + 1, w + 6, 1);
      g.fillRect(x + w / 2 - 1, y, 2, h); g.fillRect(x, y + h / 2 - 1, w, 1);
    }
  },

  // ======================= Parallax backgrounds (cached per chapter) =======================
  layersFor(ch) {
    if (this.bg[ch]) return this.bg[ch];
    const BW = W + 64, BH = H + 24;
    const mk = () => { const c = makeCanvas(BW, BH); return [c, c.getContext('2d')]; };
    const [far, fg] = mk(), [mid, mg] = mk(), [near, ng] = mk();
    const P = PAL[ch];
    let seed = ch * 7919;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const grad = fg.createLinearGradient(0, 0, 0, BH);
    grad.addColorStop(0, P.sky1); grad.addColorStop(1, P.sky2);
    fg.fillStyle = grad; fg.fillRect(0, 0, BW, BH);
    if (ch === 1) {
      for (let i = 0; i < 70; i++) {
        const x = rnd() * BW, y = 60 + rnd() * 120, r = 1 + rnd() * 4;
        fg.fillStyle = ['rgba(255,220,140,0.25)', 'rgba(140,230,220,0.2)', 'rgba(255,140,120,0.2)'][(rnd() * 3) | 0];
        fg.beginPath(); fg.arc(x, y, r, 0, 7); fg.fill();
      }
      mg.fillStyle = '#0a1618';
      for (let x = 0; x < BW; x += 10 + ((rnd() * 18) | 0)) {
        const w = 12 + ((rnd() * 20) | 0), h = 40 + rnd() * 80;
        mg.fillRect(x, BH - h, w, h);
        for (let k = 0; k < 10; k++) if (rnd() < 0.4) { mg.fillStyle = rnd() < 0.5 ? '#e8d890' : '#5a8a80'; mg.fillRect(x + 2 + ((rnd() * (w - 4)) | 0), BH - h + 4 + ((rnd() * (h - 8)) | 0), 1, 1); mg.fillStyle = '#0a1618'; }
      }
    } else if (ch === 2) {
      for (let i = 0; i < 120; i++) { fg.fillStyle = `rgba(255,255,255,${0.15 + rnd() * 0.55})`; fg.fillRect(rnd() * BW | 0, rnd() * BH * 0.75 | 0, 1, 1); }
      const mh = fg.createRadialGradient(300, 30, 10, 300, 30, 46);
      mh.addColorStop(0, 'rgba(200,215,255,0.25)'); mh.addColorStop(1, 'rgba(200,215,255,0)');
      fg.fillStyle = mh; fg.fillRect(250, 0, 100, 80);
      fg.fillStyle = '#e8ecff'; fg.beginPath(); fg.arc(300, 30, 13, 0, 7); fg.fill();
      fg.fillStyle = '#c8d0f0'; [[296, 26, 3], [304, 34, 2], [302, 24, 1.5], [294, 34, 1.5]].forEach(([x, y, r]) => { fg.beginPath(); fg.arc(x, y, r, 0, 7); fg.fill(); });
      for (let layer = 0; layer < 2; layer++) {
        const g = layer ? ng : mg, colB = layer ? '#0a0d20' : '#151a38', colW = layer ? '#ffd36b' : '#b89a50';
        for (let x = -4; x < BW; x += 14 + ((rnd() * 16) | 0)) {
          const h = (layer ? 30 : 60) + rnd() * (layer ? 60 : 90), w = 12 + ((rnd() * 18) | 0), y = BH - h;
          g.fillStyle = colB; g.fillRect(x, y, w, h);
          if (rnd() < 0.3) { g.fillRect(x + w / 2 - 1, y - 8, 1, 8); g.fillStyle = '#ff4d4d'; g.fillRect(x + w / 2 - 1, y - 9, 1, 1); g.fillStyle = colB; }
          if (rnd() < 0.25) g.fillRect(x + 2, y - 4, w - 4, 4);
          for (let yy = y + 3; yy < BH - 2; yy += 4) for (let xx = x + 2; xx < x + w - 2; xx += 3) {
            if (rnd() < 0.22) { g.fillStyle = colW; g.globalAlpha = 0.4 + rnd() * 0.6; g.fillRect(xx, yy, 1, 2); g.globalAlpha = 1; }
          }
        }
      }
    } else if (ch === 3) {
      for (let x = 0; x < BW; x += 48) {
        mg.fillStyle = '#24140a'; mg.fillRect(x + 4, 20, 36, BH);
        mg.fillStyle = '#140a04'; mg.beginPath(); mg.arc(x + 22, 20, 18, Math.PI, 0); mg.fill();
        mg.fillRect(x + 4, 20, 36, BH);
      }
    } else if (ch === 4) {
      for (let i = 0; i < 50; i++) { fg.fillStyle = `rgba(255,120,150,${0.1 + rnd() * 0.3})`; fg.fillRect(rnd() * BW | 0, rnd() * BH | 0, 1, 1); }
      // Debris from every chapter, adrift: chairs, books, buildings.
      for (let i = 0; i < 14; i++) {
        const x = rnd() * BW, y = rnd() * BH, k = (rnd() * 3) | 0, s = 0.5 + rnd();
        ng.fillStyle = 'rgba(40,6,18,0.9)';
        if (k === 0) { ng.fillRect(x, y, 6 * s, 2 * s); ng.fillRect(x, y - 6 * s, 2 * s, 6 * s); ng.fillRect(x + 1, y + 2 * s, 1, 4 * s); ng.fillRect(x + 5 * s, y + 2 * s, 1, 4 * s); }
        else if (k === 1) { ng.fillRect(x, y, 7 * s, 9 * s); ng.fillStyle = 'rgba(90,20,40,0.9)'; ng.fillRect(x + 1, y + 1, 1, 9 * s - 2); }
        else { ng.fillRect(x, y, 10 * s, 16 * s); ng.fillStyle = 'rgba(255,90,120,0.35)'; for (let k2 = 0; k2 < 4; k2++) ng.fillRect(x + 2 + (k2 % 2) * 4 * s, y + 3 + ((k2 / 2) | 0) * 6 * s, 2, 2); }
      }
    } else if (ch === 5) {
      const sg = fg.createRadialGradient(150, 150, 4, 150, 150, 160);
      sg.addColorStop(0, 'rgba(255,250,220,1)'); sg.addColorStop(0.12, 'rgba(255,230,170,0.9)'); sg.addColorStop(0.4, 'rgba(255,190,140,0.35)'); sg.addColorStop(1, 'rgba(255,190,140,0)');
      fg.fillStyle = sg; fg.fillRect(0, 0, BW, BH);
      fg.fillStyle = '#fffaf0'; fg.beginPath(); fg.arc(150, 150, 16, 0, 7); fg.fill();
      mg.fillStyle = '#b07a8a';
      for (let x = 0; x < BW; x += 6) { const h = 30 + Math.sin(x * 0.02) * 12 + Math.sin(x * 0.07) * 5; mg.fillRect(x, BH - h, 6, h); }
      ng.fillStyle = '#7a5068';
      for (let x = 0; x < BW; x += 12 + ((rnd() * 10) | 0)) {
        const w = 10 + ((rnd() * 14) | 0), h = 24 + rnd() * 44;
        ng.fillRect(x, BH - h, w, h);
        ng.fillStyle = '#ffe0a0'; for (let k = 0; k < 6; k++) if (rnd() < 0.3) ng.fillRect(x + 2 + ((rnd() * (w - 4)) | 0), BH - h + 4 + ((rnd() * (h - 8)) | 0), 1, 1); ng.fillStyle = '#7a5068';
      }
    }
    return (this.bg[ch] = { far, mid, near });
  },

  beat() {
    // Lub-dub, roughly 55 bpm.
    const t = (Game.frame % 66) / 66;
    return Math.max(0, 1 - t * 9) + 0.6 * Math.max(0, 1 - Math.abs(t - 0.22) * 9);
  },

  drawBackground(g, p) {
    const L = this.layersFor(this.ch), t = World.t;
    const px = p ? p.x : W / 2, py = p ? p.y : H / 2;
    const ox = (px - W / 2) / (W / 2), oy = (py - H / 2) / (H / 2);
    const lay = (c, f) => g.drawImage(c, Math.round(-32 - ox * 32 * f), Math.round(-12 - oy * 12 * f));
    lay(L.far, 0.15);
    // Animated sky elements.
    if (this.ch === 1) {
      if (Math.random() < 0.002) this.flash = 10;
      if (this.flash > 0) { g.fillStyle = `rgba(200,240,255,${this.flash / (Game.options.calm ? 150 : 30)})`; g.fillRect(0, 0, W, H); this.flash--; }
    } else if (this.ch === 2) {
      for (const k of this.chunks || []) {
        k.y -= k.v; if (k.y < -k.h - 10) { k.y = H + 20; k.x = rand(0, W); }
        g.fillStyle = '#1b2148'; g.fillRect(k.x | 0, k.y | 0, k.w, k.h);
        g.fillStyle = '#2a3266'; g.fillRect(k.x | 0, k.y | 0, k.w, 1);
        g.fillStyle = '#ffd36b'; for (let i = 0; i < k.lit.length; i++) g.fillRect((k.x + k.lit[i][0]) | 0, (k.y + k.lit[i][1]) | 0, 1, 1);
        g.fillStyle = 'rgba(160,180,255,0.3)'; g.fillRect((k.x + k.w / 2) | 0, (k.y + k.h) | 0, 1, 3 + (t >> 3) % 3);
      }
    } else if (this.ch === 4) {
      const b = this.beat(), s = 1 + b * 0.06;
      const cx = W / 2 - ox * 6, cy = 78 - oy * 4;
      g.save(); g.translate(cx, cy); g.scale(s, s);
      g.globalAlpha = 0.18 + b * 0.25; g.fillStyle = '#ff2a4a';
      g.beginPath(); g.arc(-22, -10, 26, Math.PI, 0); g.arc(22, -10, 26, Math.PI, 0); g.lineTo(0, 46); g.closePath(); g.fill();
      g.globalAlpha = 0.5; g.strokeStyle = '#1a0408'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(0, -18); g.lineTo(-8, 4); g.lineTo(6, 14); g.lineTo(-4, 34); g.stroke();
      g.restore(); g.globalAlpha = 1;
      // ECG line across the sky.
      g.strokeStyle = 'rgba(255,120,150,0.35)'; g.lineWidth = 1; g.beginPath();
      for (let x = 0; x <= W; x += 2) {
        const ph = ((x + t * 2) % 160) / 160;
        let y = 30;
        if (ph > 0.4 && ph < 0.44) y -= 12; else if (ph >= 0.44 && ph < 0.48) y += 8; else if (ph > 0.6 && ph < 0.66) y -= 3;
        if (x === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.stroke();
    } else if (this.ch === 5) {
      for (const k of this.clouds || []) {
        k.x += k.v; if (k.x > W + 40) k.x = -60;
        g.fillStyle = 'rgba(255,240,230,0.55)';
        g.fillRect(k.x | 0, k.y, k.w, 4); g.fillRect((k.x + 4) | 0, k.y - 3, k.w - 12, 3); g.fillRect((k.x + 10) | 0, k.y - 5, k.w / 3, 2);
        g.fillStyle = 'rgba(255,200,180,0.5)'; g.fillRect((k.x + 2) | 0, k.y + 4, k.w - 4, 1);
      }
    }
    lay(L.mid, 0.4);
    lay(L.near, 0.8);
    if (this.ch === 1 || this.ch === 2) this.drawRain(g, this.ch === 1 ? 0.35 : 0.22);
    g.drawImage(this.backCanvas, 0, 0);
  },

  drawRain(g, a) {
    g.fillStyle = `rgba(170,200,230,${a})`;
    const t = World.t;
    for (let i = 0; i < 60; i++) {
      const x = (hash(i, 1) * W + t * 0.6) % W, y = (hash(i, 2) * H + t * (4 + hash(i, 3) * 2)) % H;
      g.fillRect(x | 0, y | 0, 1, 3);
    }
  },

  // ======================= Weather / ambient particles (in front of the world) =======================
  initWeather() {
    const n = Game.options.lowFx ? 14 : 46, ch = this.ch;
    this.weather = [];
    for (let i = 0; i < n; i++) this.weather.push(this.newMote(ch, true));
    this.chunks = [];
    if (ch === 2) for (let i = 0; i < 7; i++) {
      const w = 6 + ((Math.random() * 14) | 0), h = 6 + ((Math.random() * 18) | 0), lit = [];
      for (let k = 0; k < 4; k++) if (Math.random() < 0.7) lit.push([1 + ((Math.random() * (w - 2)) | 0), 1 + ((Math.random() * (h - 2)) | 0)]);
      this.chunks.push({ x: rand(0, W), y: rand(0, H), w, h, v: rand(0.05, 0.25), lit });
    }
    this.clouds = [];
    if (ch === 5) for (let i = 0; i < 6; i++) this.clouds.push({ x: rand(-40, W), y: 14 + ((Math.random() * 60) | 0), w: 24 + ((Math.random() * 30) | 0), v: rand(0.05, 0.15) });
  },

  newMote(ch, anywhere) {
    const m = { x: rand(0, W), y: anywhere ? rand(0, H) : 0, a: rand(0.25, 0.8), s: Math.random() < 0.25 ? 2 : 1, ph: rand(0, 6.28) };
    if (ch === 2) { m.vx = -0.6; m.vy = rand(2.8, 4); m.kind = 'rain'; if (!anywhere) m.y = -4; }
    else if (ch === 3) { m.vx = rand(-0.2, 0.2); m.vy = rand(0.08, 0.25); m.kind = Math.random() < 0.3 ? 'page' : 'dust'; if (!anywhere) m.y = -4; }
    else if (ch === 4) { m.vx = rand(-0.15, 0.15); m.vy = -rand(0.15, 0.6); m.kind = 'ember'; if (!anywhere) m.y = H + 4; }
    else if (ch === 5) { m.vx = rand(0.05, 0.25); m.vy = rand(-0.08, 0.08); m.kind = 'pollen'; }
    else { m.vx = rand(-0.08, 0.08); m.vy = rand(-0.06, 0.06); m.kind = 'dust'; }
    return m;
  },

  drawForeground(g) {
    const P = this.P, t = World.t;
    for (let i = 0; i < this.weather.length; i++) {
      const m = this.weather[i];
      m.x += m.vx + (m.kind === 'page' ? Math.sin(t * 0.04 + m.ph) * 0.3 : 0); m.y += m.vy;
      if (m.y > H + 6 || m.y < -8 || m.x < -8 || m.x > W + 8) {
        if (m.kind === 'dust' || m.kind === 'pollen') { m.x = (m.x + W) % W; m.y = (m.y + H) % H; } else this.weather[i] = this.newMote(this.ch, false);
        continue;
      }
      if (m.kind === 'rain') {
        if (World.solid(m.x, m.y, 1, 1)) { World.particles.length < 200 && World.particles.push({ x: m.x, y: m.y - 1, vx: rand(-0.5, 0.5), vy: -rand(0.3, 0.8), g: 0.1, life: 8, max: 8, color: '#9fb4ff', size: 1 }); this.weather[i] = this.newMote(2, false); continue; }
        g.fillStyle = `rgba(160,180,255,${m.a * 0.5})`; g.fillRect(m.x | 0, m.y | 0, 1, 4);
      } else if (m.kind === 'page') {
        const flip = Math.sin(t * 0.08 + m.ph) > 0;
        g.globalAlpha = m.a; g.fillStyle = flip ? '#f4ead0' : '#c8b890'; g.fillRect(m.x | 0, m.y | 0, flip ? 3 : 2, 2);
        g.fillStyle = '#8a7a5a'; g.fillRect((m.x | 0) + 1, (m.y | 0) + 1, 1, 1); g.globalAlpha = 1;
      } else if (m.kind === 'ember') {
        g.globalAlpha = m.a * (0.6 + 0.4 * Math.sin(t * 0.2 + m.ph));
        g.fillStyle = m.s > 1 ? '#ffb070' : '#ff4d6d'; g.fillRect(m.x | 0, m.y | 0, 1, 1); g.globalAlpha = 1;
      } else {
        g.globalAlpha = m.a * (0.6 + 0.4 * Math.sin(t * 0.03 + m.ph));
        g.fillStyle = P.mote; g.fillRect(m.x | 0, m.y | 0, m.s, m.s); g.globalAlpha = 1;
      }
    }
  },

  // ======================= Props =======================
  buildProps() {
    const g = this.propCanvas.getContext('2d');
    g.clearRect(0, 0, W, H);
    for (const p of World.props) this.drawProp(g, p, true);
  },

  // Static props are baked once; animated details are drawn every frame (stat=false).
  drawProp(g, p, stat) {
    const R = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
    const x = p.x, b = p.y, cx = p.c * 8 + 4, cy = p.r * 8 + 4, t = World.t, top = p.r * 8;
    switch (p.kind) {
      // ---- chapter 1 ----
      case 'lamp':
        if (stat) { R(cx - 6, top, 1, 4, '#4a5a58'); R(cx + 6, top, 1, 4, '#4a5a58'); R(cx - 8, top + 4, 17, 3, '#6a8a84'); R(cx - 7, top + 6, 15, 1, '#e8fff4'); }
        else if (this.flicker(p)) R(cx - 7, top + 6, 15, 1, '#5a7a74');
        break;
      case 'chairs':
        if (!stat) break;
        for (let k = 0; k < 3; k++) {
          const sx = x + k * 8;
          R(sx, b - 11, 6, 6, '#3f8f8a'); R(sx, b - 11, 6, 1, '#6abfb8'); R(sx, b - 5, 7, 2, '#4aa09a'); R(sx, b - 5, 7, 1, '#7acfc8');
          R(sx + 1, b - 3, 1, 3, '#2a3a3a'); R(sx + 5, b - 3, 1, 3, '#2a3a3a');
        }
        R(x - 1, b - 3, 25, 1, '#2a3a3a');
        break;
      case 'plant':
        if (!stat) break;
        R(x + 1, b - 5, 6, 5, '#8a5a3a'); R(x + 1, b - 5, 6, 1, '#b07a50'); R(x + 2, b - 1, 4, 1, '#5a3a24');
        [[3, -10, 3, 5], [0, -12, 3, 4], [5, -13, 3, 5], [2, -16, 2, 4], [6, -9, 3, 3], [-1, -8, 3, 3]].forEach(([dx, dy, w, h], i) => R(x + dx, b + dy, w, h, i % 2 ? '#3a8a50' : '#5ab070'));
        break;
      case 'clock':
        if (stat) {
          g.fillStyle = '#d8e8e0'; g.beginPath(); g.arc(cx, cy, 6, 0, 7); g.fill();
          g.strokeStyle = '#2a3a38'; g.lineWidth = 1; g.beginPath(); g.arc(cx, cy, 6, 0, 7); g.stroke();
          for (let k = 0; k < 12; k++) { const a = (k / 12) * 6.283; R(Math.round(cx + Math.cos(a) * 4.5), Math.round(cy + Math.sin(a) * 4.5), 1, 1, '#5a6a68'); }
        } else {
          // 11:48, always.
          g.strokeStyle = '#1a2422'; g.lineWidth = 1;
          g.beginPath(); g.moveTo(cx + 0.5, cy + 0.5); g.lineTo(cx - 1.5, cy - 2.5); g.stroke();
          g.beginPath(); g.moveTo(cx + 0.5, cy + 0.5); g.lineTo(cx - 3.5, cy + 2.5); g.stroke();
          if ((t >> 5) % 2) R(cx, cy - 4, 1, 4, '#c04040');
        }
        break;
      case 'poster':
        if (!stat) break;
        R(cx - 6, cy - 8, 12, 16, '#c8d8c0'); R(cx - 6, cy - 8, 12, 4, '#4a8a7a'); R(cx - 4, cy - 2, 8, 1, '#7a8a80'); R(cx - 4, cy, 6, 1, '#7a8a80'); R(cx - 4, cy + 2, 7, 1, '#7a8a80'); R(cx - 2, cy + 5, 4, 2, '#c05050');
        R(cx - 1, cy - 9, 2, 1, '#9a9a9a');
        break;
      case 'vending':
        if (stat) {
          R(x - 2, b - 20, 13, 20, '#2a3c48'); R(x - 2, b - 20, 13, 1, '#4a6070'); R(x - 1, b - 18, 8, 13, '#0e1820');
          for (let yy = 0; yy < 4; yy++) for (let xx = 0; xx < 3; xx++) R(x + xx * 2 + 0, b - 17 + yy * 3, 1, 2, ['#e85a5a', '#ffd36b', '#5ab0e8', '#7ad87a'][(xx + yy) % 4]);
          R(x + 8, b - 16, 2, 6, '#5a7080'); R(x - 1, b - 4, 8, 2, '#0a1014');
        } else { g.globalAlpha = 0.15 + 0.05 * Math.sin(t * 0.1); R(x - 1, b - 18, 8, 13, '#9fe8ff'); g.globalAlpha = 1; }
        break;
      case 'window':
        if (!stat && this.flash > 0) { g.fillStyle = `rgba(220,240,255,${this.flash / 14})`; g.fillRect(cx - 13, cy - 15, 26, 30); }
        break;
      case 'sign_number':
        if (stat) { R(x + 3, b - 12, 1, 12, '#5a6a68'); R(x + 1, b - 1, 5, 1, '#3a4a48'); R(x + 1, b - 17, 6, 6, '#c84a4a'); R(x + 2, b - 16, 4, 2, '#1a1a1a'); R(x + 2, b - 13, 4, 1, '#ffe0e0'); }
        else if ((t >> 4) % 2) R(x + 3, b - 16, 2, 1, '#ff6060');
        break;
      case 'cooler':
        if (!stat) break;
        R(x + 1, b - 9, 6, 9, '#d8dce0'); R(x + 1, b - 9, 6, 1, '#ffffff'); R(x + 2, b - 15, 4, 6, '#8fd0ff'); R(x + 2, b - 15, 1, 6, '#c0e8ff'); R(x + 3, b - 16, 2, 1, '#5a9ac0'); R(x + 2, b - 6, 1, 1, '#4a8ad0'); R(x + 5, b - 6, 1, 1, '#d04a4a');
        break;
      case 'tv':
        if (stat) { R(cx - 9, cy - 6, 18, 12, '#1a2222'); R(cx - 1, cy - 9, 2, 3, '#3a4a48'); }
        else {
          for (let yy = 0; yy < 10; yy++) for (let xx = 0; xx < 16; xx += 2) { const v = Math.random(); g.fillStyle = v > 0.5 ? '#9ab8b0' : '#4a6460'; g.fillRect(cx - 8 + xx, cy - 5 + yy, 2, 1); }
        }
        break;
      case 'drawing':
        if (!stat) break;
        R(cx - 6, cy - 5, 12, 10, '#f4f0e0'); R(cx - 5, cy + 2, 10, 2, '#5ab0e8');
        R(cx + 2, cy - 3, 2, 5, '#e85a5a'); R(cx + 2, cy - 4, 2, 1, '#ffd36b');
        R(cx - 4, cy - 1, 1, 3, '#2a2a2a'); R(cx - 2, cy - 2, 2, 4, '#5fb8b0'); R(cx - 2, cy - 3, 2, 1, '#5a3628');
        R(cx - 7, cy - 6, 3, 2, 'rgba(255,255,220,0.6)'); R(cx + 4, cy - 6, 3, 2, 'rgba(255,255,220,0.6)');
        break;
      case 'picnic':
        if (!stat) break;
        R(x, b - 1, 14, 1, '#c84a4a'); R(x + 2, b - 1, 2, 1, '#ffffff'); R(x + 6, b - 1, 2, 1, '#ffffff'); R(x + 10, b - 1, 2, 1, '#ffffff');
        R(x + 2, b - 4, 2, 3, '#f0f0f0'); R(x + 9, b - 4, 2, 3, '#f0f0f0'); R(x + 5, b - 3, 3, 2, '#e8b040');
        break;
      case 'door':
        if (stat) { R(x - 2, b - 22, 14, 22, '#1a2a28'); R(x - 1, b - 21, 12, 21, '#4a6a64'); R(x, b - 20, 10, 19, '#3c5a54'); R(x + 3, b - 18, 4, 5, '#9ad0c0'); R(x - 3, b - 23, 16, 1, '#2a3a38'); }
        else { g.globalAlpha = 0.5 + 0.3 * Math.sin(t * 0.05); R(x - 1, b - 1, 12, 1, '#fff6d0'); g.globalAlpha = 1; }
        break;
      // ---- chapter 2 ----
      case 'antenna':
        if (stat) { R(x + 3, b - 18, 1, 18, '#6a7090'); R(x, b - 14, 7, 1, '#6a7090'); R(x + 1, b - 10, 5, 1, '#6a7090'); R(x + 2, b - 1, 3, 1, '#4a5070'); }
        else if ((t >> 5) % 2) R(x + 3, b - 19, 1, 1, '#ff4d4d');
        break;
      case 'ac':
        if (stat) { R(x, b - 7, 11, 7, '#8a90b0'); R(x, b - 7, 11, 1, '#b8c0e0'); for (let k = 0; k < 4; k++) R(x + 1, b - 5 + k, 5, 1, k % 2 ? '#5a6080' : '#7a80a0'); g.strokeStyle = '#4a5070'; g.beginPath(); g.arc(x + 8.5, b - 3.5, 2, 0, 7); g.stroke(); }
        else { const a = t * 0.3; R(Math.round(x + 8 + Math.cos(a) * 1.5), Math.round(b - 4 + Math.sin(a) * 1.5), 1, 1, '#d8e0ff'); }
        break;
      case 'watertower':
        if (!stat) break;
        R(x - 2, b - 8, 1, 8, '#4a5070'); R(x + 10, b - 8, 1, 8, '#4a5070'); R(x + 4, b - 8, 1, 8, '#3a4060'); R(x - 2, b - 4, 13, 1, '#3a4060');
        R(x - 4, b - 20, 17, 12, '#6a5040'); for (let k = 0; k < 17; k += 3) R(x - 4 + k, b - 20, 1, 12, '#5a4030'); R(x - 4, b - 20, 17, 1, '#8a7060');
        R(x - 5, b - 23, 19, 3, '#4a3a30'); R(x + 3, b - 25, 3, 2, '#4a3a30');
        break;
      case 'lamppost':
        if (stat) { R(x + 3, b - 24, 1, 24, '#3a3e58'); R(x + 1, b - 1, 5, 1, '#2a2e48'); R(x + 3, b - 24, 5, 1, '#3a3e58'); R(x + 6, b - 24, 3, 2, '#2a2e48'); R(x + 6, b - 22, 3, 1, '#fff0b0'); }
        break;
      case 'chimney':
        if (stat) { R(x, b - 12, 7, 12, '#6a3a34'); for (let k = 0; k < 12; k += 3) R(x, b - 12 + k, 7, 1, '#4a2a24'); R(x - 1, b - 13, 9, 2, '#5a5a6a'); }
        else for (let k = 0; k < 4; k++) { const ph = ((t * 0.4 + k * 18) % 72); g.fillStyle = `rgba(160,170,200,${0.35 * (1 - ph / 72)})`; g.fillRect(Math.round(x + 3 + Math.sin((t + k * 30) * 0.03) * 3 + ph * 0.1), Math.round(b - 15 - ph * 0.4), 2 + (ph / 30 | 0), 2); }
        break;
      case 'pipe':
        if (stat) { R(cx - 1, top, 3, 40, '#4a5070'); R(cx - 1, top, 1, 40, '#6a7090'); for (let k = 8; k < 40; k += 14) R(cx - 2, top + k, 5, 2, '#5a6080'); }
        else { const ph = (t * 1.5) % 120; if (ph < 60) R(cx, top + 40 + ph, 1, 2, 'rgba(160,190,255,0.7)'); }
        break;
      case 'lamp2':
        if (stat) { R(x + 2, b - 16, 4, 1, '#3a3e58'); R(x + 3, b - 15, 2, 2, '#3a3e58'); R(x + 2, b - 13, 4, 3, '#ffe9a0'); R(x + 2, b - 13, 1, 3, '#3a3e58'); R(x + 5, b - 13, 1, 3, '#3a3e58'); }
        break;
      case 'crate':
        if (!stat) break;
        R(x, b - 8, 8, 8, '#8a6040'); R(x, b - 8, 8, 1, '#b08060'); R(x, b - 1, 8, 1, '#5a3a24'); R(x, b - 8, 1, 8, '#5a3a24'); R(x + 7, b - 8, 1, 8, '#5a3a24');
        g.strokeStyle = '#5a3a24'; g.lineWidth = 1; g.beginPath(); g.moveTo(x + 1, b - 1); g.lineTo(x + 7, b - 7); g.stroke();
        break;
      case 'billboard':
        if (stat) {
          R(x + 2, b - 8, 1, 8, '#3a3e58'); R(x + 18, b - 8, 1, 8, '#3a3e58');
          R(x - 2, b - 24, 26, 16, '#2a2e48'); R(x - 1, b - 23, 24, 14, '#c8b8d8'); R(x - 1, b - 23, 24, 5, '#5a4a8a');
          R(x + 1, b - 16, 8, 5, '#f0f0ff'); R(x + 1, b - 16, 8, 1, '#a0a0c0'); R(x + 11, b - 16, 10, 1, '#5a4a8a'); R(x + 11, b - 14, 8, 1, '#5a4a8a'); R(x + 11, b - 12, 9, 1, '#5a4a8a');
        } else if (Math.sin(t * 0.07) + Math.sin(t * 0.31) > -1.2) { g.globalAlpha = 0.85; R(x + 1, b - 22, 20, 1, '#ff8ac6'); R(x + 1, b - 20, 14, 1, '#ff8ac6'); g.globalAlpha = 1; }
        break;
      case 'laundry':
        if (stat) {
          R(x - 10, b - 20, 1, 20, '#4a5070'); R(x + 18, b - 20, 1, 20, '#4a5070');
          g.strokeStyle = '#8a90b0'; g.lineWidth = 0.5; g.beginPath(); g.moveTo(x - 9, b - 19); g.quadraticCurveTo(x + 4, b - 15, x + 17, b - 19); g.stroke();
        } else {
          const sw = Math.sin(t * 0.05) * 1;
          // The yellow raincoat, two sizes too big.
          R(Math.round(x - 4 + sw), b - 17, 7, 9, '#ffd84a'); R(Math.round(x - 4 + sw), b - 17, 7, 1, '#fff0a0'); R(Math.round(x - 5 + sw), b - 16, 1, 6, '#e0b030'); R(Math.round(x + 3 + sw), b - 16, 1, 6, '#e0b030'); R(Math.round(x - 1 + sw), b - 14, 1, 5, '#c09020');
          R(Math.round(x + 7 + sw * 0.6), b - 16, 5, 4, '#e8e8f0'); R(Math.round(x + 13 + sw * 0.4), b - 17, 3, 6, '#5a8ad0');
        }
        break;
      case 'phone':
        if (stat) { R(x, b - 16, 9, 16, '#3a4a8a'); R(x, b - 16, 9, 2, '#5a6aaa'); R(x + 1, b - 13, 7, 9, '#0e1430'); R(x + 2, b - 11, 3, 4, '#2a2a2a'); R(x + 6, b - 11, 1, 5, '#2a2a2a'); }
        else if ((t % 120) < 40 && (t >> 2) % 2) { R(Math.round(x + 2 + Math.random() * 2), b - 12, 3, 1, '#2a2a2a'); R(x + 9, b - 14, 2, 1, '#ffd36b'); R(x + 10, b - 12, 2, 1, '#ffd36b'); }
        break;
      case 'bench':
        if (!stat) break;
        R(x, b - 5, 14, 2, '#8a6040'); R(x, b - 5, 14, 1, '#b08060'); R(x, b - 9, 14, 2, '#8a6040'); R(x + 1, b - 3, 1, 3, '#3a3e58'); R(x + 12, b - 3, 1, 3, '#3a3e58'); R(x + 1, b - 9, 1, 4, '#3a3e58'); R(x + 12, b - 9, 1, 4, '#3a3e58');
        break;
      // ---- chapter 3 ----
      case 'candle':
        if (stat) { R(x + 3, b - 5, 2, 5, '#f4ead0'); R(x + 3, b - 5, 1, 5, '#ffffff'); R(x + 2, b - 1, 4, 1, '#c8a040'); R(x + 3, b - 3, 1, 1, '#e0d0b0'); }
        else { const fl = Math.sin(t * 0.3 + p.c) > 0.6 ? 1 : 0; R(x + 3, b - 8 + fl, 2, 3 - fl, '#ffb040'); R(x + 3, b - 7, 1, 1, '#fff0b0'); R(x + 3, b - 6, 1, 1, '#2a1a0a'); }
        break;
      case 'bookpile':
        if (!stat) break;
        [['#7a2e2a', 8, 0], ['#2f4a6a', 7, 1], ['#6a5a24', 6, 0], ['#3e2f5a', 7, 1]].forEach(([c, w, o], i) => { R(x + o, b - 2 - i * 2, w, 2, c); R(x + o, b - 2 - i * 2, 1, 2, '#e8dcc0'); });
        break;
      case 'readlamp':
        if (stat) {
          R(x - 4, b - 7, 16, 2, '#6a4024'); R(x - 4, b - 7, 16, 1, '#a06a3a'); R(x - 3, b - 5, 2, 5, '#4a2a14'); R(x + 9, b - 5, 2, 5, '#4a2a14');
          R(x + 2, b - 13, 1, 6, '#c8a040'); R(x - 1, b - 15, 7, 3, '#2a7a4a'); R(x - 1, b - 15, 7, 1, '#4aaa6a'); R(x + 5, b - 9, 4, 2, '#f4ead0');
        } else R(x, b - 12, 5, 1, '#fff0b0');
        break;
      case 'globe':
        if (!stat) break;
        g.fillStyle = '#2f5a8a'; g.beginPath(); g.arc(x + 4, b - 8, 3.5, 0, 7); g.fill();
        R(x + 3, b - 10, 2, 2, '#5aa06a'); R(x + 5, b - 7, 2, 2, '#5aa06a'); R(x + 1, b - 12, 1, 8, '#c8a040'); R(x + 3, b - 4, 2, 3, '#6a4024'); R(x + 1, b - 1, 6, 1, '#4a2a14');
        break;
      case 'ladder':
        if (!stat) break;
        R(x, top, 1, 70, '#8a5a34'); R(x + 5, top, 1, 70, '#8a5a34'); for (let k = 4; k < 70; k += 6) R(x, top + k, 6, 1, '#a06a3a');
        break;
      case 'lectern':
        if (stat) { R(x + 2, b - 8, 4, 8, '#5a3a22'); R(x, b - 1, 8, 1, '#3a2010'); R(x - 2, b - 11, 12, 3, '#6a4024'); R(x - 1, b - 13, 5, 2, '#f4ead0'); R(x + 4, b - 13, 5, 2, '#e8dcc0'); R(x + 3, b - 13, 1, 2, '#8a7a5a'); }
        else { g.globalAlpha = 0.3 + 0.2 * Math.sin(t * 0.05); R(x - 1, b - 15, 10, 2, '#fff6d0'); g.globalAlpha = 1; }
        break;
      case 'torn':
        if (stat) { R(cx - 8, cy - 6, 16, 12, '#4a2a14'); R(cx - 7, cy - 5, 7, 10, '#e8dcc0'); R(cx, cy - 5, 7, 10, '#e8dcc0'); R(cx, cy - 5, 1, 10, '#8a7a5a'); for (let k = 0; k < 5; k++) R(cx + 1, cy - 4 + k * 2, 2 + (k % 2), 1, '#c8b890'); }
        else for (let k = 0; k < 3; k++) { const a = t * 0.02 + k * 2.1; R(Math.round(cx + Math.cos(a) * 12), Math.round(cy - 8 + Math.sin(a * 1.3) * 6), 3, 2, '#f4ead0'); }
        break;
      // ---- chapter 4 ----
      case 'monitor':
        if (stat) { R(x + 3, b - 9, 1, 9, '#5a3a48'); R(x + 1, b - 1, 5, 1, '#3a2a30'); R(x - 2, b - 17, 12, 9, '#2a1a24'); R(x - 1, b - 16, 10, 7, '#081008'); }
        else {
          for (let k = 0; k < 10; k++) {
            const ph = ((k + t * 0.25) % 10) | 0;
            const yy = ph === 4 ? -3 : ph === 5 ? 2 : 0;
            R(x - 1 + k, b - 12 + yy, 1, 1, '#7aff9a');
          }
        }
        break;
      case 'iv':
        if (!stat) break;
        R(x + 3, b - 22, 1, 22, '#a0a0b0'); R(x, b - 1, 7, 1, '#7a7a8a'); R(x + 1, b - 22, 5, 1, '#a0a0b0');
        R(x + 4, b - 21, 4, 6, 'rgba(220,230,255,0.7)'); R(x + 4, b - 18, 4, 3, 'rgba(255,90,120,0.6)'); R(x + 5, b - 15, 1, 8, 'rgba(255,255,255,0.4)');
        break;
      case 'vein':
        if (!stat) {
          g.globalAlpha = 0.35 + this.beat() * 0.5; g.strokeStyle = '#ff4d6d'; g.lineWidth = 1;
          g.beginPath(); g.moveTo(cx - 10, cy + 6); g.lineTo(cx - 3, cy); g.lineTo(cx + 2, cy + 3); g.lineTo(cx + 9, cy - 6); g.moveTo(cx - 3, cy); g.lineTo(cx - 2, cy - 8); g.moveTo(cx + 2, cy + 3); g.lineTo(cx + 4, cy + 10); g.stroke();
          g.globalAlpha = 1;
        }
        break;
      case 'bed':
        if (stat) {
          R(x - 10, b - 7, 24, 4, '#e8e4f0'); R(x - 10, b - 7, 24, 1, '#ffffff'); R(x - 10, b - 3, 24, 1, '#8a8aa0'); R(x - 8, b - 2, 1, 2, '#6a6a7a'); R(x + 11, b - 2, 1, 2, '#6a6a7a');
          R(x - 10, b - 9, 6, 2, '#ffffff'); R(x + 13, b - 12, 1, 9, '#a0a0b0'); R(x - 11, b - 12, 1, 9, '#a0a0b0'); R(x - 4, b - 8, 14, 2, '#c8c0e0');
        } else {
          // The red ribbon on the bed rail.
          const sw = Math.sin(t * 0.07);
          R(x + 13, b - 11, 2, 2, '#ff3b5c'); R(x + 15, Math.round(b - 10 + sw), 1, 4, '#ff3b5c'); R(x + 14, Math.round(b - 9 - sw), 1, 4, '#b8203c');
        }
        break;
      // ---- epilogue ----
      case 'tree':
        if (!stat) break;
        R(x + 2, b - 14, 4, 14, '#6a4a34'); R(x + 2, b - 14, 1, 14, '#8a6a4a'); R(x - 1, b - 1, 10, 1, '#4a3424');
        [[-6, -30, 20, 12, '#5aa040'], [-8, -24, 24, 10, '#4a8a34'], [-4, -34, 14, 6, '#7ac050'], [-3, -20, 6, 6, '#3e7a30'], [5, -22, 8, 6, '#3e7a30']].forEach(([dx, dy, w, h, c]) => R(x + dx, b + dy, w, h, c));
        for (let k = 0; k < 10; k++) R(x - 6 + ((hash(k, p.c) * 20) | 0), b - 33 + ((hash(k, p.r) * 18) | 0), 1, 1, '#b8f088');
        break;
      case 'bush':
        if (!stat) break;
        R(x - 2, b - 6, 13, 6, '#4a8a34'); R(x, b - 8, 9, 2, '#5aa040'); R(x + 1, b - 7, 1, 1, '#ff8ab0'); R(x + 6, b - 5, 1, 1, '#ffffff'); R(x + 3, b - 4, 1, 1, '#ff8ab0');
        break;
      case 'hospital':
        if (!stat) break;
        R(x - 6, b - 64, 56, 64, '#e8d8d0'); R(x - 6, b - 64, 56, 2, '#fff0e8'); R(x - 6, b - 64, 2, 64, '#c8b8b0');
        for (let yy = 0; yy < 5; yy++) for (let xx = 0; xx < 6; xx++) { R(x - 1 + xx * 8, b - 58 + yy * 10, 5, 6, '#7a9ac8'); R(x - 1 + xx * 8, b - 58 + yy * 10, 5, 1, '#c8e0ff'); if (hash(xx, yy) > 0.7) R(x - 1 + xx * 8, b - 55 + yy * 10, 5, 3, '#ffe0a0'); }
        R(x + 6, b - 12, 16, 12, '#8ab0d8'); R(x + 13, b - 12, 1, 12, '#5a7aa0'); R(x + 4, b - 14, 20, 2, '#c8b8b0');
        R(x + 26, b - 20, 18, 6, '#ffffff'); R(x + 27, b - 19, 2, 4, '#e85a5a'); R(x + 26, b - 18, 4, 2, '#e85a5a'); R(x + 31, b - 18, 11, 1, '#5a6a8a'); R(x + 31, b - 16, 9, 1, '#5a6a8a');
        break;
      case 'bird':
        if (stat) break;
        {
          const bx = (cx + t * 0.35) % (W + 20) - 10, by = cy + Math.sin(t * 0.05 + p.c) * 4, f = (t >> 3) % 2;
          R(Math.round(bx), Math.round(by), 1, 1, '#4a3a4a'); R(Math.round(bx - 2), Math.round(by - f), 2, 1, '#4a3a4a'); R(Math.round(bx + 1), Math.round(by - f), 2, 1, '#4a3a4a');
        }
        break;
    }
  },

  flicker(p) { return Math.sin(World.t * 0.9 + p.c * 3) > 0.97 || (hash(p.c, (World.t / 6) | 0) > 0.985); },

  drawWorld(g) {
    g.drawImage(this.propCanvas, 0, 0);
    for (const p of World.props) this.drawProp(g, p, false);
    g.drawImage(this.tileCanvas, 0, 0);
    const P = this.P;
    for (const cr of World.crumbles) {
      const x0 = cr.c * TILE, y0 = cr.r * TILE;
      if (cr.state === 2) {
        if (cr.t > 110) { g.globalAlpha = (cr.t - 110) / 60; g.strokeStyle = P.light; g.lineWidth = 1; g.strokeRect(x0 + 0.5, y0 + 0.5, 7, 7); g.globalAlpha = 1; }
        continue;
      }
      const sh = cr.state === 1 ? ((Math.random() * 3) | 0) - 1 : 0, x = x0 + sh;
      g.fillStyle = P.mid; g.fillRect(x, y0, TILE, TILE);
      g.fillStyle = P.top; g.fillRect(x, y0, TILE, 1);
      g.fillStyle = P.light; g.fillRect(x, y0 + 1, TILE, 1);
      g.fillStyle = P.deep; g.fillRect(x, y0 + 7, TILE, 1); g.fillRect(x + ((cr.c * 3) % 5) + 1, y0 + 2, 1, 3); g.fillRect(x + ((cr.c * 3) % 5) + 2, y0 + 4, 2, 1);
      g.fillStyle = P.dark; g.fillRect(x + 5, y0 + 4, 2, 2);
      if (cr.state === 1 && World.t % 6 === 0) World.particles.push({ x: x0 + Math.random() * 8, y: y0 + 8, vx: 0, vy: 0.4, g: 0.08, life: 18, max: 18, color: P.light, size: 1 });
    }
  },

  // ======================= Entities =======================
  drawEntities(g, save) {
    const t = World.t, lowFx = Game.options.lowFx;
    for (const s of World.springs) {
      const comp = s.t > 0 ? 2 : 0, x = s.x, y = s.y;
      g.fillStyle = '#5a5e78'; g.fillRect(x + 1, y + 6, 6, 2); g.fillStyle = '#8a8fa8'; g.fillRect(x + 1, y + 6, 6, 1);
      g.fillStyle = '#c9cde0';
      for (let k = 0; k < 2 - comp / 2; k++) g.fillRect(x + 2 + (k % 2), y + 4 + comp + k, 4, 1);
      g.fillStyle = this.P.accent; g.fillRect(x, y + 2 + comp, 8, 2); g.fillStyle = '#ffffff'; g.fillRect(x + 1, y + 2 + comp, 6, 1);
    }
    for (const d of World.crystals) {
      const by = Math.round(Math.sin(t * 0.06 + d.x) * 1.5), x = d.x, y = d.y + by;
      if (d.active) {
        if (!lowFx) this.glow(g, x, y, 10, '#7ff6ff', 0.35);
        diamond(g, x, y, 4.5, 5.5, '#1a5a6a');
        diamond(g, x, y, 3.5, 4.5, '#7ff6ff');
        diamond(g, x - 1, y - 1, 1.5, 2.5, '#e8ffff');
        g.fillStyle = '#3ab8d0'; g.fillRect(x, y, 2, 3);
        if (t % 40 < 4) { g.fillStyle = '#ffffff'; g.fillRect(x + 2, y - 4, 1, 1); }
      } else {
        g.globalAlpha = 0.35; g.strokeStyle = '#7ff6ff'; g.lineWidth = 1;
        g.beginPath(); g.moveTo(x, y - 5); g.lineTo(x + 4, y); g.lineTo(x, y + 5); g.lineTo(x - 4, y); g.closePath(); g.stroke();
        g.globalAlpha = 1;
      }
    }
    for (const f of World.fragments) {
      const have = save.frags[f.id], by = Math.sin(t * 0.05) * 2, x = f.x, y = f.y + by;
      if (have) { g.globalAlpha = 0.25; diamond(g, x, y, 3, 6, '#ffe6f6'); g.globalAlpha = 1; continue; }
      if (!lowFx) this.glow(g, x, y, 12, '#ff8ac6', 0.3 + 0.1 * Math.sin(t * 0.1));
      diamond(g, x, y, 4, 7, '#6a2a4a');
      diamond(g, x, y, 3, 6, '#ffe6f6');
      diamond(g, x + 1, y + 1, 1.5, 3, '#ff8ac6');
      for (let k = 0; k < 2; k++) {
        const a = t * 0.05 + k * Math.PI;
        g.fillStyle = '#ffd6f0'; g.fillRect(Math.round(x + Math.cos(a) * 8), Math.round(y + Math.sin(a) * 4), 1, 1);
      }
    }
    for (const n of World.npcs) this.drawNPC(g, n, t, save);
    // Things you can look at twinkle until you've looked.
    for (const l of World.looks) {
      if (Game.nearTalk === l) this.talkHint(g, l.x, l.y - 22);
      else if (!save.looked[World.room.id + l.key] && (t + l.x) % 90 < 12) { g.fillStyle = '#ffe9a8'; g.fillRect(l.x, l.y - 14, 1, 1); if ((t + l.x) % 90 < 6) { g.fillRect(l.x - 1, l.y - 14, 3, 1); g.fillRect(l.x, l.y - 15, 1, 3); } }
    }
    const h = World.hollow;
    if (h && h.visible) {
      if (t % 3 === 0 && !lowFx) World.particles.push({ x: h.x + rand(0, 6), y: h.y + rand(0, 10), vx: rand(-0.2, 0.2), vy: -rand(0.1, 0.4), g: 0, life: 22, max: 22, color: Math.random() < 0.3 ? '#ff2a4a' : '#1a0612', size: 1 });
      g.globalAlpha = Math.min(1, h.appear / 20) * (0.82 + 0.18 * Math.sin(t * 0.4));
      const fr = { run: 'run' + ((t >> 2) % 4), jump: 'jump', fall: 'fall', dash: 'dash', climb: 'climb' + ((t >> 3) % 2), slide: 'slide' }[h.pose] || 'idle0';
      Sprites.draw(g, 'hollow', fr, Math.round(h.x + 3), Math.round(h.y + 10), h.f < 0);
      g.globalAlpha = 1;
    }
    for (const q of World.particles) {
      g.globalAlpha = Math.min(1, q.life / 15);
      g.fillStyle = q.color; g.fillRect(q.x | 0, q.y | 0, q.size, q.size);
    }
    g.globalAlpha = 1;
  },

  drawNPC(g, n, t, save) {
    const x = n.x, y = n.y, flip = n.face < 0, lowFx = Game.options.lowFx;
    if (n.who === 'remi') {
      const by = Math.round(Math.sin(t * 0.05) * 1.5) - 2;
      if (!lowFx) this.glow(g, x, y - 6, 16, '#ff7a8a', 0.22);
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x - 3, y - 1, 6, 1);
      const fr = t % 200 > 192 ? 'blink' : (t >> 5) % 2 ? 'idle1' : 'idle0';
      Sprites.draw(g, 'remi', fr, x, y + by, flip);
      if (t % 24 === 0) World.burst(x + rand(-3, 3), y - 4, 1, '#ffb0bc', 0.3, -0.01);
    } else if (n.who === 'mom') {
      Sprites.draw(g, 'mom', t % 240 > 232 ? 'blink' : 'idle0', x, y, flip);
    } else {
      const real = World.chapter === 5;
      const helped = save.echoes[n.who];
      if (real) {
        if (helped !== true) return;
        Sprites.draw(g, n.who + '@real', 'idle0', x, y, flip);
        if (n.who === 'walt') Sprites.draw(g, 'lily@real', 'idle0', x + 9, y, true);
      } else {
        const decided = n.kind === 'cameo' || helped !== undefined;
        let a = helped === true ? 0.9 : helped === false ? 0.3 : 0.6;
        if (Math.random() < 0.05) a -= 0.25;
        g.globalAlpha = a;
        Sprites.draw(g, n.who + '@tint', 'idle0', x + (Math.random() < 0.03 ? 1 : 0), y, flip);
        g.globalAlpha = 1;
        if (helped === true && t % 20 === 0) World.burst(x, y - 10, 1, '#ffffff', 0.4, -0.01);
        if (!decided && !n.done) {
          const bob = Math.round(Math.sin(t * 0.1));
          g.fillStyle = '#ffe9a8'; g.fillRect(x - 1, y - 22 + bob, 2, 4); g.fillRect(x - 1, y - 17 + bob, 2, 1);
        }
      }
    }
    if (Game.nearTalk === n) this.talkHint(g, x, y - (n.who === 'remi' ? 22 : 20));
  },

  talkHint(g, x, y) {
    const bob = Math.round(Math.sin(World.t * 0.15));
    g.fillStyle = '#05060c'; g.fillRect(x - 4, y - 5 + bob, 9, 7);
    g.fillStyle = '#ffe9a8'; g.fillRect(x - 3, y - 4 + bob, 7, 5); g.fillRect(x - 1, y + 1 + bob, 2, 1);
    g.fillStyle = '#05060c'; g.fillRect(x - 2, y - 2 + bob, 1, 1); g.fillRect(x, y - 2 + bob, 1, 1); g.fillRect(x + 2, y - 2 + bob, 1, 1);
  },

  // ======================= Lighting =======================
  glowSprite(r, color) {
    const k = r + color;
    if (this.glowCache[k]) return this.glowCache[k];
    const c = makeCanvas(r * 2, r * 2), g = c.getContext('2d');
    const grad = g.createRadialGradient(r, r, 0, r, r, r);
    grad.addColorStop(0, color); grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad; g.fillRect(0, 0, r * 2, r * 2);
    return (this.glowCache[k] = c);
  },
  glow(g, x, y, r, color, a) {
    g.globalAlpha = a; g.drawImage(this.glowSprite(r, color), Math.round(x - r), Math.round(y - r)); g.globalAlpha = 1;
  },

  collectLights(player) {
    const L = [], t = World.t, save = Game.save;
    if (player && !player.dead) L.push([player.x + 3, player.y + 5, 44, 0.9, '#fff0e0']);
    for (const p of World.props) {
      const cx = p.c * 8 + 4, cy = p.r * 8 + 4, b = p.y;
      switch (p.kind) {
        case 'lamp': if (!this.flicker(p)) L.push([cx, p.r * 8 + 12, 64, 0.9, '#d8fff0']); break;
        case 'vending': L.push([p.x + 4, b - 12, 30, 0.6, '#9fe8ff']); break;
        case 'tv': L.push([cx, cy, 28, 0.5 + Math.random() * 0.2, '#b0d0ff']); break;
        case 'door': L.push([p.x + 5, b - 2, 26, 0.7, '#fff6d0']); break;
        case 'window': L.push([cx, cy, 30, this.flash > 0 ? 1 : 0.35, '#a0c8ff']); break;
        case 'lamppost': L.push([p.x + 7, b - 20, 54, 0.85, '#ffe0a0']); break;
        case 'lamp2': L.push([p.x + 4, b - 11, 36, 0.8, '#ffe9a0']); break;
        case 'billboard': L.push([p.x + 11, b - 16, 36, 0.6, '#ff8ac6']); break;
        case 'antenna': if ((t >> 5) % 2) L.push([p.x + 3, b - 19, 10, 0.6, '#ff4d4d']); break;
        case 'phone': L.push([p.x + 4, b - 9, 18, 0.5, '#8fa0ff']); break;
        case 'candle': L.push([p.x + 4, b - 7, 30 + Math.sin(t * 0.3 + p.c) * 3, 0.85, '#ffb040']); break;
        case 'readlamp': L.push([p.x + 2, b - 10, 40, 0.85, '#ffe0a0']); break;
        case 'lectern': L.push([p.x + 4, b - 14, 30, 0.7, '#fff6d0']); break;
        case 'torn': L.push([cx, cy, 26, 0.5, '#fff0d0']); break;
        case 'monitor': L.push([p.x + 4, b - 12, 26, 0.7, '#7aff9a']); break;
        case 'vein': L.push([cx, cy, 30, 0.3 + this.beat() * 0.5, '#ff4d6d']); break;
        case 'bed': L.push([p.x + 2, b - 10, 44, 0.6, '#fff0f0']); break;
      }
    }
    for (const d of World.crystals) if (d.active) L.push([d.x, d.y, 26, 0.75, '#7ff6ff']);
    for (const f of World.fragments) if (!save.frags[f.id]) L.push([f.x, f.y, 30, 0.75, '#ff8ac6']);
    for (const n of World.npcs) {
      if (n.who === 'remi') L.push([n.x, n.y - 6, 40, 0.8, '#ff7a8a']);
      else if (World.chapter !== 5) L.push([n.x, n.y - 6, 22, save.echoes[n.who] ? 0.6 : 0.3, '#c9c2ec']);
    }
    if (this.ch === 4) L.push([W / 2, 78, 120, 0.25 + this.beat() * 0.3, '#ff2a4a']);
    return L;
  },

  drawLighting(g, player) {
    const amb = this.P.ambient;
    if (!amb || Game.options.lowFx) return;
    const lights = this.collectLights(player);
    const lg = this.lightCanvas.getContext('2d');
    lg.globalCompositeOperation = 'source-over';
    lg.clearRect(0, 0, W, H);
    lg.fillStyle = amb; lg.fillRect(0, 0, W, H);
    lg.globalCompositeOperation = 'destination-out';
    for (const [x, y, r, a] of lights) { lg.globalAlpha = a; lg.drawImage(this.glowSprite(Math.round(r), '#ffffff'), Math.round(x - r), Math.round(y - r)); }
    lg.globalAlpha = 1; lg.globalCompositeOperation = 'source-over';
    g.drawImage(this.lightCanvas, 0, 0);
    g.globalCompositeOperation = 'lighter';
    for (const [x, y, r, a, c] of lights) { g.globalAlpha = a * 0.16; g.drawImage(this.glowSprite(Math.round(r * 0.7), c), Math.round(x - r * 0.7), Math.round(y - r * 0.7)); }
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  },

  drawPost(g) {
    if (this.ch === 5 && !Game.options.lowFx) {
      // Morning light rays.
      g.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 5; k++) {
        const a = 0.035 + 0.02 * Math.sin(World.t * 0.01 + k);
        g.fillStyle = `rgba(255,230,180,${a})`;
        g.beginPath(); g.moveTo(150 + k * 30 - 40, 0); g.lineTo(150 + k * 30 - 20, 0); g.lineTo(60 + k * 60, H); g.lineTo(30 + k * 60, H); g.closePath(); g.fill();
      }
      g.globalCompositeOperation = 'source-over';
    }
    g.drawImage(this.vignette, 0, 0);
  },

  // ======================= Title screen =======================
  // A hospital room at night: rain on the window, the monitor, the ribbon on the bed rail.
  title(g, t) {
    const sky = g.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#05070f'); sky.addColorStop(1, '#0d1422');
    g.fillStyle = sky; g.fillRect(0, 0, W, H);
    // Window.
    const wx = 30, wy = 22, ww = 120, wh = 96;
    const wg = g.createLinearGradient(0, wy, 0, wy + wh);
    const dawn = Math.min(1, (Achievements.has('end_true') ? 1 : 0.25));
    wg.addColorStop(0, '#0a1430'); wg.addColorStop(1, dawn > 0.5 ? '#c87a6a' : '#1c2a48');
    g.fillStyle = wg; g.fillRect(wx, wy, ww, wh);
    for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(255,255,255,${0.2 + hash(i, 9) * 0.5})`; g.fillRect(wx + ((hash(i, 1) * ww) | 0), wy + ((hash(i, 2) * wh * 0.6) | 0), 1, 1); }
    g.fillStyle = '#0a0e1c';
    for (let x = 0; x < ww; x += 9) { const h = 14 + hash(x, 3) * 34; g.fillRect(wx + x, wy + wh - h, 8, h); }
    g.fillStyle = '#e8c870';
    for (let i = 0; i < 50; i++) if (hash(i, 4) > 0.4) g.fillRect(wx + ((hash(i, 5) * ww) | 0), wy + wh - ((hash(i, 6) * 40) | 0), 1, 1);
    g.fillStyle = 'rgba(170,200,240,0.4)';
    for (let i = 0; i < 40; i++) { const x = (hash(i, 7) * ww + t * 0.4) % ww, y = (hash(i, 8) * wh + t * (3 + hash(i, 9) * 2)) % wh; g.fillRect(wx + (x | 0), wy + (y | 0), 1, 3); }
    // Drops on the glass.
    for (let i = 0; i < 14; i++) {
      const x = wx + hash(i, 10) * ww, y = wy + ((hash(i, 11) * wh + t * 0.08 * (1 + hash(i, 12))) % wh);
      g.fillStyle = 'rgba(200,220,255,0.35)'; g.fillRect(x | 0, y | 0, 2, 2); g.fillStyle = 'rgba(200,220,255,0.15)'; g.fillRect(x | 0, (y - 4) | 0, 1, 4);
    }
    g.fillStyle = '#1a2032'; g.fillRect(wx - 4, wy - 4, ww + 8, 4); g.fillRect(wx - 4, wy + wh, ww + 8, 6); g.fillRect(wx - 4, wy, 4, wh); g.fillRect(wx + ww, wy, 4, wh); g.fillRect(wx + ww / 2 - 1, wy, 3, wh); g.fillRect(wx, wy + wh / 2 - 1, ww, 2);
    g.fillStyle = '#2a3248'; g.fillRect(wx - 6, wy + wh + 4, ww + 12, 2);
    // Moonlight on the floor.
    g.fillStyle = 'rgba(150,180,255,0.06)';
    g.beginPath(); g.moveTo(wx, wy + wh); g.lineTo(wx + ww, wy + wh); g.lineTo(wx + ww + 80, H); g.lineTo(wx + 40, H); g.closePath(); g.fill();
    // Monitor.
    const mx = 238, my = 64;
    g.fillStyle = '#141824'; g.fillRect(mx, my, 44, 30); g.fillStyle = '#04100a'; g.fillRect(mx + 3, my + 3, 38, 22);
    g.fillStyle = 'rgba(122,255,154,0.08)'; g.fillRect(mx - 10, my - 10, 64, 50);
    for (let k = 0; k < 38; k++) {
      const ph = ((k + t * 0.35) % 38) | 0;
      const yy = ph === 18 ? -7 : ph === 19 ? 5 : ph === 23 ? -2 : 0;
      g.fillStyle = k > 34 ? '#e0ffe8' : '#7aff9a'; g.fillRect(mx + 3 + ((k + (t * 0.35 | 0)) % 38), my + 15 + yy, 1, 1);
    }
    g.fillStyle = '#7aff9a'; g.font = `6px ${FONT}`; g.fillText('62', mx + 33, my + 9);
    g.fillStyle = '#3a4058'; g.fillRect(mx + 20, my + 30, 3, 40);
    // Bed rail + ribbon in the foreground.
    g.fillStyle = '#7a8098'; g.fillRect(180, 140, 140, 3); g.fillRect(186, 128, 3, 56); g.fillRect(300, 128, 3, 56); g.fillRect(180, 128, 140, 2);
    g.fillStyle = '#4a5068'; g.fillRect(180, 143, 140, 1);
    g.fillStyle = '#2a3046'; g.fillRect(170, 150, 150, 34); g.fillStyle = '#4a5270'; g.fillRect(170, 150, 150, 2);
    g.fillStyle = '#323a54'; for (let k = 0; k < 6; k++) g.fillRect(180 + k * 24, 156 + (k % 2) * 6, 14, 1);
    const sw = Math.sin(t * 0.05) * 2;
    g.fillStyle = '#ff3b5c'; g.fillRect(222, 126, 5, 5); g.fillRect(218, 127, 4, 3); g.fillRect(227, 127, 4, 3);
    g.fillStyle = '#b8203c'; g.fillRect(223, 127, 3, 3);
    g.fillStyle = '#ff3b5c'; g.fillRect(Math.round(222 + sw * 0.3), 131, 2, 10); g.fillRect(Math.round(226 + sw * 0.6), 131, 2, 12);
    g.fillStyle = '#b8203c'; g.fillRect(Math.round(222 + sw * 0.5), 141, 2, 2); g.fillRect(Math.round(226 + sw), 143, 2, 2);
    if (!Game.options.lowFx) { g.globalCompositeOperation = 'lighter'; this.glow(g, 224, 132, 18, '#ff3b5c', 0.25); g.globalCompositeOperation = 'source-over'; }
    g.drawImage(this.vignette, 0, 0);
  },

  // ======================= Story scenes (slides) =======================
  // Drawn into a 160x80 panel; t counts frames since the slide appeared.
  scene(g, name, t) {
    const R = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
    switch (name) {
      case 'cake': {
        R(0, 0, 160, 80, '#1a1418'); R(0, 0, 160, 54, '#2a2028');
        R(20, 10, 34, 26, '#0c1020'); R(36, 10, 2, 26, '#3a3038'); R(20, 22, 34, 2, '#3a3038');
        for (let i = 0; i < 10; i++) R(20 + ((hash(i, 1) * 34) | 0), 10 + ((hash(i, 2) * 12) | 0), 1, 1, '#c8c8e8');
        g.fillStyle = '#e8e0d0'; g.beginPath(); g.arc(120, 18, 8, 0, 7); g.fill(); R(120, 11, 1, 7, '#2a2028'); R(120, 18, 5, 1, '#2a2028');
        R(10, 54, 140, 4, '#6a4a34'); R(10, 54, 140, 1, '#8a6a4a'); R(18, 58, 3, 22, '#4a3424'); R(139, 58, 3, 22, '#4a3424');
        R(60, 40, 30, 14, '#f4ead0'); R(60, 40, 30, 2, '#ffffff'); R(73, 40, 4, 14, '#ff3b5c'); R(60, 46, 30, 3, '#ff3b5c');
        R(70, 35, 4, 5, '#ff3b5c'); R(76, 35, 4, 5, '#ff3b5c'); R(74, 37, 2, 3, '#b8203c');
        R(100, 48, 10, 6, '#e8e8f0'); R(112, 50, 10, 4, '#e8e8f0');
        break;
      }
      case 'clock': {
        R(0, 0, 160, 80, '#0c0a10');
        R(46, 22, 68, 30, '#1a1a22'); R(50, 26, 60, 22, '#080608');
        g.fillStyle = (t >> 5) % 2 ? '#ff3a3a' : '#c02a2a'; g.font = `24px ${FONT}`; g.textAlign = 'center'; g.fillText('11:48', 80, 46); g.textAlign = 'left';
        R(0, 70, 160, 10, '#141018');
        break;
      }
      case 'sixseven': {
        R(0, 0, 160, 80, '#0c0a10');
        R(46, 22, 68, 30, '#1a1a22'); R(50, 26, 60, 22, '#080608');
        g.fillStyle = (t >> 4) % 2 ? '#ff3a3a' : '#c02a2a'; g.font = `24px ${FONT}`; g.textAlign = 'center'; g.fillText((t >> 5) % 2 ? '6 7' : '6:7', 80, 46); g.textAlign = 'left';
        R(0, 70, 160, 10, '#141018');
        break;
      }
      case 'rain': {
        R(0, 0, 160, 80, '#05070c'); R(0, 56, 160, 24, '#101420');
        for (let k = 0; k < 8; k++) R(k * 22 - (t % 22), 66, 10, 1, '#c8c060');
        const glow = Math.min(1, t / 90);
        g.globalAlpha = glow; const gg = g.createRadialGradient(140, 58, 1, 140, 58, 70); gg.addColorStop(0, 'rgba(255,250,220,0.95)'); gg.addColorStop(1, 'rgba(255,250,220,0)'); g.fillStyle = gg; g.fillRect(0, 0, 160, 80); g.globalAlpha = 1;
        R(132, 56, 5, 3, '#ffffff'); R(148, 56, 5, 3, '#ffffff');
        R(40, 46, 3, 10, '#1a1420'); R(39, 42, 5, 4, '#1a1420');
        g.fillStyle = 'rgba(180,200,240,0.5)';
        for (let i = 0; i < 50; i++) { const x = (hash(i, 1) * 160 + t * 0.5) % 160, y = (hash(i, 2) * 80 + t * 4) % 80; g.fillRect(x | 0, y | 0, 1, 3); }
        break;
      }
      case 'ecg': {
        R(0, 0, 160, 80, '#020604');
        for (let x = 0; x < 160; x += 16) R(x, 0, 1, 80, '#06140a');
        for (let y = 0; y < 80; y += 16) R(0, y, 160, 1, '#06140a');
        const head = (t * 1.6) % 160;
        for (let x = 0; x < 160; x++) {
          const ph = (x % 53) / 53;
          let y = 42;
          if (ph > 0.4 && ph < 0.45) y = 20; else if (ph >= 0.45 && ph < 0.5) y = 56; else if (ph > 0.65 && ph < 0.72) y = 38;
          const age = (head - x + 160) % 160;
          if (age > 120) continue;
          g.fillStyle = age < 3 ? '#e0ffe8' : `rgba(122,255,154,${1 - age / 120})`; g.fillRect(x, y, 1, 2);
        }
        break;
      }
      case 'ribbon': {
        R(0, 0, 160, 80, '#0a0a12');
        R(0, 40, 160, 3, '#a0a4b0'); R(0, 43, 160, 1, '#5a5e6a'); R(30, 40, 3, 40, '#a0a4b0'); R(130, 40, 3, 40, '#a0a4b0');
        const sw = Math.sin(t * 0.05) * 2;
        R(76, 37, 7, 7, '#ff3b5c'); R(70, 38, 6, 4, '#ff3b5c'); R(83, 38, 6, 4, '#ff3b5c'); R(78, 38, 3, 4, '#b8203c');
        R(Math.round(77 + sw * 0.3), 44, 2, 16, '#ff3b5c'); R(Math.round(81 + sw * 0.6), 44, 2, 20, '#ff3b5c');
        R(40, 60, 46, 8, '#f0c4a0'); R(40, 60, 46, 2, '#ffd8b8'); R(86, 58, 8, 12, '#5fb8b0');
        break;
      }
      case 'phone': {
        // A dark bedroom, a phone glowing in someone's hands, a video looping on it.
        R(0, 0, 160, 80, '#06060c'); R(0, 62, 160, 18, '#0c0c16');
        g.globalCompositeOperation = 'lighter'; Art.glow(g, 80, 36, 46, '#4a6aff', 0.22); g.globalCompositeOperation = 'source-over';
        R(64, 6, 32, 58, '#1a1a24'); R(66, 9, 28, 50, '#000000'); R(76, 7, 8, 1, '#2a2a36');
        // The video: a little ticking clock that bounces to the beat.
        const bob = Math.abs(Math.sin(t * 0.12)) * 3;
        g.fillStyle = (t >> 5) % 2 ? '#25f4ee' : '#fe2c55'; g.fillRect(66, 9, 28, 50); g.fillStyle = '#000000'; g.fillRect(67, 10, 26, 48);
        g.fillStyle = '#e8e0d0'; g.beginPath(); g.arc(80, 28 - bob, 7, 0, 7); g.fill();
        R(80, 22 - bob, 1, 6, '#1a1418'); R(80, 28 - bob, 4, 1, '#1a1418');
        R(90, 26, 2, 2, '#ffffff'); R(90, 33, 2, 2, '#ffffff'); R(90, 40, 2, 2, '#ffffff');
        g.font = `6px ${FONT}`; g.fillStyle = '#ffffff'; g.fillText('@slimthiccrayen', 68, 48); g.fillStyle = '#9aa0bc'; g.fillText((t >> 5) % 2 ? 'tok' : 'tik...', 68, 55);
        R(67, 57, Math.round(((t % 240) / 240) * 26), 1, '#ffffff');
        // Hands, and the blanket pulled up to the chin.
        R(60, 50, 8, 8, '#f2c8a0'); R(92, 50, 8, 8, '#f2c8a0'); R(30, 62, 100, 18, '#3c4c74'); R(30, 62, 100, 1, '#6a7ca8');
        break;
      }
      case 'dawn': {
        const k = Math.min(1, t / 240);
        const gg = g.createLinearGradient(0, 0, 0, 80);
        gg.addColorStop(0, rgb(mixc(hex('#0a1430'), hex('#5a7ac0'), k))); gg.addColorStop(1, rgb(mixc(hex('#1c2a48'), hex('#ffc890'), k)));
        g.fillStyle = gg; g.fillRect(0, 0, 160, 80);
        g.fillStyle = '#fff6e0'; g.beginPath(); g.arc(80, 86 - k * 22, 12, 0, 7); g.fill();
        R(0, 66, 160, 14, rgb(mixc(hex('#0a0e1c'), hex('#7a5068'), k)));
        for (let x = 0; x < 160; x += 11) { const h = 6 + hash(x, 1) * 16; R(x, 66 - h, 9, h, rgb(mixc(hex('#0a0e1c'), hex('#7a5068'), k))); }
        R(0, 0, 160, 3, '#1a1e2a'); R(0, 77, 160, 3, '#1a1e2a'); R(0, 0, 3, 80, '#1a1e2a'); R(157, 0, 3, 80, '#1a1e2a'); R(79, 0, 2, 80, '#1a1e2a');
        break;
      }
      case 'between': {
        R(0, 0, 160, 80, '#0a0612');
        for (let i = 0; i < 30; i++) { const y = (hash(i, 1) * 80 - t * (0.1 + hash(i, 2) * 0.3) + 800) % 80; R((hash(i, 3) * 160) | 0, y | 0, 1 + ((hash(i, 4) * 2) | 0), 1, '#b7b0d8'); }
        g.globalAlpha = 0.5; Sprites.draw(g, 'eli', 'fall', 80, 50 + Math.sin(t * 0.03) * 3); g.globalAlpha = 1;
        break;
      }
    }
  },
};

function diamond(g, x, y, rw, rh, color) {
  g.fillStyle = color;
  g.beginPath(); g.moveTo(x, y - rh); g.lineTo(x + rw, y); g.lineTo(x, y + rh); g.lineTo(x - rw, y); g.closePath(); g.fill();
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}
