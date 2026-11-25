# T2. The bombs

`reference/models-bombs.png` shows all eight. They are the same models in the Trading Post and in every game mode, so this changes how the bomb looks wherever it appears. It changes no rule.

## 1. One anatomy

Every skin is built of 0.025 m cubes so its outline reads round, but every part you can see is at least 2 cubes (0.05 m), the detail size of every other model (`VOXEL_GRAIN.md`). Patterns are worked out on 2 x 2 blocks as the camera sees them, then cleaned of slivers. Every skin has the same six parts, so the game treats all skins alike. Sizes are in cubes; the bomb is 20 cubes (0.5 m) across, as today.

| Part | What | Same for every skin |
|---|---|---|
| `shell` | The body. A ball 20 cubes across with its middle 10 up, except Diamond and Brass Bell (below) | Sits on the ground at the same spot |
| `detail` | Patches on the shell (a shine, an icicle, a leaf) | Each at least 2 x 2 cubes |
| `face` | A flat disc 8 cubes (0.2 m) across and 2 thick, standing on the body's most forward point: its edge in the rim colour, its front in the face colour | Always faces the camera; always the same size |
| `cap` | A neck 2 cubes high (8 across, corners cut) and a lip 2 high (4 across). The Bell's cap is its crown loop | The fuse starts on top of it |
| `fuse` | 12 pieces, each a 2 x 2 x 2 cube block in one colour, the skin's two fuse colours taking turns. From the cap they go up, up, right, up, right, right, right, down, right, right, down | 12 pieces, always |
| `spark` | The burning tip (it replaces the last piece shown, lit) and four single lit cubes at its corners; a glow sprite of radius 0.35 m | Follows the fuse's end |

**No maker's mark.** Outside a game (the Trading Post, the Barn Book, the lobby) the face shows **10**, the bomb as it looks when a turn starts, in the skin's digit colour.

**The seconds.** Drawn on the face as a texture: Fraunces 800 in the skin's digit colour, 74% of the face's height for one digit, 60% for two; redrawn only when the number changes. In the last 3 seconds they take the skin's danger colour. Both colours pass 4.5 to 1 on every face (`checks.py`).

**The fuse burns.** With a share s of the turn left, show ceil(12 × s) pieces; the last one shown is the lit tip. A new turn starts with all 12. **Test:** s = 1 gives 12; s = 0.34 gives 5; s = 0.01 gives 1.

*An example.* A 10-second turn has 4 seconds left: s = 0.4, and ceil(12 × 0.4) = 5, so five fuse pieces show and the fifth is lit.

**Last 3 seconds.** The bomb wobbles ±1.5° four times a second; the spark grows to 1.6×.

## 2. The eight skins

Colours are each skin's own (`data/skins.json`). "lit" means the colour gives light and is drawn unshaded. θ is the angle round the bomb seen from above; y is height in cubes (0 at the ground, 19 at the top of a ball).

| Skin (from) | Shape and pattern, as a rule | Face and seconds | Fuse; spark |
|---|---|---|---|
| **Ice** (starter) | Ball in three blues by height: `#2B5A97` below 6, `#3A72B6` to 12, `#4F8ACB` above. A snow cap `#F4F8FB` above a scalloped edge at height 16 + 1.5·cos(4θ): four lobes. Under the two front low points, an icicle `#CFE8F5` 2 cubes wide and 4 long. One shine `#6E9FD6`, 2 x 2, low on the left | Rim `#CFE8F5`, face `#EEF6FB`, seconds `#1F3A66` | White and pale blue; ice-white |
| **Ember** (Oat Sack, common) | Ball `#3A2C2A`, `#463633` from 10 up. Four cracks, each one or two straight runs 2 cubes wide, glowing lit `#F28A3C`, hotter `#FFC773` at each bend; the same four on the back, mirrored. They pulse brighter in the last 3 seconds | An iron rim `#2A201E` and a glowing window, lit `#FFD08A`; seconds `#3A2418` | Charred browns; orange |
| **Peppermint** (Oat Sack, common) | Candy bands 4 cubes (0.1 m) tall, red `#C8453C` and white `#F7F0E6` in turn, red at the bottom, middle and top. The face sits on the middle red band | Green rim `#69A97F`, white face, seconds `#7A211C`. Red cap with a green lip | Red and white; warm |
| **Plum** (Oat Sack, uncommon) | Ball `#6C4A80`, darker `#573868` under 4. A paler bloom `#8B6C9F`, 4 x 4, high on the left. A dark cleft 2 x 8 down the front right. A brown stem socket, and beside it on the left a leaf `#5E9B6A`, 6 x 6 in three steps, with a darker midrib `#4A8056` of three 2 x 2 steps | A cream fruit sticker: rim `#E3D5B5`, face `#F6ECD6`, seconds `#3B2548` | Brown and green; warm |
| **Gold** (Oat Sack, rare) | Ball `#D6A53B`, lighter `#E9C25E` from 14 up, darker `#A87A2A` under 4. A belt `#B88A2C` 2 cubes high at 8 to 10, with a pale rivet `#F7E3A0` every 45°. A polished patch `#F7E3A0`, 4 x 4, high on the left; one lit shine `#FFF8DC`, 2 x 2, high on the right | Rim `#A87A2A`, face `#FAE9B0`, seconds `#4A3312` | Two golds; pale gold |
| **Diamond** (Oat Sack, legendary) | **Not a ball: a cut gem.** Eight-sided all the way up. From a flat base (radius 3) it widens to radius 10 at 12, holds for 2 (the girdle `#EAFBFC`), then narrows to a flat table at 18. Its eight sides alternate two tones: `#D8F6F8` / `#B6E9EE` above the girdle, `#8FD3DC` / `#74C0CC` below. Two lit white shines, 2 x 2 | Rim `#74C0CC`, face `#F2FDFE`, seconds `#1E4D59` | Silver and white; white |
| **Brass Bell** (Bell Shelf, 30 Bells) | **Not a ball: a bell.** Round, its radius by height: 10, 10, 9.2, 8.6, 8.1, 7.7, 7.4, 7.2, 7.0, 6.9, 6.8, 6.7, 6.6, 6.4, 6.1, 5.6, 4.9, 3.9, 2.6. Brass `#D8A340`; the lip (0 to 2) and two rings (4 to 6, 14 to 16) `#B6852E`; a bright strip `#F2CE7C` down the front left, 6 to 14. Its cap is a crown loop of 2-cube bars the fuse threads through | Rim `#99702A`, face `#F8ECC8`, seconds `#4A3312`. The face's middle is 8 cubes up | Two brasses; pale gold |
| **Aurora** (mission: 7 dream nights) | Ball `#1F2A49`, darker `#18223C` from 14 up. A ribbon of light winds round it at height 8.5 + 2·sin(2θ + 0.6), three bands 2 cubes tall: teal lit `#6FB7B0` under, green lit `#7BC48E` in the middle, violet lit `#8C8FD8` on top. Three lit stars `#E8F0FF`, 2 x 2, on the upper half | Teal rim, a night face `#101830`, **light** seconds lit `#C8F5D6`; in the last 3 seconds lit `#FF9C8A` | Teal and violet; green-white |

Each line under a name in the Trading Post comes from the same file: "The classic frozen bomb." (kept from today), "Banked coals in an iron shell.", "A boiled sweet with a short temper.", "Ripe, with a leaf still on.", "Polished. Heavier than it looks.", "Cut, not round. Every face catches light.", "Rings once. Loudly.", "A piece of the night sky."

## 3. Loading them

`data/models/bomb_<id>.json` holds each skin as boxes (about 380 to 550) with a `part` on every box. `data/skins.json` holds, per skin: where the face is (`face.centre_cells`), the digit and danger colours, the fuse and spark colours, where the fuse starts (`fuse_start_cells`) and its 12 steps (`fuse_pieces`, in 2-cube units). Build one mesh per part so the game can shorten `fuse` and move `spark` without rebuilding. **Test:** each built bomb's bounding box equals `size_m` within 1 mm, and its parts are `shell`, `face`, `cap`, `fuse` and `spark`, plus `detail` where the skin has one.

## 4. What this replaces

Today's blob bombs and their thumbnails. Everywhere a bomb is drawn (Home's menu icon aside) uses these models: the Trading Post, the Barn Book, the table, Practice, the lobby preview.
