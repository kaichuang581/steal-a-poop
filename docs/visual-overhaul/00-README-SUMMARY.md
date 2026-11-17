# Fleeced visual overhaul, version 2: summary, run order and prompt

Revised 16 November 2026 after six specialised reviewers audited the first version against the real code (v0.7.4, commit `6edc7fe`) and debated it (record: `DEBATE.md`). Save this folder as `docs/visual-overhaul/` in the repo.

**What changed from version 1, in one paragraph.** Version 1 was written from screenshots and would have reversed dozens of Brian's own decisions, treated shadows and tone mapping as new although they are already on, and ignored the cause of a friend's report (about 10 fps, broken-looking assets, 35% battery in five minutes). Version 2 puts a safety net and a performance-and-stability track first, adds a file that makes floating or detached assets detectable, turns every conflicting item into a question for Brian with a safe default, and keeps the visual goals: better animals, a calmer farm, a side-on Counting Sheep.

## Before milestone 0 (Brian, or Kai)
1. Paste the entry in `19-decisions-and-conflicts.md` §1 at the **top** of `CLAUDE.md` (only the first ~150 kB of that file loads automatically; the end is cut).
2. Answer question 11 in file 19 (Kai agrees and reviews each pull request) and, if you can, question 9 (download size).
3. Turn on branch protection for `main` (CONTRIBUTING.md, "Branch protection").

## The prompt (paste into Claude Code, one milestone per session)

```
You are executing one milestone of docs/visual-overhaul/. Milestone: NN.
1. With the Read tool, read CLAUDE.md to its LAST line, in chunks (you are shown only its start).
   Then read, every word: docs/visual-overhaul/00-README-SUMMARY.md, 19-decisions-and-conflicts.md,
   01-art-direction.md, 16-qa-and-acceptance.md, 17-performance-and-stability.md, 18-asset-integrity.md,
   and the files this milestone lists in the run order below.
2. git fetch; create the branch overhaul/mNN-<name> from origin/main. From milestone 1 on, run
   npm run gate -- --baseline first; if it is not green, stop and report. Do not fix the gate.
3. Make only the changes the milestone's files list. Precedence: CLAUDE.md wins over the plan unless
   file 19's entry names the point as superseded; on any other disagreement, stop and ask.
4. Commit in small steps; after each, npm run gate -- --quick must pass.
5. At the end: re-bake any picture the bake manifest names; run npm run gate -- --milestone NN;
   commit the report it writes, unedited.
6. Open a pull request with the report summary, before/after pairs, every "Decision for Brian" and
   every open human check. Then stop. Do not start another milestone.
Stop early, and say why, in any case listed under "Stop and report" in file 16.
Never: change game rules, timers, bots, scoring, the word list, networking or saved data; touch the
wendigo's files, place, camera, pines or light; raise a budget; loosen, skip or delete a check or test
outside the list in file 19; push to main; add a dependency.
```

## Run order (■ = stop and show Brian before the next milestone)

| # | Milestone | Files | Visible change? |
|---|---|---|---|
| 0 | **Safety net**: painted smoke and fault tests in CI, fences in `npm test`, head-against-base picture gate, one `npm run gate`, `RATCHETS.json`, test ledger, bake manifest, `check:scenes`, the wendigo freeze (first commit: `isClear` reads frozen sight lines) ■ | 16, 18, 19 | No |
| 1 | **Stability**: error boundaries and fail-soft card, context loss, failed-chunk reload, old-browser message, fonts shipped with the game, the table canvas fix with today's picture reproduced, device report, real defects (update sign over the D, "botWORD", peg disabled look, hollow wool balls, short windows) ■ friends' test | 17, 05, 13, 14 | Only the defects |
| 2 | **Performance, picture unchanged**: frame cap and pauses, no React re-render per frame, music paused when hidden (if yes), vertex repack, unseen faces dropped, flat faces merged, fewer shadow casters, resolution logic repaired, sliced build | 17, 02 | No (within the gate's tolerance) |
| 3 | **Integrity fixes**: robin, pen pieces, animals inside props, tails at level 0, fitted ice block, ice cracks, plates from measured anchors, festive coplanar faces | 18, 03 | Small fixes only |
| 4 | **Quality tiers and hour grades** (devices earn High), shadow and bloom substitutes on lower tiers, ground-contact patch ■ pairs | 17, 02 | Lower tiers only; High unchanged |
| 5 | **Animals I**: shape switch on five species and all garments; the sheep's fleece as its own pair; the six-species face sheet ■ | 03 | Yes |
| 6 | **Animals II**: the species changes Brian ticks, clothing, hat merged into the head, draws per animal ≤ 16, re-bakes ■ | 03, 07 | Yes |
| 7 | **Table and duel**: board no longer cut off, framing pairs, calmer floor, bomb placed clear of the word bar, scoreboard join, duel refinements ■ | 06, 08, 07 | Yes |
| 8 | **Farm**: recompose the 8 + 6 shots, lighten unseen geometry, tidy decorations within the season ■ | 04 | Yes |
| 9 | **Counting Sheep side-on** (pictures before the work and after) ■ | 09 | Yes |
| 10 | **Interface**: what remains of files 05 and 10 to 13 | 05, 10, 11, 12, 13 | Small |
| 11 | **Phones and motion** | 14, 15 | Small |
| 12 | **Release**: full tour, human checks, re-captured play cards and link picture, version and changelog ■ | 16 | No |

## Every file, in short

| File | What it now says |
|---|---|
| 01 Art direction | The look in one sentence; what is fair in the "vibecoded" diagnosis; precedence; a do-not-change list of everything Brian art-directed; a grid register of the sizes really in use; colour and text rules as ratchets; the season constant `FESTIVE` |
| 02 Lighting and rendering | Built on what exists (shadows, ACES, bloom); Brian's light limits; hours differ by key colour, fog and sky only; lower-tier substitutes shown as pairs; the wendigo's shot exempt |
| 03 Animal models | Integrity fixes, then the tested shape switch, the sheep's fleece pair and a face sheet for Brian, then per-species tick-boxes; 2 × 2 eyes and his pixel heads stay the default |
| 04 Farm | Recompose and lighten, not rebuild; the real 14 shots; the wendigo's protected zone; budgets that only fall |
| 05 Home | Update sign fixed, real defects; the Word of the day, menu and doors stay as decided |
| 06 Table | Canvas fix first; letter board fully in frame; floating letters, plates, bubble and digits kept; bomb placed clear of the text |
| 07 Bomb and blasts | Kept as decided (icy, on the floor, eight models, acts); only small allowed fixes |
| 08 Practice duel | Refinements; sign test; ice toned by patch; lighter far scenery |
| 09 Counting Sheep | Exact side-on mapping with real numbers; no device gets less warning than today; gates replaced by tests |
| 10 Trading Post | The fair machine unchanged; small text and shelf fixes |
| 11 Menus and dialogs | Leave-dialog colours, profile empty wording, legal pages as a checklist for Brian and Kai |
| 12 Online | The lobby and leaderboards stay; the "white frame" is the last-seconds frost by design |
| 13 Typography and HUD | Ratchets instead of impossible tests; an overlap test that can run |
| 14 Phone | Short windows, sideways phones, keyboard up, safe areas, with test sizes |
| 15 Motion | Reduced motion follows the device setting; endless animations cheap and paused under full pages |
| 16 QA | Milestone 0, the checks, definition of done, stop rules, rollback, device matrix, the five-minute friends' test, risks |
| 17 Performance and stability (new) | Diagnosis of the friend's report; fail-soft; frame cap and pauses; tiers; budgets per screen; the count gate; the device report |
| 18 Asset integrity (new) | Why "Nothing floats" was wrong; the checks that make floating, detached, clipped or stale assets fail CI |
| 19 Decisions and conflicts (new) | The `CLAUDE.md` entry; 25 questions for Brian with defaults; what was dropped and why; the banned-returns list |
| DEBATE | How the review and debate ran, and how each contested point was settled |

## Settled decisions
- The wendigo is not touched, and its shot is protected (file 04).
- Counting Sheep is side-on, like the dinosaur game.
- The sack opening keeps its slot machine, unchanged.
- Shadows and tone mapping stay as they are on the best tier; any change is shown to Brian as a pair.

## Known points the coder must respect
- `check:scenes` is a required CI check on every pull request; when no scene, voxel, table or dream file changed, it passes at once rather than being skipped (a skipped required check blocks merging).
- Lens clearance (file 18) is measured inside the camera's view only.
- "No anchor change before the tick" (file 03) means the rig's joint anchors; measured anchors for plates, hats and the ice block are milestone 3 fixes.
- Counting Sheep's "no less warning than today" is measured against today's upright phone at 390 × 844 (0.35 s at the last fence's speed); with the keyboard up the new view must still give at least 0.35 s.
- In milestone 2 the sliced build may show touch detail on a desktop for a moment before desktop detail is swapped in at a dip; the doors stay shut until shot 0 is whole.
- `audioContext()` returns null once the context is suspended (`src/audio/sound.ts:36-38`): the skin keeps its own reference to resume it.
- Today's code can already show nine Home menu rows (repair plus leaderboards); the overhaul adds none.
