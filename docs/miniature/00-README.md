# Fleeced: the painted-miniature look

**Summary, run order and prompt.** Written 20 November 2026 against the pushed code (v0.8.0, commit `4f033f4`). The working tree is newer (v0.8.3, not pushed); milestone M0 maps this plan onto it before anything is changed.

**This plan replaces the play-set plan (`docs/toybox/`). Do not run that plan.** It was built on a wrong reading (a literal game board). Where the diorama scenery plan of 18 November has not been run, do not run it either; this plan covers the same ground. Whatever earlier plans have already built stays, and M0 lists it.

## 1. The plan in one paragraph

The farm's models are good and stay where they are. What makes the game feel low quality is how they are shown: grey, hazy light; a random speckle on almost every surface; models smoothed until nothing is crisp; and no small detail, because a door latch is as big as a wall block. This plan fixes those four things, in that order, and nothing else. The light becomes a clear, soft winter day. Every part gets one solid colour, with neighbouring parts one small step apart in brightness. Walls, roofs and trees show clean 0.2 m blocks. A new layer of 0.05 m blocks adds real small things (crates, a barrel, milk cans, tools, lanterns, hinges, a bench) near the cameras' close shots, and a soft shade appears on the snow under everything. The wendigo, the rules of the game and the interface are not touched.

## 2. Why the game looks low quality today

| # | Cause | Evidence in the pushed code | Fixed by |
|---|---|---|---|
| 1 | The wide views are grey | Measured: sunlit snow is 174 of 255 and the red barn reads 151, 149, 154 (plain grey). Haze 0.012 on every shot, sun 20° up, exposure 1 | File 02 |
| 2 | Surfaces are speckled | Each cube picks one of three tones at random (`tone()` and `pick()` in the scene files), smoothing adds brightness grain, snow caps have random holes | File 03 |
| 3 | Nothing is crisp | On a computer every model is smoothed to half-size cubes with cut corners, and edges are shaded as rounded | File 03 |
| 4 | There is one block size | Small things are built from the same 0.2 m cube as walls, so there is no fine detail to look at | File 04 |

Brian's reference shows the opposite of each: soft bright light, solid matte colours with subtle value steps, sharp cubes, and chunky structure next to very small detail. File 01 turns that into ten rules.

Both earlier mockups missed this. The first had clean surfaces but a game board. The second had good light but a block grid and random shades on every surface. The target is the first one's clean surfaces, the second one's light, and a layer of tiny real detail.

## 3. What changes and what does not

| Changes | Does not change |
|---|---|
| Home's light by day and dawn (haze, sun height, exposure, shadow reach and softness) | The wendigo: its files, place, shot, pins, and everything behind z = −16 |
| The colour of every model in front of that line: solid, in planned steps, no longer desaturated | The place, size and shape of every building, prop, tree and animal |
| Smoothing of the farm's models: off, so blocks are crisp | Every rule, timer, bot, score, word list, network call and save |
| Snow: solid colours, whole caps, clean drifts | Every screen, button, text and layout |
| A micro layer of 0.05 m objects on Home, in eight small groups | The light at dusk, at night and at the barn table (unless Brian picks otherwise from a pair) |
| A baked soft shade on the ground under everything | The barn table's and small scenes' triangle counts |
| Colours of animals, worn items and decorations (shapes unchanged) | |

## 4. The files

| File | What it holds | Milestone |
|---|---|---|
| `00-README.md` | This file | All |
| `01-target-look.md` | The reference in words; the gap; rules R1 to R10; the palette of 25 materials in five steps each; which step goes where | All |
| `02-light.md` | The measurements; five light changes with exact values per shot; targets; what stays | M1 |
| `03-paint-system.md` | `paint.ts`; snow; chunky structure; sharp edges; the repaint of every Home model, part by part | M2 |
| `04-micro-kit.md` | The micro builder; the kit of 19 objects, cube by cube; the ground shade map; the review pictures and the ten checks | M3 |
| `05-home.md` | The wendigo's protection; anchors; the ground; where each of the micro objects stands; the country in front of the line; the tour shot by shot | M3 to M5 |
| `06-animals-and-season.md` | Animal colours with value steps; worn items; decorations; baking the shop's pictures again | M6 |
| `07-other-scenes.md` | The barn table (M2); the podium, ice duel, lobby pen, dream, bedroom (M7) | M2, M7 |
| `08-method-and-acceptance.md` | The milestones; checks per milestone; budgets; the pairs Brian is shown; when to stop; risks | All |
| `ladder.mjs` | The tool that makes a five-step colour ladder from one colour | M0 |
| `light-test-day.jpg` | The measured light comparison on the real game | M1 |

## 5. Before the first milestone, and the prompt

**Brian, before M0:**
1. Push v0.8.3 if you can. The plan works either way, but Kai's reviews and this plan would then see the same code.
2. Copy this folder into the repository as `docs/miniature/`.
3. Read section 7 and change any default you disagree with. Decisions 1 and 4 override rules that are yours in `CLAUDE.md`, so they need your yes before M1 and M2.

**The prompt.** Paste it into Claude Code, one milestone per session, with the milestone's number filled in:

```text
You are working on Fleeced (this repository). Do milestone M_ of the plan in docs/miniature/ and nothing else.

Before you change anything:
1. Read CLAUDE.md from the first line to the last.
2. Read docs/miniature/00-README.md, 01-target-look.md and 08-method-and-acceptance.md whole.
3. Read the plan files that 08, section 1 lists for this milestone, whole.
4. Read every source file this milestone will edit, whole. The plan was written against v0.8.0; the code here is newer.
   Where they differ, keep the plan's intent and write the difference down for the pull request.

While you work:
- Follow the rules R1 to R10 of file 01. One part, one colour. Nothing random per cube. No texture, grain or gradient.
- The wendigo is frozen: its files, its place, its shot, its pins, and everything behind z = -16 (file 05, section 1).
  After any commit that touches Home, the land or the country, run:
  npx vite-node tools/scenes/check.ts -- --only wendigo
  If it fails, undo the commit and stop. Never edit the pins or the check.
- Do not change any rule, timer, bot, score, word list, network call, save, or piece of interface.
- Do not invent a model, a colour, a count or a place. If the plan lacks something, stop and ask.
- For every model you build or repaint: photograph it with tools/miniature/shots.mjs, open the picture, and go through
  the ten checks of file 04, section 7. Fix and repeat until all ten pass.
- Use only the checks 08, section 2 lists for a milestone. The full gate runs once, in M8.

When you finish:
- Open one pull request for this milestone, for Kai to review, with everything 08, section 2 item 6 asks for,
  and the pairs 08, section 4 lists for this milestone.
- If 08, section 1 marks this milestone with a stop, stop and wait for Brian's answer.
- If anything in 08, section 7 happens, stop at once and say what you found.
```

## 6. The entry for the top of `CLAUDE.md`

Add this in M0. Fill in each date when Brian answers.

```markdown
## The painted-miniature look (docs/miniature/, from 2026-11-20)

The plan in docs/miniature/ is the current plan for how the game looks. It replaces docs/toybox/ (never run it).

Standing rules from it (docs/miniature/01-target-look.md has the full text):
- One part, one colour. Parts that touch differ by one step of the material's ladder. Nothing random per cube:
  no random tone, no grain, no random holes in snow. Colours come from `LADDER` in src/skin/voxel/paint.ts.
- Structure is 0.2 m blocks and is not smoothed (`CHUNKY` in refine.ts). Small detail is 0.05 m blocks (the micro
  layer, Home only). Edges are sharp; `ROUNDED_VOXELS` stays a switch (Brian's trial of 2026-11-09 can be restored).
- No texture, gradient, gloss or outline. Shade comes from light, corner shade, the ground shade map and the eave step.
- An empty area is fixed with a real part from the kit (docs/miniature/04) or a planned value step, never with noise.

Brian's decisions for this plan (each overrides the older rule named):
- Day and dawn light on Home: sun 45 degrees up (dawn 30), 40 degrees round, Neutral tone mapping, exposure 2.2
  (dawn 2.0), haze fitted per shot, shadow box fitted per shot, shadow radius 2. Overrides the day values in
  "Brian's light limits". Approved: ____
- Solid snow in front of z = -16. Overrides "the snow's texture stands" there. Approved: ____
- Chunky structure: ____   Sharp edges: ____   Animal colours: ____   Barn table palette: ____
- Dusk and night light: unchanged unless recorded here: ____

Unchanged and still binding: every wendigo rule; the paddock shot draws today's light, haze, tone mapping, exposure,
shadows and tilt-shift on every tier; nothing behind z = -16 changes; no cube of the country or the land is added or
removed; one branch and one pull request per milestone, reviewed by Kai; the full gate runs once, at the end.
```

## 7. Decisions for Brian

Each has a default. The plan runs on the defaults unless you change them. Pairs of pictures for each arrive at the milestone named.

| # | Decision | Default | Other choice | Pair arrives |
|---|---|---|---|---|
| 1 | Home's light by day and dawn moves outside your light limits: sun 45° up (20° today), exposure 2.2 (1 today), Neutral tone mapping, haze and shadows fitted per shot | **Yes** | Keep today's light. Then the wide views stay grey and the plan's colours will look dull | M1 |
| 2 | Chunky structure: the farm's models are shown as their 0.2 m blocks on every device, not smoothed (phones already show them this way) | **Chunky** | Keep smoothing on computers, with the grain removed | M2 |
| 3 | Sharp edges: the rounded-edge shading you asked for on 9 November is turned off. It stays a switch | **Sharp** | Keep rounded | M2 |
| 4 | Solid snow: the painted snow texture is replaced by solid colours, clean stepped drifts and whole caps. This overrides "the snow's texture stands" | **Solid** | Keep the texture on the ground only | M2 |
| 5 | If thinner haze makes the wendigo easier to see on a wide shot | **That shot keeps today's haze** | Accept it | M1, only if it happens |
| 6 | Animals: colours no longer desaturated, with value steps (legs a step darker than bodies). Shapes unchanged | **Yes** | Leave animals exactly as they are | M6 |
| 7 | The barn table takes Home's palette (it is the same barn Home shows) | **Yes** | The table keeps its colours and loses only the speckle | M2 |
| 8 | Light at dusk and night | **Unchanged** | Fitted haze only, or the brighter tested option (file 02, section 5) | M2 |

## 8. Run order

M0 inventory → M1 light ■ → M2 solid colours ■ → M3 micro system and the proof corner ■ → M4 micro round the barn → M5 yard and country → M6 animals and season ■ → M7 other scenes ■ → M8 finish.

■ = stop and wait for Brian. File 08, section 1 has the table. M3 is the first point at which the finished look can be seen in one shot (the doorway); if it is wrong, stop there.

## 9. What this plan could not verify

1. **The working tree.** v0.8.3 is not pushed, so every file name, constant, coordinate and count here is from v0.8.0. M0 exists for this.
2. **The finished look.** The light was measured on the real game. The solid colours, the micro layer and the ground shade were not rendered in the game; no mockup of this exact plan exists yet. The pairs at M1, M2 and M3 are the proof.
3. **The cost of the ground shade map** in the voxel material, and of the micro layer after merging. Both have budgets and a stop rule.
4. **Whether the wendigo check's rays test the farm's own cubes.** So the chunky change is tested and has a fall-back (file 03, section 4).
5. **The season's big tree's width.** A 1.9 m keep-out circle is assumed (file 05, section 7).
6. **A comment in `festive.ts`** says of an earlier fix that nothing the paddock shot shows may change. `CLAUDE.md` as pushed freezes the wendigo's files, place, shot and pins, not every pixel of that shot, and this plan follows `CLAUDE.md`. If the working tree's `CLAUDE.md` is stricter, M0 stops.
7. **Phone numbers** in file 02 were computed for a 390 x 844 screen.
