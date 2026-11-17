# How this plan was revised: the review and debate

Brian asked (16 November 2026) for the visual-overhaul plan to be assessed by several coding agents that debate one another, so that it breaks nothing, creates no floating assets and is optimised, after a friend reported about 10 fps, "a ton of broken assets" and 35% of a battery in five minutes.

## Who reviewed it
Six reviewers, each with a role, worked against the real code at commit `6edc7fe` (v0.7.4) and the production build, without editing either.

| Reviewer | Role | Owned in the final plan |
|---|---|---|
| PERF | Rendering and performance engineer | 02, 17 |
| VOXEL | Voxel model and asset pipeline engineer | 03, 07, 18 |
| SCENE | Scene, layout and camera engineer | 04, 06, 08, 09 |
| UI | Front-end, HUD and phone engineer | 05, 10 to 15 |
| QA | Reliability, release and test engineer | 16, run order, prompt |
| KEEPER | Decision keeper and art-direction lead | 01, 19 |

## Round 1: independent audits (about 13 hours of agent work in all)
Main findings, each measured or read in code:

1. **The old plan reversed many of Brian's own decisions.** KEEPER found 118 items needing attention, 26 of them blockers: name stakes, a pinned paper Word of the day, one-base bomb skins, a lever switch, a rebuilt loading screen, bigger eyes, a restyled sack machine, all things Brian had removed or rejected. The plan had been written from screenshots, not from the code and the decision log.
2. **Shadows, tone mapping and bloom are already on.** The old file 02 treated them as new.
3. **Why it runs at 10 fps.** Home draws 2.8 to 4.2 million triangles and 520 to 950 draw calls a frame, 1.47 million of them into a 4096 × 4096 shadow map every frame; it holds about 564 MB of graphics memory. Only touch screens get reduced detail, so a Chromebook gets everything. The game table re-renders React every frame.
4. **Why the battery drains.** Nothing is capped or paused: 134 frames a second on a 144 Hz screen, the powerful GPU requested, the farm drawn behind dialogs, the table drawn hidden under the results screen, music generated in a hidden tab.
5. **Why assets look broken.** No error handling: if WebGL fails, or a file fails to load after an update, the page goes blank. Loading freezes the page about 17 s on a slow processor and the doors give up at 30 s onto a half-built farm. The table's picture is created 21 to 35% too large and cropped. On old Safari the game never starts. Real model faults: non-sheep animals lose their tails after two lives, the ice block is sheep-sized so other heads stick out, name plates float 0.2 to 0.37 m above most animals, wool balls go hollow.
6. **The safety nets are blind.** `check:floating` says "Nothing floats" while a robin hangs 1.05 m from its beam and the lobby pen (which it never builds) has 74 loose pieces. Nothing automatic opens the painted game. The Counting Sheep gate passes 10 to 12 of 32 today. The download-size limit has 1.12 kB of room.
7. **Counting Sheep as the old plan described it was impossible**: its framing would give 0.15 s of warning before a fence at speed.
8. **Claude Code may not see Brian's newest rules:** only the first ~150 kB of CLAUDE.md loads automatically.

## Round 2: the debate
The chair circulated a digest, fifteen consent items and eighteen contested motions. KEEPER, QA and SCENE filed full responses, each verifying other reviewers' claims in code (for example: the canvas oversize was confirmed at up to 1.35 times on a slow machine; 8-bit colour packing was refuted as visible; the 25 m wendigo ring was shown to shift when another camera moves). PERF, VOXEL and UI hit a usage limit before filing; their Round 1 positions were weighed as written.

The main arguments and how they were settled:

| Question | Positions | Ruling |
|---|---|---|
| How much safety net first | QA wanted a large tool set; KEEPER and SCENE leaner | Build only what CI runs on every pull request; tools outside CI had all rotted |
| Animals: is the low-risk shape fix enough? | VOXEL: a 25-line change removes 81% of stair-steps, all 308 tests pass. KEEPER: it flattens the sheep's wool and leaves faces untouched | Shape fix on five species, the sheep's wool as its own pair, then a face sheet for Brian before any deeper change |
| Quality tiers | PERF: classify by GPU name; QA and SCENE: start lower and earn quality | Every device starts Medium and earns High from measured frames |
| Farm geometry | PERF: halve it with a rebuild; SCENE: cut only what no camera sees | Recompose and lighten; on High nothing visible is removed |
| Build freeze | PERF: a Worker; QA: no Worker (size, a second file that can fail) | Slice the existing build steps; no Worker |
| Table framing after the canvas fix | Re-solve cameras vs keep | Reproduce today's picture exactly with a view offset, then show Brian three options |
| Wendigo protection | 25 m ring vs 12 m vs a view cone | Freeze the inputs that reshuffle the forest, then hash what the paddock camera actually sees |
| Download size | Raise the limit vs net-zero | Net-zero; pay by moving unused Word-of-the-day notes out of the code |
| A red last-seconds bomb at the barn | Proposed by VOXEL | Struck: "Keep the bomb icy" |

## Round 3: rewriting
The chair wrote binding rulings; five writers rewrote the files in their areas to a common format (what exists, decisions that bind, verified problems, changes with file, method, do-not, cost and check, integrity, budget, acceptance, questions for Brian).

## What changed overall
- A **performance-and-stability** track (files 17 and 16) now comes before any visual change.
- A new **asset-integrity** file (18) makes floating and detached parts testable.
- A new **decisions** file (19) holds the CLAUDE.md entry, every open question for Brian with a safe default, and the list of things the coder must never bring back.
- Every item that contradicted one of Brian's logged decisions became a one-line question with a default, instead of a change.
- The run order went from 16 visual milestones to 13 milestones (0 to 12), safety first, each ending with an automatic gate, and stopping for Brian where the picture changes.
