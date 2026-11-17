# 19 · Decisions and conflicts

This file holds four things the coder must have and Brian must be able to check: the entry that goes at the top of `CLAUDE.md`; every open question for Brian, with its default; the old plan's items that were dropped because Brian had already decided otherwise; and the list of things the gate refuses to let back in. Where this file and another plan file disagree, this file wins; where this file and `CLAUDE.md` disagree on a point the entry below does not name, `CLAUDE.md` wins and the coder stops and asks.

Line numbers below are `CLAUDE.md` lines at commit `6edc7fe`.

## 1. The `CLAUDE.md` entry

Brian (or Kai) pastes this at the **top** of `CLAUDE.md`, above "## Painted redesign", before milestone 0. It must be at the top: the harness loads only about the first 150 kB of the file's 194 kB, and the newest entries at the end are cut (ruling C1/C12).

```
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
```

## 2. Questions for Brian

Each has a default. Nothing waits for an answer except where the last column says "blocks". Milestones are numbered as in ruling M2: 0 safety net, 1 stability, 2 performance, 3 integrity fixes, 4 tiers and light, 5 animals I, 6 animals II, 7 table and duel, 8 farm, 9 Counting Sheep, 10 interface defects, 11 phones and motion, 12 release.

| # | Question | Default | Asked at | Blocks |
|---|---|---|---|---|
| 1 | On the face sheet, keep your 2 x 2 beady eyes (7 November), or take the 3 x 3 eye shown in one extra column on the sheep? | Keep 2 x 2 | 5 | none |
| 2 | While Fleece Navidad is on, should every animal keep its Santa hat (merged into the head so it cannot come off), gone when the season ends, with no per-player switch? | Yes | 5 | none |
| 3 | Keep your own pixel-art heads in the avatar picker, scoreboard and tab icon, rather than pictures of the new models? | Keep | 6 | none |
| 4 | Keep the eight bomb models and the number on the bomb as they are, with only the turn text moved off them, rather than redesign the bomb? | Keep | 7 | none |
| 5 | Keep the floating letters you picked from five mock-ups, rather than look at mock-ups of a boxed word bar? | Keep | 7 | none |
| 6 | Leave the sack opening exactly as it is (3.8 s spin, quiet near miss)? | Unchanged | 10 | none |
| 7 | Outside the barn, keep today's decorations tidied so nothing fills a shot, or cut to one tree, one wreath and one string of lights? | Today's, tidied | 8 | none |
| 8 | Should Home keep following the player's own clock for its time of day, rather than each shot showing its best hour? | The clock | 8 | none |
| 9 | To keep the download the same size, may the word of the day's meanings and examples (shown on no screen) move out of the code into `public/wotd-notes.json`, freeing about 11 kB? | Yes | before 1 | none (if no, milestone 1 finds 11 kB elsewhere or stops) |
| 10 | Do you approve replacing exactly the tests listed in the entry, each only in its milestone, and no others? | Nothing replaced | before 2 | 2, 6 and 9 (each only for its listed test) |
| 11 | Has Kai agreed to the overhaul and to reviewing each milestone's pull request? | (none) | before 0 | 0 |
| 12 | Brian and Kai: until a lawyer has read them, should the draft legal pages stay linked and marked draft as they are? | Yes | 10 | none |
| 13 | Keep the rounded voxel corners (on trial since 9 November), or go back to sharp? New models look right either way. | Keep the switch as set | 12 | none |
| 14 | After the table's canvas fix, which framing: today's crop reproduced exactly, a composed shot, or a re-solved shot (three pairs)? | Today's crop | 7 | none |
| 15 | On weaker devices, is each Medium and Low picture you see in the pairs (less bloom, smaller or slower shadows, plainer far scenery) acceptable? | High unchanged; lower tiers as shown | 4 | none (4 stops for you anyway) |
| 16 | Where a device cannot draw 3D at all, may it show a still picture of the farm with a message, instead of today's blank page? | Yes | 1 | none |
| 17 | On 120 Hz and faster screens, may the game draw at most 60 pictures a second (72 on 144 Hz) to save battery? | Yes | 2 | none |
| 18 | After 20 s without a touch, and behind an open panel, may Home's farm draw at 30 pictures a second? | Yes | 2 | none |
| 19 | On the weakest devices, may each animal stand on a plain dark voxel patch instead of a real shadow? | Yes | 4 | none |
| 20 | If loading passes 25 s, may the doors show one "still loading" line with a Copy device report button, and nothing else changed? | Yes | 1 | none |
| 21 | Should the music pause while the game's tab is in the background? | Yes | 2 | none |
| 22 | Add two Settings rows, Graphics (Auto, Low, Medium, High) and Copy device report? | No (report on the failure card, the still-loading card and `?report=1`; tiers automatic, `?gfx=` overrides) | 1 | none |
| 23 | May Esc close the in-game sheets and the leave dialog (a new shortcut)? | No change | 10 | none |
| 24 | In Counting Sheep, add a thin bar under the letters that fills as the next fence nears? | No | 9 | none |
| 25 | On a phone held upright, the wider view (SPAN 240: sheep 34 px, 0.40 s warning at the last fence's speed) or a closer one (SPAN 220: 37 px, 0.33 s, less warning than today's 0.35 s)? | SPAN 240 | 9 | none |

## 3. Conflict register: what was dropped or turned into a question

The old plan (2026-11-16, written from screenshots) restored older plan documents that Brian later reversed. KEEPER found 118 items; these are the ones that matter. "Q" refers to §2.

| # | Old plan item | Brian's words (date, line) | Now |
|---|---|---|---|
| 1 | 01: named four commercial games as references | "No studio, film or director names anywhere" (rule, line 40) | Dropped |
| 2 | 01: buildings and trees on 0.20 m | "One level of detail ... supersedes the 0.20 m and 1 m rows" (2026-11-07, 180) | Grid register, file 01 |
| 3 | 01: one 24-colour palette; "remove any colour not in it" | 1,134 colours, Brian-set item and badge colours | Ratchet on rebuilt files |
| 4 | 01, 04: snow as large smooth planes | "the snow looks super flat and untexturized ... just slight more detail" (2026-11-08, 463) | Dropped; `snowPaint` kept |
| 5 | 01, 04, 08: one tree, one string, one wreath; none on the ice | "The season reaches every setting" (2026-11-07, 186); one tree on the farm, the barn, the ice (193) | Q7 |
| 6 | 01: no hats by default; removable in the Barn Book | "Every animal wears a hat" (2026-11-07, 178); slots "reserved, not built" (38) | Q2 |
| 7 | 01: text never floats over 3D | Floating letters "chosen by Brian from five mockups" (2026-11-07, 249); "just make the text floating" (2026-11-08, 430) | Three floating forms kept |
| 8 | 01: no word on rounded corners | "ON TRIAL ... i might ask to change it back" (2026-11-09, 578) | Judged both ways; Q13 |
| 9 | 02: night sky 0.4, exposure 0.9 | "make the room a little brighter ngl i cant see a thing" (2026-11-13, 858) | Dropped; bounds in file 02 |
| 10 | 02: day fill 0.7, exposure 1.05 | "Keep the hemisphere fill low ... and exposure at 1" (2026-11-08, 454) | Dropped |
| 11 | 02: a different sun angle per hour (15° to 50° up, left or right) | Sun direction is fixed in `Lights` (`Rendering.tsx`); the wendigo's light is settled as untouched (2026-11-16) | Dropped: hours differ by colour, fog and sky only |
| 12 | 02: `PCFSoftShadowMap` | Removed in three r187 | Dropped; banned |
| 13 | 02: thinner fog that "starts behind the subject" | The wendigo "should not be so easily seen" (2026-11-08, 385) | Dropped; shot 2 frozen |
| 14 | 02, 10: thumbnails on a warm off-white studio | "Item art always sits on a dark tile" (2026-11-12, 739) | Dropped |
| 15 | 02, 07: only lamps and the spark may glow | "Rarer skins do more" (2026-11-13, 821); Kaiyan "even brighter" (502) | Applies to new work only |
| 16 | 02: a "Low graphics" setting | A new setting is ask-first (line 24) | Q22 |
| 17 | 03: 3 x 3 eyes with a catchlight on all | "beady eyes, 2 x 2 and dark with no whites"; "The pig keeps its plates" (2026-11-07, 272) | Q1 |
| 18 | 03: new cow and chicken sheets | Cow "second only to the horse", eyes never in a dark patch; the chicken's head (2026-11-07, 276 to 287) | Defaults carried over |
| 19 | 03: a "thought" tuft over the head | "The bots' thought dots over their heads are gone" (2026-11-08, 401) | Dropped |
| 20 | 03: renders replace the avatar icons | "his own pixel-art sheet of six heads" (2026-11-09, 490) | Q3 |
| 21 | 03, 16: new proportion tests | "Never modify existing tests" (line 13) | Named list, §1 |
| 22 | 04: a new paddock camera and rebuilt pines | Wendigo settled; "nothing stands between it and the paddock camera" (381) | Dropped; zone |
| 23 | 04: each shot at its best hour | Home follows the device clock; behaviour change is ask-first (24) | Dropped; Q8 |
| 24 | 05, 14: Word of the day on pinned paper, clickable | "not a whole piece of paper, just make the text floating"; "It takes no clicks" (2026-11-08, 430, 434) | Dropped |
| 25 | 05: rebuild the loading doors | "Don't redesign the loading screen again unless he asks" (2026-11-13, 1098) | Dropped; Q20 for one line |
| 26 | 05: badges as paper tags on strings | "do not add new fake fasteners or fake wear to flat interface panels" (2026-11-13, 1052) | Dropped |
| 27 | 06, 09: one boxed panel on a trough; the word as tiles | "The old troughs are gone" (2026-11-07, 249) | Q5 |
| 28 | 06: seconds on a chalk slate; name stakes | "the name stakes and the seconds slate under the letter board are gone" (2026-11-08, 333) | Dropped |
| 29 | 06, 07: remove the giant digits | Digits are the ice bomb's, re-set per skin (2026-11-13, 819) | Q4; overlap fixed by canvas and placement |
| 30 | 06: the word shown once | "it should be additional to the typing shown" (2026-11-08, 337) | Dropped |
| 31 | 06: "farm sheep · NAME" | "No middle dot (·) between phrases, here or in anything new" (2026-11-14, 1317) | Dropped; a gap fixes the join |
| 32 | 06, 13: steal window, "Steal it!", steal sound | "remove the steal feature entirely" (2026-11-07, 288) | Dropped; banned |
| 33 | 07: one rounded base for all skins | "Bomb skins are their own models with their own effects" (2026-11-13, 805) | Dropped |
| 34 | 07: the bomb on the table platform | "Keep the bomb icy, and keep it on the floor." (2026-11-07, 301) | Dropped |
| 35 | Review proposal: turn the barn bomb red in its last 3 s (`red` prop, `Bomb.tsx`) | Same quote; the barn's cue is the frost | Struck; `red={false}` stays |
| 36 | 07: one timing, flash and shockwave for every blast | "it feels weird for an aurora to be exploding" (2026-11-12, 787) | Dropped |
| 37 | 10: rebuild the machine as a grain sorter, under 2 s, "honest stop" | "He liked the sack opening ... leave it as it is" (2026-11-12, 771); "override rule d, i changed my mind" (722) | Q6 |
| 38 | 11: a nail at each top corner of dialogs | "do not add new fake fasteners" (2026-11-13, 1052) | Dropped |
| 39 | 11: the wooden lever | "`Lever` is `Switch` ... The lever with its lamp ... gone" (2026-11-13, 1063) | Dropped; banned |
| 40 | 11: paper index tabs | "the tabs look horrendous ... dont use the basic pin thing" (2026-11-12, 769) | Dropped |
| 41 | 11: stat tiles only when they have a value | "always six slips ... so no row has a hole" (2026-11-13, 1007) | Dropped |
| 42 | 12: pen at dusk, animals in a row, name stake | "make all the sheep be walking around" (2026-11-14, 1344); plates as nametags (1299) | Dropped |
| 43 | 12: hide the podium until three players | "pedastals on the sky" (2026-11-14, 1475) | Dropped |
| 44 | 12: the gate swings open on hover | "Nothing moves when something is pressed" (2026-11-14, 1323) | Dropped |
| 45 | 11: hide or relabel the draft legal pages | Kai: the legal bodies keep "Steal a Poop" for a lawyer (2026-11-15, 1681 to 1687) | Q12 |
| 46 | 15: new clunk, whoosh and crackle sounds | "Tones only, no noise", after "why is there static noise" (340, 945) | Dropped |
| 47 | Review proposal: Esc closes the in-game sheets | A new shortcut is ask-first (24) | Q23 |

## 4. Banned returns: what the gate greps

Module `tools/gate/banned.mjs` (new), run by `npm run gate` (every mode). "Added" means no line added by `git diff -U0 <base>...HEAD` may match; "count" means the total in the scope may not rise above today's; "must exist" means the match must still be there. Scope excludes `__tests__` unless stated.

| # | Pattern | Scope | Kind | Today |
|---|---|---|---|---|
| 1 | `kit-pin`, `kit-cork` | `src/skin` | added; count 0 | 0 |
| 2 | `export function Lever`, `RopeSlider` | `src/skin/kit` | count 0 | 0 |
| 3 | `hang="nails"`, `sk-nail` (fake fasteners) | `src/skin/**/*.tsx` | count | `hang="nails"` 3 (two in `KitPreview.tsx`, one in `shop/FeedSacks.tsx`); `sk-nail` 26 |
| 4 | `pin`, `tilt` or `seed` props on `Paper` | `src/skin/kit/index.tsx` | count 0 | 0 |
| 5 | `\b[Ss]teal(s|ing|er|ers)?\b`, not followed by `-a-poop` or ` a Poop` | `src/skin` | added; count | 4 (`KitPreview.tsx`, `kit.css`) |
| 6 | `·` (U+00B7) | `src/skin/**/*.{ts,tsx}` | added 0; count | 52 in 18 files |
| 7 | A menu `id:` in `items` of `src/skin/screens/PaintedHome.tsx` outside {queue, lobby, join, dream, repair, practice, tutorial, bazaar, boards} | that file | count 0 | 0 |
| 8 | `PCFSoftShadowMap` | `src` | count 0 | 0 |
| 9 | `MeshStandardMaterial`, `MeshPhysicalMaterial`, `envMap` | `src/skin` except `table/Wendigo.tsx` | count 0 | 0 |
| 10 | `toneMappingExposure:` with a value other than `1` | `src/skin` except `loading/DoorsRender.tsx` (dev bake page, 0.9) | count 0 | 0 |
| 11 | `<Bomb` in `src/skin/table/BarnTable.tsx` without `red={false}` | that file | must exist | present |
| 12 | `stakeGeometry`, `stakeVoxels` imported anywhere but `voxel/props.ts` | `src/skin` | count 0 | 0 |
| 13 | `fonts.googleapis`, `fonts.gstatic`, `DotGothic16` | `src`, `vite.config.ts` | count 0 from milestone 1 | 2 lines in `src` (`PaintedApp.tsx`, `components/PaintedCredits.tsx`, whose credit line is reworded, not deleted), 2 in `vite.config.ts` |
| 14 | `onClick`, `<button`, `kit-paper` | `src/skin/wotd/WordOfDay.tsx` | count 0 | 0 |
| 15 | The studio, film and director names `CLAUDE.md` bans (its "Hard rules" and "No studio, film or director names anywhere") and the four game titles the old plan used as references. They are not spelled out here, because that rule covers this folder too; `tools/gate/banned.mjs` holds the seven patterns encoded | `src/skin`, `docs/visual-overhaul` | count 0 | 0 |
| 16 | `it.skip`, `describe.skip`, `it.todo`, `test.skip` | `src/**/__tests__` | added 0 | n/a |
| 17 | `test.fail(` | `e2e-painted` | count 0 from milestone 1 | n/a |
| 18 | Must exist: `kit-float-need` in `components/InputStrip.tsx`; `export const ROUNDED_VOXELS` in `voxel/rounded.ts`; `const SPIN_MS = 3800` and `export const NEAR_MISS = 0.15` in `shop/FeedSacks.tsx`; `export function Switch` and `export function Slider` in `kit/index.tsx`; the six imports of `assets/heads/*.png` in `avatars/AvatarIcon.tsx`; all 20 states in `SheepState` (`table/Sheep.tsx`), including `dazed`, `walk`, `flop`, `perch`, `lounge` | as named | must exist | present |

Changing this list is a Decision for Brian: the gate prints any diff of `tools/gate/banned.mjs`.

## 5. Integrity

Not this file's subject; file 18 owns the checks. This file only fixes the definition of the wendigo zone (§1) that files 02, 04, 16 and 18 enforce.

## 6. Budget

None.

## 7. Acceptance

- [ ] The entry in §1 is at the top of `CLAUDE.md` before milestone 0 (HUMAN, Brian or Kai).
- [ ] `tools/gate/replaceable.json` equals the list in §1; a fence test in `npm test` compares them.
- [ ] `npm run gate`: the banned-returns module is green on unchanged `main` with the "today" counts above.
- [ ] Every answer to §2 is recorded, dated and quoted, in the milestone report that asked it, and appended to the entry.

## 8. Decisions for Brian

§2, all 25. Recommended answers are the defaults, except question 10: approve the list as written, or milestones 5 and 9 cannot finish.
