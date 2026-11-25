# Fleeced: Counting Sheep redesign — plan pack, version 2

Written 24 November 2026. **This pack replaces `PLAN_COUNTING_SHEEP.md` version 1 completely.**

Give Claude Code the whole folder. Save it in the repo as `docs/dream/`. Record Brian's decisions (file 00, section 1) in `CLAUDE.md`.

## Why there is a version 2

Brian asked whether version 1 was high quality and fitted the theme "without just recycling the same stuff over and over again". It did not pass that test:

| What version 1 recycled | What version 2 does instead |
|---|---|
| The three stages were **one world in three colour sets**: the same hills, pines and islands, recoloured | **Each stage is its own world**, with its own sky, scenery, ground, obstacles and movement (files 03, 04 and 05). Nothing is a recolour |
| The ground was the leaderboard's floating island (snow lip, icicles, soil, stones) all night long | The floating island is stage 2 only. Stage 1 runs on the farm's snowy track. Stage 3 runs on the farmer's quilt |
| The scenery reused the same windmill, bench and pine from other screens, with no reason for being there | **Everything in the dream comes from the farmer's own farm or his own bedroom.** You can see each original in the bed strip or on Home (file 00, section 5) |
| The interface wore the same snow caps, icicles and festive lights as the leaderboard, the pen and the profile | Counting Sheep gets its own trim: a band of the farmer's quilt patches. There are no snow caps, icicles or festive lights on this mode's interface (file 02, section 2) |
| The model, colours and icons were described, never tested | They were built and measured before writing (see "What was checked") |

What is shared on purpose, so the mode still belongs to the game: the navy kit (boards, slabs, tiles, fonts), the sheep, the fence's sign, the tray and the star words. These stay the same in every stage because they are what you read and play with.

## How the pack is organised

| File | What it holds |
|---|---|
| `00-overview.md` | Brian's decisions, the idea, what must not change, the three worlds at a glance, where each dream thing comes from |
| `01-farmer.md` | The farmer's model, his poses, the bed strip |
| `02-layout-and-interface.md` | The thought bubble, the tray, the sign, the counters, the cards, phones |
| `03-stage-1-his-own-farm.md` | Stage 1, layer by layer |
| `04-stage-2-the-farm-lifts-off.md` | The first gate and stage 2 |
| `05-stage-3-under-the-quilt.md` | The second gate, stage 3 and the finale |
| `06-beat-and-effects.md` | The beat, what happens on each event, star words, safety |
| `07-opening-endings-results.md` | The opening, both endings, the results board |
| `08-run-order-and-checks.md` | Seven milestones, the checks, cost, wording, open choices |
| `data/palettes.json` | Every colour |
| `data/contrast.json` | 47 measured colour pairs |
| `data/farmer.boxes.json` | The farmer, box by box (106 boxes) |
| `data/farmer.poses.json` | His poses |
| `data/pixel-art.json` | Every new icon, as grids |
| `data/dotfont.json` | The dot letters for star words |
| `data/timings.json` | Every timing of files 04 to 07, for code |
| `reference/farmer-sheet.png` | Brian's sheet. The farmer must match it |
| `reference/farmer-model-check.png` | The box model drawn beside the sheet |
| `reference/sketch-stage-1.png`, `-2`, `-3`, `sketch-finale.png` | Rough sketches of each world at 1440 x 900 |
| `reference/sketch-phone.png`, `sketch-results.png` | Rough sketches of the phone layout and the results board |
| `reference/pixel-art.png`, `dotfont.png` | Every icon and the dot letters, drawn large |
| `tools/` | The scripts that made the data and pictures. They are optional: re-run them if a number changes. They need Python 3 with Pillow (the sketches also need the DejaVu fonts) |

## Which source wins

1. **Numbers** (colours, the farmer's boxes, grids, timings): the `data/` files win over the text.
2. **Behaviour** (what happens, when, and what must not change): the text wins.
3. **Sketches** are flat shapes. They show layout, colour and what is in each world. They are not art, and they lose to both of the above.

## What was checked before writing

| Check | Result |
|---|---|
| The farmer's box model, drawn straight on and laid over the sheet's front view | Outlines overlap 0.92 above the hem (the plan's own pass mark is 0.88). See `reference/farmer-model-check.png` |
| 47 colour pairs: the sheep against each stage, star words on each sky band, every text on its surface, the lane as the brightest band | All pass. See `data/contrast.json` |
| Every new icon | Drawn at size and read by eye. See `reference/pixel-art.png` |
| The dot letters | Drawn as whole words. M, N and W were unclear at 3 wide, so they are wider now. See `reference/dotfont.png` |

What was **not** checked, because it needs the game running: frame time, the flash limits, and that no rule changed. File 08 makes Claude Code prove each of these.
