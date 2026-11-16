'use strict';
// Options: four tabs, one per suit, of sliders, switches and pickers. Everything applies the
// moment it changes, and the line under the list says what the highlighted setting does.

const OPTION_DEFAULTS = {
  lowFx: false, shake: 1, calm: false, scale: 'pixel', timer: false,
  textSpeed: 1, grabToggle: false, sprintToggle: false, assist: false, speed: 1,
};
// Characters per frame for each text speed. Instant shows a whole line at once.
const TEXT_SPEEDS = [0.5, 1, 2, Infinity];

// Layout, in game pixels.
const OPT = { x0: 20, x1: 300, top: 34, bottom: 146, label: 34, valR: 286, barW: 49, keys: 122, desc: 148 };
OPT.barX = OPT.valR - 26 - OPT.barW;
OPT.choiceL = OPT.barX; OPT.choiceC = (OPT.barX + OPT.valR) / 2;

const tint = (c, a) => { const [r, g, b] = hex(c); return `rgba(${r},${g},${b},${a})`; };

const OptionsScreen = {
  tab: 0, sel: 0, from: 'title', t: 0, tabT: 0, dir: 0, fsel: 0, tabX: null, descT: 0, sampleT: 0,
  lean: [], pop: [], knob: {}, hit: null, clicked: false, holdT: 0, drag: -1, eraseAt: -1, erased: false, note: null,

  open(from) {
    this.from = from;
    this.tabs = this.build();
    this.t = from === 'pause' ? 16 : 0; this.eraseAt = -1; this.erased = false; this.note = null; this.drag = -1;
    this.setTab(this.tab, 0, true);
  },

  build() {
    const o = Game.options;
    const vol = (kind, label, desc, preview) => ({ kind: 'slider', label, desc, min: 0, max: 1, step: 0.1, get: () => Sound[kind + 'Vol'], set: (v) => Sound.setVol(kind, v), preview });
    const flag = (key, label, desc) => ({ kind: 'toggle', label, desc, get: () => !!o[key], set: (v) => { o[key] = v; } });
    const pick = (key, label, desc, values, after) => ({ kind: 'choice', label, desc, values, get: () => o[key], set: (v) => { o[key] = v; if (after) after(); } });
    const keys = (label, kb, pad, desc) => ({ kind: 'keys', label, kb, pad, desc });
    return [
      { name: 'SOUND', ch: 1, rows: [
        vol('master', 'Master Volume', 'Everything you hear, all at once.', () => Sound.play('select')),
        vol('music', 'Music', () => (Music.ok ? '"The Breeze." It sounds farther away while you dream.' : 'The score. It sounds farther away while you dream.')),
        vol('sfx', 'Sound Effects', 'Footsteps, jumps, doors, and the hum of failing lights.', () => Sound.play('jump')),
        vol('voice', 'Voices', 'The little sounds people make when they talk.', () => { const [p, w] = VOICES.REMI; for (let i = 0; i < 3; i++) setTimeout(() => Sound.talk(p, w), i * 70); }),
        { kind: 'toggle', label: 'Mute Everything', desc: 'Silence. M does this from anywhere.', get: () => Sound.muted, set: (v) => { if (v !== Sound.muted) Sound.toggle(); } },
      ] },
      { name: 'DISPLAY', ch: 2, rows: [
        { kind: 'toggle', label: 'Fullscreen', desc: 'Let the dream take the whole screen.', get: () => !!document.fullscreenElement,
          set: (v) => { const d = document; if (!v && d.fullscreenElement) d.exitFullscreen(); else if (v && !d.fullscreenElement) d.documentElement.requestFullscreen().catch(() => {}); } },
        pick('scale', 'Scaling', 'Pixel Perfect keeps every pixel square. Fill Screen uses all the room you have.', [['pixel', 'Pixel Perfect'], ['fit', 'Fill Screen']], () => Game.resize()),
        pick('shake', 'Screen Shake', 'How hard the world jolts when you dash, fall, or hear thunder.', [[0, 'Off'], [0.5, 'Gentle'], [1, 'Full']], () => { Game.shakeAmt = 0; Game.shake(4); }),
        pick('lowFx', 'Effects', 'Reduced draws fewer particles and lights. Try it if the game stutters.', [[false, 'Full'], [true, 'Reduced']], () => Art.initWeather()),
        flag('calm', 'Reduce Flashing', 'Softens lightning and flickering lights, and stills the glitches of Chapter IV.'),
        flag('timer', 'Show Timer', 'A clock in the corner, counting your whole run.'),
      ] },
      { name: 'PLAY', ch: 3, rows: [
        pick('textSpeed', 'Text Speed', null, [[0, 'Slow'], [1, 'Normal'], [2, 'Fast'], [3, 'Instant']], () => { this.sampleT = 0; }),
        pick('grabToggle', 'Grab', 'Toggle: press once to hold on to a wall, and again to let go.', [[false, 'Hold'], [true, 'Toggle']]),
        pick('sprintToggle', 'Sprint', 'Toggle: press once to start running, and again to stop.', [[false, 'Hold'], [true, 'Toggle']]),
        flag('assist', 'Assist Mode', "Spikes and the Hollow can't hurt you, and you never tire. Nothing is locked away for using it."),
        { kind: 'slider', label: 'Game Speed', desc: 'Slow the dream down. Menus and conversations keep their pace.', min: 0.5, max: 1, step: 0.1, get: () => o.speed, set: (v) => { o.speed = v; } },
        { kind: 'button', label: 'Reset All Options', desc: 'Put every setting back the way it began.', action: () => this.resetAll() },
        { kind: 'button', danger: true,
          label: () => (this.erased ? 'Save Forgotten' : this.eraseAt >= 0 ? 'Really? Press again' : 'Erase Save Data'),
          desc: () => (this.from !== 'title' ? 'Only from the title screen, so nothing is lost mid-dream.'
            : this.erased || !Store.get(SAVE_KEY, null) ? "There's nothing to forget." : 'Forget where you are in the story. Achievements and endings are kept.'),
          disabled: () => this.from !== 'title' || this.erased || !Store.get(SAVE_KEY, null), action: () => this.erase() },
      ] },
      { name: 'CONTROLS', ch: 4, rows: [
        keys('Move', ['←', '→', 'A', 'D'], 'Stick  D-pad', 'Walk, and steer while you fall.'),
        keys('Jump', ['↑', 'W', 'Space', 'K'], 'A', 'Hold it to jump higher. Push off walls, too.'),
        keys('Dash', ['X', 'J'], 'X  B', "Once you've learned how. Hold a direction to aim it."),
        keys('Grab & Climb', ['Z', 'V', 'L'], 'Y  LB  RB', 'Hold on to a wall. Climbing wears you out.'),
        keys('Sprint', ['Shift'], 'LT  RT', 'Run faster, until you run out of breath.'),
        keys('Talk & Look', ['↑', 'E'], 'D-pad ↑', 'Speak to people, and look closer at things.'),
        keys('Pause', ['Esc', 'P', 'Enter'], 'Start', 'Stop the dream for a moment.'),
        keys('Mute', ['M'], '—', 'Works anywhere, even in the middle of a sentence.'),
      ] },
    ];
  },

  rows() { return this.tabs[this.tab].rows; },
  color() { return CHAPTERS[this.tabs[this.tab].ch].color; },
  val(x) { return typeof x === 'function' ? x() : x; },

  setTab(i, dir, quiet) {
    this.dir = dir; this.tab = i; this.tabT = 0; this.sel = 0; this.fsel = 0; this.descT = 0; this.sampleT = 0;
    this.lean = []; this.pop = []; this.eraseAt = -1; this.holdT = 0;
    if (!quiet) Sound.play('select');
  },

  move(d) {
    const n = this.rows().length;
    this.sel = (this.sel + d + n) % n;
    this.descT = 0; this.sampleT = 0; this.holdT = 0;
    if (this.eraseAt >= 0) this.eraseAt = -1;
    Sound.play('select');
  },

  // Steps a setting by d. Sliders stop at their ends unless wrap is set; pickers always go round.
  change(r, d, wrap) {
    if (r.kind === 'slider') {
      const n = Math.round((r.max - r.min) / r.step);
      let i = Math.round((r.get() - r.min) / r.step) + d;
      if (wrap && i > n) i = 0;
      if (!this.setStep(r, clamp(i, 0, n))) return;
    } else if (r.kind === 'toggle') r.set(!r.get());
    else if (r.kind === 'choice') {
      const vs = r.values, i = vs.findIndex(([v]) => v === r.get());
      r.set(vs[(i + d + vs.length) % vs.length][0]);
    } else return;
    this.changed(r);
  },
  setStep(r, i) {
    const v = +(r.min + i * r.step).toFixed(2);
    if (v === r.get()) return false;
    r.set(v);
    return true;
  },
  changed(r) {
    this.pop[this.rows().indexOf(r)] = 1;
    if (r.preview) r.preview(); else Sound.play('select');
    Game.saveOptions();
  },

  activate(r) {
    if (r.kind === 'slider') this.change(r, 1, true);
    else if (r.kind === 'toggle' || r.kind === 'choice') this.change(r, 1);
    else if (r.kind === 'button') {
      if (r.disabled && r.disabled()) { Sound.tone(150, 0.1, 'square', 0.04); return; }
      Sound.play('confirm');
      r.action();
    }
  },

  resetAll() {
    Object.assign(Game.options, OPTION_DEFAULTS);
    for (const k of ['master', 'music', 'sfx', 'voice']) Sound.setVol(k, 1);
    if (Sound.muted) Sound.toggle();
    Game.saveOptions(); Game.resize(); Art.initWeather();
    this.note = { text: 'Everything is back the way it began.', t: 0 };
  },

  erase() {
    if (this.eraseAt < 0) { this.eraseAt = this.t; return; }
    Store.del(SAVE_KEY);
    this.erased = true; this.eraseAt = -1;
    Sound.play('crumble');
    this.note = { text: 'Your save is gone. Achievements and endings stay with you.', t: 0 };
  },

  back() {
    Game.saveOptions();
    if (this.from === 'title') Game.fadeTo(() => Game.toTitle()); else Game.openPause();
  },

  // What the mouse is over: a tab, a row, or the back button (laid out by the last draw).
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

  // A slider follows the mouse along its bar.
  slideTo(r, x) {
    const n = Math.round((r.max - r.min) / r.step), i = Math.round(clamp((x - OPT.barX) / OPT.barW, 0, 1) * n);
    if (this.setStep(r, i)) this.changed(r);
  },

  update() {
    this.t++; this.tabT++; this.descT++; this.sampleT++;
    if (this.note && ++this.note.t > 200) this.note = null;
    if (this.eraseAt >= 0 && this.t - this.eraseAt > 180) this.eraseAt = -1;
    const rows = this.rows(), m = Input.mouse, h = this.hover();
    this.clicked = m.click;
    this.fsel += (this.sel - this.fsel) * 0.3;
    this.lean = rows.map((_, k) => (this.lean[k] || 0) + ((k === this.sel ? 1 : 0) - (this.lean[k] || 0)) * 0.22);
    this.pop = rows.map((_, k) => (this.pop[k] || 0) * 0.86);

    if (this.drag >= 0) {
      if (m.down) { this.slideTo(rows[this.drag], m.x); return; }
      this.drag = -1;
    }
    // Tabs: Q / E, Tab and Shift+Tab, or the shoulder buttons.
    const back = Input.pressed('tabPrev') || (Input.pressed('tabNext') && Input.held('sprint'));
    const td = back ? -1 : Input.pressed('tabNext') ? 1 : 0;
    if (td) { this.setTab((this.tab + td + this.tabs.length) % this.tabs.length, td); return; }
    if (Input.pressed('down')) this.move(1);
    if (Input.pressed('up')) this.move(-1);
    if (m.moved && h.row >= 0 && h.row !== this.sel) { this.sel = h.row; this.descT = 0; this.sampleT = 0; this.eraseAt = -1; Sound.play('select'); }

    if (m.click) {
      if (h.tab >= 0) { if (h.tab !== this.tab) this.setTab(h.tab, Math.sign(h.tab - this.tab)); return; }
      if (h.back) { Sound.play('confirm'); Input.flush(); this.back(); return; }
      if (h.row < 0) return;
      const r = rows[h.row];
      this.sel = h.row;
      if (r.kind === 'slider' && m.x >= OPT.barX - 3) { this.drag = h.row; this.slideTo(r, m.x); }
      else if (r.kind === 'choice' && m.x >= OPT.choiceL - 6) this.change(r, m.x < OPT.choiceC ? -1 : 1);
      else this.activate(r);
      return;
    }

    const r = rows[this.sel], lr = (Input.held('right') ? 1 : 0) - (Input.held('left') ? 1 : 0);
    if (Input.pressed('left') || Input.pressed('right')) { this.holdT = 0; this.change(r, Input.pressed('right') ? 1 : -1); }
    else if (lr && r.kind === 'slider') { if (++this.holdT > 18 && this.holdT % 4 === 0) this.change(r, lr); }
    else this.holdT = 0;
    if (Input.pressed('confirm')) this.activate(r);
    else if (Input.pressed('back')) { Input.flush(); this.back(); }
  },

  // ---------- Drawing ----------
  draw(g) {
    const col = this.color(), rows = this.rows(), e = (p) => 1 - (1 - clamp(p, 0, 1)) ** 3;
    const intro = e(this.t / 16);
    g.fillStyle = Game.save ? `rgba(5,6,12,${0.8 * intro})` : `rgba(3,4,10,${0.55 * intro})`;
    g.fillRect(0, 0, W, H);
    g.globalAlpha = intro;

    setFont(g, 8, true); textC(g, 'OPTIONS', W / 2, 13 - Math.round((1 - intro) * 6), '#ffe9a8');
    this.drawTabs(g);

    // The sheet, edged in the tab's color.
    g.fillStyle = 'rgba(6,7,16,0.82)'; g.fillRect(OPT.x0, OPT.top, OPT.x1 - OPT.x0, OPT.bottom - OPT.top);
    g.strokeStyle = '#2a2e44'; g.lineWidth = 0.5; g.strokeRect(OPT.x0 + 0.25, OPT.top + 0.25, OPT.x1 - OPT.x0 - 0.5, OPT.bottom - OPT.top - 0.5);
    const edge = g.createLinearGradient(OPT.x0, 0, OPT.x1, 0);
    edge.addColorStop(0, tint(col, 0)); edge.addColorStop(0.5, tint(col, 0.8)); edge.addColorStop(1, tint(col, 0));
    g.fillStyle = edge; g.fillRect(OPT.x0, OPT.top, OPT.x1 - OPT.x0, 1);

    // Rows sit in the middle of the sheet, roomier when there are fewer of them.
    const keysTab = rows[0].kind === 'keys', head = keysTab ? 9 : 0, gap = rows.length <= 6 ? 14 : keysTab ? 11 : 12;
    const y0 = Math.round(OPT.top + head + (OPT.bottom - OPT.top - head - (rows.length - 1) * gap) / 2 + 4);
    if (keysTab) {
      setFont(g, 9); g.fillStyle = '#6a7090';
      g.fillText('KEYBOARD', OPT.keys, y0 - 12);
      g.textAlign = 'right'; g.fillText('GAMEPAD', OPT.valR, y0 - 12); g.textAlign = 'left';
    }
    this.hit.rows = rows.map((_, k) => ({ x0: OPT.x0, x1: OPT.x1, y0: y0 + k * gap - 4 - gap / 2, y1: y0 + k * gap - 4 + gap / 2 }));

    // Highlight bar, gliding between rows.
    const hy = Math.round(y0 + this.fsel * gap - 4);
    const bar = g.createLinearGradient(OPT.x0, 0, OPT.x1, 0);
    bar.addColorStop(0, tint(col, 0.26)); bar.addColorStop(0.55, tint(col, 0.07)); bar.addColorStop(1, tint(col, 0.02));
    g.fillStyle = bar; g.fillRect(OPT.x0 + 1, hy - 6, OPT.x1 - OPT.x0 - 2, 11);
    g.fillStyle = col; g.fillRect(OPT.x0 + 1, hy - 6, 2, 11);

    rows.forEach((r, k) => {
      const p = e((this.tabT - k * 2) / 12);
      if (p <= 0) return;
      g.globalAlpha = intro * p;
      const ox = Math.round(this.dir * 14 * (1 - p)), yy = y0 + k * gap, sel = k === this.sel;
      const dis = r.disabled && r.disabled(), lean = Math.round((this.lean[k] || 0) * 3);
      if (sel) this.drawBow(g, OPT.label - 9 + ox, yy - 7, r.danger ? '#ff4d6d' : col);
      setFont(g, 12);
      const label = this.val(r.label), warn = r.danger && this.eraseAt >= 0;
      g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillText(label, OPT.label + ox + lean + 0.5, yy + 0.5);
      g.fillStyle = dis ? '#4a5068' : warn ? ((this.t >> 3) % 2 ? '#ff4d6d' : '#ffb0bc') : sel ? (r.danger ? '#ff8a9a' : '#ffffff') : '#9aa0bc';
      g.fillText(label, OPT.label + ox + lean, yy);
      this.drawValue(g, r, k, yy, ox, sel, col);
    });
    g.globalAlpha = intro;

    this.drawDesc(g, rows[this.sel], col);
    this.drawFooter(g);
    g.globalAlpha = 1;
  },

  drawTabs(g) {
    const n = this.tabs.length, tw = 66, gap = 3, x0 = Math.round((W - (n * tw + (n - 1) * gap)) / 2), y = 18, h = 13;
    const h0 = this.hover();
    this.hit = { tabs: [], rows: [], back: { x0: 4, x1: 46, y0: H - 12, y1: H } };
    const target = x0 + this.tab * (tw + gap);
    this.tabX = this.tabX === null ? target : this.tabX + (target - this.tabX) * 0.3;
    this.tabs.forEach((tb, i) => {
      const x = x0 + i * (tw + gap), on = i === this.tab, c = CHAPTERS[tb.ch].color, hov = h0.tab === i;
      this.hit.tabs.push({ x0: x, x1: x + tw, y0: y, y1: y + h });
      g.fillStyle = on ? tint(c, 0.16) : hov ? 'rgba(255,255,255,0.06)' : 'rgba(6,7,16,0.6)';
      g.fillRect(x, y, tw, h);
      setFont(g, 11);
      const sw = g.measureText(CHAPTERS[tb.ch].suit).width;
      setFont(g, 6, true);
      const nw = g.measureText(tb.name).width, sx = Math.round(x + (tw - (sw + 3 + nw)) / 2);
      setFont(g, 11); g.fillStyle = on || hov ? c : '#4a5068'; g.fillText(CHAPTERS[tb.ch].suit, sx, y + 10);
      setFont(g, 6, true); g.fillStyle = on ? '#ffffff' : hov ? '#c8cce0' : '#6a7090'; g.fillText(tb.name, sx + sw + 3, y + 9);
    });
    // The underline slides to the active tab.
    g.fillStyle = this.color(); g.fillRect(Math.round(this.tabX), y + h - 1, tw, 1);
    setFont(g, 9); g.fillStyle = '#4a5068';
    g.fillText('Q', x0 - 9, y + 9); g.fillText('E', x0 + n * tw + (n - 1) * gap + 4, y + 9);
  },

  // Ribbon-red bow, as in the other menus.
  drawBow(g, x, y, c) {
    const bx = x + Math.round(Math.sin(Game.frame * 0.15));
    g.fillStyle = c;
    g.fillRect(bx, y, 2, 5); g.fillRect(bx + 2, y + 1, 1, 3); g.fillRect(bx + 4, y + 1, 1, 3); g.fillRect(bx + 5, y, 2, 5);
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(bx + 3, y + 1, 1, 3);
  },

  arrow(g, x, y, d, c) {
    g.fillStyle = c;
    for (let i = 0; i < 3; i++) g.fillRect(d < 0 ? x + i : x - i, y - i, 1, i * 2 + 1);
  },

  drawValue(g, r, k, yy, ox, sel, col) {
    const R = OPT.valR + ox, pop = this.pop[k] || 0, lift = Math.round(pop * 2);
    setFont(g, 12);
    if (r.kind === 'slider') {
      const n = Math.round((r.max - r.min) / r.step), i = Math.round((r.get() - r.min) / r.step);
      const sw = Math.floor((OPT.barW + 1) / n) - 1, bx = OPT.barX + ox;
      for (let s = 0; s < n; s++) {
        const x = bx + s * (sw + 1), lit = s < i;
        g.fillStyle = lit ? (sel ? col : '#8a90b0') : '#22263a'; g.fillRect(x, yy - 7, sw, 5);
        if (lit) { g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(x, yy - 7, sw, 1); }
      }
      const v = r.get(), txt = v === 0 && r.min === 0 ? 'OFF' : `${Math.round(v * 100)}%`;
      g.textAlign = 'right'; g.fillStyle = pop > 0.3 ? '#ffffff' : sel ? '#eef1ff' : '#8a90b0'; g.fillText(txt, R, yy - lift); g.textAlign = 'left';
    } else if (r.kind === 'toggle') {
      const key = `${this.tab}-${k}`, on = r.get();
      this.knob[key] = this.knob[key] === undefined ? +on : this.knob[key] + ((on ? 1 : 0) - this.knob[key]) * 0.35;
      const kk = this.knob[key], x = R - 18, y = yy - 9;
      g.fillStyle = '#22263a'; g.fillRect(x, y, 18, 8);
      g.fillStyle = tint(sel ? col : '#8a90b0', 0.85 * kk); g.fillRect(x, y, 18, 8);
      g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(x, y + 7, 18, 1);
      const kx = Math.round(x + 1 + kk * 10);
      g.fillStyle = '#ffffff'; g.fillRect(kx, y + 1, 7, 6);
      g.fillStyle = '#c8cce0'; g.fillRect(kx, y + 6, 7, 1);
      g.textAlign = 'right'; g.fillStyle = on ? (pop > 0.3 ? '#ffffff' : sel ? '#eef1ff' : '#c8cce0') : '#5a6078';
      g.fillText(on ? 'ON' : 'OFF', x - 5, yy - lift); g.textAlign = 'left';
    } else if (r.kind === 'choice') {
      const cur = r.values.find(([v]) => v === r.get()), name = cur ? cur[1] : '?', cx = OPT.choiceC + ox;
      const bob = sel ? Math.round(Math.sin(Game.frame * 0.15)) : 0, ac = sel ? col : '#3a3f5c';
      this.arrow(g, OPT.choiceL + ox - bob, yy - 4, -1, ac);
      this.arrow(g, R - 1 + bob, yy - 4, 1, ac);
      textC(g, name, cx, yy - lift, pop > 0.3 ? '#ffffff' : sel ? '#eef1ff' : '#8a90b0');
    } else if (r.kind === 'button') {
      if (sel && !(r.disabled && r.disabled())) this.arrow(g, R - 1 + Math.round(Math.sin(Game.frame * 0.15)), yy - 4, 1, r.danger ? '#ff4d6d' : col);
    } else if (r.kind === 'keys') {
      // Keycaps.
      setFont(g, 10);
      let x = OPT.keys + ox;
      for (const key of r.kb) {
        const w = Math.max(9, Math.ceil(g.measureText(key).width) + 6);
        g.fillStyle = sel ? '#1c2036' : '#12142a'; g.fillRect(x, yy - 9, w, 10);
        g.fillStyle = sel ? tint(col, 0.6) : '#2e3350'; g.fillRect(x, yy, w, 1);
        g.strokeStyle = sel ? tint(col, 0.5) : '#2a2e44'; g.lineWidth = 0.5; g.strokeRect(x + 0.25, yy - 8.75, w - 0.5, 9.5);
        textC(g, key, x + w / 2, yy - 2, sel ? '#ffffff' : '#c8cce0', false);
        x += w + 3;
      }
      setFont(g, 11); g.textAlign = 'right'; g.fillStyle = sel ? '#c8cce0' : '#6a7090'; g.fillText(r.pad, R, yy - 1); g.textAlign = 'left';
    }
  },

  // What the highlighted setting does, typed out. Text Speed shows a sample at the chosen pace.
  drawDesc(g, r, col) {
    const y = OPT.desc;
    const line = g.createLinearGradient(OPT.x0 + 30, 0, OPT.x1 - 30, 0);
    line.addColorStop(0, tint(col, 0)); line.addColorStop(0.5, tint(col, 0.35)); line.addColorStop(1, tint(col, 0));
    g.fillStyle = line; g.fillRect(OPT.x0 + 30, y + 1, OPT.x1 - OPT.x0 - 60, 1);
    setFont(g, 10);
    if (this.note) {
      const a = Math.min(1, this.note.t / 10, (200 - this.note.t) / 20);
      const ga = g.globalAlpha;
      g.globalAlpha = ga * a; textC(g, this.note.text, W / 2, y + 12, col); g.globalAlpha = ga;
      return;
    }
    if (r.label === 'Text Speed') {
      const sample = '* The light under the door is still on.', rate = TEXT_SPEEDS[Game.options.textSpeed] || 1;
      const len = sample.length, done = rate === Infinity ? 0 : Math.ceil(len / rate);
      const t = this.sampleT % (done + 90), n = rate === Infinity ? len : Math.min(len, Math.floor(t * rate));
      setFont(g, 11); g.fillStyle = '#ffe9a8';
      const w = g.measureText(sample).width, x = Math.round(W / 2 - w / 2);
      g.fillText(sample.slice(0, n), x, y + 12);
      if (n < len && (Game.frame >> 3) % 2) { g.fillStyle = '#ffe9a8'; g.fillRect(x + g.measureText(sample.slice(0, n)).width + 1, y + 5, 3, 7); }
      setFont(g, 9); textC(g, 'How quickly people find their words.', W / 2, y + 21, '#6a7090', false);
      return;
    }
    const text = this.val(r.desc) || '';
    const shown = text.slice(0, this.descT * 3);
    const lines = wrap(g, text, 268);
    let used = 0;
    lines.slice(0, 2).forEach((ln, i) => {
      const part = shown.slice(used, used + ln.length);
      used += ln.length + 1;
      if (!part) return;
      // Centre on the full line so the words don't slide as they appear.
      const x = Math.round(W / 2 - g.measureText(ln).width / 2);
      g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillText(part, x + 0.5, y + 12.5 + i * 9);
      g.fillStyle = '#b8bdd6'; g.fillText(part, x, y + 12 + i * 9);
    });
  },

  drawFooter(g) {
    const hb = this.hover().back;
    this.arrow(g, 9 - (hb ? 1 : 0), H - 7, -1, hb ? '#ff8ac6' : '#8a90a8');
    setFont(g, 10); g.fillStyle = hb ? '#ffffff' : '#8a90a8'; g.fillText('Back', 15, H - 4);
    setFont(g, 9); g.textAlign = 'right'; g.fillStyle = '#6a7090';
    const r = this.rows()[this.sel];
    const adjust = r.kind === 'slider' || r.kind === 'choice' || r.kind === 'toggle';
    g.fillText(`Q E tabs    ↑ ↓ choose    ${adjust ? '← → change    ' : ''}X back`, W - 8, H - 4);
    g.textAlign = 'left';
  },
};
