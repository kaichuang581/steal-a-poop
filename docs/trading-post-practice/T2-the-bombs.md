# T2. The bombs

`reference/models-bombs.png` shows all eight. They are the same models in the Trading Post and in every game mode, so this changes how the bomb looks wherever it appears. It changes no rule.

## 1. One anatomy

Every skin is built of tiny 0.025 m cubes, the same density the site already draws its bombs at (about 20 cubes across). Its detail is raised parts and named motifs (`ITEMS_REMODEL.md`). Every skin has the same six parts, so the game treats all skins alike. Sizes are in cubes; the body is 20 cubes (0.5 m) across, as today.

| Part | What | Same for every skin |
|---|---|---|
| `shell` | The body. A ball 20 cubes across with its middle 10 up, except Peppermint (18), Plum, Gold, Diamond and Brass Bell (`ITEMS_REMODEL.md` 3) | Sits on the ground at the same spot |
| `detail` | Raised parts and motifs: bands, rivets, studs, icicles, leaves, stars, sparkles, wrapper ends | Named in the data (`rivet`, `stud`, `star`...) |
| `face` | A gauge: a bezel ring 10 cubes (0.25 m) across, one cube proud, round a flat face 8 cubes (0.2 m) across, standing on the body's most forward point | Always faces the camera; always the same size |
| `cap` | A neck 8 cubes across (corners cut), 2 high, and a lip 4 across, 2 high. The Bell's cap is its crown loop; the Plum's is its stem; Gold's carries four crown points | The fuse starts on top of it |
| `fuse` | 12 braid pieces, each a 2 x 2 x 2 block of one colour, the skin's two fuse colours taking turns. From the cap they go up, up, right, up, right, right, right, down, right, right, down | 12 pieces, always |
| `spark` | The burning tip (it replaces the last piece shown, lit) and four single lit cubes at its corners; a glow sprite of radius 0.35 m | Follows the fuse's end |

**No maker's mark.** Outside a game (the Trading Post, the Barn Book, the lobby) the face shows **10**, the bomb as it looks when a turn starts, in the skin's digit colour.

**The seconds.** Drawn on the face as a texture inside the bezel: Fraunces 800 in the skin's digit colour, 74% of the face's height for one digit, 60% for two; redrawn only when the number changes. In the last 3 seconds they take the skin's danger colour. Both colours pass 4.5 to 1 on every face (`checks.py`).

**The fuse burns.** With a share s of the turn left, show ceil(12 × s) pieces; the last one shown is the lit tip. A new turn starts with all 12. **Test:** s = 1 gives 12; s = 0.34 gives 5; s = 0.01 gives 1.

*An example.* A 10-second turn has 4 seconds left: s = 0.4, and ceil(12 × 0.4) = 5, so five fuse pieces show and the fifth is lit.

**Last 3 seconds.** The bomb wobbles ±1.5° four times a second; the spark grows to 1.6×; Ember's cracks glow brighter.

## 2. The eight skins

Each skin's shape, colours, raised parts and motifs are in `ITEMS_REMODEL.md`, section 3; its face, seconds, danger, fuse and spark colours are in `data/skins.json`.

| Skin | Face and seconds | Fuse; spark |
|---|---|---|
| Ice | Rim `#CFE8F5`, face `#EEF6FB`, seconds `#1F3A66` | White and pale blue; ice-white |
| Ember | Iron rim `#2A201E`, a glowing window lit `#FFD08A`, seconds `#3A2418` | Charred browns; orange |
| Peppermint | Green rim `#69A97F`, white face, seconds `#7A211C` | Red and white; warm |
| Plum | Rim `#E3D5B5`, face `#F6ECD6`, seconds `#3B2548` | Brown and green; warm |
| Gold | Rim `#A87A2A`, face `#FAE9B0`, seconds `#4A3312` | Two golds; pale gold |
| Diamond | Rim `#74C0CC`, face `#F2FDFE`, seconds `#1E4D59` | Silver and white; white |
| Brass Bell | Rim `#99702A`, face `#F8ECC8`, seconds `#4A3312` | Two brasses; pale gold |
| Aurora | Teal rim, a night face `#101830`, light seconds lit `#C8F5D6`; in the last 3 seconds lit `#FF9C8A` | Teal and violet; green-white |

Each line under a name in the Trading Post comes from the same file: "The classic frozen bomb." (kept from today), "Banked coals in an iron shell.", "A boiled sweet with a short temper.", "Ripe, with a leaf still on.", "Polished. Heavier than it looks.", "Cut, not round. Every face catches light.", "Rings once. Loudly.", "A piece of the night sky."

## 3. Loading them

`data/models/bomb_<id>.json` holds each skin as boxes (about 480 to 620) with a `part` on every box. `data/skins.json` holds, per skin: where the face is (`face.centre_cells`), the digit and danger colours, the fuse and spark colours, where the fuse starts (`fuse_start_cells`) and its 12 steps (`fuse_pieces`, in 2-cube units). Build one mesh per part so the game can shorten `fuse` and move `spark` without rebuilding. **Test:** each built bomb's bounding box equals `size_m` within 1 mm, and its parts are `shell`, `face`, `cap`, `fuse` and `spark`, plus `detail` where the skin has one.

## 4. What this replaces

Today's blob bombs and their thumbnails. Everywhere a bomb is drawn (Home's menu icon aside) uses these models: the Trading Post, the Barn Book, the table, Practice, the lobby preview.
