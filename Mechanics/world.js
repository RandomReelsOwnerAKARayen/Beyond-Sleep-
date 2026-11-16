'use strict';
// World: room parsing, collision grid, entities, particles and the Hollow (chaser).
// Rendering lives in art.js; this file is pure game logic so it can also run headless.

const World = {
  room: null, index: 0, chapter: 1,
  solidGrid: new Uint8Array(COLS * ROWS), chars: [],
  spawn: { x: 0, y: 0 }, crumbles: [], crystals: [], springs: [], fragments: [], npcs: [], looks: [], props: [],
  particles: [], t: 0, hollow: null,

  load(index) {
    this.index = index;
    this.room = ROOMS[index];
    this.chapter = this.room.ch;
    this.chars = this.room.map.map((r) => r.split(''));
    this.crumbles = []; this.crystals = []; this.springs = []; this.fragments = []; this.npcs = [];
    this.particles = [];
    this.solidGrid.fill(0);
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const ch = this.chars[r][c], x = c * TILE, y = r * TILE;
        if (ch === '#') this.solidGrid[r * COLS + c] = 1;
        else if (ch === 'C') { this.crumbles.push({ c, r, state: 0, t: 0 }); this.solidGrid[r * COLS + c] = 1; }
        else if (ch === 'D') this.crystals.push({ x: x + 4, y: y + 4, active: true, t: 0 });
        else if (ch === 'S') this.springs.push({ x, y, t: 0 });
        else if (ch === 'M') this.fragments.push({ id: this.room.id, x: x + 4, y: y + 4 });
        else if (ch === 'N') this.npcs.push(this.makeNpc(this.room.echo, c, r, 'echo'));
        else if (ch === 'G') this.npcs.push(this.makeNpc('remi', c, r, 'her'));
        else if (ch === 'O') this.npcs.push(this.makeNpc('mom', c, r, 'mom'));
      }
    }
    for (const [who, c, r] of this.room.cameos || []) this.npcs.push(this.makeNpc(who, c, r, 'cameo'));
    this.looks = (this.room.look || []).map(([c, r, key]) => ({ x: c * TILE + 4, y: (r + 1) * TILE, key }));
    this.props = (this.room.props || []).map(([kind, c, r]) => ({ kind, c, r, x: c * TILE, y: (r + 1) * TILE }));
    // Spawn the player standing on the floor beneath 'P' (hitbox is 6x10).
    const sp = this.room.map.findIndex((r) => r.includes('P'));
    this.spawn = { x: this.room.map[sp].indexOf('P') * TILE + 1, y: (sp + 1) * TILE - 10 };
    this.hollow = this.room.chaser ? new Hollow() : null;
  },

  // NPCs are anchored by their feet: (x, y) is the bottom centre of the tile they stand in.
  makeNpc(who, c, r, kind) {
    return { who, kind, x: c * TILE + 4, y: (r + 1) * TILE, done: false, face: -1 };
  },

  reset() {
    for (const cr of this.crumbles) { cr.state = 0; cr.t = 0; this.solidGrid[cr.r * COLS + cr.c] = 1; }
    for (const d of this.crystals) { d.active = true; d.t = 0; }
    if (this.hollow) this.hollow = new Hollow();
  },

  isSolidTile(c, r) {
    if (c < 0) return true;
    if (c >= COLS) return this.room.exit !== 'right';
    if (r < 0) return this.room.exit !== 'top';
    if (r >= ROWS) return false;
    return this.solidGrid[r * COLS + c] === 1;
  },

  // True if the rectangle overlaps any solid tile.
  solid(x, y, w, h) {
    const c0 = Math.floor(x / TILE), c1 = Math.floor((x + w - 1) / TILE);
    const r0 = Math.floor(y / TILE), r1 = Math.floor((y + h - 1) / TILE);
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (this.isSolidTile(c, r)) return true;
    return false;
  },

  // Spikes only hurt when moving into them, like Celeste.
  spikeHit(p) {
    const c0 = Math.floor(p.x / TILE), c1 = Math.floor((p.x + p.w - 1) / TILE);
    const r0 = Math.floor(p.y / TILE), r1 = Math.floor((p.y + p.h - 1) / TILE);
    for (let r = Math.max(0, r0); r <= Math.min(ROWS - 1, r1); r++) {
      for (let c = Math.max(0, c0); c <= Math.min(COLS - 1, c1); c++) {
        const ch = this.chars[r][c];
        if (ch === '^' && p.vy >= 0 && overlap(p.x, p.y, p.w, p.h, c * TILE, r * TILE + 4, TILE, 4)) return true;
        if (ch === 'v' && p.vy <= 0 && overlap(p.x, p.y, p.w, p.h, c * TILE, r * TILE, TILE, 4)) return true;
      }
    }
    return false;
  },

  touchCrumbles(x, y, w, h) {
    for (const cr of this.crumbles) {
      if (cr.state === 0 && overlap(x, y, w, h, cr.c * TILE, cr.r * TILE, TILE, TILE)) {
        cr.state = 1; cr.t = 0; Sound.play('crumble');
      }
    }
  },

  update(p) {
    this.t++;
    for (const cr of this.crumbles) {
      cr.t++;
      if (cr.state === 1 && cr.t > 36) {
        cr.state = 2; cr.t = 0; this.solidGrid[cr.r * COLS + cr.c] = 0;
        this.burst(cr.c * TILE + 4, cr.r * TILE + 4, 8, Art.pal().base, 1);
      } else if (cr.state === 2 && cr.t > 150 && !(p && overlap(p.x, p.y, p.w, p.h, cr.c * TILE, cr.r * TILE, TILE, TILE))) {
        cr.state = 0; cr.t = 0; this.solidGrid[cr.r * COLS + cr.c] = 1;
      }
    }
    for (const d of this.crystals) if (!d.active && ++d.t > 150) { d.active = true; this.burst(d.x, d.y, 6, '#7ff6ff', 0.8); }
    for (const s of this.springs) if (s.t > 0) s.t--;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const q = this.particles[i];
      q.x += q.vx; q.y += q.vy; q.vy += q.g; q.vx *= 0.96;
      if (--q.life <= 0) this.particles.splice(i, 1);
    }
    // NPCs turn to face the player.
    if (p) for (const n of this.npcs) if (Math.abs(p.x + 3 - n.x) > 2) n.face = p.x + 3 > n.x ? 1 : -1;
  },

  burst(x, y, n, color, speed = 1.5, g = 0.05) {
    const cap = Game.options.lowFx ? 60 : 260;
    for (let i = 0; i < n && this.particles.length < cap; i++) {
      const a = Math.random() * Math.PI * 2, s = rand(0.3, 1) * speed;
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g, life: rand(18, 40) | 0, max: 40, color, size: Math.random() < 0.3 ? 2 : 1 });
    }
  },

  // Single dust puff (feet, walls).
  dust(x, y, n = 3, dir = 0) {
    const cap = Game.options.lowFx ? 60 : 260;
    for (let i = 0; i < n && this.particles.length < cap; i++) {
      this.particles.push({ x: x + rand(-2, 2), y, vx: dir * rand(0.2, 0.8) + rand(-0.4, 0.4), vy: -rand(0.1, 0.5), g: -0.005, life: rand(14, 26) | 0, max: 26, color: Art.pal().dust, size: Math.random() < 0.4 ? 2 : 1 });
    }
  },
};

// The Hollow: everything Eli believes about himself at his worst. It follows the exact path
// he took, a moment behind, and touching it ends the attempt.
class Hollow {
  constructor() { this.hist = []; this.started = false; this.visible = false; this.x = 0; this.y = 0; this.f = 1; this.pose = 'idle'; this.delay = 66; this.appear = 0; }
  record(p) {
    if (!this.started) {
      if (Math.abs(p.x - World.spawn.x) < 4 && Math.abs(p.y - World.spawn.y) < 4) return;
      this.started = true;
      Sound.play('hollow');
    }
    this.hist.push({ x: p.x, y: p.y, f: p.facing, pose: p.pose });
    if (this.hist.length > this.delay) {
      const s = this.hist.shift();
      if (!this.visible) { this.visible = true; World.burst(s.x + 3, s.y + 5, 18, '#2a0f24', 1.6, 0); }
      this.x = s.x; this.y = s.y; this.f = s.f; this.pose = s.pose;
      this.appear++;
    }
  }
  hits(p) { return this.visible && this.appear > 20 && overlap(p.x + 1, p.y + 1, p.w - 2, p.h - 2, this.x + 1, this.y + 1, 4, 8); }
}

function overlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}
