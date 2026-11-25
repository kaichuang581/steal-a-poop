# 08. Run order, checks, cost, wording and open choices

## 1. Run order

One pull request for each milestone. ■ means: stop, and wait for Brian.

| # | Milestone | Files | What Brian sees |
|---|---|---|---|
| CS1 | **The farmer.** The model from `data/farmer.boxes.json`, the farmer board, the match test, every pose. He replaces the old farmer in today's bubble and in the results bedroom. The knitting basket and the five books go into the bedroom. ■ Brian compares the board with his sheet | 01 | A new farmer; nothing else |
| CS2 | **The layout and the interface.** The bed strip, the thought bubble, the tray, the hint strip, the sign's board, the counters, the cards, the ready board. Today's dream is shown inside the new window, moved up, otherwise unchanged. ■ | 02 | The new frame round the old dream |
| CS3 | **The beat and the shared effects,** on today's dream: the beat's clock, a word taken, the jump, the roll, the puffs, wrong words, the fence close, the bump, star words, the safety limits, reduced motion. ■ | 06 | The old dream answers the player |
| CS4 | **Stage 1: his own farm.** Every layer of file 03, shown for the whole night for now. The cloud bands and the old scenery go. ■ | 03 | The farm at night |
| CS5 | **The first gate and stage 2.** ■ | 04 | The farm lifts off |
| CS6 | **The second gate, stage 3 and the finale.** ■ | 05 | Under the quilt; the sheep cross the moon |
| CS7 | **The opening, both endings and the results board.** ■ | 07 | The whole night, start to finish |

## 2. Checks, and what done means

1. **The usual.** Type check, all tests and the build pass. The Counting Sheep mapping tests pass **unchanged**. The dream's picture tests are updated to the new look, in the milestone that changes it.
2. **Proof that no rule changed.** Before starting, record one counted night and one practice run with fixed words and a fixed clock: the time of every word taken, jump, count and bump, and the result. After every milestone the same inputs give the same record, to the millisecond. Add this as a test.
3. **The same places on screen.** For that recorded night, the on-screen x of the sheep and of every rules box matches the record at every frame. Their y differs by one fixed amount only (the play strip moved up).
4. **The farmer's match** (file 01, section 2): outline overlap at least 0.88 on the front and back views; the 12 colour points within tolerance.
5. **The flash test.** Record 5 s in each stage, at each gate and in the finale, at 30 frames a second. The window's average brightness never changes by more than 8% between frames, and never reverses more than three times a second.
6. **Reduced motion.** With it on, the dream has no moving part other than the game's own (the sheep, the fences, the lane) and the farmer's breathing.
7. **Colour.** `tools/check_colours.py` still reports no failure if any colour in `data/palettes.json` changes. In the built game, text contrast is at least 4.5 to 1 everywhere, including the sign's letters over every stage's sky and the star words. In every stage the lane is the brightest band.
8. **The interface.** The kit's surface test passes on the tray, the cards, the ready board and the results board. Buttons are at least 44 high. No snow cap, icicle or festive light is on this mode's interface.
9. **No recycling.** In the pull request for CS6, put the three stages side by side at the same moment of the run. For each row of the table in file 00, section 6, say what differs between the stages. Every row must differ in **shape or behaviour**, not only in colour.
10. **Nothing without a reason.** List every kind of object in the dream and, beside it, where its original is shown (file 00, section 5). Anything with no original is removed.
11. **Screenshots in each pull request:** all 23 steps of Brian's contact sheet, at 1440 x 900 and at 390 x 844 (with the keyboard open where typing happens), beside today's. Add each stage, each gate, the finale, the opening and both endings as short clips. Also a 3x detail sheet: the tray in every state, the sign, the bubble's rim and tail, the farmer's face in each pose, the counters, a star word, one obstacle from each stage.
12. Section 3's limits hold, with numbers in the pull request.
13. With `FESTIVE` false, no festive bulb remains.

## 3. Cost

| Thing | Limit |
|---|---|
| New canvases | Two 2D canvases inside the dream window: one for the sky (stars, the northern light, button stars, star words, the moon's sheep), one for effects (rings, streaks, puffs, feathers, flying tiles). Backing size at most twice the screen's (1.5 times on the Low tier) |
| Scenery in memory | **One stage's scenery at a time.** Both stages' scenery exists only during a gate (1.2 s at most). Build the next stage's meshes in the game's idle slices before the gate, never in the gate's frames |
| Particles | At most 60 alive at once (snow, feathers, puffs and streaks together) |
| Frame time | At most 2 ms more than today on the High tier, 1 ms more on the Low tier. Measure every stage and both gates |
| Triangles | Each stage's count is no higher than today's dream. The old cloud bands' triangles pay for the new scenery |
| The bed strip | On the Low tier it may redraw on every fourth frame |
| Files | No new library, font or picture file. All pixel art is drawn in code from `data/pixel-art.json`. Say by how many bytes the bundle grows |

If a limit is missed: stop and report. Never remove something from the High tier to meet a number.

## 4. Wording

Add French for each, matching in meaning, and list them in the pull request for Brian to check.

| Before | After |
|---|---|
| "a word starting with H" / "Enter to jump" | Removed: the locked tiles and the Jump button say it |
| "type ahead..." | "Type ahead…" |
| "✓ HACK" (paper tag) | Removed: the word sits on the sign's plank |
| "1/30" | "1 of 30" in the counter, and the night track |
| "Bump! / the farmer stirs..." | "Bump!" / "The farmer stirs…" |
| "Zzz... / he's out cold" | "Zzz…" / "He’s out cold" |
| "Type a word that starts with the letters on the sign, or press any key" | The three captions of the ready board, and "Press any key to start" |
| "Asleep after 30 fences, no bumps, longest word 5 letters" | The same facts, one to a line |
| "Warm Blankets keep your streak warm when you miss a night. You earn one every 7 nights." | "Every 7 nights earns a Warm Blanket. It saves your streak if you miss a night." |
| "Tonight's dream returns at 12:00 am." | "The next dream arrives at 12:00 am." |

**New text:** "Jump", "Dreaming…", "Deep dream", "Nearly out cold", "Two letters now", "Three letters now", "Five fences to go", "Read the sign", "Type a word that starts with it", "Press Enter to jump", "Press any key to start", "Your night sky".

**Unchanged:** the three hints ("Type any word that starts with the letter on the sign, like SHEEP for S." and the two that follow), "Not in the dictionary", the two results titles, "Practice dream", "How far can you run?", "Practice dreams don’t count toward your streak."

## 5. Changes Brian did not ask for, to confirm in the pull requests

- the three worlds, their names, the two gates and the finale;
- the beat;
- words as stars, and "Your night sky" on the results board;
- the fence meter under the tray;
- the Jump button;
- the night track of 30 pips;
- the sheep's roll in the air;
- the ready board's three pictures;
- the clouds at the end replaced by the dream sinking into his head, or popping;
- the new opening;
- the knitting basket in the bedroom, and five books on the shelf;
- this mode's own trim (the quilt band, the nightshirt pocket) in place of snow caps;
- the wording of section 4.

## 6. Open choices for Brian (the defaults are used unless he says otherwise)

1. **Sound on the beat.** Default: none in this plan; it belongs with the later redesign of how the game plays. Other: a soft tick on each beat and a chime on each word, through the game's existing sound code.
2. **The sheep's roll in the air.** Default: on. Other: today's jump.
3. **Your words as stars.** Default: on. Other: off.
4. **The clouds at the end.** Default: removed. Other: kept, redrawn as pixel puffs.
5. **The Jump button.** Default: on every device. Other: on touch screens only.
6. **The sheep crossing the moon in the finale.** Default: on. Other: the moon swells with no sheep on it.
7. **The yarn in stage 3.** Default: the game's red yarn, as on the loading screen. Other: cream yarn, to keep red for the farmer's cap alone.
