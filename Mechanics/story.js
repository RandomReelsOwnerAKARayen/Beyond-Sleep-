'use strict';
// All narrative content.
// Dialogue lines: {s: speaker, t: text, e: expression}. Special entries:
//   {choice: [{t, set: [key, value], then: [...lines]}]}   branching ('echo' = this room's Echo, 'bond' = add to Remi bond)
//   {give: 'dash'} / {name: 'REMI'} / {final: true} / {fragmentsLine: true} / {bondLine: true}
// Speakers without a portrait: '' (narration, prefixed with *), VOICE (Mom, heard from outside).

const SPEAKERS = {
  ELI: '#9fd8ff', '???': '#ff7a8a', REMI: '#ff7a8a', WALT: '#e8b890', JUNO: '#ff9a8a', HESTER: '#c8a8e8',
  PIP: '#ffe080', HOLLOW: '#ff2a4a', MOM: '#8fe0d8', VOICE: '#8fe0d8', '': '#ffe9a8',
};
const SPEAKER_NAMES = { VOICE: 'MOM  (far away)' };

const CHAPTERS = [
  null,
  { suit: '♣', title: 'The Waiting Room', sub: 'Everyone here is waiting for their name to be called.', color: '#7fd1a8' },
  { suit: '♠', title: 'The Falling City', sub: 'Things fall apart slowly, and then all at once.', color: '#9fb4ff' },
  { suit: '♦', title: 'The Library of Lost Days', sub: 'Every day you tried to forget is kept somewhere.', color: '#ffcf6b' },
  { suit: '♥', title: 'The Heart of The Between', sub: 'The only way out is through.', color: '#ff6b7f' },
  { suit: '☀', title: 'Morning', sub: 'One year later.', color: '#ffe9a8' },
];

const PROLOGUE = [
  { scene: 'cake', t: 'Your thirteenth birthday.\nShe promised she\'d be home by seven.' },
  { scene: 'clock', t: 'She wasn\'t.' },
  { scene: 'rain', t: 'Rain. Headlights.\nSomeone screaming your name.' },
  { scene: 'ecg', t: '...beep.      ...beep.      ...beep.' },
  { scene: 'ribbon', t: '"Eli? Sweetheart, it\'s Mom.\nI tied the ribbon from your cake to the bed.\nSo you can find your way back."' },
  { scene: 'between', t: 'The voice gets farther away.\n\nAnd you fall somewhere in between.' },
];

// Memory fragments, in story order. Missing some changes how the story ends.
const MEMORIES = {
  '1-2': 'A yellow raincoat, two sizes too big.\nMom said I\'d grow into it. I never did.',
  '1-3': 'Dad\'s car pulling out of the driveway.\nI was nine. He didn\'t wave.',
  '1-4': '3 a.m., the hospital vending machine.\nMom on her break: "Midnight picnic, kiddo."\nCrackers and orange juice. Best meals of my life.',
  '1-5': 'Mom asleep at the kitchen table, still in scrubs.\nShe\'d worked all night.\nShe still made my breakfast first.',
  '2-1': 'Double shifts. Cold dinners.\nA note on the fridge: "Love you, kiddo."',
  '2-2': 'At some point I stopped reading her notes.\nI kept them, though. A whole drawer.',
  '2-3': 'The first real fight. "You\'re never here!"\n"I\'m out there for YOU, Eli!"\nWe both meant it. That was the problem.',
  '2-4': 'I told my friends Mom was "busy."\nI told Mom my friends were "fine."\nI didn\'t really have friends.',
  '2-5': 'Dad\'s birthday card came three weeks late.\nMom said she\'d forgotten to give it to me.\nShe hadn\'t. She was covering for him.',
  '3-1': 'My thirteenth birthday.\nI waited at the window until the streetlights came on.',
  '3-2': '11:48. Her key in the door.\nA cake box with a red ribbon.\nThree nurses called in sick. She said sorry four times.',
  '3-3': 'I didn\'t let her finish the fourth sorry.',
  '3-4': 'I slammed the door so hard the picture fell.\nThe one of the three of us. The glass broke right across Dad.',
  '3-5': 'It was raining. I didn\'t take the yellow coat.\nHer voice behind me:\n"Eli, please, come back inside..."',
  '4-1': 'Headlights. I didn\'t look.\nI just wanted to be anywhere she wasn\'t.',
  '4-2': 'Her hand in mine, every day since.\nI could feel it. I just couldn\'t hold on.',
  '4-3': 'She tied the ribbon from the cake box to my bed rail.\n"So you can find your way back," she said.',
  '4-4': 'What she did after I said it: nothing.\nShe just set the cake down, very carefully,\nlike it was the thing that might break.',
};
const TOTAL_FRAGMENTS = Object.keys(MEMORIES).length;

const STORY = {
  // =================== CHAPTER 1: THE WAITING ROOM ===================
  '1-1': {
    enter: [
      { s: 'ELI', t: '...Where am I?', e: 'surprised' },
      { s: 'ELI', t: 'This looks like the waiting room at St. Brigid\'s. Where Mom works.' },
      { s: 'ELI', t: 'But it\'s wrong. Too quiet. Too long. Like a dream that forgot to end.', e: 'sad' },
      { s: '', t: '[ ← → ] move    [ W / Space / ↑ ] jump.  Hold jump to go higher.  [ ↑ ] look at things.' },
    ],
    look: {
      chairs: [{ s: '', t: 'Thirteen plastic chairs. All empty. All facing a door with no handle.' }],
      clock: [{ s: '', t: 'The clock says 11:48.' }, { s: '', t: 'It has always said 11:48.' }],
      vending: [
        { s: '', t: 'B4: COURAGE. Sold out.' },
        { s: '', t: 'B5: FIVE MORE MINUTES. Price: everything.' },
        { s: '', t: 'You don\'t have any money. You don\'t have pockets, actually.' },
      ],
    },
  },
  '1-2': {
    enter: [
      { s: 'ELI', t: 'When I was little, Mom\'s shifts ran all night and there was nobody to watch me.' },
      { s: 'ELI', t: 'So I waited here. I knew every chair. I knew which ceiling light buzzed.' },
      { s: '', t: 'Hold [ Z ] next to a wall to grab it. [ ↑ ↓ ] climb. Climbing tires you out, so rest on the ground.' },
      { s: '', t: 'Glowing shards are memories. You don\'t need them to go on... but they decide how this ends.' },
    ],
    look: {
      number: [{ s: '', t: 'TAKE A NUMBER.' }, { s: '', t: 'You take one. It says 0.' }, { s: '', t: 'Nobody is ever going to call it.' }],
      cooler: [{ s: '', t: 'The water cooler gurgles like it\'s trying to tell you something.' }, { s: '', t: 'It isn\'t. It\'s a water cooler. Even here.' }],
    },
  },
  '1-3': {
    echo: [
      { s: 'WALT', t: 'Another new one. Take a number, kid. Everybody here\'s number zero.' },
      { s: 'WALT', t: 'Name\'s Walt. Drove a rig twenty-two years. Never stayed anywhere longer than a tank of gas.' },
      { s: 'ELI', t: 'How long have you been here?' },
      { s: 'WALT', t: 'Four hundred days. Or minutes. Clock\'s stuck. You noticed the clock?' },
      { s: 'WALT', t: 'Thing is, down here you can hear \'em sometimes. The folks outside. My girl Lily used to read to me.' },
      { s: 'WALT', t: 'Treasure Island. She does the pirate voices all wrong.', e: 'smile' },
      { s: 'WALT', t: 'Then she stopped. Or I stopped hearing. I missed that girl\'s whole life on the road, kid.', e: 'sad' },
      { s: 'WALT', t: 'Why would she wait around for me now?', e: 'sad' },
      { choice: [
        { t: 'She\'s still reading. You just have to listen.', set: ['echo', true], then: [
          { s: 'WALT', t: '...Yeah? You think?', e: 'surprised' },
          { s: 'WALT', t: '...Yeah. Okay. I\'ll listen harder. Thanks, kid.', e: 'smile' },
        ] },
        { t: 'Maybe she\'s done waiting. I would be.', set: ['echo', false], then: [
          { s: 'WALT', t: 'Yeah. That\'s what I figured.', e: 'down' },
          { s: 'WALT', t: 'Kid... whoever you\'re actually mad at, it ain\'t me.' },
        ] },
      ] },
    ],
    echoAgain: {
      true: [{ s: 'WALT', t: 'Shh. I think I hear her. Chapter four. "Fifteen men on the dead man\'s chest..."', e: 'smile' }],
      false: [{ s: 'WALT', t: 'Gate\'s that way, kid. Don\'t let me keep you.' }],
    },
    look: {
      tv: [{ s: '', t: 'A TV plays a cooking show with the sound off.' }, { s: '', t: 'The chef keeps making a birthday cake. He never gets to the candles.' }],
      chairs: [{ s: '', t: 'A magazine: "TEN WAYS TO BE MORE PATIENT."' }, { s: '', t: 'It\'s been read so many times the pages have gone soft.' }],
    },
  },
  '1-4': {
    enter: [
      { s: 'ELI', t: 'Night shift. The vending machine glowed like a campfire. Mom would come out on her break and we\'d...' },
      { s: 'ELI', t: '...We\'d what? I can\'t remember.', e: 'sad' },
      { s: '', t: 'While holding a wall, press jump and push away from it to wall-jump.' },
    ],
    look: {
      drawing: [
        { s: '', t: 'A crayon drawing taped to the wall: a lighthouse, a boy, and a woman made entirely of nurse\'s uniform.' },
        { s: '', t: 'It\'s signed ELI, AGE 7, in letters that lean forward like they\'re running.' },
      ],
    },
  },
  '1-5': {
    her: [
      { s: '???', t: 'There you are. You\'re late, Eli.' },
      { s: 'ELI', t: 'You know my name?', e: 'surprised' },
      { s: '???', t: 'I know a lot of things you don\'t. It\'s sort of my whole deal.', e: 'smile' },
      { s: '???', t: 'This is The Between. It\'s where people go when they\'re too hurt to wake up, and too stubborn to stop.' },
      { s: '???', t: 'Four gates. Clubs, Spades, Diamonds, Hearts. Past the last one is the Heart. Everyone who gets there makes a choice.' },
      { s: 'ELI', t: 'What choice?' },
      { s: '???', t: 'You\'ll know when you get there. ...Here. You dropped this. A long time ago, or last week. Hard to say.' },
      { give: 'dash' },
      { s: '', t: 'A red ribbon ties itself around your shoulders. It\'s warm, like someone only just let go of it.' },
      { s: '', t: 'Press [ X ] to DASH in any of 8 directions. The ribbon glows while you can. Landing brings it back.' },
      { s: '???', t: 'So. Are you scared?' },
      { choice: [
        { t: 'Yes.', set: ['bond', 1], then: [{ s: '???', t: 'Good. Scared means you still care how this ends.', e: 'smile' }] },
        { t: 'No.', set: ['bond', 0], then: [{ s: '???', t: 'Liar. That\'s okay. I\'m one too.' }] },
      ] },
      { s: '???', t: 'That door has no handle, so don\'t bother. You have to go the long way around. You always did.' },
    ],
    herAgain: [{ s: '???', t: 'The long way, Eli. Over the pit. Trust the ribbon.' }],
    look: {
      door: [
        { s: '', t: 'A door with no handle.' },
        { s: '', t: 'Warm light leaks out from under it, like a kitchen at dawn.' },
        { s: '', t: 'You press your ear to it. Someone on the other side is breathing slowly, the way people breathe after crying.' },
      ],
    },
  },

  // =================== CHAPTER 2: THE FALLING CITY ===================
  '2-1': {
    enter: [
      { s: 'ELI', t: 'This is our city. It\'s coming apart in pieces...', e: 'surprised' },
      { s: 'ELI', t: '...and the pieces are falling up.' },
      { s: '', t: 'Blue crystals restore your dash in midair.' },
    ],
    look: {
      ac: [{ s: '', t: 'An air conditioner hums the same four notes over and over.' }, { s: '', t: 'It\'s "Happy Birthday." It never gets to the last line.' }],
    },
  },
  '2-2': {
    enter: [
      { s: 'ELI', t: 'Those platforms won\'t hold for long. Don\'t look down, Eli.' },
      { s: 'VOICE', t: '...the doctors say you can probably hear me. So I\'m going to keep talking. Fair warning.' },
      { s: 'ELI', t: 'Mom?', e: 'surprised' },
    ],
    look: {
      billboard: [{ s: '', t: 'SWEET DREAMS MATTRESS CO.  "Why wake up?"' }, { s: '', t: 'Someone has scratched underneath it: "because people are waiting."' }],
    },
  },
  '2-3': {
    echo: [
      { s: 'JUNO', t: 'Don\'t come closer. The last guy who got close tried to push me off.', e: 'angry' },
      { s: 'ELI', t: 'I\'m not going to push you.' },
      { s: 'JUNO', t: 'That\'s exactly what he said.' },
      { s: 'JUNO', t: 'I\'m Juno. I climb. Climbed. Nationals, last spring. I was fourteen meters up when the hold spun.' },
      { s: 'JUNO', t: 'In here it\'s all jumps. Clear the gaps and you get closer to waking. Miss, and you just... fade. I\'ve watched people fade.', e: 'sad' },
      { s: 'JUNO', t: 'I can\'t make that one. I\'ve stood here for weeks. My body remembers the floor.', e: 'down' },
      { choice: [
        { t: 'Watch me. Then you\'ll know it can be done.', set: ['echo', true], then: [
          { s: 'JUNO', t: '...Okay. I\'m watching.', e: 'surprised' },
          { s: 'JUNO', t: 'Don\'t you dare fall.' },
        ] },
        { t: 'Then don\'t jump. Stay where it\'s safe.', set: ['echo', false], then: [
          { s: 'JUNO', t: 'Safe. Yeah.', e: 'down' },
          { s: 'JUNO', t: 'Funny. That\'s exactly what the floor says too.' },
        ] },
      ] },
    ],
    echoAgain: {
      true: [{ s: 'JUNO', t: 'I\'m still watching. That was ugly, by the way. Ugly counts.', e: 'smile' }],
      false: [{ s: 'JUNO', t: 'Go on. I\'m fine here. I\'m always fine here.' }],
    },
    look: {
      ac: [{ s: '', t: 'The rooftop is covered in chalk tally marks. Thousands of them.' }, { s: '', t: 'Days, or failed jumps, or both.' }],
    },
  },
  '2-4': {
    enter: [
      { s: 'VOICE', t: 'I found your drawer. All my notes. Every single one. You kept them, you dummy.' },
      { s: 'VOICE', t: 'I thought you threw them out. I stopped writing them because I thought you threw them out.' },
      { s: 'ELI', t: '...', e: 'sad' },
    ],
    look: {
      phone: [
        { s: '', t: 'A payphone. It\'s ringing.' },
        { s: '', t: 'You pick up. Static. Under the static, a steady beep... beep... beep.' },
        { s: '', t: 'And under that, a woman humming. You know the song. You don\'t know how you know it.' },
      ],
    },
  },
  '2-5': {
    her: [
      { s: '???', t: 'You\'re getting faster.', e: 'smile' },
      { s: 'ELI', t: 'Why is everything falling apart?' },
      { s: '???', t: 'Something\'s pulling on this world. Like a hook through water. Don\'t think about it too hard.' },
      { s: 'ELI', t: 'Do you have a name?' },
      { s: '???', t: 'Not one I remember. Ask me again later.' },
      { s: '???', t: 'Can I ask you something instead?' },
      { s: '???', t: 'Your dad. Do you miss him?', e: 'down' },
      { choice: [
        { t: 'Every day. I hate that I do.', set: ['bond', 1], then: [
          { s: '???', t: 'Me too.', e: 'sad' },
          { s: '???', t: '...I mean. I know. I know you do.' },
        ] },
        { t: 'No. He doesn\'t get to be missed.', set: ['bond', 0], then: [
          { s: '???', t: 'Okay.', e: 'down' },
          { s: '???', t: 'You say that like a door you\'re holding shut with your whole body.' },
        ] },
      ] },
      { s: '???', t: 'Two gates left. Keep moving, Eli.' },
    ],
    herAgain: [{ s: '???', t: 'Go. The gate won\'t wait. Nothing here does, except the people.' }],
    look: {
      bench: [{ s: '', t: 'A bench with a brass plaque: IN MEMORY OF EVERY TIME SOMEONE SAID "LATER."' }, { s: '', t: 'It\'s a very long bench.' }],
    },
  },

  // =================== CHAPTER 3: THE LIBRARY OF LOST DAYS ===================
  '3-1': {
    enter: [
      { s: 'ELI', t: 'Books. Thousands of them.' },
      { s: 'ELI', t: '...That\'s my handwriting.', e: 'surprised' },
      { s: '', t: 'Springs throw you high and restore your dash.' },
    ],
    look: {
      desk: [{ s: '', t: 'A desk lamp, a cold cup of tea, and a book called THINGS I MEANT TO SAY.' }, { s: '', t: 'Every page is blank.' }],
      globe: [{ s: '', t: 'A globe of a world where every country is called "Somewhere Else."' }],
    },
  },
  '3-2': {
    echo: [
      { s: 'HESTER', t: 'Shh. Library voice, dear.', e: 'smile' },
      { s: 'HESTER', t: 'This is the Library of Lost Days. Every day anyone ever chose to forget ends up on these shelves.' },
      { s: 'HESTER', t: 'I\'m Hester. I taught third grade for forty-one years. I had a stroke in the middle of a spelling test.' },
      { s: 'HESTER', t: '"Necessary." Is it two c\'s? One? It\'s been bothering me for months.' },
      { s: 'HESTER', t: 'I\'ve been reading my lost days. My husband\'s last winter. My son, who stopped calling. All the things I put away.', e: 'sad' },
      { s: 'HESTER', t: 'The doctors say if I wake there will be less of me. Fewer memories. Maybe that\'s a mercy.' },
      { s: 'HESTER', t: 'So tell me, child. Is it better to keep the pain, or lose the good along with it?' },
      { choice: [
        { t: 'Keep it. Even the pain is yours.', set: ['echo', true], then: [
          { s: 'HESTER', t: '...Then I\'ll carry every one of them back with me.', e: 'closed' },
          { s: 'HESTER', t: 'Thank you, dear. One c, two s\'s. I just remembered.', e: 'smile' },
        ] },
        { t: 'Lose it. You\'ve earned some quiet.', set: ['echo', false], then: [
          { s: 'HESTER', t: 'Quiet. Yes.', e: 'sad' },
          { s: 'HESTER', t: 'That\'s what I told myself the first time I tore a page out.' },
        ] },
      ] },
    ],
    echoAgain: {
      true: [{ s: 'HESTER', t: 'N-E-C-E-S-S-A-R-Y. I\'ll never lose it again. Off you go, dear.', e: 'smile' }],
      false: [{ s: 'HESTER', t: 'Hm? Oh. I\'m sorry, dear. Have we met?' }],
    },
    look: {
      lectern: [
        { s: '', t: 'An open book on a lectern. It\'s open to your sixth birthday.' },
        { s: '', t: 'Mom traded three shifts to be there. She fell asleep during the candles.' },
        { s: '', t: 'You were so angry. You\'d forgotten you were ever angry about that.' },
        { s: '', t: 'You\'d forgotten she came.' },
      ],
    },
  },
  '3-3': {
    enter: [
      { s: 'VOICE', t: 'I keep thinking about the last thing I said to you. "Come back inside." Like you were seven.' },
      { s: 'VOICE', t: 'Like it was only the rain.' },
    ],
    cameo: {
      juno: {
        true: [
          { s: 'JUNO', t: 'Hey! Rooftop kid! I made it! The jump! I screamed the whole way, but I made it!', e: 'smile' },
          { s: 'JUNO', t: 'Still scared, by the way. Turns out you can be scared and jump anyway. Who knew?' },
        ],
        false: [
          { s: '', t: 'Juno is sitting at the edge, looking down. She doesn\'t look up.' },
          { s: 'JUNO', t: '...Oh. It\'s you. Go on. I\'m fine here.', e: 'down' },
        ],
      },
    },
    look: {
      returns: [{ s: '', t: 'A RETURNS slot. LOST DAYS MAY BE RETURNED AT ANY TIME. NO LATE FEES.' }, { s: '', t: 'In smaller letters underneath: "It is never too late. We checked."' }],
    },
  },
  '3-4': {
    enter: [
      { s: 'ELI', t: 'Pages. Torn out. Like someone didn\'t want me to read them.' },
      { s: 'ELI', t: '...Like I didn\'t.', e: 'sad' },
    ],
    look: {
      torn: [{ s: '', t: 'A book with every page torn out. Only the cover is left: ELI, AGE 13.' }, { s: '', t: 'The pages drift around the room, as if they\'re looking for somewhere to land.' }],
    },
  },
  '3-5': {
    her: [
      { s: '???', t: 'You found the library. I hoped you wouldn\'t.', e: 'sad' },
      { s: 'ELI', t: 'Those books... the rain. Mom. The torn pages. Why?' },
      { s: '???', t: 'Because you tore them out. Somebody had to keep them.' },
      { s: 'ELI', t: 'Somebody?' },
      { s: '???', t: '...Call me Remi. Like the sleep. Like remembering.', e: 'smile' },
      { name: 'REMI' },
      { s: 'REMI', t: 'Are you angry? That I kept them from you?' },
      { choice: [
        { t: 'No. You were protecting me.', set: ['bond', 1], then: [
          { s: 'REMI', t: 'I was trying to. I\'m not sure it\'s the same thing anymore.', e: 'sad' },
        ] },
        { t: 'Yes. They\'re mine.', set: ['bond', 0], then: [
          { s: 'REMI', t: '...Yeah. They are.', e: 'down' },
          { s: 'REMI', t: 'That\'s the first time you\'ve said that. Hold on to it.' },
        ] },
      ] },
      { s: 'REMI', t: 'One more gate, then the Heart. Something is going to chase you there. Promise me you\'ll keep climbing.' },
    ],
    herAgain: [{ s: 'REMI', t: 'Up, Eli. The Heart\'s waiting.' }],
    look: {
      shelf: [
        { s: '', t: 'A whole shelf labelled MOM. The spines are every color. Some are thin. One is very, very thick.' },
        { s: '', t: 'It\'s called: EVERY NIGHT SHE CAME HOME ANYWAY.' },
      ],
    },
  },

  // =================== CHAPTER 4: THE HEART ===================
  '4-1': {
    enter: [
      { s: 'ELI', t: 'It\'s all breaking. The ground, the sky...', e: 'surprised' },
      { s: 'REMI', t: '(from somewhere far away) Not the world, Eli. You. You\'re waking up.' },
    ],
    echo: [
      { s: 'PIP', t: 'Are you the one who\'s leaving?', e: 'surprised' },
      { s: 'ELI', t: 'Leaving?' },
      { s: 'PIP', t: 'Everybody says. When the boy with the ribbon leaves, the Between breaks. It\'s already breaking. Look.' },
      { s: 'PIP', t: 'I\'m Pip. I\'m six and three-quarters. I was at the swimming pool and then I was here.' },
      { s: 'PIP', t: 'If the Between goes away... where do we go? Do we go away too?', e: 'sad' },
      { choice: [
        { t: 'Home. Everybody gets to go home.', set: ['echo', true], then: [
          { s: 'PIP', t: 'Home...', e: 'surprised' },
          { s: 'PIP', t: 'We have a dog. His name is Biscuit. I forgot about Biscuit!', e: 'smile' },
        ] },
        { t: 'I don\'t know. Maybe nowhere.', set: ['echo', false], then: [
          { s: 'PIP', t: '...Oh.', e: 'down' },
          { s: 'PIP', t: 'Okay. I\'ll just wait here, then. I\'m good at waiting.' },
        ] },
      ] },
    ],
    echoAgain: {
      true: [{ s: 'PIP', t: 'Biscuit is brown with one white ear. Can you remember that for me? Just in case.', e: 'smile' }],
      false: [{ s: 'PIP', t: 'I\'m being very good at waiting.', e: 'down' }],
    },
    look: {
      monitor: [{ s: '', t: 'A heart monitor, wired to nothing.' }, { s: '', t: 'It beats anyway. 62. 61. 62.' }],
    },
  },
  '4-2': {
    enter: [
      { s: 'HOLLOW', t: 'Going back? After what you said to her?' },
      { s: 'ELI', t: 'Who are you?', e: 'surprised' },
      { s: 'HOLLOW', t: 'Who do you think? I\'m you. The real one. The one that slammed the door.' },
      { s: 'ELI', t: 'What did I say to her? I don\'t remember.', e: 'angry' },
      { s: 'HOLLOW', t: 'Yes you do. You\'ve always known. That\'s why you\'re down here.' },
      { s: 'HOLLOW', t: 'Run, then. I\'ll be right behind you. I always am.' },
      { s: '', t: 'Don\'t stop moving.' },
    ],
  },
  '4-3': {
    enter: [
      { s: 'VOICE', t: 'They want me to sign things. Decide things. I told them I\'m not deciding anything without you.' },
      { s: 'VOICE', t: 'So you have to come back and decide with me. That\'s the rule. I just made it.' },
    ],
    cameo: {
      walt: {
        true: [
          { s: 'WALT', t: 'Kid! Run, don\'t stop to chat with an old man!', e: 'surprised' },
          { s: 'WALT', t: '...But hey. I heard her. Chapter twenty-two. She\'s almost done. I\'m gonna be there for the ending.', e: 'smile' },
        ],
        false: [
          { s: 'WALT', t: 'Whatever\'s chasing you, don\'t let it catch you.', e: 'sad' },
          { s: 'WALT', t: 'I let mine catch me years ago. Look where it got me.' },
        ],
      },
    },
  },
  '4-4': {
    enter: [
      { s: 'HOLLOW', t: 'Say it. Say what you said.' },
      { s: 'ELI', t: '...', e: 'down' },
      { s: 'HOLLOW', t: 'Fine. I\'ll say it for you. Like always.' },
      { s: 'HOLLOW', t: '"Dad was right to leave."' },
      { s: 'ELI', t: '...', e: 'cry' },
      { s: 'ELI', t: 'I said that. I said that to her. On my birthday. While she was holding the cake.', e: 'cry' },
      { s: 'HOLLOW', t: 'And you think she wants you back? She\'d be lighter without you. Stay down here. With me.' },
      { s: 'ELI', t: '...No. Not with you.', e: 'angry' },
    ],
  },
  '4-5': {
    her: [
      { s: 'REMI', t: 'You made it. All the way to the Heart.', e: 'smile' },
      { s: 'ELI', t: 'Remi. That thing chasing me. Is it right? About me?', e: 'sad' },
      { s: 'REMI', t: 'It\'s right about one sentence. It\'s wrong about a whole life.' },
      { s: 'REMI', t: 'It\'s what you decided you were, the second the words left your mouth. It\'s not me. I\'m the other half.' },
      { s: 'ELI', t: 'Tell me the truth. What are you?' },
      { s: 'REMI', t: '...I\'m everything you couldn\'t carry. The rain. The door. The sentence. And the cake, and the notes, and the midnight picnics.', e: 'sad' },
      { s: 'REMI', t: 'You couldn\'t hold the bad without dropping the good. So you buried all of it. It became me. And I built all of this, so you\'d have somewhere to hide.' },
      { fragmentsLine: true },
      { bondLine: true },
      { s: 'REMI', t: 'The Between is collapsing because you\'re waking up, Eli.' },
      { s: 'REMI', t: 'If you wake, you take it all back. The guilt and the love, the same weight. This world ends. And I end, or... I become you again. I don\'t know which.' },
      { s: 'REMI', t: 'If you stay, the Between holds. The Echoes keep dreaming. And I keep you company. It wouldn\'t hurt. Not ever again.' },
      { s: 'REMI', t: 'So. What will it be?' },
      { choice: [
        { t: 'Wake up.', set: ['final', 'wake'], then: [
          { s: 'REMI', t: 'Then open your eyes, Eli.', e: 'cry' },
          { s: 'REMI', t: 'I\'ll be right behind them.', e: 'smile' },
        ] },
        { t: 'Stay in The Between.', set: ['final', 'stay'], then: [
          { s: 'REMI', t: '...Okay.', e: 'down' },
          { s: 'REMI', t: 'Then let\'s hold it together. For as long as it lasts.' },
        ] },
      ] },
      { final: true },
    ],
    look: {
      bed: [
        { s: '', t: 'A hospital bed. The sheets are still warm.' },
        { s: '', t: 'A red ribbon is tied to the rail.' },
        { s: '', t: 'This is where you are. This is where you\'ve been the whole time.' },
      ],
    },
  },

  // =================== EPILOGUE ===================
  '5-1': {
    enter: [
      { s: '', t: 'One year later. Your fourteenth birthday. 6:52 a.m.' },
      { s: 'ELI', t: 'Her shift ends at seven. I\'m never late anymore.', e: 'smile' },
    ],
    cameo: {
      walt: { true: [
        { s: 'WALT', t: 'Kid! Lily, this is the one I told you about. ...No, not from the truck stop. From the other place.', e: 'smile' },
        { s: 'WALT', t: 'She reads to me every Sunday now. Treasure Island, third time through. Still does the voices wrong. It\'s perfect.' },
      ] },
      juno: { true: [
        { s: 'JUNO', t: 'Physio says I can climb again in the spring. Real walls. I\'m terrified.', e: 'smile' },
        { s: 'JUNO', t: 'Gonna do it anyway. Learned that from some idiot on a rooftop.' },
      ] },
      hester: { true: [
        { s: 'HESTER', t: 'I wrote them all down, you know. Every lost day. The painful ones especially.', e: 'smile' },
        { s: 'HESTER', t: 'The pain is what makes the good parts heavy enough to keep. My son calls on Thursdays now.' },
      ] },
      pip: { true: [
        { s: 'PIP', t: 'Biscuit is brown with one white ear! You remembered! I knew you would!', e: 'smile' },
        { s: 'PIP', t: 'Did you know you can just go home? Nobody told me you could just go home.' },
      ] },
    },
    mom: [
      { s: 'MOM', t: 'Eli? You\'re early.', e: 'surprised' },
      { s: 'ELI', t: 'I brought breakfast. Crackers and orange juice.' },
      { s: 'MOM', t: '...A midnight picnic.', e: 'cry' },
      { s: 'ELI', t: 'And a cupcake. With a ribbon.' },
      { s: 'MOM', t: 'Eli, it\'s your birthday. I\'m supposed to bring you the cake.' },
      { s: 'ELI', t: 'I know. I wanted to be the one who was on time.', e: 'smile' },
      { s: 'ELI', t: 'Mom... I\'m sorry. For what I said. For all of it.', e: 'sad' },
      { s: 'MOM', t: 'I know, baby. I knew before you ever woke up.', e: 'smile' },
      { s: 'MOM', t: 'Come here.', e: 'smile' },
    ],
  },
};

// Remi reacts to how much of Eli the player chose to carry.
const FRAGMENT_LINES = {
  many: { s: 'REMI', t: 'You picked up the pieces of me along the way. I felt every single one.', e: 'smile' },
  few: { s: 'REMI', t: 'You left most of me behind on the way here. I don\'t blame you. Some of it is heavy.', e: 'sad' },
};
const BOND_LINES = {
  high: { s: 'REMI', t: 'You know what the worst part is? I\'m going to miss you. Which is stupid. I am you.', e: 'cry' },
  low: { s: 'REMI', t: 'You never trusted me much. That\'s fair. I never told you the whole truth until now.', e: 'down' },
};

const ENDINGS = {
  stay: {
    title: 'ENDING: KEEPER OF THE BETWEEN', ach: 'end_stay',
    slides: [
      { scene: 'between', t: 'You take her hand.' },
      { t: 'The sky stops falling.\nThe broken city settles like snow.' },
      { t: 'You build a waiting room with no doors.\nIt\'s warm. Nobody ever calls your number.' },
      { scene: 'ecg', t: 'Far away, a heart monitor\nslows to a whisper.' },
      { scene: 'ribbon', t: 'A woman sits beside a bed, reading out loud\nto someone who will never hear the end.' },
      { t: 'She reads anyway. Every night.\nAt 11:48 she stops, and says happy birthday.' },
    ],
  },
  hollow: {
    title: 'ENDING: HOLLOW MORNING', ach: 'end_hollow',
    slides: [
      { scene: 'dawn', t: 'Light. Too much light.' },
      { t: '"Eli? ...ELI! Somebody, please, he\'s awake!"' },
      { t: 'A woman is crying. She holds your hand\nlike it\'s the only thing in the world.' },
      { t: 'You know she\'s your mother.\nYou know you should feel more than that.' },
      { t: 'There was a dream. A girl. A ribbon.\nA name on the tip of your tongue.' },
      { t: 'It\'s gone. Whatever you left down there,\nyou left it for good.' },
      { t: 'Months later, you still flinch at the sound of rain.\nYou never find out why.' },
    ],
  },
  remember: {
    title: 'ENDING: REMEMBER', ach: 'end_remember',
    slides: [
      { scene: 'dawn', t: 'Light. A hospital ceiling.\nThe beeping is steady now.' },
      { scene: 'ribbon', t: 'Your mother is asleep in the chair, still holding your hand.\nA red ribbon is tied to the bed rail.' },
      { t: 'You remember. The rain. The door. The road.\nThe sentence.' },
      { t: 'It hurts. But it\'s yours.' },
      { t: '"Mom." Your voice is a scratch. "Mom. I didn\'t mean it."' },
      { t: 'She wakes. She doesn\'t ask what you mean.\n"I know, baby. I know."' },
    ],
    epilogue: true,
  },
  true: {
    title: 'TRUE ENDING: BEYOND SLEEP', ach: 'end_true',
    slides: [
      { scene: 'dawn', t: 'Light. A hospital ceiling.\nThe beeping is steady now.' },
      { scene: 'ribbon', t: 'You remember everything. The rain. The door. The sentence.\nThe cake. The notes. The midnight picnics.' },
      { t: '"Mom. I\'m sorry."\nShe was never angry. Only scared.' },
      { t: 'Down the hall, a truck driver wakes up\nand asks if his daughter is still reading Treasure Island.' },
      { t: 'On the third floor, a girl with a cast sits up\nlike she just made a jump she thought was impossible.' },
      { t: 'An old woman opens her eyes and spells "necessary"\nfor the night nurse. One c. Two s\'s.' },
      { t: 'In the children\'s ward, a little boy asks for his dog.\nThen, very seriously, he asks to go home.' },
      { t: 'And when you close your eyes, Remi is still there.\nNot a world. Not a wall.\nJust a part of you, finally carried.' },
    ],
    epilogue: true,
  },
};

// Unlocked by pressing 6 then 7 during play.
const SECRET_ENDING = {
  title: 'SECRET ENDING: SUPER SUSSY BOI', ach: 'end_sussy',
  slides: [
    { scene: 'between', t: 'You press 6.\nThen 7.' },
    { t: 'The Between goes very, very quiet.' },
    { t: 'Somewhere far off, a vending machine\nstarts laughing and can\'t stop.' },
    { t: 'Remi stares at you for a long time.\n"...Eli. Was that a meme?"' },
    { t: 'Every Echo in the dream turns to look at you.\nNobody says anything. Nobody has to.' },
    { t: 'The falling sky stops, just to get a better look.' },
    { scene: 'dawn', t: 'You wake up. A nurse is standing over the bed.\n"You kept saying six seven in your sleep."' },
    { t: 'You say nothing.\nYou are, and will always be, a super sussy boi.' },
  ],
};

// Unlocked by touching the wall clock on the title screen six times. Each touch moves the minute hand.
const TIKTOK_ENDING = {
  title: 'SECRET ENDING: TIK...TOK', ach: 'end_tiktok',
  handle: '@slimthiccrayen',
  slides: [
    { scene: 'clock', t: 'Tik.' },
    { t: '...Tok.' },
    { t: 'The clock that always said 11:48\nfinally gets where it was going.' },
    { scene: 'phone', t: 'Midnight. A phone lights up on the nightstand.\nSomeone is still scrolling.' },
    { scene: 'phone', t: 'One more video. Then one more.\nThe Between could wait. Sleep could wait.' },
    { t: 'Remi, from somewhere very far away:\n"Eli. Put it down. You have to be up in six hours."' },
    { scene: 'phone', t: 'The last video before your eyes close\nis from an account called @slimthiccrayen.' },
    { t: 'You don\'t remember what it was about.\nYou followed anyway.' },
  ],
};

// The Endings gallery on the title screen, in the order the cards are laid out.
// An ending counts as found once its achievement is unlocked.
const ENDING_GALLERY = [
  { end: ENDINGS.stay, scene: 'between' },
  { end: ENDINGS.hollow, scene: 'rain' },
  { end: ENDINGS.remember, scene: 'ribbon' },
  { end: ENDINGS.true, scene: 'dawn' },
  { end: SECRET_ENDING, scene: 'sixseven' },
  { end: TIKTOK_ENDING, scene: 'phone' },
];

const EPILOGUE_END = [
  { scene: 'dawn', t: 'The sun comes up over St. Brigid\'s.\nIt\'s warm. It\'s ordinary.' },
  { t: 'It\'s the best morning of your life.' },
];

// The Wednesday "???" on the title screen. One of these, at random. [text, play]
const QUOTES = [
  ['We are such stuff\nas dreams are made on, and our little life\nis rounded with a sleep.', 'The Tempest'],
  ['To sleep, perchance to dream.\nAy, there\'s the rub.', 'Hamlet'],
  ['Sleep that knits up the ravelled sleave of care.', 'Macbeth'],
  ['The night is long that never finds the day.', 'Macbeth'],
  ['Give sorrow words. The grief that does not speak\nwhispers the o\'erfraught heart and bids it break.', 'Macbeth'],
  ['I have had a most rare vision. I have had a dream,\npast the wit of man to say what dream it was.', 'A Midsummer Night\'s Dream'],
  ['If we shadows have offended,\nthink but this, and all is mended:\nthat you have but slumbered here\nwhile these visions did appear.', 'A Midsummer Night\'s Dream'],
  ['The course of true love never did run smooth.', 'A Midsummer Night\'s Dream'],
  ['What\'s past is prologue.', 'The Tempest'],
  ['There is nothing either good or bad,\nbut thinking makes it so.', 'Hamlet'],
  ['This above all: to thine own self be true.', 'Hamlet'],
  ['Our doubts are traitors,\nand make us lose the good we oft might win\nby fearing to attempt.', 'Measure for Measure'],
  ['How far that little candle throws his beams!\nSo shines a good deed in a naughty world.', 'The Merchant of Venice'],
  ['Love all, trust a few, do wrong to none.', 'All\'s Well That Ends Well'],
  ['Grief fills the room up of my absent child.', 'King John'],
  ['The fault, dear Brutus, is not in our stars,\nbut in ourselves.', 'Julius Caesar'],
  ['All the world\'s a stage,\nand all the men and women merely players.', 'As You Like It'],
  ['Though she be but little, she is fierce.', 'A Midsummer Night\'s Dream'],
];
