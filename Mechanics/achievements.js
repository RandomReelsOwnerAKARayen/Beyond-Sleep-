'use strict';
// Achievements persist across save files. Hidden ones show "???" (and a hint) until unlocked.
// Fields: cat (tab), tier (bronze | silver | gold | platinum), icon (ACH_ICONS key in sprites.js),
// note (Eli's journal line, shown once it's unlocked), stat + goal (unlocks itself when the
// lifetime stat reaches the goal, and shows a progress bar until then), hint (for hidden ones).

// Memory fragments per chapter, and how many things there are to look at, read from the story data.
const FRAGS_IN = (ch) => Object.keys(MEMORIES).filter((id) => id[0] === String(ch)).length;
const LOOK_TOTAL = ROOMS.reduce((n, r) => n + (r.look ? r.look.length : 0), 0);
// The five things in Eli's hospital room on the title screen that answer a touch.
const ROOM_THINGS = ['window', 'ribbon', 'eli', 'monitor', 'clock'];

const ACH_TABS = [
  { id: 'all', name: 'ALL', color: '#ffe9a8' },
  { id: 'story', name: 'STORY', color: '#7fd1a8' },
  { id: 'memory', name: 'MEMORY', color: '#ff8ac6' },
  { id: 'heart', name: 'HEART', color: '#ff6b7f' },
  { id: 'skill', name: 'SKILL', color: '#9fb4ff' },
  { id: 'ending', name: 'ENDINGS', color: '#ffcf6b' },
  { id: 'secret', name: 'SECRETS', color: '#c8a8e8' },
];

const ACH_TIERS = {
  bronze: { name: 'BRONZE', color: '#e0a070', dark: '#5a3a24' },
  silver: { name: 'SILVER', color: '#c9d4ff', dark: '#3a4060' },
  gold: { name: 'GOLD', color: '#ffd36b', dark: '#5a4418' },
  platinum: { name: 'PLATINUM', color: '#9fe8ff', dark: '#1e4a5a' },
};

const ACHIEVEMENTS = [
  // ---- Story ----
  { id: 'start', cat: 'story', tier: 'bronze', icon: 'eye', name: 'Eyes Open', desc: 'Wake up in The Between.',
    note: 'The chairs were still warm. Like someone had only just been called.' },
  { id: 'dash', cat: 'story', tier: 'bronze', icon: 'ribbon', name: 'Something You Forgot', desc: 'Get your dash back.',
    note: 'A red ribbon, tied to nothing, pulling me forward.' },
  { id: 'name', cat: 'story', tier: 'silver', icon: 'tag', name: 'What\'s in a Name', desc: 'Learn who has been guiding you.',
    note: '"Like the sleep. Like remembering." She had a name the whole time. I never asked.' },
  { id: 'ch1', cat: 'story', tier: 'bronze', icon: 'club', name: 'Clubs', desc: 'Clear the Gate of Clubs.',
    note: 'Everyone in the waiting room is waiting for someone. So was I.' },
  { id: 'ch2', cat: 'story', tier: 'silver', icon: 'spade', name: 'Spades', desc: 'Clear the Gate of Spades.',
    note: 'The city fell slowly, then all at once. I kept climbing anyway.' },
  { id: 'ch3', cat: 'story', tier: 'silver', icon: 'diamond', name: 'Diamonds', desc: 'Clear the Gate of Diamonds.',
    note: 'Every day I tried to forget was on a shelf. Overdue.' },
  { id: 'hollow', cat: 'story', tier: 'gold', icon: 'hollow', name: 'Not With You', desc: 'Outrun the Hollow.',
    note: 'It had my face. It wanted me to stop. I didn\'t.' },
  { id: 'ch4', cat: 'story', tier: 'gold', icon: 'heart', name: 'Hearts', desc: 'Reach the Heart of The Between.',
    note: 'The only way out was through. So I went through.' },
  { id: 'morning', cat: 'story', tier: 'gold', icon: 'cup', name: 'Never Late Again', desc: 'Bring breakfast.', hidden: true,
    hint: 'Some promises can only be kept in the morning.', note: 'Orange juice and crackers. A midnight picnic, at 8 a.m.' },

  // ---- Memory ----
  { id: 'frag1', cat: 'memory', tier: 'bronze', icon: 'shard', name: 'A Piece of You', desc: 'Collect a memory fragment.',
    note: 'It was warm. It smelled like the hospital cafeteria.' },
  { id: 'mem1', cat: 'memory', tier: 'silver', icon: 'coat', name: 'Two Sizes Too Big', desc: 'Recover every memory in The Waiting Room.',
    stat: 'frags1', goal: FRAGS_IN(1), note: 'I never grew into the coat. I kept it anyway.' },
  { id: 'mem2', cat: 'memory', tier: 'silver', icon: 'note', name: 'Love You, Kiddo', desc: 'Recover every memory in The Falling City.',
    stat: 'frags2', goal: FRAGS_IN(2), note: 'A whole drawer of notes I never read. I\'m reading them now.' },
  { id: 'mem3', cat: 'memory', tier: 'silver', icon: 'clock', name: '11:48', desc: 'Recover every memory in the Library of Lost Days.',
    stat: 'frags3', goal: FRAGS_IN(3), note: 'She said sorry four times. I let her get to three.' },
  { id: 'mem4', cat: 'memory', tier: 'silver', icon: 'bow', name: 'So You Can Find Your Way Back', desc: 'Recover every memory in the Heart of The Between.',
    stat: 'frags4', goal: FRAGS_IN(4), note: 'She tied the ribbon to the bed rail. I followed it home.' },
  { id: 'fragall', cat: 'memory', tier: 'gold', icon: 'star', name: 'Whole Again', desc: 'Collect every memory fragment.',
    stat: 'frags', goal: TOTAL_FRAGMENTS, note: 'All of it. Even the heavy parts. Especially those.' },
  { id: 'curious', cat: 'memory', tier: 'bronze', icon: 'lens', name: 'Library Voice', desc: 'Look closely at 15 things.',
    stat: 'looked', goal: 15, note: 'Mom always said I noticed too much. She meant it nicely.' },
  { id: 'lookall', cat: 'memory', tier: 'gold', icon: 'lens', name: 'Every Corner', desc: 'Look closely at everything there is to see.',
    stat: 'looked', goal: LOOK_TOTAL, note: 'Every vending machine, every bench, every torn page. I saw it all.' },

  // ---- Heart ----
  { id: 'echo1', cat: 'heart', tier: 'bronze', icon: 'bubble', name: 'Someone Was Listening', desc: 'Help an Echo.',
    note: 'Walt, Juno, Hester, Pip. They were all waiting for someone too.' },
  { id: 'kind', cat: 'heart', tier: 'gold', icon: 'pair', name: 'Not Alone', desc: 'Help every Echo you meet.',
    stat: 'helped', goal: 4, note: 'Nobody gets out of here alone. Nobody should have to.' },
  { id: 'cold', cat: 'heart', tier: 'silver', icon: 'wall', name: 'Every Player for Themselves', desc: 'Turn away every Echo.',
    note: 'I told myself I didn\'t have time. I told myself a lot of things.' },
  { id: 'remi', cat: 'heart', tier: 'gold', icon: 'halves', name: 'The Other Half', desc: 'Open up to Remi every time she asks.',
    stat: 'bond', goal: 3, note: 'Hard to lie to someone who already knows. Harder to stop trying.' },

  // ---- Skill ----
  { id: 'climb', cat: 'skill', tier: 'bronze', icon: 'grip', name: 'Hold On', desc: 'Spend 20 seconds clinging to walls.',
    stat: 'climbFrames', goal: 20 * 60, unit: 'time', note: 'My arms ache. Good. That means they\'re real.' },
  { id: 'climb2', cat: 'skill', tier: 'silver', icon: 'fist', name: 'White Knuckles', desc: 'Spend 5 minutes clinging to walls.',
    stat: 'climbFrames', goal: 5 * 60 * 60, unit: 'time', note: 'I don\'t let go of things easily. Ask anyone.' },
  { id: 'dash300', cat: 'skill', tier: 'silver', icon: 'arrow', name: 'Ribbon in the Wind', desc: 'Dash 300 times.',
    stat: 'dashes', goal: 300, note: 'Faster than the rain. Faster than the headlights.' },
  { id: 'air150', cat: 'skill', tier: 'silver', icon: 'feather', name: 'Lighter Than Air', desc: 'Jump off thin air 150 times.',
    stat: 'airJumps', goal: 150, note: 'In dreams you can stand on nothing. Who knew.' },
  { id: 'lucid', cat: 'skill', tier: 'silver', icon: 'moon', name: 'Lucid Dreamer', desc: 'Clear a chapter without dying.',
    note: 'For a whole chapter, I knew exactly where to put my feet.' },
  { id: 'lucid4', cat: 'skill', tier: 'platinum', icon: 'sunrise', name: 'Wide Awake', desc: 'Clear all four chapters without dying in one dream.',
    note: 'Not one fall. I think some part of me was always awake.' },
  { id: 'die50', cat: 'skill', tier: 'bronze', icon: 'ghost', name: 'Recurring Nightmare', desc: 'Die 50 times.',
    stat: 'deaths', goal: 50, note: 'Again. And again. And again.' },
  { id: 'die300', cat: 'skill', tier: 'silver', icon: 'stone', name: 'Night After Night', desc: 'Die 300 times.',
    stat: 'deaths', goal: 300, note: 'Every fall was me, still trying. Mom would\'ve said that.' },
  { id: 'sweet', cat: 'skill', tier: 'gold', icon: 'bed', name: 'Sweet Dreams', desc: 'Finish the story with fewer than 25 deaths.',
    note: 'Hardly a nightmare at all.' },
  { id: 'speed', cat: 'skill', tier: 'gold', icon: 'hourglass', name: 'Fast Asleep', desc: 'Finish the game in under 25 minutes.',
    note: 'Visiting hours are short. I made them count.' },

  // ---- Endings ----
  { id: 'end_stay', cat: 'ending', tier: 'silver', icon: 'door', name: 'Keeper', desc: 'Stay in The Between.', hidden: true,
    hint: 'A hidden ending. Not everyone wants to wake up.', note: 'Someone has to keep the lights on here.' },
  { id: 'end_hollow', cat: 'ending', tier: 'silver', icon: 'rain', name: 'Hollow Morning', desc: 'Wake up, but forget.', hidden: true,
    hint: 'A hidden ending. Travel light.', note: 'I woke up. I don\'t know why I was crying.' },
  { id: 'end_remember', cat: 'ending', tier: 'gold', icon: 'heartbow', name: 'Remember', desc: 'Wake up and remember.', hidden: true,
    hint: 'A hidden ending. Carry enough of yourself home.', note: 'I remembered. All of it. I said sorry first, this time.' },
  { id: 'end_true', cat: 'ending', tier: 'platinum', icon: 'sun', name: 'Beyond Sleep', desc: 'Bring everyone home.', hidden: true,
    hint: 'A hidden ending. Leave no one behind. Not even yourself.', note: '"Good morning, Eli."' },
  { id: 'allends', cat: 'ending', tier: 'gold', icon: 'suits', name: 'Every Way Home', desc: 'See all four of the story\'s endings.',
    note: 'Every door out of The Between. I opened them all.' },
  { id: 'end_sussy', cat: 'ending', tier: 'bronze', icon: 'sixseven', name: 'Super Sussy Boi', desc: 'Six. Seven.', hidden: true,
    hint: 'A secret ending. Count to seven, but skip the boring part.', note: 'I have no idea what just happened.' },
  { id: 'end_tiktok', cat: 'ending', tier: 'bronze', icon: 'phone', name: 'Tik...Tok', desc: '@slimthiccrayen', hidden: true,
    hint: 'A secret ending. Time is a thing you can touch.', note: 'Go to bed.' },

  // ---- Secrets ----
  { id: 'doze', cat: 'secret', tier: 'bronze', icon: 'zzz', name: 'Five More Minutes', desc: 'Let Eli doze off.', hidden: true,
    hint: 'Sometimes the bravest thing is to do nothing at all.', note: 'A dream inside a dream. Very restful.' },
  { id: 'listen', cat: 'secret', tier: 'bronze', icon: 'ecg', name: 'Can You Hear Me?', desc: 'Reach out to Eli from the bedside.', hidden: true,
    hint: 'He can\'t wake up yet. But he can hear you.', note: 'Somebody touched my hand. My heart skipped. It was a good skip.' },
  { id: 'touch', cat: 'secret', tier: 'silver', icon: 'hand', name: 'Bedside Manner', desc: 'Touch everything in Eli\'s hospital room.', hidden: true,
    hint: 'Everything in that room answers a touch.', stat: 'touched', goal: ROOM_THINGS.length, note: 'The window, the ribbon, the monitor, the clock. And me.' },
  { id: 'wow', cat: 'secret', tier: 'silver', icon: 'wings', name: 'WOW', desc: 'Find the triple jump.', hidden: true,
    hint: 'Some words make you lighter. Say it like you mean it.', note: 'Two jumps in the air. Rules are softer in dreams.' },
  { id: 'wednesday', cat: 'secret', tier: 'silver', icon: 'mask', name: 'Such Stuff as Dreams', desc: 'Hear what the ??? has to say.', hidden: true,
    hint: 'Only on a certain day of the week.', note: 'Our little life is rounded with a sleep.' },
  { id: 'night', cat: 'secret', tier: 'bronze', icon: 'nightmoon', name: 'Should Be in Bed', desc: 'Play between midnight and 4 a.m.', hidden: true,
    hint: 'Check the clock. Your clock, not Eli\'s.', note: '3 a.m. Vending machine hours. Midnight picnic, kiddo.' },

  // ---- The last one ----
  { id: 'platinum', cat: 'story', tier: 'platinum', icon: 'crown', name: 'Good Morning, Eli', desc: 'Unlock every other achievement.',
    note: 'Thank you for staying with me the whole night.' },
];

const Achievements = {
  got: Store.get('bs_ach', {}),
  stats: Store.get('bs_stats', { climbFrames: 0, deaths: 0 }),
  // Unlocked ones the player hasn't looked at yet. The first time this is loaded, everything
  // already unlocked counts as seen, so an old save doesn't light up with NEW badges.
  seen: Store.get('bs_ach_seen', null),
  toasts: [],
  has(id) { return !!this.got[id]; },
  find(id) { return ACHIEVEMENTS.find((x) => x.id === id); },
  unlock(id) {
    if (this.got[id]) return;
    const a = this.find(id);
    if (!a) return;
    this.got[id] = Date.now();
    Store.set('bs_ach', this.got);
    this.toasts.push({ a, t: 0 });
    Sound.play('achievement');
    // Achievements about achievements.
    if (['end_stay', 'end_hollow', 'end_remember', 'end_true'].every((k) => this.got[k])) this.unlock('allends');
    if (ACHIEVEMENTS.every((x) => x.id === 'platinum' || this.got[x.id])) this.unlock('platinum');
  },
  // Lifetime counters. Ones that tick every frame only persist once a second.
  addStat(k, n, often) {
    this.stats[k] = (this.stats[k] || 0) + n;
    if (!often || this.stats[k] % 60 === 0) Store.set('bs_stats', this.stats);
    this.check(k);
  },
  // Best-ever values (most memories in one dream, and so on).
  best(k, v) {
    if (v <= (this.stats[k] || 0)) return;
    this.stats[k] = v;
    Store.set('bs_stats', this.stats);
    this.check(k);
  },
  // Marks one of a set as done (each thing in the hospital room, say) and counts the set into stat k.
  mark(k, item, all) {
    const m = this.stats[k + 'Set'] || (this.stats[k + 'Set'] = {});
    if (m[item]) return;
    m[item] = 1;
    this.best(k, all.filter((x) => m[x]).length);
  },
  check(k) {
    for (const a of ACHIEVEMENTS) if (a.stat === k && this.stats[k] >= a.goal) this.unlock(a.id);
  },
  // [current, goal] for achievements that count toward something, or null.
  progress(a) { return a.stat ? [Math.min(this.stats[a.stat] || 0, a.goal), a.goal] : null; },
  count(list = ACHIEVEMENTS) { return list.filter((a) => this.got[a.id]).length; },
  isNew(id) { return !!this.got[id] && !!this.seen && !this.seen[id]; },
  markSeen(id) {
    if (!this.seen || this.seen[id] || !this.got[id]) return;
    this.seen[id] = 1;
    Store.set('bs_ach_seen', this.seen);
  },
  update() {
    const t = this.toasts[0];
    if (t && ++t.t > (t.a.tier === 'platinum' ? 260 : 200)) this.toasts.shift();
  },
};
if (!Achievements.seen) { Achievements.seen = Object.assign({}, Achievements.got); Store.set('bs_ach_seen', Achievements.seen); }
// Stats added after a player already earned the matching achievement start from the goal,
// so the progress bars agree with what's unlocked.
for (const a of ACHIEVEMENTS) if (a.stat && Achievements.got[a.id]) Achievements.stats[a.stat] = Math.max(Achievements.stats[a.stat] || 0, a.goal);
