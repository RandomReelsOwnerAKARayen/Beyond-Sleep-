'use strict';
// Game controller: state machine, saving, room flow, interaction, endings and the fixed-timestep loop.
const SAVE_KEY = 'bs_save2';

const Game = {
  state: 'title', frame: 0, save: null, player: null, menu: null, nearTalk: null,
  options: (() => {
    const o = Object.assign({}, OPTION_DEFAULTS, Store.get('bs_opts', {}));
    if (typeof o.shake === 'boolean') o.shake = o.shake ? 1 : 0; // saved before shake had levels
    return o;
  })(),
  shakeAmt: 0, deathTimer: 0, deathFx: null, fadeIn: 0, wipe: null, fade: null, endSel: 0, endT: 0,
  flickerAt: 0, flickerFx: null,

  init() {
    this.view = document.getElementById('screen');
    this.vctx = this.view.getContext('2d');
    this.game = makeCanvas(W, H);
    this.gctx = this.game.getContext('2d');
    Input.init();
    Art.init();
    Music.init();
    addEventListener('resize', () => this.resize());
    this.resize();
    World.load(0);
    Art.buildRoom();
    this.toTitle();
    let last = performance.now(), acc = 0;
    const step = 1000 / 60;
    const loop = (now) => {
      acc += Math.min(now - last, 100); last = now;
      // Game Speed slows play itself; menus and conversations keep their pace.
      const dt = step / (this.state === 'play' && !Dialog.active ? this.options.speed : 1);
      while (acc >= dt) { this.update(); acc -= dt; }
      this.render();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  },

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.dpr = dpr;
    this.view.width = Math.floor(innerWidth * dpr);
    this.view.height = Math.floor(innerHeight * dpr);
    const s = Math.min(this.view.width / W, this.view.height / H);
    this.scale = s >= 1 && this.options.scale !== 'fit' ? Math.floor(s) : s;
    this.ox = Math.floor((this.view.width - W * this.scale) / 2);
    this.oy = Math.floor((this.view.height - H * this.scale) / 2);
  },

  saveOptions() { Store.set('bs_opts', this.options); },
  persist() { if (this.save) Store.set(SAVE_KEY, this.save); },
  fragCount() { return this.save ? Object.keys(this.save.frags).length : 0; },
  shake(n) { this.shakeAmt = Math.max(this.shakeAmt, n * this.options.shake); },
  roomIndex(id) { return ROOMS.findIndex((r) => r.id === id); },

  newSave() {
    return { room: 0, frags: {}, flags: {}, echoes: {}, looked: {}, bond: 0, hasDash: false, deaths: 0, chDeaths: 0, time: 0, herName: '???', done: false };
  },

  // ---------- Menus ----------
  toTitle() {
    this.state = 'title';
    this.save = null;
    Music.set(0);
    Music.muffle(false);
    const existing = Store.get(SAVE_KEY, null);
    const canContinue = existing && !existing.done && ROOMS[existing.room];
    const items = [
      { label: 'Continue', disabled: !canContinue, action: () => this.fadeTo(() => this.continueGame()) },
      { label: 'New Game', action: () => this.fadeTo(() => this.newGame()) },
      { label: () => `Achievements  ${Achievements.count()}/${ACHIEVEMENTS.length}`, action: () => this.fadeTo(() => this.openAchievements('title')) },
      { label: () => `Endings  ${ENDING_GALLERY.filter((e) => Achievements.has(e.end.ach)).length}/${ENDING_GALLERY.length}`, action: () => this.fadeTo(() => this.openEndings()) },
      { label: 'Options', action: () => this.fadeTo(() => this.openOptions('title')) },
      { label: 'Exit', action: () => this.fadeTo(() => this.exitGame()) },
    ];
    // The credits only show up in the menu once you've seen an ending (secret ones count).
    if (ENDING_GALLERY.some((e) => Achievements.has(e.end.ach)))
      items.splice(5, 0, { label: 'Credits', action: () => this.fadeTo(() => this.rollCredits(() => this.toTitle())) });
    // Wednesdays only (by the player's own clock), something else is in the menu.
    if (new Date().getDay() === 3) items.splice(5, 0, { label: '???', action: () => this.fadeTo(() => this.showQuote()) });
    this.menu = new Menu(null, items, { gap: items.length > 7 ? 11 : 12, align: 'left', intro: 14 });
    // The full entrance plays once per launch; coming back from a submenu is quicker.
    this.titleT = this.titleSeen ? 200 : 0;
    this.menu.t = this.titleSeen ? 100 : -70;
    this.titleSeen = true;
    this.titleLift = this.titleLift || [];
    TitleScene.clockTouches = 0;
    // Where the save left off, shown under the subtitle while Continue is highlighted.
    if (canContinue) {
      const cap = CHAPTERS[ROOMS[existing.room].ch];
      this.continueHint = { text: `${cap.suit} ${ROOMS[existing.room].name}`, color: cap.color };
    } else this.continueHint = null;
  },

  // Browsers only let a script close a tab it opened itself; otherwise fall back to a blank page.
  exitGame() {
    window.close();
    setTimeout(() => { if (!window.closed) location.replace('about:blank'); }, 100);
  },

  showQuote() {
    let i;
    do i = (Math.random() * QUOTES.length) | 0; while (QUOTES.length > 1 && i === this.lastQuote);
    this.lastQuote = i;
    Achievements.unlock('wednesday');
    const [text, play] = QUOTES[i];
    this.state = 'slides';
    Slides.show([`${text}\n\n— ${play}`], () => this.fadeTo(() => this.toTitle(), 30), { color: '#e8dcc0' });
  },

  openEndings() {
    this.state = 'endings';
    this.endT = 0;
    Music.set(0);
  },

  // Replays an ending's slides from the gallery, then returns to it.
  reliveEnding(end) {
    Music.set(5);
    Music.restart();
    this.state = 'slides';
    Slides.show(end.slides, () => this.fadeTo(() => this.openEndings(), 30));
  },

  openAchievements(from) {
    this.state = 'achievements';
    AchScreen.open(from);
  },

  openOptions(from) {
    this.state = 'options';
    OptionsScreen.open(from);
  },

  openPause() {
    this.state = 'pause';
    this.menu = new Menu('PAUSED', [
      { label: 'Resume', action: () => { this.state = 'play'; } },
      { label: 'Retry Room', action: () => { this.state = 'play'; this.respawn(); } },
      { label: 'Options', action: () => this.openOptions('pause') },
      { label: () => `Achievements  ${Achievements.count()}/${ACHIEVEMENTS.length}`, action: () => this.openAchievements('pause') },
      { label: 'Save & Quit', action: () => { this.persist(); this.fadeTo(() => this.toTitle()); } },
    ], { onBack: () => { this.state = 'play'; } });
  },

  rollCredits(then) {
    this.state = 'credits';
    this.creditsThen = then;
    Credits.start(this.save || Store.get(SAVE_KEY, null));
    Music.set(5);
  },

  // Fade to black, swap state while the screen is dark, fade back in.
  // Asked again while still fading back in, it turns around from the current darkness.
  fadeTo(then, len = 20) {
    const f = this.fade;
    if (f && f.t < f.len) return;
    const dark = f ? 2 - f.t / f.len : 0;
    this.fade = { t: Math.round(dark * len), len, then };
  },

  // ---------- Game flow ----------
  newGame() {
    this.save = this.newSave();
    this.persist();
    Achievements.unlock('start');
    Music.muffle(true);
    this.state = 'slides';
    Slides.show(PROLOGUE, () => this.chapterCard(1, () => this.enterRoom(0)));
  },

  continueGame() {
    this.save = Object.assign(this.newSave(), Store.get(SAVE_KEY, {}));
    Music.muffle(true);
    this.enterRoom(this.save.room);
  },

  chapterCard(ch, then) {
    const c = CHAPTERS[ch];
    this.state = 'slides';
    Slides.show([`CHAPTER ${ch === 5 ? 'V' : ['', 'I', 'II', 'III', 'IV'][ch]}  ${c.suit}\n${c.title.toUpperCase()}`], then, { color: c.color, big: true, sub: c.sub });
  },

  enterRoom(i) {
    this.save.room = i;
    this.persist();
    World.load(i);
    Art.buildRoom();
    Input.latch = {};
    const id = World.room.id;
    for (const n of World.npcs) n.done = n.kind === 'cameo' || !!this.save.flags[`${id}_${n.kind}`];
    this.player = new Player(World.spawn.x, World.spawn.y);
    if (!this.save.hasDash) this.player.dashes = 0;
    this.state = 'play';
    this.fadeIn = 24;
    this.deathFx = null;
    Music.set(World.chapter === 5 ? 6 : World.chapter);
    HUD.showRoom(World.room.name);
    if (id === '4-5') Achievements.unlock('hollow');
    const st = STORY[id];
    if (st && st.enter && !this.save.flags[`${id}_enter`]) {
      Dialog.start(st.enter, () => { this.save.flags[`${id}_enter`] = true; this.persist(); });
    }
  },

  nextRoom() {
    const cur = World.room, ni = World.index + 1;
    if (ni >= ROOMS.length || ROOMS[ni].ch === 5) return;
    this.wipeTo(() => {
      if (ROOMS[ni].ch !== cur.ch) this.clearChapter(cur.ch, () => this.chapterCard(ROOMS[ni].ch, () => this.enterRoom(ni)));
      else this.enterRoom(ni);
    });
  },

  wipeTo(then) { if (!this.wipe) this.wipe = { t: 0, then }; },

  clearChapter(ch, then) {
    Achievements.unlock('ch' + ch);
    this.checkLucid();
    this.persist();
    Sound.play('gate');
    const c = CHAPTERS[ch];
    const names = ['', 'CLUBS', 'SPADES', 'DIAMONDS', 'HEARTS'];
    this.state = 'slides';
    Slides.show([`${c.suit}  GATE OF ${names[ch]}  ${c.suit}\nOPEN`], then, { color: c.color, big: true });
  },

  // A chapter cleared without dying. All four in one dream is its own achievement.
  checkLucid() {
    const s = this.save;
    if (s.chDeaths === 0) {
      Achievements.unlock('lucid');
      s.lucidChs = (s.lucidChs || 0) + 1;
      if (s.lucidChs >= 4) Achievements.unlock('lucid4');
    }
    s.chDeaths = 0;
  },

  giveDash() {
    this.save.hasDash = true;
    if (this.player) { this.player.dashes = 1; this.player.flash = 12; }
    Achievements.unlock('dash');
    Sound.play('refill');
    World.burst(this.player.x + 3, this.player.y + 5, 26, '#ff4d6d', 2, 0);
  },

  collectFragment(f) {
    this.save.frags[f.id] = true;
    this.persist();
    Sound.play('fragment');
    World.burst(f.x, f.y, 28, '#ff8ac6', 2, 0);
    HUD.showMemory(MEMORIES[f.id]);
    Achievements.unlock('frag1');
    const ch = f.id[0];
    Achievements.best('frags' + ch, Object.keys(this.save.frags).filter((id) => id[0] === ch).length);
    Achievements.best('frags', this.fragCount());
  },

  applyChoice([k, val]) {
    const s = this.save;
    if (k === 'echo') { s.echoes[World.room.echo] = val; if (val === true) Achievements.unlock('echo1'); }
    else if (k === 'bond') { s.bond = (s.bond || 0) + val; Achievements.best('bond', s.bond); }
    else s.flags[k] = val;
    this.persist();
  },

  // Story NPCs speak on their own the first time you reach them; after that, and for
  // cameos and objects, press up.
  findInteract(p) {
    let best = null, bd = 1e9;
    for (const n of World.npcs) {
      if (World.chapter === 5 && n.kind === 'cameo' && this.save.echoes[n.who] !== true) continue;
      const dx = Math.abs(p.x + 3 - n.x), dy = Math.abs(p.y + 10 - n.y);
      if (dx < 18 && dy < 16 && dx < bd) { best = n; bd = dx; }
    }
    for (const l of World.looks) {
      const dx = Math.abs(p.x + 3 - l.x), dy = Math.abs(p.y + 10 - l.y);
      if (dx < 14 && dy < 26 && dx < bd) { best = l; bd = dx; }
    }
    return best;
  },

  linesFor(n) {
    const id = World.room.id, st = STORY[id] || {};
    if (n.key) return st.look && st.look[n.key];
    if (n.kind === 'cameo') { const c = st.cameo && st.cameo[n.who]; return c && c[this.save.echoes[n.who] === true ? 'true' : 'false']; }
    if (!n.done) return st[n.kind];
    if (n.kind === 'echo') { const a = st.echoAgain; return a && a[this.save.echoes[n.who] === true ? 'true' : 'false']; }
    return st[n.kind + 'Again'];
  },

  interact(n) {
    const lines = this.linesFor(n);
    if (!lines) return;
    const id = World.room.id;
    this.player.vx = 0; this.player.dashTime = 0;
    if (n.key) {
      Sound.play('look');
      if (!this.save.looked[id + n.key]) { this.save.looked[id + n.key] = true; Achievements.best('looked', Object.keys(this.save.looked).length); }
    }
    const first = !n.key && !n.done;
    Dialog.start(lines, () => {
      if (first) { n.done = true; this.save.flags[`${id}_${n.kind}`] = true; }
      this.persist();
      if (first && n.kind === 'her' && this.save.flags.final) this.ending();
      if (first && n.kind === 'mom') this.epilogueEnd();
    });
  },

  killPlayer() {
    const p = this.player;
    if (p.dead) return;
    p.dead = true;
    this.save.deaths++; this.save.chDeaths++;
    Achievements.addStat('deaths', 1);
    Sound.play('death'); this.shake(6);
    World.burst(p.x + 3, p.y + 5, 16, '#ff4d6d', 2.2, 0);
    this.deathFx = { x: p.x + 3, y: p.y + 5, t: 0, out: true };
    this.deathTimer = 36;
  },

  respawn() {
    World.reset();
    Input.latch = {};
    const hadDash = this.save.hasDash;
    this.player = new Player(World.spawn.x, World.spawn.y);
    if (!hadDash) this.player.dashes = 0;
    this.deathFx = { x: World.spawn.x + 3, y: World.spawn.y + 5, t: 0, out: false };
  },

  ending() {
    const s = this.save, e = s.echoes, who = ['walt', 'juno', 'hester', 'pip'];
    const helped = who.filter((k) => e[k] === true).length;
    const ignored = who.filter((k) => e[k] === false).length;
    Achievements.best('helped', helped);
    if (ignored === 4) Achievements.unlock('cold');
    Achievements.unlock('ch4');
    this.checkLucid();
    let key;
    if (s.flags.final === 'stay') key = 'stay';
    else if (this.fragCount() >= TOTAL_FRAGMENTS && helped === 4) key = 'true';
    else if (this.fragCount() >= TOTAL_FRAGMENTS / 2) key = 'remember';
    else key = 'hollow';
    s.ending = key;
    this.persist();
    const end = ENDINGS[key];
    Music.set(5);
    Music.restart();
    this.state = 'slides';
    Slides.show(end.slides, () => {
      Achievements.unlock(end.ach);
      if (end.epilogue) this.chapterCard(5, () => this.enterRoom(this.roomIndex('5-1')));
      else this.finish();
    });
  },

  // Secret ending: press 6 then 7 during play. Leaves the save untouched.
  sussyEnding() {
    const end = SECRET_ENDING;
    Music.set(5);
    Music.restart();
    this.state = 'slides';
    Slides.show(end.slides, () => {
      Achievements.unlock(end.ach);
      Slides.show([`${end.title}\n\nYou weren't supposed to find this.`, 'Some things are still waiting for you\nin The Between.\n\n(Your save is fine.)'],
        () => this.rollCredits(() => this.toTitle()), { color: '#ffe9a8', big: true });
    });
  },

  // Secret ending: touch the clock on the title screen six times. There's no save to touch.
  tiktokEnding() {
    const end = TIKTOK_ENDING;
    Music.set(5);
    Music.restart();
    this.state = 'slides';
    Slides.show(end.slides, () => {
      Achievements.unlock(end.ach);
      Slides.show([`${end.title}\n\n${end.handle}`, `${end.handle}\n\nmade this game.\nfollow for more.\ngo to bed.`],
        () => this.rollCredits(() => this.toTitle()), { color: '#ffe9a8', big: true });
    });
  },

  epilogueEnd() {
    Achievements.unlock('morning');
    this.wipeTo(() => {
      this.state = 'slides';
      Slides.show(EPILOGUE_END, () => this.finish(), { color: '#ffe9a8' });
    });
  },

  finish() {
    const s = this.save, end = ENDINGS[s.ending];
    if (s.time < 25 * 60 * 60) Achievements.unlock('speed');
    if (s.deaths < 25) Achievements.unlock('sweet');
    s.done = true;
    this.persist();
    const helped = ['walt', 'juno', 'hester', 'pip'].filter((k) => s.echoes[k] === true).length;
    const secs = Math.floor(s.time / 60);
    const time = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
    this.state = 'slides';
    Slides.show([
      `${end.title}\n\nTime  ${time}\nDeaths  ${s.deaths}\nMemories  ${this.fragCount()}/${TOTAL_FRAGMENTS}\nEchoes helped  ${helped}/4`,
      s.ending === 'true' ? '"Good morning, Eli."' : 'Some things are still waiting for you\nin The Between.',
    ], () => this.rollCredits(() => this.toTitle()), { color: '#ffe9a8', big: true });
  },

  // ---------- Update ----------
  update() {
    this.frame++;
    Input.update();
    // Mouse into game pixels. Outside of play the cursor is free (and drawn by TitleScene).
    const m = Input.mouse;
    m.x = (m.cx * this.dpr - this.ox) / this.scale; m.y = (m.cy * this.dpr - this.oy) / this.scale;
    if (this.state !== 'play') {
      if (document.pointerLockElement) document.exitPointerLock();
      TitleScene.tickCursor();
    } else m.active = false;
    Music.update();
    Achievements.update();
    if (this.flickerFx && ++this.flickerFx.t > this.flickerFx.end) this.flickerFx = null;
    if (Input.pressed('mute')) Sound.toggle();
    if (this.shakeAmt > 0) this.shakeAmt *= 0.85;
    if (this.shakeAmt < 0.3) this.shakeAmt = 0;
    if (this.wipe) {
      this.wipe.t++;
      if (this.wipe.t === 18) { const w = this.wipe; this.wipe = { t: 18, then: null, back: true }; w.then(); }
      if (this.wipe.back && this.wipe.t > 36) this.wipe = null;
      if (this.wipe && !this.wipe.back) return;
    }
    if (this.fade) {
      const f = this.fade;
      f.t++;
      if (f.t === f.len) { f.then(); Input.flush(); }
      if (f.t >= f.len * 2) this.fade = null;
      if (f.t <= f.len) return;
    }

    if (this.state !== 'play') Input.takeSecret(); // 6-7 only counts during play
    switch (this.state) {
      case 'options':
        World.update(null);
        if (!this.save) TitleScene.update(OptionsScreen);
        OptionsScreen.update();
        break;
      case 'title': case 'pause':
        if (this.state !== 'title') World.update(null);
        if (this.state === 'title') {
          this.titleT++;
          // Any key or click skips the entrance.
          if (this.titleT < 120 && (Input.mouse.click || ['confirm', 'up', 'down', 'back'].some((a) => Input.pressed(a)))) { this.titleT = 200; this.menu.t = 100; Input.flush(); Input.mouse.click = false; }
        }
        this.menu.update();
        if (!this.save) TitleScene.update(this.menu);
        break;
      case 'achievements':
        if (!this.save) TitleScene.update(null);
        else World.update(null);
        AchScreen.update();
        break;
      case 'endings': {
        TitleScene.update(null);
        this.endT++;
        const n = ENDING_GALLERY.length, d = (Input.pressed('right') ? 1 : 0) - (Input.pressed('left') ? 1 : 0);
        if (d) { this.endSel = (this.endSel + d + n) % n; this.endT = 0; Sound.play('select'); }
        const e = ENDING_GALLERY[this.endSel];
        if (Input.pressed('back')) { Input.flush(); this.fadeTo(() => this.toTitle()); }
        else if (Input.pressed('confirm') && Achievements.has(e.end.ach)) { Sound.play('confirm'); Input.flush(); this.fadeTo(() => this.reliveEnding(e.end), 30); }
        break;
      }
      case 'credits':
        if (Credits.update()) { Input.flush(); this.fadeTo(this.creditsThen, 60); }
        break;
      case 'slides':
        Slides.update();
        break;
      case 'play':
        this.updatePlay();
        break;
    }
  },

  updatePlay() {
    if (this.fadeIn > 0) this.fadeIn--;
    HUD.update();
    if (this.deathFx && ++this.deathFx.t > 24) this.deathFx = null;
    if (Dialog.active) { Dialog.update(); World.update(this.player); return; }
    if (Input.pressed('pause')) { this.openPause(); return; }
    if (Input.takeSecret()) { this.sussyEnding(); return; }
    this.save.time++;
    // Past midnight on the player's own clock.
    if (this.frame % 600 === 0 && new Date().getHours() < 4) Achievements.unlock('night');
    const p = this.player;
    if (World.chapter === 4 && this.frame % 66 === 0) Sound.play('heartbeat');
    this.updateFlicker();
    if (p.dead) {
      World.update(null);
      if (--this.deathTimer <= 0) this.respawn();
      return;
    }
    if (this.deathFx && !this.deathFx.out) { World.update(p); return; }
    p.update();
    World.update(p);
    if (this.state !== 'play' || Dialog.active || p.dead) return;
    if (World.hollow) {
      World.hollow.record(p);
      if (!this.options.assist && World.hollow.hits(p)) { this.killPlayer(); return; }
    }
    // Interaction.
    this.nearTalk = null;
    const n = this.findInteract(p);
    if (n) {
      const auto = !n.key && n.kind !== 'cameo' && !n.done;
      if (auto) { this.interact(n); return; }
      if (p.onGround && this.linesFor(n)) {
        this.nearTalk = n;
        if (Input.pressed('interact')) { this.interact(n); return; }
      }
    }
    const exit = World.room.exit;
    if ((exit === 'right' && p.x >= W - 3) || (exit === 'top' && p.y + p.h < 2)) this.nextRoom();
  },

  // Now and then a light somewhere in the dream twitches: a stuttering fluorescent buzz,
  // with the screen dipping and catching in time with it.
  updateFlicker() {
    if (World.chapter === 5) return;
    if (!this.flickerAt) this.flickerAt = this.frame + ((rand(25, 70) * 60) | 0);
    if (this.frame < this.flickerAt) return;
    this.flickerAt = 0;
    const segs = Sound.flicker().map(([s, l]) => [Math.round(s * 60), Math.max(1, Math.round(l * 60))]);
    if (segs.length) { const [s, l] = segs[segs.length - 1]; this.flickerFx = { t: 0, segs, end: s + l }; }
  },

  drawFlicker(g) {
    const f = this.flickerFx;
    if (!f || this.options.lowFx || this.options.calm) return;
    const lit = f.segs.some(([s, l]) => f.t >= s && f.t < s + l);
    g.fillStyle = lit ? 'rgba(220,235,255,0.05)' : 'rgba(0,0,4,0.22)';
    g.fillRect(0, 0, W, H);
  },

  // ---------- Render ----------
  render() {
    const g = this.gctx, v = this.vctx, s = this.scale;
    const playing = this.save && this.player && (this.state === 'play' || this.state === 'pause' || this.state === 'options' || this.state === 'achievements');
    if (playing) {
      const p = this.player;
      Art.drawBackground(g, p.dead ? null : p);
      Art.drawWorld(g);
      Art.drawEntities(g, this.save);
      if (!p.dead && !(this.deathFx && !this.deathFx.out)) p.draw(g);
      this.drawDeathFx(g);
      Art.drawForeground(g);
      Art.drawLighting(g, p);
      Art.drawPost(g);
    } else if (this.state === 'title' || this.state === 'options' || this.state === 'achievements' || this.state === 'endings') {
      TitleScene.draw(g);
    }
    v.setTransform(1, 0, 0, 1, 0, 0);
    v.fillStyle = '#000'; v.fillRect(0, 0, this.view.width, this.view.height);
    v.imageSmoothingEnabled = false;
    const sx = this.shakeAmt ? Math.round(rand(-1, 1) * this.shakeAmt) : 0;
    const sy = this.shakeAmt ? Math.round(rand(-1, 1) * this.shakeAmt) : 0;
    v.drawImage(this.game, this.ox + sx * s, this.oy + sy * s, W * s, H * s);
    // Chapter 4: the world glitches as Eli wakes up.
    if (playing && World.chapter === 4 && !this.options.lowFx && !this.options.calm && Math.random() < 0.035) {
      const yy = (Math.random() * H) | 0, hh = 2 + ((Math.random() * 8) | 0), dx = ((Math.random() * 12) | 0) - 6;
      v.drawImage(this.game, 0, yy, W, hh, this.ox + dx * s, this.oy + yy * s, W * s, hh * s);
    }
    v.setTransform(s, 0, 0, s, this.ox, this.oy);
    v.textBaseline = 'alphabetic';
    if (playing) {
      if (this.state === 'play') this.drawFlicker(v);
      HUD.draw(v, this.player);
      if (this.fadeIn > 0) { v.fillStyle = `rgba(5,6,12,${this.fadeIn / 24})`; v.fillRect(0, 0, W, H); }
      if (Dialog.active) Dialog.draw(v);
    }
    if (this.state === 'title') this.drawTitle(v);
    else if (this.state === 'pause') {
      v.fillStyle = 'rgba(5,6,12,0.78)'; v.fillRect(0, 0, W, H);
      this.menu.draw(v, 56);
    } else if (this.state === 'options') OptionsScreen.draw(v); else if (this.state === 'achievements') AchScreen.draw(v);
    else if (this.state === 'endings') drawEndingGallery(v, this.endSel, this.endT);
    else if (this.state === 'slides') Slides.draw(v);
    else if (this.state === 'credits') Credits.draw(v);
    if (this.wipe) {
      const k = this.wipe.back ? 1 - (this.wipe.t - 18) / 18 : this.wipe.t / 18;
      v.fillStyle = '#05060c';
      // Diagonal wipe made of falling bars.
      for (let i = 0; i < 16; i++) { const h = clamp(k * 1.6 - i / 26, 0, 1) * H; v.fillRect(i * 20, this.wipe.back ? H - h : 0, 20, h); }
    }
    if (this.fade) {
      const f = this.fade, k = f.t <= f.len ? f.t / f.len : 2 - f.t / f.len;
      v.fillStyle = `rgba(5,6,12,${clamp(k * k * (3 - 2 * k), 0, 1)})`;
      v.fillRect(0, 0, W, H);
    }
    drawToasts(v);
    if (this.state !== 'play') TitleScene.drawCursor(v);
    v.setTransform(1, 0, 0, 1, 0, 0);
  },

  drawDeathFx(g) {
    const d = this.deathFx;
    if (!d) return;
    const k = d.out ? d.t / 24 : 1 - d.t / 24;
    const r = 4 + k * 26;
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4 + k * 2;
      const x = d.x + Math.cos(a) * r, y = d.y + Math.sin(a) * r, s = d.out ? 4 * (1 - k) + 1 : 2 + 3 * (1 - k);
      g.fillStyle = i % 2 ? '#ff4d6d' : '#ffffff';
      g.globalAlpha = d.out ? 1 - k * 0.6 : 0.6 + 0.4 * (1 - k);
      g.beginPath(); g.arc(x, y, s, 0, 7); g.fill();
    }
    g.globalAlpha = 1;
  },

  drawTitle(g) {
    const t = this.titleT, m = Input.mouse, look = TitleScene.look;
    // Darken the left side so the menu reads over the room.
    const shade = g.createLinearGradient(0, 0, 150, 0);
    shade.addColorStop(0, 'rgba(3,4,10,0.72)'); shade.addColorStop(0.7, 'rgba(3,4,10,0.35)'); shade.addColorStop(1, 'rgba(3,4,10,0)');
    g.fillStyle = shade; g.fillRect(0, 60, 150, H - 60);
    const top = g.createLinearGradient(0, 0, 0, 62);
    top.addColorStop(0, 'rgba(3,4,10,0.6)'); top.addColorStop(1, 'rgba(3,4,10,0)');
    g.fillStyle = top; g.fillRect(0, 0, W, 62);

    // Title, letter by letter: they drop in, float, lean toward the cursor, and split
    // into red and blue ghosts as the view tilts.
    const text = 'BEYOND SLEEP';
    setFont(g, 16, true);
    const cw = g.measureText(text).width / text.length, x0 = W / 2 - (cw * text.length) / 2;
    const shine = ((this.frame * 1.4) % 520) - 100;
    g.globalCompositeOperation = 'lighter';
    Art.glow(g, W / 2, 28, 70, '#5a3a80', clamp((t - 20) / 60, 0, 1) * 0.35);
    g.globalCompositeOperation = 'source-over';
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === ' ') continue;
      const p = clamp((t - 8 - i * 3) / 26, 0, 1), e = 1 - (1 - p) ** 3;
      if (p <= 0) continue;
      const lx = x0 + i * cw, near = m.active ? Math.max(0, 1 - Math.hypot(m.x - (lx + cw / 2), m.y - 27) / 34) : 0;
      this.titleLift[i] = (this.titleLift[i] || 0) + (near * 4 - (this.titleLift[i] || 0)) * 0.2;
      const y = Math.round(36 + Math.sin(this.frame * 0.04 + i * 0.45) * 1.5 - (1 - e) * 16 - this.titleLift[i]);
      const cx = Math.round(look.x * 1.5), cy = Math.round(look.y);
      g.globalAlpha = e;
      g.fillStyle = 'rgba(0,0,0,0.7)'; g.fillText(ch, lx + 1, y + 2);
      g.globalAlpha = e * 0.5; g.fillStyle = '#ff4d6d'; g.fillText(ch, lx + 1 + cx, y + cy);
      g.globalAlpha = e * 0.4; g.fillStyle = '#5a8cff'; g.fillText(ch, lx - 1 - cx, y - cy);
      g.globalAlpha = e;
      const lit = Math.max(0, 1 - Math.abs(lx - shine) / 18) + near * 0.6;
      g.fillStyle = lit > 0.05 ? rgb(mixc(hex('#dfe4ff'), hex('#ffffff'), Math.min(1, lit))) : '#dfe4ff'; g.fillText(ch, lx, y);
      if (lit > 0.3) { g.globalCompositeOperation = 'lighter'; Art.glow(g, lx + cw / 2, y - 7, 10, '#ff8ac6', (lit - 0.3) * 0.4); g.globalCompositeOperation = 'source-over'; }
    }
    g.globalAlpha = 1;
    // The subtitle types itself out.
    const sub = 'a story about waking up', n = clamp(Math.floor((t - 50) / 2), 0, sub.length);
    setFont(g, 11);
    if (n > 0) {
      textC(g, sub.slice(0, n), W / 2, 50, '#9fb4ff');
      if (n < sub.length && (this.frame >> 3) % 2) { g.fillStyle = '#9fb4ff'; g.fillRect(Math.round(W / 2 + g.measureText(sub.slice(0, n)).width / 2 + 1), 44, 3, 6); }
    }
    const mn = this.menu, ready = t > 70;
    if (this.continueHint && mn.sel === 0 && ready) { setFont(g, 9); textC(g, this.continueHint.text, W / 2, 60, this.continueHint.color, false); }
    if (!ready) return;
    mn.draw(g, 80, 26);
    const fa = clamp((t - 90) / 40, 0, 1);
    g.globalAlpha = fa;
    setFont(g, 9); g.textAlign = 'left';
    g.fillStyle = '#c8cce0'; g.fillText(`a game by ${CREDITS.by}`, 16, H - 15);
    g.fillStyle = '#8a90b0'; g.fillText(`music: ${Music.credit()}`, 16, H - 6);
    g.globalAlpha = 1;
  },
};

window.addEventListener('load', () => Game.init());
