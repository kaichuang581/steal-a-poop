# P1. The rink

`reference/practice-run-computer.png`, `practice-run-phone.png`.

## 1. Axes

Metres. **x** runs across the screen (+x toward the bot), **y** up, **z** toward the camera. The ice's top is y 0; the middle line is x 0. Every number is also in `data/rink.json`, and the data wins.

## 2. The camera

A level shift-lens camera: it looks straight at the scene and shifts the picture instead of tilting, so upright things stay upright, as in the pictures. One helper serves this screen, the Trading Post and Counting Sheep: `placeShiftCamera(cam, A, W, H, eyeM, camM, lineShare, centreX)`, built with `makePerspective` and an off-centre frustum as `placeDreamCamera` is in `PLAN_COUNTING_SHEEP_VOXEL.md`.

| | Computer | Phone (narrower than 600 px) | The report (`P4`) |
|---|---|---|---|
| Distance from z 0 | 9.0 m | 9.0 m | 9.0 m |
| Eye height | 2.7 m | 2.7 m | 4.8 m |
| Scale A (px per m at z 0) | 210 × min(W/1440, H/900) | 0.21 × W | 420 × min(W/1440, H/900); phones 0.577 × W |
| Line where y 0, z 0 lands | 70% of the height | 70% of the **visible** height (above the keyboard) | 175% (off screen); phones 109% |

Screen x = W/2 + A·x·9/(9 − z). Screen y = horizon − A·(y − eye)·9/(9 − z), horizon = line − A·eye. **Test:** at 1440 x 900 the middle of the bomb's face (−0.62, 0.25, 0.60) lands at (580, 616) ± 3 px.

Framing: both sheep wholly on screen on a computer; on a 390 px phone each sheep may lose at most 15% of its length at the edge.

## 3. What stands where

Your sheep stands at x −1.7 facing +x; the bot at x +1.7 facing −x; both at z 0. The bomb sits by whoever holds it, at (∓0.62, 0, 0.35).

**Ground and ice**
- Snow: x −80 to 80, z −90 to 8, `snow 0`.
- Ice: x −6 to 6, z −2.6 to 2.2, `ice −2`, in 1.2 m plates from the corner (−6, −2.6). Plate (i, j) is tinted 0.60 when i + j is even and 0.53 when odd. A regular checker is the only ice texture.
- Chalk, `snow 2`, 8 mm above the ice: the middle line (0.08 m wide, the ice's full depth); a standing ring of radius 0.75 m round each sheep's spot, drawn in 0.1 m squares (a square is chalk when its middle is within 0.055 m of the circle).

| Model | Where (x, y, z) | Count | Job |
|---|---|---|---|
| `rinkBoards` | x −6.0 to 3.6 every 2.4, z −2.65 | 5 | Back boards, 0.6 m |
| side boards | x −6.1 to −6.0 and 6.0 to 6.1, z −2.6 to 2.2, 0.6 m, `wood 0` | 2 | Plain boxes; off screen on most windows |
| `rinkBoardsFront` | x −6.0 to 3.6 every 2.4, z 2.3 | 5 | Front boards, 0.3 m: low, so the sheep and bomb show over them |
| `tileRack` | (0, 0, 2.35), on the middle bay | 1 | Your word stands on it (`P2`) |
| `snowBank` | x −6.0 to 3.6 every 2.4, z −2.75 | 5 | The snow that was swept off the pond |
| `tallyBoard` | (0, 0, −4.3) | 1 | The chalkboard (`P2`); its face is 1.5 to 2.7 m up |
| `coachChair` | (−2.15, 0, −3.35) | 1 | The coach's high chair; seat 1.75 m up |
| the sheepdog | on the chair's cushion, (−2.15, 1.75, −3.35), facing +x | 1 | The coach. The game's own sheepdog; a stand-in in the pictures |
| `whistle` | on the dog's chest | 1 | `P2` |
| `practiceCrate` | (3.2, 0, −1.9) | 1 | Two spare Ice bombs with corks in their fuses, a chalk tick on the crate: practice gear |
| `broom` | (2.45, 0, −2.45), leaning 14° on the boards | 1 | It swept the ice |
| `lightPost` | (±4.4, 0, −2.95) | 2 | Lantern posts at the rink's back corners |
| `barn`, `silo`, `farmhouse` | (−9.5, −26), (−4.2, −27), (10, −32) | 3 | Home's own, far behind |
| `fenceBay` | x −19.2 to 16.8 every 2.4, z −9, bulbs off | 16 | Home's fence |
| pines | spire 6.5 m (−15, −14); cone 5 m (−12.2, −16); cone 4.5 m (7.2, −13); spire 6 m (15, −15); round 6.5 m (18, −20); cone 7 m (−20, −22); round 7 m (−1.5, −46); spire 8 m (4.4, −44) | 8 | Home's `tieredPine` |

Nothing stands between the camera and the sheep or the bomb except the 0.3 m front boards.

## 4. Light

Night, as today, but the rink is the brightest band.

| Thing | Value |
|---|---|
| Face light (r, g, b kept) | top (0.60, 0.69, 0.96), front (0.40, 0.47, 0.72), left (0.25, 0.30, 0.52), right (0.31, 0.37, 0.60), under (0.14, 0.17, 0.32) |
| Tint by depth | z −60: 0.54; −20: 0.58; −8: 0.68; −3: 0.86; 0: 1.0; +3: 0.78 |
| Haze | `#2D406B`, 14 m to 70 m, at most 0.80 |
| Sky | `#0E1834` top, `#1C2B52` at 55%, `#2D406B` at the horizon; Home's night stars |
| Lanterns | glow sprites, radius 1.1 m, strength 0.55, `#FFD38F`, with a warm pool on the snow under each |

## 5. The season

With `FESTIVE` on: seven bulbs on the board's roof; a string of 11 bulbs from each corner post's top (2.45 m) to the board's roof corner (±1.45, 2.95, −4.3), sagging 0.25 m, in the order gold, sage, red; the far barn's wreath. Off: no bulbs.

## 6. Cost

About 1,500 boxes, most of them Home's farm. One merged mesh per model; bays instanced. At most 25 draw calls, 40,000 triangles on High, 20,000 on Low (Low drops the far pines and fence). Frame time no worse than today's practice screen.
