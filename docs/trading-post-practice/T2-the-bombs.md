# T2. The bombs

`reference/models-bombs.png` shows all eight. They are the same models in the Trading Post and in every game mode, so this changes how the bomb looks wherever it appears. It changes no rule.

## 1. One anatomy

Every skin is built on a grid of 0.025 m cells and has the same seven parts, so the game treats all skins alike. Sizes are in cells; the bomb is 20 cells (0.5 m) across, as today.

| Part | What | Same for every skin |
|---|---|---|
| `shell` | The body. A ball of radius 10 cells with its middle 10 cells up, except Diamond and Brass Bell (below). Only its surface is kept | Sits on the ground at the same spot |
| `detail` | Patterns painted on the shell, and small add-ons (a leaf, glints) | Never changes the silhouette by more than 2 cells |
| `face` | A flat round disc on the front: a rim of radius 5 cells and a face of radius 4, standing one cell proud | Always faces the camera; always the same size |
| `emblem` | The skin's maker's mark, 6 x 6 cells on the face, in the digit colour | Shown in the Trading Post, the Barn Book and the lobby. **Hidden in a game**, where the face shows the seconds |
| `cap` | An eight-sided neck 3 cells high on top (the Bell's is its crown loop) | The fuse starts from its top |
| `fuse` | 12 pieces of 2 x 2 x 2 cells, alternating the skin's two fuse colours like twisted yarn. From the cap they step: up, up, up-right, up, up-right, right, up-right, right, right, down-right, right, down-right | 12 pieces, always |
| `spark` | The burning tip (one fuse piece, lit) and four single lit cells round it; a glow sprite of radius 0.35 m | Follows the fuse's end |

**The seconds.** Drawn on the face as a texture: Fraunces 800 in the skin's digit colour, 74% of the face's height for one digit, 60% for two; redrawn only when the number changes. In the last 3 seconds they take the skin's danger colour. Both colours pass 4.5 to 1 on every face (`checks.py`).

**The fuse burns.** With a share s of the turn left, show ceil(12 × s) pieces; the last one shown is the lit tip. A new turn starts with all 12. **Test:** s = 1 gives 12; s = 0.34 gives 5; s = 0.01 gives 1.

**Last 3 seconds.** The bomb wobbles ±1.5° four times a second; the spark grows to 1.6×.

## 2. The eight skins

Colours are each skin's own (`data/skins.json`). "lit" means the colour gives light and is drawn unshaded. θ is the angle round the bomb seen from above; y is height in cells.

| Skin (from) | Shape and pattern, as a rule | Face and seconds | Fuse; spark |
|---|---|---|---|
| **Ice** (starter) | Ball in three blues by height: `#2B5A97` below 6, `#3A72B6` to 12, `#4F8ACB` above. A snow cap `#F4F8FB` covers everything above a scalloped edge at height 14.5 + 1.5·cos(4θ): four lobes. Under each of the cap's four low points hangs a 3-cell icicle `#CFE8F5`. Two frost glints (a plus of five cells) low on the front, left and right | Rim `#CFE8F5`, face `#EEF6FB`, seconds `#1F3A66`. Mark: a snowflake | White and pale blue; ice-white |
| **Ember** (Oat Sack, common) | Ball `#3A2C2A`, a shade lighter above the middle. Four cracks, each a zig-zag of three or four straight runs, glow lit `#F28A3C` with a hotter `#FFC773` cell at each bend. The same four on the back, mirrored. They pulse brighter in the last 3 seconds | An iron rim `#2A201E` and a glowing window, lit `#FFD08A`; seconds `#3A2418`. Mark: a flame | Charred browns; orange |
| **Peppermint** (Oat Sack, common) | Ball `#F7F0E6` with four bold red stripes `#C8453C` that wind once round in 12 cells of height: a cell is red when (θ·4/2π + y/12) mod 1 is under 0.42 | Green rim `#69A97F`, white face, seconds `#7A211C`. Mark: a swirl. Red cap with a green lip | Red and white; warm |
| **Plum** (Oat Sack, uncommon) | Ball `#6C4A80`, darker `#573868` under 5. A paler bloom `#8B6C9F` high on the front left. One dark cleft down the front right. The cap is a brown stem socket, and an upright leaf `#5E9B6A` with a darker midrib leans from it to the right | A cream fruit sticker: rim `#E3D5B5`, face `#F6ECD6`, seconds `#3B2548`. Mark: a leaf | Brown and green; warm |
| **Gold** (Oat Sack, rare) | Ball `#D6A53B`, lighter `#E9C25E` above 13, darker `#A87A2A` under 5. A belt `#B88A2C` two cells high round the middle with a pale rivet every 45°. A polished patch high on the front left. Two lit glints `#FFF8DC` | Rim `#A87A2A`, face `#FAE9B0`, seconds `#4A3312`. Mark: a crown | Two golds; pale gold |
| **Diamond** (Oat Sack, legendary) | **Not a ball: a cut gem.** Eight-sided all the way up. From a small flat base (radius 3) it widens to radius 10 at 12 cells, holds for 2 (the girdle), then narrows to a flat table of radius 6.5 at 18. Its eight sides alternate two tones: `#D8F6F8` / `#B6E9EE` above the girdle, `#8FD3DC` / `#74C0CC` below, the girdle itself `#EAFBFC`. Two lit white glints | Rim `#74C0CC`, face `#F2FDFE`, seconds `#1E4D59`. Mark: a gem. The face's middle is 11 cells up | Silver and white; white |
| **Brass Bell** (Bell Shelf, 30 Bells) | **Not a ball: a bell.** Round, its radius by height from the ground: 10, 10, 9.2, 8.6, 8.1, 7.7, 7.4, 7.2, 7.0, 6.9, 6.8, 6.7, 6.6, 6.4, 6.1, 5.6, 4.9, 3.9, 2.6. Brass `#D8A340`; the lip and two engraved rings (at 4 and 13) `#B6852E`; a bright strip `#F2CE7C` down the front left. Its cap is the crown loop the fuse threads through | Rim `#99702A`, face `#F8ECC8`, seconds `#4A3312`. Mark: a bell. The face's middle is 9 cells up and 7 cells forward | Two brasses; pale gold |
| **Aurora** (mission: 7 dream nights) | Ball `#1F2A49`, darker above 14. A ribbon of light winds round it at height 8.5 + 2·sin(2θ + 0.6): teal lit `#6FB7B0` under, green lit `#7BC48E` in the middle, violet lit `#8C8FD8` on top. Above it, a dim ray `#4A4F86` every 22.5°, 2, 4 or 3 cells tall in turn. Nine single lit stars on the upper half at fixed places | Teal rim, a night face `#101830`, **light** seconds lit `#C8F5D6`; in the last 3 seconds lit `#FF9C8A`. Mark: a star | Teal and violet; green-white |

Each line under a name in the Trading Post comes from the same file: "The classic frozen bomb." (kept from today), "Banked coals in an iron shell.", "A boiled sweet with a short temper.", "Ripe, with a leaf still on.", "Polished. Heavier than it looks.", "Cut, not round. Every face catches light.", "Rings once. Loudly.", "A piece of the night sky."

## 3. Loading them

`data/models/bomb_<id>.json` holds each skin as boxes (about 400 to 570) with a `part` on every box. `data/skins.json` holds, per skin: where the face is (`face.centre_cells`, `radius_cells`), the digit and danger colours, the fuse and spark colours, where the fuse starts (`cap_top_cells`) and the emblem grid. Build one mesh per part so the game can hide `emblem`, shorten `fuse` and move `spark` without rebuilding. **Test:** each built bomb's bounding box equals `size_m` within 1 mm, and its parts are exactly these seven.

## 4. What this replaces

Today's blob bombs and their thumbnails. Everywhere a bomb is drawn (Home's menu icon aside) uses these models: the Trading Post, the Barn Book, the table, Practice, the lobby preview.
