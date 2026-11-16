'use strict';
// Long-idle animation timings, in frames (60 fps): fidgets start at 20s, Eli sits down to doze ~5.5s later.
const IDLE = { START: 1200, DOZE: 1530 };

// Player physics (units: pixels per frame at 60 fps).
const PHYS = {
  RUN: 1.5, ACCEL: 0.25, AIR_ACCEL: 0.17, OVER_DECEL: 0.05,
  GRAV: 0.22, MAX_FALL: 3.2, FAST_FALL: 4.2, WALL_SLIDE: 1.3,
  JUMP: -3.4, JUMP_CUT: -1.2, WALL_JUMP_X: 2.0,
  COYOTE: 6, BUFFER: 6,
  DASH_SPEED: 3.6, DASH_TIME: 10,
  CLIMB_UP: 0.9, CLIMB_DOWN: 1.5, STAMINA: 110, CLIMB_COST: 0.75, HOLD_COST: 0.17, CLIMB_JUMP_COST: 27.5,
  SPRING: -6,
  AIR_JUMP: -3.1, AIR_JUMPS: 1,
  SPRINT_RUN: 2.4, SPRINT_DRAIN: 1 / 150, SPRINT_REGEN: 1 / 170,
};

class Player {
  constructor(x, y) {
    this.x = x; this.y = y; this.w = 6; this.h = 10;
    this.vx = 0; this.vy = 0; this.rx = 0; this.ry = 0;
    this.facing = 1; this.onGround = true; this.wasGround = true;
    this.coyote = 0; this.jumpBuf = 0; this.jumping = false;
    this.dashes = 1; this.dashTime = 0; this.dashDir = { x: 0, y: 0 }; this.freeze = 0;
    this.airJumps = PHYS.AIR_JUMPS; this.sprint = 1; this.sprintLock = false; this.sprinting = false; this.sprintAlpha = 0; this.sprintFlash = 0;
    this.grabbing = false; this.stamina = PHYS.STAMINA; this.forceTime = 0; this.forceDir = 0; this.noGrab = 0;
    this.dead = false; this.squash = 0; this.anim = 0; this.trail = []; this.pose = 'idle'; this.flash = 0; this.idleT = 0; this.idleFlip = false; this.zzz = [];
    // The red ribbon from the cake box: Mom tied it to the bed rail. It shows whether the dash is ready.
    this.ribbon = Array.from({ length: 7 }, () => ({ x: x + 3, y: y + 4 }));
  }

  collide(dx, dy) { return World.solid(this.x + dx, this.y + dy, this.w, this.h); }

  moveX(amt) {
    this.rx += amt;
    let m = Math.round(this.rx);
    this.rx -= m;
    const s = Math.sign(m);
    while (m !== 0) {
      if (this.collide(s, 0)) {
        // Dash corner correction: slip over small ledges when dashing sideways.
        if (this.dashTime > 0 && this.dashDir.y === 0) {
          let slipped = false;
          for (let k = 1; k <= 3; k++) if (!this.collide(s, -k)) { this.y -= k; slipped = true; break; }
          if (slipped) continue;
        }
        this.vx = 0; this.rx = 0; return;
      }
      this.x += s; m -= s;
    }
  }

  moveY(amt) {
    this.ry += amt;
    let m = Math.round(this.ry);
    this.ry -= m;
    const s = Math.sign(m);
    while (m !== 0) {
      if (this.collide(0, s)) {
        // Ceiling corner correction: nudge around the edge of a block when jumping up.
        if (s < 0) {
          let nudged = false;
          for (const k of [1, -1, 2, -2, 3, -3]) {
            if (!this.collide(k, s)) { this.x += k; nudged = true; break; }
          }
          if (nudged) continue;
        }
        if (s > 0 && this.vy > 1.5) { this.squash = 6; Sound.play('land'); World.dust(this.x + 3, this.y + this.h, 4, 0); }
        this.vy = 0; this.ry = 0; return;
      }
      this.y += s; m -= s;
    }
  }

  wallDir(dist = 1) {
    if (this.collide(dist * this.facing, 0)) return this.facing;
    if (this.collide(dist, 0)) return 1;
    if (this.collide(-dist, 0)) return -1;
    return 0;
  }

  refill() { if (this.dashes < 1) this.flash = 8; this.dashes = 1; this.stamina = PHYS.STAMINA; this.airJumps = PHYS.AIR_JUMPS; }

  startDash(h, v) {
    let dx = h, dy = v;
    if (!dx && !dy) dx = this.facing;
    const len = Math.hypot(dx, dy);
    this.dashDir = { x: dx / len, y: dy / len };
    this.dashes--; this.dashTime = PHYS.DASH_TIME; this.freeze = 3;
    this.grabbing = false; this.jumping = false;
    this.vx = this.dashDir.x * PHYS.DASH_SPEED; this.vy = this.dashDir.y * PHYS.DASH_SPEED;
    if (dx) this.facing = Math.sign(dx);
    Sound.play('dash'); Game.shake(4);
    World.burst(this.x + 3, this.y + 5, 8, '#9fe8ff', 1.2, 0);
    Achievements.addStat('dashes', 1);
  }

  jump(vx = this.vx) {
    this.vy = PHYS.JUMP; this.vx = vx; this.jumping = true;
    this.jumpBuf = 0; this.coyote = 0; this.squash = -5;
    Sound.play('jump');
    World.dust(this.x + 3, this.y + this.h, 4, 0);
  }

  update() {
    if (this.dead) return;
    if (this.freeze > 0) { this.freeze--; return; }
    const assist = Game.options.assist;
    const h = (Input.held('right') ? 1 : 0) - (Input.held('left') ? 1 : 0);
    const v = (Input.held('down') ? 1 : 0) - (Input.held('up') ? 1 : 0);

    this.wasGround = this.onGround;
    this.onGround = this.vy >= 0 && this.collide(0, 1);
    if (this.onGround) {
      this.coyote = PHYS.COYOTE;
      this.airJumps = PHYS.AIR_JUMPS;
      if (this.dashTime <= 0 && Game.save.hasDash) { if (this.dashes < 1) this.flash = 6; this.dashes = 1; }
      this.stamina = PHYS.STAMINA;
      World.touchCrumbles(this.x, this.y + this.h, this.w, 1);
    } else if (this.coyote > 0) this.coyote--;
    if (assist) { this.stamina = PHYS.STAMINA; if (Game.save.hasDash && this.dashTime <= 0) this.dashes = Math.max(this.dashes, 1); }

    // Up arrow doubles as jump, except when it's needed to climb (grab held) or to talk.
    const upFree = !Input.held('grab') && !Game.nearTalk;
    this.jumpHeld = Input.held('jump') || (upFree && Input.held('jumpAlt'));
    if (Input.pressed('jump') || (upFree && Input.pressed('jumpAlt'))) this.jumpBuf = PHYS.BUFFER; else if (this.jumpBuf > 0) this.jumpBuf--;
    if (h) this.facing = h;

    if (Input.pressed('dash') && this.dashes > 0 && Game.save.hasDash) { this.startDash(h, v); return; }

    // --- Dashing ---
    if (this.dashTime > 0) {
      this.dashTime--;
      if (this.dashTime % 2 === 0) this.trail.push({ x: this.x, y: this.y, f: this.facing, life: 12 });
      // Jumping out of a dash on the ground keeps horizontal speed (a "super").
      if (this.jumpBuf > 0 && this.coyote > 0 && this.dashDir.y <= 0) {
        this.dashTime = 0; this.jump(this.vx * 1.1);
      } else if (this.dashTime === 0) {
        this.vx *= 0.65;
        if (this.vy < 0) this.vy *= 0.5;
      }
      this.moveX(this.vx); this.moveY(this.vy);
      this.afterMove();
      return;
    }

    // --- Climbing ---
    const wd = this.wallDir();
    const wasGrabbing = this.grabbing;
    if (this.noGrab > 0) this.noGrab--;
    this.grabbing = Input.held('grab') && wd !== 0 && this.stamina > 0 && this.noGrab <= 0;
    if (wasGrabbing && !this.grabbing && Input.held('grab') && v < 0 && this.stamina > 0 && wd === 0) {
      // Climbed past the top of a wall: hop up onto the ledge.
      this.vy = -2.4; this.forceTime = 8; this.forceDir = this.facing;
    }
    if (this.grabbing) {
      this.airJumps = PHYS.AIR_JUMPS;
      this.facing = wd;
      this.vx = 0;
      Achievements.addStat('climbFrames', 1, true);
      if (this.jumpBuf > 0) {
        if (h === -wd) this.wallJump(wd);
        else { this.jump(0); if (!assist) this.stamina -= PHYS.CLIMB_JUMP_COST; this.grabbing = false; this.noGrab = 10; }
      } else if (v < 0) { this.vy = -PHYS.CLIMB_UP; if (!assist) this.stamina -= PHYS.CLIMB_COST; }
      else if (v > 0) this.vy = PHYS.CLIMB_DOWN;
      else { this.vy = 0; if (!assist) this.stamina -= PHYS.HOLD_COST; }
      if (this.grabbing) World.touchCrumbles(this.x + (wd > 0 ? this.w : -1), this.y, 1, this.h);
      this.moveX(0); this.moveY(this.vy);
      this.afterMove();
      return;
    }

    // --- Sprinting ---
    // Hold sprint to run faster. Running the bar dry locks it until it has refilled completely.
    this.sprinting = Input.held('sprint') && h !== 0 && !this.sprintLock && this.forceTime <= 0;
    if (this.sprinting) {
      if (!assist) this.sprint -= PHYS.SPRINT_DRAIN;
      if (this.sprint <= 0) { this.sprint = 0; this.sprintLock = true; this.sprinting = false; Sound.play('land'); }
    } else if (this.sprint < 1) {
      this.sprint = Math.min(1, this.sprint + PHYS.SPRINT_REGEN);
      if (this.sprint >= 1 && this.sprintLock) { this.sprintLock = false; this.sprintFlash = 8; }
    }

    // --- Running ---
    let target = h * (this.sprinting ? PHYS.SPRINT_RUN : PHYS.RUN);
    if (this.forceTime > 0) { this.forceTime--; target = this.forceDir * PHYS.RUN; }
    const accel = this.onGround ? PHYS.ACCEL : PHYS.AIR_ACCEL;
    if (Math.abs(this.vx) > Math.abs(target) && Math.sign(this.vx) === h) this.vx = approach(this.vx, target, PHYS.OVER_DECEL);
    else this.vx = approach(this.vx, target, accel);

    // --- Gravity ---
    let g = PHYS.GRAV;
    if (this.jumpHeld && Math.abs(this.vy) < 0.6) g *= 0.5; // floaty apex
    let maxFall = v > 0 ? PHYS.FAST_FALL : PHYS.MAX_FALL;
    if (wd !== 0 && h === wd && this.vy > 0) {
      maxFall = PHYS.WALL_SLIDE;
      if (this.anim % 5 === 0) World.dust(this.x + (wd > 0 ? 6 : 0), this.y + 4, 1, -wd);
    }
    if (!this.onGround) this.vy = approach(this.vy, maxFall, g);
    if (this.jumping && !this.jumpHeld && this.vy < PHYS.JUMP_CUT) { this.vy = PHYS.JUMP_CUT; this.jumping = false; }
    if (this.vy >= 0) this.jumping = false;

    // --- Jumping ---
    if (this.jumpBuf > 0) {
      if (this.coyote > 0) this.jump(this.vx + h * 0.3);
      else {
        const wj = this.wallDir(3);
        if (wj !== 0) this.wallJump(wj);
        else if (this.airJumps > 0) this.airJump(h);
      }
    }

    this.moveX(this.vx); this.moveY(this.vy);
    this.afterMove();
  }

  // Second jump in midair: a softer kick that leaves a ring of dust where Eli pushed off the air.
  airJump(h) {
    this.airJumps--;
    this.vy = PHYS.AIR_JUMP; this.jumping = true;
    if (h) this.vx = approach(this.vx, h * Math.max(PHYS.RUN, Math.abs(this.vx)), 0.6);
    this.jumpBuf = 0; this.squash = -5;
    Sound.play('djump');
    const fx = this.x + 3, fy = this.y + this.h;
    World.dust(fx, fy, 3, -1); World.dust(fx, fy, 3, 1); World.dust(fx, fy + 1, 2, 0);
    if (!Game.options.lowFx) World.burst(fx, fy, 6, Art.pal().dust, 0.7, 0.02);
    Achievements.addStat('airJumps', 1);
  }

  wallJump(wd) {
    this.jump(-wd * PHYS.WALL_JUMP_X);
    this.vy = PHYS.JUMP * 0.95;
    this.forceTime = 9; this.forceDir = -wd; this.facing = -wd; this.grabbing = false; this.noGrab = 6;
    Sound.play('walljump');
  }

  afterMove() {
    this.anim++;
    if (this.squash > 0) this.squash--; else if (this.squash < 0) this.squash++;
    for (const t of this.trail) t.life--;
    this.trail = this.trail.filter((t) => t.life > 0);
    if (this.flash > 0) this.flash--;
    this.updatePose();
    this.updateRibbon();
    if (this.sprintFlash > 0) this.sprintFlash--;
    this.sprintAlpha = approach(this.sprintAlpha, Input.held('sprint') || this.sprintLock ? 1 : 0, Input.held('sprint') || this.sprintLock ? 0.2 : 0.06);
    if (this.pose === 'run' && this.anim % (this.sprinting ? 8 : 12) === 0) { World.dust(this.x + 3, this.y + this.h, 1, -this.facing); Sound.play('step'); }
    this.checkEntities();
    if (!Game.options.assist && World.spikeHit(this)) Game.killPlayer();
    if (this.y > H + 4) {
      if (Game.options.assist) { this.y = -12; this.vy = 0; } else Game.killPlayer();
    }
  }

  updatePose() {
    const prev = this.pose;
    if (this.dashTime > 0) this.pose = 'dash';
    else if (this.grabbing) this.pose = 'climb';
    else if (!this.onGround && this.vy > 0 && this.wallDir() !== 0 && (Input.held('right') ? 1 : Input.held('left') ? -1 : 0) === this.wallDir()) this.pose = 'slide';
    else if (!this.onGround && !this.collide(0, 1)) this.pose = this.vy < 0 ? 'jump' : 'fall';
    else if (Math.abs(this.vx) > 0.3) this.pose = 'run';
    else this.pose = 'idle';
    if (this.pose !== prev && this.pose === 'run') this.anim = 0;
    // Any held input counts as "not idle", so pressing up to read a sign doesn't make Eli nod off.
    const still = this.pose === 'idle' && !Object.values(Input.down).some(Boolean);
    this.idleT = still ? this.idleT + 1 : 0;
    if (this.idleT === IDLE.DOZE) Achievements.unlock('doze');
    const zt = this.idleT - IDLE.DOZE;
    if (zt > 30 && zt % 80 === 0) this.zzz.push({ x: this.x + 3 + this.facing * 3, y: this.y + 2, t: 0, s: (zt / 80) % 2 ? 4 : 5 });
    for (const z of this.zzz) z.t++;
    this.zzz = this.zzz.filter((z) => z.t < 110 && this.idleT > 0);
  }

  // Long-idle sequence, by frames since IDLE.START: look around, stretch and yawn, sit and doze.
  idleFrame() {
    const t = this.idleT - IDLE.START;
    this.idleFlip = (t >= 30 && t < 80) || (t >= 110 && t < 140);
    if (t < 150) return (t % 50) > 44 ? 'blink' : 'idle0';
    if (t < 165 || (t >= 240 && t < 255)) return 'stretch0';
    if (t < 240) return 'stretch1';
    if (t < IDLE.DOZE - IDLE.START - 12) return 'blink';
    if (t < IDLE.DOZE - IDLE.START) return 'crouch';
    return Math.floor((t - (IDLE.DOZE - IDLE.START)) / 50) % 2 ? 'sit1' : 'sit0';
  }

  updateRibbon() {
    const f = this.facing;
    let px = this.x + 3 - f * 2, py = this.y + 4 + (this.idleT >= IDLE.DOZE - 12 ? 2 : 0);
    const wind = Math.sin(this.anim * 0.12) * 0.25;
    for (let i = 0; i < this.ribbon.length; i++) {
      const s = this.ribbon[i];
      // Each knot trails the one before it, with gravity and a little breeze.
      const tx = px - f * 1.3 - this.vx * 0.35, ty = py + 0.35 - this.vy * 0.2 + wind * (i / 3);
      s.x += (tx - s.x) * 0.55; s.y += (ty - s.y) * 0.55;
      px = s.x; py = s.y;
    }
  }

  checkEntities() {
    for (const d of World.crystals) {
      if (d.active && this.dashes < 1 && Game.save.hasDash && overlap(this.x, this.y, this.w, this.h, d.x - 5, d.y - 5, 10, 10)) {
        d.active = false; d.t = 0; this.refill(); this.freeze = 2;
        Sound.play('refill'); World.burst(d.x, d.y, 10, '#7ff6ff', 1.5, 0);
      }
    }
    for (const s of World.springs) {
      if (this.vy >= 0 && overlap(this.x, this.y, this.w, this.h, s.x, s.y + 3, 8, 5)) {
        this.vy = PHYS.SPRING; this.dashTime = 0; this.jumping = false; this.y = s.y - this.h + 2; this.ry = 0;
        this.refill(); s.t = 10; Sound.play('spring'); this.squash = -6;
      }
    }
    for (const f of World.fragments) {
      if (!Game.save.frags[f.id] && overlap(this.x, this.y, this.w, this.h, f.x - 5, f.y - 6, 10, 12)) Game.collectFragment(f);
    }
  }

  // Animation frame for the current pose.
  frame() {
    switch (this.pose) {
      case 'run': return 'run' + (Math.floor(this.anim / (this.sprinting ? 3 : 5)) % 4);
      case 'jump': return 'jump';
      case 'fall': return 'fall';
      case 'dash': return 'dash';
      case 'slide': return 'slide';
      case 'climb': return Input.held('up') || Input.held('down') ? 'climb' + (Math.floor(this.anim / 8) % 2) : 'climb0';
      default: {
        const blink = (this.anim % 190) > 182;
        this.idleFlip = false;
        if (this.idleT >= IDLE.START) return this.idleFrame();
        if (this.idleT > 420) return 'sleepy';
        return blink ? 'blink' : 'idle' + (Math.floor(this.anim / 40) % 2);
      }
    }
  }

  draw(g) {
    const hasDash = Game.save.hasDash, ready = this.dashes > 0 && hasDash;
    for (const t of this.trail) {
      g.globalAlpha = t.life / 20;
      Sprites.draw(g, 'eli_ghost', 'dash', Math.round(t.x) + 3, Math.round(t.y) + 10, t.f < 0);
    }
    g.globalAlpha = 1;
    // Ribbon behind the body.
    if (hasDash) {
      const col = this.flash > 0 ? '#ffffff' : ready ? '#ff4d6d' : '#6a5878';
      const hi = this.flash > 0 ? '#ffffff' : ready ? '#ffb0bc' : '#8a7a98';
      const n = this.ribbon.length;
      for (let i = n - 1; i >= 0; i--) {
        const s = this.ribbon[i], x = Math.round(s.x), y = Math.round(s.y);
        g.fillStyle = i === n - 1 ? col : i % 2 ? col : hi;
        g.fillRect(x, y, i < 2 ? 2 : 1, i < 2 ? 2 : 1);
        if (i === n - 1) g.fillRect(x, y + 1, 1, 1);
      }
    }
    const sq = this.squash;
    const sw = sq > 0 ? 1.18 : sq < 0 ? 0.86 : 1, sh = sq > 0 ? 0.84 : sq < 0 ? 1.16 : 1;
    const tired = this.stamina < 25 && this.anim % 10 < 5;
    const name = tired ? 'eli_tired' : 'eli';
    const fr = this.frame(), flip = (this.facing < 0) !== !!this.idleFlip;
    Sprites.draw(g, name, fr, Math.round(this.x + 3), Math.round(this.y + 10), flip, sw, sh);
    if (this.flash > 0 && !Game.options.lowFx) {
      g.globalAlpha = this.flash / 10;
      Sprites.draw(g, 'eli_white', fr, Math.round(this.x + 3), Math.round(this.y + 10), flip, sw, sh);
      g.globalAlpha = 1;
    }
    this.drawZzz(g);
    this.drawSprintBar(g);
  }

  // Small bar over Eli's head. Shown only while sprint is held or the bar is locked and refilling.
  // Little pixel z's drifting up and away while Eli dozes.
  drawZzz(g) {
    for (const z of this.zzz) {
      const k = z.t / 110, x = Math.round(z.x + this.facing * (k * 8 + Math.sin(z.t * 0.08) * 1.5)), y = Math.round(z.y - k * 14), n = z.s;
      g.globalAlpha = Math.min(1, z.t / 12, (110 - z.t) / 30) * 0.85;
      g.fillStyle = '#c9d4ff';
      g.fillRect(x, y, n, 1); g.fillRect(x, y + n - 1, n, 1);
      for (let i = 1; i < n - 1; i++) g.fillRect(x + n - 1 - i, y + i, 1, 1);
    }
    g.globalAlpha = 1;
  }

  drawSprintBar(g) {
    if (this.sprintAlpha <= 0 || Game.options.assist) return;
    const bw = 14, x = Math.round(this.x + 3 - bw / 2), y = Math.round(this.y) - 6;
    const fill = Math.round(bw * this.sprint);
    const low = this.sprint < 0.25 && this.anim % 10 < 5;
    g.globalAlpha = this.sprintAlpha;
    g.fillStyle = '#14101e'; g.fillRect(x - 1, y - 1, bw + 2, 4);
    g.fillStyle = '#3a3150'; g.fillRect(x, y, bw, 2);
    g.fillStyle = this.sprintFlash > 0 ? '#ffffff' : this.sprintLock ? '#8a5a6a' : low ? '#ff7a7a' : '#ffd76a';
    g.fillRect(x, y, fill, 2);
    if (!this.sprintLock && fill > 0) { g.fillStyle = '#fff4c8'; g.fillRect(x, y, fill, 1); }
    g.globalAlpha = 1;
  }
}
