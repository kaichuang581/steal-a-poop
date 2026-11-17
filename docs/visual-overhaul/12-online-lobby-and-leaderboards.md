# 12 · Online: the play chooser, the lobby, leaderboards

The lobby took nine rounds with Brian and the leaderboards three; both are done. This file changes nothing on them by hand. It records that the "white frame" in online games is the frost, by design, keeps the play chooser's two pictures current, and points to files 13 and 15 for the season and motion rules that reach these screens. Ships in milestone 10.

## 1. What exists today (v0.7.4)
- The play chooser is `src/skin/ranked/PlayChooser.tsx`; its two pictures are captures of the game's own scenes, `public/play/casual.webp` and `public/play/ranked.webp` (`PlayChooser.tsx:9`).
- The lobby is `src/skin/rooms/PaintedRoom.tsx` with the pen behind it (`src/skin/rooms/PenStage.tsx`, `penWander.ts`): animals stand, walk and graze; name tags are the table's `.sk-plate`.
- The leaderboards are `src/skin/boards/Leaderboards.tsx` with the sky stage (`BoardStage.tsx`, lazy): three pedestals, an empty place reads "Open" and "Could be you".
- `Garland` (`src/skin/components/Garland.tsx`) hangs under the lobby's beam (`PaintedRoom.tsx:178`, 7 swags, 3 on a phone) and the leaderboards' beam (`Leaderboards.tsx:272`). Its bulbs blink with `sk-garland-blink`, which animates `opacity` and `filter` (`src/skin/styles/skin.css:377`, `:389`).
- The "white frame" in online games is the frost of a turn's last three seconds: `.sk-frost`, ice creeping in from all four edges, 0 to 7vmin thick (`skin.css:1626-1631`), shown when `!practice && game.turn && game.phase === 'playing' && view.secondsLeft <= 3` (`src/skin/screens/PaintedGame.tsx:378-383`). Its first frame is a thin pale edge. It is the barn's last-seconds cue (ruling C3).
- The old plan was wrong on: a dusk pen with animals in a row and name stakes, fewer snow caps and new text sizes, a gate with a chain that swings on hover, equal green cards, the podium hidden until three players exist, and removing the frost. All are dropped.

## 2. Decisions that bind this file
- 2026-11-14, the lobby's nine rounds (CLAUDE.md:1268-1342): "Nothing moves when something is pressed"; "No middle dot (·) between phrases, here or in anything new"; "Do not offer again: paper cards here, flat black, the knitted or fair-isle pattern, voxel-baked (blocky) panels, or a style not made of the kit."
- 2026-11-14, Brian: "make all the sheep be walking around instead of just starting at the ground"; "No buildings, and nothing made by hand outside the fence" (CLAUDE.md:1343-1348).
- 2026-11-14: "do not shrink this text" (the rules line, CLAUDE.md:1390).
- 2026-11-14: "an empty board is an empty podium waiting"; an open place reads "Open" and "Could be you" (CLAUDE.md:1457, 1506-1507).
- 2026-11-14, Brian: "on the top, the little lights are horrendous", answered by today's `Garland` (CLAUDE.md:1308-1310).
- 2026-11-14: Ranked is "slate edged in gold ... and a red button"; both pictures are captures of the game's own scenes (CLAUDE.md:1184-1188).
- 2026-11-07, Brian: "Keep the bomb icy"; the barn's last-seconds cue stays the frost (ruling C3).

## 3. Problems (verified)
1. The play chooser's pictures will go stale when milestones 5 to 8 change the animals, the table and the farm; nothing checks them.
2. The garland's blink animates `filter` (`skin.css:389`), which file 15 forbids for endless animations.

## 4. Changes

### 1. Re-capture the play chooser's pictures
- **What:** Casual and Ranked show the game as it looks after the overhaul.
- **Where:** `public/play/casual.webp`, `public/play/ranked.webp`; the bake manifest of file 16 records what each was captured from.
- **How:** re-capture from the painted tour build at the same size, crop and file format, in the milestone that changes what they show (and once more at milestone 12).
- **Do not:** change the cards, their colours, the red button or the layout.
- **Cost:** a few kB of WebP, outside the JS bundle.
- **Check:** the bake manifest test in `npm test`; HUMAN: Brian sees old and new side by side.

### The frost
No change. It is the barn's last-three-seconds cue by design. The old plan's acceptance line "no full-screen semi-transparent overlay during online play" is struck.

### The lobby and the leaderboards
No change by hand. Two rules from other files reach them: the garland is mounted only while `FESTIVE` is on (file 13), and its blink becomes opacity-only (file 15).

## 5. Integrity (nothing floats, nothing breaks)
- After any change that reaches these screens, run the lobby's own checks (press every button, then every window size: CLAUDE.md:1328-1330, 1396-1402); nothing may move when a tab or button is pressed, at fourteen sizes from 320 × 568 to 1920 × 1080 (CLAUDE.md:1521-1522).
- Name tags in the pen stay on `ScreenAnchor` (`src/skin/table/Anchors.tsx`) with `Unstack` (`PenStage.tsx`); no change.

## 6. Budget
Lobby and leaderboards keep today's canvases and pause rules (the farm draws 0 frames behind the leaderboards, `src/skin/screens/PaintedHome.tsx:410`). Their 3D budgets are file 17's. Endless CSS animations: may only fall (file 15). Bundle: net-zero (ruling M4).

## 7. Acceptance
- [ ] Bake manifest green for `public/play/*.webp`.
- [ ] No source file under `src/skin/rooms` or `src/skin/boards` changed in milestone 10, except as files 13 and 15 require.
- [ ] HUMAN: Brian sees the re-captured pictures.

## 8. Decisions for Brian
None.
