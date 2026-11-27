# Fleeced: the Trading Post and Practice, rebuilt in voxels

Written 25 November 2026 against the local build shown in `reference/build-today/` (v0.9.7). Give Claude Code this folder. Work in the steps of `X2-run-order-and-checks.md`; each step is one pull request and stops for Brian's approval.

This replaces `practice-voxel` (the plan of earlier today). That plan left the Trading Post out and gave Practice a copy of Counting Sheep's navy cards. Both are put right here.

## The two ideas

**The Trading Post is a place, not a panel.** It is a market row on the farm at dusk, four stops side by side: the feed stall (Feed Sacks), the bell stand (Bell Shelf), the notice board (Missions) and a big standing book (Barn Book). The camera walks along the row from stop to stop. Everything you can own stands there as its real voxel model. Words are on paper tags hung on red yarn, and on chalk boards. There is no wooden panel and no navy card.

*An example.* You pick the Oat Sack. It slides forward on the counter and the five bombs it can hold line up on the bench in front of it, each with a paper tag: "Ember, Common, found". A chalk board beside the stall gives the odds. You press "Open an Oat Sack"; the sack hops to the middle, green light shows inside it at once (green means uncommon), the yarn bow unties and a Plum bomb rises out.

**Practice has no cards either.** Your count, and at the end your whole report, are written in chalk on a green chalkboard that stands behind the rink. Your word is a row of letter tiles standing on the rink's own boards. Every message is the coach, a sheepdog on a high chair, speaking.

## The items are remodelled

- **8 bomb skins** (`T2`): one anatomy, eight characters. Each has a flat face where the seconds show in a game.
- **Chunky structure, tiny detail** (`ITEMS_REMODEL.md`): every item you can buy is built of tiny 0.025 m cubes with raised parts, as the site draws its bombs today; stalls and scenery are chunky 0.2 m parts.
- **10 bursts** (`T3`): shaped voxel pieces, at most 24, at most three colours, one timing.
- **8 fuse sounds** (`T4`): each shown as the thing that makes the sound.
- **3 feed sacks** (`T5`): clean burlap, a yarn bow, a stencil of what is inside.

Every one is exact boxes in `data/`. Claude Code loads them; it models nothing by hand.

## Files

| File | What it settles |
|---|---|
| `ITEMS_REMODEL.md` | The 26 buyable items (bombs, fuse sounds, bursts): the rules, what was wrong with each, and each remodel part by part |
| `T0-what-is-wrong-at-the-trading-post.md` | 31 flaws in today's Trading Post and what replaces each |
| `T1-the-market-row.md` | The place, the camera, the four stops, every placement, light, season, phones, cost |
| `T2-the-bombs.md` | The bomb's anatomy and the eight skins |
| `T3-the-bursts.md` | The ten bursts |
| `T4-the-fuse-sounds.md` | The eight fuse sounds |
| `T5-feed-sacks.md` | The feed stall: sacks, the bench, the odds board, opening a sack |
| `T6-bell-shelf-missions-barn-book.md` | The other three stops, and looking closely at one item |
| `T7-paper-yarn-and-chalk.md` | This screen's interface pieces: tags, the yarn line, tiles, boards, the level strip, sizes |
| `P0-practice-what-changed.md` | What was wrong in today's build and in this morning's plan, and what changes |
| `P1-the-rink.md` | The swept pond, camera, placements, light |
| `P2-board-coach-rack.md` | The chalkboard, the coach on the high chair, the tile rack |
| `P3-a-run.md` | Everything on screen during a run, and every effect |
| `P4-the-report.md` | The end of a run: the chalk report |
| `X1-pixel-art.md` | Every icon grid |
| `X2-run-order-and-checks.md` | Steps, checks, choices for Brian, the prompt for Claude Code |
| `data/` | Models as boxes, skins, bursts, both scenes' placements, timings, icons, the catalogue |
| `reference/` | Pictures rendered from that data, and today's build |
| `tools/` | The scripts that made the data and pictures: `build_data.py`, `tp_pictures.py`, `pictures.py`, `checks.py`, `grain_audit.py` |

## Rules that hold everywhere

1. **No rule changes.** Prices, odds, pity counts, duplicate refunds, what each sack holds, rarities, missions, milestones, levels, the coin cap, and every Practice rule work exactly as today. Read each number from the code. The honest-shop rules stay: the real odds are shown before every opening, the reveal shows the true rarity from its first frame, there is no near-miss, no "open another", no countdown, and Bells never open a sack.
2. **Scenery colours** come only from the game's colour table (LADDER, `PLAN_DEPTH_AND_LIGHT.md` 3.2) and the named glows. **Bomb skins and bursts** use their own stronger colours, listed in `data/skins.json` and `data/bursts.json`; they stay out of `harmonize()`, as that plan says.
3. **Nothing navy, nothing wooden-panel.** Interface surfaces are paper, wool tiles, lantern tiles and chalk boards (file `T7`).
4. **No blocky clouds, no smoke, no speckle.** A surface gets texture from a regular pattern (weave rows, plate checkers, pavers), never from random colours.
5. **Animals are Brian's models, unchanged.** The sheep is never shown shorn. The pictures use a stand-in sheep and dog.
6. **Nothing unexplained.** Every prop has a job, and the file that places it says what the job is.

## What the pictures can and cannot show

They are drawn by a small box renderer from `data/`, so every size, place and colour is exact. They do not show the game's own soft light and shading, its real sheep and sheepdog, or anything moving. `tools/checks.py` passes 380 checks: colours, parts, the items' cubes and speckle (`ITEMS_REMODEL.md`), the contrast of the seconds on all eight bombs, piece and colour counts of the ten bursts, the odds, the clock arithmetic, and text contrast.
