# Counting Sheep: discovery (V4 Milestone D0)

7 November 2026. A map of the voxel dream as committed in `213b33b` and `12f22c3`, written before any D1 work. No source
file changed for this document; the dev overlay numbers come from a temporary mount of `DevStats` that was reverted.

## 1. Files

| File | What it is | Imports from `src/dream` |
|---|---|---|
| `src/skin/dream/DreamScreen.tsx` | The screen: phases (`ready`, `running`, `crashed`, `results`), the `requestAnimationFrame` loop that runs the rules, the HUD, the results card, sharing | `dream.ts`: `check`, `dreamSeed`, `dreamShareText`, `fenceAt`, `FIELD`, `JUMP_MS`, `jumpHeight`, `matched`, `signOf`, `speedAt`, `takeoffDistance`; `daily.ts`: `getDreamBest`, `getDreamStreak`, `markDreamStarted`, `recordBest`, `recordDream` |
| `src/skin/dream/DreamStage.tsx` | The R3F `Canvas` and scene: the farm ring and filler strips, four fence slots with `drei` `Html` signs, the sheep group, the count pop, the camera, lights, `Effects` | `dream.ts`: `FIELD`, `jumpHeight` |
| `src/skin/dream/DreamSky.tsx` | The dream sky: fog, three-stop dome, twinkling stars, moon with halo, cloud sea, floating islands, sheep-shaped clouds, motes; plus `DriftingLanterns` and `SleepZs` used by the stage | none |
| `src/skin/dream/stage.ts` | Pure layout and voxel builders: `PX`, the 144 m ring, `fenceWorldX`/`fenceCentreX`, `scrollOf`/`ringX`, `dreamShot` (camera), `farmApron`, `fillerChunk`, `fillerClouds`, `skyIsland`, `cloudBlob`, `cloudSheep`, `dreamLantern`, `sleepZ`, `dreamMoon`, `jumpFence`, the island/cloud/moon placement lists | `dream.ts`: `FIELD` |
| `src/skin/dream/dreamStore.ts` | zustand: `open`, `practice`, `openDream(practice)`, `close()` | none |
| `src/skin/dream/dream.css` | `.dr-root`, `.dr-edge` (blurred violet vignette), `.dr-fence-tiles`/`.dr-fence-tile`, `.dr-sign`, `.dr-pop` | none |
| `src/skin/dream/__tests__/stage.test.ts` | 9 tests: field scale, fence direction and scroll, ring non-overlap, desktop framing at four aspects, phone framing, far scenery beyond the yard, builders produce geometry, filler has no ground beyond the strip, the moon in frame on 16:9 | `dream.ts`: `FIELD`, `JUMP_HEIGHT` |
| Shared | `src/skin/table/Sheep.tsx` (the sheep and its states), `src/skin/table/BarnTable.tsx` (`useWorld`: barn and yard geometry, `Building` placeholder), `src/skin/scene/layout.ts` (`BARN`, `YARD`, `DISTANCE`), `src/skin/table/Rendering.tsx` (`Effects` composer with bloom, `LANTERN_LIGHT`), `src/skin/voxel/*` (grid, mesher, palette, primitives, `voxelMaterial`), `src/skin/components/{Notice,Materials,Icons,SnowCap}`, `src/skin/hooks/useToday.ts` (`localDateKey`), `src/skin/screens/PaintedHome.tsx` (the ticket, share, streak, `timeOfNext`) | `PaintedHome.tsx`: `dreamShareText`, `getDream`, `getDreamStreak` |

## 2. The loop

- **State** lives in one `useRef<Live>` in `DreamScreen.tsx` (`Live` extends the stage's `StageLive`): `dist`, `t`, `jumpAt`, `crashAt`, `fences[]` (each `{ f, index, x, locked, passed, jumped, word }`), `next`, `typed`, `wrongUntil`, `say`, `count`, `longest`, `used`, `speed`. `freshLive(seed)` queues the first fence from `fenceAt(seed, 0)` at `SPAWN_X`.
- **Advance**: a `requestAnimationFrame` `step` in a `useEffect`; `dt` is clamped to 50 ms; `L.t` advances in `running`, `ready` and `crashed`; `update(L, dt)` runs only in `running`. The stage's `useFrame` reads the ref every frame and only sets positions; nothing in the scene writes to `L`.
- **Pure calls**: `speedAt(L.count)` is the target speed, eased over 600 ms; the queue is kept at four fences with `fenceAt(seed, L.next++)` placed at `max(SPAWN_X, prev.x + gap * speedAt(f.index))`; the jump fires when the next finished fence satisfies `ahead.x − (SX + SW) ≤ takeoffDistance(L.speed)`; `jumpHeight(L.t − jumpAt)` gives the air, `JUMP_MS` ends it; the overlap test is `fe.x < SX + SW − 3 && fe.x + FW > SX + 3` and a bump needs `airNow < FH − 6`; `check(dict, fence, typed, used)` on submit and `matched(fence, typed)` for the tiles and the tick. Constants: `SPAWN_X = 320 + 24`, `TYPE_X = 320 + 70`, `SX = FIELD.sheepX` (78), `SW = 20`, `FW = 12`, `FH = 16`.
- **Units**: `FIELD` (320 wide) is still the unit of the run. The pixel-to-metre factor is `PX = 0.05` m per logical pixel (`stage.ts`): the 20 px sheep is 1.0 m, the fence 0.6 × 0.8 m, the jump 1.4 m. The plan says 0.036.
- React state (`hud`, `fences`, `air`, `pop`, `count`, `bump`) is refreshed only when a derived key changes.

## 3. The scene

- **Axes**: the camera stands at negative z and looks along +z, so screen-right is −x; the sheep runs toward −x and stays at x = 0 on the lane at `LANE_Z = −12`; fences come from −x and the world scrolls toward +x (`ringX`). The plan's world has the sheep running toward +x.
- **Camera, desktop** (`dreamShot(false, aspect)`): `SIDE_SHOT = { distance 9.5, height 2.6, aimY 1.3, fov 40, sheepAt 0.24, lead 1.0 }`; the target x is chosen from the viewport aspect so the sheep sits 24% in from the left; position `[targetX − 1.0, 2.6, −21.5]`, target `[targetX, 1.3, −12]`, fov 40. The camera drifts ±0.06 m on a slow sine and jolts (amplitude 0.08, 0.45 s) on the bump. Plan: fixed camera at (1.5, 2.3, −8.7) → (1.5, 0.9, 0), fov 30, shake ±0.03 m for 300 ms.
- **Camera, phone** (`dreamShot(true)`): position `[5.5, 2.9, −16.5]`, target `[−4.5, 1.1, −12]`, fov 62, looking down the lane from behind the sheep's shoulder. Plan: (3.2, 3.0, −9.5) → (1.2, 0.9, 1.5), fov 46, yawed 25°.
- **Lights**: `hemisphereLight` sky `#CBB6F2` ground `#4E3A78` at 0.6; a rose fill `directionalLight` `#F2B6D8` 0.35 from (−60, 40, 200); the key `directionalLight` `#E6DBFF` 0.8 from (−30, 26, −40) with shadows (map 4096 desktop, 2048 phone, ±24 m box); a warm `pointLight` `#FFD9A0` 16 that travels with the sheep; the barn's lantern `pointLight`s (`LANTERN_LIGHT`, `BARN.lanterns`) inside the farm group. Plan: one moon directional `#CFD8FF` 1.1 from (−4, 9, −6) and a hemisphere `#8A78D2`/`#3A2E6B` 0.6.
- **Fog**: `FogExp2` `#8A6DB5` density 0.0045 and the same colour as `scene.background`; the dome, stars, moon and halo have `fog: false`. Plan: density 0.035 in the horizon colour.
- **Post**: `Effects` from the table: `RenderPass` → half-resolution `UnrealBloomPass` (strength 0.35, threshold 0.85) → `OutputPass`. Bloom is on. There is also a CSS `backdrop-filter: blur(4px)` vignette (`.dr-edge`) over the canvas edges.
- **Grids**: sheep 0.04 m; fence 0.10 m; barn 0.10 m; yard, farm apron, filler strip, island tops and their pines, cloud lips, Zs 0.20 m; the cloud sea between farms 0.5 m; far cloud blobs, sheep-shaped clouds and the moon 1 m; lanterns 0.10 m.
- **Overlay** (temporary `DevStats` mount, headed Chromium on this Mac, after the home screen had built the farm):

| Screen | dpr | Triangles | Draws | Frame | Open to canvas |
|---|---|---|---|---|---|
| 1920 × 1080, running | 2 | 1,452,448 | 82 | 63.0 ms | ≈ 40 ms |
| 390 × 844, running | 1.5 | 1,549,146 | 130 | 20.7 ms | ≈ 30 ms |

The plan's budget is 500 k triangles, 60 draws and 5 ms on desktop; 350 k, 50 and 8 ms on a phone. The farm ring (barn, yard, apron, two 32 m filler strips with islands and cloud seas), the six sky islands, the ten cloud blobs and the three sheep-clouds are all resident at once; the 4096 shadow map and bloom add two full passes.

## 4. The sheep

`src/skin/table/Sheep.tsx`, the default `sheepModel()` at `level 2`, inside a group rotated −π/2 about y (so it faces −x) and scaled `SHEEP_SCALE = 0.85` (plan: 1.0). States used: `idle` in `ready` and `crashed`→`results`, `running` and `leaping` (both added to `SheepState` for the dream) while running, `startled` on the bump, `cold` on the results screen. `gustFrom = [0, 0.8, −4]`. The thought bubble, scarf, breath and freeze effects are unused here.

## 5. The HUD (every string, verbatim)

| Element | String | Where |
|---|---|---|
| Chip | `Counting Sheep · practice` / `Counting Sheep · tonight` | top-left `sk-chip sk-display` |
| Count chip | `{count} sheep counted` and, when a best exists, ` · best {best}` | top-left second `sk-chip sk-num`, `aria-live="polite"` |
| Leave | icon only, `aria-label="Leave the dream"`, `title="Leave the dream (Esc)"` | top-right `Chip` |
| Board (ready) | title `Count sheep to fall asleep`, sub `type a word with each fence’s letters, in order · press any key to start` | `Notice tone="wood" size="lg"` at 18% from the top |
| Line under the board (ready) | `the farmer is dozing off… keep him dreaming` | `sk-hand` |
| Board (bump) | title `Bump!`, sub `the farmer stirs…`, gust icon | `Notice tone="cold" size="lg"` |
| Caption (ready) | `Each fence names letters. Type any real word with them in that order and press Enter: the sheep clears it` | `sk-input-prompt` above the bar |
| Caption (running, fence in window) | `Next fence: {S·P}. Any word with those letters in order, like {example}` where `example` prints the letters with ellipses (for one letter `R…`) | same |
| Caption (running, no fence) | `Keep running… the next fence is on its way` | same |
| Tiles | the active fence's letters in capitals, lit as matched; `· · ·` when no fence is in the window; `aria-label="Needs {letters}, in order"` / `No fence yet` | `.dr-fence-tiles` at the left of the bar |
| Input placeholder | `press any key` (ready) / `a word with {S·P}` / `type ahead…` | `sk-input-placeholder`; hidden input `aria-label="Your word"` |
| Bounce line | `Three letters or more` · `Needs those letters, in order` · `Not in the dictionary` · `Already counted that one` · `Wait for the next fence` | `L.say`, shown in the prompt line |
| Button | `Dream` (ready) / `Jump` (running), disabled on the bump | `WoodButton sk-input-go` |
| Screen reader line | `{S·P}. {count} sheep.` | `sr-only aria-live` |
| Fence signs | the fence's letters (`S·P`) or, once cleared, the typed word in capitals | `drei` `Html` paper chip over each fence |
| Count pop | the new count | `drei` `Html` over the sheep |
| Results | title `The farmer woke up!`; `He counted {count} sheep before the bump`; tiles `Best {best}`, `Longest word {n or –}`, `Mode practice` or `Streak {n} night(s)`; buttons `Dream again`, `Share`/`Copied!` (not in practice), `Back to the farm`; note `Practice dreams don’t count toward your streak.` or `A new dream every night at midnight. Practice as much as you like.` | `sk-tally` dialog, `aria-label="The farmer woke up"` |
| Loading | `Loading the word list…` | before the dictionary arrives |

## 6. Persistence

- The night is `today = localDateKey(new Date())`, fixed when the screen opens: a dream begun before midnight is still that night's.
- `markDreamStarted(today)` on the first key (not in practice); `recordDream({ date: today, status: 'done', count, longest })` when the bump sequence finishes, and also if the player leaves during a run (the night's attempt is spent); `recordBest(count)` for practice; `getDreamBest()` for the chip; `getDreamStreak(today)` for the results tile and the share text. Same calls as the canvas version.
- No "UTC" anywhere on the screen: the results note reads `A new dream every night at midnight.` and the home ticket reads `The farmer is up for the day. Tonight's dream starts at {timeOfNext}.`
- The admin unlock (`src/lib/admin.ts`) lets tonight's dream be opened again and again; each run still records.

## 7. Disagreements between the code and the plan (Brian decides)

1. **Units and direction.** `PX = 0.05` (plan 0.036); the sheep is drawn at 0.85 (plan 1.0); the sheep runs toward −x with screen-right = −x (plan +x).
2. **Camera.** Desktop is aspect-aware (sheep at 24% from the left whatever the shape) with a slow drift; the plan fixes position, target and fov and allows no motion but the bump shake. Phone looks down the lane from behind (plan: a 25° yaw side view).
3. **Ground.** The lane sits on the real farm: the barn, yard and farmhouse roll past on a 144 m ring with two 32 m floating strips between, on 0.20 m voxels, with 0.5 m cloud seas. The plan wants a cloud island with a scalloped near edge, a 4 m chunk ring, a trampled lane with hoofprints, tufts, flowers, rocks and sparkle, and no cube noise. The current cloud sea and the lips are the "rubble" the plan calls out.
4. **No bedroom, no farmer, no thought trail.** The Zs rise from the farmhouse chimney on the ring, not from a sleeper in the bottom-left; nothing ties the dream to a person in frame.
5. **Post and material rules.** Bloom is on (`Effects`), and a CSS backdrop blur edges the frame; the plan allows no bloom and no depth of field. The 0.5 m and 1 m cloud grids are not in the plan's grid list (0.04, 0.10, 0.20, 1 for hills, 3 for mountains).
6. **Sky.** A separate `DreamSky` dome (`#1A0F3A` zenith, `#8A6DB5` horizon, `#2B1A55` nadir) rather than `Sky.tsx` with a `dream` palette (`#5B4AA6` / `#8A78D2` / `#D2C6F4`); the moon is a 42 m disc with a round halo at (−34, 24, 230), not 6 m with a crescent at (84%, 14%); no aurora; 520 motes rising over the lane (plan 140, a different box); sheep-shaped clouds and lanterns drifting up are extras the plan does not have.
7. **Islands.** Six fixed islands plus ten cloud blobs and three sheep-clouds that bob but do not scroll; the plan has six islands on three parallax layers (0.35 / 0.2 / 0.1) that recycle, carrying a tiny barn, a windmill and a lantern post, with no cube noise underneath.
8. **Fences and signs.** The hurdle is 0.6 × 0.8 m (plan 0.43 × 0.58), its sign is an HTML paper chip (plan: a voxel sign post with carved letters and a cream rim when active), a cleared fence shows the word in the same chip (plan: green letters and a paper tag with a tick), and a bumped fence rotates about z by up to 63° over 350 ms (plan: 70° about the base's +x edge with a bounce, snow shed).
9. **Sheep states and effects.** `running` and `leaping` exist (plan: `run`, `jump`, `bonk`, `land`); there is no anticipation squash, no landing squash or snow, no ground shadow, no bell at take-off and no orbiting stars on the bonk. The ready sheep is `idle` (plan: `grazing`).
10. **HUD strings** (Part 7.4 table) differ throughout: chip, board title and subline, the caption's example (prints a letter, which the plan drops in favour of `exampleWords`), the placeholder, the count plaque (no sheep icon), and no help line. The bounce strings and the leave label match.
11. **Wake-up.** The timing matches (`finish` at 1500 ms, 600 under reduced motion) and the board says `Bump!` / `the farmer stirs…`, but there is no dream pop, no sky cross-fade, no farmer, no `alarm`; the camera jolts instead of shaking ±0.03 m.
12. **Results and home.** The card's layout, the seven-night calendar, Warm Blankets, the repair ticket and the new share text (Parts 8, 12, 13) do not exist; `dreamStreakDays` returns `boolean[]`.
13. **Ready state.** The first fence waits at `SPAWN_X` (344 px, 13.3 m at the current `PX`), not 150 px ahead; the subline does not blink.
14. **Performance.** 1.45 M triangles, 82 draws and 63 ms a frame on desktop at dpr 2 against a budget of 500 k, 60 and 5 ms; 1.55 M, 130 and 20.7 ms on the phone size against 350 k, 50 and 8 ms. `DevStats` is not mounted on the dream (Part 11 asks for it).
15. **Guardrail block.** CLAUDE.md's v4 block now states `PX = 0.036`; the code says 0.05 until D1 changes it.

## 8. Screenshots

Taken with Playwright (Chromium, software GL, so the overlay's frame time in the images is not meaningful; the real numbers are in section 3) at exactly 1920 × 1080 and 390 × 844, in a practice dream:

- `docs/skin/dream-d0/desktop-ready.png`, `desktop-running.png`, `desktop-bump.png`, `desktop-results.png`
- `docs/skin/dream-d0/phone-ready.png`, `phone-running.png`, `phone-bump.png`, `phone-results.png`

Things the screenshots show that the text above does not: on the phone the sheep sits in the bottom-left corner, half under the word bar; on desktop the right third of the frame is bare lane; the running shots were taken at count 0 because the script's words were typed before the fence reached the type window.
