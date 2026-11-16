'use strict';
// Core: constants, storage, input (keyboard + gamepad), synthesized sound and music.
const W = 320, H = 184, TILE = 8, COLS = 40, ROWS = 23;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const approach = (v, t, d) => (v < t ? Math.min(v + d, t) : Math.max(v - d, t));
const rand = (a, b) => a + Math.random() * (b - a);

const Store = {
  get(k, def) {
    try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch (e) { return def; }
  },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } },
};

// Flips PHYS.AIR_JUMPS between 1 and 2 (PHYS lives in player.js, loaded later).
function toggleTripleJump() {
  if (typeof PHYS === 'undefined') return;
  PHYS.AIR_JUMPS = PHYS.AIR_JUMPS > 1 ? 1 : 2;
  const p = typeof Game !== 'undefined' && Game.player;
  if (p) p.airJumps = Math.min(p.airJumps + (PHYS.AIR_JUMPS > 1 ? 1 : 0), PHYS.AIR_JUMPS);
  Achievements.toasts.push({ a: { name: PHYS.AIR_JUMPS > 1 ? 'Triple jump: ON' : 'Triple jump: OFF', icon: 'wings', tier: 'silver' }, head: 'WOW', t: 0 });
  if (PHYS.AIR_JUMPS > 1) Achievements.unlock('wow');
  Sound.play('djump');
}

const Input = {
  keys: {}, down: {}, prev: {}, stick: null, lastDigit: null, secret: false, typed: '', latch: {}, raw: {},
  // Mouse, for the menus and the title scene. cx/cy are client pixels; Game maps them to x/y.
  mouse: { cx: 0, cy: 0, x: W / 2, y: H / 2, active: false, moved: false, click: false, down: false, still: 0 },
  pending: { move: false, click: false, wheel: 0 },
  map: {
    left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'],
    up: ['ArrowUp'], down: ['ArrowDown', 'KeyS'],
    interact: ['ArrowUp', 'KeyE'],
    jump: ['KeyW', 'Space', 'KeyK'],
    // Up arrow also jumps, but only in play (menus use it to move the cursor) and
    // not while climbing or standing by someone to talk to; see Player.update.
    jumpAlt: ['ArrowUp'],
    dash: ['KeyX', 'KeyJ'],
    sprint: ['ShiftLeft', 'ShiftRight'],
    grab: ['KeyZ', 'KeyV', 'KeyL'],
    pause: ['Escape', 'KeyP', 'Enter'],
    confirm: ['Enter', 'KeyC', 'Space', 'KeyZ'],
    back: ['Escape', 'Backspace', 'KeyX'],
    mute: ['KeyM'],
    tabPrev: ['KeyQ', 'PageUp'], tabNext: ['KeyE', 'Tab', 'PageDown'],
  },
  init() {
    addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (e.code.startsWith('Arrow') || e.code === 'Space' || e.code === 'Tab') e.preventDefault();
      // Secret: 6 then 7, back to back (top row or numpad).
      if (!e.repeat) {
        const d = /^(Digit|Numpad)([0-9])$/.exec(e.code);
        const k = d ? d[2] : null;
        if (k === '7' && this.lastDigit === '6') this.secret = true;
        this.lastDigit = k;
        // Secret: type "wow" to toggle a triple jump (two air jumps instead of one).
        const l = /^Key([A-Z])$/.exec(e.code);
        this.typed = (this.typed + (l ? l[1] : ' ')).slice(-3);
        if (this.typed === 'WOW') { this.typed = ''; toggleTripleJump(); }
      }
      Sound.unlock();
    });
    addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    addEventListener('blur', () => { this.keys = {}; });
    addEventListener('mousemove', (e) => {
      if (document.pointerLockElement) return;
      this.mouse.cx = e.clientX; this.mouse.cy = e.clientY;
      this.mouse.active = true; this.pending.move = true;
    });
    // The wheel scrolls lists outside of play, one row per notch.
    addEventListener('wheel', (e) => { if (e.deltaY) this.pending.wheel += Math.sign(e.deltaY); }, { passive: true });
    document.addEventListener('mouseleave', () => { this.mouse.active = false; });
    // Clicks drive the menus. During play, clicking hides and locks the cursor instead
    // (play itself is keyboard/gamepad only).
    addEventListener('pointerdown', (e) => {
      Sound.unlock();
      if (document.pointerLockElement) return;
      if (typeof Game !== 'undefined' && Game.state !== 'play') {
        if (e.button === 0) { this.mouse.cx = e.clientX; this.mouse.cy = e.clientY; this.mouse.active = true; this.mouse.down = true; this.pending.click = true; }
        return;
      }
      const el = document.getElementById('screen') || document.documentElement;
      try {
        const r = el.requestPointerLock && el.requestPointerLock();
        if (r && r.catch) r.catch(() => { /* browser refused (e.g. clicked too soon after Esc) */ });
      } catch (e) { /* pointer lock unsupported */ }
    });
    addEventListener('pointerup', () => { this.mouse.down = false; });
    addEventListener('contextmenu', (e) => e.preventDefault());
  },
  update() {
    this.prev = this.down;
    this.stick = null;
    const m = this.mouse;
    m.moved = this.pending.move; m.click = this.pending.click; m.wheel = this.pending.wheel;
    this.pending.move = this.pending.click = false; this.pending.wheel = 0;
    m.still = m.moved ? 0 : m.still + 1;
    const d = {};
    for (const a in this.map) d[a] = this.map[a].some((k) => this.keys[k]);
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (!p) continue;
      const b = (i) => p.buttons[i] && p.buttons[i].pressed;
      const ax = p.axes[0] || 0, ay = p.axes[1] || 0;
      if (b(14) || ax < -0.4) d.left = true;
      if (b(15) || ax > 0.4) d.right = true;
      if (b(12) || ay < -0.4) { d.up = true; d.interact = true; }
      if (b(13) || ay > 0.4) d.down = true;
      if (b(0)) { d.jump = true; d.confirm = true; }
      if (b(2)) d.dash = true;
      if (b(1)) { d.dash = true; d.back = true; }
      if (b(3) || b(4) || b(5)) d.grab = true;
      if (b(4)) d.tabPrev = true;
      if (b(5)) d.tabNext = true;
      if (b(6) || b(7) || b(10)) d.sprint = true;
      if (b(9)) d.pause = true;
      // Right stick looks around the title scene.
      if (Math.hypot(p.axes[2] || 0, p.axes[3] || 0) > 0.2) this.stick = [p.axes[2], p.axes[3]];
    }
    // Grab and sprint can be set to toggle: one press latches the action on until the next.
    const playing = typeof Game !== 'undefined' && Game.state === 'play';
    for (const a of ['grab', 'sprint']) {
      const toggle = playing && Game.options[a + 'Toggle'];
      if (!toggle) this.latch[a] = false;
      else if (d[a] && !this.raw[a]) this.latch[a] = !this.latch[a];
      this.raw[a] = d[a];
      if (toggle) d[a] = this.latch[a];
    }
    this.down = d;
  },
  takeSecret() { const s = this.secret; this.secret = false; return s; },
  held(a) { return !!this.down[a]; },
  pressed(a) { return !!this.down[a] && !this.prev[a]; },
  // Mark every currently held action as already handled, so a key that closes
  // a menu doesn't also act in the next state.
  flush() { this.prev = Object.assign({}, this.down); },
};

const Sound = {
  ctx: null, master: null, muted: Store.get('bs_muted', false),
  masterVol: Store.get('bs_master', 1), musicVol: Store.get('bs_mvol', 1), sfxVol: Store.get('bs_svol', 1), voiceVol: Store.get('bs_vvol', 1),
  gain() { return this.muted ? 0 : 0.5 * this.masterVol; },
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.gain();
      this.master.connect(this.ctx.destination);
      this.sfx = this.ctx.createGain();
      this.sfx.gain.value = this.sfxVol;
      this.sfx.connect(this.master);
      this.voice = this.ctx.createGain();
      this.voice.gain.value = this.voiceVol;
      this.voice.connect(this.master);
    } catch (e) { this.ctx = null; }
    Music.play();
  },
  toggle() {
    this.muted = !this.muted;
    Store.set('bs_muted', this.muted);
    if (this.master) this.master.gain.value = this.gain();
  },
  // kind: master, music, sfx or voice.
  setVol(kind, v) {
    this[kind + 'Vol'] = v;
    Store.set({ master: 'bs_master', music: 'bs_mvol', sfx: 'bs_svol', voice: 'bs_vvol' }[kind], v);
    if (this.master) { this.master.gain.value = this.gain(); this.sfx.gain.value = this.sfxVol; this.voice.gain.value = this.voiceVol; }
  },
  tone(f, dur, type = 'square', vol = 0.1, slideTo = 0, delay = 0, out = this.sfx) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g); g.connect(out);
    o.start(t); o.stop(t + dur + 0.02);
  },
  noiseBuf() {
    if (!this.nbuf) {
      this.nbuf = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
      const d = this.nbuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    return this.nbuf;
  },
  noise(dur, vol = 0.15, freq = 1200) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const s = this.ctx.createBufferSource(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
    s.buffer = this.noiseBuf(); f.type = 'lowpass'; f.frequency.value = freq;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    s.connect(f); f.connect(g); g.connect(this.sfx);
    s.start(t); s.stop(t + dur + 0.02);
  },
  // A failing fluorescent tube: mains hum that stutters on and off, with a tick at each catch.
  // Returns the [start, length] seconds of each burst so the screen can twitch along with it.
  flicker() {
    if (!this.ctx) return [];
    const ctx = this.ctx, t0 = ctx.currentTime + 0.02, g = ctx.createGain(), bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 240; bp.Q.value = 1.2;
    g.gain.setValueAtTime(0, t0);
    const hum = [100, 120.5].map((f) => { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.connect(bp); return o; });
    bp.connect(g); g.connect(this.sfx);
    let t = t0;
    const segs = [];
    const n = 3 + ((Math.random() * 5) | 0);
    for (let i = 0; i < n; i++) {
      const on = rand(0.02, 0.12), off = rand(0.03, 0.22), v = rand(0.025, 0.05);
      g.gain.setValueAtTime(v, t); g.gain.setValueAtTime(0, t + on);
      this.tick(t, v * 2.4);
      segs.push([t - t0, on]);
      t += on + off;
    }
    // Sometimes it catches and buzzes for a moment before dying again.
    if (Math.random() < 0.5) {
      const v = rand(0.02, 0.035), len = rand(0.6, 1.4);
      g.gain.setValueAtTime(v, t); g.gain.linearRampToValueAtTime(0, t + len); this.tick(t, v * 2.4);
      segs.push([t - t0, len]); t += len;
    }
    hum.forEach((o) => { o.start(t0); o.stop(t + 0.05); });
    return segs;
  },
  tick(t, vol) {
    const s = this.ctx.createBufferSource(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
    s.buffer = this.noiseBuf(); f.type = 'highpass'; f.frequency.value = 3000;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + 0.025);
    s.connect(f); f.connect(g); g.connect(this.sfx);
    s.start(t, Math.random() * 0.5); s.stop(t + 0.04);
  },
  // Each speaker has their own voice blip, Undertale-style.
  talk(pitch, type = 'square') { this.tone(pitch * rand(0.95, 1.05), 0.045, type, 0.022, 0, 0, this.voice); },
  play(name) {
    switch (name) {
      case 'jump': this.tone(220, 0.12, 'square', 0.05, 440); break;
      case 'djump': this.tone(330, 0.1, 'triangle', 0.06, 660); this.noise(0.08, 0.05, 1200); break;
      case 'walljump': this.tone(260, 0.12, 'square', 0.05, 520); break;
      case 'dash': this.noise(0.18, 0.18, 2500); this.tone(500, 0.15, 'sawtooth', 0.04, 160); break;
      case 'land': this.noise(0.05, 0.06, 600); break;
      case 'death': this.noise(0.4, 0.25, 900); this.tone(300, 0.4, 'square', 0.06, 60); break;
      case 'spring': this.tone(200, 0.25, 'triangle', 0.12, 800); break;
      case 'refill': this.tone(880, 0.1, 'triangle', 0.08); this.tone(1320, 0.15, 'triangle', 0.06, 0, 0.06); break;
      case 'crumble': this.noise(0.15, 0.08, 400); break;
      case 'fragment': [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.4, 'triangle', 0.07, 0, i * 0.08)); break;
      case 'talk': this.tone(rand(380, 460), 0.04, 'square', 0.025); break;
      case 'step': this.noise(0.03, 0.025, 500); break;
      case 'hollow': this.tone(55, 1.6, 'sawtooth', 0.08, 41); this.tone(58, 1.6, 'sawtooth', 0.06, 39); this.noise(1.2, 0.06, 300); break;
      case 'look': this.tone(880, 0.05, 'triangle', 0.04); this.tone(660, 0.08, 'triangle', 0.03, 0, 0.05); break;
      case 'select': this.tone(660, 0.06, 'square', 0.04); break;
      case 'confirm': this.tone(523, 0.08, 'square', 0.05); this.tone(784, 0.12, 'square', 0.05, 0, 0.06); break;
      case 'achievement': [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, 0.25, 'square', 0.04, 0, i * 0.07)); break;
      case 'gate': [262, 330, 392, 523, 659].forEach((f, i) => this.tone(f, 0.8, 'triangle', 0.06, 0, i * 0.12)); break;
      case 'thunder': this.noise(2.2, 0.22, 140); this.noise(0.6, 0.12, 400); this.tone(48, 1.8, 'sine', 0.18, 30); break;
      case 'chime': [1046, 1318, 1568].forEach((f, i) => this.tone(f * rand(0.98, 1.02), 0.5, 'sine', 0.035, 0, i * 0.05)); break;
      case 'twinkle': this.tone(rand(1500, 2200), 0.18, 'sine', 0.025); break;
      case 'heartbeat': this.tone(60, 0.18, 'sine', 0.3, 40); this.tone(55, 0.18, 'sine', 0.25, 35, 0.22); break;
    }
  },
};

// Music. The score is "The Breeze", streamed from music/the-breeze.ogg
// (see MUSIC_FILES). It loops and plays as one continuous piece; each game state only changes its volume,
// so it never restarts mid-phrase. If the file isn't there, an original synthesized string score plays.
// Once you're in the game the score sinks under a low-pass filter, as if heard through a wall.
// (Browsers won't let Web Audio filter a file opened from file://, so there it only gets quieter.)
const MUSIC_FILES = ['../music/the-breeze.ogg'];
const Music = {
  mood: -1, el: null, ok: false, tried: 0, vol: 0, next: 0, step: 0, muffled: false, muffleK: 0, lp: null, out: null, routed: false,
  // Target volume per mood: -1 hush, 0 title, 1-4 chapters, 5 endings, 6 epilogue.
  levels: { '-1': 0.22, 0: 0.85, 1: 0.5, 2: 0.5, 3: 0.5, 4: 0.42, 5: 0.95, 6: 0.85 },
  // The file is mastered near full scale while the sound effects sit far below it, so it plays
  // with this much headroom (about -14 dB) to leave room for jumps, footsteps and voices.
  fileGain: 0.2,
  init() {
    if (typeof Audio === 'undefined') return;
    this.el = new Audio();
    this.el.loop = true;
    this.el.preload = 'auto';
    this.el.volume = 0;
    this.el.addEventListener('canplay', () => { this.ok = true; this.play(); });
    this.el.addEventListener('error', () => this.tryNext());
    this.tryNext();
  },
  tryNext() {
    if (this.tried >= MUSIC_FILES.length) { this.ok = false; return; }
    this.el.src = MUSIC_FILES[this.tried++];
    this.el.load();
  },
  play() { if (this.ok && Sound.ctx && this.el.paused) this.el.play().catch(() => {}); },
  restart() { if (this.ok) { this.el.currentTime = 0; this.vol = 0; this.play(); } },
  credit() { return this.ok ? '"The Breeze"' : 'Original synthesized score'; },
  set(m) { if (m !== this.mood) { this.mood = m; this.step = 0; } },
  muffle(on) { this.muffled = on; },
  // Filter chain shared by the file and the synth: [source] -> lp -> out -> master.
  chain() {
    const ctx = Sound.ctx;
    if (!ctx || this.lp) return;
    this.lp = ctx.createBiquadFilter(); this.lp.type = 'lowpass'; this.lp.frequency.value = 20000; this.lp.Q.value = 0.5;
    this.out = ctx.createGain();
    this.lp.connect(this.out); this.out.connect(Sound.master);
  },
  route() {
    if (this.routed || !this.ok || !this.lp || !/^https?:$/.test(location.protocol)) return;
    try { Sound.ctx.createMediaElementSource(this.el).connect(this.lp); this.routed = true; } catch (e) { this.routed = false; }
  },
  update() {
    this.chain(); this.route();
    // Endings and the epilogue always play in the open.
    const muffle = this.muffled && this.mood !== 5 && this.mood !== 6;
    this.muffleK = approach(this.muffleK, muffle ? 1 : 0, 1 / 90);
    const k = this.muffleK * this.muffleK * (3 - 2 * this.muffleK);
    if (this.lp) this.lp.frequency.value = 20000 * Math.pow(650 / 20000, k);
    if (this.ok) {
      this.play();
      const target = Sound.muted ? 0 : (this.levels[this.mood] ?? 0.5) * this.fileGain * Sound.musicVol * (this.routed ? 1 : Sound.masterVol) * (1 - 0.4 * k);
      this.vol = approach(this.vol, target, 0.004);
      // Routed audio goes through master (gain 0.5), so make up for it on the out node.
      if (this.routed) { this.el.volume = 1; this.out.gain.value = clamp(this.vol, 0, 1) * 2; }
      else this.el.volume = clamp(this.vol, 0, 1);
      return;
    }
    if (this.out) this.out.gain.value = 1 - 0.4 * k;
    this.synth();
  },

  // ---- Fallback: slow bowed-string chords with reverb, and a sparse piano line. ----
  prog: [
    [[146.8, 220, 293.7, 370], [123.5, 185, 246.9, 293.7], [98, 196, 246.9, 293.7], [110, 164.8, 220, 277.2]],
    [[130.8, 196, 261.6, 329.6], [110, 164.8, 220, 261.6], [87.3, 174.6, 220, 261.6], [98, 146.8, 196, 246.9]],
    [[110, 164.8, 220, 261.6], [87.3, 174.6, 220, 261.6], [130.8, 196, 261.6, 329.6], [98, 196, 246.9, 293.7]],
    [[146.8, 220, 293.7, 349.2], [116.5, 174.6, 233.1, 293.7], [87.3, 174.6, 220, 261.6], [110, 164.8, 220, 277.2]],
    [[110, 164.8, 220, 261.6], [116.5, 174.6, 233.1, 293.7], [98, 146.8, 196, 233.1], [82.4, 164.8, 207.7, 246.9]],
    [[146.8, 220, 293.7, 370], [164.8, 246.9, 329.6, 415.3], [123.5, 185, 246.9, 293.7], [98, 196, 246.9, 293.7]],
  ],
  reverb() {
    const ctx = Sound.ctx;
    if (this.rev) return this.rev;
    const len = ctx.sampleRate * 3.5, buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = buf.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
    this.rev = ctx.createConvolver(); this.rev.buffer = buf;
    this.bus = ctx.createGain(); this.bus.gain.value = 0.55;
    const wet = ctx.createGain(); wet.gain.value = 0.7;
    this.bus.connect(this.lp); this.bus.connect(this.rev); this.rev.connect(wet); wet.connect(this.lp);
    return this.rev;
  },
  bow(f, t, dur, vol) {
    const ctx = Sound.ctx, g = ctx.createGain(), lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 900 + f; lp.Q.value = 0.3;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + dur * 0.35); g.gain.linearRampToValueAtTime(vol * 0.8, t + dur * 0.7); g.gain.linearRampToValueAtTime(0.0001, t + dur + 1.5);
    lp.connect(g); g.connect(this.bus);
    for (const det of [-6, 0, 7]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det;
      const vib = ctx.createOscillator(), vg = ctx.createGain(); vib.frequency.value = 4.5 + Math.random(); vg.gain.value = 1.5;
      vib.connect(vg); vg.connect(o.frequency); vib.start(t); vib.stop(t + dur + 1.6);
      o.connect(lp); o.start(t); o.stop(t + dur + 1.6);
    }
  },
  pluck(f, t, vol) {
    const ctx = Sound.ctx;
    for (const [mul, v] of [[1, 1], [2, 0.3], [3, 0.12]]) {
      const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.value = f * mul;
      g.gain.setValueAtTime(vol * v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.8);
      o.connect(g); g.connect(this.bus); o.start(t); o.stop(t + 3);
    }
  },
  synth() {
    const ctx = Sound.ctx;
    if (!ctx || Sound.muted) return;
    this.reverb();
    const vol = (this.levels[this.mood] ?? 0.5) * Sound.musicVol;
    if (this.mood < 0 || vol <= 0) return;
    const now = ctx.currentTime, prog = this.prog[Math.min(this.mood, this.prog.length - 1)];
    const bar = this.mood === 4 ? 5.2 : 6.4;
    if (this.next < now) this.next = now + 0.1;
    while (this.next < now + 0.5) {
      const chord = prog[this.step % prog.length], t = this.next;
      chord.forEach((f, i) => this.bow(f, t, bar, (i === 0 ? 0.03 : 0.018) * vol));
      // A few unhurried piano notes over each chord.
      const top = chord.slice(1);
      for (let k = 0; k < 3; k++) if (Math.random() < 0.75) this.pluck(top[(Math.random() * top.length) | 0] * 2, t + 0.8 + k * bar / 3.4, 0.05 * vol);
      this.next += bar;
      this.step++;
    }
  },
};
