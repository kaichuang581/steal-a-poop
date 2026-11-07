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
  else in src/dream changes. The bedroom and the farmer are part of the dream screen (V4 Part 8). The v3 voxel rules
  apply: 0.04 m for the sheep, the farmer and small props, 0.10 m for the bed, fences and signs, 0.20 m for the lane and
  the islands, 1 m for hills and 3 m for mountains; merged face-culled meshes with baked AO; MeshLambertMaterial with
  vertex colours; no bloom, no depth of field; transparency only for the moon halo, the aurora, snow and dream dust.
- The bounded dream (V4 Part 15, Milestone D5) is NOT approved: `DREAM_LENGTH` stays null until Brian says otherwise.
- Counting Sheep v4, D1 to D4 built (approved by Brian, 2026-11-07: "do plan for every decision"): the dream is the
  farmer's (src/skin/dream: stage.ts for the pure layout, world.ts and bedroom.ts for the voxels, DreamStage.tsx for the
  scene, run.ts for the run loop, DreamScreen.tsx for the HUD and results). Where the plan's metres did not fit its own
  camera, the frame targets (V4 Part 4.3) won: +x is screen-right with the camera at +z (the plan's z mirrored); the bed,
  the trail puffs and the islands are placed by the targets; the hills are low; the bedroom's wall plane is dropped;
  the puffs use 0.05 m voxels; the sheep is drawn at 0.72 m (the model is 1.3 m at scale 1). The canvas must never sit
  inside a transformed element (the swoop-in inflated its measured size). Known: draw calls run near 90 against the
  plan's 60. D5 (the bounded dream) stays unbuilt.
