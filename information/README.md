# Beyond Sleep

A 2D precision platformer about Eli, a thirteen-year-old who runs out into the rain on his birthday after saying something he can't take back. Now he's in a coma, in **The Between**: a world built from everything he tried to forget, shared with other sleepers who are each stuck on something of their own.

## Play

Open `Design/index.html` in any modern browser (Chrome, Firefox, Edge). Nothing to install.

If your browser blocks local files, serve the project folder instead:

```sh
python3 -m http.server 8000
# then open http://localhost:8000/Design/index.html
```

## Music: "The Breeze"

The game is scored to **"The Breeze"**, loaded from:

```
music/the-breeze.ogg
```

The game finds it automatically and credits it on the title screen. The track loops across the whole game: menus, chapters and story scenes only change its volume, so it never restarts mid-phrase. It restarts once, at the ending.

Without the file, an original synthesized string score plays instead.

## Controls

| Action | Keyboard | Gamepad |
|---|---|---|
| Move | Arrows / A D (S to climb down) | D-pad / left stick |
| Jump (hold for higher) | W / Space / K | A |
| Double jump (jump again in midair) | W / Space / K | A |
| Sprint (hold, uses the sprint bar) | Shift | Triggers / L3 |
| Dash (8 directions) | X / J | X or B |
| Grab & climb (hold) | Z / V / L | Bumpers / Y |
| Look at things / talk | ↑ / E (when you see the speech bubble) | D-pad up |
| Pause | Esc / P / Enter | Start |
| Mute | M | |

## Story structure

- **Prologue**: illustrated scenes of the night of the rain.
- **Chapter I ♣ The Waiting Room**: the hospital where Eli spent his childhood waiting for his mom's night shifts to end.
- **Chapter II ♠ The Falling City**: his city coming apart and falling upward, the way his family did.
- **Chapter III ♦ The Library of Lost Days**: every day anyone chose to forget, kept on shelves. Including his.
- **Chapter IV ♥ The Heart of The Between**: the Hollow, Eli's worst belief about himself, chases him through the last rooms.
- **Epilogue ☀ Morning**: a playable epilogue, one year later, if he wakes up and remembers.

Along the way:

- **18 memory fragments** tell the night of the rain in order. How many you carry decides how the story ends.
- **4 Echoes**, other sleepers: Walt (a trucker who missed his daughter's childhood), Juno (a climber who fell), Hester (a teacher deciding whether to forget), Pip (a little boy who doesn't know where they go). Each asks you something, your answer changes them, and they come back later.
- **Remi**, the girl with the red ribbon, asks you three questions. How you answer changes what she says at the end.
- **Mom's voice** reaches The Between from the hospital room, once per chapter.
- **Things to look at**: twinkling objects you can examine with ↑.
- **4 endings**: Keeper of the Between, Hollow Morning, Remember, and Beyond Sleep (the true ending: every memory, every Echo).
- **45 achievements** (13 hidden) in six categories (Story, Memory, Heart, Skill, Endings, Secrets) with bronze/silver/gold/platinum tiers, pixel icons, progress bars, hints for hidden ones and a journal note from Eli for each. Saved in the browser across playthroughs.

## Low-end PCs

The game renders at 320×184 and scales up with integer pixel scaling (or fills the window with **Options → Display → Scaling → Fill Screen**). Terrain, back walls and props are pre-rendered once per room; physics runs at a fixed 60 Hz. For weak machines, set **Options → Display → Effects** to **Reduced**, which turns off dynamic lighting and reduces particles.

**Assist Mode** (Options → Play) gives infinite stamina and dashes, plus invincibility (the Hollow can't catch you), for anyone who just wants the story. The same tab has **Game Speed** (50–100%), **Text Speed**, and hold/toggle settings for **Grab** and **Sprint**. **Display → Reduce Flashing** softens lightning, flickering lights and the Chapter IV glitches.

## Files

`Design/` (how it looks)
- `index.html`: the page
- `art.js`: autotiled terrain, parallax backgrounds, props, weather, lighting, title screen, story scenes
- `sprites.js`: pixel sprites (Eli, Remi, Mom, the Echoes, the Hollow) and dialogue portraits with expressions
- `credits.js`: the credits film: Eli runs back through all four chapters as the names go by, the cast lines up, your playthrough is tallied, and it ends on the morning (or night) your ending earned. Hold C to hurry, Esc to skip
- `music/`: put the music file here

`Mechanics/` (how it works)
- `core.js`: input, storage, sound effects, music
- `levels.js`: room maps (40×23 tiles), props and examinable objects
- `story.js`: all dialogue, memories, endings and the epilogue
- `achievements.js`: achievement definitions and tracking
- `world.js`: collision, entities, the Hollow
- `player.js`: movement physics (coyote time, jump buffering, wall climb, dash) and the ribbon
- `ui.js`: dialogue boxes, slides, menus, HUD (`CREDITS` at the top holds every name, card and cast line in the credits)
- `main.js`: game states, saving, interaction, room flow, endings

`tools/` (for editing levels)
- `levels.py`: the room layouts, written as rectangles. Edit this, then run `python3 tools/levels.py` to regenerate `Mechanics/levels.js`.
- `solve.js`: `node tools/solve.js 2-3` runs the real player physics through a search to prove a room's exit, memory, characters and examinable objects can all be reached. Run it after changing a room.

Map legend in `levels.js`: `#` solid, `^`/`v` spikes, `P` spawn, `D` dash crystal, `M` memory, `S` spring, `C` crumble block, `N` Echo, `G` Remi, `O` Mom.
