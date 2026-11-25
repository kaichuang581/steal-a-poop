# X2. Run order, checks and choices

## 1. Steps (one pull request each; stop for Brian's approval after each)

| Step | What | Done when |
|---|---|---|
| **S1** | **Models in.** `scripts/packModels.mjs` reads every file in `data/models/index.json`, `data/skins.json` and `data/bursts.json` and writes generated TypeScript. A developer page `?preview=models` shows every model on a plain floor | The page, side by side with `reference/models-bombs.png`, `models-fuse-sounds.png`, `models-market.png`, matches box for box; each mesh's bounding box equals `size_m` within 1 mm |
| **S2** | **The bombs, everywhere.** The eight skins replace today's bombs in every mode: the face with the seconds, the burning 12-piece fuse, the last-3-seconds colour and wobble (`T2`). Old thumbnails removed | The fuse test passes; a 3x sheet shows every skin at 12 s, 3 s and 1 s with readable seconds |
| **S3** | **The bursts.** The ten bursts rebuilt from their tables with the one timing (`T3`) | A recording of all ten; at the 300 ms frame each matches `reference/models-bursts.png` |
| **S4** | **The market row.** The scene, the shared shift camera, walking between stops, the yarn-line tabs, wallet, level strip, footer (`T1`, `T7`). Stops stand empty. The old panel is deleted | Screenshots of the four stops match the reference pictures' scenery within 10 px; the camera test of `T1` passes |
| **S5** | **Feed Sacks** (`T5`): sacks, picking, the bench, tags, the odds board, the button's three states, the reveal, duplicates, the phone roll | Every state screenshotted on a computer and a phone; the sack tests of the Trading Post plan still pass unchanged |
| **S6** | **Bell Shelf and Missions** (`T6` sections 1, 2) | Screenshots with 0, 15 and 100 Bells; missions at 0, part and done; milestones paid and unpaid |
| **S7** | **Barn Book and the close view** (`T6` sections 3, 4); Listen on fuse sounds (`T4`) | The three spreads with 3, 12 and 26 of 26 found |
| **S8** | **The rink.** Practice's scene, camera, chalkboard, coach chair, tile rack (`P1`, `P2`), nothing interactive yet. The void, the skyline blocks, the floating slabs and bulb sticks, the scattered squares and the signpost are deleted | A screenshot matches `reference/practice-run-computer.png` in where things stand; the camera test of `P1` passes |
| **S9** | **A run** (`P3`): chalk count and tally, cards, tiles on the rack, plates, bubbles, the coach's lines, every effect, the ice block. The corner box, VS bar, typing line and old messages are deleted | A recording of a full run, and the same with reduced motion; a strip of the board at every count from 0 to 11 |
| **S10** | **The report** (`P4`). The old end card is deleted | Its four checks pass; screenshots under 10 words, over 10, and a new best, on a computer and a phone |

## 2. Checks for every step

1. Type check, all tests and the build pass. **No rule changed:** run the existing shop tests (odds within 0.2 points over a million rolls, pity at 10 and 40, duplicate refunds, Bells never open a sack) and the practice tests; none may be edited to pass.
2. `python3 tools/checks.py` passes against the data shipped, including the detail-size checks of `VOXEL_GRAIN.md`; `python3 tools/grain_audit.py` prints nothing.
3. **Colours:** scenery from LADDER tokens and named glows only; skins and bursts only from `data/skins.json` and `data/bursts.json`; interface only from the tokens of `T7`. No navy board, wooden interface panel, painted plank texture, rope, dashed border, gingham or handwriting font is left on either screen (grep, and look). Boards built as real parts of a model (`VOXEL_GRAIN.md`, rule 4) are not a texture and stay.
4. **No recycling:** nothing is copied in from Counting Sheep's dream, the lobby pen or the barn table. The market row and the rink share only the camera helper, Home's far farm and the lantern glow.
5. **Nothing random:** no model, pattern or burst uses a random number. The same screen looks the same every time.
6. Nothing floats: every box rests on the ground or another box, except bulbs on their wire, hanging tags, lanterns and bells on their hooks, and effects.
7. Text is never under 11 px, and every text pair is at least 4.5 to 1.
8. Every size: 390 x 844, 768 x 1024, 1280 x 720, 1440 x 900, 1920 x 1080, English and French. Nothing clipped; nothing scrolls sideways.
9. With `FESTIVE` off: no bulbs, no wreath.
10. Frame time no worse than the screen each replaces, on High and Low.

## 3. Changes Brian did not ask for (confirm in the pull request)

- The Trading Post becomes a full screen instead of a panel over Home.
- Every bomb gets a flat face for the seconds; outside a game it shows 10.
- Every model follows one detail size (`VOXEL_GRAIN.md`): nothing narrower than 0.05 m, big surfaces built from boards, snow in whole caps and steps.
- The Barn Book's "Found / Not found" chips are removed; the coloured squares on the sack tags are removed.
- "Try it", "Listen" and "See it lit" in the close view, if today's preview does not have them.
- Practice: the coach, the countdown, the bib, the rating and word list in the report, and sprout / sapling / pine as the three level icons (also on Home's Practice card).

## 4. Choices for Brian (the defaults are used unless he says otherwise)

1. **The face on every bomb.** Default: yes, as drawn. Other: no face; the seconds float just above the bomb in the same font.
2. **Not-found items in the Barn Book.** Default: paper cut-outs. Other: full colour, with only the lock on the label.
3. **The market's time of day.** Default: always dusk, as drawn. Other: Home's current time of day.
4. **Opening the Trading Post lands on.** Default: the stop last visited this session. Other: always Feed Sacks.
5. **The coach.** Default: the sheepdog on a high chair. Other: the farmer from Counting Sheep, standing by the board.
6. **Countdown before a practice run.** Default: 3, 2, 1 on the letter card (1.8 s). Other: start at once.
7. **A whistle sound** for the coach. Default: one short two-tone whistle, under 0.4 s. Other: no new sound.

## 5. Not checked here (needs the game or its code)

- The game running: its real light and shading, its own sheep and sheepdog, frame time, how the walk between stops and the hop feel.
- The catalogue: which burst is the starter, which seven are in the Corn Sack, each item's rarity beyond the bomb skins seen in the screenshots, and whether sack items can also be bought directly today. The plan shows what the code has; `data/catalogue.json` says where it is guessing.
- How today's sack reveal and item preview are built; the plan describes how they must look, not what to keep of their code.
- The words in French.
- The pictures assume the next practice word starts with the previous word's last letter. Use the code's rule.

## 6. The prompt for Claude Code

> Read `README.md` and `VOXEL_GRAIN.md`, then every `T`, `P` and `X` file in order, then the files in `data/`. Rebuild the Trading Post and Practice as they say, in steps S1 to S10 of `X2`, one pull request per step, stopping after each for approval. Load every model, skin and burst from its JSON with the packer of S1; model nothing by hand and change no animal model. Change no price, odd, pity count, refund, reward, timer, score or stored value; where a number in these files disagrees with the code's rules, keep the code's and tell me. Where a file disagrees with `data/`, the data wins. Use no random numbers in any model, pattern or effect. Attach the screenshots each step asks for, beside the matching picture in `reference/`.
