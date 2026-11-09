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
