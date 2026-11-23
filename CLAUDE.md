## The painted-miniature look (docs/miniature/, from 2026-11-20)

The plan in docs/miniature/ is the current plan for how the game looks. It replaces docs/toybox/ (never run it: it
was built on branches `toybox/*`, which are not merged and not continued) and the diorama scenery plan.

Read docs/miniature/inventory.md and anchors.md first: the plan was written against v0.8.0, and those two files map
its names and places onto the tree as it stood at v0.8.3 (commit 6608e99). Where they differ from the plan's files,
they are the ones to use. Brian's words for the run, 2026-11-20: "execute fleeced miniature plan", and later that
day: "if this overrides stuff then treat this as the primary". So where this plan and an older rule of his disagree
(the light limits, the snow's texture, the animals' sheets, the barn's patched floor), the plan wins. The wendigo's
rules are not older rules in that sense: the plan itself keeps them, and so does he.

Standing rules from it (docs/miniature/01-target-look.md has the full text):
- One part, one colour. Parts that touch differ by one step of the material's ladder. Nothing random per cube:
  no random tone, no grain, no random holes in snow. Colours come from `LADDER` in src/skin/voxel/paint.ts.
- Structure is 0.2 m blocks and is not smoothed (`CHUNKY` in refine.ts). Small detail is 0.05 m blocks (the micro
  layer, Home only). Edges are sharp; `ROUNDED_VOXELS` stays a switch (Brian's trial of 2026-11-09 can be restored).
- No texture, gradient, gloss or outline. Shade comes from light, corner shade, the ground shade map and the eave step.
- An empty area is fixed with a real part from the kit (docs/miniature/04) or a planned value step, never with noise.

Brian's decisions for this plan (each overrides the older rule named). Each is the plan's default (README, section
7), approved by his instruction of 2026-11-20 that the plan is the primary; he has not yet answered a pair one by one:
- Day and dawn light on Home: sun 45 degrees up (dawn 30), 40 degrees round, Neutral tone mapping, haze fitted per
  shot, shadow box fitted per shot. As built the exposure stays 1 with the sun at 2.4 and the fill at 1.4 (dawn 2.05
  and 1.2), not the plan's 2.2: a higher exposure whitened the sky, the haze and every lamp on this tree
  (docs/miniature/review/M1-light.md). Shadow radius 2.5, the tree's own. Overrides the day values in "Brian's light
  limits". Approved: 2026-11-20
- Solid snow in front of z = -16. Overrides "the snow's texture stands" there. Approved: 2026-11-20
- Chunky structure: chunky. Sharp edges: sharp. Barn table palette: Home's, with the plan's flat straw floor. All
  2026-11-20.
- Animal colours: not desaturated, with the plan's value steps (belly, legs, ears and tail a step under, the head a
  step over; `VALUE_STEPS` in voxel/animals/rig.ts turns the steps off). Overrides "animals match his sheets
  one-to-one" for colour steps only: every shape and every part's base colour is still his sheet's. 2026-11-20
- Dusk and night light: unchanged.

As built, M0 to M8, on 2026-11-20 (each milestone's notes, deviations and pairs: docs/miniature/review/M<n>-*.md;
the numbers: docs/miniature/numbers.md). What a later change must know:
- Colours: `solid(material, step)` for scenery, `shade(hex)` for animals, garments, bombs and the trophy (their own
  colours with nothing taken off; `lin` still desaturates and is what the small scenes and everything behind the line
  use). The animals' parts take the plan's value steps through `step` and `stepHex` in voxel/animals/rig.ts, laid over
  the colours of Brian's six-view sheets; a step never goes under the palette's floor or over its part's saturation.
- The micro layer: `scene/farmMicro.ts` (`MICRO_PLACEMENTS`, eight clusters, the rules of a place in `breach`), the
  kit in `voxel/microKit.ts` (closed: ask before adding a kind). A placement that lands in a cube of the yard or the
  farm, in the wedge or the paddock, on the lane, or within its distance of an animal, the season's tree, a present or
  a prop throws while the farm is built. Photograph a cluster with `node tools/miniature/shots.mjs cluster <name>`.
- The ground's shade map: `voxel/groundShade.ts`. A model tells it what stands where with `noteShade` as it is built;
  only Home and the barn table read it. Its strength is the plan's stated result (0.75 at a wall's foot), not the
  plan's shader line, which gave 5%.
- The review page: `?preview=mini&piece=<name>|sheet=kit|sheet=home` (development only).
- Not done, and waiting on Brian: the plan's recolour of the land's trees, scrub and wall in front of the line
  (file 05, section 9). The wendigo's pins hash the countryside's colours, so it fails `check.ts --only wendigo`.
- Where the farm of 0.8.3 differed from the plan's v0.8.0, objects were moved the least that clears and each move
  is written beside its line in `MICRO_PLACEMENTS` and in the milestone's notes (the bale stack at the work corner,
  the east track round the court's fence, the farmhouse turned east, no woodpile, the tractor in no shot).
- The size budget was raised by 6,000 bytes in M3 (scripts/check-bundle-size.mjs).

After the plan, 2026-11-20 (Brian, looking at the result: "the scenery and aesthetics are nearly perfect, but theres a
lot of glitchy textures and a ton of just strange empty space"; branch `miniature/m9-lively`):
- A game goes on inside the barn on Home (`table/BarnGame.tsx`): six sheep round the pile, the letter board, the bomb
  passed on every few seconds. Seats are `HOME_GAME` in scene/layout.ts; the place by the doors is the player's.
  It replaced the one sheep in the doorway ("a randomly placed sheep in the barn").
- The hero looks at the pointer and turns its body past what its neck allows (`Hero` in table/FarmBackdrop.tsx). It
  hops once when the profile plate is hovered and goes back to standing.
- A happy face no longer covers an eye one row tall (`lidsAndBrows` in voxel/animals/rig.ts): every sheet animal's
  eyes are one row, and the lid hid them whole ("they just become whited over").
- The paddock holds the cow, the goat and the horse, each with its face to the paddock shot, on a bed of straw
  (`paddockBed` in scene/farmstead.ts); the sheep and the second cow are in the pasture with the flock, which a
  sheepdog minds (`LIVESTOCK`, `FLOCK_DOG` in scene/livestock.ts).
- No seams or gaps between the barn's boards, outside or in: lines one cube wide crawled as the camera moved.
- The paddock shot's own light was the old one (a wendigo rule) until 2026-11-21, when Brian lifted that part: "brighten the
  entire thing ... make it match the lighting of everything else". It now takes the other shots' light, sky and fog
  (`PADDOCK_OLD_LIGHT` in src/skin/look.ts, false; true restores the old light). It keeps its tier exemption (shadow
  map, bloom and tilt-shift on every tier), and the wendigo's geometry, stand, cone and rays are unchanged.

Unchanged and still binding: every wendigo rule; the paddock shot draws today's light, haze, tone mapping, exposure,
shadows and tilt-shift on every tier; nothing behind z = -16 changes; no cube of the country or the land is added or
removed; the wendigo's pins as they stand at 6608e99 are the frozen ones; one branch per milestone
(`miniature/m0-inventory` …), local commits, no push or pull request until Brian says; the full gate runs once, at
the end.

## The visual overhaul (Brian, 2026-11-16) — read this first
Requested by Brian of the whole painted game: "especially the animal models good lord", "you can completely remake the
scenery if needed", and, after a friend's report of about 10 fps, broken-looking assets and 35% of a battery in five
minutes, "make sure everything is optimized". The plan is docs/visual-overhaul/ (00-README-SUMMARY.md first; the full
text of this entry, the questions and the conflict register are in 19-decisions-and-conflicts.md).
- READ THIS FILE TO ITS LAST LINE with the Read tool, in chunks. You are shown only its start; the newest rules are at the end.
- Precedence: this file wins over the plan, except the points listed under "Supersedes". A disagreement not listed
  there: stop and ask Brian. Do not choose.
- Settled, do not reopen: the wendigo is not touched; Counting Sheep is seen side-on "like the dinosaur game"; the sack
  opening keeps the fair machine; shadows and tone mapping change only where a before-and-after Brian has seen shows a
  real improvement. No rule, timer, bot, score, word list, network message or saved-data format changes.
- Supersedes, and nothing else: (a) "V5.1 is the final animal plan" and "Change an animal only when Brian names it"
  (2026-11-07): animals change by plan file 03 (shape switch, then species changes Brian ticks); what he asked for by
  name that day stays the default (2 x 2 eyes, the pig's plates, the cow second only to the horse with its eyes clear of
  its spots, the chicken's head). (b) V4.1's dream camera, the 32 gates of tools/dreamGate.ts and the framing tests in
  src/skin/dream/__tests__/stage.test.ts: the dream is side-on by plan file 09; everything else about the dream stands.
  (c) How the farm, yard, barn floor, ice and dream scenery are laid out and dressed, inside plan files 04 and 18.
  (d) "Never modify existing tests", for this work only, by the list below. (e) For the record: "no bloom" (line 36) is
  stale; V3.1 approved ACES, one shadow-casting sun and bloom, and the game runs them.
- Everything else in this file stands: every interface decision, the floating letters, name plates and bubble, Word of
  the day, plain cards and switches, the loading doors, the fair machine, the bomb (icy, on the floor, digits, eight
  models, red={false} at the barn), bursts as acts, the lobby and pen, leaderboards in the sky, the podium, the menu rows,
  his avatar heads, the light limits (fill <= 0.58 by day, 0.62 at night, exposure 1), the snow's texture, and the
  rounded-corner trial (ROUNDED_VOXELS stays a switch; every model must look right both ways).
- Wendigo zone: no diff ever in src/skin/table/Wendigo.tsx, wendigoPose.ts, WendigoPreview.tsx, public/models/wendigo.glb.
  WENDIGO_AT, POV_SHOTS.desktop[2] and POV_SHOTS.phone[2] stay. isClear reads a frozen copy of today's fourteen sight
  lines. The 12 m stand is voxel-identical, the view cone from the paddock camera is hashed, sight rays stay 134/136/137
  of 153, the magenta mask matches (IoU >= 0.98). On that shot light, fog, tilt-shift and tour are today's on every tier.
- Approved changes outside src/skin, and only these: vite.config.ts (CSP: drop the two Google font hosts);
  src/config.ts (one constant, FESTIVE, beside UPDATE_NAME); package.json (scripts and version); tools/ (new gate,
  scene, wendigo and bake-stamp tools); e2e-painted/ (new); .github/workflows/ (new painted.yml; npm run size in
  deploy.yml); public/fonts/, public/boot-check.js, public/wotd-notes.json (if question 9 is yes),
  and re-baked pictures in public/shop, public/shop/stall, public/tour, public/play, public/og.png; docs/visual-overhaul/,
  docs/skin/overhaul/; CHANGELOG.md. A new saved key, sap:gfx, is a device cache, not player data. Anything else: ask.
- Tests that may be replaced, each only in its milestone: adaptiveDpr.test.ts (2); a ticked species' SHEET ranges in
  src/skin/voxel/animals/measure.ts (6); stage.test.ts framing and the 32 dream gates (9); the meaning and example lines
  of src/skin/wotd/__tests__/wotd.test.ts, only if question 9 is yes (1). Never replaced: anything under src/engine,
  src/dream, src/state, src/lib, server, e2e; primitives.floating, refine, zfighting; connectivity, face-rule, root and
  garment checks; animalPose, loungePose, legJoins; bombSkins, burstActs, sacks, tour, boards, festive, uiAudit,
  kitContrast; any budget, except downward. The gate checks vitest's JSON: no other test may vanish, skip or be renamed.
- How it runs: milestones 0 to 12, one branch and one pull request each, reviewed by Kai, changelog line and version
  bump; never a push to main. Done means CI's gate and smoke checks are green (plan file 16).
- Answers so far (file 19 section 2), each as Brian chose it on 2026-11-16 before milestone 0: question 11 (has Kai agreed
  to the overhaul and to reviewing each milestone's pull request?) "Yes, Kai agreed"; question 9 (may the word of the
  day's meanings and examples move to public/wotd-notes.json?) "Yes"; question 10 (replace exactly the tests listed
  above, each only in its milestone, and no others?) "Approve the list".
- Face sheet (plan file 03, 4.11), Brian's ticks on 2026-11-17: goat, horse, chicken and "cow: drop glint" ON
  (GOAT_MOUTH, GOAT_HORNS, HORSE_NOSE, HORSE_EYES, HORSE_NECK, CHICKEN_TAIL, COW_NO_GLINT); pig no face change; the
  sheep's fleece and eyes "whatever the plan says", which is fleece A (today's) and 2 x 2 eyes (SHEEP_FLEECE and
  SHEEP_EYES stay false).
- Bundle size, Brian on 2026-11-17 (during milestone 9): first "Slim framer-motion in src/ui"; that saved nothing
  (LazyMotion needs domMax for the classic toasts' `layout`, +0.18 kB), and the 14.4 kB domAnimation version drops the
  classic toasts' slide. Asked again, he chose "Raise the limit instead": src/ui stays fenced and untouched, and the
  size limit (scripts/check-bundle-size.mjs) is raised when a milestone needs it, said in that pull request.
- Changed by Brian on 2026-11-16, during milestone 0 ("close the stupid tests and all that, we can test it all at once
  at the end in that case. get done with the milestones"): the gate is not finished and is not a condition of any
  milestone. What was built stays in tools/gate, tools/scenes and e2e-painted, unverified as a whole (the gate has never
  run green and docs/visual-overhaul/RATCHETS.json holds only the size limit), for one test pass at the end, in milestone
  12. Until then a milestone is done when the type check, `npm test` and the build pass; the Painted workflow runs only
  by hand; and work goes on to the next milestone without stopping, except where the plan needs a choice only Brian can
  make. Still in force: skin-only, the fenced folders, no new dependencies, no banned names, never a push to main.

## The diorama scenery (Brian, 2026-11-18) — plan: docs/diorama/PLAN.md
Requested by Brian: the game's scenery should look like his reference sheet (docs/diorama/reference/): clean
micro-voxel models, flat matte colours, no texture or outlines, chunky blocks for structure and tiny blocks
for detail, soft light. No interface, behaviour or animal changes.
- Supersedes for scenery only: "One level of detail for the scenery" (2026-11-07: the refine step); V3 Part 4.1's
  grid table (replaced by the plan's size ladder); per-voxel tone picks for scenery. If question 2 is yes, also
  "Snow with a little texture" (2026-11-08).
- Everything else stands, the wendigo zone above all.
- Milestone D0's pieces: the palette and ladder (src/skin/scene/style/palette.ts), the kit and recipe format
  (style/kit.ts, style/recipes/), the style lint (scene/__tests__/style.test.ts), the pages ?preview=prop, props and
  palette (style/PropPreview.tsx, development only), and tools/propMatch.mjs (proven on a throwaway recipe: 100% against
  its own renders, and it fails a changed shape and colour). The baseline is docs/diorama/BASELINE.md.
- Brian's farm picture (docs/diorama/reference/farm-34.png, farm-views.jpg; 2026-11-18: "the scenery should look more
  like this") is the look. Done toward it so far, ahead of the plan's order because he asked: flat colours everywhere
  (no per-voxel `pick`, no refine grain, plain snow, even snow caps; `pickBy` only for a whole board, plank or bale);
  the tiered pine (scene/style/pine.ts) in the yard, the pen and the forest; fog 0.006 and no tilt-shift (look.ts); the
  barn's rounded gambrel roof with one blanket of snow (farmstead.ts); Home's two sheep shots (computer 3 and 6) pulled
  back (2026-11-19: "why did u zoom so much in on the sheep ... its a little unsettling").
- The wendigo's zone and this work (Brian, 2026-11-19, asked whether scene/countryside.ts may change: "yes, remodel"):
  outside the zone the countryside is remodelled; inside it (scene/wendigoZone.ts: 17 m round the wendigo, and the
  paddock camera's line to it) every voxel is built as before, through `asBefore` (voxel/palette.ts). The pins'
  countryside total was recorded again on that day (tools/scenes/wendigo.pins.json, `pinned.again`); the stand, the
  cone and the rays are the numbers of 2026-11-16 and must stay so. The paddock shot keeps its fog and tilt-shift.
- Every limit but the wendigo's is lifted (Brian, 2026-11-19: "disregard all prior limits besides what i said about
  touching the wendigo. dont touch the wendigo unless i explicitly say to. continue remodeling"). So the light limits,
  "never modify existing tests" (but the wendigo's own: wendigoFence.test.ts, the pins' stand, cone and rays), the
  tour's cameras (but index 2) and where things stand are his to have changed; the wendigo zone rules above all stand.
  Built that day (0.8.2), from his words in the same message:
  - "the sheep are glowing. either match the scenery to that glow or tone down the sheep glow": one soft shading for
    every voxel, scenery and animals alike (`STUDIO` in voxel/material.ts: wrapped light and a little fill), and no lit
    voxel is ever brighter than white (`SHOULDER`, under `BLOOM_THRESHOLD` in table/Rendering.tsx), so only what glows
    of itself blooms (lanterns, bulbs, the farmhouse's panes). The light is `DIORAMA` (Rendering.tsx): a bright key, a
    strong sky fill, white snow, Neutral tone mapping (look.ts); the barn's inside at the table takes `INDOOR_FILL` of
    the fill so the lanterns still shape it; the doorway lamp is cut by day (`DOOR_GAIN` in FarmBackdrop.tsx). The
    paddock shot is drawn as it always was: `exemptShot()` switches the light, fog, tone mapping, bloom threshold and
    plain Lambert (`scene.userData.plainLight`) for that shot alone.
  - "everything is without texture ... the ground of the barn is literally just... a flat yellow rectangle": texture
    comes from what a thing is made of, in shapes far larger than a voxel, never voxel by voxel (voxel/texture.ts:
    `patches`, `banded`, `course`): straw and planks on the barn floor, drifts in the snow, packed snow on the path,
    drilled rows in the field, boards and courses on walls. Still no speckle.
  - "everything should feel more intentionally placed and well put together instead of a bunch of randomly assorted
    buildings": the forecourt's fence runs from the hen run's outer corner to the paddock's and back to both pens
    (`YARD.fence`), in the pens' own make; a path with low banks runs from the doors through the gate to the
    farmhouse step; pines stand in groves (`YARD.pines`, each with its height); the woodpile leans on the farmhouse,
    the bird table is in its garden, a bale stack is in the forecourt, the tractor is parked at the back where the
    barn hides it from the paddock camera (`FARM.tractor`); the farmhouse is rebuilt (clapboard, timber, stone, panes
    in their own glowing mesh, `yard.panes`). One string of lights a building, none on fences, pond, silo or tractor.
    Outside the wendigo's zone the open ground has no drifts, twigs or dead grass, and roofs carry one even blanket.
    (The fence, the path, the groves and where the farmhouse, the pond and the bales stand were laid out again later
    that day: the next bullet. What is said here of their make still holds.)
  - `isClear` (countryside.ts) answers as it did at the freeze and reads the yard of that day (`FROZEN`); what the
    yard has taken since, and the moved cameras' sight lines, are `taken`, which only leaves a bush or a rock unbuilt.
    Never make isClear follow the yard again: the land's random streams, the wendigo's among them, run through it.
  - "change the perspectives of the pov shifting lobby screen ... seeing a tractor isnt very pretty": computer shots 1,
    5 and 7 are the whole farm as a diorama, the farmhouse from the path, and the barn across the ice; each is aimed to
    the left of its subject because the menu has the frame's left half (homePovFrame.test.ts holds the subject to
    x 40 to 97%). Eight computer and six phone shots as before; index 2 untouched.
  - "fix the ui in the lobby screen ... 'fleeced' in all those letter blocks things doesnt fit ... the font for queue
    doesnt match ... i dont want to see random shapes or clunky blocks anywhere": Home's title is one Fraunces
    wordmark, Queue and the rows are one type (Fraunces 800 with its optical size pinned, which is why Queue had not
    matched), and the tiles, frames, snow caps, hang tags, tilted boards and middle dots are gone. `?title=b` (gold
    capitals) and `?title=c` (one carved board) are alternates he has not chosen between; their CSS ships until he does.
  - Development only: `?cam=x,y,z,tx,ty,tz[,fov]` stands Home's camera anywhere (FarmBackdrop.tsx); `?preview=pen`
    shows the lobby's pen with no server.
  - Not done, and told to him: the dream's small props and the ice's black shore pines keep their own make.
- The farmstead's layout and its snow (Brian, 2026-11-19, later: "naturalize the layout of the farm, i dont like where
  and how everything is, a lot of stuff feels out of place ... u can restructure the placement of basically everything
  in the world. also, make the natural elements more sensical, the snow on the roof for example. do some research for
  elements in general and how stuff should be shaped structurally"). Built as 0.8.3 from farm-planning and
  building-science sources (extension circulars on farmstead layout, snow-drift digests). The rules, for anything added:
  - One cluster round one court. The barn's doors, the hens' gate and the farmhouse's porch face it. The lane runs in
    from the road (+z), past the house, through the court's gate, to the barn's doors (`YARD.path`, straight on x = 0).
    The winter wind is from the west (-x): the house is upwind of the barn; the windbreak (`FARM.windbreak`, two
    staggered rows, on farmstead.ts's coarse grid) runs down the west side and turns the corner at the north.
  - Every fence starts and ends at a building's corner or a gatepost and encloses a named thing: the court
    (`YARD.fence`, run to gate to paddock), the lane's side of the pasture, the hens' run with the pig's sty on its
    north side (`FARM.run`, `FARM.sty`), the paddock. No fence stands alone.
  - Things stand where they are used: the silo against the barn, joined by its feed room; bales against the barn's wall
    by the doors; the woodshed on the farmhouse's kitchen end; the trough in the pasture at the court's fence; the
    mailbox where the lane's fence ends; the orchard (`FARM.orchard`) behind the hens; the pond (`YARD.pond`, an
    uneven shore: `pondD` in yard.ts) out in the pasture. Paths are packed snow worn straight from door to door
    (`WALKS` in yard.ts); the lane has two ruts. Pines only in the windbreak and in loose groups (`YARD.pines`).
  - The farmhouse (yard.ts): a storey and a half, ridge along z, five bays under a porch on its east side, a kitchen
    door on the gable toward the barn, a stone chimney through the ridge. `YARD.farmhouse` holds its middle and half
    sizes; festive.ts and homePovFrame.test.ts read them.
  - Roof snow is `blanket` (voxel/snow.ts): one even layer on every part of a roof flat enough to hold it, none where
    the roof drops two cells or more to the next (the gambrel's lower slope), a lip one cell out and one down over
    each edge, thinner on the windward (west) slope, none within reach of the farmhouse's chimney or under an eave.
    It goes into its own grid (`caps`), meshed with no corner shading and no edge rounding (`plain` in yard.ts), or its
    steps stripe it like ribbed metal. Low banks and drifts (the pond's shore, the eaves' berms, the lee of the
    windbreak) go there too: the refine step takes a low slab's edges off and it reads as two stacked planks. No
    banks along the lane for the same reason.
  - A pine carries snow only on the shelf each tier leaves open (style/pine.ts), never on a tier's side.
  - `TAKEN` in countryside.ts is the whole farmstead's ground: no bush, rock or forest pine of the open land stands on
    it (outside the wendigo's zone). isClear's rectangles are written out as numbers and never read the layout.
  - Computer shots 1, 4, 5 and 7 and phone shot 4 were re-aimed; index 2 untouched. The countryside total was recorded
    a third time (pins, `pinned.again`); the stand, the cone and the rays measured equal to 2026-11-16's.
  - Not done: no hand pump, kitchen garden or machine shed (the tractor is still parked out back); the far hills keep
    their terraces; the dream's props and the ice's shore pines as before.

## Painted redesign (visual layer only)

The redesign plan is docs/REDESIGN_PLAN.md. The discovery map is docs/skin/DISCOVERY.md.

### Hard rules
- This is a VISUAL redesign. Never change game behaviour: rules, timers, scoring, the pile, banking, stealing,
  penalties, traps, round twists, bots, difficulty, the word list, typo detection, networking, or persistence.
- Write new code only under src/skin/ (components, hooks, styles, assets). The only files outside src/skin/
  you may edit are the page-level switch files listed in DISCOVERY.md under "Switch points", and only to
  mount the new components behind the feature flag.
- Never edit, delete or rename any file listed in DISCOVERY.md under "Engine files (do not touch)".
- Never change the props, callbacks or return values of existing components or hooks. The skin adapts to them.
- Never modify existing tests. Add new tests under src/skin/ only.
- The old look must keep working. All new UI mounts only when NEXT_PUBLIC_SKIN=painted (or ?skin=painted).
- The words "Ghibli", "Miyazaki", "Totoro" and any Studio Ghibli film title must not appear anywhere:
  code, comments, asset names, commit messages, or image prompts. Describe the style as "painted" or "storybook".
- No new dependencies except: framer-motion. Ask before adding anything else.
- Before each milestone: read the milestone's acceptance criteria. After: run `npm run build`, the type check,
  and the test command from DISCOVERY.md, and report results. Do not report a milestone done if any fails.

### Ask first (stop and ask Brian) when
- A visual needs a game-state field that the store does not expose.
- Any change outside src/skin/ seems necessary beyond the switch points.
- A design item would require a feature change (for example a new keyboard shortcut or a new setting).
- Two instructions in this plan conflict.

## Winter barn v3: lives, freezing, high-detail voxels
- The visual and rules target is docs/REDESIGN_PLAN_V3.md. The v1 hard rules still apply, with ONE exception:
  the lives rule in V3 Part 2 is an approved engine change. Implement it in its own commit, in the engine
  files DISCOVERY.md names, with the tests V3 Part 2.5 lists, and change nothing else in the engine.
- Every 3D object is built from axis-aligned voxels on one of the grid sizes in V3 Part 4. Characters use
  0.04 m voxels. No spheres, capsules, cylinders, extruded or imported smooth meshes except the sky dome,
  the aurora plane, snow and particle points, and line edges on ice.
- Voxel objects are rendered as face-culled merged meshes with per-vertex colour and ambient occlusion
  (V3 Part 8), not as one InstancedMesh per voxel. Instancing is for particles only.
- Materials: MeshLambertMaterial with vertexColors for all voxels. No MeshStandard/Physical, no env maps,
  no bloom, no depth of field. Ice may use a transparent Phong.
- One default sheep model for every player; customisation slots are reserved, not built.
- Approved dependencies: three, @react-three/fiber (@react-three/drei only if already installed). Ask before adding anything else.
- No studio, film or director names anywhere.
- v3.3 Part 2 (game settings) is an approved engine change: one commit, the files DISCOVERY.md names plus the
  constants file and a new test file. Default settings must reproduce today's behaviour exactly.
- Bot typing preview (approved by Brian, 2026-11-04): `previewBotTurn` in reducer.ts runs the bot's own decision on a
  copy of the state for display; it must never change the game or its random stream.
- Faster turns each round (approved by Brian, 2026-11-04): the base turn is 16 s in the first round, sliding evenly to
  5 s in the last (`roundTurnMs` in timer.ts); the pile and the short-turn twist still cut it, floor 5 s. This replaces
  the `turnSeconds` setting. Bot response times scale with the round's turn length.
- Daily Hunt (approved by Brian, 2026-11-04): in the painted skin the Daily Table menu item is replaced by the Daily Hunt,
  a 2D turn-based word battle against sheep predators (src/hunt for the pure, seeded logic; src/skin/hunt for the screen).
  One run a day, the same predators and rules for everyone. The classic look and the server's Daily Table are unchanged.
- Counting Sheep (approved by Brian, 2026-11-04): in the painted skin the daily game is now Counting Sheep, an endless
  runner in the farmer's dream bubble: each fence has letters missing, any real word that fits clears it (src/dream for
  the pure, seeded logic; src/skin/dream for the canvas screen). One dream a night, the same fences for everyone. The
  Hunt stays on the menu below it; its daily version is saved on the `daily-hunt` branch.
- Hunt (approved by Brian, 2026-11-04): renamed from Daily Hunt and made unlimited: every run is a fresh random pack, and
  only the best run (most predators, then damage) is kept, in src/hunt/record.ts.
- Last sheep standing (approved by Brian, 2026-11-04): an engine rules change. No points: no pile, no bank (rejected as
  'no_bank'). Wool balls are lives (`player.lives`): running out of time costs one, none left freezes the sheep. A steal
  (a valid word in the red last seconds of another sheep's turn) takes one wool ball from the sheep on turn; a bad steal
  word costs nothing but starts a 1 s cooldown. Traps pay a wool ball. Rounds never end the game (each sheep takes
  `turnsPerRound` turns, 16 s turns shrinking 2 s a round to 5 s); it ends the moment one sheep is left unfrozen.
  Bots fumble more as turns shorten, sometimes hesitate into the red seconds, and run the clock out when they have no word.
- Painted skin is the default (approved by Brian, 2026-11-04): `isPaintedSkin` returns true unless ?skin=classic or a
  VITE_SKIN=classic build. The classic look still works and the end-to-end tests build with VITE_SKIN=classic.
- Counting Sheep resets at local midnight (approved by Brian, 2026-11-05): the dream's day key is the device's own date
  (`localDateKey` / `useToday` in src/skin/hooks/useToday.ts), not UTC, so a new dream arrives at 12am wherever the
  player is, and the home screen re-checks the date once a minute. The classic Daily Table and the server keep the UTC day.
- Faster turns, steal turns and alarms (approved by Brian, 2026-11-05), an engine change: turns follow `TURN_MS_BY_ROUND`
  (16, 12, 9, 7, then 5 s) and the faster-round twist is no longer dealt: speed is the game's own pace, not a twist.
  Steals are an event: each turn is a steal turn with `STEAL_TURN_CHANCE` (`turn.stealable`, announced by a `stealTurn`
  event); the red window and the bots' steal plans exist only on those turns, the bot on turn always runs into the red
  there, and bots act only in the window's last `STEAL_LATE_SHARE`, so a person has the first go at every announced
  window (the tour's turns are all steal turns, silently; in practice the game's first bot turn is one, so stealing is
  met early). The painted skin announces faster turns, twists and steal turns on a
  centre-screen alarm board (`src/skin/components/Alarm.tsx`), and bots type like people under pressure
  (`src/skin/model/botTyping.ts`: the word is sent the moment it is typed, a late bot panics and spams words that are not
  words, which the table bounces).
- Quicker ramp and one clock for everyone (approved by Brian, 2026-11-06), an engine change: `TURN_MS_BY_ROUND` is
  15, 10, then 5 s (5 s off each round, then 5 s for good). Practice no longer gives the human a 25 s turn
  (`PRACTICE_TURN_MS` is the tour's alone): the clock under the letter was reading 25 on your turn and 16 on the bots',
  which looked like a glitch. The painted skin also calls every turn change on a board over the table ("Your turn!" /
  "Maya's turn") and the speaker camera stands 22° off the speaker's front instead of 35°, so the swing lands on a
  face, not a flank.
- Counting Sheep on the farm (approved by Brian, 2026-11-06), skin only: the dream is no longer a 320 x 180 pixel canvas
  in a frame but a full-screen three.js scene built from the game's own barn (src/skin/dream/DreamStage.tsx,
  src/skin/dream/stage.ts): the voxel sheep gallops on the spot along a lane in front of the barn's open side while the
  whole farm (barn, yard, farmhouse) rolls past on a 144 m ring and comes round again; fences are voxel hurdles with
  paper signs, and the HUD is the painted skin's chips, word bar and boards. The rules in src/dream/dream.ts are
  untouched (PX = 0.05 m per logical pixel). The sheep gained 'running' and 'leaping' states for it.
- Admin lock (approved by Brian, 2026-11-06): a padlock button beside the avatar on the painted Home opens a password
  dialog (`src/skin/components/AdminPanel.tsx`); one password, no username, checked against its SHA-256 in
  `src/lib/admin.ts` and remembered in local storage until locked again. Admin can play tonight's Counting Sheep as
  often as it likes (the menu item never turns into "Share dream"). A convenience lock for Brian, not a security
  boundary: the client can always be read.
- The dream looks like a dream (approved by Brian, 2026-11-06), skin only: Counting Sheep's sky and scenery are the
  sleeper's, not the yard's (src/skin/dream/DreamSky.tsx, builders in src/skin/dream/stage.ts): a violet dome with no
  horizon line, a moon three times too big with a rose halo, twinkling stars, the farm and the lane adrift with cloud
  lipping their edges, a sea of cloud and islands of snow and pines hanging at every height beyond, sheep-shaped
  clouds crossing the sky, paper lanterns drifting up from the yard, sleepy Zs from the farmhouse chimney, glowing
  motes instead of snowfall, the whole world breathing, and a soft blurred violet edge on the screen. Rules untouched.
- Six animal avatars and the admin avatar (approved by Brian, 2026-11-06), cosmetic only: the fifteen named characters
  with their packs are gone; the picker offers one avatar per animal (sheep, pig, cow, goat, horse, chicken, ids in
  src/avatars/ids.ts, portraits in src/skin/avatars/AvatarIcon.tsx). The admin avatar is Brian's own photo
  (src/skin/assets/kaiyan.png, id `kaiyan`): never in the picker, equipped and unequipped only from the admin panel,
  taken off again by Lock, and worn only while admin is unlocked. It is a flat disc with the photo on both faces
  (src/skin/avatars/PhotoAvatar.tsx): it wiggles, hops now and then and turns right round, and the picture itself is
  never altered. The server accepts the id so the others in a room see it.
- Avatars at the table (approved by Brian, 2026-11-06), skin only: the avatar you wear replaces your sheep in the
  word-chain game and on Home's farm. The animals are voxel models built to the sheep's rig
  (src/skin/voxel/animals.ts, designed from reports/Cute voxel farm animal design.md: the sheep's wedge head, eyes
  and expressions shared by all, with a height-and-neck ladder (hen 15, pig 20, goat 23, cow 27, horse 30 rows), one
  head signature each, a tail pointing a different way each, blush, split temperatures for the three pale coats and
  one knit accessory beside the signature; the body fills out a little with wool balls), so the Sheep component
  animates them with the sheep's own poses (`model` prop). The admin avatar is the photo and nothing else: a flat picture with no
  thickness (src/skin/avatars/AvatarDisc.tsx, poses in src/skin/avatars/discPose.ts) that wiggles, hops, leans and
  turns right round, never altered, no frame. The one approved exception to the voxels-only rule. Players with no
  avatar, and bots, stay sheep; other people's avatars come from the room's member list. The preview page
  (?preview=sheep) switches between the animals.
- Counting Sheep v4 (approved by Brian, 2026-11-06): the plan is docs/REDESIGN_PLAN_V4_DREAM.md. The dream is a voxel
  scene in the painted skin (src/skin/dream); the pure logic in src/dream/dream.ts keeps its behaviour (lettersAt, fenceAt,
  check, speedAt, takeoffDistance, jumpHeight, FIELD) and the screen only plays it out, in metres (PX = 0.036 m per logical
  pixel). Approved changes outside src/skin: (a) src/dream/daily.ts gains Warm Blankets, the longest streak and the
  one-night repair (V4 Part 12), with the tests V4 Part 12.5 lists; (b) src/dream/dream.ts gains `exampleWords` (hints on
  the first three fences only), the glyph row and the game's name in `dreamShareText` (V4 Part 13), with tests; nothing
  else in src/dream changes.
- The bounded dream (V4 Part 15, Milestone D5) was approved by Brian on 2026-11-07; see the note on the daily anchor below.
- Counting Sheep v4, D1 to D4 built (approved by Brian, 2026-11-07: "do plan for every decision"): the dream is the
  farmer's (src/skin/dream: stage.ts for the pure layout, world.ts and bedroom.ts for the voxels, DreamStage.tsx for the
  scene, run.ts for the run loop, DreamScreen.tsx for the HUD and results). Where the plan's metres did not fit its own
  camera, the frame targets (V4 Part 4.3) won: +x is screen-right with the camera at +z (the plan's z mirrored); the bed,
  the trail puffs and the islands are placed by the targets; the hills are low; the bedroom's wall plane is dropped;
  the puffs use 0.05 m voxels; the sheep is drawn at 0.72 m (the model is 1.3 m at scale 1). The canvas must never sit
  inside a transformed element (the swoop-in inflated its measured size). Known: draw calls run near 90 against the
  plan's 60.
- Farm animals v5 (approved by Brian, 2026-11-07): the plan is docs/REDESIGN_PLAN_V5_ANIMALS.md. Every species is its own
  model built from its own shapes on the 0.04 m grid (V5 Part 4.1 rig), never a recoloured sheep. The shared rules in
  V5 Part 4 are binding: the eye standard (4.3), horizontal heads (4.4), smooth bodies with shaped markings (4.5),
  three signature features at most (4.7), every part attached (the connectivity test in 4.13), thin collars (4.8),
  warmth layers as lives for the non-sheep species (4.9), three tones per material and no pure black (4.10).
  The sheep model (src/skin/voxel/sheep.ts) does not change except under Milestone A5, if approved.
  The catalogue (src/skin/avatars/catalog.ts, src/avatars/ids.ts) keeps its ids, names and colours; the models read the
  character's colours and worn item from it. The engine, the lives rule and Lives.tsx do not change.
  Built (A0 to A4, 2026-11-07): src/skin/voxel/animals/ (rig.ts, garments.ts, worn.ts, one file per species, index.ts);
  tests in src/skin/voxel/__tests__/animals.test.ts (the plan's 4.13 list); viewer ?preview=sheep with ?cam=front and
  ?cam=speaker (the table's speaker camera); ?preview=lineup with ?silhouette=1, ?squint=1 and ?size=N for Part 11.2;
  screenshots in docs/skin/animals-v5. Deviations from the plan's letter: bodies and legs are hollowed to one shell
  to meet the voxel budget; garments are meshed with the body per level (coatCells keep the garment alone) so the
  triangle budget holds; the goat's catchlight sits one row lower (a 5-voxel iris); test 9 drives the pose function
  directly (no GL test renderer); no worn item is built yet, so every catalogue `worn` id maps to nothing; the
  silhouette acceptance (two people naming the species) was not run. Each species' drawScale is applied at the table.
- The start screen's farm and tour (approved by Brian, 2026-11-07), skin only: the home backdrop tours the farm, a few
  seconds a scene with a dip to dark between them, alternating the avatar with the rest of the place (`POV_SHOTS` in
  src/skin/table/FarmBackdrop.tsx, timing in src/skin/scene/homePov.ts). The diorama opens the tour and is the only scene
  under reduced motion; `?pov=N` holds a scene for screenshots. The barn is a cut-away stage set for the table camera, so
  everything that makes it a real farm from outside lives in src/skin/scene/farmstead.ts and src/skin/table/Farmstead.tsx:
  the whole roof, front wall, trim, silo, coop, paddock, tractor, orchard, field, livestock and the land past the yard.
  These mount only on the start screen; the table never sees them. Keep it that way: a roof over the table blocks its camera.
- Practice is a 1v1 speed run (approved by Brian, 2026-11-07), an engine change: `mode: 'practice'` is always two seats, one
  life, no rounds, twists, steals, traps, passes or hints. Score is `players[0].wordsPlayed`; the run ends on the human's first
  time-out. The bot can't end it: a fumble draws a fresh letter at once. The clock starts at `settings.practiceClock` (15, 10
  or 5) and loses a second every `PRACTICE_WORDS_PER_STEP` words, floor 5 s. Bot level is how often it aims for
  `CORNER_LETTERS` (`BOT_PROFILES[].corner`, the tuning knob). Bests live in src/lib/practice.ts, one per clock and bot.
  Start now goes to a Quick Game, since a one-life run with no hints is no first game. The classic look has no picker: it
  plays the saved practice settings.
- Practice's own place (approved by Brian, 2026-11-07), skin only: a practice run leaves the barn for a narrow spit of ice on a
  black lake at night (src/skin/scene/duel.ts for the layout and voxels, src/skin/table/DuelTable.tsx for the stage). You and the
  bot stand face to face on one line, seen side on, and stare at each other. Pressure comes from your clock: the camera pushes
  in, a spotlight on whoever is on turn burns red, the screen's edges close in red and the camera shakes at the very end. A VS
  bar replaces the scoreboard, and the bomb is the barn's own (`Bomb` in table/Bomb.tsx, with a `spotAt` prop for where it lands). The lambing pens are gone.
- First games, soft games, farm sheep and the end board (requested by Brian, 2026-11-07), a small engine change. src/lib/record.ts
  keeps finished Quick Games, the last three results and the personal bests. `tableFor` in the store gives the first three Quick
  Games the easy bots and the Quick preset until the player touches a rule or the bots (`settings.tableChosen`); Start now is that
  table, not Practice. Two losses in the last three set the hidden `settings.softGame` for one Quick Game: `botFailRate` adds
  `SOFT_GAME_PRESSURE` of `BOT_PRESSURE_FAIL`. It must stay invisible, and never reach the Daily Table or rooms. Bots carry sheep
  names and a visible "farm sheep" tag; keep them unmistakably not people. The classic end screen is unchanged.
- Fleece Navidad, v0.3.0 (approved by Brian, 2026-11-07), skin only: the update's name lives in src/config.ts (`UPDATE_NAME`). All the
  decorations are laid over the world in src/skin/scene/festive.ts and mounted by src/skin/table/Festive.tsx; the barn and yard
  builders are untouched. Every animal wears a hat from the `SantaHat` mesh in Sheep.tsx, which sits on the head and leaves the
  models alone (an exception to "customisation slots are reserved"). To take the season down, remove `<Festive>` and `<SantaHat>`.
- One level of detail for the scenery (approved by Brian, 2026-11-07), skin only. This supersedes the 0.20 m and 1 m rows of V3 Part 4.1:
  yard and farmstead objects keep being authored on their 0.2 m grid, then `detailed` (src/skin/voxel/refine.ts) halves the cell size
  and bevels the shape, so they sit at the barn's 0.1 m; the tractor goes to 0.05 m and the back hills and side land to 0.5 m. The
  yard's flat ground, the field, the windbreak, the far hills and the range stay coarse, because the camera never gets near them and
  the budget goes on what it does. Touch screens skip all of it. Scenery must read as something: no scattered blocks standing in for
  litter (the hen run's straw, trough, water pan and perch are `henYard`, built at 0.1 m).
- The season reaches every setting (approved by Brian, 2026-11-07), skin only. festive.ts dresses the yard, barn walls, pines, sled, farmhouse
  and pond (`buildFestive`), every other stop on the start screen's tour (`buildFarmFestive`), the ice and the farmer's bedroom; Counting Sheep's
  fence rails and island pines are candy striped and baubled in dream/world.ts; Hunt has CSS lights; the lobby and room screens get `<Garland>`.
  Check each tour shot after moving decorations: a bulb near a shot's camera hangs huge in front of the lens.
- The land around the farm (approved by Brian, 2026-11-07), skin only: src/skin/scene/countryside.ts, start screen only. Woods stand in uneven
  clumps, never rows; the orchard has grown out of line; drifts, scrub, rocks, dead grass, a dry stone wall and worn tracks fill the open ground.
  Everything goes through `isClear`, which keeps it off the farm and out of every tour camera's sight line (POV_SHOTS now live in scene/homePov.ts).
  Restraint with the season: one Christmas tree on the farm (by the barn doors), one in the barn, one on the ice. Pines stay plain pines.
- The start screen comes first (approved by Brian, 2026-11-07): no landing page and no forced sample round or username step before it.
  The name is typed on the start screen's name plate; signing in is the Account button there. src/skin/landing is gone.
- Counting Sheep, the daily anchor (approved by Brian, 2026-11-07), a rules change in src/dream: `DREAM_LENGTH` is 30 fences
  and 3 bumps, a first guess until the plan's ten-person playtest. A bump short of the last holds the sheep 700 ms and
  knocks the fence flat (it counts as reached, not as a sheep); the last bump wakes the farmer; the last fence puts him to
  sleep. Practice stays endless and ends on the first bump. Pace is the offline dinosaur's: `Fence.gap` is now a distance
  in logical pixels, about 400 to 480 whatever the speed, and `speedAt` rises to 110, so the time per fence falls from about
  7 s to 5 s across a night. `TYPE_X` is a whole gap ahead so the speed, not the window, sets the time to type. Hay bales
  (`obstacleAt`, `lettersFor`) start at fence 8, stand 170 to 200 px behind the fence before them, ask one or two letters,
  and may come two at a time from fence 18, never three. Existing tests for the old gap, the letter counts and `TYPE_X`
  were changed for this. The share text gains the link and each bump in place.
- Counting Sheep v4.1 (approved by Brian, 2026-11-07): docs/REDESIGN_PLAN_V4_1.md supersedes v4 Parts 4 to 6; v4 Parts 7 to 15
  still apply. The dream scene is built in the order E0 to E5 and each milestone ends at the gate in V4.1 Part 10, measured by
  tools/dreamGate.ts; a milestone is not done until every gate number passes. The bedroom is a separate small canvas
  (V4.1 Part 7), never an object inside the dream scene. Grid sizes in the dream: 0.04 m the sheep and the farmer; 0.10 m
  fences, signs, lane details and the bedroom; 0.20 m the raft, its cloud ridge, the cloud sea and the islands; 0.5 m the
  hills; 1 m the mountains (the dream looks straight at its distance, so it uses finer far grids than the barn). The
  on-screen size limits in V4.1 Part 5.3 apply. Pure logic in src/dream is unchanged; PX = 0.036 m.
- V4.1 as built, E0 to E5 (2026-11-07): `npm run dream:gate -- --base <dev url> [--phone]` passes 32 of 32 at 1920 x 1080 and at
  390 x 844. Where the plan disagreed with itself the frame targets and gates won: every z is mirrored (camera at +z, as v4);
  L is Rec. 709 on the stored sRGB values and saturation is HSV, or the plan's own colours fail its table; the scene is
  sampled with the HUD hidden, because (50,9) and (50,15) lie under the board; lights are 4.5 and 1.7 and the hemisphere's
  ground colour is pale (the plan's are in old light units, and its dark ground turned shaded sides navy); the aurora is
  0.07, not 0.30; the sky's stops are set by elevation and the stars sit in the sky the camera sees; islands are sized from
  their on-screen boxes; the third puff moved off the sheep's hooves (`PUFFS`); the wood has a warm tint; the phone camera is
  solved from the plan's targets, with its own island boxes, fog, light side and a coarser sea. Grids finer than the plan,
  for how they look at this camera: the near ridge and the islands are 0.10 m, and the farmer's head is 0.02 m (its features
  need a head 15 voxels wide). Known: 65 draws on desktop and 67 on a phone against the plan's 60; frame time is unmeasured
  (software rendering only); the two-person read test (Part 11) has not been run.
- Counting Sheep, easier and in theme (approved by Brian, 2026-11-07), a rules change in src/dream plus skin work: `lettersAt` tops out at
  3 (4 and 5 left fences with no ordinary word) and a bale asks 1; `fenceAt` rerolls until `MIN_FITS` of `FENCE_WORDS` fit and never
  uses j, q, v, x or z; signs read `R…N`, because the letters may have anything between them, and `hintWord` offers a word after
  3.2 s. `JUMP_MS` is 720, and a fence the sheep took off for cannot bump it (at a low frame rate a right word was being punished).
  Obstacles cross the lane (`obstacle`, `lookOf` in src/skin/dream/world.ts: rail, picket, wall, log, round bales, on a 0.05 m grid;
  the look is cosmetic, the rules only know fence and bale). Scenery on the far strip is real things on 0.05 m, not specks,
  overriding V4.1 Part 5.2's size limits. The dream has its own UI kit at the end of dream.css (`.dr-card`, `.dr-btn`, `.dr-board`):
  night indigo, cloud rims, moon gold, quilt patches. Everywhere else, a dialog is paper in a snowy wooden frame (`.sk-framed`
  and the shared selectors at the end of skin.css), and the tally is planks on ropes. Hunt keeps its handheld look on purpose.

- The farm kit (approved by Brian, 2026-11-07): docs/REDESIGN_PLAN_V6_UI.md. Every surface in the painted skin is one of the
  kit's materials (V6 Part 4): plank, paper, tile, slate, burlap, knit, rope, brass, peg, lever, ice, clipboard, panel.
  No surface is a shape: no gradient used as a colour (gradients exist only inside kit materials, as grain, weave or
  chalk), no rounded corner over 4 px except pegs, pins, ice and the slate's inner edge, no blur-only shadow, no emoji
  as an icon, no Tailwind colour, radius or shadow utility in src/skin. The audit in src/skin/audit runs with
  `npm test` against a budget that only goes down; a screen with a non-kit surface is not done. A sign that is read
  every turn (the letter over the table, the dream's fence signs, the sheep's name stakes) is a voxel object anchored
  in the scene (V6 Part 5), never an HTML box floating over it. src/skin/hunt keeps its handheld-console look.
- Counting Sheep, one life (requested by Brian, 2026-11-07), a rules change in src/dream: `DREAM_LENGTH.bumps` is 1, so the
  first bump wakes the farmer and ends the night. The hint never offers a word already used tonight while an unused one
  fits. The fence signs and the table's letter board cut their letters from the display face (Fraunces) on a 0.02 m grid
  (`letterMask` in src/skin/voxel/table.ts), painted cream; the 5 x 7 bitmap is only the fallback before the face loads.
- Faster dream, more room (requested by Brian, 2026-11-07), a rules change in src/dream: `speedAt` runs 85 to 160 (was 58 to 110),
  fences stand 560 to 650 apart and bales 230 to 270 behind (were 400 to 480 and 170 to 200), and `TYPE_X` is W + 330, so a fence
  still opens a whole gap ahead and each word gets about the same time while the world rushes past faster. The dream sky has
  shooting stars (one at a time, every 6 to 14 s, none under reduced motion or in the gate's `?dreamSeed` runs).
- Floating letters (chosen by Brian from five mockups, 2026-11-07): the table's and the dream's word bars have no box. What the word
  needs on a line above, the typed word in big white Fraunces letters with a glow in the scene's shadow colour, a dotted line, and a
  small key that says what Enter does (`.kit-float` in kit.css). The old troughs are gone.
- Farm animals v5.1 (approved by Brian, 2026-11-07): docs/REDESIGN_PLAN_V5_1.md is the final animal plan. The proportion
  sheet (V5.1 Part 4.1), the connection rules (4.2), the face rule (4.4: every mouth, lid and brow voxel sits on a head
  voxel; chewing never leaves the head), the neck channel (4.6) and the animation ranges (6.6) are binding for every
  species, the sheep included: the sheep's head is rebuilt under V5.1 Part 5.1 (this supersedes "the sheep model does not
  change"). The tests in V5.1 Part 7 are part of `npm test`; a model that fails one is not done.
- V5.1 as built, F0 to F5 (2026-11-07): src/skin/voxel/animals/measure.ts and tools/animalReport.ts measure Part 4; the tests
  are src/skin/voxel/__tests__/animalsV51.test.ts and src/skin/table/__tests__/animalPose.test.ts; ?preview=strips with
  tools/animalStrips.mjs saves the strips; the report and pictures are in docs/skin/animals-v5_1. Where the plan disagreed
  with itself, the ratio table won over a sheet's letter, except one row: the muzzle ratio (4.1) for the cow, horse and goat
  cannot be met by any neck that follows 4.2.1, so their sheets win (1.10 to 1.30, Brian to decide). Solving the table moved
  numbers: the horse's torso is 13 x 14 x 26 voxels and its head 7 x 8 x 13; the goat's torso 13 x 13 x 20; the pig's torso
  is a row taller and its head two rows higher, with no separate neck wedge (the head and shoulder already overlap); the
  chicken's torso is 9 rows, its head centred at z 0.42; the sheep's back is a row taller, its corner lobes half a row lower,
  its leg shaft a row shorter (0.28 m shows), its nose on rows 17 and 18 (not 15 and 16, the mouth's row). Belly lines follow
  4.5's shares (the pig's 0.40, not 0.34). Collars, bands and scarves trace the neck's own outline, so none floats off a
  sloped neck. Hollowed shells no longer draw their cavity's faces (`addCavity`, the mesher's `all` set), and a coat is
  hollowed with the body it covers: this is what keeps the longer bodies inside the budgets. The beak is drawn with the
  chicken's head so both wings fit the three signature slots (v5 dropped the right wing). The worn avatar runs Counting
  Sheep at its draw scale; the admin's photo disc dreams as the sheep. Known: the two-person silhouette test was not run;
  an animal in the dream costs 6 to 8 more draws than the sheep.
- Small simple eyes and a bigger cow (requested by Brian, 2026-11-07): the sheep, cow, horse and goat have beady eyes,
  2 x 2 and dark with no whites (`smallEyes` in rig.ts), a white glint where the face is dark enough to show it (the
  sheep, the horse, and the cow on its slightly darker coat): on the face's front for the sheep and the cow, on the head's sides for the horse and the goat. This
  replaces V5.1's plates on those four; the eye-height row of the ratio sheet is 0.20 for them. The pig keeps its plates.
  Change an animal only when Brian names it. The cow is drawn at 1.2 (`drawScale`), its back at 1.06 m, bigger than the goat and second
  only to the horse; grown in voxels instead it would break the 3,200-voxel budget.
- The chicken's head (requested by Brian, 2026-11-07): it rests nearer the breast (its centre at z 0.34, a row lower), a
  short neck still reaching forward; the beak is a two-step wedge that reads from the side; the wattle is a 2 x 2 lobe
  under the chin; its eyes are the small ones too. Its beak ratios in measure.ts are its own (reach 0.6 to 1.0, head with
  beak 1.0 to 1.3 as long as wide). Small eyes are flat 2 x 2 squares: the head is filled out to one plane under them so
  none reads as an L, and they sit flush (the sheep, cow and chicken) or one voxel proud on a long head's sides (the
  horse and the goat, so they show from in front). A pale face gets no glint, which would melt into it.
- The cow's spots (requested by Brian, 2026-11-07): where the blanket leaves the coat to be seen: both lower flanks, each
  side of the neck, the rump, the chest, the back of the head and two legs. Never put its eyes in a dark patch (it hid
  them and read as a mask). Its eyes are 2 x 2, dark, with a white glint in the outer top corner, and its coat is the
  catalogue's white at 0.8 (Brian: "slightly darker than white so the contrast is shown"), so the glint stands out.
- No steals (requested by Brian, 2026-11-07: "remove the steal feature entirely"), an engine change. This supersedes the
  steal rules in "Last sheep standing" and "Faster turns, steal turns and alarms": there are no steal turns, no red window,
  no steal action, cooldown, bot steal plans, `stealWindowSeconds` setting, steal events or alarms, and no wolf at the
  table. Wool balls are lost only by running out of time and won only from traps; standings tie-break on the longest
  word. The server's steal ordering (server/steals.ts, the room hold, STEAL_ORDERING) is gone, as are the steals
  leaderboard, stat, personal best, share line and coin reward. The game_players.steals column stays for older games and
  new rows write 0. Removing the steal draws changed the seeded random stream; no seeded test depended on it.
- The ice bomb (requested by Brian, 2026-11-07: "make the bomb icier, in all aspects. also, make an animation for when
  each player receives the bomb i dont like how it jsut floats on top of them"). The bomb never floats over a head and is
  never held: each turn it is lobbed to the speaker (a fresh one drops from above), lands on the floor beside their front
  hooves on the side the turn's camera sees clear, skids, wobbles and sits there; the speaker plays `startled` as it lands
  (BOMB_TOSS_S, skipped while cold, freezing, frozen or thawing). Everything about the bomb is ice: the voxel model,
  spark and digits, the 3D burst (frost, crystals, bouncing shell chunks, sinking mist), the jumpscare and word blast,
  the hit flash, the pixel bombs and the boom sound. Keep the bomb icy, and keep it on the floor.
- The Hunt v7 (approved by Brian, 2026-11-07): docs/REDESIGN_PLAN_V7_HUNT.md. Rules that bind every change to the Hunt:
  (a) No persistent power. Nothing kept between runs may change health, damage, items, time or rules. What persists is
      records, the bestiary, the run log and cosmetics. Items reset every run.
  (b) Announced adjustments only. Nothing in the Hunt is tuned behind the player's back; anything that changes a run's
      difficulty says so on screen and is marked in the share text. (The hidden `softGame` in Quick Games is outside this
      plan and is listed as a decision for Brian.)
  (c) Same code, same pack. A pack code must give every player the same predators, rules, reserves and hint words for a
      given word-list version; the code carries the version and the game says so when it differs.
  (d) Nothing on a calendar, nothing on a server. No weekly schedule, leaderboard, account or moderation is added by this
      plan. Every feature keeps working with the server down.
  (e) Local-storage keys are promises: add fields with defaults, never migrate, never rename. New keys: sap:hunt-log,
      sap:hunt-packs, sap:hunt-bestiary. sap:hunt-best keeps its shape and gains optional fields.
  (f) The Hunt's look stays the handheld console (src/skin/hunt, .gb-*); new screens are drawn in that style.
- The Hunt v7 as built, H0 to H5 (2026-11-07; H6, the drowsy fox, is not built and waits for a month of the run log and a
  separate yes from Brian). Pure layer: src/hunt/log.ts, codes.ts, packs.ts, bestiary.ts, everyday.ts and the additions to
  hunt.ts, rules.ts and record.ts; the save code is src/lib/savecode.ts (Settings: src/skin/components/SaveCodeRow.tsx);
  the screen is src/skin/hunt/HuntScreen.tsx with its panels in panels.tsx. `npm test` covers Part 4.7 and Part 6;
  `node tools/huntCheck.mjs --base <dev url>` plays seeded packs and checks Part 10 (screenshots in docs/skin/hunt-v7).
  Where the plan's letter did not fit: YES and NO words come from an everyday list first (src/hunt/everyday.ts), because
  the rarity heuristic lets obscure words through, and the search for a YES word that obeys all of a predator's rules
  goes to 4,000 candidates, not 400 (400 missed about one rule set in thirty); the death screen's word prefers an
  everyday word too (`everydayWord`, else `hintWord`); the lobby's best and last-pack lines sit in a name box at the top
  right, since the 38 px bar has no room under the menu; the code line sits under the predator's name box; the walk-home
  and leave questions are a box over the stage with their buttons in the bar; the results card gains BACK (to the death
  screen) as a fifth equal button; "Has a M" now reads "Has an M". Under reduced motion the announcement keeps its full
  reading time. Decision 9.12 (the hidden softGame in Quick Games) is still Brian's.
- More twists (requested by Brian, 2026-11-08), an engine change: round 1 stays plain, and every later round has a twist
  (`modifierForRound` in game.ts cycles the shuffled deck after its plain opener; a twists-off deck stays plain). Five new
  word twists join no E, 6+ and double letter in `ALL_MODIFIERS`: no A, no S, 5 letters max, end on a vowel, needs an O.
  Each one leaves every letter a legal word can end on with legal words in public/words.txt (src/engine/__tests__/twists.test.ts).
  The longer deck shifts the seeded random stream after it.
- Name plates and the speech bubble (requested by Brian, 2026-11-08): the name stakes and the seconds slate under the letter
  board are gone. Each seat's name stands over its animal's head on a knitted plate (the ledger's dark wool, berry for the
  speaker), anchored every frame by `ScreenAnchor ... above` (src/skin/table/Anchors.tsx, `nameplateY` in BarnTable.tsx).
  The word being typed, yours or a bot's, shows in a cream wool speech bubble over the speaker's plate, and yours also
  in the floating letters at the bottom, as in the dream (put back 2026-11-08: "it should be additional to the typing
  shown"). The ledger and the round tab no longer hang on ropes; the round's
  twist is stitched onto the round tab in the top-left corner.
- Lofi music and the sound menu (requested by Brian, 2026-11-08; no noise sources since "why is there static noise"): src/audio/music.ts plays a lofi loop made live with Web
  Audio (no audio files): electric piano on Fmaj7, Em7, Dm7, Cmaj7, a round bass, a swung kit, the odd pentatonic note,
  a soft rim and tick for drums, a warm wobbling low-pass, 72 bpm. It starts with the first tap or key press. The speaker button (Home
  and the table) opens the sound menu (src/skin/components/SoundMenu.tsx): game sounds and music, each with a lever and
  a volume; `sap:muted` and `sap:volume` are the game's sounds only, `sap:music` and `sap:musicVolume` the music.
  Settings no longer has sound rows.
- Admin "Skip to the end" (requested by Brian, 2026-11-08): the admin panel deals a game and jumps to its results (a
  Quick Game won or lost, or a practice run over) via src/skin/admin/endPreview.ts. The finished game is set straight
  into the store, never played through the reducer, so nothing is recorded.
- The winning screen (requested by Brian, 2026-11-08): at a game's end (not practice) src/skin/table/Podium.tsx takes the
  screen, its own canvas: the top three dance on a podium in the barn (gold, silver and bronze trim), the rest dance on
  the hay either side, confetti falls, and the winner holds up a big golden trophy (src/skin/voxel/trophy.ts). Every
  place has its number and the player's name on a black nameplate in beige under it. The scoreboard comes up 5 s later,
  dark and see-through with white text (`.sk-final`), and the camera eases so the podium sits beside it; it can be hidden
  (for a screenshot) and shown again. On a phone it drops the standings list, which the podium already shows.
- Faster dream, more room, round two (requested by Brian, 2026-11-08: "make it faster paced ... add more space"), a rules
  change in src/dream: `speedAt` runs 110 to 210 (2.6 a fence), fences stand 760 to 900 apart and bales 300 to 350 behind,
  `TYPE_X` is W + 520, and the first fence starts 560 px ahead (`FIRST_FENCE_AHEAD`, about 4 s before the first jump).
  The dream camera widens its view in a window narrower than the shot (a browser snapped to half the screen used to
  crop the sheep off the left). The word bar is centred. A bump no longer shrinks the scene to a square: the dream
  blurs, clouds roll in from every edge (`.dr-clouds`), and part on the bedroom.
- The victory screen, round two (requested by Brian, 2026-11-08: "remove the delay ... less basic ... numbers etched into
  the podium ... dance differently ... taller ... hay texture ... farm theme not festive theme, add in festive subtly"):
  the scoreboard is up at once (no 5 s wait). The stage is the barn: a straw floor, stacked hay bales, the red barn doors
  with their white cross, the hayloft beam with three lanterns, two lantern beams sweeping, straw and a little confetti
  drifting. Everyone stands on barn timber with their place carved into its front and gilded (the top three 1.5, 1.1 and
  0.8 m, gold, silver and bronze; the rest on 0.55 m crates). Each place has its own dance (`DANCES` in Podium.tsx); the
  winner leaps and spins. Festive only in passing: a wreath on a door and one short string of warm lights.
- The wendigo (requested by Brian, 2026-11-08, for lore): src/skin/table/Wendigo.tsx, mounted in the Home farm
  (FarmBackdrop), loaded lazily from public/models/wendigo.glb. That file is Brian's own Wendigo2.glb (kept out of git
  as public/models/wendigo-src.glb) with the ribs removed, doubled parts dropped and every piece simplified, about 56k
  triangles and 1 MB, one mesh per colour. On purpose the one thing in the game that is not voxels. The hide gets a
  mottled, veined, bumpy texture in the shader (no UVs), and two red eyes glow where the model's red eyes were. It stands
  between the pines just past the paddock (`WENDIGO_AT`), its feet put on the voxel ground by a ray down, and it is
  drawn only while the camera is at the paddock shot (POV_SHOTS index 2): from every other Home view it is not there.
  Keep it subtle. ?preview=wendigo shows it close up; ?wendigoDebug paints it magenta.
- The forest and the wendigo's pose (requested by Brian, 2026-11-08: "rearrange the trees so its more natural there, turn
  the background into more of a forest ... close its mouth ... only see it once every 4 full pov cycles"): the clumps behind
  the field are replaced by a forest (`forest` in src/skin/scene/countryside.ts) with a wandering edge, strays in front,
  clearings, and taller trees deeper in; the near rows are 0.2 m pines, the rest the same pine at 0.4 m. The countryside
  budget test is raised from 600k to 1.1M triangles for it. Round the wendigo (`WENDIGO_AT`, now in countryside.ts) the
  trees are placed by hand, and nothing stands between it and the paddock camera. Its feet go on `groundAt` (a ray down
  hit the pines' branches). The model is unrigged, so src/skin/table/wendigoPose.ts poses it on load by turning vertices
  about joints with eased weights: the jaw shut, the arms hanging close, the head lowered and cocked. It shows on every
  fourth visit to the paddock shot (the count lives as long as the page); ?pov= and ?wendigoDebug always show it.
- Harder to see, and clean pines (requested by Brian, 2026-11-08: "should not be so easily seen ... on the second layer higher
  up ... a lot of the pine trees are glitchy"): the wendigo stands up on the step to the back hills (z -36.1, 6 m above the
  field), at its lip, a dark shape among dark trunks with only a narrow gap through to the paddock camera. Every countryside
  tree is now a `forestPine` (countryside.ts): solid tiers with ragged rims, colour in patches, and snow set back from each
  tier's rim. The yard's `pine` stays for the yard; at a distance, and above all at 0.4 m, its single-voxel branches with
  snow on each became a crawling checker. Trees are planted on their own grid (the old offset put snow over needles) and
  never on the step's face (`steep`). Check with `?wendigoDebug` after moving any tree near it: their skirts are wide.
- One loading screen (requested by Brian, 2026-11-08: "make a loading screen that ties in with the theme that is applied
  to all times when you need to load"): the barn doors (src/skin/components/BarnDoors.tsx) are it. They shut with a slip
  pinned over the crack (a pixel sheep hopping a fence, and a line saying what is being got ready) and open only when the
  new screen is ready: every three.js canvas on the page has drawn (`MarkDrawn` in Rendering.tsx; every scene canvas must
  carry one, or the doors wait 15 s) and nothing holds them (`useLoadingHold`: the first Home until the farm and the land
  are built, the dream and the Hunt until the word list is in). PaintedApp shuts them for every game, practice run and
  dream, and mounts the new screen two frames later, so its build never freezes the screen being left or shows half a
  scene (the dream used to stall on Home, then show its HUD over an empty dark screen, then pop in). Under reduced motion
  they fade instead of swinging. Only transform and opacity animate on the slip, so the sheep keeps hopping while the
  page is busy. The bots' thought dots over their heads are gone (the speech bubble shows them typing).
- The Hunt is removed (requested by Brian, 2026-11-08: "remove the hunt entirely"). src/hunt, src/skin/hunt, the menu
  item, the ?pack= link, the admin panel's hunt log, tools/huntCheck.mjs, the v7 plan and its screenshots are gone, as
  are WORDS_VERSION/WORDS_HASH (only pack codes used them). Every Hunt bullet above is history; don't rebuild any of it
  unprompted. Save codes made before keep working: their sap:hunt-* records are dropped quietly (RETIRED_KEYS in
  src/lib/savecode.ts). Old sap:hunt-* keys left in players' browsers are harmless and are not cleaned up.
- The doors, refined (requested by Brian, 2026-11-08: "refine the loading screen and the animation to going into the core
  gameplay"). Going into a game, practice, the tutorial or the dream, the doors swing shut over the screen being left
  (CLOSE_MS 620, meeting at 80% with a thud sound and a jolt, the crack of light squeezed out), then the slip drops in
  with what is loading ("Setting the table", "Clearing the ice", "Whistling for the sheepdog", "Tucking the farmer in";
  "Opening up the barn" on the first load). PaintedApp mounts the new screen only once they are fully shut
  (`whenDoorsShut`), and a solo game's clock is held (`holdClock`/`releaseClock` in the store, separate from the tutorial's
  `paused`, overlap counted once) until they start to open (`whenDoorsOpen`), so the table's intro and the first turn
  play in front of the player. Before this, the turn clock was at about 10 s when the doors opened. Keys are blocked
  while the doors are up (Ctrl/Cmd/Alt shortcuts pass). The first load starts already shut (`shutDoorsAtBoot`). The
  open swing has a latch-and-creak sound. Rooms are not held: the server keeps their time.
- Security pass (requested by Brian, 2026-11-08). Rules that keep it fixed: the server is one process holding every
  room, so nothing a client sends may throw out of a handler (http.ts wraps every request; the socket's message handler
  is in try/catch; look up client-chosen keys with Object.hasOwn, never `in`). Per-address limits use `limitKey`
  (server/address.ts: IPv6 by /64) and the address comes from `clientAddress` (Fly-Client-IP, else the right-most
  X-Forwarded-For). A reviewer's ban on a player report is escalated to a person; a message is reviewed once however
  often it is reported. The admin lock is client-only, so the server alone decides who wears the admin avatar
  (moderators and ADMIN_USER_IDS). Never write the admin password into the repo, tests included. Public boards carry no
  account ids. Not done, and listed for Brian: own domain for the site, stripping rng/seed from room views, a sturdier
  chat filter for short split words, ending Supabase sessions server-side on logout.
- Word of the day (docs/PLAN_WORD_OF_THE_DAY.md, built 2026-11-08), skin only: src/skin/wotd (words.ts, pick.ts,
  WordOfDay.tsx, tests). The plan's hard rules bind it: no streak, count, reward or "come back" text; every meaning and
  example is written for the game; every word is in public/words.txt. Levels are 104 / 157 / 104, not the plan's rough
  105 / 155 / 105, because 2026 has exactly that many Mon-Tue, Wed-Fri and weekend days and its own test wants every
  word in the first year. No paper (Brian, 2026-11-08: "not a whole piece of paper, just make the text floating"): a label,
  the word and its `short` gist (32 characters at most) float in white over a dark outline and glow, readable over day
  snow and night sky alike. On a computer it stands alone on the right, level with the title (`.sk-wotd--side`), and
  gives way to the right-hand panel when one opens; on a phone it is two small lines in the 34 px strip above the name
  plate. It takes no clicks; the longer meaning and example live in public/wotd-notes.json (moved out of words.ts in overhaul milestone 1; the game never fetches them). Brian has not reviewed the 365 words yet.
  Set like a dictionary entry (Brian, 2026-11-08: "more like an actual word of the day"): "Word of the day!", the word,
  a small pronunciation (`say`, a plain respelling with the stressed syllable in capitals, written for the game, never a
  dictionary's symbols) and the part of speech (`pos`), a strand of yarn, then the gist; tilted -3° and swaying like the
  title's tiles (still under reduced motion). The update plate no longer shows the version and tilts (4° on a computer,
  -1.5° on a phone).
- The doors are voxels (requested by Brian, 2026-11-08: "make the loading screen less crappy looking ... nothing like what
  we're looking for quality wise"). The flat CSS doors are replaced by baked renders of a voxel doorway built for them
  (src/skin/loading/doorsModel.ts: planked leaves with recessed seams, the white frame and cross with worn paint, riveted
  strap hinges, pull bars, one wreath; a snowy beam with icicles; a drift). `node tools/renderDoors.mjs` (dev server up)
  lights them like the farm at night (?preview=doors&part=...) and writes public/loading/doors-*.webp (about 85 KB),
  preloaded from index.html. The loading screen stays CSS on purpose: it must draw on the first frame and keep moving
  while the farm is being built, which a live three.js scene can't. Every part has a fixed box (src/skin/loading/
  doorBoxes.ts, import-free); BarnDoors lays them out on one voxel size (`--vox`) so the beam, leaves and drift meet on any
  screen, each leaf showing its half and swinging as before. Snow falls in front (none under reduced motion). Change the
  model, re-run the tool, commit the images; the tests check the boxes and that the images exist.
- Warmer light (requested by Brian, 2026-11-08: "warmer and welcoming ... only changing the lighting, dont go too heavy ...
  a warm white christmas whilst still keeping winter vibe. rn it looks a little dark"): in src/skin/table/Rendering.tsx the
  sun warmer and a little stronger, the moon less blue and brighter (0.9), the lanterns warmer and reaching further (40,
  14 m), the day's haze a soft grey-white instead of icy teal and the night's a softer navy. The dream, the ice and the
  loading doors keep their own light. Keep the hemisphere fill low (#AEBEDA over #655F5C, 0.5 at night, 0.58 by day) and
  exposure at 1: a strong warm fill (0.75) with exposure 1.08 was tried and lit the snow's sides as much as its tops, so
  every drift went one flat grey and the voxels read as blotches (Brian: "all the snow looks completely flat").
- The loading sign (requested by Brian, 2026-11-08: "the issue isnt really the barn doors, its the paper thing with the
  animation"): the paper slip is gone. A snow-capped plank (kit plank, SnowCap, nails) hangs from the beam on two ropes,
  is lowered on them once the doors shut and sways from the beam. In it, a sunken window onto a moonlit field drawn in
  pixels (night sky, stars, moon, hills, two pines, snow, the snowy fence), where the sheep, redrawn at 24 x 16 with an
  outline, shaded wool, collar and bell, trots (two leg frames), leaps the fence and lands in a puff of snow. The line
  is cream on the wood. Pixel art is written as rows of letters (`Pixels` in BarnDoors.tsx). Bigger on big screens.
- Snow with a little texture (requested by Brian, 2026-11-08: "the snow looks super flat and untexturized ... not
  overtexturized like the barn floor, just slight more detail"): the yard's ground, the farm's buildings and land, and the
  countryside paint snow with `snowPaint`/`snowAt` (src/skin/voxel/snow.ts) instead of two near-white tones in square
  patches. In metres, so every grid matches: soft drifts (~2.2 m) and finer undulation (~0.7 m), faint slanted wind
  ripples, a little cool blue in the hollows, fine grain and an occasional glint, the darkest about 17% under the
  brightest. On coarse grids (the far land is 1 m voxels) the marks are wider and softer, or the big voxels step into
  squares. Keep it subtle; per-voxel tone picks on snow are what drew the squares before.
- The loading screen is for loading (requested by Brian, 2026-11-08: "if the game is alrdy loaded ex) from just
  refreshing the page then it shouldnt be spammed"). The boot doors show only on the first load in a tab
  (`firstLoadThisTab`, sessionStorage sap:booted). On a refresh Home is up at once over a soft sky and its farm fades in
  once the farm and the land are built (`.sk-farm-fade`, `farmReady`/`onReady` in Farmstead); the farm's hold joins doors
  that are up but never brings them down (`useLoadingHold(..., shut = false)`). Going into a game, practice, the tutorial
  or the dream is `playBarnDoors({ quick: true })`: a 180 ms dark fade, the new screen mounts, and the fade lifts the
  moment it has drawn; only if that takes over GRACE_MS (800 ms) do the doors fade in, already shut, the sign dropping
  in (data-veil, data-revealed). The game clock is still held until either opens. A refresh still builds the farm from
  scratch (about 5 s); the doors were never what made it slow.
- Review fixes (2026-11-09, after /code-review). Doors revealed late keep the dark behind them while they fade in, and
  stay shut until their sign has dropped (REVEAL_HOLD_MS); on a first load the farm shows at once if doors are up
  (`data-instant`), and Home's tour starts when the farm is shown (Drift `ready`). Snow takes each grid's own cell size
  (the farm Builder passes `this.g.size`; the countryside wall uses F). The server refuses the admin avatar quietly
  (no error to the client, which resends it on every connect). Save codes keep lives 'unlimited'. voxelMaterial only
  passes the parameters that are set, and shadows ask for PCFShadowMap (three had removed PCFSoft and fell back to it):
  that silenced about 2,200 console warnings a session. The door preloads in index.html are relative to the page
  (`%BASE_URL%` was doubled by the dev server). Known and left: React's dev-only "synchronously unmount a root" warning
  when entering the dream (it predates this work and never shows in production) and three's own THREE.Clock notice.
  Tests outside src/skin were edited or added for the Hunt removal, the security pass and the clock hold; each one
  follows a change Brian asked for.
- The avatar heads and the tab icon (requested by Brian, 2026-11-09, with his own pixel-art sheet of six heads): AvatarIcon
  shows src/skin/assets/heads/<animal>.png (cut from his sheet with its own transparency, each a padded square) wherever
  an avatar appears: the picker, the name plate on Home and the ledger. The admin's photo is unchanged. The old 12 x 12
  drawn portraits (portraits.ts) are no longer shown; the file stays for its existing test. The tab icon is the sheep's
  head (public/favicon-32.png, favicon-64.png, and apple-touch-icon.png on a cream tile); favicon.svg is gone. Icon and
  preload links in index.html are page-relative because the dev server doubles a %BASE_URL% prefix.
- Typing at the table was dead after the first doors (found by Brian, 2026-11-09: "why is it that i cant type for the
  games?"): the doors' key blocker ran in every phase but 'open', and 'gone' doors stay mounted until the next pair, so
  it swallowed every key for the rest of the session. `keysBlocked` (BarnDoors.tsx) now blocks only while veiling,
  closing or shut, with a test. The e2e suite runs the classic look, so it cannot catch painted-skin input bugs:
  check typing at the table in a browser after touching the doors.
- Kaiyan's head, adjustable (requested by Brian, 2026-11-09: "make kaiyans head adjustable in both length and glare, make
  it extend even further and get even brighter"): the admin panel has Forehead and Glare sliders (x0.1 to x6 and x0 to
  x6, multiples of the 2026-11-08 look) and a Reset, kept on this device in sap:kaiyan-look (src/skin/avatars/kaiyanLook.ts).
  The defaults are x1.8 and x2. AvatarDisc draws the picture as three slices on one quad (hair, forehead band, face) and
  stretches only the band; the glare scales the halo (drawn hotter than white, so it catches the bloom), a turning star
  of glare streaks, the warm light's strength and reach, and lifts the photo a little. The light stays mounted at 0 glare
  so the slider never recompiles the scene. The name plate follows a shorter head but never rises past the 2026-11-08
  height, so the plate and speech bubble stay on screen. Settings are per device: others in a room see the defaults.
- The dream speeds up for real, and new wake-up clouds (requested by Brian, 2026-11-09: "make the dream get progressively
  faster this is boring also the animation transition with the clouds from dream to farmer scenery is trash refine it"),
  a rules change in src/dream: `speedAt` is `SPEED` (120, +5 a fence, cap 320; was 110, +2.6, cap 210), so a night ends
  at 265 and practice reaches the cap at 40 fences. The pace tests in src/dream/__tests__/dream.test.ts moved with it
  (first fence over 6 s, the first seven over 4.5 s, the floor at top speed 2.3 s). The waking clouds are
  src/skin/dream/WakeClouds.tsx: painted clouds in three layers (a shade under each, a lit cap on each lobe) sweep in
  from both sides, outer ones first, with a cloud-coloured wash under them, so the dream never shows through a hole;
  the dream is hidden only once they cover it (`WAKE.dark` 1650, results at `WAKE.finish` 1700); they hold while the
  bedroom is built behind them and part like curtains `WAKE.reveal` (450 ms) later, opaque until nearly off screen.
  Falling asleep on the last fence gets the same clouds, slower (`DRIFT.clouds` 900, results at 2650). None under
  reduced motion. The old flat clouds faded into see-through blobs over the room and left dark gaps on the way in.
- Dream words start with the letter (requested by Brian, 2026-11-09: "make it so that the words must START with the
  letter. idk why u put it so that u have to just 'include' it"), a rules change in src/dream: a fence's first letter is
  always its source word's first letter, and a word counts only if it starts with that letter and has the rest in order
  after it (`lettersIn` in dream.ts; `matched`, `check`, the fits count, examples and hints all follow). The sign still
  reads `S…P`; the HUD says "a word starting with S, with P after", and the typed letters light only when the word
  starts right. This supersedes "the letters may have anything between them" above for the first letter.
- Turns no longer run out unseen (found by Brian, 2026-11-09: "sometimes it skips my turn"). The rules were fine; the
  clock was not. A solo game's clock is performance.now(), but the game only looks at it on a frame, and Chrome draws no
  frames while the tab is hidden or the window is covered, so the next frame caught up all at once and the turn was gone.
  A page freeze did the same. Now a gap between frames over `STALL_MS` (400 ms, src/state/store.ts) is left off a solo
  game's clock, in `frame` and in `act` (a key pressed straight after a stall); rooms keep the server's time. Tests in
  src/state/__tests__/stallClock.test.ts. Checked in the browser: a freeze longer than a whole turn left the turn as it was.
- Mixed start letters (found by Brian, 2026-11-09: "the dream game is too consistent, the run i just did just did the
  letter s 5 times in a row"), a rules change in src/dream: `buildFence` picks the start letter first, evenly among the
  letters with enough fence words, never one of the last `NO_REPEAT` (2) fences' start letters (unless nothing else
  can make the fence), then the source word and the other letters. It used to keep the letter set the most fence words
  fit, which was nearly always S (29 of the 211 fence words start with it). `MIN_FITS` is 8 / 5 / 3 so a dozen letters
  qualify; the dictionary still judges what is typed. Tests in dream.test.ts check no repeats and at least 8 start
  letters in a night.
- Fences ask for starts, with one hint per format (requested by Brian, 2026-11-09: "it gives too many hints, and hints
  that also literally give the word directly. make hints only pop up when theres a new letter format, also dont make it
  'including' letters for the multiple letters portion, make it starting. and make it common starting like GR, not stuff
  like LK"), a rules change in src/dream: a fence asks for a start from `STARTS` (one common first letter, then a two-
  letter start such as GR, ST, BA, then a three-letter one such as STR, CHA, PRO; every start begins plenty of words in
  public/words.txt, checked by a test) and a word clears it only if it begins with that start. No first letter repeats
  within NO_REPEAT (2) fences and no start within RECENT_STARTS (8). Signs read `GR…` (letters side by side, dots after).
  The only hint is `formatHint`: on the first fence of each new length, an example from a different start and first
  letter ("like GRASS for GR"), so it never answers the fence. The timed word hint and the example words are gone
  (`hintWord`, `exampleWords` and src/skin/__tests__/dreamHint.test.ts removed with them).
- Smoother on every device (requested by Brian, 2026-11-09: "make the game less laggy without removing anything? the
  bomb primarily ... optimize this for all devices whether thats ipad, laptop, phone, pc"). Measured first: the scenes
  are limited by the graphics chip filling pixels (the barn ran at 30 fps on a Retina laptop at 2x, 60 on a phone; the
  production build holds 60 with the CPU throttled 4x, so React re-rendering the scene each frame is not the cost).
  (a) The six scene canvases are `AdaptiveCanvas` (src/skin/table/Rendering.tsx): the resolution steps down a quarter
  when the frame rate stays under about 48 fps, back up when it holds the display's rate, never to a level already too
  slow (`nextDpr`, tests in src/skin/table/__tests__/adaptiveDpr.test.ts), and each scene keeps what it settled on per
  device (sap:dpr:<scene>). The resolution must live in the canvas's `dpr` prop: the canvas re-applies that prop on
  every render and the game screen renders every frame, so a resolution set from inside the scene was put straight
  back. The composer follows `viewport.dpr`. Canvases with the composer have `antialias: false` (it has its own 4x
  MSAA target). The Retina laptop now settles at 1.5x, about 58 fps.
  (b) The blast (Blast.tsx) draws nothing between bursts (draw range 0, chunk count 0) instead of 420+ black additive
  squares overdrawn at the middle of the barn every frame, and its meshes stay in the scene so their shaders compile
  while the table loads: the first blast used to stall a frame 115 to 150 ms compiling them (now under 40 ms).
- Kaiyan runs the dream (requested by Brian, 2026-11-09: "make the kaiyan avatar usable there as well"), skin only. This
  supersedes "the admin's photo disc dreams as the sheep" (V5.1 as built). DreamStage draws `AvatarDisc` in the sheep's
  place when the admin avatar is worn: at the sheep's scale but never over `DISC_MAX_H` (1.9 m) tall, so a long forehead
  stays in frame on the leap; turned to face the shot's camera (the phone looks along the lane from the side); leaning
  into the leap at `DISC_PITCH` (0.35) of the sheep's pitch. `discPose` gained the dream's states (a trot that quickens
  with `pace`, jump, land, bonk) with no idle spins or hops; only the dream uses them. The bonk stars and the count pop
  ride above the picture's top.
- The next dream's time is on the results board (requested by Brian, 2026-11-09: "it should be attached to the end plate
  thing ... dont make it a paper just extend the rectangle"): "Tonight's dream returns at 12:00 am." is the board's last
  line under the buttons (`.dr-results-next`), not a slip pinned to the headboard (the room no longer projects a slip anchor).
- The night streak fills from the left (found by Brian, 2026-11-09: "the first box isnt filling in, if its a streak the
  box should be filling in after each day"): the seven boxes on the results board, Home's mini row and the share card are
  `streakRow` (src/skin/dream/streakRow.ts): the run's nights fill boxes 1, 2, 3..., tonight unplayed is ringed in the
  next box, the rest are empty, and an eighth night starts the row again. They were the last seven calendar nights with
  tonight on the right, so a first night lit only the last box. `dreamStreakDays` in src/dream is unchanged.
- Rounded voxel corners, ON TRIAL (requested by Brian, 2026-11-09: "make all the voxels SLIGHTLY rounded on the corners
  so everything doesnt feel so sharp ... i might ask to change it back"). All of it hangs on `ROUNDED_VOXELS` in
  src/skin/voxel/rounded.ts (`?voxels=sharp` / `?voxels=round` override it per page). Shapes are untouched: the mesher
  adds a `bevel` attribute (the face's u, w and a mask of its outer edges: no voxel beside it that way, in its own layer
  or one out), `dropFaces` carries it, and `withRoundedEdges` bends the lighting normal over the last 16% of a face toward
  each outer edge (voxelMaterial plus the vertex-coloured Lambert materials in places.tsx, Sky.tsx and Sheep.tsx). To
  change it back: set `ROUNDED_VOXELS = false`, or `git revert` the commit "Rounded voxel corners (on trial)".
- The practice bang, smooth (found by Brian, 2026-11-09: "the bomb explosion for the practice gamemode is still super
  laggy. i like the effects n everything tho"). Measured at 2x on a Retina Mac; switching the burst's points or the CSS
  jumpscare off changed nothing, so the effects are untouched. What it was: (a) a Mac's graphics driver builds a
  material's pipeline only on its first real draw, so the first bang froze up to ~450 ms and the ice block ~70 ms a
  second later. Blast now parks one black point per cloud far under the floor and one zero-size chunk between bursts
  (`park`, `ZERO`), and each sheep draws its freeze effects once, shrunk to nothing, on its first frames (`fx.warm`).
  (b) The auto-resolution changed resolution mid-burst (a 70 to 100 ms `setSize` hitch): `holdDpr` holds it for the
  burst. (c) It reacted too slowly for a short run: it now looks every half second (`DPR_WINDOW_S`) after 1.5 s, steps
  down after a second under ~48 fps or at once under ~36, and a scene seen for the first time starts at the lowest
  resolution any scene settled on on this device (`deviceHint`). After: 60 fps through the bang (no frame over 34 ms).
- Longest word on the plate (requested by Brian, 2026-11-09: "longest word should not be on a pin, it should be on the
  plate as a section"): the practice results board shows "Longest word" and the word as a section under a rule
  (`.sk-tally-section`, `.sk-tally-longest`), with the dream line as another section; Counting Sheep's results show the
  night's facts as a section beside the count (`.dr-results-facts`), not a pinned sheet.
- No floating voxels (requested by Brian, 2026-11-09: "can you fix all the misplaced voxels, a lot of them are floating").
  `npm run check:floating` (tools/floatingVoxels.ts; also `-- [table|farm|duel|bedroom] [--props] [--detail=<file>]`)
  builds each scene, catches every model the mesher gets (`__voxelHook` in mesher.ts, set by nothing else), and lists
  every piece touching nothing (no shared face or edge) with the code that built it; it must say "Nothing floats."
  after any scenery change. It is not in `npm test`: building every scene there timed out the other builder tests.
  src/skin/voxel/__tests__/primitives.floating.test.ts and refine.test.ts pin the causes. Before: 185 loose pieces at the table, 36 on the farm. Causes and fixes, keep them fixed:
  (a) `refine` took off the small cells that were the only bridge between two voxels meeting at an edge or corner (a
  drooping pine branch fell off); it keeps them now, and treats below y = 0 as ground, so a thin post or tyre keeps its
  foot. (b) `box` drew nothing for a one-cell box on a half cell (5.75 on a 0.1 grid rounded its sides apart): the wire
  along the barn's right wall did not exist and its bulbs floated; an empty box now takes its width from its size, and
  every box that drew before draws the same. (c) `line(..., joined)` and festive `strand` step one axis at a time, so a
  limb or a wire is one piece (the animals keep the old `line`). (d) Things placed in the air: the cross beam (moved to
  the lanterns' z, now on its own posts at each wall), the tractor (tyres 0.1 m up, no axles), the yard pines' leader
  and bare branches, the forest pines' leader, the stars on the trees, the wreaths and stockings, the lights on the coop,
  the shed and the orchard, the nightstand's knob. The outside wreath and the gable lights hang on the farm's barn shell
  (z 7.3 to 7.4), so they live in `buildFarmFestive`. Known and fine: the distant hills and mountains, the dream's
  islands, and the bedroom's clock, ring and window view are placed by their meshes, not in world space.
- The Barn Bazaar (requested by Kai, 2026-11-11), skin only plus small hooks: src/skin/shop (catalog.ts, economy.ts for the pure rules,
  store.ts for the wallet in `sap:barn`, Bazaar.tsx, Payout.tsx). Wool Coins and XP are paid once per finished Quick Game (by seed),
  practice run and Counting Sheep night; game coins stop at DAILY_CAP (300) a local day, XP does not; levels, word milestones and
  dream streak items (7, 30, 100 nights, never taken back) pay on top. Everything sold is cosmetic: bomb tints (Bomb.tsx), burst
  palettes (Blast.tsx `palette`) and fuse voices (`setTickVoice` in src/audio/sound.ts). Hard rules: no random rewards, no real-money
  sale, no ads, no item that changes play. Rooms, the daily table, the tutorial and the admin's end previews (seeds `preview:`) never
  pay. The save code carries `sap:barn` (merged, never lowered). The wallet is local; the server's coin shop (server/economy) is
  separate and still only for signed-in room play.
- The Bazaar page and the account wallet (requested by Kai, 2026-11-11). The Bazaar is a menu item ("Barn Bazaar") that opens a
  full page in the same tab (src/skin/shop/Bazaar.tsx: header, section tabs, one scroll of item cards under headings; a history entry so
  Back closes it); the farm stops drawing behind it (`paused` on FarmBackdrop; a pause restarts three's clock, so the tour restarts).
  Signed in, the wallet lives on the server (db/migrations/105_barn_wallets.sql, server/barn, /api/barn/*): the browser's wallet is
  imported once per account (coins capped at IMPORT_COIN_CAP), games are claimed by id with the daily cap held on the server (UTC day),
  prices come from the shared catalogue. The server cannot see solo games, so faking reports gains at most the daily cap of cosmetic coins.
- The shop is called the Trading Post (renamed by Kai, 2026-11-11, from the Barn Bazaar). Code names stay `Bazaar`, `bazaar` and `.sk-bazaar*`;
  every word a player reads says Trading Post. The bullets above that say Barn Bazaar mean the Trading Post.
- No profanity anywhere (requested by Kai, 2026-11-11: "make sure there is absolutely nothing at all in the whole game"). The list is
  src/lib/profanity.ts (`isProfaneWord`: ROOTS refused inside any word, WORDS refused exactly, CLEAN for real words a root sits in).
  public/words.txt and public/word-frequency.txt have every match removed (518 and 273 words), `createDictionary` drops any that come
  back, so tables, rooms, bots and the dream all refuse them, and nickname.ts checks names against it too. Room chat keeps its own
  filter (server/filter.ts). src/lib/__tests__/profanity.test.ts checks the lists, the dictionary, names, chat, the dream's and the
  word of the day's words. When in doubt a word goes, even with a clean meaning (hoe, tit, niggle); adding to the list means
  re-stripping both word files. rarity.test.ts's size pin moved from 88,400 to 88,127 for it.
- Quick start and parties (requested by Brian, 2026-11-11), a server and skin change. Rooms start with 2 or more people (`MIN_TO_START`),
  and farm sheep fill the table to 4 (`MIN_TABLE`). `quick` joins the fullest open public room or opens one (`quickJoin` in
  server/rooms.ts); `options` is the host's game length and public/private switch (`setOptions`). A party is a private room: its code
  and the `?join=CODE` link (which now opens the lobby by itself when no accounts are configured). The painted lobby and room are
  src/skin/rooms (PaintedLobby, PaintedRoom, rooms.css; no gradients there, the kit audit counts them); the classic Lobby and
  RoomScreen stay for ?skin=classic and the end-to-end tests. Dev sign-in tokens are `dev:<name>#<per-tab id>`, so two people with one
  name are two players. `npm run dev:online` runs the server and the site together; `npm run dev:fly` points the site at Fly.
- Real people are the default (requested by Brian, 2026-11-11), skin plus one server flag. With a game server configured the start screen's
  menu is: "Quick play" (the server's `quick`; the label never changes while connecting), "Create lobby" (creates a friends-only room at once;
  game length and Friends only / Public are set inside the room, never on the start screen), "Join party" (a panel with five letter tiles),
  and "Custom game" (the bot table that used to be Play). Brian rejected, in turn: a "Play with friends" lobby screen, a code slip under the
  menu, and a Play panel with settings before the lobby; don't rebuild them. A room opened by Quick play has `queue: true` and PaintedRoom
  shows it as a queue page ("Finding players", the count, chat); the first player in is host and starts it by hand. The chat is the classic
  ChatPanel on a paper card (`.rm-chat` in rooms.css). `enter(name, intent)` in roomStore connects and sends the one message. Without a
  server URL, Quick play is the old Start now and Play is the bot table.
- The lobby is a pen (requested by Brian, 2026-11-11: "make it like a pen"), skin only. The party room and the Quick play queue are one
  screen, PaintedRoom, laid over a voxel scene: a rail-fenced sheep pen on the snow at night (src/skin/scene/pen.ts for the layout and
  voxels, src/skin/rooms/PenStage.tsx for the stage). Every player is their animal inside the fence with a name plank overhead (ScreenAnchor,
  not drei's Html, which threw on unmount here); seats nobody has taken are farm sheep grazing at the back. One paper sheet on the left holds
  the party code, who can join, the game length and the player list; the chat is docked bottom right; the start sign reads "Open the gate".
  `shift` on PenStage slides the picture (camera view offset) so the panels do not cover the pen. On a phone the pen is the top of the screen
  and the sheets scroll under it. ChatPanel scrolls only its own log now (scrollIntoView dragged the whole page to the chat).

- The profile (requested by Brian, 2026-11-12: "a basic stat/user profile overview so people can see their ranking ... also make
  this the place where u can change ur username"): src/skin/profile/Profile.tsx, a full page over Home like the Trading Post (both
  use `usePageHistory` in src/skin/hooks: Back and Esc close it, and its deferred history.back() survives StrictMode's double mount).
  It opens from the name plate (now a button, no longer a text field) and a "Profile" menu item. The name is changed there: a
  guest's in this browser (`settings.name`), a signed-in player's account nickname (POST /api/account/nickname, the sign-up rules,
  5 a day). The standing is by XP among signed-in players with any XP (GET /api/barn/rank): a place under 10 players, "Top X%"
  from 10 up, never 0%. Numbers: different words, Quick Game wins (`wins` in src/lib/record.ts, counted from 0.7.0; older records
  start at 0), win rate, longest word, practice best at any clock, Counting Sheep best, night streak, and online wins when signed in.
- Trading Post v2 (approved by Brian, 2026-11-12): docs/PLAN_TRADING_POST_V2.md. This supersedes "no random rewards" in the
  Barn Bazaar bullet above, for Feed Sacks only.
  (a) Cosmetic only: nothing bought, earned or opened changes how any game plays.
  (b) Feed Sacks cost Wool Coins only. Golden Bells (the second currency) can never open, buy or discount a Feed Sack,
      directly or by conversion. The two currencies never convert into each other.
  (c) Every item that can come from a Feed Sack can also be bought directly at a fixed price; achievement items
      (streaks, milestones) are never in sacks and never for sale.
  (d) The odds are shown before every opening and are the real odds. The reveal shows the result honestly: no fake
      near-misses, no animation that suggests a better result than the one rolled.
  (e) No countdown timers, push notifications or "last chance" wording anywhere in the Trading Post.
- Shorter first intro (approved by Brian, 2026-11-23): a game's round-1 intro is FIRST_INTRO_MS (1.2 s, was INTRO_MS 2.5 s)
  in src/engine/game.ts; later rounds keep INTRO_MS. The painted table settles in (skin.css .sk-settle-in) as the loading
  screen lifts, so the hand-over moves and the first fuse is lit right after. Rooms get it once the server is deployed.
- Trading Post v2 as built, T0 to T3 (2026-11-12; T4, payments, is not approved and not built). Brian asked for a near-miss
  effect on the sacks; it was not built (plan decision 8.1, guardrail (d)): don't add one. Pure rules: src/skin/shop/sacks.ts
  (odds, pity, refunds, the pool: the one source the roll and the screen read), roll.ts (`rollSack`, crypto randomness),
  shelf.ts (`dailyShelf`); economy.ts applies them (`openSack`, `withShelf`, `buy(..., { shelfDay })`, Bells in `payGame` and
  `grantStreakItems`). Screens: FeedSacks.tsx (card, odds table, "Your sacks", the reveal), Bazaar.tsx (Today's shelf, Feed Sacks,
  Bell shelf, Bells in the header), ItemArt.tsx. Where the plan's letter did not fit: the balances, pity counters, sack log and
  frozen shelf live in the existing wallet (`sap:barn` and, signed in, the server's barn_wallets row), not separate sap:wool /
  sap:bells / sap:sack-pity / sap:sack-log keys, so save codes and the account wallet carry them; signed in, the server rolls the
  sack (POST /api/barn/sack, the body is ignored) and freezes the shelf (POST /api/barn/shelf, the player's local date only within
  a day of the server's); the shelf is frozen per player per day the first time it is seen, because a re-draw past owned items
  would refill it after every purchase. New items, so every tier has some: Northern Lights (rare burst, 800), Diamond (legendary
  bomb, 1500), Solstice (legendary burst, 1500); Bell items Brass Bell (30) and Golden Quill (40). Bells: 5 a level, 10 a
  milestone, 20 per 7 nights of the best dream streak (paid once, `bellStreak`); an import from a browser brings at most 100.
  Tests: src/skin/shop/__tests__/sacks.test.ts (the plan's 7.2 list) and server/barn/sacks.test.ts.
- Three Feed Sacks (requested by Brian, 2026-11-12: "make it 3 different feed sacks. i dont want different types of material in the
  same lootbox ... ensure that everything is coherent with theme"). One sack per kind, never mixed: the Oat Sack (bomb skins), the
  Corn Sack (bursts) and the Barley Sack (fuse sounds), each with its own pool, pity counters (`wallet.pity[sack]`) and log
  (`SackEntry.sack`); the odds table is shared. `SACKS` in src/skin/shop/sacks.ts names them and colours their burlap and
  stencil; POST /api/barn/sack takes `{ sack }` and nothing else. Every sack needs at least one item of every rarity (a test
  checks), so new items fill the gaps: bursts Hay and Snowfall (common); fuse sounds Cowbell and Sleigh bells (uncommon), Barn
  owl (rare) and Music box (legendary), new voices in `beep` (src/audio/sound.ts: overtones and a glide, no noise sources). The
  Bell burst is Lantern Glow (was Golden Quill). For the farm theme, three older items changed their names only (ids kept):
  8-bit is Tin toy, Bubblegum is Heather, Confetti is Harvest Fair. Rarity tags are the kit's paper hang tag (`kit-tag`).
- Admin's unlimited purse (requested by Brian, 2026-11-12: "make admin panel give infinite currency"): while the admin lock is open,
  the Trading Post shows ADMIN_PURSE (999,999) Wool Coins and Golden Bells and nothing bought or opened costs anything
  (`adminDo` in src/skin/shop/store.ts puts the real balances back after every action; items got this way stay owned). It runs on
  this browser's wallet even when signed in: the admin lock is client-only, so the account's wallet on the server is never
  touched and the server never pays out on a browser's say-so. Locking shows the real balance again.
- Feed Sacks only, Missions and the Barn Book (requested by Brian, 2026-11-12: "remove everything except for the feed sacks, i dont
  want stuff to be purchased seperately ... missions ... a dictionary thing ... make the lootbox opening more similar to like a casino
  style"). This supersedes guardrails (b) and (c) of Trading Post v2 and its T2 and T3: there is no direct purchase, no daily shelf,
  no Golden Bells and no Bell shelf (POST /api/barn/buy and /api/barn/shelf are gone; old `bells` and `shelf` fields in saved wallets
  are dropped quietly). Items are `free`, `sack` (with a rarity) or `mission`; `MISSIONS` in src/skin/shop/economy.ts gives the
  mission items for good (dream streaks 7, 30, 100 via `wallet.bestStreak`; level 5 the Brass Bell; 500 different words Lantern
  Glow), granted in `payGame` and `grantStreakItems`; the word milestones still pay coins. The Trading Post has three tabs: Feed
  Sacks (three sacks on a barn counter), Missions (progress for each) and Collection, the Barn Book (every item, found ones in
  colour with Wear and Listen, others as dark shapes saying where they come from). The opening is the fair machine (Reveal in
  FeedSacks.tsx): lever, chasing square bulbs, a spinning reel, a bell. It stays honest, guardrail (d) unchanged: the result
  is rolled and saved first, the bulbs and every reel tile show the rolled rarity from the first frame, and the reel holds only
  items of that rarity (`reelFor`), so nothing better slides past. Don't add better items to the reel or a slow-down near them.
  Admin coins are now a switch in the admin panel (`coins` in src/lib/admin.ts, sap:admin-coins), effective only while unlocked;
  a stopgap Brian means to change.
- Rule (d) lifted, Golden Bells back, and the Trading Post looks like the rest of the UI (Brian, 2026-11-12: "override rule d, i changed
  my mind ... FIX THE DESIGN PLEASE it should match the rest of the UI ... why did u remove the purchasing with bells?").
  (1) Guardrail (d) of Trading Post v2 is withdrawn. The fair machine's reel (`reelFor` in FeedSacks.tsx) holds the sack's items at
  the sack's own odds, and when the result is short of legendary, NEAR_MISS (0.55) of the time the tile just past it is rarer and the
  reel stops leaning toward it, with a "So close!" line. The result itself is still the real roll, saved before the spin, and the
  odds shown are still the real odds; only the tiles around it are for show. The bulbs are string lights until it lands.
  (2) Golden Bells and the Bell Shelf are back (Brass Bell 30, Lantern Glow 40), earned 5 a level, 10 a milestone, 20 per 7 nights
  of best dream streak; POST /api/barn/buy sells Bell Shelf items only. Wool Coins still only open sacks, Bells never open a sack,
  and the two never convert. Missions are the three dream-streak items. No daily shelf.
  (3) The Trading Post and the profile are `.sk-guide` panels over the farm, like How to play and Settings: the knitted frame and
  festive band, a snow-capped head with the round close button, paper tabs (Feed Sacks, Bell Shelf, Missions, Collection), the
  guide's rows and outlined art boxes on cream, red WoodButtons and green ClothButtons, and the kit's hang tags. The dark
  full-page `.sk-shop` shell is no longer used by either. The fair machine is a `.sk-guide` panel too.
- The Trading Post, rebuilt and polished (requested by Brian, 2026-11-12: "fix all the formatting issues ... this is so shoddily made. fix it up,
  everything from the icons to the ui itself ... make this feel more exciting, make sure everything is placed intentionally"), skin only.
  Art: src/skin/shop/art.tsx draws everything as rows of characters (`Pix`): bombs are the turn clock's own ice bomb in each skin's
  colours with one mark each, bursts use the burst's real BLAST_PALETTE, every fuse sound has its own picture (bell, tin robot, wood
  block, cowbell, sleigh bells, owl, music box, moon), and the sacks are tied burlap with a printed label. Item art always sits on a
  dark tile (`.sk-art`, rarity along its bottom edge), because pale bursts and ice vanish on cream paper. Feed Sacks tab: pick one of
  three sacks on top (pips show what is found, by rarity); below, what is inside in two balanced rows, the odds as a bar with a key,
  two meters for the guaranteed rare and legendary, and one Open button. Open brings up the fair machine READY: nothing is spent
  until the lever (or the Pull button) is pulled; that replaces the old inline confirm. Then the reel spins, the winning tile
  pops, a near-miss neighbour stays lit, the bulbs turn the rarity's colour for rare and legendary, with a tune, confetti and (legendary)
  a shake. Bell Shelf: the three ways Bells are earned as live progress tiles, and the items standing on a plank. Missions: a level
  tile, meters of one length, reward tags. Collection: a count banner and aligned entries. The profile sizes to its content. The
  old `.sk-shop*` styles are deleted. Every layout was checked at 1280 x 860 and 390 x 844; don't add a control without checking both.
- Trading Post refinement (docs/PLAN_TRADING_POST_REFINE.md, executed 2026-11-12 on Brian's "execute plan trading post refine md"), R1 to R7.
  The Trading Post is the inside of the shop: a plank wall (`kit-wall`), the sign on ropes, balances chalked on a slate, paper index
  tabs with icons, one strip with the level, and a body that scrolls and fades into the wall (src/skin/shop/Bazaar.tsx). One item card
  everywhere (ItemCard.tsx): a picture in the frame of its rarity (`kit-pic--common|uncommon|rare|legendary`, shop/rarity.ts), three
  states only (not found: art dimmed to 35% with a padlock and where it comes from, never a "?"; owned: Wear; wearing: lit frame).
  Feed Sacks stand on a counter with an even 4-column grid and a chalk odds slate; the Bell Shelf is a two-tier shelf with brass
  price tags and "More soon" pegs; Missions are slips on a cork board with a DONE stamp, milestones a ruled ledger; the Collection
  is the Barn Book (count, filters kept in `sap:book-filter`, a page per kind). New kit materials are at the end of kit.css.
  Balances are written by `formatCoins` (shop/format.ts) everywhere, Home's peg and badge included (short form above 99,999).
  Type: Fraunces for names and numbers, Patrick Hand for descriptions and progress, Nunito only for uppercase tags.
  Art: items and sacks are voxel thumbnails baked by `node tools/renderThumbs.mjs` (dev server up) from ?preview=thumb into
  public/shop/*.webp; re-run and commit after changing a look. Bomb skins are no longer a tint: each has its own shell colours
  (`BOMB_SHELL` in shop/shells.ts, `bombShell` in voxel/bomb.ts), used by the table's bomb too, so Gold is gold in the game.
  `node tools/postCheck.mjs` checks nothing is clipped at 1920 x 1080 and 390 x 844 and that Left/Right change tab; it is a tool,
  not part of `npm test` (the e2e suite runs the classic look). Tests: src/skin/shop/__tests__/refine.test.tsx.
  Where Brian's own words overrode the plan: (1) the near miss stays but is quieter (same day: "less frequent ... remove the text
  ... make it also go close to other stuff too"): NEAR_MISS is 0.15, the planted tile is usually one rarity up and on either side,
  the reel otherwise rests anywhere in its tile, and nothing on screen mentions it; the reveal is still the fair machine, not the
  plan's wobbling sack. (2) No Today's shelf and no "or buy directly": he removed buying items on their own, and the plan says
  no rule changes. Also: fuse sounds are each their own voxel object, not one tinted horn (four would have been the same tan).
- Trading Post, third pass (requested by Brian, 2026-11-12: "make a preview thing in the barnbook ... make the lighting better everything is
  really dark ... feed sacks a little more simpler ... a simple background bc rn it looks like its floating ... the tabs look horrendous ...
  dont use the basic pin thing ... more flashy, glowing stuff ... bursts, make them more unique please, they are all just reskins ... make
  sure that they are all actually usable in game"). He liked the sack opening (the fair machine): leave it as it is.
  (1) Bursts are no longer recolours: `BURST_SHAPE` (catalog.ts) gives each its own motion in the real effect (`MOTION` in table/Blast.tsx):
  frost ball, straw fountain, snow coming down, confetti popper, rising fire, flat ring, standing ribbons, sunburst spokes, drifting
  lanterns, stars that stop and twinkle. The flash, light and mist take the burst's colour; the shell chunks are the worn bomb skin's
  (`bombChunk`). 'ball' is exactly the old frost burst. Keep the cloud counts and the parked draws (the lag fixes of 2026-11-09).
  A burst drawn by adding light needs an opaque dark background: on a clear canvas each faded bit turned its pixel black.
  (2) The closer look: Preview.tsx (dialog) and PreviewStage.tsx (lazy canvas), opened by an item's picture on any card. A bomb skin or
  a sound's object turns on a stand; a burst is the real Blast replaying, with "Set it off"; a sound has Listen. Still picture under
  reduced motion. shop/models3d.tsx is shared with the thumbnail bake.
  (3) Look: the wall is lighter and washed with lantern light; every frame's mat is a small stage (wall, floor, the thing's shadow), so
  nothing floats; not-found art is at 50%, not 35%; the tabs are four wooden boards, the picked one lit (`kit-lit`), no pins; a string
  of lights under the beam; a halo on Open (`kit-pulse`); rare and legendary frames glow; a pool of light behind the picked sack
  (`kit-spot`). The sacks are built on the bomb's 0.04 m voxels with a printed label and one mark (bomb, burst, note), not stencilled
  words at 0.02 m. The heading sits over both columns so the odds slate starts level with the cards. Under 940 px tall the sacks shrink.
  (4) Checked in a real practice run (GPU Playwright, `--use-angle=metal`): the worn skin is the bomb at your hooves, its chunks and the
  worn burst fly when it goes off. Tests: "every item is its own thing, and is used by the game" in refine.test.tsx.
- Bursts are acts, not explosions (requested by Brian, 2026-11-12: "the burst doesnt literally have to be an explosion every single
  time, maybe something pops up ... it feels weird for an aurora to be exploding"). This supersedes (1) of "Trading Post, third pass".
  Only Frost (`ball`) is the explosion, exactly as it was. Every other burst is an act (`ACTS` in src/skin/table/burstActs.ts, played
  by Blast.tsx): the shell falls open with a small puff and a few pieces, and something appears where the bomb was. Hay: a haystack
  pops up and throws two forkfuls of straw. Snowfall: a snow cloud floats up and snows. Harvest Fair: balloons drift off and pop into
  confetti. Ember: a campfire. Heather: a patch of heather shedding petals. Northern Lights: light climbs and is drawn open into an
  aurora overhead. Solstice: a little sun rises with its rays. Lantern Glow: paper lanterns let go. Starlight: stars come out one by
  one. The voxel things are src/skin/voxel/burstProps.ts, drawn as one instanced mesh, parked at zero size between bursts like the
  shell chunks (the lag fixes of 2026-11-09 still hold: 58 fps through the bang, no frame over 45 ms). The thumbnails are built from the
  same models: re-bake after changing one. An act has no flash, mist or flying shell, and for an act only: the screen does not flash,
  crack or shake (Jumpscare `glow`: a soft light at the edges in the burst's colour); the bang is the soft 'poof' (`setSoftBoom` in
  src/audio/sound.ts); the barn camera stays on that seat for ACT_WATCH_S (2 s) before it swings on, as it does for a freeze
  (BarnTable.tsx); a practice run's end board waits ACT_WATCH_MS (1.9 s) (PaintedGame.tsx). Without the last two an act is never
  seen: the camera had left, or the board was over it. An act happens where the bomb was when it went off (`stage` in Bomb.tsx,
  noted in the frame loop: by the time a burst asks, the bomb's own position is usually the next sheep's; the frost blast still reads
  `origin` as before, which is why it goes off in front of the camera); a thing that needs the floor stands beside the sheep (`room`);
  tall acts keep under what the camera sees (`top` in Blast.tsx). Acts' lights are weak on purpose (3 to 14): 34 lit the wool white.
  Checked in the Barn Book preview (desktop and phone), at the barn table and on the ice. Tests: src/skin/table/__tests__/burstActs.test.ts.
- Bomb skins are their own models with their own effects (requested by Brian, 2026-11-13: "add effects to the cooler bombs, like diamond
  just looks like the default snowy bomb ... everything needs to be differentiated, perhaps even remodel them slightly"). This
  supersedes "The shape, the frost and the cracks are the ice bomb's, voxel for voxel" for every skin but Ice, which is untouched.
  Models: src/skin/voxel/bombSkins.ts (`bombLook(id)`: body, glowing parts, fuse and spark in the skin's colours, a piece for the
  burst). Ember is a cracked coal with glowing cracks; Peppermint a striped sweet in a wrapper's ruff on a candy-cane neck; Plum a
  plum with a cleft, stem and leaf; Gold a strapped, studded orb with a crown; Diamond a brilliant-cut gem standing on its point;
  Brass Bell a bell on its lip; Aurora a ball of night sky with a raised ribbon and rays of light. Every skin still stands on row
  -5, keeps about the ice bomb's width and has a neck voxel at 0,6,0 for the fuse, so the table treats them all alike.
  What each does at rest: src/skin/shop/bombAura.ts (pure, no three) drawn by src/skin/table/BombAura.tsx, in the world, not on
  the bomb: Ice cold vapour (the old code, same numbers), Ember rising embers and throbbing cracks, Peppermint mint air and a
  glint of sugar, Plum dusk motes, Gold falling dust and constant glints, Diamond rainbow sparkle, glints and edges that pass through
  the spectrum, Brass Bell rocks and sends rings along the floor, Aurora a small aurora over it and bands that pass green to violet.
  Glowing parts are a second mesh with an emissive Lambert (as the barn's lanterns are); glints are small flat voxel stars turned to
  the camera, one instanced mesh parked at zero size. Each skin also has its own fuse, spark, floor light, floor mark and landing
  puff. The countdown digits take a colour that reads on that skin and stand `face` metres out, clear of its widest voxel (a test
  checks): on the Diamond and Gold they were buried in the girdle and the belt. The Barn Book shows a bomb on a dark floor now, like
  a burst: what comes off it is drawn by adding light, which turned to black squares on the cream mat. Rarer skins do more; keep it
  that way when adding one. Checked at the barn table, on the ice and in the preview; 60 fps with the Diamond worn.
  Tests: src/skin/voxel/__tests__/bombSkins.test.ts. Re-bake the thumbnails after changing a model.
- The beat after a bomb (requested by Brian, 2026-11-13: "people only get 3s when it says 5s or 10s ... make some sort of a pause, the
  sheep actually becoming dazed or something to show the impact of the bomb"), an engine change. After a time-out the next sheep's
  fuse is lit AFTERMATH_MS (2.4 s) later: `turn.startedAt` is that far in the future and the whole turn runs from then (`startTurn`'s
  `wait`, given only by `failTurn`). A word played normally still starts the next turn at once. A word or a pass sent in the beat is
  accepted (the clock on a client can be a few ms off the server's); a pass then hands on a whole turn at most. This was the "3 s"
  bug: nothing was wrong with the room clock (a two-client run on the local server shows every sheep getting the time it is told, to
  0.1 s), but the next turn's clock ran while the camera was still on the sheep the bomb went off beside (2.4 s for a freeze, and the 2 s
  act hold of 2026-11-12, which this replaces: ACT_WATCH_S is gone). What the screens do with the beat (painted skin): nobody has the
  floor (`TableView.currentPlayerId` is '' until the fuse is lit, `nextPlayerId` says who is next; the clock stands
  full); the sheep is `dazed` (Sheep.tsx: knocked back, head rolling; `DazeStars` in BarnTable circle its head) and the table stays on
  it (`dazed`); PREROLL_MS (650) before the fuse is lit the table turns to the sheep up next (`upNext`), the turn is called, and a
  fresh bomb drops as the clock starts. The frost blast is now watched where it happened too. The fuse beeps only for seconds the
  turn has. The classic look shows a full clock through the beat. Tests: src/engine/__tests__/aftermath.test.ts.
- The end of a game plays out (requested by Brian, 2026-11-13: "make some sort of a animation that transitions between the end of the
  game and the win screen. rn its too abrupt"), skin only: FINALE in PaintedGame.tsx. The win screen used to take the table the instant
  the last bomb went off. Now the last bang and the freeze are watched (2.4 s), the table turns to the winner, who is named on a gold
  board, hops, and gets the fanfare (2.4 s), and the screen changes behind the loading doors (`playBarnDoors({ quick: true })`: a
  short dark fade, the doors only if the podium is slow to draw). A game already over when the screen came up, the admin's end
  preview, a practice run and reduced motion go straight to the results.
- Faster at fine resolutions (requested by Brian, 2026-11-13: "make the website less laggy"). Measured first, at the barn table on a
  Retina laptop with the resolution pinned (`?dpr=1.5`, new: AdaptiveCanvas draws at exactly that and adapts nothing): 24.5 ms a frame
  at 1.5x, of which 4x multisampling was about 7.5 ms (every composer pass resolves it again) and the bloom about 7.5 ms; shadows
  next to nothing; and a bang, frost or any act, added nothing measurable on top. So the bursts were not the cost, the picture was.
  Now `samplesFor` in Rendering.tsx: 4 samples at 1x, 2 up to 1.4x, none from 1.5x up (compared side by side: no stair shows at that
  density), and the bloom works on a picture at most BLOOM_MAX_W (720) across. After: 60 fps pinned at 1.5x and at 2x, and left to
  itself the table settles at 1.75x to 2x where it used to settle at 1x to 1.25x. Levels settled under the old pipeline are not
  believed (`SETTLED_UNDER` in the saved value), or a kept "1.5x is too slow" would hold a device down for good. The Trading Post's
  pages and previews were measured too and hold 60. A burst now holds the resolution for 3.2 s at most.
- What a bomb leaves on the floor is its own (requested by Brian, 2026-11-13: "all the bombs have like an ice thing on the ground which
  doesnt make sense for stuff like fire"): `ground` in bombSkins.ts. Ice keeps its frost; Ember a scorch with embers at its edge,
  Peppermint a scatter of sugar, Plum a pool of juice and three leaves, Gold coins in gold dust, Diamond rays of thrown light, Brass
  Bell two thin rings, Aurora a pool of green and violet. Painted in full (the old one was the frost disc with a tint multiplied
  over it); the table fades it in and out as before, and the Barn Book's preview shows it under the bomb.
- Brighter nights (requested by Brian, 2026-11-13, of a room game, which is always at night: "make the room a little brighter ngl i
  cant see a thing"): `NIGHT` in Rendering.tsx. At night the lanterns burn at 1.5 and reach 19 m, the moon is 1.15 (was 0.9) and the
  fill 0.62 (was 0.5). The fill stays modest on purpose: see "Warmer light" above for what a strong one does to the snow.
- Review fixes (2026-11-13, after /code-review), the four that came from that day's own changes. A finished Quick Game or practice run
  is paid the moment it ends (`payEarly` in shop/Payout.tsx, called from PaintedGame): its board, which shows the payment, now comes
  up seconds later (the finale, or the wait for an act), and a player who left in between got nothing. A bot that takes over the seat
  that is up next waits for the fuse like any bot (`replaceWithBot`). The word bar says "Next sheep" between rounds again, not seat 0's
  name (`Number('')` is 0). The daze stars circle at the animal's own head height (`nameplateY`), not the sheep's. Not fixed, and
  listed for Brian: the eleven findings in code from before that day (the sack pity counters once a tier is all owned, Bells minted
  from a browser-reported streak, the profile's win rate, and smaller ones).
- After the review, second round (asked for by Brian, 2026-11-13, item by item).
  (a) The server no longer takes a browser's word for what is worth something. A Counting Sheep streak rises by at most one night
  for each UTC day gone by since it last rose (`streak` in server/barn/service.ts, `Wallet.streakDay`): one request claiming ten
  years used to be paid thousands of Golden Bells. A browser's wallet comes into a new account under caps (`importable`): a week's
  streak, 2 rare and 1 legendary Feed Sack items (worn ones first), Bell Shelf items only while their prices fit under the 100-Bell
  cap, mission items only if the capped streak earned them, fresh pity counters. An honest long-time guest can lose a rarer item or
  part of a streak on first sign-in: the cost of the caps, told to Brian, who has not yet said whether they should be looser.
  (b) A sack's result stays off the screen until the reel stops: the wallet is saved at the pull as before, but `useWallet` goes
  on returning the wallet from before the lever (`holdWalletView` / `releaseWalletView` in shop/store.ts) until the machine is done.
  (c) The profile shows "Wins" (Quick Games won), no win rate: wins were only counted from 0.7.0, games from the start.
  (d) The profile's board (he asked for it in place of the bare rank): GET /api/barn/top gives the 100 players with the most XP
  (name, level, XP; no account ids; hidden, deleted and banned accounts left out, as on the game leaderboards) and the asker's place.
  On the board you see "#7"; below it, "You are in the top 0.5%" (`topPercent`: rounded up, two figures under one percent, never
  0). The list is read once a minute for everyone; /api/barn/rank is gone.
  (e) Signed in, `settings.name` follows the account's nickname (PaintedApp), so solo games use the one name. A stopgap until
  Google sign-in holds names and stats.
  (f) The avatar picker and the sign-in dialog are drawn beside the profile, not inside its scrim (a click that closed the picker
  closed the profile too). The farm keeps moving behind the profile; it is paused only behind the Trading Post.
  (g) Renames: five a day, counted only when the name really changes; a save that fails for any reason but the name being taken
  is an error, not "taken".
  (h) Removed as unused: the wallet's log of opened sacks (old ones are dropped quietly), `pityLine`, `bombShell`, `Item.swatch`,
  `BOMB_TINT.color`, the `coldFor` plumbing, `BellIcon` and `CoinIcon` (the Trading Post's `CoinArt` is the one coin). Pixel art is
  drawn by one helper, components/pixels.tsx (`pixelRects`), used by Icons, the Trading Post's art and the loading sign.
  Not changed, waiting on Brian: what a sack does when its guarantee comes due and every rare in it is already owned (today the
  guarantee stays due, so each sack after is 20% legendary and 80% uncommon until a legendary drops, while the slate shows 2% and 28%).
- The Feed Sacks' counter (requested by Brian, 2026-11-13: "make the three Feed Sacks belong in the room. Skin only"). No price, odds
  or behaviour changed. The thin shelf line is a real counter (`kit-counter` in kit.css): a 28 px plank with grain, a lit top edge
  and a dark front lip, on two brackets, the room's full width. The sacks stand ON it: a thumbnail's sack ends at 95% of its height
  and the plank's top is 5 px above that line (`--stand` in skin.css), with a hard dark ellipse under each (an SVG ellipse: no
  blur). The radial glow behind the picked sack is gone (`kit-spot` deleted): the picked sack slides 8 px forward at full size
  in warmer light, a lit lantern hangs over it on a string and swings once, and its tag gets a gold edge; the others sit back at
  92% in less light. Names are no longer cream text on the wall: each sack's name, "Bomb skins · 3 of 5 found" and its pips are on
  a paper tag (the cards' paper, a slight tilt) hung by a string from a nail in the counter's front edge under it. The counter is
  dressed with a brass scale at one end and a rope coil and a scoop at the other, behind the sacks' line, and a little grain at
  each sack's foot in its own colour (oat pale, corn yellow, barley brown): voxel props in shop/thumbModels.ts (`COUNTER_PROPS`),
  baked by tools/renderThumbs.mjs like every thumbnail. Sacks and props are baked at the fuse sounds' turn under the same key
  light, so their shading matches the cards. Hover wobbles a sack 2 degrees; none of the motion runs under reduced motion. Phone:
  the counter stays, sacks at 112 px (80% of the laptop's 140), tags stacked under each, props hidden under 480 px, the last
  sack's lantern on its left. tools/postCheck.mjs passes; before and after pictures were sent at 1920 x 1080 and 390 x 844.
- The Feed Sacks' market stall (requested by Brian, 2026-11-13: "turn the counter into a market stall. Skin only; no change to
  prices, odds or behaviour. Keep the voxel sacks, the tags' text and the odds slate"). It replaces the counter in the bullet
  above: `kit-counter`, the `sk-counter-*` rules, `COUNTER_PROPS`, `PropArt`, `SackArt` and the sack and prop thumbnails are gone.
  - What it is: one baked voxel picture per window shape, with a few live pieces laid over it. shop/stallPlan.ts measures the
    stall in voxels (no three, so the page can read it); shop/stallModels.ts builds it on the sacks' own voxel size;
    `?preview=stall` (shop/StallRender.tsx) shows one layer from the front, 0.2 rad above, under the thumbnails' three lights;
    `node tools/renderStall.mjs` (dev server up) bakes public/shop/stall/*.webp. Re-run it after changing the plan or the models.
  - In the picture: a barn red and cream awning with a snow bank on its ridge, two posts standing on the counter's ends, a dark
    back wall with two shelves of small sacks, jars and tins, a rope coil, dried corn and a string of onions hung from a rail, a
    chalkboard, a thick plank over a boarded front (upright boards, two rails, a cross brace in each bay between tags), a brass
    scale 14 voxels tall on the counter's left end, a barrel on the floor at the left and two stacked closed crates at the right.
    Everything on the back wall is painted bright and then shown 20% darker (`DIM`), so the sacks stand out.
  - Laid over it by FeedSacks.tsx (`Stall`, `StallSack`), all in percent of the stall's box so it scales as one thing: each sack
    in an open crate leaning 0.2 rad toward the buyer, heaped with its own grain (a tin scoop in the oats), as two pictures (the
    crate with its hard shadow, and the sack cut off where the crate stands in front of it) so a hover wobbles the sack alone;
    its paper tag on 12 px of string from a nail in the rail under the plank, all three nails at one height; the one lantern,
    which slides along to the picked sack's shoulder and swings once; the awning's scalloped edge; and the chalk "Feed Sacks ·
    250 each" with the coin, the number read from `SACK.price`. The sack model is `sackGrid`, unchanged, seen from the front now.
  - Picked: the crate steps 8 px forward in brighter light and its tag gets a 3 px amber ring. The soft ellipse shadows are gone.
  - Four stalls (`STALLS`), chosen by `useStallSize`: `wide` (desktop), `low` (window 940 px tall or less: drawn smaller and
    wider so the cards stay in view), `mid` (480 to 760 px wide), `narrow` (under 480 px: the awning, the counter's front, the
    crates and the tags, and nothing else). Each front panel is as tall as that window's tag needs; the tags' type is sized from
    the stall's width (`--tag`, container units), so a tag fits its panel at any width. Checked from 320 to 1920 px wide.
  - Motion: the awning's edge is two halves hung from the posts' ends that sag and lift in the middle through one degree in
    all (`sk-awning-sway`; the band it is sewn to is also in the picture, so no gap opens); a hovered sack wobbles 2 degrees.
    Neither runs under reduced motion, and the lantern does not slide or swing there.
  - Departures from the request, for Brian to overrule: the sacks face the front in their crates (the stall is drawn in one
    projection, and three crates do not fit a phone at the old three-quarter turn); the sacks' tied tops sit just behind the
    awning's edge; a phone and a tablet have no cross brace (their tags leave no bay for one); the stall is about 370 px tall
    on a desktop against the counter's 355, with the gaps round it trimmed so the first row of cards is still whole at 1080.
  - Tests: shop/__tests__/stall.test.ts (the plan, the models, the pictures, the page's rules). tools/postCheck.mjs and
    `npm run check:floating` pass. Before and after pictures were sent at 1920 x 1080 and 390 x 844.
- The fuse sounds are real sounds (requested by Brian, 2026-11-13: "make the sounds actually useable, i dont see them working
  both in the preview and in game"). Nothing was broken: the worn sound was reaching the game and the samples were playing.
  But all eight were one short beep at slightly different pitches, and every second before the last three was quieter than
  the music, so wearing one changed nothing a player could hear.
  - src/audio/fuseVoices.ts holds the eight voices, each a function of one second of a turn (seconds left, how far through,
    which second of the turn). Tin toy: a two-note chirp. Wood block: tick, then tock. Lullaby: a bell and the note it falls
    to. Cowbell: a clank through a band-pass filter. Sleigh bells: five small bells struck three times. Barn owl: a hoo, and
    a lower hoo in answer. Music box: Brahms's lullaby, one note a second, from the top of each turn. Tones only, no noise
    (Brian, 2026-11-08, of the music: "why is there static"). The ice chime, the free default, is exactly as it was.
  - Loudness: every calm second of the seven is now louder than the music (measured at the speakers in a real game: 0.26 to
    0.47 against the music's 0.06 to 0.25; they were 0.13 to 0.3). The last three seconds are louder, higher and doubled.
    None clips. A voice changes what a second sounds like, never when it sounds (src/audio/__tests__/sound.test.ts).
  - Sampling in the Trading Post goes through shop/sample.ts: one sample at a time (three calm seconds and the last three);
    a card's speaker is ringed in amber and beats while it plays, the closer look's button reads "Playing"; the music
    steps back to a quarter for the sample (`musicDuck`); a sample stops when another starts, when the closer look or the
    fair machine closes, when the tab changes or the Trading Post shuts. With sound switched off, tapping a speaker says so.
  - When a turn changes, sounds not begun never play and one still ringing fades in a blink (`hush` in sound.ts): the old
    clock cut them dead, which a long note like the music box's would have made into a click.
  - Checked by measurement, not by ear: tools cannot listen. Each voice was rendered with an OfflineAudioContext and
    looked at as a spectrogram and by level, and the game and the Trading Post were listened to through an analyser on the
    speakers. Brian should say if any of them sounds wrong.
- Music for every place (requested by Brian, 2026-11-13: "the calm lofi should only be in the start screen. once u go in the
  game, change it to something more intense ... ensure each gamemode and when u switch onto something else the music changes.
  while ur at it, refine the lofi, rn its a bit too boring and isnt very aesthetically pleasing"). He offered a track; none was
  needed: every song is written out in code and played live, as the lofi always was. No audio files, no noise.
  - Four files in src/audio. scene.ts says where the player is (no imports, anything may set it). musicKit.ts is the band:
    every instrument, drums included, made of plain oscillators. songs.ts is the seven songs, note by note, each asked for
    one bar at a time. music.ts is the player: it schedules a bar a moment before it starts and crossfades (about half a
    second) when the scene changes. PaintedApp sets the scene from the stores; the Trading Post sets an overlay while open.
  - The songs. home, "Lofi in the barn": 76 bpm, swung, eight chords (ii V I vi, IV iv iii VI), a walking bass, and a
    32-bar shape: the band comes in, a written tune on the vibes, its answer, then four bars with no drums. It was four
    chords with random notes. shop, "The Trading Post shuffle": a swung I vi ii V with a walking bass and a glockenspiel
    tune. lobby, "Waiting at the gate": the battle's key at rest; since 2026-11-22 (Brian: "too choppy and inconsistent, doesnt flow well") 92 bpm, eight chords, pads that overlap bar to bar, a held bass, a marimba rolling eighths the whole way, a vibes tune over bars 8-31, and a steady soft beat from the first bar. battle, "Pass the bomb" (Quick play, rooms, daily): A
    minor at 124 bpm, and it heats up with the round (`heatFor`): a galloping bass and an arp from round two, the tune
    from round three, 138 bpm and tom fills from round four; when the game is over it lets go to held chords.
    practice, "Clearing the ice": G major, a marimba, a whistled tune. tour, "Whistling for the sheepdog": C major, bass
    and chord by turns. dream, "Counting sheep": a lullaby in three, no drums.
  - Levels were set by measurement: each song rendered with an OfflineAudioContext (`renderScene`) and its A-weighted
    level and peak read off. All sit within about 3 dB of each other (the battle rises 4.5 dB from round one to four, the
    lullaby is the quietest); the old lofi measured about 4 dB under the new one. The home and shop songs pick up where
    they were left, so flipping between them does not replay an opening.
  - The sound menu says which song is playing. The fuse-sample ducking (`musicDuck`) applies to every song.
  - 2026-11-22 (a friend of Brian's: the sounds were "extremely annoying" and the music did not match the farm or move
    well between screens): the battle is a barn band now, not a synth (musicKit's synthBass, stab, chip and lead are an
    upright bass, a strummed guitar, a mandolin and a fiddle, all triangles and sines); Home is "Snow on the farm", the
    same chords with a brushed beat and sleigh bells; songs crossfade over about two seconds. Every sound effect in
    sound.ts is bells, wood and soft thumps in C major pentatonic: no square, no saw, no noise (the old bomb blast clipped).
    The menu's hover sound (`menuTick`) is one soft tick, the same for every item (2026-11-22: a falling note per item read as "bubbles ... it should be the same sound"). The player schedules bars 1.2 s ahead (`AHEAD` in music.ts; it was 0.3 s, and busy 3D frames made the music stutter). Measured offline against the old versions: the
    battle's energy above 3 kHz is a third of what it was; levels within about 1 dB of before. Not heard by me.
  - Tests: src/audio/__tests__/songs.test.ts (every note in key and in its bar, no two songs alike, none a short loop,
    the lofi's and the battle's shapes) and music.test.ts (the player, on a stand-in for Web Audio).
  - Checked by measurement and by spectrogram, not by ear. The notes are written to be right by the rules of harmony;
    whether they are good to listen to is Brian's call. To use a recording instead, a scene's entry in `SONGS` is the
    place: the player would need a branch that plays a file for that scene.

- Guests, lobbies and friends without an account (requested by Kai, 2026-11-13). Signed out, Quick play, Create lobby and Join party work: the
  browser keeps a random id (`sap:guest-id`) and the room connection and the API send `guest:<id>:<name>` (src/auth/guest.ts); the server accepts
  it in server/guest.ts (shape and name checked; chat on, results off, never a moderator). Every `auth: 'user'` route refuses a guest with 403
  `account_required` unless the route says `guests: true` (server/http.ts); only the guest friend routes do. Friends for guests: the list lives in
  the browser (`sap:guest-friends`, src/lib/guestFriends.ts); the server only relays requests in memory for up to two weeks and reports who is
  online (server/social/guestFriends.ts, server/routes/guestFriends.ts); a guest's friend code is an HMAC of their id (set GUEST_CODE_SECRET in
  production). Guests and account players are not friends with each other, a guest has no room invites, and a guest is not on the leaderboards
  (the boards are public to read; their stats are the browser's own). The red Friends / Boards / Shop row on Home is gone: Friends and Boards are
  buttons in the top bar (one Community button on a phone, where the bar is full), and the Shop tab is not offered there.
- The profile, refined (requested by Brian, 2026-11-13: "refine profile. for practice best, show multiple views or make something
  that differentiates the difficulties ... practice best could mean easy mode, medium, or hard mode, so its less rewarding to those
  who do well in hard mode. take in account the time as well. also refine the design here as well").
  - Practice bests: the one "Practice best" (the most words at any setting) is gone. `getPracticeSheet` in src/lib/practice.ts sets
    out the best for every bot (easy, medium, hard) and starting clock (15, 10, 5 s), read from the same `sap:practice-best`
    store as before, so nothing was migrated. Each best is rated: words, times 1.5 for the medium bot or a 10 s clock, times 2
    for the hard bot or a 5 s clock (`PRACTICE_WEIGHT`, `practiceRating`). The best-rated run is the "Practice rating": 12 words
    against the hard bot from 10 s (36) beats 31 against the easy bot from 15 (31); a tie goes to the harder bot, then the
    shorter clock. The weights are a judgement of mine, not something Brian chose or anything measured: change them there.
    Home's Practice tag and the setup's "Best here" already showed the best for the chosen setting, and still do.
  - The page: it is in the Trading Post's room now (`sk-room kit-wall`: the plank wall, the hung sign, the peg), not a cream
    `.sk-guide` panel. Who you are is a card pinned to the wall; your standing is chalked on a slate; your numbers are always
    six slips (Online wins says how to fill it when there is no account), three across on a desktop and two on a phone, so no
    row has a hole; practice is the rating on a card beside a chalk table, the best-rated cell ringed; the top 100 is on a
    sheet. A long longest word is set smaller to stay on one line. The `.sk-post-*` helper styles, used only by the old
    profile, are deleted.
  - Tests: src/skin/profile/__tests__/profile.test.ts (the sheet, the rating, ties, a damaged store) and
    practiceBests.test.tsx (what the page shows). Looked at from 320 to 1920 px wide, empty, with one run and with many.
    The signed-in parts (the board, Online wins) still cannot be opened in a browser on this machine: no sign-in here.
- The loading screen, plain and in the page (requested by Brian, 2026-11-13: "why is the loading screen not what pops up when
  the game is loading? also can u make it not a barn door and a little more plain i dont want any weird opening animation").
  SUPERSEDED the same day by "Back to the barn doors" at the end of this list: everything in this bullet is history,
  its "do not bring back doors" included.
  This replaces the barn doors and overrides two earlier notes above: the doors themselves (2026-11-08) and "not on a
  refresh" (2026-11-08). Do not bring back doors, a swing, a zoom or any other opening animation.
  - Why it was not what popped up, measured: (1) the loading screen was part of the game's code (2.2 MB, 660 KB gzipped), so
    until that had arrived the page was blank: about 3 s of empty purple on the live site at 4 Mbit/s; (2) a refresh skipped
    it on purpose and showed the menu over an empty sky for the 4 to 5 s the farm takes to build; (3) going into a game
    showed a dark blank, and the doors only after 0.8 s.
  - What it is: the night (#12152A), a few flakes, a small wood-framed window where the pixel sheep runs and leaps the snowy
    fence, and one line under it saying what is being got ready. No doors, beam, ropes, sign drop, door sounds or sway. It
    comes up with a 180 ms fade and goes with a 220 ms fade.
  - Where it lives: it is an element in the page itself. vite.config.ts (`withLoadingScreen`) writes src/skin/loading/
    markup.ts (plain text, no React) and loading.css into index.html at `<!--loading-screen-->`, in dev and in the build, so
    it is drawn with the page's first frame. No inline script: the built page's policy forbids one. loading.css must stand
    alone (no skin tokens but the ones it sets, nothing fetched, only transform and opacity animated); its tests check that.
    src/skin/components/LoadingScreen.tsx draws nothing: it drives that one element (`data-phase` in/up/out, `data-bare`,
    `hidden`, the line's text), so the sheep's run is never restarted when the game takes over.
  - When it shows: on every page load, first visit or refresh, until Home's farm has drawn (`showLoadingAtBoot`). Going into
    a game, practice, the tutorial, the dream or the results (`showLoading({ quick: true })`) it is the dark alone at first
    (`data-bare`), and the sheep and the line fade in if the wait passes GRACE_MS (500), then stay REVEAL_HOLD_MS (600) so
    they never flash. Pages that are not the painted game (the old look, ?preview=, #/legal, #/mod, a framed page) drop it
    as soon as the code runs (`dropLoadingUnlessShown` in src/main.tsx). The line never goes back: once a hold ("Building the
    farm") has shown, its line stays until the screen lifts.
  - Renamed: BarnDoors.tsx is LoadingScreen.tsx; playBarnDoors, shutDoorsAtBoot, whenDoorsShut, whenDoorsOpen, doorsShut are
    showLoading, showLoadingAtBoot, whenLoadingUp, whenLoadingLifts, loadingUp. `useLoadingHold`, `keysBlocked` and
    DRAWN_ATTR keep their names. Deleted: the voxel doors (doorsModel.ts, doorBoxes.ts, DoorsRender.tsx, ?preview=doors,
    tools/renderDoors.mjs, public/loading/doors-*.webp and their preloads), every `.sk-doors`, `.sk-door` and `.sk-load` rule,
    the audit's `.sk-door` allowance, the doorShut and doorOpen sounds, and sessionStorage sap:booted. pixelRuns.ts holds the
    run-length step that pixels.tsx and markup.ts share. tsconfig allows `.ts` in import paths because vite.config.ts and
    markup.ts need them (Vite's config loader warns without).
  - Left as it is: before the game's fonts arrive the line is in the fallback hand font and changes when Patrick Hand is in
    (the doors' sign did the same); the page cannot ask for the font itself without contacting Google Fonts on the old look.
    Still check typing at the table in a browser after touching this file (done: it types).
- Plain cards, no paper craft (requested by Brian, 2026-11-13: "fix all the obviously ai generated things throughout the
  site. ex) those stupid papers held up by pins"; he had said it before, 2026-11-09: "longest word should not be on a pin").
  I shot every screen at 1440 x 900 and 390 x 844 and took out the one family that read as machine-made: paper dressed up
  as a craft table. Do not bring any of it back, and do not add new fake fasteners or fake wear to flat interface panels.
  - `Paper` (src/skin/kit/index.tsx) is a plain card: flat, square, a clean edge, a 2 px corner. Its `pin`, `tilt` and
    `seed` props and the `ticket` kind are gone, with `.kit-pin`, `.kit-paper--tilt-*`, the torn bottom edge (`::after`)
    and `.kit-ticket`. That changed, at once: the missions, the profile card and its number slips, the practice fight
    card's two names, the message card over the input, the tutorial's word ideas, the dream's word slip, the Bell Shelf's
    "More soon" slips (also untilted) and the stall's price tags.
  - Missions (Bazaar.tsx): the cork notice board is gone (`.kit-cork`, `.sk-noticeboard*`); a heading with its hint beside
    it and one card each (`.sk-mission-list/-head/-cards`), like the profile's sections. A finished mission has a plain
    green "Done" label, not a tilted red rubber stamp (`.sk-stamp`).
  - The stall's tags (FeedSacks.tsx) no longer hang from a nail on a string or tilt; they are cards on the stall's front, in
    the same place (`.sk-stall-hang` keeps its 12 px so nothing moved).
  - Controls: `Lever` is `Switch` (`.kit-switch`: an ordinary switch, green and to the right when on) and `RopeSlider` is
    `Slider` (`.kit-slider`: a plain track, a square handle). The lever with its lamp and the rope with its bead are gone
    from Settings, the sound menu and the admin panel.
  - Left alone on purpose, and told to Brian so he can say if they should go too: wooden signs with their nails, ropes and
    snow (the title, the room signs, Quick play), the hang tags on the menu (DAILY, BEST 31), the knitted panels and
    stitched chips, the title's tilted update plate and Word of the day, the machine's tilted "New!" badge, and all the
    wording. The old look (?skin=classic) and the standalone #/legal and #/mod pages were not touched either.
  - To look at every screen again: my tour script is in the session scratchpad only (tour.mjs: home, each dialog, the
    Trading Post's tabs, the profile, a game, practice, the dream, the tutorial, at both sizes).
- Back to the barn doors (requested by Brian, 2026-11-13, after five rounds of loading-screen mockups: "nvm ykw lets just go
  back to barn doors"). This supersedes "The loading screen, plain and in the page" above. The plain screen and its files
  are gone (LoadingScreen.tsx, loading/markup.ts, loading.css, pixelRuns.ts), and the doors are back as 0.7.0 shipped them,
  restored from git, names included: BarnDoors.tsx (playBarnDoors, shutDoorsAtBoot, whenDoorsShut, whenDoorsOpen, doorsShut),
  the voxel doors and their pictures, the sign on its ropes, the swing shut and open, the door sounds, `.sk-doors` /
  `.sk-load` in skin.css, the audit's `.sk-door` allowance, ?preview=doors and tools/renderDoors.mjs, and their tests.
  - One thing is kept from the plain screen, because it answered his other question that day ("why is the loading screen
    not what pops up when the game is loading?"): the page itself comes with the doors drawn shut, so they are up before
    the game's code has arrived. vite.config.ts (`withBootDoors`) writes src/skin/loading/bootDoors.ts's markup into
    index.html at `<!--boot-doors-->`, and into the head the rules of skin.css between its `boot-doors:start` and
    `boot-doors:end` marks: the shut leaves, the beam, the drift and the snow, and nothing else. Those rules must stand
    alone (no tokens, no kit classes, no phase rules); src/skin/loading/__tests__/bootDoors.test.ts checks it. No inline
    script: the built page's policy forbids one. Measured on the built site at 4 Mbit/s: the beam and bare wood at once,
    the doors' picture at 0.7 s, the sign when the code is in at 1.8 s. The live 0.7.0 site is blank for about 3 s there.
  - The handover: BarnDoors' first pair (already shut) is the same picture from the same numbers, classes and snowflakes
    (`doorArt` and `FLAKES` in bootDoors.ts, used by both). On mount it sets each of its flakes to where its twin on the
    page's doors had got to, then removes `#boot-doors`, so nothing on screen moves; the sign dropping in is all anyone
    sees. Pages that are not the painted game (the old look, ?preview=, #/legal, #/mod, a framed page) take the page's
    doors away as soon as the code runs (`dropBootDoorsUnlessShut` in src/main.tsx).
  - So the doors are up on EVERY page load, a refresh included; `firstLoadThisTab` and sessionStorage sap:booted stay
    gone. The page cannot tell a refresh from a first visit without a script, and skipping the doors on a refresh showed
    the menu over an empty sky for the 4 to 5 s the farm takes to build. This still goes against his 2026-11-08 "not on a
    refresh"; he was told, and it is his to overrule (the way back: drop the page's doors at once on a refresh).
  - Everything else is the old behaviour: going into a game, practice, the tutorial, the dream or the results is the 180 ms
    dark fade, with the doors only if the wait passes GRACE_MS (800).
  - Not built: the mockups he looked at in between (the farm as a picture with snow, a title whose blanks fill in, a 1 to
    100% bar). Don't redesign the loading screen again unless he asks.
  - Checked in a browser at 1440 x 900 and 390 x 844, dev and the built site: the page's doors before the code, the
    handover (a flake at the same pixel before and after), the sign, the swing open, a refresh, the quick fade into
    practice, typing at the table, and the three kinds of page that drop the doors. tsconfig keeps `.ts` in import paths
    (vite.config.ts reads bootDoors.ts, which reads doorBoxes.ts).
- The doors are up only while something is loading (asked by Brian, 2026-11-13: "did u make sure that the loading screen
  genuinely only pops up when the game is actually loading? that seems to be a recurring problem ... make sure ... it isnt
  just blocking the website for no reason"). Measured on the built site, the doors' phases against the page's long tasks:
  - A page load: the doors cover about 4.4 s on Brian's Mac and the page is frozen building for 4.1 to 4.2 s of it (a
    profile: the barn and yard 1.3 s, the farmstead 1.2 s, the countryside 0.9 s, the rest three.js and React); they
    start to open 30 to 70 ms after the last of that work, and the menu takes clicks while they swing (1.15 s). So they
    hide real work and nothing else; the cost is the farm's build, on every load. Panels (Trading Post, profile) never
    bring them up. Into a game is the dark fade alone, 0.45 s; into practice 0.9 s.
  - One real fault, fixed. Building a 3D screen freezes the page, so the "has the wait passed GRACE_MS?" check could only
    run once the freeze was over: on a slower device (CPU slowed 4x) going into practice, the scene was ready at 2.4 s,
    the doors came down at 2.5 s, were held 0.7 s for their sign, and were off screen at 4.3 s. Now the wait counts only
    time the page was awake for (`waitedFor`, `FROZEN_MS` in BarnDoors.tsx: a frame gap counts for 100 ms at most), so
    a freeze that has ended never brings the doors down (the same run: clear at 2.7 s), and doors that do come down
    late are held only until they have faded in (REVEAL_HOLD_MS 240, was 700). They still come down for a wait the
    page is awake through (checked by holding a scene's `data-drawn` back: down 0.8 s in, open 30 ms after it drew).
    Tests: src/skin/components/__tests__/barnDoorsWait.test.ts.
  - Known and told to Brian: on a slow device the first run into practice is a dark, frozen screen for the 2 to 3 s the
    ice takes to build (no doors can be drawn in a freeze unless they are up before it starts); the page load is long
    on slow machines because the farm's build is (17 s with the CPU slowed 4x at desktop detail). Not measured: a real
    phone, the results screen after a full game, rooms. When touching the doors again, measure like this, do not
    reason about it: long tasks and `data-drawn` against the doors' `data-phase`, at 1x and with the CPU throttled.
- The tutorial, rebuilt for the painted game (requested by Brian, 2026-11-13: "refurbish the tutorial now, its very outdated
  both ui-wise and all around"). Skin only: no engine file changed, and the old look keeps its own (src/ui/Tour.tsx,
  tourSteps.ts, untouched; the e2e suite runs that one).
  - What was wrong with the old one in this skin, seen by walking it: it was the old look's card with `!important` paint on
    it, over a 72% black-out of the table; "The chain letter" and "Rounds and twists" pointed at elements this skin does
    not draw, so they ringed nothing; it spoke of a timer ring, a Hint button and an "even faster round" twist that do
    not exist; its hint book offered BEVOR, BRINERS and JOSHER; and the Enter that played your word also pressed Next on
    the card it brought up, so Traps was never seen.
  - What it is now: src/skin/tour. `steps.ts` is the script, ten steps: welcome, the letter, play a word, watch the chain
    (your word's last letter, the next sheep by name), the bomb is the clock, wool balls are lives, traps, faster rounds
    and twists, play once more, done. Every number and name in it is read from the engine (TRAP_LETTERS,
    TURN_MS_BY_ROUND, MIN_WORD_LENGTH, TWIST_TEXT, the player's lives), and a test fails if it mentions a ring, the pile,
    banking, steals, points or a Hint button. `info` steps stop the clock (the store's existing `pause`/`resume`) and
    wait for Next; `wait` steps let the table run until `done`, then `linger` a moment.
  - `PaintedTour.tsx` is the guide: one card in the kit's paper with the sheepdog on it, a step count and pips, a wood
    Next, and plain "Skip this step" / "Skip tutorial" links. It docks under the scoreboard where that is a board at the
    side (computer, tablet) and across the top under the bar where it is a row of names (phone); there, to point at
    your name in that row, the card steps down under it. An amber ring goes round what the card is about. While a card is
    read the rest of the screen dims by 36%, no more; on a step where you play nothing dims. Enter moves a card on, is
    taken before the word bar sees it, and is ignored for ENTER_GUARD_MS (350) after a card comes up and when held.
  - The ring's targets are the things themselves. The word bar, the round tab and your name are page elements
    (selectors in steps.ts; a test checks each still exists in the source). The letter board and the bomb are voxels, so
    `TourMarks.tsx`, mounted inside the barn's scene only during the tutorial, projects their boxes to the page every
    frame into `marks.ts`, which the guide reads. A step lists targets in order of preference and the first one the card
    is not lying over (under 40% covered) gets the ring; with none, no ring.
  - `ideas.ts`: the hint book's words must be ON the frequency list and in its first 8,000 (EVERYDAY_RANK), 4 to 7
    letters, and valid right now; `useWordInput` uses it and falls back to the engine's `suggestWords` until the list is
    in. The engine's picker treats a word the list has never heard of as common by its letters, which is where BEVOR
    came from; that function is unchanged.
  - The picture of the dog is the game's own voxel sheepdog, whole and sitting (a close-up of its head is a black
    block): `node tools/renderGuide.mjs` (dev server up) photographs ?preview=guide (tour/GuideRender.tsx) into
    public/tour/sheepdog.webp. Re-run after changing the dog. It has no Santa hat, on purpose, so it need not be re-baked
    when the season comes down.
  - Checked by walking all ten steps with Playwright at 1440 x 900, 1180 x 700, 820 x 1180, 390 x 844 and 320 x 568, by
    mouse and by Enter alone, plus the three ways out (Skip tutorial, Menu, Play a real game), the leave dialog over the
    card, and reduced motion. Tests: src/skin/tour/__tests__/tour.test.ts.
  - Not done, and told to Brian: the tutorial still cannot SHOW a bomb going off or a trap paying, because in the
    engine's tour mode bots never run out of time and nobody loses wool; that would be an engine change. The "How to
    play" text (src/ui/guideContent.ts, outside the skin) is also behind: its twist list names three of the eight, it
    says there are no accounts, and it describes a Daily Table the painted game replaced with Counting Sheep. On a
    320 px wide phone the wool-balls card has no ring (no room to step down).
- No traps (Brian, 2026-11-13, reading the new tutorial's Traps card: "idk why it says that getting someone killed will 'give
  you a wool ball' because that is not how the game works? if that is how the game works for some odd reason fix it
  immediately"). It was how the game worked, so it is an approved engine change: `setTrap` and `resolveTrap` are gone
  from reducer.ts, nobody ever gains wool (`gainWool`, `woolCap`, EXTRA_WOOL_CAP and TRAP_PAYOUT removed), and
  `GameState.trap` is always null; the field, the `trapSprung` event kind and TRAP_LETTERS stay so saved games and an
  older server's states still read. This supersedes "Traps pay a wool ball" and "won only from traps" in the bullets
  above. The engine tests that pinned the rule were rewritten to pin its absence. Every text that taught it is gone or
  corrected: the painted tutorial's Traps card (it has nine steps now), the old look's tour step and rules table, How
  to play (basics, glossary, questions), the rules card, the coach tip, the menu tip, and "X's trap wins one" under the
  time-out notice. The letter board is never the trap's block of ice (`isTrapLetter` is always false). Rooms run the
  engine on the server, so multiplayer keeps paying traps until the server is deployed with this change.
- Real people by default, the Play chooser, and the game after the tutorial (Brian, 2026-11-13: "quick play and play should
  not bring you into bot lobbies ... when u press play, it gives u two options that pop up on ur screen, casual and
  ranked ... make the 'after tutorial first game thing' queue them into a real game not a bot lobby").
  - Home's menu: Quick play (the casual queue) and Play (opens the chooser) are always online. Custom game (id `custom`)
    is the bot table; with Practice and the Tutorial it is the only way to play farm sheep. In a copy of the game with no
    server address (plain `npm run dev`), Quick play and Play stay on the menu and say why they cannot be used
    (`NO_SERVER`); they never fall back to a bot game. `enterOnline` (src/skin/rooms/enterOnline.ts) is the one way
    into the server for the menu, the chooser and the tutorial.
  - The chooser is src/skin/ranked/PlayChooser.tsx: two cards over the menu. Casual is cream paper with the farm by day
    (public/play/casual.webp, the home tour's sheep-at-the-barn shot); Ranked is slate edged in gold with the practice
    duel on the ice at night (public/play/ranked.webp), the ladder of eight badges, your rank, and a red button. With
    real sign-in and nobody signed in, the Ranked card's button is "Sign in to play ranked". Both pictures are captures
    of the game's own scenes; re-capture them if those scenes change much.
  - The tutorial's last card: "Play a real game" ends the tour and calls `enterOnline({ t: 'quick' })`; so does the
    first-run "Skip, find a game". With no server the card has only "Back to the menu".
- Ranked (Brian, 2026-11-13: "make a ranked gamemode ... give the ranked system an elo system in which people can rankup,
  make 8 divisions of ranks for now, copying the valorant/brawl stars ranking system to an extent (different names
  obviously just the structure)").
  - The ladder and the maths are one file, src/lib/ranked.ts, read by the server and the game. Eight ranks: Lamb,
    Yearling, Shearling, Ram, Bellwether, Shepherd, Blue Ribbon, Golden Fleece. The first seven have divisions I, II,
    III of 100 points; Golden Fleece starts at 2,100 and is open-ended. A rating is the points: it starts at 0, never
    goes below 0, and moves by Elo after each ranked game (K 32, scale 400), every player compared with every other by
    finishing place and the sum shared over the opponents, so a table of four moves a player about as much as a duel.
    Added to plain Elo, as those ladders do, so that playing moves a newcomer up: a loss costs nothing in Lamb, half in
    Yearling, three quarters in Shearling (`lossShare`), and coming first alone always gains at least a point. All of
    these numbers are MY first guess, not Brian's: he asked for the structure. Tune them in that file.
  - Server: `rankedJoin` in server/rooms.ts is the ranked queue (message `{ t: 'ranked' }`). A ranked room seats 2 to 4
    people and no farm sheep (the engine's `GameSetup.minPlayers`, a small engine addition: default 4, ranked passes
    2), plays DEFAULT_ROOM_SETTINGS, and starts itself in `tick`: RANKED_WAIT_MS (20 s) after its second player sits
    down, RANKED_FULL_WAIT_MS (4 s) after its fourth; the count stops if it drops to one. Nobody hosts it: start,
    options, kick and mute answer `ranked_room`; it cannot be joined by code, by Quick play or from the public list.
    Guests and players whose results are not kept are refused (`account_required`). When it ends, `rankedPlaces`
    orders everyone who sat down (last standing first, then by who was out later; walking out counts from that moment,
    whatever the farm sheep that takes the seat does) and server/ranked/service.ts reads the stored ratings, applies
    `ratingChanges`, stores them (Memory or Postgres store, db/migrations/106_ranked.sql) and the room view carries
    `rated` to the table. GET /api/ranked is your rating; GET /api/ranked/top the best 100 by name with your place
    (built, not yet shown anywhere in the game). A browser never sends a rating or a result: the server rates only games
    it ran.
  - Game: `RankBadge` / `TierBadge` (src/skin/ranked, art in badge.ts: a rosette that grows with the rank, each rank its
    own shape and colours, a test checks no two are alike), `useRanked` (your rating), `RatedSlip` on the results board
    (+16 points, rated 1st of 2, the new rank, "ranked up!"), `ProfileRank` on the profile, and PaintedRoom's ranked
    queue (no gate button, a countdown against the server's clock, each player's rank by their name, no host tag).
    The leave dialog in a ranked game says leaving is a loss.
  - To go live it needs BOTH: migration 106 run on the database, and the game server deployed (the "Deploy server"
    workflow is manual and has not been run since before 0.7.0). Until then the live site's Ranked card answers
    "Ranked is not switched on for this server yet".
  - `npm run dev:online` now gives the local server ALLOWED_ORIGINS for http://localhost:5173, because the server's API
    answers a browser only from named origins: without it the profile's board, your rank and friends could not be read
    locally. Dev sign-in tokens count as accounts, so ranked can be played locally between two windows.
  - Checked by playing: two Playwright windows through the chooser into the ranked queue, the countdown, a two-seat
    table, to the results and the new rating (winner +16, loser +0 in Lamb); one leaving mid-game (rated last, the
    stayer first); leaving the queue (the count stops); the chooser and profile afterwards; the casual queue unchanged;
    the tutorial's last card landing in the casual queue. Desktop and phone. Tests: src/lib/__tests__/ranked.test.ts,
    server/ranked/ranked.test.ts, src/skin/ranked/__tests__/ranked.test.tsx.
  - Not done, and told to Brian: no matching by rank (the queue seats whoever is waiting, so a Lamb can meet anyone);
    the top-100 ranked board has no screen yet; no seasons, placement games or decay; a casual Quick play queue still
    needs its first player to press "Open the gate". The bundle is 3.5 kB under its size limit after this.
- A shorter menu: the profile is the name box, and Create lobby is also Custom game (Brian, 2026-11-14: "theres way too many
  buttons now. make the profile thing not a button below the quickplay but that box in the top left, just embed it in
  there. make custom game and create lobby the same thing. in create lobby they can choose whether to ADD bots. so they
  can play only with bots, only players, or bots and players, like super smash bros"). Home's menu is eight items:
  Quick play, Play, Create lobby, Join party, Counting Sheep, Practice, Tutorial, Trading Post. Don't add a ninth
  without asking.
  - The profile: the plank with your name (top left on a computer, over the menu on a phone) is one button now
    (`profilePlate` in PaintedHome.tsx, `data-profile`): avatar, name, and "Level N · Profile" under it. The Profile
    menu item is gone.
  - Farm sheep in a lobby. `RoomSettings.bots` (server/types.ts) is the host's number, 0 to MAX_BOTS (7), with
    `botLevel` easy/medium/hard; `setOptions` takes both, `botsFor` says how many sit down (never past the table's ten
    seats), and a game needs two at the table counting them. So: bots only (one person, farm sheep added), people only
    (0 farm sheep; two people are a table of two), or both. `bots: null` is the old rule, kept for the Quick play queue
    and an untouched lobby: farm sheep fill the table to four and two people are needed. This supersedes "farm sheep
    fill the table to 4" (2026-11-11) for a lobby whose host has chosen; a ranked table still never has any.
  - The lobby screen (PaintedRoom.tsx, helpers in rooms/lobbyBots.ts): a "Farm sheep" section with one fewer / how
    many / one more and, with any, the level; everyone else sees it as a line. The gate's caption says what the table
    is ("You and 3 farm sheep", "2 players, no farm sheep", "2 players and 1 farm sheep") and, alone with none, "Add a
    farm sheep to play now, or send the party link and wait for a friend." A first lobby opens with three medium farm
    sheep (a table of four, one press from a game); after that it opens the way this device's host last left it
    (`sap:lobby-bots`, sent with `create`). An older server sends no `bots`: the section is hidden and the old caption shows.
  - Alone with farm sheep, the game is dealt ON THIS DEVICE (`playAlone`): the lobby is left and the same solo game
    Custom game used to deal starts (`store.start('quick', rules, level)` with `playerCount` and the new
    `minPlayers: 2`). That is deliberate: it starts at once, and it keeps paying Wool Coins and XP and counting on the
    profile exactly as Custom game did, which a room game does not. It must be dealt a tick AFTER the room is gone:
    the handler for the server's `left` clears the table right after clearing the room. With anyone else in the lobby
    the server runs the game as before.
  - With no game server, Create lobby opens the old "set the table" panel for a bot game on this device (there is no
    lobby to open). The panel and its "Sit down" stay for that.
  - Checked by playing all three on a private server (bots only: three seats, two of them farm sheep at hard; people
    only: two seats; both: two people and one farm sheep), the remembered choice, the friend's view, and the menu and
    profile box at 1440 x 900 and 390 x 844. Tests: server/lobbyBots.test.ts, src/skin/rooms/__tests__/lobbyBots.test.ts,
    and the menu checks in src/skin/ranked/__tests__/ranked.test.tsx. Like ranked, the lobby's farm sheep need the game
    server deployed; until then the live lobby keeps the old fill-to-four rule and has no bots control.

- The lobby: a beam on top, three boards of the Trading Post's wall along the bottom (Brian, 2026-11-14). It took
  nine rounds, and his words on each are the rules for this screen:
  1. "clean up the ui for the create lobby/room thing". I regrouped the cream card and swapped its chips for flat
     joined buttons: "this still looks horrendous wtf? what is this ui? what did u even change".
  2. I rebuilt it as text and signs laid loose on the scene (room name on a hung plank, the code as tiles on strings,
     options as carved rows on the wash, roster and chat as dark plates in two corners): "the formatting is just plain
     terrible. chat is just randomly placed in the corner, you used a sign for the room name for some reason? the code
     is also weirdly placed and unncessiarly terrible looking. everything is unclear".
  3. I drew three layouts over the real lobby and asked; he chose "layout 1 but make sure the ui isnt just full black.
     that doesnt mean reuse the previous christmas pattern thing btw".
  4. to 9. Then the material, six more rounds: CSS wood ("it looks like slabs of cardboard, theres zero texture or
     depth"), wood baked from voxels ("go bac kto the grey thing just make it better"), slate baked from voxels ("no
     remove this ugly blocky thing bro ... 5 mockups firstly"), five smooth grey styles ("5 more unique mockups doesnt
     have to be gray"), five in other colours ("none of the given mockups are coherent with theme and aesthetically
     pleasing"). What worked was to stop inventing: three mock-ups made only of the Trading Post's and the profile's
     own pieces, of which he chose the one with dark stitched plates ("do something similar to B"), with notes.
  What is built (PaintedRoom.tsx, rooms.css; everything is the game's existing kit):
  - Boards: `kit-wall` (the Trading Post's plank wall) with a dark edge, a title on a small wooden sign
    (`kit-plank--label sk-room-heading`, the profile's section heads) and beside it a hint in the hint's hand.
  - `.rm-bar`: a beam (`kit-beam`: horizontal grain, iron straps at its ends), snow on it, the lights hung under it.
    Leave is a wooden tab; the room's name is plain lettering (never a sign); the party code is on a small wool
    plate (press it to copy the code) beside a lit "Copy invite link" tab. A queue shows its count on that plate.
  - `.rm-dock`: three boards of one height. Players: a line each on the wool (`Slate`), two abreast, ruled like the
    ledger, a cross to take a farm sheep out, "Add a farm sheep" and (signed in) "Invite a friend" as the last
    lines. Game: carved labels with `Pick` tabs (`.rm-tab`, lit gold with `kit-lit` when chosen); "Change" turns the
    rows to Turns a round / Wool balls / Round twists. Chat: the classic ChatPanel on the wool.
  - His notes on B, each a rule now:
    - "make the chat a little better, i dont like how crammed and hard to see it is. the name and text should be
      clearly differentiated": the rules banner is two small lines, the log takes the height left, a message has
      space round it, the speaker's name is a coloured tag (gold for you: `data-me` on the row in ChatPanel; blue for
      others) and the words are plain beside it; Report / Block / Mute / Kick show when the line is pointed at.
    - "make the nametags different too, dont make them wood. make them the nametags that are used in the gameplay":
      the signs over the animals in the pen are the table's `.sk-plate` (PenStage), not planks.
    - "change the font for the line 2 turns a round.... and 3 players and 3 farm sheep, or at least change how it is
      placed. rn it just looks like floating text on the wood": no loose text on the wall. The rules are on a wool
      plate with a "Rules" label; the table's count is written on the gate sign under "Open the gate" (guests read
      "Waiting for ..." on a plate). Body face, not the hand.
    - "make sure the snow actually looks proper ... it just looks like a long horizontal slightly wiggly line":
      `kit-drift` (kit.css) is mounds with a blue shade and drips, drawn at its own size and repeated, never
      stretched. Do not put the stretched `SnowCap` on anything wide.
    - "on the top, the little lights are horrendous": `Garland` is a wire in swags with glass bulbs hung under the
      beam (it was a straight wire of squares across the top of the screen, over a layer of falling dots, which is
      gone: the pen has its own snowfall).
    - "make that top bar ... all better. it still has the problem of just looking like a plain wooden slab": the
      beam, straps, plate and tabs above.
  - Then the formatting (10th message: "fix the formatting issues, everything looks great. though. for example, the
    +add a farm sheep, the way the game length, farm sheep are easy medium hard, text being squished and stop using
    the . thing to seperate text. also, refine how you are placing players, game, and chat. take screenshots as you
    go and see if anything is weird, ex) something moves if you press a button"):
    - No middle dot (·) between phrases, here or in anything new. Phrases that belong side by side are separate tags
      (the rules plate's `rm-rule-tags`), or parted by a thin rule (the Players hint), or are a sentence.
    - "Add a farm sheep" and "Invite a friend" are buttons on a foot under the list (`rm-seats-foot`), not lines of it.
    - Game rows are a grid: a label column, then tabs of equal width, in line down the rows. The Farm sheep row is
      always there; with no farm sheep its tabs are dimmed, so nothing shifts when the first one is added.
    - The three plates start and end on the same lines; the columns are 1.2 / 1.1 / 0.95 (names need the room).
    - Nothing moves when something is pressed. Tabs brighten and darken, they do not nudge. A label that changes for
      a moment ("Copied!") is laid over the usual one (`Swap`); Mute/Unmute and Kick/Sure? have the width of the longer
      word; the gate has one height whatever it says. On a phone the players' wool has one height and its list scrolls
      inside, and the beam has no straps (the copy button had run off the screen's edge, and pressing it slid the page
      sideways).
    - How it was checked, and should be again after any change here: a script that presses every button in turn,
      screenshots each step and compares where the boards, plates, rows, tabs and gate are before and after
      (scratchpad `lobby/steps.mjs`, desktop and phone, against a private server).
  - Do not offer again: paper cards here, flat black, the knitted or fair-isle pattern, voxel-baked (blocky) panels,
    or a style not made of the kit. For any new screen, start from the Trading Post and the profile.
  - A phone: the bar, the pen showing under it, then Game (so the gate is reachable), Players, Chat, scrolling as one
    page. `.rm-plates` has `z-index: 0` so the name tags stay under the boards.
  - Hooks unchanged (`data-room-code` is now on the code button, `data-bots-less` on the last farm sheep's cross,
    `.rm-stepper-n` is the count in the Players title); behaviour unchanged.
  - For the next screen he calls ugly: every group in a titled container, on one grid, nothing loose in a corner; and
    when a first attempt misses, show two or three layouts drawn over the real screen and let him pick before building.
    Make every mock-up out of pieces the Trading Post and the profile already use, and say which.
  - Opening the lobby builds the pen's scene on the main thread: measured about 1 s on this machine (the lobby's
    panels are up first). Trees are not refined and the fine ground is only round the pen for that reason; refining
    the eight tall pines made it nearly 2 s.
- The lobby's pen: a pen in a mountain meadow, alive (Brian, 2026-11-14, in two messages: "make the scenery for the
  pen thing bigger and better. make all the sheep be walking around instead of just starting at the ground, make them
  eat grass from the ground occasionally, make the scenery in the back better, etc. also make it look more like an
  actual pen", and then, when I had put a barn and a silo behind it: "i said to make the pen better, higher quality
  firstly no house, just make it more natural scenery everything needs to be better").
  - No buildings, and nothing made by hand outside the fence. Do not add a barn, house, silo or snowman back.
  - `src/skin/scene/pen.ts`: the pen is 10 x 6 m with a low three-rail fence (snow on the back and side rails, the
    front rail bare so it does not hide the animals), a shut braced gate with a lantern on its post, a hay rack and an
    iced trough on the back rail, a straw-bedded floor (white sheep show against it) and ten tufts of grass
    (`PEN.grass`). Round it: tall pines framing the sides, young ones in the meadow, boulders, low bushes, dead grass
    through the snow, the ground rising (`hill`) to a wooded ridge, a mountain range 300 m off, and a low moon over a
    saddle in it (PenStage; the sky's own moon is too high for this shot).
  - `penShot` stands at 2.7 m, nearly level, 19 m back: lower and the fence hid the animals, higher and there was no
    country in the picture, only ground. The fog is thin (0.0042) so the mountains show. `shift` in PaintedRoom lifts
    the picture clear of the panels.
  - `src/skin/rooms/penWander.ts` (`roam`, tested): each animal stands, walks to a place (of four tries, the one with
    most room), stands again, and about half the time walks to a free tuft and grazes 4 to 9 s. They keep 1.3 m apart
    and inside `PEN_WALK` (clear of the rack and trough). `PenStage`'s `Animal` moves players' animals and farm sheep
    alike; a player's still hops on arriving and looks at you when it stands. Reduced motion: nobody walks.
  - `Sheep` has a `walk` state (an amble, `WALK_HALF_STEP`), timed to `WALK_SPEED`.
  - This file ships to every player and the bundle size check has 0.02 kB of headroom left (`npm run size`). Only what
    the shot can see is built; to add anything, take something out, or raise the budget deliberately (Brian's or
    Kai's call, in scripts/check-bundle-size.mjs).
- The lobby calls a bot a bot, and the rules have room (Brian, 2026-11-14: "can you make it more clear that farm sheep
  are bots? also, the stuff 'two turns a round, 3 wool balls, twists on' is really cramped in ther"). This supersedes
  the lobby wording in the two bullets above ("Add a farm sheep", "3 farm sheep", "You and 3 farm sheep").
  - Every place the lobby counts, lists, adds or sets them says "bot": the Players hint ("3 players | 3 bots"), the
    button ("Add a bot"), the Game row ("Bot level"), the gate's caption (`tableLine` in rooms/lobbyBots.ts: "You and
    3 bots", "2 players, no bots", "2 players and 1 bot") and "Add a bot to play now, or invite a friend." A bot's
    line in the list is the sheep's head, a grey BOT tag (`Tag tone="gray"`), then "farm sheep" in a smaller hand: the
    tag comes first and is never cut. The small " bot" after "Farm sheep" that this replaces was too quiet to notice.
    Where a column is too narrow for the words they step out whole (a container query on the line), because cut
    short they read "Farm she...". The table itself still tags them "farm sheep" in its scoreboard; he has not asked
    for that to change.
  - The rules: my first answer was three cells, a figure over what it counts, with "Change" at the plate's end. He
    looked: "bruh the formatting is still trash, the text is squished still '2 turns,' that row". Two causes. (1) A
    bug of mine: the kit's own rule for a small plate (`:root[data-skin="painted"] .kit-slate--mini .kit-slate-face`,
    padding 3px 12px) out-ranks a three-class selector, so the padding this file gave the plate never applied and
    its text had 3 px over and under it, in that round and the one before. The plate's rule is now five classes
    long (`.rm-screen .rm-game .rm-rules.kit-slate .kit-slate-face`); check a plate's COMPUTED padding, not the file.
    (2) Three facts and a button do not fit one strip of a 350 px board. I drew three layouts on the real lobby
    (one line with bigger words; three big tiles; three lines) and he chose the one line.
  - What is built: one line on the wool, "2 turns a round | 3 wool balls | Twists on", 14 to 15 px with the figures in
    gold, a dashed rule between, about 10 px over and under. The host's button is "Change rules" / "Back" in the
    Game board's head, beside "about 8 min" (one width for both words, so the minutes do not move); "Change" on a
    phone 380 px wide or less, where each option's label also goes over its buttons. On a plate under 318 px wide
    " a round" steps out so it stays one line. Ranked's extra facts are a sentence under the plate. Do not put the
    button back on the plate, and do not shrink this text.
  - The Game board had no height to spare: the gate was already 6 to 12 px into the board's bottom padding. The
    notices' empty box no longer costs its 8 px gap (`.rm-start > div:empty`), and the boards are at least 366 px
    tall (326 in a short window).
  - The Players list is ONE column under about 1340 px wide on a computer and under 540 px on a phone: in two
    columns the host saw "W..." for Wolfgang beside Mute and Kick. Past six or so it scrolls inside its plate.
  - Found by measuring every window size, not the two I had been shooting (1440 x 900 and 390 x 844), and fixed:
    the gate's caption was squashed in a short window (the gate is 62 px there now); "Standard" and "Medium" ran out
    of their buttons between 900 and 1300 px wide (the Game board is the widest of the three there); on a 320 px
    phone the option buttons ran into each other. After changing this screen run the widths script as well as the
    press-every-button one: both are in the session scratchpad only (lobby/widths.mjs, lobby/steps.mjs). The widths
    script reports, for 33 window sizes as host and as guest: anything cut, the gate against the board's padding,
    and the space over and under the rules.
  - The copy buttons hold their width in the stylesheet now (`min-width` on the tab and the code), not with a
    wrapper component: it paid for this change in the bundle, which has 0.05 kB of headroom.
- No friends list (Brian, 2026-11-14: "remove friend feature"). This supersedes "Guests, lobbies and friends without an
  account" (Kai, 2026-11-13) for everything about friends; guests still play, make lobbies and join them. Removed, in the
  game and on the server: the list, friend codes, requests, the online dots, room invites (the `invite` / `invited` /
  `inviteResult` messages), the Friends button on Home, "Invite a friend" in the lobby, the old look's Friends tab and
  "Invite friends", `/api/friends*` and `/api/guest/friends*`, `GUEST_CODE_SECRET`. Do not rebuild any of it unprompted.
  - A room is reached by its code or its `?join=CODE` link. "Friends only" is still the name of a private lobby and the
    menu still says "invite friends with the party code": that is the code, not a list.
  - Left on purpose, and told to Brian: (1) the two tables of migration 103 (`friend_codes`, `friendships`) stay in the
    database with what players stored; nothing reads them, and deleting an account still clears that person's rows
    (`server/social/friendRows.ts`, the one thing left of the feature). Dropping them deletes those lists for good:
    his call, a new migration. (2) A signed-in browser still keeps its connection to the game server open in the
    background (it used to carry invites); it was not touched because real sign-in cannot be opened on this machine
    to check. (3) `sap:guest-friends` may sit in old browsers; harmless.
  - The old look's community window (src/ui/social/Hub.tsx) is Boards and Shop; the e2e specs (community, a11y,
    security) and the server tests that covered friends now pin their absence. scripts/smoke.mjs checks the friends
    addresses answer 404 and the two public boards answer.
  - Like every server change since 0.7.0, the removal reaches players only when the game server is deployed; until
    then the live server still has the friend routes, and the new game simply never calls them.
- The leaderboards page (Brian, 2026-11-14: "refine the leaderboards"): src/skin/boards (Leaderboards.tsx, boards.css),
  opened by the trophy button in Home's top bar (`data-boards`; there is no button without a game server). It replaces
  the old look's "Community" window in the painted game.
  - A full page in the Trading Post's and the profile's room (`sk-room kit-wall`, the hung sign, the peg, the wooden
    tabs with the picked one lit, label signs with a gold hint): nothing invented. Three boards: Ranked (GET
    /api/ranked/top: rating, the rank it earns, a badge on every line), Wins (GET /api/leaderboard/:period, metric
    wins; "when" buttons Today / This week / All time) and Level (GET /api/barn/top). No Daily Table board and no
    Points board: the painted game has no Daily Table and no points, so both would be empty for good.
  - The top three are always three cards (`kit-paper`) with a gold, grey or flame hang tag ("1st", "2nd", "3rd"), the
    winner's a little taller with a gold edge; a place nobody holds says "Open". Everyone after them is a ruled line
    on the wool (`Slate`), your own line lit with a "You" tag. A card beside the list (above it in a narrow room)
    says where you stand on this board or how to get a place, and holds "Show me on the leaderboards" for an account
    that may be listed (the old window's switch; it is the only place to hide).
  - Nothing moves when a tab or a "when" button is pressed, at any size: the room has one height (88vh), the head row
    one height (on a narrow room the hint and the "when" buttons share one 44 px row), the three cards and the card
    about you one height each whatever they hold. On a phone the three cards stack, one line each.
  - Read without a login: the server has two new public addresses, GET /api/ranked/board and /api/barn/board (limited
    per address; names and scores of the players the other boards would name, no ids, nobody's own place). Signed
    in, the page asks the old addresses, which also say where you stand. A server from before this page answers 404,
    and the board says "This board is not switched on for this server yet" (so on the live site, until the server is
    deployed: Wins works for everyone, Level for signed-in players, Ranked for nobody).
  - Checked by scripts in the session scratchpad only (boards/moves.mjs: every tab and button at sixteen window sizes,
    anything that moves or is cut; boards/shots.mjs: full made-up boards and the computed padding of each piece;
    boards/real.mjs: a real ranked game on a private server, then the winner's, the loser's and a stranger's page).
    Tests: src/skin/boards/__tests__/boards.test.tsx, server/routes/boards.test.ts.
  - Not done, and told to Brian: the Wins board cannot say where you stand unless you are on the list (the server
    gives no place for it); the profile still has its own top-100 by XP; nobody has looked at it signed in with a real
    account (no sign-in on this machine).
- The leaderboards' stage (Brian, 2026-11-14, of the page above: "make the leaderboards more glorified and unique while
  still staying in the farm-ish style. it should feel like 'wow i wanna be up there someday, those guys are so cool'").
  The head of every board is the game's own victory podium, live: src/skin/boards/BoardStage.tsx mounts
  table/Podium.tsx (the stage he art-directed on 2026-11-08) with the board's first three on its gold, silver and
  bronze timber. Each has its own dance, the first holds the golden trophy up, the lantern beams sweep, straw and
  confetti drift. It is the very place a player stands when they win a game, so nothing in it is invented.
  - A place nobody holds is a block standing empty (`PodiumEntry.vacant`): an empty board is an empty podium waiting.
  - The server's boards carry names and nothing else, so everyone on the stage is the sheep; only you, if you are up
    there, wear your own avatar. (Showing other players' animals would need the server to keep avatars; it does not.)
  - Podium.tsx gained three OPTIONS and nothing else: `shot` (a fixed camera; the stage's is close and level, fov 24),
    `plates={false}` (no nameplates: at this size three plates run into each other, so the names are on the cards
    under the stage) and `memory` (its own remembered resolution). Without them it is the victory screen exactly as
    before; a test pins the defaults, and a real ranked game was played to the victory screen to check it.
  - Layout: the stage with the three name cards under it as its base, in the order they stand (2nd, 1st, 3rd; the
    champion's card carries the cup); the card about you beside the stage on a computer (between the cards and the
    list in a narrow room); the list from fourth place under them. One grid (`.sk-lb-cols`, three areas).
  - The stage is its own lazy piece: the page is up first (about half a second), the stage about a second later
    (the box says "Setting the stage..." meanwhile), then 60 frames a second at a computer's and a phone's size on
    this Mac. Home's farm stops drawing behind the page (`paused`, as behind the Trading Post). Nothing moves when a
    tab or a "when" button is pressed, at fifteen window sizes; under reduced motion the animals stand still.
  - Keep `useIsMobile` / `useMotionLevel` out of Leaderboards.tsx (they are in BoardStage.tsx): they need a browser,
    and the page's test renders it without one.
  - Not measured: a real phone. The bundle has 0.68 kB of headroom after this.
- The leaderboards in the sky (Brian, 2026-11-14, third round: "formatting is bad, take screenshots as u go and assess the
  issues. also, dont make the scenery for this one a barn, maybe place them up on pedastals on the sky with nonchalant
  poses, like 3rd place sleeping on his belly with his legs dangling off the pedastal ... what i mean by formatting issues
  is empty space, generic white cardboard looking like pieces, etc, find them all and redo"). This supersedes the layout,
  the stage and the cards of the two bullets above; their boards, addresses and data stay.
  - How it was found: the old page was shot at seven sizes and every state (scratchpad audit/), five reviewers with
    different lenses listed 76 problems (51 after merging, every one upheld by three skeptics), five readers mapped the
    code, three designs were written and judged, and the build followed the winning one ("a place, as the lobby is").
  - It is a place, not a dialog: `.rm-screen.sk-lb`, fixed over Home. The sky is the whole screen; a strapped beam
    (`kit-beam kit-drift`, the Garland under it over the sky only) carries the three boards' tabs (`rm-tab`, lit
    `kit-lit`), the page's name in plain lettering and the close peg; one plank board (`rm-panel kit-wall kit-drift`) on
    the right holds the label sign with a short hint (or, on Wins, the Today / This week / All time tabs), the list on
    dark stitched wool (`Slate` `rm-wool`) with a column head, and your plate at its foot (`Slate` with the ledger's
    amber ring). No `kit-paper` anywhere (a test checks the markup, source and stylesheet).
  - The sky (src/skin/boards/BoardStage.tsx, lazy): the farm's day dome pressed flat (`Dome`, now exported from Sky.tsx;
    no snowfall), the podium's own blocks a metre taller (`blockGeometry(place, lift)` and `carvedGeometry`, the only
    change to Podium.tsx: two exports and the lift) each on a dream island (`island('windmill', ...)`), the dream's cloud
    sea far below, four drifting snow-cloud puffs, the trophy standing on first's pedestal. The dream's cloud is lilac;
    here `whiten` keeps a quarter of its tint and a soft sky-blue glow (`cloudMaterial`) lifts the shadowed steps, or
    it read as grey stone. The camera is solved from the free part of the screen (`.sk-lb-window`) so the three fill it
    at any size, and the names hang on their pedestals by `ScreenAnchor`.
  - The poses are three new Sheep states (Sheep.tsx: `flop`, `perch`, `lounge`), held to the same checks as every other
    pose for all six animals (src/skin/table/__tests__/loungePose.test.ts, a copy of animalPose.test.ts with its own
    list). Third: `flop`, asleep on its belly along the front edge, its near legs hanging down the front, head lolled
    over the corner, slow breath, legs swinging, "z" letters (`.sk-lb-z`). Second: `perch`, sat on the front edge,
    legs dangling, heels kicking, chewing, looking off. First: `lounge`, leaning back three-quarters to us with the cup
    beside it, chin up, a slow blink, drawn a size up (1.22) at the front of a taller pedestal (2.9 m, `lift` 1.4) so it
    is the biggest and highest of the three (second, on the very edge and nearer the camera, drew bigger before). First
    side-on was tried and hid its face and the cup: do not turn it away.
    Everyone up there is the sheep at coat 2 (coat 3 and 4 hide the legs), except you, in your own avatar.
  - Names: the table's own name tag (`.sk-plate`; the champion's in the speaker's berry) with the figure on a small wool
    plate of the same width under it, hung in the middle of the timber between the numeral and the island. Never wider
    than the pedestal, never narrower than 124 px; a name of ten letters or more is set smaller. An open place hangs the
    same tag reading "Open" and a plate "Could be you". On a phone (560 px and under) the tags only.
  - The list: from 4th (the three are on the pedestals), from 1st with medal tags on a phone. It scrolls in whole lines:
    the page measures the wool and stretches each line a little so a whole number fills it (`--lb-row`, an effect in
    Leaderboards.tsx); no line is ever cut at the top or the foot. Under the last line the rest of the wool is one message
    under a cup ("From 3rd place on, every place is open. Play to take one.", "Every place is open.", "Asking the
    barn..."), never ruled empty rows (they read as a broken spreadsheet). An empty board, or a board not switched on,
    says it once on a wool plate at the foot of the sky (on a narrow screen, on the list's wool instead, or it lay over
    the pedestals' tags). Every board has the same four columns (place, name, a small fact in words: the rank, "107
    games", "Level 41"; the big figure), so nothing moves sideways between tabs; the head is set in the lines' own size
    and keeps their scrollbar gutter, so its words sit over their columns. The small fact steps out where the wool is
    under 440 px (a container query; the rank keeps its badge), and so does the YOU tag (the amber ring stays).
  - Your plate: your head, your standing ("#12 of 2,431", "No rank yet"), your figure with its unit, how far you are
    ("855 points to the podium, 99 behind Pip", "You hold first place."), then the show-me switch or one line of small
    print (dropped on a phone, where the switch stays).
  - Nothing moves when a tab or a "when" button is pressed, at fourteen sizes from 320 x 568 to 1920 x 1080 (scratchpad
    boards/moves2.mjs); no real name (12 letters at most) is cut at any of them. On a phone the board's head row stays on
    every board (the sign; on Wins the "when" tabs in its place), or the list jumped between Wins and the others.
  - kit.css is loaded after boards.css (PaintedApp imports PaintedHome before skin.css), so `.kit-beam`'s
    `position: relative` beat the beam's `position: absolute` and pushed it off the right edge: the beam's rule is
    `.sk-lb .sk-lb-bar`. Check computed styles, not the file, after touching a kit piece here.
  - A second review of the finished pages (four reviewers, three skeptics) upheld 24 findings; all were fixed but these,
    left on purpose: the silver and bronze bands stay the podium's own (approved) colours; the unlit tabs stay the
    lobby's and the close peg the Trading Post's (both approved); Wins shows "107 games" in words, not a win-rate bar. The page is up in about 0.4 s, the sky
    about a second after, then 60 frames a second at a computer's and a phone's size on this Mac (not a real phone).
  - The bundle: the page went 2.3 kB over the limit, so the developer preview pages (`?preview=sheep`, `thumb`, `stall`,
    `doors`, `guide`, `kit`, `lineup`, `strips`, `wendigo`) are now in development builds only (`import.meta.env.DEV` in
    PaintedApp.tsx): their chunks are gone from the build players load, and there is 13.9 kB of headroom. The bake
    tools all run against `npm run dev`, where they still work (checked). The budget itself was not raised.
- Country, age and a parent's click, first (requested by Kai, 2026-11-14). This supersedes the email-link consent for new sign-ups
  and "until a parent says yes, the account can play but cannot chat". On the first visit, before Home can be used, the painted skin
  shows one form (src/skin/onboarding: Onboarding.tsx, gate.ts): play as a guest, email and password, or Google; then country and age
  (and a username for a new account); then, only if the country's rules say the player is too young, a screen for the parent with the
  notice and the button "I, as a parent, agree to let my child play". After that nothing is held back. The rules are one table,
  src/lib/ageRules.ts (`CONSENT_RULES`: GDPR art. 8 ages for the EU and EEA, UK 13, US 13, CA 14 for Quebec, KR and CN 14, IN and ZA
  18, 13 elsewhere, never under 13), read by the browser and by the server (main.ts; AGE_OF_CONSENT_BY_COUNTRY can raise a country,
  never lower one). NOT LEGAL ADVICE: a lawyer has not checked the table. A guest's answers stay in the browser (`sap:age-check`);
  an account's are on the server: `createProfile` takes `age` and `parentConsent` (the profile is `granted` at once, its date of
  birth null, and a `parental_consents` row with method `on_screen` keeps the time and a hash of the exact notice shown), and
  POST /api/account/age gives an older account (username-only or waiting on a parent's email) its country and age once. A parent's
  refusal or withdrawal by email stands. The older email path and ConsentPage still work for links already sent; the classic look
  keeps its AuthDialog. Home's Log in opens the same form (`openSignInForm`). Guests and accounts whose parent agreed can chat
  and show themselves on the leaderboards (the friends list was removed the same day). Known and told to Kai: a click on the child's own screen is not verified
  parental consent (COPPA's list of methods does not include it), and anyone can choose an older age.
- Queue, not Quick play (Brian, 2026-11-14: "remove quickplay firstly. jsut make the green button 'Queue', taking the play
  button right below it and replacing it with there. also, remmemeber that queue is what brings you into searching for a
  lobby, like brawl stars, or how roblox finds you a server or just any game really, and create lobby is creating a lobby
  yourself"). The words mean: **Queue** = matchmaking, the game searches and puts you in a game (Casual or Ranked);
  **Create lobby** = you make a lobby yourself and others join with its code. Never use "queue" for a lobby someone made,
  or "lobby" for what matchmaking finds. Home's menu is now Queue (first, green: GameMenu makes item 0 the primary),
  Create lobby, Join party, Counting Sheep, Practice, Tutorial, Trading Post. Queue opens PlayChooser (aria "Queue");
  Casual's "Find a game" is the old quick-play intent (`{ t: 'quick' }`), whose room reads "Casual, in queue". PlayChooser
  gives focus back to Queue when it shuts, or the menu dropped Queue's highlight and it shifted 6 px.
- Leaderboards on the menu, no Today (Brian, 2026-11-14: "can you remove the today option from the leaderboars option?",
  then, shown popup mockups A and B, "keep the full page but put it below the trading post button, like an addition to
  that (in the same area though so the font and everything should match)"). The page stays a full screen. It opens
  from a menu item `boards` under `bazaar` in PaintedHome (only with a game server, like Queue); the trophy button in
  the top bar is gone. The Wins board's "when" tabs are This week and All time (the server still answers /day).
  Eight menu rows: the short-window rule in skin.css (max-height 800) never applied, because `.sk-home .sk-menu-board
  .sk-menu-item` (48 px) is heavier; a heavier copy now sets 38 px rows (35 px at 740 and under) so the caption clears
  the bottom bar at 1280 x 720. Measured at 1280x720, 1366x768, 1280x800, 1440x900, 1920x1080; a phone's menu
  scrolls in its own panel, as before.
- The casual queue's bots (Brian, 2026-11-14: "for casual qeuue whether it fills with farm sheep, only make it do bots if
  after 10 seconds nobody joins. and make it gradual. also, instead of making it farm sheep now, make it look like actual
  player generated names ... a cool and sleak 4 letter name like kxln or something like bignatefan27"). This supersedes
  "farm sheep fill the table to four" for the casual queue (a lobby someone made keeps its host's number; ranked has none).
  - Server (server/rooms.ts, constants in server/types.ts): a queue room keeps `botNames`, `quietSince` and `botAt`. After
    QUEUE_QUIET_MS (10 s) with no new person, `seatQueueBot` seats one bot, then the next QUEUE_BOT_GAP_MS (1.5 to 4 s,
    random) later, until people and bots make MIN_TABLE (4). A person who joins resets the quiet and, at a full table,
    takes a bot's seat. `armQueue`: a table of four or more starts itself QUEUE_FULL_WAIT_MS (5 s) later (`startAt`, as
    ranked); the first one in can still open the gate early with whoever is there. `botsFor` counts only seated bots in
    the queue, and `begin` hands their names to the engine (`GameSetup.botNames`, a small engine addition).
  - Names: src/lib/playerNames.ts (`playerName`), from a short look at how players name themselves: numbers on the end
    (often a birth year, two digits or four), short "OG" consonant names (kxln), fan names (bigmayafan18), its/lil/the
    prefixes, word_word, CamelCase pairs. At most 12 characters (the room's limit), checked with `isInappropriateName`,
    no 69/420/666, never a name already at the table.
  - Kept on purpose: the BOT tag on each bot's line in the lobby and "bot" under its name on the scoreboard (the earlier
    rule "keep them unmistakably not people", and his own 2026-11-14 "make it more clear that farm sheep are bots"). He
    asked for the names, not for the tags to go; if he asks for that, it is his call to make.
  - Tests: server/queueBots.test.ts. Played on a private server: alone 10 s, then libo, owen2008, realfrog about 4 s
    apart, "The gate opens in 5 seconds", the game with their names.
- No bot option, unmarked fill-ins, 15 s (Brian, 2026-11-14, after the bullet above: "dont say they are bots. ykw, remove
  the option to add bots. just add in the bots after the 15 sec thing i stated"). This supersedes, for online play, the
  BOT tag and "bot" label kept in the bullet above, "keep them unmistakably not people" (2026-11-07) and the host's
  farm sheep in a lobby ("A shorter menu", 2026-11-14).
  - QUEUE_QUIET_MS is 15 s. Lobbies fill too (`fillsSeats` in server/rooms.ts: every non-ranked room): the same gradual
    seats to four, a person who joins takes one; a lobby never starts itself (only the queue's `armQueue` sets
    `startAt`). `botsFor` counts only those seats; `settings.bots` from an older client is stored and does nothing.
  - Create lobby sends no bots; the lobby has no Add a bot, take-out cross or Bot level; rooms/lobbyBots.ts (and
    `playAlone`, the lobby's solo deal) is deleted. A filled seat is shown exactly like a person: a sheep, a name, a
    name tag in the pen, counted in "N players". Online, the scoreboard and the table's name plates do not mark bots
    (`markBot` in Ledger.tsx, `!room` in PaintedGame). Practice, the tutorial and the offline table still say bot.
  - The pen's name tags are kept apart by `Unstack` (PenStage.tsx: the CSS `translate` property, eased; ScreenAnchor
    owns `transform`).
  - My reading of "the option to add bots" was the lobby's controls, and of "add in the bots after the 15 sec thing"
    that a lobby fills like the queue. If he meant lobbies to be people only, take `fillsSeats` back to the queue.
- How ranks work (Brian, 2026-11-14: "in profile, ranked section, u see the empty white space? put a button there that
  explains the ranked system, all the ranks consecutively"). A WoodButton on the right of the profile's ranked card
  (ProfileRank.tsx; on a phone it runs full width under the badge and text) opens src/skin/ranked/RankGuide.tsx: the
  leaderboards' board (`rm-panel kit-wall`) with a dark wool ladder of all eight ranks, lowest first, numbered, each
  with its TierBadge, points range, divisions I II III (the top rank says "Top rank") and, for the first three, what a
  loss costs; your rank ringed in amber with "you"; four rule slates beside it (Climbing, Points, Easy at the start,
  The games). Every number is read from src/lib/ranked.ts. It is a portal beside the profile and catches Esc first,
  so Esc or a click outside closes it alone and focus goes back to the button. "under Play" is "under Queue" on the
  card and the leaderboards. Tests: src/skin/ranked/__tests__/rankGuide.test.tsx. Checked at 1440, 820, 390 and 320 px.
- The ranks are Wood, Stone, Iron, Gold, Crystal, Titan, Eclipse, Zenith (Brian, 2026-11-14, after seven rounds; this
  supersedes Lamb ... Golden Fleece). His words on the way, the rules for naming here: the farm set "i dont like that,
  make them more unique"; Fluff/Sprout/Frost... "doesnt sound cool at all"; sky, beast and forge sets "none of these are
  good, i like the themed aspect but we're TOO themed"; plain game ranks "too plain"; all-ice sets "why are they all ice
  related"; "Absolute Legend" "so forced". He chose the materials climb with "Zenith" on top and said "replace frostfire
  with titan". Only names, ids and badge colours changed (`TIERS` in src/lib/ranked.ts; LOOKS in ranked/badge.ts, each
  badge in its material's colours); ratings are numbers, so nobody's rank moved. Zenith's aura is two sets of pixel
  rays drawn past the badge's box that pulse in turn (`.sk-zenith-rays`; a blurred glow breaks the kit audit's
  shadow rule). The explainer lists the ranks highest first ("make it show highest to lowest in descending order").

- Friends are back, on the profile (requested by Kai, 2026-11-14, a day after Brian's "remove friend feature" in 0.7.1; Brian has not
  been asked, so this is Kai's call to confirm with him): the friend code, a box to add one, the requests waiting and the friends
  with online dots are a section of the profile page (src/skin/profile/FriendsSection.tsx), not a tab or a button of their own. A
  signed-in player's list is on the server again (server/social/friends.ts, routes/friends.ts, the `friend_codes` and `friendships`
  tables that 0.7.1 left in place; no migration); a guest's is in the browser with the server's in-memory mailbox
  (server/social/guestFriends.ts, src/state/guestSocial.ts), as built on 2026-11-13. Both are restored as they were before 0.7.1;
  `eraseFriendRows` is replaced by `friends.erase` again. Room invites, the classic Friends tab, the Hub's friends and the
  top-bar buttons stay removed, and Home has no friends button. The guard tests in src/skin/boards/__tests__/boards.test.tsx
  were rewritten to say so.
- The admin panel's numbers (requested by Kai, 2026-11-15): with the admin lock open, the padlock dialog has a "Numbers" section
  (src/skin/admin/SiteNumbers.tsx): who is on the site now, who is connected to the game server (guests and signed in) and in
  rooms, visits (today, yesterday, 7 and 30 days, all time), new browsers, and how many accounts there are (all, made today, made
  in 7 days). It refreshes every 15 s. The numbers come from the game server (server/routes/siteStats.ts) and are only given to
  someone with the stats key, the server's ADMIN_STATS_KEY (at least 16 characters; without one the route does not exist): the
  admin lock on the page is client-only, so it is not what keeps them private. The key is typed in the panel once and kept on
  the device (`sap:stats-key`); a wrong key is forgotten. Counting visits (src/lib/visit.ts, server/ops/siteStats.ts) stores only
  numbers: one row per UTC day in `site_visits` (migration 107: `visits` and `new_browsers`), nothing about a person. A tab says
  "opened" once (a code in sessionStorage, so a refresh is not a visit), a browser that has never been here says so (`sap:seen`,
  how new browsers are counted), and while a tab is on screen it pings every 45 s with a random per-tab code that the server
  holds in memory for 90 s to count who is on now and never writes down. The admin's own visits and automated browsers
  (`navigator.webdriver`) are not counted. Not counted: a copy of the game with no server address, and the classic look.
  To switch on: run migration 107 (the "Deploy server" workflow with migrations on), set the secret (`fly secrets set
  ADMIN_STATS_KEY=<long random>`), deploy the server and the website. Known and told to Kai: the privacy policy does not yet
  mention counting visits or the per-tab code, and a lawyer should read it before this goes to children (a random per-tab code
  and a first-visit flag are the sort of thing the policy should name); "on the site now" counts open, visible tabs, so one
  person with three tabs is three, and a tab that is open but hidden is not counted.
- Whole-site debug pass (requested by Kai, 2026-11-15: "go through the whole entire website and debug the whole thing"). What was
  run: the type check, every unit test, both builds, the bundle size, the end-to-end suite, `npm run check:floating`, the engine
  simulator (96 games), `npm audit`, the 72 database tests CI skips (it has no Postgres) against a local Postgres 16, every
  migration applied twice to an empty database, about 44,000 malformed socket messages and 10,000 malformed API requests at the
  server, and a browser walk of the painted game against a local server on Postgres: every Home panel, the admin lock and its
  numbers, the profile, the Trading Post, the leaderboards, the first-visit age and parent form, Practice to its end board, the
  tutorial, Counting Sheep to its results, a two-person lobby game to its end board, the casual queue, and a two-person ranked
  game to its rating. Fixed:
  (a) Counting Sheep ate the first letter of the first word: the key that started the night was thrown away, so a player who
      did what the sign says ("Type a word ... press any key") always bounced (PART went in as ART). The starting letter now
      counts (`begin` in DreamScreen.tsx moves `phaseRef` at once and says whether it began). There is no interactive test
      harness for the painted screens; this was checked in the browser.
  (b) A held chat message or an appeal holding a NUL byte could not be saved (Postgres refuses it), so the review queue kept it
      in memory only and lost it on restart, child-safety holds included. `cleanText` in server/chat.ts takes out control
      characters first (tabs and line breaks become spaces). Tests in server/chat.test.ts.
  (c) A block with a control character in the target id was held in memory but never written down (server/blocks.ts refuses it).
  (d) A control character in a URL path parameter (`%00`) reached the database and answered 500; the router answers 400
      (server/http.ts).
  (e) The admin dialog ignored Escape, unlike every other dialog on the start screen.
  (f) How to play named three of the eight twists, said "There are no accounts", and in the painted game spoke of a Daily
      Table; the classic tour still listed the removed "even faster round" twist. src/skin/__tests__/guideText.test.ts pins
      the text to the engine.
  New tests also cover the ranked and visit stores against Postgres and `profileCounts` (server/ranked/store.test.ts,
  server/ops/siteStats.test.ts, server/auth/store.test.ts). Then, with Kai's go-ahead on everything (same day):
  (g) Feed Sack guarantees run only while their tier has something left to find (`liveGuarantees` and `forcedTier` in
      src/skin/shop/roll.ts, used by the browser and the server alike). With every rare in a sack owned, the rare guarantee
      used to stay due for good, so each sack after was rolled 20% legendary while the slate said 2%; with every legendary
      owned, every 40th-and-after sack was forced to a rare. Now the slate's odds are the real ones, the legendary guarantee
      carries on, and the meter of a finished tier reads "every rare found" (FeedSacks.tsx). This settles the question left
      for Brian on 2026-11-13. Tests in src/skin/shop/__tests__/sacks.test.ts.
  (h) The name: the page title, the link preview (index.html), the legal pages' and the parent's consent page's titles and
      the consent page's "Your child asked to play ..." use `PAINTED_GAME_TITLE` ("Finish the Word") in the default look;
      the old look keeps GAME_TITLE. public/og.png, the link preview picture, said "STEAL ... Build the pile. Don't get
      stolen from."; it is now the game's own farm (the home tour's wide shot) with its title board, captured from the
      built game. The legal documents in docs/legal still name the service "Steal a Poop": that is for whoever reviews them.
  (k) The painted game was renamed Barnstorm, then Fleeced (Kai, 2026-11-15: "change the name from finish the word to Barnstorm"; then "scrap everything, change the name to Fleeced"). The name is
      `PAINTED_GAME_TITLE` in src/config.ts: the page title and link previews (index.html), the title board (one word, so the
      tiles shrink on a phone: `.sk-title-long`), the share text and card, the credits, the framed-page message, the parent's
      consent notice (src/lib/ageRules.ts, so records made from now on hash the new text), and the link preview picture
      (public/og.png, from the title board). src/skin/__tests__/gameName.test.ts fails if the old name comes back in game code.
      Still "Steal a Poop": the classic look (`GAME_TITLE`), and the legal documents' bodies in docs/legal (drafts for a lawyer).
  (j) scripts/smoke.mjs expected the friends addresses to be gone (they are back) and checks the live site too; the new
      "Smoke check" workflow (.github/workflows/smoke.yml) runs it from GitHub after every server deploy and on demand, with
      no secrets. It says whether the admin numbers are on (ADMIN_STATS_KEY set) and that a %00 path is refused.
  (i) The end-to-end tests built player names from the clock, and about one run in sixty made a name the game rightly
      refuses ("Ana1..." reads as a rude word): e2e/names.ts picks a run number that keeps every name acceptable.
  Checked and fine: the chat filter
  already catches a blocked word split by zero-width, joiner, soft-hyphen or direction characters. Not checkable here: the
  live site and server (this machine cannot reach them), real sign-in, real GPUs and phones, and how anything looks or sounds.
- The animals are Brian's six-view sheets, one to one (Brian, 2026-11-18: "completely change them to be one-to-one,
  disregard all old rules about the animal modeling. i want it to look like the reference"). This supersedes every
  animal-modelling rule above: V5 and V5.1 (the proportion sheet, signature features, the eye standard, collars and
  bells, the palette's 55% saturation cap), the 2026-11-07 requests (the cow's eyes clear of its spots, its bell and
  drawScale, the chicken's head, the pig's plates), the face switches, and "Supersedes (a)" in the overhaul's entry.
  - The reference is the sheets Brian sent on 2026-11-18 (sheep, chicken, horse, cow, pig, goat: front, back, left,
    right, top, bottom) and his lineup picture for their sizes against each other (as drawn: sheep 1, cow 1.14, horse 1.54,
    goat 1.15, pig 0.86, chicken 0.66; the picture measures 1, 1.17, 1.60,
    1.15, 0.89, 0.64). Each species is built in cells at its sheet's proportions (src/skin/voxel/sheep.ts and
    src/skin/voxel/animals/*.ts) and drawn to size by one uniform `drawScale` everywhere it stands (Home's farm too),
    so its proportions never change with its size. The sheep too (2026-11-19): it is built at its sheet's own 17 cells
    and drawn at SHEEP_DRAW (1.47), so it stands 1 m at the crown as before; whoever draws a sheep scales it by
    `animalModel('sheep').drawScale`, as for any animal.
  - Compare against the sheets with Blender, not by eye in the game: `npx vite-node tools/blender/dumpAnimals.ts --
    --out <json>`, then `/Applications/Blender.app/Contents/MacOS/Blender -b --python tools/blender/lineup.py -- <json>
    <out.png> <species> 24 sheet` and `node tools/blender/sheet.mjs <out> <sheet.png> <TITLE>` for the six views, or
    `... <json> <out.png> all 64` for the lineup.
  - Kept, because the game needs them, at a cell or less from the sheets: the pig's and the hen's heads are the top or
    front of their box and only nod and turn a little (RANGES in table/Sheep.tsx), so the face never sinks into the
    body; the pig's front legs and the goat's neck sit a cell off the sheet so the winner's scarf has its two clear
    slices; horns, ears, tails and combs are rooted a cell
    into their parent. Tests in src/skin/voxel/__tests__ (animals, animalsV51, voxel) and measure.ts (SHEET, sheepHead,
    chickenOrientation, ROOTS) now pin the sheets instead of V5.1; the pose, leg-join, framing, scarf, garment,
    contact-patch and face-rule tests are unchanged and pass.
  - The sheep, rebuilt again on 2026-11-19 (Brian: "that doent look like a sheep at all, or the reference image i gave
    you"): its face is a plate 7 x 5 set one cell proud of the wool round it, with one-cell eyes and a 5 x 3 muzzle; the
    wool round the face, the cap and the crown turn with the head; the body is lobes of one white (voxel/sheep.ts). Its
    scarf, its ice, its place in Counting Sheep (SHEEP_ART in dream/stage.ts: 19.0 long, its nose where the old one's
    was) and the sizes in scene/placed.ts were measured again from it.
- No footprints, hoof dents or sled ruts in the ground (Brian, 2026-11-19: "weird random square holes in the ground ...
  just reads as a bug"): gone from the yard's path and the barn's floor, and the worn tracks of scene/countryside.ts
  are deleted.
- Home is "Word chain" (Brian, 2026-11-20: "change the home screen ui to make it more captivating and unique, rn its so
  boring i could cry", pointing at a rhythm game's menu; picked mock-up A of three drawn over the running game: "number 1
  is near perfect"). Branch `ui/home-word-chain`, local only. src/skin/home (home.css, HomeParts.tsx, HomeArt.tsx).
  - A night-blue slab cut on a slant holds the left side, word chains drifting behind it (`WORD_CHAINS`: each word starts
    with the last letter of the one before and each row comes round to its start; a test checks the rule and the word
    list). The title is the game's name in letter tiles on a rack, tilted with the slab. This reverses "no letter tiles"
    of 2026-11-19 for the title: he chose it. The menu is boards leaning with the slab's edge; the chosen one is gold and
    slides out (transform only), focus follows the pointer so Enter picks the lit one, and a card on the right shows the
    chosen item's own picture, what it is, and one action row of a fixed height (Queue: Casual and Ranked).
  - His notes on the mock-up, and what answers them: no pictures from the game on the card ("make ur own artistic
    images"): six posters drawn in code (HomeArt.tsx, pixel sprites with an outline over painted backdrops); the wood
    "screams ai": the board finish is two browns under a few hand-drawn grain lines and a knot (`--hm-grain`), a dark
    outline and a bevel, not ruled stripes; a cleaner word of the day: a night-blue card with chips; a better bottom
    bar: keys as tiles, a TIP tag, the small print with rules between.
  - The Trading Post and the leaderboards are no longer menu items: the coin purse and the trophy in the top bar (as in
    the mock-up he picked; this reverses "leaderboards under the Trading Post" of 2026-11-14 unless he says otherwise).
    The avatar button is gone from the bar (the profile changes it); the admin lock is "Admin" in the small print.
  - He will draw the menu's icons himself; Icons.tsx's BarnIcon, KeyIcon, PawIcon and CrescentIcon are stand-ins.
  - Checked at 320 to 1920 wide, a sideways phone, with and without a game server, every item hovered (nothing else
    moves), the three setup panels (restyled on the board finish). The size limit went up 3 kB for it.
- Home, as Brian's plan has it (docs/home-ui/HOME-UI-PLAN.md and its two target pictures, Brian, 2026-11-20: "This is
  Brian's own request and replaces earlier Home decisions"). It replaces the "Word chain" bullet above wherever they
  differ; the slanted night-blue panel with sliding words stays. src/skin/home (home.css, HomeParts.tsx, layout.ts).
  - Every control is a slab: a flat block with a 3 px ink outline, a visible side and a face with a one-step highlight,
    pixel corners, no wood, gradient, glow, blur or rounded corner (the audit's allow list has no Home entries left).
    The block is drawn by ::before so the button keeps its focus outline and its hard drop-shadow. Colours are only the
    --hm-* tokens in tokens.css (prefixed: --ink and --wool already mean the paper's colours elsewhere).
  - Sizes are the plan's pixels times --u (1 px at 1280 x 720, 0.8 to 1.5). The panel is --mid wide at mid-height with
    an 11 degree lean; home/layout.ts holds the same numbers, and the farm's camera slides the picture right by
    `sceneShift` (a view offset) so each shot's subject sits in the uncovered part. Never on the paddock shot: the
    wendigo's frame is frozen; the wendigo check passes and it stays clear of the panel and the buttons.
  - The menu's icons are Brian's own art (src/skin/assets/menu/*.png, cut from his sheet with the checkerboard
    removed). His icons carry their own colour, so Create lobby's tile is frost, not barn red (his barn is red).
  - The side card, its posters (HomeArt.tsx) and the board finish are gone. The Queue chooser and the setup panels use
    the same slabs. With a longer menu (six or seven items) the tagline is hidden sooner, as the plan's own order says.
  - Not done here: the language switch and French screenshots (pull request 56 is not on this branch).
  - Brian, later on 2026-11-20 ("absolutely wonderful"): the coin a round gold pixel coin, and the word of the day moved out of the panel to float over the scenery
    under the top-right buttons as text only, tilted 3 degrees, with a hard ink outline (picked from five mock-ups: "i
    like it being over the scenery, however i dont like the card ... just the text very slightly tilted").
  - Then (same day, "i didnt mean make the buttons smaller i meant make the icons smaller ... similarish tones"): the
    menu's blocks are back to the plan's sizes; the icons are smaller (24 in a 36 tile, Queue 34 in 50) and every tile is
    the same night blue (Queue's ink), so his differently coloured icons sit together.
- The setup sheets (Brian, 2026-11-22, of Create lobby's and Practice's cards: "the popup ui is poorly done, its just another plain
  card"; of three layouts drawn over Home he chose "B but better"): src/skin/home/SetupSheet.tsx, `.hm-setup*` in home.css. A
  sheet of its own, NOT joined to the panel (he rejected that the same day: "i dont want it growing out of the menu, i never said
  to do that. now it just looks the same as the side bar"): it floats centred over the scenery with a gap from the panel, leans 11
  degrees about its middle, a lighter night face than the panel (night-2, knit) with a lantern band on top and a hard shadow, no
  word chains, every setting a darker sunken row (icon tile, name, leaning choice slabs, a line saying what the choice means); the
  action is drawn like Queue (icon tile, label, what was chosen) and stays in view while the rows scroll. The chosen menu item
  stays lit behind it (`.hm-menu-held`). On a window too narrow for it beside the panel it slides left over the dimmed menu only
  as far as it must, and its rows stack. Custom shows the three rules as rows; a length puts them away. On a phone it stands
  upright in the bottom sheet, rows leaning 6 degrees. Join party keeps the old card. The dialog names ("Set the table",
  "Practice run"), `.sk-sit` and the button texts are what the gate and the smoke tests find: keep them. Checked at 320 to 1920
  wide and sideways: nothing clipped, every label inside its button, nothing under the footer, no press moves anything else.
- French version (requested by Kai, 2026-11-20: "a button ... that says French ... everything is french, exactly the same ... use the
  french dictionary ... make the accents not so restrictive"). The language is src/lib/lang.ts (`sap:lang`, `?lang=fr`); the
  "French" / "English" button is first in Home's top bar and reloads the page. Words: public/words-fr.txt, built by
  scripts/build-french-words.mjs from the MIT package an-array-of-french-words (stored without accents, French swears removed);
  `normalizeWord` folds accents for every language, so "élève" and "eleve" both count and the typo assist works the same. The
  server loads both lists; a room opened by a French player (`lang` on create / quick / ranked) plays the French list and the
  queues match French with French. The screen is translated by src/skin/i18n/translate.ts, a page-level swap of exact English
  lines from public/i18n-fr.json plus the patterns in public/i18n-fr-patterns.json ([regex, French], first match wins, the kept parts translated too), both fetched only in French; the chat log, inputs and anything
  marked data-i18n-skip are left alone. New English text needs its French added there. In French the word of the day is
  public/wotd-fr.json (120 French words, 35 / 50 / 35 by level, picked by `pickFrom`, so they repeat every few months), and
  Counting Sheep asks for French starts, fence words and hint examples (`setDreamLanguage` in src/dream/dream.ts, set once at
  boot; `check` and `matched` fold accents). Not translated: the share text, the classic look and the legal pages. A sentence with a value spliced into
  JSX (`Text {value} more text`) is several text nodes; write it as one template string so it can be one pattern.
  Every screen was walked in French on 2026-11-21 (scratchpad walk*.cjs) and its English lines fixed.
- A second admin avatar (requested by Brian, 2026-11-20): another photo beside Kaiyan's, admin-only in the same way (id `admin2`,
  `ADMIN2_AVATAR_ID` in src/avatars/ids.ts; `isAdminAvatar` is the check everywhere, server, store, save code and skin). It is a plain
  flat square picture (src/skin/assets/admin2.png, a 512 x 512 circle, one-off crop of the photo Brian sent): no stretched forehead and
  no glare, drawn by `AvatarDisc`'s `avatar` prop and `PhotoAvatar`'s (src/skin/avatars/photos.ts holds its size and file), 1.2 m across
  at the table. Equipped and unequipped only from the admin panel's "Second admin avatar" card, taken off by Lock, never in the picker or
  a save code. Changes outside src/skin: the id and `isAdminAvatar` in src/avatars/ids.ts, the server's admin check, the save code's
  filter, one assertion in avatars.test.ts and a server test; the fence pins in fences.json were re-pinned on purpose.
- Admin avatars show to the room (requested by Brian, 2026-11-20: "im an admin and i want other people to see my avatar"). Before, the
  server showed an admin avatar only for a moderator or an account in ADMIN_USER_IDS, so an admin who was neither (a guest, or an
  account not on the list) wore it on their own screen and everyone else saw the sheep. Now a browser that unlocked admin keeps the
  password it typed (`sap:admin-proof`, cleared by Lock; `adminProof` in src/lib/admin.ts) and sends it as `proof` beside an admin
  avatar (`avatarMessage` in roomStore.ts); the server checks it against the admin hash (`isAdminProof` in server/adminProof.ts; the
  hash moved to src/lib/adminHash.ts so the server can read it; `adminHash` in the server's options for tests). The hash itself is no
  proof (it is in the bundle). Still refused quietly otherwise. A device that was unlocked before this has no proof until it is locked
  and unlocked once. Weakness, told to Brian: the password was once written into the repo (see adminHash.ts), so anyone who finds it in
  git history can wear the admin avatars; change the password's hash to a long random one to close that. This supersedes "the server
  alone decides ... (moderators and ADMIN_USER_IDS)" in the security pass: the server still alone decides, by the list or the password.
- A third admin avatar (requested by Brian, 2026-11-21): another photo (id `admin3`, `ADMIN3_AVATAR_ID`), admin-only like the other two, with
  Kaiyan's treatment: a tall picture (src/skin/assets/admin3-forehead.png, 512 x 1339, the same hair / forehead band / face slices, cut
  from the photo Brian sent; no stars baked in, the live glare is the shine) whose forehead stretches and whose glare is adjustable.
  Each tall photo keeps its own look on this device: Kaiyan's `sap:kaiyan-look` as before, the third's `sap:admin3-look`
  (`getKaiyanLook(id)`, `setKaiyanLook(next, id)`, `useKaiyanLook(id)` in src/skin/avatars/kaiyanLook.ts; `useLooksVersion` is what the table
  and the ice listen to so their name plates follow either). The admin panel has a "Third admin avatar" card with its own head sliders. The
  second admin avatar stays the plain square photo. `isTallPhoto` and `photoUrlFor` (avatars/photos.ts) say which picture an id wears.
  Others in a room see the default look of the third, as with Kaiyan's.
- Juan, the second admin avatar, is a tall photo too, with an orange slider (requested by Brian, 2026-11-21: "make it so that his
  forehead is extendable, there is the glare like the kaiyan one, also ... a slider to make his face more progressively orange").
  This supersedes the plain square photo of 2026-11-20: src/skin/assets/admin2.png is gone and admin2-forehead.png (512 x 1339, the
  same three slices as Kaiyan's, cut from the same photo) replaces it, so all three admin avatars are tall photos with a Forehead
  and Glare slider each, saved apart (`sap:kaiyan-look`, `sap:admin2-look`, `sap:admin3-look`). Juan's card also has an Orange slider
  (0 to 100%, in twentieths; `orange` in the look, left out of the saved value while 0). The tint is pixel maths in
  src/skin/avatars/orange.ts (`skinWeight`, `warmUp`: only warm, mid-light pixels, so the blue backdrop, the suit and the shirt stay
  put; fair hair goes orange with the skin), drawn on a canvas texture by AvatarDisc (`warmedTexture`, the last four amounts kept). The
  panel's small picture and the others' view of him are not tinted: others see the default look, as with Kaiyan's.
- Juan's orange is visible to the room (requested by Brian, 2026-11-21: "make the orange visible to others too"). The avatar message
  gains `orange` (0 to 1, only taken with Juan and only with an admin's say-so); the server clamps it, rounds it to twentieths and
  writes it onto the id the room's member list carries: `admin2~12` is Juan at 60% (`withOrange`, `orangeOf`, `baseAvatarId` in
  src/avatars/ids.ts; `ORANGE_STEPS` 20). A browser never sends the suffixed form (`isAvatarId` stays strict and the server answers
  `bad_message`); every reader that needs to know WHICH avatar goes through `baseAvatarId` (`isAdminAvatar`, `photoUrlFor`, the look's
  key). AvatarDisc shows another player's Juan at their amount (`orangeOf(avatar) ?? own`); your own is still your live slider. Forehead
  and glare are still each viewer's own. PaintedApp resends the avatar 600 ms after the slider stops (the server takes 10 avatar messages
  a minute). An older browser, which does not know the suffix, shows such a player as the sheep. The server must be deployed for it.
- A fourth admin avatar, with sliders to 12x and an age slider (requested by Brian, 2026-11-21: "do the same for this, except make the
  forehead 12x and glare 12x, another slider to make him progressively darker and wrinkly, 0-12x"): id `admin4` (`ADMIN4_AVATAR_ID`),
  a tall photo like the others (src/skin/assets/admin4-forehead.png; the strip that stretches is skin from under his fringe).
  Forehead and Glare run 0.1 to 12 (and 0 to 12) and OPEN at 12x, a tower; the other three stop at 6 (`rangesFor`, `defaultLookFor`
  in kaiyanLook.ts). The "Older" slider (`age`, 0 to 12 in halves, `sap:admin4-look`) darkens and browns skin and cuts fine creases
  across it (`ageUp`, `creaseAt`, `ageData` in src/skin/avatars/orange.ts: only skin, so backdrop, suit, shirt and dark hair stay),
  drawn on the same canvas texture as Juan's orange (`warmedTexture(url, mode, amount)` in AvatarDisc). Like Juan's orange it
  reaches the room on the id: `admin4~24` is 12x (`withAge`, `ageOf`, `AGE_STEPS` 24 in src/avatars/ids.ts; the avatar message gains
  `age`; the server clamps it and only the fourth takes it). Forehead and glare are still each viewer's own. The nameplate does not
  rise past the 1x height, and the dream caps the picture at `DISC_MAX_H`. The server must be deployed for others to see the age.

- The yarn loading screen (Brian, 2026-11-21: "can we quit it with the barn stuff, it looks garbage"; the plan is
  docs/landing/LANDING-PLAN.md, version 8). This overrides "the loading doors" in the overhaul's list of things that
  stand, "One loading screen", "The doors, refined", "The doors are voxels", "The loading sign" and "Back to the barn
  doors" (with its "Don't redesign the loading screen again unless he asks": he asked).
  - What it is: Home's night blue (#1B2742), a few slow flakes, the name "fleeced" in plain rounded print as a faint
    dotted line, and a red yarn ball that rolls along it from the foot of the "f", laying one strand of yarn that spells
    the word. The strand is the progress: half loaded, half the word is yarn; ready, the word is whole and the small
    ball sits on top of the "d", and 300 ms later the screen fades onto Home. If loading pauses the ball rocks; a tap
    makes it hop. Nothing else: no text, no number, no bar, no icon, no sheep, no button, no opening animation.
  - Where it lives: src/skin/loading (yarnWord.ts the word and its points, yarn.ts the yarn and the ball's wraps,
    progress.ts what counts as progress, bootDoors.ts the page's own copy at p = 0), drawn by
    src/skin/components/BarnDoors.tsx. The ball's wraps are one baked picture, public/loading/yarn-ball.webp
    (`node tools/renderYarnBall.mjs`, dev server up, then it stamps itself; its "model" in the bake manifest is the
    text of yarn.ts, so change yarn.ts and bake again). Every number is the prototype's, from the plan's appendices.
  - Names kept from the doors on purpose: BarnDoors.tsx and every name it exports (playBarnDoors, whenDoorsShut,
    whenDoorsOpen, useLoadingHold, keysBlocked ...), bootDoors.ts's names, the class `sk-doors`, the id `boot-doors`
    and the phase names. Rendering.tsx, the gate tools and e2e-painted/helpers.ts find the screen by them.
  - Progress: the farm's build counts its steps (`stepsTaken` in scene/slices.ts) against what this device took last
    time (`sap:boot-steps`, by detail level; `DEFAULT_STEPS` in BarnDoors.tsx on a first visit), other loads against
    `sap:load-steps` by their label. It never goes back and never finishes before the game is ready.
  - Standing rules: (1) the yarn looks like real wool: two twisted plies, matte, one light, fine fibres, no outline,
    no painted stripes, no gloss, nothing regular that reads as segments (the first try "looks fully ai generated ...
    kind of like a worm"). (2) No percentage or any other number ("nvm dont add a percentage"), and no line of text.
    (3) Never naked: the game's sheep always wears its wool. No sheep is on this screen; if one is ever added to any
    loading screen it never uses the `sheared` part or coat level 0, not even for a moment.
  - Don't redesign the loading screen unless Brian asks.

## The leaderboards, version 2 (Brian, 2026-11-21) — plan: docs/leaderboards/LEADERBOARDS-PLAN.md
Brian's own request; it replaces "The leaderboards page", "The leaderboards' stage" and "The leaderboards in the sky"
(2026-11-14) for how the screen looks; the boards, addresses and data are unchanged. His two rules for it: every part is
specified in full, and nothing may look like a flat, empty, single-coloured card (every surface over 40 x 40 has a
texture, a lit edge, a shaded edge or side, and a detail). Branch `ui/leaderboards-v2`, version 0.9.4.
- Files: src/skin/boards/Leaderboards.tsx (the page), boards.css, art.tsx (every pixel grid of the plan: tab icons, the
  "i", padlock, snowflake, brackets, rosettes, tier icons trimmed to 24 rows), BoardStage.tsx (the stage), island.ts (the
  ground, pure). Tokens: the --hm-* additions in styles/tokens.css. The slab is Home's `.hm-slab` (home/home.css);
  `.lb-static` takes its states off for pieces that are not buttons (title tag, plates, your row).
- Recipes, by class: slab (`hm-slab`), board (`lb-board`), bar (`lb-bar`), tile (`lb-tile`), well (`lb-well`), ink card
  (`lb-inkcard`), snow cap (`lb-snowcap`), ribbon (`lb-ribbon`). Each draws its block in `::before`, so nothing inside
  is cut by its pixel corners. src/skin/boards/__tests__/surface.test.tsx renders every tab with made-up boards and fails
  on any background the styles give an element that is neither a recipe's nor on a piece 40 or less on a side (sizes
  read from the stylesheet: there is no browser in `npm test`). Name a new surface by its recipe, or it fails.
- Banned here, besides Home's list: dashed or stitched borders, Patrick Hand, the kit's wood, paper, pegs and slates
  (boards.test.tsx checks the markup, source and stylesheet). Numbers: lining tabular figures, `fmt` (Intl in the game's
  language; French groups with a full no-break space, because the display face draws the narrow one almost invisible).
- Layout: `screenOf` reads the plan's rule in its own pixels (at --u = 1): a computer's layout while the stage the board
  leaves is 360 wide or more, else a phone's at scale 1. So a 768 x 1024 tablet is a phone (read at the 0.8 scale it was
  a computer with 80 px crates in an empty sky). The list starts at fourth place everywhere; it shows whole rows only,
  stops at the board's foot (computer) or the sheet's (phone), and scrolls past that with a drawn scroll bar.
  Tab labels and the ribbon's title are fitted by measuring the text (`useFit`: 17 to 12 and 20 to 16), after the
  French swap; a tab whose label will not fit at 12 drops its icon. On a computer the Wins toggle and the info button
  move under the ribbon when the line cannot hold all three (French).
- The stage: the podium's own crates (Podium.tsx's two builders, unchanged) on one island (`islandVoxels`: snow in two
  tones with a ridge pattern, a mound against each crate, two soil layers, a stepped underside to a point; two pines, a
  fence, two bales, a lantern with its light inside) and two pale far islands (`farIsland`, an unlit material). No cloud,
  puff or sea. The camera is straight on, 10 degrees down, 28 degrees of view, solved in `Frame` from the window the
  board leaves (70% of its width on a computer, 92% on a phone, less where the window is too short for the champion's
  hat to stay 24 under the lowest bulb). The plates are placed there, on resize or camera change only: centred on each
  crate's front, 10 over its foot, all three on one line. The crates' fronts are the same width to the pixel; the outer
  two also show a few pixels of their inner sides at this lens (about 6% on a computer, 3% on a phone).
- The trophy's own light is gone (it whitened the champion's wool); measured after, the champion's brightest wool is no
  brighter than second place's. Third place sleeps at 0.76 of second place's size, centred on its crate: lying down it
  is about 1.84 m nose to tail at full size, longer than the 1.4 m crate, so no move alone kept it on top. Its legs
  still hang down the crate's front, as the pose has them.
- Where the plan's letter was not followed: "Level 1 · Finish a game to get a place." is "Level 1", a thin rule, then the
  sentence (no middle dot, Brian 2026-11-14); the "Show me on the leaderboards" choice (the only place to hide) lives in
  the info card as a Shown / Hidden toggle, since the plan's rows had no place for it.
- `?preview=boards` (development only) shows the screen without the farm; the boards come from whatever `sap:server`
  names, which a test browser can stand in for.
- The size budget was raised by 6,000 bytes for it (4.1 kB locally, room left for CI's larger gzip).

## The leaderboards' stage, version 3, and the party (Brian, 2026-11-22) — plan: docs/leaderboards/LEADERBOARDS-PLAN-V3.md
Brian's own plan; it replaces sections 8.1 and 8.4 of version 2 (the island, the sheep), and the interface stays as
version 2 built it. Later the same day, with a picture of a champion with both arms raised, he asked for more: "make first
place more like this with the trophy floating and glowing above his head, make the podiums to look more exciting ... the
sizes of the models are too mismatched, the 3rd place looks so short while 1st looks massive ... make the trophy look
cooler ... make the background scenery cooler as well (the sky i mean, not anything else) ... like an anime
sky/day/night and give the vibes of more like a party", and "u dont have to copy the fingers, just make the arms like
that". Where that message and the plan differ, the message wins: the trophy floats (it is not held), the podiums replace
the crates here (the victory screen keeps its crates), all three places are one size, and the festival sky replaces
"keep today's sky". Branch `ui/leaderboards-v3`, version 0.9.5.
- Files (src/skin/boards): poses.ts (the three poses as data, `sample`, `rigOf`, `placement`), frame.ts (the camera, pure),
  island.ts (the island, pure), podium.ts and cup.ts (the podiums and the trophy, pure voxels), sky.ts (the sky's colours),
  FestivalSky.tsx, Prize.tsx and BoardStage.tsx (the scene). Tests: poses.test.ts, island.test.ts, party.test.ts and the
  stage checks in boards.test.tsx. `?preview=boards&lbAnimal=cow&lbTime=0.4` (development only) puts one species in every
  place and holds every loop at that time, for pictures. `?lbDemo` (development only) fills every board with made-up
  players, so the stage can be seen on `npm run dev` with no game server (Home then shows its trophy button too):
  `http://localhost:5173/steal-a-poop/?lbDemo`, or `?preview=boards&lbDemo` for the screen alone.
- Poses: `lbChampion`, `lbGoodSport`, `lbNap` are data (a rest pose, keyframes, waves) handed whole to the Sheep component
  through its `rig` prop (table/Sheep.tsx: `RigPose`; without the prop the Sheep is exactly as before). Each place runs
  on its own clock, starting 0, 0.8 and 1.6 s in, standing still while the tab is hidden and at rest under reduced motion;
  a new holder (a tab pressed) remounts and starts from 0. The hop, squash and pulse are a group about where the weight
  bears (BoardStage, `Lounger`). Faces: idle for the first two, asleep for the nap; the Santa hat is part of the head,
  so the plan's hat lines are skipped; eyes are painted cells, so the nap's eyes close with the lids the face already has.
- What the models could not do, and what was done instead (a sheep's legs are 0.16 of its height):
  - The champion's front legs swing up 178 degrees and turn OUT 42 (a V, as in his picture), not in: raised they reach
    the chin, and turned in they met over the mouth. On the cow and the horse the V clears the head; on the sheep it
    frames the face. Moving the shoulders up opened dark holes where the legs leave the wool: never move a leg's root.
  - The second sits with its body's front on the top's front edge, so its hips are 0.10 to 0.25 m behind the edge, not
    0.04 W (its belly is in front of its hips); its hind legs rest where they clear the top (`hindRest`: sheep 42, pig 66,
    cow 74, goat 68, horse 78, chicken 48 degrees, not 40), still swinging 12 either way and never touching the front.
  - Tails that hang lower than the rump or the belly (pig, goat, horse) rest their tips inside the top, behind the body.
  - One size: every place of a species is drawn at the smallest size any of its three fits at (the nap's), so first is no
    longer "massive" and third no longer "short" (`PLACE_SIZE` is 1, 1, 1).
- The island (island.ts): as the plan's section 4, with these readings: the front reaches 1.8 m past the crates (the
  ripples need it); the snow is 0.3 m thick behind the step, 0.2 m in front; soil-1's lowest 0.1 m is two steps darker
  (one step rendered as the same colour), because 0.3 m of one colour was 28 px at 1440 x 900, past the plan's 24 (now 21); the underside bands are their own mesh with no
  shadow, or both tones went one grey under the rim; stones and roots are on the front face; trails run along their
  own direction. The island, the pines, the lantern and its glass are one connected piece (island.test.ts).
- Then, the same day: "now the podiums look sloppy and all the background stuff looks poorly done. i like your vision,
  but maybe try and spend a little more time on perfecting the smaller details. additionally, try and go more for the
  vibe of like those anime festivals while still being somewhat cohesive". So the podiums are festival stages and the
  sky a festival night; the marquee bulbs, studded frieze, star badges, searchlights and pink party sky are gone.
- The podiums (podium.ts): festival stages with the crate's footprint and heights, so every pose, plate and drift still
  fits. Dark corner posts the full height; a dark plinth with a band of the place's metal (gold, silver, bronze);
  upright slats with a shadowed gap between each two and a rail halfway up (the farm's fences); a red-and-white striped
  curtain round the top, its stripes laid out from each face's middle so both ends match; a twisted rope of the metal
  over it with a tassel on each front post; the deck and a red carpet edged in the metal; the number (a drawn bold 5 x 7)
  in the metal's light on a lacquered sign framed in the metal, hung over the curtain so no name plate covers it; and a
  red paper lantern on an iron arm at each front corner, its paper lit and a soft glow round it. Palette steps only.
- The trophy (cup.ts, Prize.tsx): a tall gold cup with a ruby, looped handles and a star on its rim, drawn at 0.72,
  lit from within, with a halo, slow rays and six sparkles; it floats 0.06 H over the hat, bobs 0.08 m and turns a
  little. No light of its own (one whitened the champion's wool in version 2): the stage's one point light is still the
  lantern's.
- The sky (sky.ts, FestivalSky.tsx): a festival night. Painted bands behind the picture (night blue, indigo, plum, and
  the festival's warm glow rising behind the island); a moon in pixel art (32 x 32, magnified with no smoothing: Brian
  found the painted one "so out of theme") with far island C over it (`MOON`); stars, thinning toward the glow, a few
  with a cross of light; sky lanterns rising and swaying (added light, so a faint one is a dim glow, never grey); and
  fireworks in the open sky either side of the stage, never over the moon, the trophy or the podiums: a rocket climbs as
  a short spark, then a peony (with an inner ring
  in a second colour), a chrysanthemum, a ring or a golden willow opens, its sparks trailing and drooping a little, the
  glittering kinds flickering as they fade (a stronger pull read as rain). Everything is placed by spots of the window
  and sized by shares of its width, so it composes the same at every size. The far islands mix toward the band at their
  height, the barn's windows are lit, and a string of festival lamps runs along each island's front edge (`farLights`).
  No clouds: the long thin bands read as "a lot of these weird lines" (Brian); do not bring back thin streaks in the sky.
  Light: a warm key as from lanterns, a cool sky fill over a warm ground, the moon's blue on the edges, the festival's
  glow from below, a thin plum haze.
- Framing (frame.ts): the plan's 66% holds only where the window is tall enough. With the trophy floating over the
  champion on the 2.9 m podium, the fill is 57% at 1440 x 900, 50% at 1280 x 720 and 1920 x 1080, 65% on a 390 x 844
  phone; every species makes its whole hop. Where a crate is drawn narrow, its plate's rank badge steps out
  (`data-narrow`), never the figure.
- Cost, measured back to back with version 2 (software rendering, 1440 x 900): 305 ms a frame against 302, 103k
  triangles against 128k, 107 draws against 78. What keeps it there: flat faces merged (`merge` in the island, podium
  and far-island meshes), the podiums solid inside, the sky lanterns and the trophy's sparkles one draw each
  (`spritePoints`, boards/points.ts), each podium's lantern glows one, cloud quads only as tall as the clouds, and no
  shadow from the underside, the lantern's iron or the podiums' trim.
- The size budget was raised by 15,000 bytes (15.2 kB locally, all in the stage's own lazy chunk).

## The pen screen, clearer and lighter (Brian, 2026-11-22) — plan: docs/pen/PEN-PLAN.md
Brian's own request, of the lobby and queue screen: it "looks too chunky and really unclear". The plan (his, written from
a screenshot of the Casual queue) is docs/pen/PEN-PLAN.md, kept word for word. It overrides the "Keep" line of
docs/diorama/PLAN.md 6.6 for the screen's layout and panels, the name planks and where the sheep stand; the rest of 6.6
stands. Every function and rule stayed: queueing, joining and leaving, the invite link and the party code, who may
start, min and max, the rules editor, chat and its moderation, pausing chat, the host's mute and kick.
- One screen for the Casual queue, the Ranked queue and a created lobby (src/skin/rooms/PaintedRoom.tsx, pen.css): the
  pen is the screen; a bar (Leave, the title tag, a state chip, Invite friends); a slim board on the left (what is
  happening, who is here, what game); a chat card at the bottom right that folds (src/skin/rooms/PenChat.tsx, every
  function of the classic ChatPanel, which is fenced in src/ui and untouched); one lantern button under the pen, or a
  well for whoever is not the host. On a phone, or any window under 1000 x 640, the pen is a strip at the top and a
  sheet holds the status card and three tabs. The words of every state are section 4's, read from the room's own min,
  max, host and startAt; French for each is in public/i18n-fr*.json.
- The leaderboard's surface recipes now live in the shared kit (src/skin/kit/surfaces.css and surfaces.tsx): each rule
  answers to its old `lb-` name and a shared `rc-` name, and the leaderboard's markup did not change (photographed
  before and after: pixel for pixel the same). A screen that uses them puts `rc` on its root. Nothing on the pen screen
  is wood, paper, a gradient, a blur, a rounded corner, a dashed border or the hand font;
  src/skin/rooms/__tests__/pen.test.tsx runs the surface test on every state.
- The pen (scene/pen.ts, rooms/PenStage.tsx): every player stands on the straw mat of their seat (the order they
  joined, as the list shows), facing the camera; the camera looks down 20 degrees and is fitted at run time so the
  front row's animals fill 72% of the space between the panels and every plate and the gate fit in it (`Frame`). Mats
  are 0.8 x 1.1 m, not the plan's 0.4 m square (a sheep as drawn stands 0.61 x 0.92 m and stood half on the snow), 1.2 m
  apart as the plan has them; the rows are 5 m apart so the back row's faces show over the front row's heads and
  plates (measured: at 4.4 m the front plates still covered the back row's chins). The pen is 7.6 x 9.2 m for it. Its
  floor is trodden snow, so the straw mats read as places. The front side is short posts and one rail at 0.35 m with a
  two-leaf gate that swings open when the game starts (it never delays the start: 849 ms from the press to the table
  on the local server, the same path as before). Plates step up, by their own height and 4, over any plate or face they
  would cover (`Unstack`, with each animal's face box). penWander.ts is gone: nobody wanders now.
- The pixel art of section 9 is src/skin/rooms/penArt.tsx, grid for grid; the mute, unmute, kick and check marks there
  are mine, drawn the same way, for controls the plan kept. Brian's own icons, when they come, go in
  src/skin/assets/pen/ under the same names.
- `?preview=room` (development only, rooms/RoomPreview.tsx) draws the screen with made-up players and no server:
  `kind=queue|ranked|lobby&n=&bots=&host=0|1&chat=&fold=1&paused=1&phase=starting&auto=<seconds>&notice=1&offline=1`.
- One new saved key: `sap:pen-chat-folded`, sessionStorage, whether the chat card is folded (the plan: "remembered for
  the session"), pinned in src/skin/__tests__/fences.json.
- Open choices (plan section 13), the defaults used: chat open, numbered mats, the gate swings, explanations shown.

## The pen screen, polish (Brian, 2026-11-22) — plan: docs/pen/PEN-PLAN-V3.md
Brian: the screen "already looks good", make it as good as possible: better use of space, tidier text, every small
flaw fixed (his example: the chat rules banner with the check mark). The plan (version 3, filed word for word but for its
long grid listings, which are in penArt.tsx) applies on top of docs/pen/PEN-PLAN.md as built, replaces its sections 6
and 9 and parts of 7 and 8; "no function changes" still holds. Its standing rules for this screen (section 2) bind any
later change here: headlines and the status card's line 2 never wrap; a name gives way last (Host loses its word, then
You becomes a square, `useSqueeze`); each number once; numbers in Fraunces with their words in Nunito; the spacing
scale 4/6/10/12/16 only; every icon a grid at a whole number of pixels per art pixel; one outline per surface, coloured
bars inside their face; no stray pixels.
- Whole pixels: `Pix` (kit/surfaces.tsx) rounds its art pixel to whole CSS pixels (`artPixel`), so every grid on every
  screen, the leaderboard's too, is a whole multiple of itself (identical at --u 1). On the pen screen `--s` is a whole
  pixel (`.pn.rc`) and snow, icicles and lights use `--ap`, a whole-pixel --u: at --u 1.125 the step was 3.375 px and
  that alone made the stray light pixels, uneven steps and dotted brackets.
- Avatars in the list are `PixelHead` (avatars/AvatarIcon.tsx): Brian's six heads cut back to their own pixel grid
  (src/skin/assets/heads/px, 21 to 25 px, recovered from the sheet's ~6.3 px cells) and drawn at a whole multiple.
  They load as files (`?no-inline`): inlined they cost 8 kB of the bundle.
- Layout as built: the bar 60 (Leave, title tag with the room icon in a lobby, state chip, waiting time; the party
  code as a sunk pill and Invite on the right); a status card of three lines (~94 at --u 1); Players with "N open
  places" in its header and no open-places row or seat badges; Game with the die, Change rules as a small slab in its
  header, two choices of one design and the rules as three chips with their explanations in ink-card tooltips; the chat
  card sized to its content, the rules strip one ink strip with a lantern bar and the new shield. The panel's content
  sits 6 inside its inner frame (`--in`). Only the player list gives way to a short window, in whole rows.
- The pen (scene/pen.ts, rooms/PenStage.tsx, penPlates.css): no numbers on the mats; each model's feet centred on its
  mat (`standOffset`; the sheep's hooves sat 0.085 m off its origin, the pig's 0.12 m), the placing a pure function
  (`penStep`) tested for every n; plates HTML on whole pixels (ScreenAnchor's opt-in `snap`), 26 high, centred 0.12 H
  over their own head (they no longer step over faces: that lifted the front row off their own heads); your plate's
  crown in ink (lantern on lantern left a line); the small lantern on the front-right corner post, half the light,
  2.5 m reach, no bloom; one flat snow floor with a 0.1 m drift inside the back and side fences; no green tufts; the
  tan stalks in four clumps. The camera fits the front row to 84% of the space and stands the gate's foot 20 over the
  button (the spare height goes to the sky). Tests: src/skin/rooms/__tests__/penScene.test.ts.
- Deviations, for Brian: ten seats sit 3 apart, not 5 (16 px seats 5 apart did not fit beside "10 of 10" at --u 1);
  seats shrink to 8 px where even that does not fit (under about 1100 px wide); the chat card is 25vw wide, not 24 (the
  rules ran to three lines at 1920); the party code is no longer a button (the plan), but its text selects whole; long
  French lines were shortened to stay one line. Headlines end in "…" but do not first shrink by 2 px.
- Open choices (section 13), the defaults used: no mat numbers or seat badges; explanations in tooltips; the code in
  the bar.

## One name tag everywhere (Brian, 2026-11-23)
"make the nametags more consistent across all the gamemodes ... the nametags for the coregameplay and this are completely
different". Every tag over an animal is `NamePlate` (src/skin/kit/NamePlate.tsx, nameplate.css), at the barn table
(Quick play, rooms, the daily table), practice on the ice, the tutorial (its "wool" step points at
`.sk-seat-plate[data-you]`), the pen and the winning podium. The leaderboards' two-line crate plates are their own.
- The look, chosen in three rounds the same day. A wool slab was "a random white bar"; five themed mock-ups (ear tag,
  fair ribbon, night row, barn sign, snowy wool) were "too flashy", he wants "something more clean that can be used
  widely"; four clean ones were "all generally fine but the 3 dots are really large and unsettling, same with all the
  text inside". Built: a small flat dark tag (`--hm-ink`, two-pixel corners, no side, no texture) 22 high, with a
  stepped point under it at its animal; the name Fraunces 700, 13, cream; yours in lantern; the animal whose turn it
  is gets a lantern tag with ink letters, 24 high and 14; wool balls as 6 px octagonal dots after the name, lost ones
  dimmed; a bot's badge or the host's crown (8 x 5 at one pixel) before it; frozen dimmed under its ice. Phones: 20 high.
- Keep it quiet: no snow, ribbons, heads or thick sides on it, and nothing bigger than the name inside it. Don't add
  another tag style: give NamePlate a slot instead. Where a page has no Home tokens, pass `tokens`.

## Round announcements hold the clock; the rule stays in view; a stuck letter resets (Brian, 2026-11-23)
Approved engine changes (src/engine: constants.ts, reducer.ts, types.ts, validation.ts; tests in
src/engine/__tests__/announce.test.ts; fences re-pinned). Rooms get them from the server's engine once it is deployed.
- "make the event popup actually stall the timer": a round's announcements (faster turns, its twist;
  `roundAnnouncements`, normal games only) hold the table ANNOUNCE_MS (2.6 s) each, plus ANNOUNCE_TAIL_MS (0.4 s),
  before the first fuse is lit, and the intro starts after the bomb that ended the round has gone off (the aftermath).
  A round with nothing to announce keeps INTRO_MS from the round's end, as before. The roundStart event's `amount` is
  that wait: the screen starts its alarms then, each up for exactly ANNOUNCE_MS (PaintedGame `alarmWaits`).
  Before, the intro was 2.5 s from the time-out and two 3 s alarms queued, so the twist came up mid-turn.
- "make it clearer what event is in play ... people kind of just forget about it": the round's rule sits beside
  "starts with X" all round (InputStrip `rule`, `.sk-rule`: the name tag's dark label, lantern text), and turns barn red
  with a shake while the word typed breaks it, for the rules that can be seen early (no E, no A, no S, five letters at
  most; `LIVE_RULES`); the others are judged when the word is played, as before. `breaksRule` (validation.ts) is the
  twist check on its own, used by validateWord and the screen. The corner sign stays.
- "after 2 people die to the same thing, the bomb resets with a new letter": read as two time-outs in a row on the
  same chain letter (a bomb going off; a freeze is one too). Then the chain moves to a fresh letter (STUCK_LIMIT 2,
  `GameState.stuck`), never that letter or a corner letter (X, Z, Q, J, Y, K), before the next fuse; any word played
  starts the count again; a pass does not. Normal games only. The screen says "New letter: D" with why. The reset draws
  from the game's random stream, so seeded games differ after one.

## The game's UI in the current look; sheep never shorn bare (Brian, 2026-11-23)
"address all of the outdated ui. from that screenshot u sent me alone, i can see the ai generated wood textures on the
popup for new letter d, the tip is just a plain white card, the buttons in the corner, etc. theres probably more. go do a
run through" and "make it so that the sheep cant go naked".
- The modern kit, src/skin/kit/modern.tsx + modern.css: `Dialog` (the pen's board: felt, frame and brackets, snow cap with
  icicles, Fraunces title, square close slab; `closeLabel`), `Scrim`, `Slab` (Home's slab: wool, lantern for the one main
  action, night), `IconSlab` and `Corner` (Home's square corner buttons), `InkCard` (small dark card, a coloured bar down
  its left: lantern, frost, barn, pasture), `Tag`. Every piece brings Home's tokens (`hm rc`). New UI is built from these
  and the pen's recipes, never from the old farm kit (Board, Clipboard, Slate, Paper, Peg, WoodButton, ClothButton, Brass,
  Knit), which stays only where Brian approved it in its own style (the Trading Post, the fair machine, the profile room).
- Converted: Notice (every moment over the table and in the dream: InkCard), the game's corner buttons, the round tab and
  practice count (screens/game-hud.css), the duel's names, the sheets and leave dialog, the practice results and the
  win scoreboard (Dialog; "You are the last sheep standing!", not "You is"); the scoreboard, the between-rounds board, How
  to play's rules and the chain (components/hud-boards.css); the tutorial card, the alarm band, the round's twist sign, the
  word bar's small words and buttons, the speech bubble and its placeholder, the message slip (components/hud-overlays.css);
  the guide family: How to play on Home, Settings and its save code, the first-visit onboarding (components/hud-guide.css;
  no `sk-guide` remains). The first-time tips are the painted `GameTips` (same tips and seen-store as the fenced classic
  CoachTips, label without the middle dot). No hand font, plank, nail, paper, stitching or dashed outline in any of it.
- Not converted, said to Brian: Credits (opens from Settings), the dream's word bar (its own approved kit), the account
  panel when signed in and the email sign-in steps (not reachable without accounts here).
- `coatLevel` (table/Sheep.tsx) never goes under 1: a sheep keeps a thin coat to its last wool ball; the wool balls on its
  tag say what is left.
- The kit audit's gradient budget is 2 (src/skin/audit/budget.json), down from 4: the old mini tiles' gradients went.

## Midnight (Brian, 2026-11-23)
"i feel like it should have an accent color, can u make everything not so blue": four other palettes (ember, pine,
graphite with barn red, plum with gold) were shown on the real screens; he answered "nah ykw its fine. can u like change
the toning on the blue", then picked "midnight" from four blue tones (midnight, slate, winter teal, indigo). The --hm-*
night family in src/skin/styles/tokens.css is now deeper and richer (night #131D3B, night-2 #1B2A52, night-3 #283E74,
night-deep #0E152C, ink #090E20, frost #BBCCF0, dusk #4A54B8); the orange accent is unchanged. Hard-coded copies of the
old blues were routed through tokens (--hm-disabled, --hm-disabled-lip are new), so a palette change is one place. The
loading screen keeps its own colour (it must stand alone).
- Home's cards, polished (Brian's plan of 2026-11-23, "Home's cards (Join party, Practice), polish"). SetupSheet.tsx and the
  `.hm-setup*` / `.sk-code*` rules in home/home.css draw Set the table (Custom game), Practice and Join party. ONE slant: the
  card is skewed by `--lean` (-11deg, -6deg on a phone) and nothing inside is skewed again; only text and icons are stood
  upright (`.hm-setup-up`, about their own middle). So every row, choice, code tile and the action lean by the card's angle
  and their left edges lie on one line; never add a skew or a counter-skewed container inside the card. Rows are a grid
  (label column 116, controls, hint under the controls); a card under 470 wide stacks the label over the controls.
  Its icons are the plan's grids (KeyIcon, BotIcon, ClockArt, TreeIcon, StopwatchIcon, GateIcon). Queue's Casual and Ranked
  cards are PlayChooser, a different component: the plan said they share this one, they do not, and they were not changed.
  Deviations: empty code tiles have an --ink face (the plan's --night-deep is the row's face and they vanished); choices and
  the close button reach 44 px with invisible margins; Start run is focused on opening (Enter starts it) but its ring
  shows only after keyboard use; French "Speed run" is "Contre la montre".
