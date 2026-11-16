# 17 · Performance and stability

This file makes the game start on any device, fail with a readable message instead of a blank page, and draw far less for the same picture: milestone 1 (stability), milestone 2 (performance, picture unchanged) and the performance half of milestone 4 (tiers). It sets the per-screen budgets and the count gate every later milestone must pass. It answers a friend's report: "like 10 fps, a ton of broken assets, and 35% of his battery in 5 min".

## 1. What exists today (v0.7.4)

- **Canvases.** Nine in the painted skin, one in the classic look. At most two live at once; each visit makes a new context.

| # | Canvas (file:line) | Mounted when | Shadows | Composer | Alive with |
|---|---|---|---|---|---|
| 1 | `src/skin/table/FarmBackdrop.tsx:64` (`memory="farm"`) | Home | sun 4096² (2048² when `phone`) | MSAA, bloom, tilt-shift 0.15 | 8 or 9 (paused under them) |
| 2 | `src/skin/table/BarnTable.tsx:156` (`table`) | every game but practice; stays under the results | sun 4096² + pile spot 1024² (`:379`) | MSAA, bloom | 4 (results) |
| 3 | `src/skin/table/DuelTable.tsx:47` (`ice`) | practice | moon 2048² + spot 1024² | MSAA, bloom | none |
| 4 | `src/skin/table/Podium.tsx:388` (`podium`) | results, `position: fixed` over 2 | spot 1024² | none, `antialias: true` | 2 |
| 5 | `src/skin/dream/DreamStage.tsx:83` (`dream`) | Counting Sheep (`DreamScreen.tsx:337`) | moon 2048² | none | 6 |
| 6 | `src/skin/dream/BedroomBubble.tsx:49` (`bedroom`) | with 5, the whole time (`DreamScreen.tsx:349`) | none | none | 5 |
| 7 | `src/skin/rooms/PenStage.tsx:40` (`pen`) | online lobby or queue | moon 2048² | MSAA, bloom | none |
| 8 | `src/skin/boards/BoardStage.tsx:67` (`boards-sky`) | Leaderboards (lazy, `src/skin/boards/Leaderboards.tsx:24`) | sun 2048² (1024²) | none | 1 (paused) |
| 9 | `src/skin/shop/PreviewStage.tsx:24` (plain `Canvas`, `dpr={[1, 2]}`) | an item's closer look (lazy, `src/skin/shop/Preview.tsx:16`) | none | none | 1 (paused) |
| 10 | `src/ui/Table.tsx:41` | classic look only | default | none | none |

  All draw with `frameloop="always"`, except the farm, `never` behind the Trading Post and Leaderboards (`PaintedHome.tsx:410`). All use ACES tone mapping at exposure 1 and `PCFShadowMap`. Dev-only bake canvases are not built (`src/skin/PaintedApp.tsx:25-29`).
- **Resolution.** `AdaptiveCanvas` (`src/skin/table/Rendering.tsx:264`) changes only the pixel ratio (floor 0.75), stores level and ceiling in `sap:dpr:<scene>`, and never climbs back to a level once found slow (`nextDpr`, `:188-199`).
- **Build.** Three `setTimeout` builds (`BarnTable.tsx:107-115`, `Farmstead.tsx:47-56`). The doors give up at 30 s (`GIVE_UP_TOTAL_MS`, `src/skin/components/BarnDoors.tsx:98`).
- **Mesher.** One quad per exposed face, 56 bytes a vertex including an unread `uv` (`src/skin/voxel/mesher.ts:102-107`). Home: 3.04 M static triangles, 331 MB of arrays, held in the JS heap and on the GPU. Touch detail only for `(pointer: coarse)` (`src/skin/voxel/refine.ts:47`).
- **Never stops.** No frame cap; `powerPreference: 'high-performance'` (R3F default); table and dream draw under the podium and bedroom; music's scheduler (`src/audio/music.ts:186`) runs in a hidden tab.
- **Per-frame React.** `PaintedGame.tsx:102`, `src/skin/hooks/useWordInput.ts:16` and `src/skin/model/useTableView.ts:114` select `s.now`, which `src/state/store.ts:319` sets every frame.
- **No fail-soft.** No error boundary in `src/skin`, no `webglcontextlost` listener, no `vite:preloadError` handler. Fonts load from Google at run time (`PaintedApp.tsx:37-47`).
- **Old plan wrong:** file 16 §4's "under 120 draws at the table" (today 294 to 409) and "60 fps on a laptop" are unmeasurable by the coder.

## 2. Decisions that bind this file

- 2026-11-09: "make the game less laggy without removing anything ... optimize this for all devices" (CLAUDE.md:549-550).
- 2026-11-13: "make the website less laggy"; `samplesFor` and `BLOOM_MAX_W` stay (:843-850).
- 2026-11-13: doors only while loading, never "blocking the website for no reason"; measure long tasks against `data-phase` (:1102-1123). "Don't redesign the loading screen again unless he asks" (:1098).
- "The canvas must never sit inside a transformed element" (:132-133).
- Ask first for a new setting or shortcut (:24); no rule or timer changes (:6); new code in `src/skin` (:8); no new dependencies (:17).
- "Keep the cloud counts and the parked draws" (:775); one level of detail for scenery (2026-11-07, :180).
- The farm keeps moving behind the profile (log summary, :884, not Brian's words). The wendigo is never touched.
- Rulings M4 to M11, M13, M16, C10, C13, C15.

## 3. Problems (verified)

| Rank | Friend's symptom | Cause in the code | How to confirm on his device |
|---|---|---|---|
| 1 | 10 fps | Integrated GPU given desktop work: Home 2.8 to 4.2 M triangles a frame, 1.47 M into a 4096² map redrawn every frame | Report: renderer Intel UHD, Mali or similar; about 10 fps at 0.75x |
| 2 | 10 fps | Software rendering (Home took 6.3 s a frame here) | Renderer: SwiftShader, llvmpipe, WARP, "Basic Render" |
| 3 | 10 fps | The table re-renders React every frame: 8.7 to 12.1 ms of main thread a frame | Table fps lower than Home fps in the report |
| 4 | Battery | No cap (134 renders a second at 144 Hz), no pause, discrete GPU requested, music running when hidden | Report: display Hz, renderer; ask model and battery age |
| 5 | Broken assets | The doors give up at 30 s onto a half-built farm, then the page freezes 11 s | Report: "doors gave up: yes" |
| 6 | Broken assets | A lost or refused context: blank page, or plates over an empty sky | Report: contexts lost; screenshot |
| 7 | Broken assets | The table canvas mounted 1.21 to 1.35 times too big: plates off the right edge | Report: table canvas against window |
| 8 | Broken assets | Resolution stuck at 0.75x for good after one slow second | Report: saved `sap:dpr:*` |
| 9 | Broken assets | Fonts blocked (school filter): system fallback, `cursive` for the hand face | Report: "Fraunces: no" |
| 10 | Never starts | Below Safari or iOS 16.4 the script does not parse; the doors stay shut for ever | Report from the boot card, or the user-agent |

Also: a 404 lazy chunk blanks the page; leaving Counting Sheep throws `NotFoundError`.

## 4. Changes

### 1. The count gate (milestone 0 module, defined here)
- **What:** No visible change; per-screen counts on every pull request.
- **Where:** `tools/gate/probe.js` and `tools/gate/counts.mjs` (new files), called as a module by `npm run gate` (file 16 owns the runner). Ratchets in `docs/visual-overhaul/RATCHETS.json` (new file).
- **How:** A Playwright `addInitScript` wraps `HTMLCanvasElement.prototype.getContext` and, per WebGL2 context, the draw calls (`drawElements`, `drawArrays`, instanced and range forms), `clear`, `blitFramebuffer`, `bindFramebuffer`, `texStorage2D`, `renderbufferStorageMultisample`, `bufferData` and `createProgram`. It records draws and triangles per frame and per framebuffer, so each pass is seen. Count-only mode (`window.__GATE_NODRAW = true`) counts draw, clear and blit calls without executing them: three.js still culls, uploads and compiles, so counts are exact and a software frame costs milliseconds. `__gate.setRafHz(144 | 30 | 0)` fakes other display rates. It also counts React commits (stub `__REACT_DEVTOOLS_GLOBAL_HOOK__`), long tasks, contexts made and lost, `createOscillator` and `localStorage.getItem` calls, page errors, and each canvas's box against its parent's. Production build, `?dpr=1&hour=day`, pinned date, seeded first-visit keys; 1280 × 720 and 390 × 844 touch; each tier by `?gfx=`. States: Home `?pov=0` to `7`, idle, behind Profile; Trading Post and a closer look; Quick Game at 4 and 6 seats; results; practice; Counting Sheep.
- **Do not:** put it in `npm test`; treat any frame rate as evidence.
- **Cost:** about 400 lines of tools; 0 game bytes; about 8 CI minutes.
- **Check:** green twice on unchanged `main`; a real-draw run of Home shot 0 matches count-only within 2%.

### 2. Fail-soft boundaries (milestone 1)
- **What:** A scene that cannot draw shows a kit card, "This device could not draw the farm.", with Reload and "Copy device report"; menus and the HTML game still work.
- **Where:** `src/skin/perf/SceneBoundary.tsx` and `src/skin/perf/AppBoundary.tsx` (new files); `SceneBoundary` wraps the nine canvases of section 1; `AppBoundary` wraps the screen in `PaintedApp.tsx`.
- **How:** React error boundaries; the card fills only the canvas's box. Fix the unmount order in `src/skin/dream/DreamScreen.tsx` so leaving Counting Sheep does not throw.
- **Do not:** swallow errors: each goes to the report's error ring.
- **Cost:** about 1 kB gzipped.
- **Check:** fault suite (file 16): with `getContext` returning null, the card shows and `#root` is not empty at 12 s; no page error leaving Counting Sheep.

### 3. Context loss (milestone 1)
- **What:** A lost context shows "Redrawing the farm..." over the canvas; the scene comes back.
- **Where:** `AdaptiveCanvas` in `Rendering.tsx` (`onCreated`), `SceneBoundary.tsx`.
- **How:** On `webglcontextlost`, `preventDefault()` and show the overlay. On `webglcontextrestored`, hide it (three restores itself). Not restored in 3 s: remount the canvas once by key. A second loss in one session: the card of change 2.
- **Do not:** remount more than once a session.
- **Cost:** under 0.5 kB.
- **Check:** fault suite: after `loseContext()` the overlay shows within 100 ms; after `restoreContext()` draws return to the earlier count.

### 4. A failed lazy chunk reloads (milestone 1)
- **What:** A tab left open across a deploy reloads once instead of going blank.
- **Where:** `PaintedApp.tsx` (a `vite:preloadError` listener); boundaries around `BoardStage`, `PreviewStage` and `LegalDialog` (`src/skin/components/LegalPopupHost.tsx:5`).
- **How:** On the event, reload once, marked by `sessionStorage` key `sap:chunk-reload` (named in the CLAUDE.md entry); a second failure shows the card.
- **Do not:** loop reloads.
- **Cost:** 0.2 kB.
- **Check:** fault suite routes the Leaderboards chunk to 404: one reload, then the card.

### 5. Old browsers and a stuck load (milestone 1)
- **What:** A too-old browser sees "This browser is too old to run Fleeced. Please update it, or try another browser.", not doors shut for ever.
- **Where:** `public/boot-check.js` (new file, classic script), loaded by `index.html` before the module (named change).
- **How:** It tests `RegExp('(?<=a)b')` in `try`, `CSS.supports('color', 'color-mix(in srgb, red, blue)')` and `getContext('webgl2')` (then released). A failed test, or `#root` still empty 12 s after load, puts the card over the doors with a short device report. If Brian says yes (section 8), doors still shut at 25 s add one line, "Still loading. This can take a while on older computers.", and "Copy device report". No `eval` (`script-src 'self'`, `vite.config.ts:34`).
- **Do not:** change the doors' art, timing or `GIVE_UP_*` values.
- **Cost:** under 2 kB in `public/`; 0 in the bundle.
- **Check:** fault suite blocks the main script: the card appears within 13 s.

### 6. Fonts ship with the game (milestone 1)
- **What:** The same faces, with no request to Google.
- **Where:** `public/fonts/` (Fraunces, Nunito, Patrick Hand woff2 plus OFL texts); `src/skin/styles/fonts.css` (new file); `PaintedApp.tsx` (`FONTS_HREF`, `useSkinFonts` removed); `vite.config.ts` (Google hosts out of the policy). Named approved change (C13).
- **How:** `@font-face`, `font-display: swap`, two faces preloaded. Drop the unused `DotGothic16`. The hand fallback ends in `system-ui`, never `cursive`.
- **Do not:** subset away any glyph the letter board uses.
- **Cost:** about 120 kB of static files; 0 JS bytes.
- **Check:** smoke run: no request leaves the origin; `document.fonts.check('16px Fraunces')` is true.

### 7. The canvas fix, picture unchanged (milestone 1)
- **What:** The table canvas fits its box; same picture, about 38% fewer pixels.
- **Where:** `AdaptiveCanvas` in `Rendering.tsx` (default `resize: { offsetSize: true }`); `PreviewStage.tsx` gets the same prop; `.sk-swoop-in` in `src/skin/styles/skin.css:702` uses `animation-fill-mode: backwards`; `BarnTable.tsx` sets the view offset.
- **How:** Where the swoop ran (not under reduced motion), `camera.setViewOffset(1.275 * W, 1.275 * H, 0, 0, W, H)` reproduces today's median crop (precedent: `PenStage.tsx:113`).
- **Do not:** move any camera; change `CAMERA` or `speakerShot`. Brian sees framing pairs only in milestone 7.
- **Cost:** none.
- **Check:** gate: every canvas box equals its parent within 1 px; the root's `filter` is `none`; speaker-shot picture within tolerance of base; DOM anchors within 2 px.

### 8. The device report (milestone 1)
- **What:** "Copy device report" on the failure card, the doors' still-loading line and at `?report=1`; plain text, never sent.
- **Where:** `src/skin/perf/report.ts` and `src/skin/perf/ReportCard.tsx` (new files); short form in `public/boot-check.js`.
- **How:** From counters kept anyway (120-frame interval ring per scene, `renderer.info`, a `PerformanceObserver` for long tasks and failed files, the last five errors). `navigator.clipboard.writeText`, falling back to `window.prompt` as the share buttons do. Format:

```
Fleeced 0.7.4, https://fleeced.io/, 2026-11-16 19:42
Browser: Chrome 142 on ChromeOS; screen 1366 x 768 at 1x; display 60 Hz; 2 cores; 4 GB
WebGL2: yes; renderer ANGLE (Intel, Mesa Intel(R) UHD Graphics 600); max texture 8192
Graphics: Medium (automatic); High measured: no; reduced motion: no
Load: doors open 9.8 s; doors gave up: no; long tasks 3, longest 410 ms
Home: 30 fps median, 24 fps worst 5%; resolution 1x; 148 draws; 0.36 M triangles
Table: canvas 1366 x 768 in a 1366 x 768 window
Contexts: made 3, lost 0, restored 0
Fonts: Fraunces yes, Patrick Hand yes, Nunito yes
Files that failed: none
Sound: music on, audio running
Last errors: none
Saved: sap:gfx medium; sap:dpr:farm 1
```
- **Do not:** include a name, account id, room code or word played.
- **Cost:** about 1.5 kB gzipped.
- **Check:** formatter unit test (no player name, no middle dot); smoke: `?report=1` shows the card.

### 9. Frame governor, cap and pauses (milestone 2)
- **What:** Same motion; at most 60 pictures a second (72 at 144 Hz); nothing drawn that nobody sees.
- **Where:** `src/skin/perf/governor.ts` (new file); `AdaptiveCanvas` with `frameloop="demand"`; an `fps` prop from `PaintedGame.tsx`, `DreamScreen.tsx`, `PaintedHome.tsx`; `MarkDrawn` in the same commit.
- **How:** One `requestAnimationFrame` loop per canvas counts display frames and calls `invalidate()` on every Nth: N = 1 under 100 Hz, else `round(Hz / 60)`, Hz from the median of 30 intervals at mount. `useFrame` still gets true elapsed time, so speeds do not change. Rates: 0 when `document.hidden`; 0 for a fully covered canvas once the cover has `data-drawn` (table under the podium, dream under the full bedroom); 0 behind the Trading Post and Leaderboards (today); the bubble 15; Home 30 after 20 s idle and behind a dialog (question, default yes). `MarkDrawn` invalidates until `data-drawn` is set. `powerPreference: 'default'`.
- **Do not:** touch `useGameLoop` (`src/ui/hooks.ts:5-15`), `STALL_MS` or `src/state`; pause before `data-drawn`.
- **Cost:** about 1 kB.
- **Check:** gate: at most 73 renders a second at 144 Hz; 0 when hidden after 2 s; table 0 at results; bubble 15 ± 1; pictures unchanged.

### 10. The resolution judge repaired (milestone 2)
- **What:** A slow second no longer makes the game blurry for good.
- **Where:** `nextDpr`, `AdaptiveDpr`, `readSettled` and `deviceHint` in `Rendering.tsx`; `src/skin/table/__tests__/adaptiveDpr.test.ts` (replaceable in milestone 2, M3).
- **How:** Judge the mean interval against the governor's target: slow above 1.25 times twice, or 1.65 times once; fast under 1.05 times for 16 looks. A refused level may be retried after 60 s. Ignore frames while doors are shut, during a build slice, in a dip, and 1.5 s after any change. Five frames running over 250 ms count as clearly slow. `SETTLED_UNDER = 3` drops every stored level; levels expire after 7 days.
- **Do not:** change `DPR_STEP` or the 0.75 floor.
- **Cost:** none.
- **Check:** unit tests: 30 Hz at a 30 fps target holds the level; after 10 fps, 60 s at 60 fps restores it.

### 11. Per-frame React work stops (milestone 2, C15)
- **What:** No visible change; the table stops re-rendering React every frame.
- **Where:** `PaintedGame.tsx:102`, `useWordInput.ts:16`, `useTableView.ts:114` (selectors only); `getAvatar` (`src/skin/avatars/store.ts:10`) caches; `heroYaw` in `PaintedHome.tsx:122,194-197` becomes a ref.
- **How:** Selectors take values that change a few times a second (whole seconds left, phase). Frost and fuse read `useStore.getState().now` inside `useFrame` or a ref callback.
- **Do not:** edit `src/state/store.ts`.
- **Cost:** none.
- **Check:** gate: at most 12 react-dom commits a second at the table; 0 `localStorage` reads a frame; no commit on Home pointer moves; "type a word at the table" passes.

### 12. Music sleeps with the tab (milestone 2, M11)
- **What:** Sound pauses while the tab is hidden (question, default yes).
- **Where:** `src/skin/perf/audioSleep.ts` (new file), installed from `PaintedApp.tsx`.
- **How:** On `visibilitychange` to hidden, keep the context from `audioContext()` (`src/audio/sound.ts:36`) and `suspend()` it; on visible, `resume()` the kept context. `tick` already returns while the context is not running (`music.ts:150-151`).
- **Do not:** edit anything in `src/audio`.
- **Cost:** 0.2 kB.
- **Check:** gate: 2 s after hiding, 0 new oscillators a second (today 29.8).

### 13. Geometry, same voxels (milestone 2, M7 steps 1 to 4 and 6)
- **What:** No visible change; Home's worst frame falls from 4.15 M to about 3.55 M triangles; vertex memory halves.
- **Where:** `src/skin/voxel/mesher.ts`, `material.ts`, `unseen.ts` (new file); builders in `src/skin/scene`; `BarnTable.tsx` (`Farm`, `Pile`); `Farmstead.tsx`; `src/skin/table/Sheep.tsx`.
- **How,** in this order, one commit each:
  - **Step 1.** Receive-only meshes (hills, back hills, mountains, farm terrain, forest, drifts, tracks) drop faces no registered camera can be in front of: every Home shot over its travel and drift, the table's wide shots and 108 speaker positions, plus 1 m. Mountains (mounted twice) lose a face only if hidden in both. −222 k a frame on Home.
  - **Step 2.** In those meshes, coplanar faces of one cell size, one tone at all four corners and no rounded edge merge into rectangles, behind `MERGE_FLAT` in `mesher.ts`. −264 k more; these meshes go from 1,137,766 to 618,644 static triangles.
  - **Step 3.** The 57 flat yard ground chunks stop casting (the 7 with footprints or tracks keep casting). Each Home shot gets a caster list (casters whose shadow can reach its view), swapped in the dip. The pile spot draws only the pile and animals via `shadow.camera.layers` (278 k to about 21 k).
  - **Step 4.** Repack to 28 bytes a vertex: position float32; normal int8; colour uint16 stored at half value, doubled in `voxelMaterial`'s shader (values reach 1.196); `bevel` uint8; no `uv`. Never 8-bit colour (7.1% of values move a display step).
  - **Step 6.** At idle each animal makes at most 14 colour and 2 shadow draws: rigid parts merged at build; empty meshes not drawn.
- **Do not:** change a voxel, pivot, colour or anchor; free CPU arrays after upload (`useWorld` is shared); do step 5 here.
- **Cost:** about 2 kB gzipped; build time falls.
- **Check:** `npm run check:scenes`: voxel hashes per builder identical (`__voxelHook`, `mesher.ts:50`), countryside 487,002 voxels; every camera's travel inside the drop box; decoded attributes within 1/32767 of today's. Gate: section 6 counts; pictures within tolerance in `?voxels=sharp` and `round`. A step outside tolerance moves to milestone 4 as a pair.

### 14. The build sliced, first shot first (milestone 2, M10)
- **What:** Doors open sooner onto a whole first shot; the page stays responsive.
- **Where:** `BarnTable.tsx:107-115` (`useWorld`), `Farmstead.tsx:47-56`, the builders, `refine.ts` (`coarse` becomes an argument of `detailed`).
- **How:** Inside the existing `setTimeout` builds, yield at least every 50 ms. Order: touch detail for all shot 0 sees and its casters; doors open when that is whole and drawn; the rest of the countryside after, shown at the first dip; shot 2 waits for the wendigo's stand and view cone (hold shot 1). Desktop detail follows in slices and is swapped in at a dip: on every fine-pointer device until tiers exist, then only on devices that earn High.
- **Do not:** add a Worker; open the doors on a part-built shot; change `GIVE_UP_MS`.
- **Cost:** about 1 kB.
- **Check:** `check:scenes`: identical voxel hashes; gate at 1x: no long task over 200 ms after the doors open, and doors open by `data-drawn`, never by give-up.

### 15. Tiers: earn quality (milestone 4, M6 and M8)
- **What:** Sessions open on Medium; High is earned by measured frames.
- **Where:** `src/skin/perf/tier.ts` (new file); `Lights`, `Effects` in `Rendering.tsx`; `FarmBackdrop.tsx`; `sap:gfx` (device cache, named in the entry).
- **How:**

| | High | Medium | Low |
|---|---|---|---|
| Gets it | 10 s of steady Home frames after the build: median at most 1.1 × target interval, 95th percentile at most 1.5 ×, resolution at maximum | every session at start | Medium's median over 1.5 × target at 0.75x |
| World detail | today's for the device (desktop detail on a fine pointer) | touch detail | touch detail; scrub and drifts more than 30 m from the wendigo and outside its view cone dropped |
| Sun shadow map | today's size, redrawn at 10 Hz | 2048², 10 Hz | 1024², drawn once per shot |
| Bloom | today's | at most 480 px wide | off |
| Tilt-shift | today's | today's | paddock shot only |
| Ground contact | shadow | shadow | opaque stepped voxel patch; animals stop casting (file 02) |

  Changes only in Home's dip or at a scene change; never up and down in one session. `sap:gfx` only lets High's detail start building early. `?gfx=low|medium|high` pins a tier. The failure card (a baked picture is a question) replaces the canvas when the renderer fails, a context is lost twice, or Low stays under 10 fps for 10 s.
- **Do not, on any live tier, remove:** ground contact for any animal; the bomb's spark and digits; floating letters, name plates and the speech bubble; falling snow; hour colours and fog; hats while the season is on; `ROUNDED_VOXELS` as set; on the paddock shot, its light, fog, tilt-shift and tour (file 02).
- **Cost:** about 2 kB.
- **Check:** gate runs all three tiers against section 6; unit tests of the tier rules; pairs for Brian (■).

### 16. Rules for every later milestone
- **What:** No visual milestone may cost unseen performance.
- **Where:** every plan file and the CLAUDE.md entry.
- **How:** No new `<Canvas>`. No new pass, light or `castShadow` without a line in section 6. A canvas's light set never changes at run time (it recompiles every program). No geometry rebuilt per frame. New effects instanced, parked at zero size, drawn once at load. No `filter` or `backdrop-filter` over a live canvas. Endless CSS animations use `transform` or `opacity` only. No new `s.now` selector in `src/skin`. Re-bake an image in the commit that changes its model.
- **Do not:** raise a ratchet; edit `tools/gate/**` or `RATCHETS.json` without Brian.
- **Cost:** none.
- **Check:** the gate; a grep in `npm test` for `<Canvas` and `s.now` in `src/skin` against today's counts.

## 5. Integrity (nothing floats, nothing breaks)

- Changes 13 and 14 leave every voxel set identical (hash per builder): nothing new can float.
- After the view offset, plates, bubble and letters stay within 2 px of their anchors.
- No shot is seen part-built: later parts appear only in a dip; shot 2 only after its cone.
- Ground contact exists on every tier; the Low patch is checked by file 18's attachment rules.
- The failure picture is in the bake manifest.

## 6. Budget

Triangles and draws over all passes, `?dpr=1`. Home figures are the one-second mean of the worst shot / the peak frame. All only fall.

| Screen | Today | High | Medium | Low |
|---|---|---|---|---|
| Home triangles | 4.15 M / 4.15 M | 2.5 M / 3.6 M | 1.7 M / 2.4 M | 1.4 M / 2.1 M |
| Home static mounted | 3.04 M | 2.54 M (farmstead 680 k) | | |
| Table, 6 seats, peak | 2.32 M | 1.8 M (mount 1.02 M) | 1.47 M | 1.47 M |
| Practice ice, peak | 459 k | 459 k | 269 k | 269 k |
| Counting Sheep running | 611 k, two canvases | today, bubble 15 fps | today | today |
| Results | 2.55 M, two canvases | podium only, 200 k | 200 k | 200 k |
| Item closer look | 4 k / 9 draws | today | today | today |
| Draws, Home / table peak | 961 / 409 | below today after change 13; the gate records the new figure | 529 / 308 | below Medium |
| Vertex buffers, Home / table | 324 / 142 MB (touch 175 / 88) | 165 / 72 MB | 90 / 45 MB | 90 / 45 MB |
| Lights | Home 6, table 7, ice 8 | never more | same | same |
| Renders a second at 144 Hz / hidden | 134 / 0 | 73 / 0 | 73 / 0 | 73 / 0 |
| React commits a second at the table | 60 | 12 | 12 | 12 |
| Oscillators a second, 2 s hidden | 29.8 | 0 | 0 | 0 |
| Canvas against its box | 1.21 to 1.35 | 1.00 | 1.00 | 1.00 |
| JS gzipped | 750.14 kB | at most 751.26 kB (net-zero, M4) | | |

Home's peak budget applies from milestone 2; its mean needs the 10 Hz sun redraw and applies from milestone 4. The paddock shot is exempt (file 02; one entry in the exemptions file). Pen and Leaderboards: baseline recorded in milestone 0, never worse.

## 7. Acceptance

- [ ] `npm test`, `npm run build`, `npm run size` (at most 751.26 kB), `npm run check:scenes` green.
- [ ] `npm run gate` green on all screens and tiers in section 6, in CI on the pull request.
- [ ] Fault suite: no WebGL, lost context, 404 chunk, fonts blocked, script blocked: each ends on a readable card.
- [ ] Voxel hashes identical for every builder; countryside 487,002 voxels.
- [ ] Head-against-base pictures within tolerance for milestones 1 and 2.
- [ ] HUMAN: Brian sees the tier pairs and the failure card (milestone 4).
- [ ] HUMAN: a Chromebook-class and a phone device report back before milestone 4 closes (file 16).

## 8. Decisions for Brian

- Draw at most 60 pictures a second on 120 Hz and faster screens? Recommended: yes.
- Home's farm at 30 a second after 20 s idle and behind an open panel? Recommended: yes.
- Pause the music while the tab is in the background? Recommended: yes.
- Doors say "Still loading" after 25 s, with "Copy device report"? Recommended: yes.
- A still picture of the farm on the failure card? Recommended: yes.
- "Graphics" and "Copy device report" rows in Settings? Recommended: no for now.
- Move `meaning` and `example` from `src/skin/wotd/words.ts` to `public/wotd-notes.json` to pay for these bytes? Recommended: yes.
