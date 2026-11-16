// Headless reachability check: runs the real Player physics with BFS over input macros.
// Usage: node tools/solve.js [roomId...]   (no ids = every room; a few minutes per room)
const fs = require('fs'), vm = require('vm'), path = require('path');
const root = path.join(__dirname, '..', 'Mechanics') + '/';
const prelude = `
  var window = {}, navigator = {}, addEventListener = () => {}, performance = { now: () => 0 };
`;
const stubs = `
  var reached = {};
  var Game = { options: { assist: false, lowFx: true }, save: { hasDash: false, frags: {} },
    shake(){}, killPlayer(){ ctx.curP.dead = true; }, collectFragment(f){} };
  var Art = { pal: () => ({ base: '#000', dust: '#fff' }) };
  var Achievements = { unlock(){}, addStat(){} };
  Sound.play = function(){};
  Input.held = (a) => !!ctx.IN[a];
  Input.pressed = (a) => !!ctx.IN['p_' + a];
  Object.assign(ctx, { ROOMS, World, Player, PHYS, Game, W, H, overlap });
`;
const ctx = { IN: {}, curP: null };
let code = prelude;
for (const f of ['core.js', 'levels.js', 'world.js', 'player.js']) code += fs.readFileSync(root + f, 'utf8').replace(/'use strict';/g, '') + '\n';
code += stubs;
new Function('ctx', code)(ctx);
const ACTIONS = [];
for (const h of [-1, 0, 1]) {
  ACTIONS.push({ h });
  ACTIONS.push({ h, jump: 'press' });
  ACTIONS.push({ h, jump: 'hold' });
  ACTIONS.push({ h, grab: true, v: -1 });
  ACTIONS.push({ h, grab: true, jump: 'press' });
}
for (const h of [-1, 0, 1]) for (const v of [-1, 0, 1]) if (h || v) ACTIONS.push({ h, v, dash: true }), ACTIONS.push({ h, v, dash: true, jump: 'hold' });
ACTIONS.push({ grab: true });

function solve(id) {
  const World = ctx.World, Player = ctx.Player, Game = ctx.Game;
  const idx = ctx.ROOMS.findIndex((r) => r.id === id);
  World.load(idx);
  const room = World.room;
  const results = {};
  const runs = [];
  const hasDashRoom = room.ch > 1 || id === '1-5';
  // 1-5: Remi must be reachable without dash; the rest of the room is played with it.
  if (id === '1-5') runs.push({ dash: false, goals: ['npc'] }), runs.push({ dash: true, goals: ['exit', 'frag'] });
  else runs.push({ dash: hasDashRoom, goals: ['exit', 'frag', 'npc', 'look'] });
  for (const run of runs) {
    Game.save.hasDash = run.dash;
    const start = new Player(World.spawn.x, World.spawn.y);
    if (!run.dash) start.dashes = 0;
    const need = new Set();
    if (run.goals.includes('exit') && room.exit !== 'none') need.add('exit');
    if (run.goals.includes('frag')) World.fragments.forEach(() => need.add('frag'));
    if (run.goals.includes('npc')) World.npcs.forEach((n, i) => need.add('npc' + i));
    if (run.goals.includes('look')) World.looks.forEach((n, i) => need.add('look' + i));
    const found = new Set();
    const seen = new Set();
    let q = [start], steps = 0;
    const K = 8, LIMIT = +(process.env.LIMIT || 250000);
    const key = (p) => `${p.x >> 2},${p.y >> 2},${Math.round(p.vx / 1.2)},${Math.round(p.vy / 1.2)},${p.dashes},${p.dashTime > 0 ? 1 : 0},${p.grabbing ? 1 : 0},${(p.stamina / 40) | 0},${p.jumping ? 1 : 0}`;
    const check = (p) => {
      if (room.exit === 'right' && p.x >= W_ - 3) found.add('exit');
      if (room.exit === 'top' && p.y + p.h < 2) found.add('exit');
      for (const f of World.fragments) if (ctx.overlap(p.x, p.y, p.w, p.h, f.x - 5, f.y - 6, 10, 12)) found.add('frag');
      World.npcs.forEach((n, i) => { if (Math.abs(p.x + 3 - n.x) < 18 && Math.abs(p.y + 10 - n.y) < 16) found.add('npc' + i); });
      World.looks.forEach((n, i) => { if (Math.abs(p.x + 3 - n.x) < 14 && Math.abs(p.y + 10 - n.y) < 26) found.add('look' + i); });
    };
    const W_ = ctx.W;
    while (q.length && seen.size < LIMIT) {
      const next = [];
      for (const p0 of q) {
        for (const a of ACTIONS) {
          if (a.dash && (p0.dashes < 1 || !run.dash)) continue;
          const p = Object.assign(Object.create(Player.prototype), p0);
          p.dashDir = { x: p0.dashDir.x, y: p0.dashDir.y }; p.trail = [];
          ctx.curP = p;
          let ok = true;
          for (let f = 0; f < K; f++) {
            const IN = {};
            if (a.h === 1) IN.right = 1; if (a.h === -1) IN.left = 1;
            if (a.v === 1) IN.down = 1; if (a.v === -1) IN.up = 1;
            if (a.jump) IN.jump = 1;
            if (a.jump === 'press' && f === 0) IN.p_jump = 1;
            if (a.dash && f === 0) IN.p_dash = 1;
            if (a.grab) IN.grab = 1;
            ctx.IN = IN;
            p.update();
            for (const d of World.crystals) d.active = true;
            if (p.dead) { ok = false; break; }
            check(p);
          }
          if (!ok) continue;
          const k = key(p);
          if (seen.has(k)) continue;
          seen.add(k);
          next.push(p);
        }
      }
      q = next; steps++;
      if ([...need].every((n) => found.has(n))) break;
    }
    for (const n of need) results[n + (run.dash ? '' : '(nodash)')] = found.has(n);
    results._states = (results._states || 0) + seen.size;
  }
  return results;
}

const ids = process.argv.slice(2).length ? process.argv.slice(2) : ctx.ROOMS.map((r) => r.id);
let bad = 0;
for (const id of ids) {
  const t = Date.now();
  const r = solve(id);
  const fails = Object.entries(r).filter(([k, v]) => k !== '_states' && !v).map(([k]) => k);
  if (fails.length) bad++;
  console.log(`${id.padEnd(4)} ${fails.length ? 'FAIL ' + fails.join(' ') : 'ok'}   (${r._states} states, ${((Date.now() - t) / 1000).toFixed(1)}s)`);
}
process.exit(bad ? 1 : 0);
