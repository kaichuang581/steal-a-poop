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
  plate. It takes no clicks; the longer meaning and example stay in words.ts. Brian has not reviewed the 365 words yet.
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

