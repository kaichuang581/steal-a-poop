# The yarn loading screen: review (branch landing/yarn)

Built from docs/landing/LANDING-PLAN.md (version 8) on 21 November 2026, on top of `origin/main` at `da605a4`.

**The four reference pictures were not supplied** (`loading-yarn-desk.png`, `-phone.png`, `-stages.jpg`,
`-closeup.png`). The plan says its text and its appendix code win, so the screen was built from those alone. Every
comparison below is against pictures of this build (the appendices' code running in the game), not against Brian's.

## Pictures

All in `docs/landing/review/`.

| Picture | What it is |
|---|---|
| `desk-1280x720@2x.png` | A real first load of the built site at 1280 x 720, shown at 2x, photographed at 50% |
| `desk-1440x900@2x.png` | The same at 1440 x 900, 2x, at 50% |
| `phone-390x844@3x.png` | The same on a 390 x 844 phone at 3x, at 50% |
| `closeup.png` | The yarn up close: the "f", "l" and "e"s at 62%, 4x |
| `stage-0.png`, `stage-35.png`, `stage-62.png`, `stage-100.png` | The screen at 0, 35, 62 and 100% (1280 x 720, 2x), laid by the game's own drawing code |
| `check1-first-frame-5mbps.png` | The page's own copy, before any game code, on a 5 Mbps line |
| `check8-typing-at-the-ice.png` | "barn" typed at the ice right after the screen went |
| `first-load-10s.webm` | 10 seconds of a first load at 1280 x 720 (CPU slowed 3x so the yarn is easy to follow) |

The 50% pictures were taken with the CPU slowed 6x so the photograph could land mid-load. The stage pictures and the
close-up are the screen's own markup with the yarn laid by `layYarn` and the ball placed exactly as BarnDoors' frame
does it, frozen at that progress.

## Section 6, check by check

1. **The first frame: PASS.** Built site, 5 Mbps, 40 ms latency, cache off: the night and the dotted word at 80 ms,
   the ball's picture in at 250 ms, the game's code taking over at 1.6 s. The only picture fetched for the screen is
   `loading/yarn-ball.webp` (the menu icons that follow are Home's, asked for by the game's code as it mounts).
2. **Size: PASS.** The yarn screen adds 8,512 bytes to `index.html` (limit 12 kB); the built `index.html` is 12,186
   bytes against main's 9,281 (+2.9 kB: the doors' copy it replaces added 5,474 bytes). The ball's picture is 15,934 bytes
   (limit 20 kB). The door pictures are gone. `npm run size`: PASS, 2.94 kB of headroom.
3. **The yarn's tests: PASS in vitest; the browser part FAILS at a strict reading.**
   - `yarnWord.test.ts`: the 90 points are Appendix A's exactly; every sample with the half-width and the shadow is
     inside the view box; `TOTAL` is 2,381.86 (2,381.9 +/- 1). Pass.
   - `yarn.test.ts` (a recording stand-in canvas): drawn in 10-unit stretches, every place along the word has the same
     last front piece as drawn whole; the same calls on every run; within a stretch no piece behind comes after a
     piece in front; no stroke wider than a ply or near black. Pass.
   - In a browser, stretches against whole, the shadow and yarn together on the night: 3.0% of pixels differ by more
     than 8 of 255, 0.79% by more than 24, 0.43% by more than 48. The yarn canvas alone: 1.16% of pixels (6.5% of its
     inked ones) differ by more than a few levels. So the plan's "no more than 1%" holds only for differences you
     could see (over 24/255). The cause is in the appendix code itself: each stretch's shadow starts one unit back
     (`q.s < a - 1`) and the front pieces of the unit before are drawn again, so at every join the translucent shadow
     and the 55% cores and 22% fibres are laid twice. Ported as written; not changed.
4. **`progress.test.ts`: PASS.** Never backwards; never 1 before ready; creep stops at 0.87 building and 0.96
   drawing; chases at 0.9/s and 2.5/s; a broken, wrong-shaped or missing `sap:boot-steps` falls back.
5. **The handover: PASS.** On the built site, the last frame of the page's copy and the first of the game's: flake 4
   at (583.3, -14.1) in both, the ball's centre at (269.7, 490.7) in both, 19 to 33 ms apart at 1x (75 to 94 ms at 4x).
6. **Looks: built from the text; the pictures to compare with were not supplied.** What the pictures show: two plies
   twisted, matte, lit from the upper left, fine fibres and loose ends, a soft shadow, no outline, no stripes, no
   gloss. Word and ball inside the window at every size tried, at 0, 50 and 100%: 320 x 568, 375 x 667, 390 x 844,
   768 x 1024, 1024 x 768, 1280 x 720, 1440 x 900, 1920 x 1080, 2560 x 1440, 2560 x 1080, 320 x 320, 900 x 400 (at
   768 x 1024 the ball's 2.4 r box starts 4 px off the left edge at 0%; the ball itself starts 6 px in). Word width and
   strand: 819 px and 15.1 px at 1280 x 720, 346 px and 6.4 px at 390 x 844, as the plan says.
7. **Movement under load: PARTLY.** Built site, three first loads each, main against this branch:

   | | this branch, 1x | main, 1x | this branch, CPU 4x | main, CPU 4x |
   |---|---|---|---|---|
   | long tasks during the load | 27 to 31 | 29 | 83 to 93 | 87 to 89 |
   | longest long task | 333 to 340 ms | 347 to 349 ms | 1,324 to 1,379 ms | 1,345 to 1,430 ms |
   | long tasks, total | 2,163 to 2,413 ms | 2,209 to 2,286 ms | 9,596 to 11,177 ms | 10,426 to 10,742 ms |
   | the screen gone | 3.36 to 3.57 s | 3.89 to 3.91 s | 10.8 to 12.6 s | 11.9 to 12.3 s |
   | the ball's longest still spell while loading | 565 to 617 ms | (doors) | 1,710 to 1,810 ms | (doors) |
   | ready to "starts to go" | 425 to 454 ms | | 623 to 748 ms | |

   - Long tasks: no longer than on main (the longest is shorter; the totals overlap).
   - Laying yarn, the longest frame: 4.0 ms at 1x, 7.5 ms with the CPU slowed 4x (limit 8 ms). PASS.
   - The ball moving at least every 120 ms: FAIL. It moves on every frame it gets, but the page draws no frame during
     long tasks that are not the 50 ms build slices: a 159 ms, a 332 ms and a 181 ms task in the 1x load (main has
     the same ones: its longest is 347 ms). Fixing that means splitting work outside the plan's files.
   - Starts to go within 400 ms of ready plus the 300 ms hold (700 ms): PASS at 1x (425 to 454 ms); at 4x 623, 748
     and 649 ms, so one run of three is 48 ms over (the last of the word is laid at most 60 units and 6 ms a frame).
8. **Interaction: PASS.** At the ball's centre the hit is the ball; a click makes it hop (`data-hop`); a point
   elsewhere hits the loading screen, not Home. A key pressed while it is up is blocked. Into practice after the first
   load: the dark fade only (it was ready inside 800 ms), and "barn" typed at the ice reached the word bar.
9. **Reduced motion: PASS.** No snow (display none), no spin, no rock, no hop, no animation on the ball; the progress
   still went 12 to 100 and never back.
10. **Never naked: PASS.** No sheep, no coat and no `sheared` part anywhere on the screen or in its code.
11. **The gate: PASS.** `npx tsc --noEmit -p .`: pass. `npx vitest run`: 196 files, 1,898 passed, 86 skipped, none
    failed. `npm run build`: pass. `npm run size`: pass (2.94 kB headroom). `bakeStamp --check`: 45 of 45 fresh.
    `check.ts --only wendigo`: PASS, the same as on main (run on a clean checkout first: PASS, every number as
    pinned; `CLAUDE.md` says it may fail there, and on `da605a4` it does not). `check.ts --only baked`: PASS.
12. **Review:** this file.

## Where the build differs from the plan's letter

- **No reference pictures** (above).
- **Written against `f990219`, built on `da605a4`.** Nothing the plan names had moved.
- **The bake manifest has no voxels to hash for the ball.** `tools/bake/stale.ts` hashes a picture's voxels; the
  ball is drawn on a 2D canvas. Its plan entry has `drawn: ['src/skin/loading/yarn.ts']`, and its model hash is that
  file's text (`drawnHashOf`), read by `bakeStamp.ts` and `baked.test.ts`. Change yarn.ts, bake again.
- **The full stamp was run once** (no `--only`) to take the three door entries out of `tools/bake/baked.json`; the
  check before it said every other picture was fresh, so it changed nothing else. The doors were the three pictures
  known to be stale; the count is now 0 (`RATCHETS.json` still allows 3; lowering it is a separate choice).
- **`src/skin/__tests__/fences.json` was pinned again** (`node tools/gate/fences.mjs --write`): `index.html` changed
  on purpose and `sap:boot-steps` and `sap:load-steps` are new saved keys, both named by the plan. Not in section 4's
  list, but `npm test` fails without it.
- **`DEFAULT_STEPS`** were measured by loading Home: 464 and 465 steps at the desktop's detail (`?gfx=high`), 446,
  458 and 413 at the touch detail. Set to 465 and 440. On a computer the first load builds the touch detail unless
  the tier is High, so most first loads use the touch number.
- **`data-ready`** is set on the screen while the new screen is ready, so tools can measure check 7. Nothing reads it.
- **When the window is resized** the strand is laid again (200 units a frame), and for those few frames the ball
  waits where it was rather than running back.
- **Opening** waits for the strand to be laid to the end as well as p = 1, so the finished word is what is seen.
