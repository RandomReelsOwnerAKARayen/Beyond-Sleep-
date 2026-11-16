'use strict';
// Hand-made pixel sprites (as character grids) and dialogue portraits.
// Every sprite is drawn anchored at its bottom centre, so feet line up with the ground.

// ---------- Eli: built from head + torso + legs rows so poses stay consistent ----------
const ELI_HEAD = ['..oooo..', '.ohHHhho', 'ohhhhhho', 'ohhsseso', 'ohssssSo'];
const ELI_BLINK = ['..oooo..', '.ohHHhho', 'ohhhhhho', 'ohhssSso', 'ohssssSo'];
const ELI_TORSO = {
  idle: ['.oggwgo.', 'oggwggGo', 'osggGgso'],
  jump: ['.oggwgos', 'oggwggGo', '.ogggGo.'],
  fall: ['.oggwgo.', 'sggwggGs', '.ogggGo.'],
  dash: ['.oggwgo.', 'oggwgggs', '.oggGgo.'],
  climbA: ['.oggwgos', 'oggwggGo', '.ogggGso'],
  climbB: ['.oggwgo.', 'oggwggGs', '.ogggGos'],
};
const ELI_LEGS = {
  stand: ['.ojjjjo.', '.ojJJjo.', '.ojooJo.', '.kk..kk.'],
  runA: ['.ojjjjo.', 'ojJo.ojo', 'kk...okk'],
  runB: ['.ojjjjo.', '..ojJo..', '..ojjo..', '..okko..'],
  runC: ['.ojjjjo.', 'ojo.oJjo', 'okk...kk'],
  tuck: ['.ojjjjo.', '.ojJJjo.', '..okko..'],
  dangle: ['.ojjjjo.', '.ojooJo.', '.ok..ko.', '.k....k.'],
  dash: ['ojjjjo..', 'ojJoojo.', 'kko..okk'],
  climbA: ['.ojjjjo.', '.ojJojo.', '.ojo.oko', '.kk...k.'],
  climbB: ['.ojjjjo.', '.ojoJjo.', '.oko.ojo', '..k..kk.'],
};
// Idle fidgets (after ~20s standing still): a yawning stretch, then sitting down to doze.
const ELI_YAWN = ['..oooo..', '.ohHHhho', 'ohhhhhho', 'ohhssSso', 'ohsssoSo'];
const ELI_NOD = ['..oooo..', '.ohHHhho', 'ohhhhhho', 'ohhhhhho', 'ohhssSso'];
const ELI_ARMLESS = ['.oggwgo.', 'oggwggGo', '.ogggGo.'];
const ELI_SIT_LEGS = ['.ojjjjjo', '.ojJJjjk'];
// Arms raised beside the head: widen to 10 columns and draw sleeves (g) with hands (s) on top.
function eliStretch(head, high) {
  const pad = (r) => '.' + r + '.';
  const arm = (r, c) => c + r.slice(1, 9) + c;
  const rows = [...head.map(pad), ...ELI_ARMLESS.map(pad), ...ELI_LEGS.stand.map(pad)];
  if (high) return ['s........s', ...rows.map((r, i) => (i < 4 ? arm(r, 'g') : r))];
  rows[1] = arm(rows[1], 's'); rows[2] = arm(rows[2], 'g'); rows[3] = arm(rows[3], 'g');
  return rows;
}
function eliFrame(head, torso, legs) {
  const rows = [...head, ...ELI_TORSO[torso], ...ELI_LEGS[legs]];
  while (rows.length < 12) rows.unshift('........');
  return rows;
}
const ELI_FRAMES = {
  idle0: eliFrame(ELI_HEAD, 'idle', 'stand'),
  idle1: ['........', ...ELI_HEAD, ...ELI_TORSO.idle.slice(1), ...ELI_LEGS.stand],
  blink: eliFrame(ELI_BLINK, 'idle', 'stand'),
  sleepy: ['........', ...ELI_BLINK, ...ELI_TORSO.idle.slice(1), ...ELI_LEGS.stand],
  stretch0: eliStretch(ELI_BLINK, false),
  stretch1: eliStretch(ELI_YAWN, true),
  crouch: eliFrame(ELI_BLINK, 'idle', 'tuck'),
  sit0: [...ELI_BLINK, ...ELI_TORSO.idle, ...ELI_SIT_LEGS],
  sit1: [...ELI_NOD, ...ELI_TORSO.idle, ...ELI_SIT_LEGS],
  run0: eliFrame(ELI_HEAD, 'idle', 'runA'),
  run1: eliFrame(ELI_HEAD, 'idle', 'runB'),
  run2: eliFrame(ELI_HEAD, 'idle', 'runC'),
  run3: eliFrame(ELI_HEAD, 'idle', 'runB'),
  jump: eliFrame(ELI_HEAD, 'jump', 'tuck'),
  fall: eliFrame(ELI_HEAD, 'fall', 'dangle'),
  dash: eliFrame(ELI_HEAD, 'dash', 'dash'),
  slide: eliFrame(ELI_HEAD, 'climbA', 'dangle'),
  climb0: eliFrame(ELI_HEAD, 'climbA', 'climbA'),
  climb1: eliFrame(ELI_HEAD, 'climbB', 'climbB'),
};
const ELI_PAL = {
  o: '#1b1626', h: '#4a2f2a', H: '#6e4a3c', s: '#f2c8a0', S: '#cf9a7c', e: '#1b1626',
  g: '#6f7fa8', G: '#4c5880', w: '#9aa9cf', j: '#33406a', J: '#232c4c', k: '#ece8f2',
};
const recolor = (pal, f) => Object.fromEntries(Object.entries(pal).map(([k, v]) => [k, f(k, v)]));

const SPRITE_DEFS = {
  eli: { frames: ELI_FRAMES, pal: ELI_PAL },
  eli_tired: { frames: ELI_FRAMES, pal: Object.assign({}, ELI_PAL, { s: '#ff9a8a', S: '#e0706a', g: '#a8707f', w: '#c8909f', G: '#80505f' }) },
  eli_white: { frames: ELI_FRAMES, pal: recolor(ELI_PAL, () => '#ffffff') },
  eli_ghost: { frames: ELI_FRAMES, pal: recolor(ELI_PAL, (k) => (k === 'o' ? '#3a2a5a' : '#ff6d86')) },
  hollow: {
    frames: ELI_FRAMES,
    pal: { o: '#000000', h: '#1a0c1e', H: '#2c1434', s: '#2a1230', S: '#1e0c24', e: '#ff2a4a', g: '#1c0d24', G: '#12061a', w: '#2e1838', j: '#170a1d', J: '#0c0410', k: '#2a1230' },
  },
  remi: {
    frames: {
      idle0: ['..ooorr.', '.obbbrRr', 'obbbbbbo', 'obessebo', 'obsppsbo', 'bbossobb', 'bodddDob', 'bsddddsb', '.oddddo.', 'oddDdddo', 'oDddddDo', '.oooooo.', '..s..s..'],
      idle1: ['..ooorr.', '.obbbrRr', 'obbbbbbo', 'obessebo', 'obsppsbo', '.bossob.', 'bbdddDob', 'bsddddsb', '.oddddo.', 'oddDdddo', 'oDddddDo', '.oooooo.', '..s..s..'],
      blink: ['..ooorr.', '.obbbrRr', 'obbbbbbo', 'obSssSbo', 'obsppsbo', 'bbossobb', 'bodddDob', 'bsddddsb', '.oddddo.', 'oddDdddo', 'oDddddDo', '.oooooo.', '..s..s..'],
    },
    pal: { o: '#1a1020', b: '#1c1420', B: '#3a2840', s: '#f6dcc6', S: '#d8b0a0', e: '#3a1a2a', r: '#ff3b5c', R: '#b8203c', d: '#f2f0ff', D: '#c9c4e8', p: '#ffb0bc' },
  },
  mom: {
    frames: {
      idle0: ['...ooo..', '..ohhho.', '.ohhhhho', '.ohhsseo', '.ohsssso', '..ossSo.', '.occcCco', 'occcbcCo', 'osccccso', '.occcco.', '.occcco.', '.oCooCo.', '.oc..co.', '.kk..kk.'],
      blink: ['...ooo..', '..ohhho.', '.ohhhhho', '.ohhssSo', '.ohsssso', '..ossSo.', '.occcCco', 'occcbcCo', 'osccccso', '.occcco.', '.occcco.', '.oCooCo.', '.oc..co.', '.kk..kk.'],
    },
    pal: { o: '#1e1a24', h: '#5a3628', s: '#f0c4a0', S: '#c8987c', e: '#1e1a24', c: '#5fb8b0', C: '#3f8a86', b: '#ffffff', k: '#e8e8f0' },
  },
  // Echoes are drawn as soft silhouettes (x = body, y = face/detail).
  walt: { frames: { idle0: ['..xxxxx...', '.xxxxxxxx.', '..xyyyx...', '..xyyyx...', '.xxxxxxx..', 'xxxxxxxxx.', 'xxxxxxxxx.', 'xxxxxxxxx.', '.xxxxxxx..', '.xxx.xxx..', '.xx...xx..', '.xx...xx..', '.xx...xx..', 'xxx..xxx..'] } },
  juno: { frames: { idle0: ['...xxx..', '..xxxxxx', '..xyyx.x', '..xyyx..', '...xx...', '..xxxx..', '.xxyyxx.', '.x.xxx.x', '...xxx..', '...x.x..', '...x.x..', '...x.x..', '..xx.xx.'] } },
  hester: { frames: { idle0: ['...xx....', '..xxxx...', '..xyyx...', '..xyyx...', '.xxxxxx..', 'xxxxxxxx.', 'xxxxxxxx.', '.xxxxxx.y', '.xxxxxx.y', '.xxxxxx.y', '.xxxxxx.y', '..x..x..y', '.xx.xx..y'] } },
  pip: { frames: { idle0: ['..xxx..', '.xxxxx.', '.xyyyx.', '..xxx..', '.xxxxyy', 'x.xxxyy', '..xxx..', '..x.x..', '.xx.xx.'] } },
  lily: { frames: { idle0: ['.xxxx.', 'xxyyxx', 'x.yy.x', '..xx..', '.xxxx.', 'yxxxxy', '.xxxx.', '.x..x.', '.x..x.'] } },
};
const ECHO_TINT = { x: '#c9c2ec', y: '#eeeaff' };
const ECHO_REAL = {
  walt: { x: '#7a5a44', y: '#e8b890' }, juno: { x: '#d04a4a', y: '#f2c8a0' },
  hester: { x: '#8a6aa8', y: '#e8d0b8' }, pip: { x: '#e8c040', y: '#f2c8a0' }, lily: { x: '#ff8ab0', y: '#f2c8a0' },
};

const Sprites = {
  cache: {},
  get(name) {
    if (this.cache[name]) return this.cache[name];
    let base = name, pal = null;
    // "walt@real" style names pick a different palette for the echo silhouettes.
    if (name.includes('@')) { const [b, mode] = name.split('@'); base = b; pal = mode === 'real' ? ECHO_REAL[b] : ECHO_TINT; }
    const def = SPRITE_DEFS[base];
    pal = pal || def.pal || ECHO_TINT;
    const out = {};
    for (const fname in def.frames) {
      const rows = def.frames[fname], h = rows.length, w = rows[0].length;
      const c = makeCanvas(w, h), f = makeCanvas(w, h);
      const g = c.getContext('2d'), gf = f.getContext('2d');
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const col = pal[rows[y][x]];
          if (!col) continue;
          g.fillStyle = col; g.fillRect(x, y, 1, 1);
          gf.fillStyle = col; gf.fillRect(w - 1 - x, y, 1, 1);
        }
      }
      out[fname] = { c, f, w, h };
    }
    return (this.cache[name] = out);
  },
  frame(name, frame) { const s = this.get(name); return s[frame] || s.idle0 || Object.values(s)[0]; },
  // (x, y) is the bottom centre. flip mirrors horizontally; sx/sy squash and stretch.
  draw(g, name, frame, x, y, flip = false, sx = 1, sy = 1) {
    const fr = this.frame(name, frame);
    const w = Math.round(fr.w * sx), h = Math.round(fr.h * sy);
    g.drawImage(flip ? fr.f : fr.c, Math.round(x - w / 2), Math.round(y - h), w, h);
  },
};

// ---------- Portraits (30x30), with expressions ----------
// Expressions: '' neutral, sad, smile, surprised, angry, down (looking away), cry, glitch
const Portraits = {
  cache: {},
  draw(g, who, expr, x, y, tint) {
    const key = `${who}|${expr || ''}|${tint ? 1 : 0}|${who === 'ELI' && Game.save && Game.save.hasDash ? 1 : 0}`;
    let c = this.cache[key];
    if (!c) {
      c = makeCanvas(30, 30);
      this.paint(c.getContext('2d'), who, expr || '');
      if (tint) {
        const gc = c.getContext('2d');
        gc.globalCompositeOperation = 'source-atop';
        gc.fillStyle = 'rgba(200,190,240,0.55)'; gc.fillRect(0, 0, 30, 30);
        gc.globalCompositeOperation = 'source-over';
      }
      this.cache[key] = c;
    }
    g.drawImage(c, x, y);
  },

  paint(g, who, e) {
    const R = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
    // Generic eyes and mouths, positioned per character.
    const eyes = (lx, rx, y, col, opts = {}) => {
      const white = opts.white || '#ffffff';
      if (e === 'smile') { [lx, rx].forEach((ex) => { R(ex, y + 1, 1, 1, col); R(ex + 1, y, 1, 1, col); R(ex + 2, y + 1, 1, 1, col); }); return; }
      if (e === 'closed' || e === 'cry') { [lx, rx].forEach((ex) => R(ex, y + 1, 3, 1, col)); if (e === 'cry') { R(lx + 1, y + 2, 1, 3, '#8fd0ff'); R(rx + 1, y + 2, 1, 2, '#8fd0ff'); } return; }
      if (e === 'surprised') { [lx, rx].forEach((ex) => { R(ex, y - 1, 3, 4, col); R(ex + 1, y, 1, 2, white); }); return; }
      const dy = e === 'down' ? 1 : 0, dx = e === 'down' ? -1 : 0;
      [lx, rx].forEach((ex) => { R(ex + dx + 1, y + dy - 1, 1, 1, col); R(ex + dx, y + dy, 3, 2, col); R(ex + dx + (opts.hlRight ? 2 : 0), y + dy, 1, 1, white); });
      if (e === 'sad' || e === 'down') { R(lx, y - 3, 2, 1, opts.brow || col); R(lx + 2, y - 4, 1, 1, opts.brow || col); R(rx + 1, y - 3, 2, 1, opts.brow || col); R(rx, y - 4, 1, 1, opts.brow || col); }
      if (e === 'angry') { R(lx, y - 4, 1, 1, opts.brow || col); R(lx + 1, y - 3, 2, 1, opts.brow || col); R(rx, y - 3, 2, 1, opts.brow || col); R(rx + 2, y - 4, 1, 1, opts.brow || col); }
    };
    const mouth = (mx, my, col, inner) => {
      if (e === 'smile') { R(mx - 1, my - 1, 1, 1, col); R(mx, my, 3, 1, col); R(mx + 3, my - 1, 1, 1, col); }
      else if (e === 'surprised') { R(mx, my - 1, 2, 2, inner || col); }
      else if (e === 'sad' || e === 'cry') { R(mx, my, 3, 1, col); R(mx - 1, my + 1, 1, 1, col); R(mx + 3, my + 1, 1, 1, col); }
      else if (e === 'angry') { R(mx - 1, my, 5, 1, col); }
      else R(mx, my, 3, 1, col);
    };
    switch (who) {
      case 'ELI': {
        R(5, 22, 20, 8, '#6f7fa8'); R(5, 22, 20, 1, '#9aa9cf'); R(11, 22, 8, 3, '#4c5880'); R(12, 24, 1, 4, '#ece8f2'); R(17, 24, 1, 4, '#ece8f2');
        R(12, 19, 6, 4, '#cf9a7c');
        R(7, 7, 16, 14, '#f2c8a0'); R(7, 7, 2, 14, '#cf9a7c'); R(8, 19, 14, 2, '#e0b090');
        R(5, 3, 20, 6, '#4a2f2a'); R(4, 6, 4, 10, '#4a2f2a'); R(22, 6, 3, 7, '#4a2f2a');
        R(9, 8, 4, 3, '#4a2f2a'); R(14, 8, 3, 2, '#4a2f2a'); R(19, 8, 4, 2, '#4a2f2a'); R(8, 3, 9, 1, '#6e4a3c'); R(11, 4, 3, 1, '#6e4a3c');
        R(5, 13, 2, 3, '#e0a888');
        eyes(10, 17, 13, '#1b1626', { brow: '#4a2f2a' });
        R(9, 16, 2, 1, '#f0a8a0'); R(19, 16, 2, 1, '#f0a8a0');
        mouth(14, 18, '#a0605a', '#5a2a2a');
        if (Game.save && Game.save.hasDash) { R(21, 23, 3, 2, '#ff4d6d'); R(23, 25, 1, 3, '#ff4d6d'); }
        break;
      }
      case 'REMI': case '???': {
        R(4, 6, 22, 24, '#1c1420');
        R(6, 22, 18, 8, '#f2f0ff'); R(6, 22, 18, 1, '#ffffff'); R(13, 22, 4, 2, '#c9c4e8'); R(14, 23, 2, 2, '#ff3b5c');
        R(12, 19, 6, 4, '#d8b0a0');
        R(8, 8, 14, 13, '#f6dcc6'); R(8, 19, 14, 2, '#ecc8b4');
        R(6, 3, 18, 6, '#1c1420'); R(8, 8, 5, 3, '#1c1420'); R(13, 8, 2, 2, '#1c1420'); R(17, 8, 5, 3, '#1c1420'); R(9, 4, 6, 1, '#3a2840');
        R(19, 1, 7, 4, '#ff3b5c'); R(21, 2, 3, 2, '#b8203c'); R(17, 3, 3, 3, '#ff3b5c'); R(25, 4, 2, 3, '#ff3b5c');
        eyes(10, 17, 13, '#3a1a2a', { brow: '#1c1420', white: '#ffd0dc' });
        R(9, 16, 2, 1, '#ffb0bc'); R(19, 16, 2, 1, '#ffb0bc');
        mouth(14, 18, '#c07080', '#6a2a3a');
        if (who === '???') { g.globalAlpha = 0.7; R(8, 8, 14, 9, '#1c1420'); g.globalAlpha = 1; R(11, 13, 2, 1, '#ff7a8a'); R(17, 13, 2, 1, '#ff7a8a'); }
        break;
      }
      case 'MOM': {
        R(4, 22, 22, 8, '#5fb8b0'); R(4, 22, 22, 1, '#8fd8d0'); R(12, 22, 6, 3, '#f0c4a0'); R(19, 25, 4, 3, '#ffffff'); R(20, 26, 2, 1, '#ff5a6a');
        R(12, 19, 6, 4, '#c8987c');
        R(8, 7, 14, 14, '#f0c4a0'); R(8, 7, 2, 14, '#c8987c');
        R(6, 3, 18, 6, '#5a3628'); R(6, 6, 3, 10, '#5a3628'); R(21, 6, 3, 9, '#5a3628'); R(12, 0, 7, 4, '#5a3628'); R(13, 1, 4, 1, '#7a4a38');
        R(10, 8, 10, 1, '#5a3628');
        eyes(10, 17, 13, '#2a1e24', { brow: '#5a3628' });
        R(10, 16, 3, 1, '#d0a088'); R(17, 16, 3, 1, '#d0a088');
        mouth(14, 18, '#a0605a', '#5a2a2a');
        break;
      }
      case 'WALT': {
        R(3, 22, 24, 8, '#7a5a44'); R(12, 22, 6, 3, '#e8e0d0');
        R(12, 19, 6, 4, '#c89878');
        R(7, 8, 16, 14, '#e8b890'); R(7, 8, 2, 14, '#c89878');
        R(8, 17, 14, 5, '#a08070'); R(11, 18, 8, 1, '#e8b890');
        R(5, 3, 20, 6, '#c03a3a'); R(5, 6, 20, 1, '#ffffff'); R(18, 8, 9, 2, '#a02a2a'); R(10, 4, 6, 2, '#ffffff');
        eyes(10, 17, 12, '#2a1e18', { brow: '#5a4030' });
        R(9, 10, 4, 1, '#5a4030'); R(17, 10, 4, 1, '#5a4030');
        mouth(14, 19, '#5a3028', '#2a1010');
        break;
      }
      case 'JUNO': {
        R(5, 22, 20, 8, '#d04a4a'); R(5, 22, 20, 1, '#f07070'); R(10, 22, 10, 2, '#ffffff');
        R(12, 19, 6, 4, '#d8a888');
        R(8, 8, 14, 13, '#f2c8a0'); R(8, 8, 2, 13, '#d8a888');
        R(7, 3, 16, 7, '#2a1a14'); R(20, 2, 8, 4, '#2a1a14'); R(25, 5, 3, 10, '#2a1a14'); R(22, 4, 3, 2, '#ffd36b');
        R(18, 15, 4, 2, '#ffffff'); R(19, 15, 1, 2, '#e0d0c0');
        eyes(10, 16, 13, '#1e1410', { brow: '#2a1a14' });
        mouth(13, 18, '#a0605a', '#5a2a2a');
        break;
      }
      case 'HESTER': {
        R(3, 21, 24, 9, '#8a6aa8'); R(3, 21, 24, 1, '#aa8ac8'); R(8, 24, 14, 1, '#6a4a88');
        R(12, 18, 6, 4, '#c8a888');
        R(8, 7, 14, 14, '#e8d0b8'); R(8, 7, 2, 14, '#c8a888'); R(10, 18, 10, 1, '#d0b8a0');
        R(8, 3, 14, 5, '#e8e8f0'); R(12, 0, 6, 4, '#e8e8f0'); R(7, 6, 2, 6, '#e8e8f0'); R(21, 6, 2, 6, '#e8e8f0');
        R(9, 11, 5, 4, '#6a5a50'); R(16, 11, 5, 4, '#6a5a50'); R(10, 12, 3, 2, '#e8f0ff'); R(17, 12, 3, 2, '#e8f0ff'); R(14, 12, 2, 1, '#6a5a50');
        if (e === 'closed' || e === 'smile') { R(10, 13, 3, 1, '#3a2a2a'); R(17, 13, 3, 1, '#3a2a2a'); }
        else { R(11, 12, 1, 2, '#3a2a2a'); R(18, 12, 1, 2, '#3a2a2a'); }
        mouth(14, 17, '#8a5a5a', '#3a1a1a');
        break;
      }
      case 'PIP': {
        R(6, 23, 18, 7, '#e8c040'); R(6, 23, 18, 1, '#ffe080');
        R(18, 20, 9, 9, '#a07050'); R(19, 19, 2, 2, '#a07050'); R(24, 19, 2, 2, '#a07050'); R(21, 23, 1, 1, '#1e1410'); R(23, 23, 1, 1, '#1e1410');
        R(8, 9, 14, 13, '#f2c8a0'); R(8, 9, 2, 13, '#d8a888');
        R(6, 4, 18, 7, '#c08040'); R(7, 9, 3, 3, '#c08040'); R(13, 9, 3, 2, '#c08040'); R(19, 9, 3, 3, '#c08040'); R(9, 3, 3, 2, '#c08040'); R(16, 2, 2, 3, '#c08040');
        eyes(10, 16, 14, '#1e1410', { brow: '#c08040' });
        mouth(13, 19, '#a0605a', '#5a2a2a');
        break;
      }
      case 'HOLLOW': {
        R(5, 22, 20, 8, '#1c0d24'); R(11, 22, 8, 3, '#12061a');
        R(12, 19, 6, 4, '#1e0c24');
        R(7, 7, 16, 14, '#2a1230');
        R(5, 3, 20, 6, '#1a0c1e'); R(4, 6, 4, 10, '#1a0c1e'); R(22, 6, 3, 7, '#1a0c1e'); R(9, 8, 4, 3, '#1a0c1e'); R(19, 8, 4, 2, '#1a0c1e');
        R(10, 13, 3, 2, '#ff2a4a'); R(17, 13, 3, 2, '#ff2a4a'); R(11, 13, 1, 1, '#ffd0d8'); R(18, 13, 1, 1, '#ffd0d8');
        R(13, 18, 5, 1, '#ff2a4a');
        for (let i = 0; i < 6; i++) R(0, 4 + i * 5, 30, 1, 'rgba(255,42,74,0.12)');
        break;
      }
      default: {
        R(9, 9, 12, 12, '#b7b0d8');
      }
    }
  },
};

// 8x8 achievement icons. '#' takes the tier color, '+' is a highlight, 'r' is ribbon red.
const ACH_ICONS = {
  eye: ['........', '..####..', '.#....#.', '#..rr..#', '#..rr..#', '.#....#.', '..####..', '........'],
  ribbon: ['.##..##.', '#rr##rr#', '#rrrrrr#', '.##rr##.', '..#rr#..', '.#r..r#.', '#r....r#', '........'],
  tag: ['........', '.######.', '#......#', '#.+++..#', '#......#', '#.++++.#', '.######.', '........'],
  club: ['...##...', '..####..', '..####..', '##.##.##', '########', '##.##.##', '...##...', '..####..'],
  spade: ['...##...', '..####..', '.######.', '########', '########', '.##..##.', '...##...', '..####..'],
  diamond: ['...##...', '..####..', '.##+###.', '##+#####', '.######.', '..####..', '...##...', '........'],
  heart: ['........', '.##..##.', '#+######', '########', '.######.', '..####..', '...##...', '........'],
  hollow: ['..####..', '.######.', '##r##r##', '##r##r##', '########', '###..###', '.##..##.', '..####..'],
  cup: ['..#.#...', '...#.#..', '........', '.######.', '.#++++##', '.#++++.#', '.#++++##', '..####..'],
  shard: ['....#...', '...##...', '..#+#...', '..#++#..', '.#+++#..', '.#++##..', '..###...', '........'],
  coat: ['...+#...', '..#..#..', '.##++##.', '###..###', '##.##.##', '##.##.##', '.#.##.#.', '.######.'],
  note: ['.######.', '.#++++#.', '.#....#.', '.#+++.#.', '.#....#.', '.#++..#.', '.#..r.#.', '.######.'],
  clock: ['..####..', '.#....#.', '#..+...#', '#...+..#', '#...++.#', '#......#', '.#....#.', '..####..'],
  bow: ['........', '##....##', '#r#..#r#', '#rr##rr#', '#r#rr#r#', '##.rr.##', '...rr...', '..r..r..'],
  star: ['...##...', '...##...', '########', '.##++##.', '..####..', '.##..##.', '.#....#.', '........'],
  lens: ['.####...', '#+...#..', '#+...#..', '#....#..', '.####...', '....##..', '.....##.', '......##'],
  bubble: ['.######.', '#......#', '#.+.+.+#', '#......#', '.######.', '...#....', '..#.....', '........'],
  pair: ['.##..##.', '.##..##.', '........', '########', '###..###', '.#....#.', '.#....#.', '........'],
  wall: ['.##..#..', '.##..#..', '.....#..', '###..#..', '###..#..', '.#...#..', '.#...#..', '.....#..'],
  halves: ['........', '.##..rr.', '###.rrrr', '###.rrrr', '.##.rrr.', '..#.rr..', '....r...', '........'],
  grip: ['#.......', '#..#.#..', '#.##.#.#', '#.######', '#.######', '#..####.', '#..####.', '#.......'],
  fist: ['........', '.#.#.#..', '########', '#+######', '########', '.######.', '..####..', '........'],
  arrow: ['....#...', '....##..', '##.####.', '.#######', '##.####.', '....##..', '....#...', '........'],
  feather: ['......##', '....####', '...##+#.', '..##+#..', '.##+#...', '.##.....', '#.......', '........'],
  moon: ['..###...', '.##.....', '##......', '##......', '##....+.', '.##...#.', '..####..', '........'],
  sunrise: ['........', '...##...', '.#....#.', '..####..', '.######.', '########', '.+.+.+.+', '........'],
  ghost: ['..####..', '.######.', '##+##+##', '########', '########', '########', '#.##.##.', '........'],
  stone: ['..####..', '.######.', '.##+###.', '.#+++##.', '.##+###.', '.######.', '.######.', '########'],
  bed: ['........', '#.......', '#.++....', '#.++####', '########', '#......#', '#......#', '........'],
  hourglass: ['########', '.#++++#.', '..#++#..', '...##...', '...##...', '..#..#..', '.#++++#.', '########'],
  door: ['.######.', '.#....#.', '.#....#.', '.#....#.', '.#...+#.', '.#....#.', '.#....#.', '.######.'],
  rain: ['#...#...', '..#...#.', '#...#...', '..#...#.', '#...#...', '..#...#.', '........', '########'],
  heartbow: ['........', '.##..##.', '#rr##rr#', '#rrrrrr#', '.#rrrr#.', '..#rr#..', '...##...', '........'],
  sun: ['...##...', '.#....#.', '..####..', '#.#++#.#', '#.####.#', '..####..', '.#....#.', '...##...'],
  suits: ['.#....#.', '###..###', '.#....#.', '........', '.#...#.#', '###..###', '.#....#.', '........'],
  sixseven: ['........', '.##.####', '#.....#.', '###...#.', '#.#..#..', '#.#..#..', '.#...#..', '........'],
  phone: ['..####..', '..#++#..', '..#++#..', '..#++#..', '..#++#..', '..####..', '..#r##..', '..####..'],
  zzz: ['....####', '......#.', '.....#..', '....####', '###.....', '..#.....', '.#......', '###.....'],
  ecg: ['........', '...#....', '...#....', '..#.#...', '#.#.#.##', '.#...#..', '.....#..', '........'],
  hand: ['...#....', '.#.#.#..', '.#.#.#.#', '.#.#.#.#', '.######.', '.######.', '..####..', '..####..'],
  wings: ['#......#', '##....##', '###..###', '.##rr##.', '..#rr#..', '...##...', '..#..#..', '........'],
  mask: ['.######.', '########', '##+##+##', '########', '#.####.#', '##....##', '.######.', '..####..'],
  nightmoon: ['......#.', '.....###', '..##..#.', '.##.....', '##......', '##....+.', '.##..##.', '..####..'],
  crown: ['........', '#..##..#', '##.##.##', '########', '#+#r#+##', '########', '########', '........'],
  locked: ['..####..', '.#....#.', '.....#..', '....#...', '...#....', '........', '...#....', '........'],
};

// Draws an achievement icon at (x, y), each cell s pixels. lit: unlocked (in color) or a dim silhouette.
function drawAchIcon(g, key, x, y, s, color, lit) {
  const rows = ACH_ICONS[key] || ACH_ICONS.locked;
  const pal = lit ? { '#': color, '+': '#ffffff', r: '#ff4d6d' } : { '#': '#3a3f5c', '+': '#2c3048', r: '#4a3a50' };
  for (let j = 0; j < 8; j++) {
    for (let i = 0; i < 8; i++) {
      const c = pal[rows[j][i]];
      if (c) { g.fillStyle = c; g.fillRect(x + i * s, y + j * s, s, s); }
    }
  }
}
