# 06. World 3: under the quilt

See `reference/world-3-under-the-quilt.png` and `moon-show.png`.

**He is fast asleep, so the dream is made of his bed.** The track is the edge of his made bed: the sheep runs along the turned-down sheet. Behind it his quilt rolls away in padded squares, with his knitting things standing in it as big as trees; his candle burns far off like a lighthouse; and his nightshirt's buttons hang on threads for stars.

*An example.* The sheep runs along a cream sheet with red blanket stitch along its edge. Just behind it lies a calm, dark band: the quilt's lining, turned back. Past that the quilt rises in hills of red, mustard, green and mauve squares with cream between them; two knitting needles stand crossed in one hill; a bedpost rises in the distance against a huge moon.

Every place below is in `data/worlds.json` (world 3). The light is warm here (file 02, section 5): it comes from the candle's side.

## 1. The track: the edge of his bed

`laneBayBed0` to `3`, in turn, 40 bays end to end at z 0. Each bay, from the top down:

| Part | What it is |
|---|---|
| The sheet | The track itself: `trimWhite +2`, tint 1.0. A hem under its front edge, and eight red blanket stitches along it |
| The quilt, hanging over the bed's side | Two rows of squares, each 1.2 m wide and 0.8 m high, in the quilt's order (cream beside a colour, a colour under cream), each with a raised middle. A cream hem under them |
| The mattress | `houseCream +1` with four mauve stripes |

Everything under the sheet (part `hang`) takes the tint 0.55, so the sheet stays the brightest band.

## 2. Right behind the track: the quilt's lining

A plain band from z −5.2 to z −1.2, its top at y 0.1, in `slate −1` at tint 0.58. Along its back edge the quilt turns over in a low roll (z −5.2 to −4.6, 0.3 m high, `slate 0`, tint 0.70) with a cream stitch every 0.8 m.

This band is there for the player: the sheep, the obstacles and the sign always stand against something calm and dark, never against the busy squares.

## 3. The quilt

Squares of 2 m, 48 to a row along the strip (`ix` 0 to 47), in rows 3 to 16 behind the track (`iz`). The square in column `ix`, row `iz` has its middle at x `2 × ix + 1`, z `−0.2 − 2 × iz`.

| | |
|---|---|
| Its colour | The quilt's rule (file 03, section 5) |
| How high it lies | `v = 0.7 + 1.25 × sin(2π × ix / 16 + 0.55 × iz) + 0.9 × sin(2π × ix / 12 − 0.8 × iz + 1.0) + 0.14 × iz`; the level is `v` rounded, kept between 0 and 3. Row 3 is always level 0; row 4 is at most level 1. So the quilt lies flat near the track and rises into hills further back |
| Its foot | At y `0.5 × level − 0.3` |
| Under a raised square | One plain box of its own material at step −2, from y −1.0 up to its foot, so no gap shows |
| Its model | Rows 3 to 8: `quiltPatch0` to `4`. Rows 9 to 16: `quiltPatchFar0` to `4` |

The two sine waves repeat exactly over the strip's 48 columns, so the hills join without a seam.

**Far away:** a base of `slate −2` from z −150 to z −33.2, and three long low folds of big squares (8 m each, alternating step −1 and −2), their middles at x 14, 50 and 84: half-widths 30, 22 and 32 m; 3, 2 and 3 steps; each step 1.6 m high, 8 m narrower on each side than the one below, from z −118 + 4k to z −94 − 4k. The lowest step is `slate` and the second `trimWhite`; the third is `scarfRed` on the first fold and `coopYellow` on the third (the second fold has two steps). **No pillow mountains:** large pale lumps on the horizon read as blocky clouds.

## 4. His things, standing in the quilt

Each stands on the square under it.

| Thing | Model | x (m) | z (m) | y of its foot (m) | Row |
|---|---|---|---|---|---|
| A bedpost | `bedpost` | 13 | -28.2 | 0.7 | B3 |
| Two crossed knitting needles | `needles` | 23 | -10.2 | 1.7 | B2 |
| A spool of thread | `spool` | 37 | -12.2 | 0.2 | B2 |
| A ball of red yarn | `yarnBall` | 51 | -8.2 | 0.2 | B2 |
| His candle, the lighthouse | `candle` | 54 | -52 | -0.3 | B4 |
| A bedpost | `bedpost` | 61 | -28.2 | 1.7 | B3 |
| Two crossed knitting needles | `needles` | 67 | -14.2 | 0.7 | B2 |
| A ball of red yarn | `yarnBall` | 81 | -12.2 | 0.7 | B2 |
| A spool of thread | `spool` | 89 | -8.2 | 0.7 | B2 |

## 5. The button stars

Thirteen buttons hang on threads, at fixed places, at many depths, so they slide past each other as the sheep runs.

| Button | x (m) | y of its middle (m) | z (m) |
|---|---|---|---|
| `buttonBrass` | 4 | 5.4 | -14 |
| `buttonCream` | 12 | 6.8 | -26 |
| `buttonRed` | 19 | 4.6 | -9 |
| `buttonBrass` | 27 | 7.4 | -34 |
| `buttonCream` | 34 | 5.8 | -18 |
| `buttonRed` | 41 | 5 | -10 |
| `buttonBrass` | 48 | 7 | -30 |
| `buttonCream` | 55 | 5.2 | -15 |
| `buttonRed` | 63 | 6.6 | -24 |
| `buttonBrass` | 70 | 4.8 | -9 |
| `buttonCream` | 77 | 7.6 | -36 |
| `buttonRed` | 84 | 5.6 | -17 |
| `buttonBrass` | 91 | 6.2 | -27 |

Each thread is a box 0.1 m wide in `trimWhite −2`, from the button's top up out of the picture. Buttons are never tinted or hazed: they are this world's stars.

## 6. The sky and the moon

File 02, section 5. The moon is `moonFull`, 190 px across at `A` = 90, its middle 62% of the way across the window and 44% of the way down the sky.

## 7. What moves

| Thing | How |
|---|---|
| The buttons | A half turn about its thread, over 300 ms. Button `i` turns at beat `4k + (i mod 4)` (128 beats a minute), so the turning runs through them in fours |
| The yarn balls | Each rolls toward −x at 0.6 m a beat along its row and turns as it rolls; its loose end trails behind. When it leaves the strip's start it re-enters at the end |
| The needles | The two lean 4 degrees toward each other on the beat and back |
| The candle | Its flame and glow flicker by 15% either way, 0.5 to 1.5 times a second, never a blink |
| Feathers | 40 `feather` models (20 on phones and on Low), falling at 0.3 to 0.5 m a second and swinging 0.3 m from side to side, from z −14 to z 6 |
| The sheep's hooves | At each landing two feathers jump up from the sheet in place of the snow cubes |

## 8. What the sheep jumps

`obBooks`, `obPillows`, `obSpools`, `obClock`.

## 9. What is not in world 3

No snow, no farm, no northern light, no islands.

## 10. Phones and the Low tier

- **Phones:** the same world.
- **Low tier:** the quilt's rows 3 to 10 only, no far folds, 20 feathers.
