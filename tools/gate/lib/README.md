# tools/gate/lib: the browser helper

Three files that are the one way any gate tool builds, serves, opens and photographs the painted game
(plan file 16, section 4.1 d):

| File | What it is |
|---|---|
| `painted.mjs` | The cache, the base checkout, the gate build, the preview server, the browser, the pinned page, the clock moved by hand, and one function per place the gate photographs. |
| `determinism.js` | An init script: the page's dice from one seed, and a switch that stops WebGL drawing. |
| `png.mjs` | Decoding and comparing pictures, and the wendigo's mask. |

The other files in this folder (`sh.mjs`, `git.mjs`, `ratchets.mjs`, `report.mjs`, `vitest.mjs`) are the runner's:
see `../README.md`.

Everything below headed "Measured" was measured on 2026-11-16 on the gate build of this branch (game code identical
to commit `6edc7fe`), on a 10-core Mac with 16 GB, node v22.23.4, Playwright 1.65.0, its headless Chromium
158.0.8127.18 drawing with SwiftShader ("ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (LLVM 10.0.0)), SwiftShader
driver)"). Nothing here was measured on the build server: its numbers will be slower, and are NOT RUN.

```js
import { ROOT, ensureGateBuild, serve, launch, home, table, shoot } from './lib/painted.mjs';
import { compare } from './lib/png.mjs';

const site = await serve(await ensureGateBuild(ROOT));
const browser = await launch();
try {
  const a = await home(browser, { url: site.url, pov: 0, hour: 'day' });
  const one = await shoot(a.page);          // a.errors must be empty
  await a.context.close();
  const b = await table(browser, { url: site.url, viewport: { width: 390, height: 844 }, touch: true });
  const two = await shoot(b.page);
  await b.context.close();
} finally {
  await browser.close();
  await site.close();
}
```

## 1. What is true about driving the painted game

Each of these was found by running the built game, not by reading it.

1. **The game runs under Playwright's clock.** With `page.clock.install` and time left to flow, the doors open, the
   farm builds and frames are drawn. But a frame of Home takes the graphics process 0.5 to 1.2 s in software, so
   a real second holds a different number of frames each run, and everything that counts time (the doors' 15 s and
   30 s give-up, `src/skin/components/BarnDoors.tsx:97-98`; the turn clock; every animation) lands differently.
   Home was ready after 14 s that way.
2. **So the clock is held and moved by hand.** `openPainted` holds it at the pinned moment before the page loads;
   after that it only moves when this file moves it, a 16 ms frame at a time (`advance`), or in one hop (`jump`). The
   page is asked after every step whether it is ready. With the clock held, every run of a place reached the same
   reading of `performance.now()` and rolled the same count of random numbers (section 6).
3. **`page.clock.pauseAt(time)` alone is the right call.** It installs the same clock `install` does and holds it:
   `Date.now()` is the pinned moment and `performance.now()` is 0 at the page's first instant, every load. `install`
   followed by `pauseAt` leaves `performance.now()` at the real milliseconds that passed between the two calls:
   three loads read 1, 1 and 0.
4. **The pinned date reaches the game's own clock.** Pinned at 12:00, Home's `html[data-hour]` is `day` with no
   `?hour=`; at 22:00 it is `night`; at 06:30 `dawn`. The word of the day is "cackle" on 16 November and "snicker" on
   the 17th. The dream opened from the menu reads "Tonight's dream" for Nov 16 with a sign T, and for Nov 17 a sign L.
5. **A WebGL call only queues work.** Stepping the clock with drawing on does not wait for the picture: 94 frames
   took 57 s to reach a ready Home, and a screenshot then waited 8 s more. So frames are stepped with drawing off
   (`determinism.js`, `noDraw`) and only the last two before a shot are really drawn. See "Drawing" below for the
   proof that the picture is the same.
6. **What a timer throws comes back through the clock.** Under the held clock the game's timers and frames run
   inside `page.clock.runFor`, so an exception in one rejects that call instead of raising `pageerror`. `advance` and
   `jump` put it in the page's `errors` as a `pageerror` and carry on (measured with a thrown test error).
7. **A game's seed is written from the date and the dice at the click** (`src/state/store.ts:237` practice,
   `:251` a table: `` `quick:${Date.now()}:${Math.random()}` ``). The engine's own randomness all comes from that seed
   (`src/engine/game.ts:46`). So straight before the click that deals, `deal()` sets the page's date to the pinned
   moment plus 60 s (`page.clock.setSystemTime`: the date only, no timer fires, `performance.now` does not move) and
   starts the dice again from the seed. Same seed, same deal: seed 20261116 deals the letter K to Brian, Maple,
   Barley, Tansy, Sorrel and Thistle; seed 7 deals T to Brian, Clover, Nettle, Hazel, Tansy and Barley.
8. **Some things arrive in real time whatever the clock says**: the size the browser reports for a new canvas, a
   lazy piece of code, the wendigo's model, a font. So while it waits for a screen to come up, the helper gives the
   browser two real frames of its own between steps and checks that nothing is being fetched. With that, each place
   lands on the same tick every run.
9. **Playwright's own actions work under the held clock**: `page.evaluate`, `locator.dispatchEvent('click')`,
   `page.keyboard.type`, `page.screenshot`. Typing "kiwi" at the table after `table()` put K, I, W, I in
   `.kit-float .sk-type-tile` and in the speech bubble, and Enter played it.
10. **A finished game is reached by playing nothing.** After Sit down the clock is hopped 250 ms at a time (under
    the 400 ms the game calls a stall, `src/state/store.ts:112`) with drawing off. Your turns run out, your sheep
    freezes, the farm sheep play on. With the pinned seed and six seats the results come up 283.25 s of the page's
    clock after your first turn (1,133 hops) and Thistle wins; it takes 5.7 s of real time. Under reduced motion the
    board is up the moment the game ends (`src/skin/screens/PaintedGame.tsx:173`); with motion on the finale plays
    first and the same wait sits through it (47 s in all). The admin panel's "Skip to the end" is not used.
11. **Several places can be opened at once** in one browser, each in its own context. Four at a time gave the same
    pictures as one at a time (45 opens in 269 s).
12. **A touch context is a phone.** `touch: true` sets Playwright's `hasTouch` and `isMobile`; the page then matches
    `(pointer: coarse)`, `html[data-device]` is `phone`, and the farm builds at touch detail: Home's shot 0 is
    1,851,813 triangles in 390 draws at 390 x 844 touch, against 3,424,083 in 636 on a computer (read from `?dev`).
13. **The build reads the whole checkout.** Tailwind scans every file git does not ignore, docs and tools included:
    this branch's build has three more CSS rules than the base's (`.line-clamp-2`, `.font-display`, `.text-[12px]`,
    all from words in `docs/visual-overhaul/`). The JavaScript is the same but for the hashed file names. Home and
    the table from the two builds are the same picture, pixel for pixel. This is why `treeKey` hashes every changed
    file and not only `src/`.
14. **All of `package.json` ships inside the game's main script.** Home imports it for the version number
    (`src/skin/screens/PaintedHome.tsx:3`), and the built script holds the whole file: every script's name and
    command, every dependency. So a script added to `package.json` is bytes a player downloads. Measured on this
    branch as it stood on 2026-11-16 with three scripts added and one changed: the main script went from 2,239,630 to
    2,239,787 bytes (671,463 to 671,500 gzipped by `gzip`), against a size limit with under 4 kB to spare.

## 2. painted.mjs

### The cache, builds and the server

| Export | What it does |
|---|---|
| `ROOT` | The checkout this file belongs to. Its `node_modules` run vite and the browser. |
| `cacheDir()` | `$GATE_CACHE`, or `~/.cache/fleeced-gate`. Made if missing. |
| `treeKey(root)` | The commit's sha when `git status --porcelain --untracked-files=all` is empty, else `<sha>-<12 hex>`: a SHA-256 over every changed or new file's state, path and contents (a deleted file counts as gone), and over any `.env*` file at the root (vite reads them, git hides them). `tools/gate/lib/git.mjs` (`treeStamp`) follows the same recipe so a tree's build and its test report share a folder: change both or neither. |
| `treeDir(root)` | `<cache>/<treeKey>`, made if missing: the one folder that belongs to that source. Its gate build is there, the runner's test report, and whatever a tool keeps about that tree (shots, counts). |
| `withLock(name, fn, { waitMs, log })` | Runs `fn` holding `<cache>/locks/<name>.lock`, a directory holding its owner's pid. A lock whose owner is no longer running is taken over. |
| `ensureBaseCheckout(root, sha, { log })` | A detached `git worktree add` of that commit at `<cache>/wt/<sha>`. Reused only when it is a checkout of its own, at that commit, with nothing in it changed or new; anything else there is deleted as plain files and checked out again with `git worktree add --force --detach` (`--force` lets git drop its old entry for that one path). No other git command that changes anything is run: no `worktree remove`, no `worktree prune`, which reach into the list of every checkout the repo has. `node_modules` there is a link to `root`'s when the two `package-lock.json` files are byte-identical, else `npm ci` runs there; a link left pointing at nothing is made anew. Locked. Returns the directory. Do not write into it. |
| `ensureGateBuild(dir, { log })` | `VITE_TOUR=1 vite build --outDir <cache>/<treeKey>/dist-gate --emptyOutDir`, run in `dir` with that checkout's vite. Every `VITE_` switch the game reads is set (server, sign-in and look all empty) and `VITE_BASE` is taken out, so the shell and env files cannot change the build. Skipped when `<cache>/<treeKey>/dist-gate.json` is there; that stamp is written last, so a killed build is built again. Locked. Returns the output directory. |
| `basePathOf(distDir)` | The address the build expects to live under, read from its own `index.html` (`/steal-a-poop/` unless built with another `VITE_BASE`, `vite.config.ts:58`). |
| `serve(distDir, { timeoutMs })` | `vite preview --outDir <distDir> --host 127.0.0.1 --port <free> --strictPort --base <base>`, started with node directly so closing it leaves no child behind. Resolves `{ url, port, base, close }` once the page answers. The server ends with the process that started it, closed or not (see "Ending" below). |
| `CHROMIUM_ARGS`, `launch(options)` | Chromium with `--use-angle=swiftshader --use-gl=angle --enable-unsafe-swiftshader`. `PW_CHROMIUM` names another Chromium to use, as in `playwright.config.ts`. The first call also makes SIGTERM and SIGHUP end the process (Playwright takes both once a browser is up). |

Measured: the gate build takes 0.8 s. Two processes asking for the same new build at once: one built (0.8 s), the
other waited and took it (1.0 s); a third call took 28 ms. A lock left by a dead pid was taken over at once. The base
checkout of `6edc7fe` was made, linked to this checkout's `node_modules`, and reused in 20 ms. A build made with
`VITE_BASE=/` was read as `/`, served there, and gave the same Home. With `PW_CHROMIUM` pointing at the same
Chromium the picture was the same. NOT RUN: the `npm ci` branch (the lock files are the same today); another
Chromium than Playwright's own; any machine but this one.

Dirty-tree builds pile up in the cache, about 10 MB each: the key covers every changed or new file, a tool's own
source included, so each edit to a tool under `tools/` is a new build (a second) and a new folder. Any folder there
can be deleted at any time.

Measured for the base checkout, in a throwaway repo with its own cache: a fresh one is made in 0.1 s and reused in
0.08 s; a new file in it, a tracked file edited, its folder deleted by hand, its `.git` broken, and its commit moved
each got it deleted and made again, at the right commit and clean, with `treeKey` equal to the commit; a missing
`node_modules` link was put back without a new checkout. Through all nine steps the repo listed two checkouts, never
more, and the head's `node_modules` was never touched.

### Ending: nothing outlives the tool

Every node process this file starts (the preview server, the gate build) is started with a small preload that ends it
the moment its stdin closes, and the other end of that pipe is held by the tool. So the child goes when the tool
goes, however the tool goes. The server is also not counted as work the tool waits for.

What it replaced, measured first: a tool that threw before closing anything left one `vite preview` running, and so
did one that called `process.exit` (which is what the gate does once its verdict is printed); and `kill <pid>` did
not end a tool that had a browser up, because Playwright takes SIGTERM for itself: the tool stayed, waiting on its
timer, and its server with it.

Measured now, each with a server and a browser open and a page loaded:

| How the tool ended | Its exit code | What was left running |
|---|---|---|
| It threw before closing anything | 1 | nothing |
| `process.exit(3)` | 3 | nothing |
| `kill -9` | (killed) | nothing: the server and the browser both went |
| `kill` (SIGTERM), while waiting on a timer | 143 | nothing |
| SIGHUP | 129 | nothing |
| Ctrl-C (SIGINT) | 130 | nothing |
| It closed the browser and forgot the server | 0 | nothing |
| A gate module that left both open | the gate ended 2 s later | nothing |

A browser that is never closed still holds the tool open (Playwright's own pipe does): close it in a `finally`, as
the example at the top does. A tool killed with `kill -9` leaves two of Playwright's folders behind in the system's
temporary folder (the browser's profile and Playwright's artifacts); after SIGTERM there were none.

### Opening the page

| Export | What it does |
|---|---|
| `PINNED` | `{ time: '2026-11-16T12:00:00', seed: 20261116, timezoneId: 'UTC', locale: 'en-US' }`. |
| `epochOf(time, timezoneId)` | The epoch of a wall-clock time in a zone. A time that names its own zone, a Date or a number passes through. |
| `firstVisitAnswers(at)` | The localStorage a returning player has (section 4). |
| `openPainted(browser, options)` | A fresh context and page: `{ context, page, errors }`. See below. |

`openPainted` options: `url` (needed); `query` (added to the address; `dpr=1` unless it says otherwise);
`viewport` (1280 x 800); `touch`; `reducedMotion` (true); `time`, `seed`, `timezoneId`, `locale` (the pinned ones);
`storage` (more localStorage: null takes a key out, a string is stored as it is, anything else as JSON); `init` (more
init scripts, run after `determinism.js`, so anything they wrap sits outside its wrappers and sees every call);
`before({ context, page, errors })` (runs when all is set and nothing is loaded: the place for a route that answers
404); `fonts` (`'cache'`, `'live'` or `'block'`).

What it pins: the clock (held at `time`), the dice (`seed`), the zone and language (so noon is noon on any machine),
the device pixel ratio (1), reduced motion, light colour scheme, no service workers, and the saved answers.

`errors` fills with `{ kind, text, url }`: `pageerror`, `console` (errors only), `requestfailed`, `status` (an answer
of 400 or more) and `content-type` (an answer whose type does not match its file's ending: `vite preview` answers a
missing `.js` with the page and status 200). All five kinds were seen with a deliberate fault each.

Fonts: until milestone 1 ships them, the page fetches its fonts from two outside hosts
(`src/skin/PaintedApp.tsx:37`). With `fonts: 'cache'` each answer is kept in `<cache>/fonts/` the first time and
replayed after, so base and head are set in the same font files with no network. Measured: `'cache'` and `'live'`
give the same Home; `'block'` changes 10.45 % of Home's pixels. Delete `<cache>/fonts` to fetch them afresh.

### The clock, drawing, waiting and the shot

| Export | What it does |
|---|---|
| `FRAME_MS` | 16: the pinned clock's frames fall on multiples of 16 ms. |
| `PATIENCE_MS` | The real-time patience of one wait (see Timeouts below). |
| `advance(page, ms)` | `page.clock.runFor`: every timer fires in turn, a frame every 16 ms. |
| `jump(page, ms)` | `page.clock.fastForward`: each timer that came due fires once, and one frame. |
| `until(page, test, arg, { step, hop, timeoutMs, what })` | Steps the clock (`advance`, or `jump` with `hop`) until `test(arg)` is truthy in the page; returns its answer. `timeoutMs` is real time (`PATIENCE_MS` when left out). |
| `drawing(page, on)` | Whether WebGL really draws. |
| `settle(page, { frames, timeoutMs })` | Turns drawing on, steps `frames` (2) frames, waits until the graphics process has passed a fence put in each canvas's queue (`fenceSync`), then two real frames of the browser. Returns the real ms it took. Drawing stays on. |
| `waitReady(page, { home, loose, frames, timeoutMs })` | Steps with drawing off until the page is ready (below), then `settle`. Returns `{ waitMs, drawMs }`. |
| `click(locator)` | `locator.dispatchEvent('click')`. |
| `shoot(page, options)` | `page.screenshot({ animations: 'disabled' })` as PNG bytes. Refuses when frames were stepped with drawing off and not settled since: that picture would show the canvas at an older moment than the page. |

Ready means, all at once: no `.sk-doors` and no `#boot-doors`; every `canvas[data-engine]` has `data-drawn` and its
context is not lost; on Home also `.sk-farm-fade[data-ready]`, at least one canvas, and no menu row still reading
"Loading" (the word list is in); every stylesheet and `<img>` has arrived; `document.fonts.status` is `loaded`; no
request is on its way. Then `document.fonts.ready` is awaited, and the frames are drawn. There is no bare sleep
anywhere: every wait is the clock stepped and the page asked.

Timeouts: each wait (reaching a screen, drawing it) gives up after `PATIENCE_MS` of real time: 300 s, or
`$GATE_PATIENCE_MS`, or the `timeoutMs` the place was given. The same number replaces Playwright's own half minute
for a click or an evaluate. The error names the place, what it was waiting for, and what the page had said. A call
into a page whose graphics process is stuck never returns by itself, so every wait also has a plain deadline.

### The places

Each takes `(browser, options)` with the options of `openPainted`, opens a fresh context, and returns
`{ context, page, errors, timings }` in a stable state, drawn and ready for `shoot`. Close the context after.

| Export | Where it ends |
|---|---|
| `home({ pov, hour, extraQuery })` | Home on one held shot. `pov` 0 to 7 on a computer, 0 to 5 on a phone; `hour` dawn, day, dusk, night. On shot 2, or with `extraQuery: { wendigoDebug: '' }`, it also waits until the wendigo's model is standing in the scene. |
| `table({ seats })` | The barn table, 2,000 ms into YOUR turn: Create lobby, the "set the table" panel, Sit down. `[data-tour="input"]` has `data-mode="mine"` and its hidden input has the keys. |
| `tableResults({ seats })` | A finished Quick Game on its results board (`.sk-final`) with the podium drawn, 1,000 ms after it came up. |
| `duel({ clock, bot })` | Practice, 2,000 ms into your first turn on the ice: the Practice row, the "Practice run" panel, Start run. |
| `dream()` | Counting Sheep, opened from the menu row, at its ready sign, 500 ms after it came up. Nothing is pressed, so the night is not used. |
| `bazaarSacks()` | The Trading Post on its Feed Sacks tab. |
| `bookPreview()` | The Barn Book with the first item's closer look open. Under reduced motion that is the still picture; with `reducedMotion: false` it is the live model, whose canvas never marks itself drawn, so twenty frames are counted off. |
| `profile()` | The profile page, opened from the plank with your name. |

`timings` is real milliseconds: `homeMs` (to a ready Home), `tableMs`, `iceMs` or `dreamMs` (to that screen drawn,
from the start), `playedOutMs` and `gameClockMs` (a game run to its end: real time, and the page's clock),
`farmDrawMs` (the farm drawn before the Trading Post opens), `drawMs` (the last `settle`) and `totalMs`.

Notes. Every place but `home` enters through Home without drawing it. The Trading Post and the profile show the
farm dimmed behind them: the farm stops drawing behind the Trading Post (`src/skin/screens/PaintedHome.tsx:410`,
`src/skin/table/FarmBackdrop.tsx:64`), so it is drawn for real once before the Trading Post opens; behind the profile
it keeps drawing, and the last frames are the real ones. `deal()` moves the date 60 s on: a `time` in the last minute
before midnight would deal the game on the next day.

## 3. determinism.js and png.mjs

`determinism.js` leaves `window.__gate` on the page:

| Member | What it is |
|---|---|
| `seed` | The seed in use. |
| `reseed(n)` | Start both streams again from `n`, or from the seed. |
| `drawn` | How many numbers have been given out: `{ random, crypto, uuid }`. |
| `real` | The browser's own `raf`, `now` and `setTimeout`, kept from before the pinned clock took their names. |
| `noDraw(on)`, `drawing`, `skipped`, `stale` | The drawing switch, how many draw calls were skipped, and whether one was skipped since the last real one. |

`Math.random` is one mulberry32 stream and `crypto.getRandomValues` / `crypto.randomUUID` another, both from the
seed: snow calls `Math.random` every frame, and a sack's roll reads `crypto`, so a frame more or less never moves it.
No random source was found escaping the seed: `Date.now` and `performance.now` are the clock's, and the only place
the date mattered (a game's seed) is pinned by `deal()`.

`png.mjs`:

| Export | What it does |
|---|---|
| `decoder` | `'playwright-core'` or `'built-in'`: which reader is in use. |
| `decode(buffer)` | `{ width, height, data }`, RGBA bytes. Uses `PNG` from `playwright-core/lib/utilsBundle` (found there in 1.65.0). |
| `decodePlain(buffer)` | The stand-in on `node:zlib`, for 8-bit RGB or RGBA, not interlaced. Used only if playwright-core's reader cannot be reached. Measured: byte-identical to it on a 1280 x 800 shot. |
| `compare(a, b, { threshold: 24, tileCols: 16, tileRows: 9, patchWidth: 16, patchHeight: 9 })` | `{ sameSize, width, height, pixels, differing, share, worstTileMeanDelta, worstTile, worstPatchMeanDelta, worstPatch }`. A pixel differs when any channel is more than `threshold` apart. `share` is 0 to 1. `worstTileMeanDelta` is the largest gap, on one channel, between a tile's mean colour in the two pictures, with the picture cut into a 16 x 9 grid; `worstPatchMeanDelta` is the same for tiles of 16 x 9 pixels, and `worstPatch` that tile's top left pixel. Different sizes: share 1, both deltas 255. 7 ms for a 1280 x 800 pair. |
| `PLAN_LIMITS` | `{ share: 0.005, tileMean: 3 }`: the plan's two limits. |
| `withinLimits(result, limits)` | Whether what `compare` found is inside the limits: `share`, and both tile numbers. `limits` may be tighter than the plan's (a shot's own tolerance, four times its noise); a looser one is cut back to the plan's. |
| `isMagenta(r, g, b)` | The wendigo's debug colour: `min(r, b) - g >= 60`, `abs(r - b) <= 80`, `max(r, b) >= 90`. |
| `countMask(a, isMask)` | How many pixels `isMask` picks out. |
| `maskIoU(a, b, isMask)` | `{ iou, a, b, both, either, sameSize }`. Two empty masks score 0, not 1: a check that never saw the shape must not pass. |

### The tile rule (measured)

The plan's words are "no 16 x 9 tile's mean differs by more than 3". That is either a grid of 16 x 9 tiles (each
80 x 89 pixels at 1280 x 800) or tiles of 16 x 9 pixels. `compare` measures both and `withinLimits` holds both to the
limit, which is the stricter reading; which one the plan means is Brian's to say.

They are far apart. The plan's own check of the picture gate is "a 40 px change in one scene fails exactly that
scene's shots". A 40 x 40 block of a real shot was moved 40 px sideways at 400 seeded places, in five of the gate's
shots. No move reached the other limit, 0.5 % of pixels (a block is 0.16 %), so the tile rule is all that can catch
one:

| Shot | Caught with the 16 x 9 grid | Caught with 16 x 9 pixel tiles |
|---|---|---|
| `home-pov0-day` | 229 of 400 (57 %) | 399 (99.8 %) |
| `table-turn` | 178 (45 %) | 393 (98 %) |
| `duel-start` | 157 (39 %) | 372 (93 %) |
| `dream-ready` | 96 (24 %) | 371 (93 %) |
| `profile` | 109 (27 %) | 323 (81 %) |

What the small tiles miss are moves inside one flat colour, which change nothing. Noise costs the stricter reading
nothing so far: over the fifteen proof pairs of section 6 the worst small-tile mean is 0.042 (the phone Home's 215
pixels that differ by 1 of 255) and 0 in the other fourteen.

### The wendigo's mask (measured)

`?wendigoDebug` paints the hide an unlit, unfogged `#ff00ff` (`src/skin/table/Wendigo.tsx:81`). On
`home({ pov: 2, extraQuery: { wendigoDebug: '' } })` at 1280 x 800 the figure stands in the box x 812 to 841,
y 52 to 111 by day (y 45 to 111 at night, where more of its soft edge passes the test). Its middle comes out near (240, 32, 224); its edge is soft, because the shot is tilt-shifted.
`isMagenta` picks out 693 pixels by day and 864 at night, and none in any other shot of this file (the same shot
without the switch, by day and at night; Home, table, results, duel, dream, Trading Post, profile, closer look).
Two runs by day: IoU 1 (693 of 693). Two runs at night: IoU 1 (864 of 864). Day against night: 0.80, so the two
hours are compared each with itself, as the plan says.

## 4. What the helper relies on in the game

Storage keys, set before the page's first script unless already there:

| Key | Value | From |
|---|---|---|
| `sap:age-check` | `{ "country": "US", "age": 18, "parent": false, "at": <pinned ms> }` | `src/skin/onboarding/gate.ts:13-21`; passes by `checkPasses`, `:34` |
| `sap:tourDone` | `true` | `src/lib/tips.ts:4`, read at `:19` |
| `sap:settings` | `{ "name": "Brian" }`; the rest comes from `loadSettings` | `src/state/store.ts:104`, `:132` |
| `sap:tips` | `["modifier", "wool"]`: the two coach tips shown once in a first game | `src/lib/tips.ts:3`; ids at `src/ui/CoachTips.tsx:11`, `:16` |

Every other first-run prompt was looked for. With `sap:age-check` taken out the first-visit form does come up
("Welcome to the barn"), so that key is the one that matters. With `sap:tourDone` and `sap:tips` both taken out,
Home, the table on your turn and the results board were the same pictures, pixel for pixel: nothing asks about the
tutorial on Home today, and the coach tips come and go during play (a game played to its end left `sap:tips` as
`["wool","modifier"]`). They are set all the same, so a tip never sits over a shot taken in the middle of a game.
The first Quick Games get the easy table, the same every run. `?dpr=` keeps `sap:dpr:*` from being read or written
(`src/skin/table/Rendering.tsx:278`).

Selectors:

| Selector | Used for | From |
|---|---|---|
| `.sk-doors` | the loading doors | `src/skin/components/BarnDoors.tsx:241` |
| `#boot-doors` | the doors the page comes with | `src/skin/loading/bootDoors.ts:14` |
| `canvas[data-engine]` | every three.js canvas | set by three itself; the game reads it at `src/skin/components/BarnDoors.tsx:200` |
| `[data-drawn]` | a canvas that has drawn three frames | `src/skin/table/Rendering.tsx:165` (`MarkDrawn`, `:161`) |
| `.sk-farm-fade[data-ready]` | Home's farm is shown | `src/skin/table/FarmBackdrop.tsx:63` |
| `.sk-menu-item`, `.sk-menu-label` | a row of Home's menu, by its words | `src/skin/components/GameMenu.tsx:126`, `:147` |
| "Loading" on a menu row | the word list is not in yet | `src/skin/screens/PaintedHome.tsx:213` |
| rows "Create lobby", "Practice", "Counting Sheep", "Trading Post" | the ways in | `src/skin/screens/PaintedHome.tsx:213`, `:242`, `:232`, `:247` |
| `[role="dialog"][aria-label="Set the table"]`, `.sk-sit` | the bot table's panel and Sit down | `src/skin/screens/PaintedHome.tsx:288`, `:341` |
| `.kit-tile` in that panel | how many sit down (`seats`) | `src/skin/screens/PaintedHome.tsx:308` |
| `[role="dialog"][aria-label="Practice run"]`, `.sk-sit` | the practice panel and Start run | `src/skin/screens/PaintedHome.tsx:346`, `:369` |
| buttons "15 s", "easy" in that panel | `clock`, `bot` | `src/skin/screens/PaintedHome.tsx:355`, `:362` |
| `[data-tour="input"]`, `[data-mode="mine"]` | the word bar, and your turn | `src/skin/components/InputStrip.tsx:75`, `:51` |
| `input.sk-input-ghost` | the hidden input that takes the keys | `src/skin/components/InputStrip.tsx:104` |
| `.sk-final` | the results board | `src/skin/screens/PaintedGame.tsx:674` |
| `main.dr-root[data-phase="ready"]`, `.dr-blink` | the dream at its ready sign | `src/skin/dream/DreamScreen.tsx:335`, `:377` |
| `[role="dialog"][aria-label="The Trading Post"]` | the Trading Post | `src/skin/shop/Bazaar.tsx:113` |
| `[role="tab"]`, `[aria-selected="true"]`, "Feed Sacks", "Barn Book" | its tabs | `src/skin/shop/Bazaar.tsx:127`, `:24`, `:27` |
| `.sk-card-view` | an item's picture, which opens the closer look | `src/skin/shop/ItemCard.tsx:77` |
| `.sk-preview` | the closer look | `src/skin/shop/Preview.tsx:68`; still or live at `:72` |
| `[data-profile]` | the plank with your name | `src/skin/screens/PaintedHome.tsx:262` |
| `[role="dialog"][aria-label="Your profile"]` | the profile | `src/skin/profile/Profile.tsx:120` |
| `window.__scene`, a visible sprite in it | the wendigo is in the scene (its eyes are Home's only sprites) | `src/skin/table/DevStats.tsx:8`, mounted at `src/skin/table/FarmBackdrop.tsx:90`; `src/skin/table/Wendigo.tsx:135` |

If one of these is renamed, the place that uses it stops with a timeout that names what it was waiting for.

## 5. Query switches, confirmed in the built game

Each by what it changed on the page of the gate build, at 1280 x 800:

| Switch | From | What was seen |
|---|---|---|
| `?pov=N` | `src/skin/scene/homePov.ts:27` | `pov=1` against `pov=0`: 75.57 % of pixels differ. `pov=2` shows the paddock, `pov=3` the view from inside the barn. |
| `?hour=` | `src/skin/hooks/useAmbient.ts:13` | `html[data-hour]` reads dawn, dusk, night as asked; against day, 7.67 %, 13.74 % and 46.94 % of pixels differ. |
| `?dpr=` | `src/skin/table/Rendering.tsx:286` | The canvas buffer is 1280 x 800 at 1, 2560 x 1600 at 2, 640 x 400 at 0.5. |
| `?dev` | `src/skin/table/DevStats.tsx:27` | `#sk-dev` appears and reads 3,424,083 triangles, 636 draws, dpr 1, and 16.0 ms a frame (the pinned clock's frame, not the machine's). Without it there is no `#sk-dev`. |
| `?wendigoDebug` | `src/skin/table/Wendigo.tsx:75` | The magenta figure (section 3). Without it, no magenta pixel. |
| `?voxels=` | `src/skin/voxel/rounded.ts:22` | `sharp` against the default: 0.80 % of pixels differ. `round` against the default: none (the default is round). |
| `?dreamSeed` | `src/skin/dream/DreamSky.tsx:157`, `DreamScreen.tsx:86` | With motion on, the dream's sky holds one shooting-star mesh; with `?dreamSeed=1`, none. Its other effect, a fixed seed for a practice dream, was not exercised (the gate opens tonight's dream). |

`?season=` is already read today (`src/skin/hooks/useAmbient.ts:24`); it was not exercised.

## 6. Measured: how long each place takes, and how much two runs differ

Each place was opened twice with the same seed, in a browser of its own, so the first time is a cold browser and the
second a warm one. Seconds are real, from the call to the PNG in hand. "Draw" is `settle`'s share of the warm run.
"Clock" is `performance.now()` at the shot, the same in both runs for every place. Differences are between the two
shots: pixels over the plan's 24, pixels differing by any amount, and the worst tile mean.

| Place | Cold s | Warm s | Draw s | Clock ms | Over 24 | Any difference | Worst tile mean |
|---|---|---|---|---|---|---|---|
| `home` pov 0, day | 14.3 | 9.6 | 2.4 | 1,536 | 0 | 0 | 0 |
| `home` pov 1, day | 14.8 | 10.4 | 3.1 | 1,536 | 0 | 0 | 0 |
| `home` pov 3, night | 15.0 | 10.5 | 3.1 | 1,536 | 0 | 0 | 0 |
| `home` pov 0, day, 390 x 844 touch | 12.0 | 7.1 | 1.6 | 1,536 | 0 | 215 pixels (0.065 %), each by 1 of 255 | 0.004 |
| `table` | 16.1 | 11.1 | 1.7 | 6,384 | 0 | 0 | 0 |
| `table`, 390 x 844 touch | 14.2 | 8.8 | 1.4 | 6,384 | 0 | 0 | 0 |
| `tableResults` | 24.7 | 18.9 | 3.4 | 288,634 | 0 | 0 | 0 |
| `duel` | 15.9 | 11.4 | 1.7 | 6,384 | 0 | 0 | 0 |
| `dream` | 14.6 | 10.2 | 0.8 | 2,644 | 0 | 0 | 0 |
| `dream`, 390 x 844 touch | 13.2 | 8.2 | 0.8 | 2,644 | 0 | 0 | 0 |
| `bazaarSacks` | 15.3 | 10.1 | 2.4 (the farm, before it opens) | 2,068 | 0 | 0 | 0 |
| `profile` | 14.8 | 10.0 | 2.4 | 2,036 | 0 | 0 | 0 |
| `bookPreview` | 15.8 | 10.4 | 2.4 (the farm, before it opens) | 2,068 | 0 | 0 | 0 |
| `home` pov 2, day, wendigoDebug | 15.2 | 10.6 | 3.0 | 1,568 | 0 | 0 | 0 |
| `home` pov 2, night, wendigoDebug | 15.2 | 10.9 | 3.3 | 1,568 | 0 | 0 | 0 |

The whole table was run more than once; each run's times were within 1.5 s of these and its difference columns
were the same, the phone Home's 215 pixels included.

Where the time goes: reaching a ready Home is 7.2 s warm and 11.4 s cold, of which about 5.6 s is the page frozen
while it builds the farm; the two real frames are 0.8 to 3.3 s; the screenshot under a second more.

Then five more runs of each of nine places, four at a time in one browser, each against the first proof shot
(45 opens): no pixel over 24 in any. Pixels differing by any amount were 0 in 40 runs. The five others: the phone
Home, 215 pixels by 1 of 255 in three runs and 1 pixel in one (the 215 are the same ones each time, in the menu's
band, y 331 to 471); the closer look, 15,644 pixels in one run, none of them over 24. That one did not come back in
42 further closer looks, 30 of them with heavy places running beside it, so its size beyond "under 24" is not known.

Other measurements:

- The base commit's build and this branch's give the same Home and the same table, pixel for pixel, from two
  separate processes.
- Home is not perfectly still under reduced motion (snow still falls). Twelve frames later, 45 pixels (0.0044 %)
  are over 24 and the worst tile mean moves 0.29. This is why a place must land on the same tick, and does.
- With motion on (`reducedMotion: false`), two runs each: `home`, `duel`, `dream`, `profile`, `bazaarSacks`,
  `bookPreview` (live) and `tableResults` had no pixel over 24. `tableResults` took 47 s (27 s to play the game out).

Measured again later the same day by a second script, written as a tool's author would write one from the example at
the top, on another build of the same game (the tree had changed, so the key had): `home` at 1280 x 800 and at
390 x 844 touch, `table`, `duel`, `dream`, `bazaarSacks` and `profile`, each opened twice in separate contexts of one
browser. All seven pairs: 0 pixels differ by any amount, 0 page errors; 7.4 to 14.7 s a place, 164 s for the whole
script with the base. One shot of Home from the base commit's build (`ensureBaseCheckout`, then `ensureGateBuild`)
against the head's: 0 pixels differ. Those shots against the first script's proof shots, made hours earlier by
another process: 0 pixels differ in six places; the phone Home differs in the same 215 pixels by 1 of 255, so that
picture has two states, one level apart. After the changes to how the helper ends its children, Home with an empty
font cache (fetched, then replayed) was again the same picture, pixel for pixel.

To measure a place again (ten runs, as the plan asks of the picture tool, is the same loop):

```js
const shots = [];
for (let i = 0; i < 2; i++) {
  const r = await table(browser, { url: site.url });
  if (r.errors.length) throw new Error(JSON.stringify(r.errors));
  shots.push(await shoot(r.page));
  await r.context.close();
}
console.log(compare(shots[0], shots[1]), compare(shots[0], shots[1], { threshold: 0 }).differing);
```

**The machine's other work matters more than anything in this table.** The graphics process draws in software on
every core it can get. Twice, while other heavy jobs were running on this machine (which ones was not found out), the
same Home took far longer: once over 300 s, and once 495 s, of which 16 s was reaching a ready Home and 479 s was
drawing its two frames. The picture was the same, pixel for pixel. Ten minutes later, with the machine calm, it was
back to 15 s. So: a quiet machine needs 30 s for a place and 60 s for `tableResults`; a shared one can need twenty
times that, which is why the helper's own patience is 300 s per wait and can be raised with `GATE_PATIENCE_MS`. Do
not run several browser tools side by side unless the machine can carry them (four places at once was fine here: 45
opens in 269 s).

## 7. What could not be made deterministic

1. **The table with motion on.** Two runs differed in 55.78 % of pixels. The table's root grows in with a CSS
   animation that scales it from 1.35 (`src/skin/styles/skin.css:702`), CSS animations run on real time whatever
   the pinned clock says, and the canvas takes its size from wherever that animation has got to when the browser
   measures it. Four runs gave canvases of 1280 x 800, 1388 x 868, 1388 x 868 and 1388 x 868 in a 1280 x 800
   window; a fifth gave 1440 x 900. This is the canvas defect of plan file 17 (problem 7), which milestone 1 fixes.
   Under reduced motion the animation is off (`skin.css:709`) and the canvas was 1280 x 800 in every run. The
   gate's pictures use reduced motion.
2. **A level of 1 in 255 in page-drawn pixels**, now and then, on the phone Home (above). Far under the plan's
   threshold. Its cause was not found.
3. **One closer look in 48** differed under the threshold in 15,644 pixels (above). Not explained, not repeated.
4. **CSS animations in general** follow real time. `shoot` asks Playwright to set them to their end
   (`animations: 'disabled'`), which is why they do not show in the pictures; anything that reads a half-way
   animation, as the table's canvas does, is not pinned.
5. **Fonts** come from the network until milestone 1. They are pinned by the cache, not by the build: the first
   run on a machine needs the two font hosts to answer.

## 8. Drawing: the proof

Home, shot 0, by day, the same steps both times. Once with every frame really drawn (94 frames to ready, 76 s in
all); once with drawing off until ready and then two real frames (11 s). The two pictures: 0 pixels differ at
threshold 0. Each frame redraws everything it shows (the shadow map included), so a real frame after skipped ones
is a whole picture. If a later milestone keeps anything from one frame to the next (a shadow map redrawn ten times a
second, say), two frames may no longer be enough: raise `frames` in `settle` until this comparison is 0 again.

## 9. Where things are kept

| Path | What |
|---|---|
| `<cache>/<treeKey>/dist-gate`, `dist-gate.json` | A tree's gate build and its stamp. |
| `<cache>/wt/<sha>` | The base checkout. |
| `<cache>/fonts/` | The fonts' answers, each written beside its place and moved in, so a second tool reading at that moment finds a whole font or none. |
| `<cache>/locks/` | Locks, there only while held. |
| `<cache>/<treeKey>/...` | A tool's own files about that tree: write shots here as `.png`, outside `dist-gate` (`treeDir(root)`). The build server keeps the base commit's folder and `fonts/` between runs, and uploads every `.png` under the cache but those under `wt/` and `dist-gate/`. |

Nothing is written into the repo. A tool that writes there fails the gate's own "nothing left behind" check.

When the head is the base (on `main`, and under `--baseline`) and nothing is uncommitted, `treeKey` of the repo and of
the base checkout are the same commit, so both have the same folder. Keep the base's shots and the head's under
different names in it, and shoot the head afresh every run, or a tool compares a file with itself.
