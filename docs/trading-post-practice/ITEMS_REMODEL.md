# ITEMS_REMODEL.md — remodelling every buyable item

This replaces `VOXEL_GRAIN.md`, which is deleted. It covers all 26 items you can buy, find in a sack or win: 8 bomb skins, 8 fuse sounds and 10 bursts. The model data in `data/` is already rebuilt to this file. Claude Code loads it and models nothing by hand.

## 0. What went wrong

`VOXEL_GRAIN.md` made 0.05 m the smallest detail on every model. I took that number from Home's micro layer and never checked how the rest of the site draws its items.

The live site (v0.9.7) draws a bomb about 20 to 24 tiny cubes across, each 4 to 5 px on screen, with detail down to a single cube: the bomb in Practice, and the bombs on the shop cards. The 0.05 m floor halved that resolution, so the items came out coarse next to everything else on the site.

## 1. The look, in one rule

Your reference sheet: **chunky blocks for structure, tiny blocks for detail.**

| Role | What | Cube | On screen at 1440 x 900 |
|---|---|---|---|
| Structure | Stalls, benches, boards, posts, crates, snow banks, the rink | 0.05 m cubes, built as parts 0.2 m wide (unchanged) | 6 to 14 px |
| Items | Everything you can buy, find or win: bomb skins, fuse sounds, bursts | **0.025 m cubes**, about 20 across a bomb | 4 to 5.5 px, as the site draws its bombs today |
| Worn by animals | Bibs, the whistle | The animals' 0.04 m | — |

*An example.* The Plum on the bench is 20 tiny cubes across. Its groove is one cube deep, its stem 2 x 2 cubes, and its leaf 15 cubes with a darker midrib. The bench under it is made of 0.2 m boards of chunky cubes. The tiny item reads as detail sitting on chunky structure, which is exactly the reference.

## 2. Rules for every item

1. **Tiny cubes.** Every item is built of 0.025 m cubes.
2. **Shape first.** Each item has an outline of its own, so you can tell it apart as a silhouette. It is never just a ball painted differently. Examples: the wrapped Peppermint, the Plum with its stem and leaf, the cut Diamond, the Bell.
3. **Detail is real.** Bands, rims, rivets, cap lips, icicles and leaves stand one cube proud of the body, so the game's own light shades them. Nothing is a painted line.
4. **Detail is designed, never noise.** Every small mark belongs to a named motif: rivets, studs, stars, sparkles, screen pixels, stitches, keyholes, comb teeth. A lone cube outside a motif is speckle, and speckle is what made the old items look fussy.
   - **Check:** at most 6 lone cubes seen from the front per item (`grain_audit.specks()`). Motif cubes carry their motif's name in the data (for example `rivet`, `stud`, `star`).
5. **One part, one colour.** Each part is one colour, in planned value steps: lighter on top, base in the middle, shade at the bottom. Nothing is random. Skins and bursts keep their own strong colours and stay out of `harmonize()` (`PLAN_DEPTH_AND_LIGHT` 3.3). Fuse sounds use scenery colours only (LADDER and the named glows), at most six materials each.
6. **Patterns on round bodies** are decided by where the camera meets the surface, not by each cube's depth. That way a swirl, a band or a crack is drawn as one clean shape, without stray cubes at its edge.
7. **Sizes.**
   - The body is 0.45 to 0.5 m.
   - The whole item is at most 0.7 m wide, so five fit on the bench 0.72 m apart.
   - An item is shown at 0.8x to 1x of its size, never smaller.
   - A burst on a display stand is *drawn in*: each piece moves to 42% of its distance from the middle (67% on the Bell Shelf's larger stand), but every piece keeps its full size.
8. **Overlaps.** Where two boxes overlap, the later one wins, as the game's `fill()` does. The packer keeps the JSON's box order.

## 3. The bombs: what was wrong, and the remodel

**What was wrong with all eight (the last plan).**
- Every pattern had been forced to 2 x 2 cubes, so detail was coarse and flat.
- The face was a plain disc.
- Most skins were the same ball with different paint.

**What every skin now shares** (`T2` gives the full anatomy):
- **Face:** a gauge, so the seconds still have a flat place to sit. It is a bezel ring 10 cubes (0.25 m) across, standing one cube proud, around a face 8 cubes (0.2 m) across. Outside a game the face shows **10**.
- **Cap:** a neck 8 cubes across (corners cut) and 2 high, with a lip 4 across and 2 high.
- **Fuse:** 12 braid pieces, each a 2 x 2 x 2 block of one colour, the skin's two fuse colours taking turns.
- **Spark:** the lit tip and four spark cubes.

Below, y is height in cubes from the ground and θ is the angle round the bomb seen from above (90° faces the camera).

| Skin | Silhouette | Body and colours | Raised parts and motifs |
|---|---|---|---|
| **Ice** (starter) | Ball, 20 across | Iron blues by height: `#2B5A97` under 5, `#3A72B6` to 11, `#4F8ACB` above | A snow cap `#F4F8FB` above an edge at 15 + 1.5·cos(4θ): high over the face, dipping low at 45° and 135°. It stands one cube thicker on its top surfaces, and its lower edge is one step darker (`#D6E6F2`) as a lip. Under each front low point hangs an icicle 5 cubes long, standing one cube out: 2 cubes wide for two rows, then 1, with a white tip. A frost shine `#8DB8E6` sits low on the left: three cubes in a diagonal |
| **Ember** (Oat Sack, common) | Ball with a seam band that juts out at the middle | Charred iron: `#3A2C2A` below 10, `#463633` above | Five glowing cracks, about one cube wide, lit `#F28A3C`, hotter `#FFC773` at each bend. They are mirrored on the back and pulse in the last 3 seconds. A seam band `#2A201E`, 2 rows (y 9 to 11), one cube proud. On it, twelve rivets `#6A5A54`, one every 30° |
| **Peppermint** (Oat Sack, common) | **A wrapped sweet**: a ball 18 across with twisted cellophane ends left and right; 0.7 m wide in all | White `#F7F0E6` with six red `#C8453C` wedges that swirl outward from the face, front and back | Each wrapper end is a neck 2 cubes long (`#D8E6EC`), then a fan widening from radius 2.4 to 4 over 3 cubes, pleated in six folds of `#EAF2F5` and `#CFE0E8`. Red cap, green lip. Green bezel round a white face |
| **Plum** (Oat Sack, uncommon) | A fruit: a little taller than wide, a dimple on top, a stem and a leaf | `#6C4A80`, darker `#573868` under 4 | A dusty bloom `#8B6C9F` high on the left. A groove one cube deep (`#4E3060`) down the front right, gently curving. The stem `#5F4530` is 2 x 2 and 4 tall, bending right at the top; it is the cap, and the fuse starts on it. A leaf `#5E9B6A` of 15 cubes, 2 deep, leans left with a midrib `#4A8056` |
| **Gold** (Oat Sack, rare) | Squat (19 tall, 20 wide) with a jutting crown band and a crowned cap | `#A87A2A` under 4, `#D6A53B`, `#E9C25E` from 13 up | A crown band `#B88A2C`, 3 rows (y 8 to 11), one cube proud, with twelve studs every 30°: pale `#F7E3A0` studs, and at 45° and 135° two rubies (`#B3261E` over `#8E1D17`). A polished highlight `#F7E3A0` on the upper left, with a lit core `#FFF8DC`. The cap carries four crown points at its corners |
| **Diamond** (Oat Sack, legendary) | A cut gem, eight-sided, 18 tall | The pavilion in two tiers (`#74C0CC`/`#5FAFBE` low, `#8FD3DC`/`#74C0CC` above), the girdle `#EAFBFC` (y 12 to 14), the crown `#D8F6F8`/`#B6E9EE`, the table `#F2FDFE`. Facets take turns by side | Two four-point sparkles, lit white, standing one cube out (their middles two): upper left and lower right |
| **Brass Bell** (Bell Shelf) | A bell with a flared lip and a crown loop | Brass `#D8A340`; a bright strip `#F2CE7C` down the front left (y 4 to 15) | The lip (y 0 and 1) and two rings (y 6 and 14) stand one cube proud in `#B6852E`. The crown loop is two posts and a bar of 2-cube bars; the fuse threads through it. The face's middle is 8 up |
| **Aurora** (mission) | Ball | Night `#1F2A49`, darker `#18223C` from 14 up | A three-colour ribbon winds round at 8.5 + 2·sin(2θ + 0.6): teal `#6FB7B0` under, green `#7BC48E` in the middle, violet `#8C8FD8` on top, all lit. **The Plough** in seven lit stars `#E8F0FF` on the upper left (a handle of three, a bowl of four). A pole star upper right: a four-point sparkle, lit white, its middle one cube out |

## 4. The fuse sounds: what was wrong, and the remodel

**What was wrong.** Rebuilt with every part at least 2 cubes, they had become flat cut-outs: an 8-bit console with four blocks on its screen, plain boxes for bells, an owl with no carving.

**Now** each is built of tiny cubes with real parts, 0.35 to 0.73 m tall and at most 0.7 m wide.

| Sound | The remodel, part by part |
|---|---|
| **Ice chime** | A plinth in two steps (`darkWood 0`, `+1`) and two posts (`−1`). A top bar (`0`) with lighter end caps, snow on the bar (`snow 1`) and two lumps (`snow 2`). Four icicles: 3 cubes wide at the bar, 2 below, then 1 at the end, with a pale tip (`ice 2`). They are 10, 7, 12 and 8 cubes long, in `ice 0`, `+1`, `−1`, `+1` in turn. A red bead 3 x 4 cubes with a shine cube hangs on a one-cube cord beside the last icicle |
| **8-bit** | A pocket console in `trimWhite 0` on a slate stand, with a darker foot, its top corners rounded. The screen sits in a slate bezel and shows **a pixel sheep**: a round fleece of 22 lit sage cubes on two legs, with a gold face. A D-pad of two crossing bars, raised one cube. Two red buttons (B, A), 2 x 2, raised. Select and start pills. A speaker of three slot cubes in a diagonal |
| **Wood block** | A block in `wood 1` with a lighter top and darker end grain, standing on two felt feet (`scarfRed −2`). A slot 12 x 2 with a lip under it. A cream mallet handle lies across the top, with a round red head (radius 2.2) whose top half is a step lighter |
| **Cowbell** | Copper (`carrot −2`) that widens smoothly from 8 cubes at the crown to 13 at the rim. A flared brass rim, 2 rows. A shine (`carrot +1`), 2 cubes wide, down the front left. A round iron clapper showing under the rim. A brass crown. A leather strap loop (`darkWood 0`, its top `+1`) with four white stitches and a square brass buckle with a hole in it |
| **Sleigh bells** | Three round brass bells (radius 3.4), lighter on their upper third. Each has a slot across its bottom ending in two holes (iron) and an iron neck to the strap. The strap is leather with brass rivets every 4 cubes, between two posts standing in snow |
| **Music box** | A red box (`barnRed 0`) on a dark plinth, with a raised front panel (`+1`), a brass keyhole plate and keyhole, and a cream rim. The lid stands open (`barnRed −1`) with a cream lining and a pale mirror. Inside: a comb of brass teeth in two brasses taking turns, and a drum. **A tiny sheep turns on a turntable**: wool body, lighter back, pink face, ears and an eye. A brass crank with a red knob on the right |
| **Owl** | A carved owl on a snowy perch: a round body (`wood 0`) and a wider head (`wood −1`). A pale chest (`wood 2`) carved with chevron feathers in rows of three, two and one. A carved wing groove down each side. Ear tufts, 2 wide then 1. Round facial discs (`wood 1`), amber eyes (`coopYellow 0`) with dark pupils toward the middle. A beak standing out. Three toes on each foot gripping the perch |
| **Lullaby** | A cradle hook: a base, a post and an arm whose end curls under. A smooth crescent moon (lit `glow:moon`) with a closed, sleeping eye and a pink cheek, wearing **a red nightcap with a white pompom** on its top tip, hanging on a cord. A five-point star (lit) on its own cord. The moon's glow is kept |

## 5. The bursts: what was wrong, and the remodel

**What was wrong.** Their pieces were 0.05 m cubes: twice the size of the bomb's cubes beside them. In the shop before that, they had been shrunk to about 0.014 m.

**Now** every piece is built of the items' 0.025 m cubes, keeps its size in metres, and gains the detail that size allows. Timing, places, colours and piece counts are unchanged (`T3`).

| Burst | Pieces now |
|---|---|
| Confetti | Slabs 4 x 3, 4 x 2 and 2 x 4 cubes |
| Snowfall | Six-armed flakes 7 x 7, open in the middle, taking turns with small flakes 5 x 5; six 2 x 2 specks |
| Hay | Straws 10 cubes long |
| Lantern Glow | Paper lanterns 6 x 6 x 4 with two raised ribs, an iron cap, a hanger and a foot; lit |
| Frost | Needles 22 and 12 cubes long with white tips; each long needle has a pair of side twigs two thirds of the way out |
| Northern Lights | Curtain columns 2 cubes wide; six stars as 3 x 3 plus signs |
| Starlight | Big stars 7 x 7 and small 5 x 4, five-pointed, each with an unbroken tail of seven cubes |
| Ember | Sparks: a 2 x 2 lit head and a tail of five cubes cooling from orange to dark |
| Bubblegum | Bubbles 16, 12 and 12 cubes across, each with a shine of a 3 x 2 block and one cube above; six bits of 4 x 3 |
| Solstice | A sun 20 cubes across, paler in the middle; rays 10 and 6 cubes long in turn |

## 6. Where the items appear on the site

The same models are used wherever an item is drawn (Home's menu icon aside). Their cubes on screen at 1440 x 900:

| Place | Cube on screen | Note |
|---|---|---|
| Trading Post bench, Bell Shelf | 5.0 to 5.5 px | Measured from the placements in `data/market.json` |
| Barn Book (0.8x) | 4.0 px | The smallest place; every motif above still reads at 3 cubes or more |
| Practice, the worn bomb | 5.5 px | Matches today's in-game bomb (about 5 px) |
| Close view (x 2.2) | about 11 px | Detail is meant to be looked at here |
| The barn table, the lobby preview, mission slips (68 px pictures), the sack reveal | **Not measured** | Check in step S1. The model stays the same; if a camera draws a cube under 3 px, report it rather than rebuilding the item |

## 7. What Claude Code does

1. Use this folder's `data/` as it is.
2. Pack the models (`X2`, S1), keeping box order (rule 8).
   - Parts are `shell`, `face`, `cap`, `fuse`, `spark` and `detail`.
   - A box's name carries its motif, for example `rivet`, `stud`, `star`, `pixel sheep`, `sparkle star`.
3. Bombs:
   - Build the 12 fuse pieces from `fuse_pieces` in `data/skins.json`.
   - Draw the seconds on the face inside the bezel, centred on `face.centre_cells`.
   - Outside a game, draw **10**.
   - Remove any `emblem` mesh.
4. Bursts on display stands are placed with `spread`, never by scaling the whole burst.
5. Put a screenshot of the S1 preview page beside `reference/models-bombs.png`, `models-fuse-sounds.png` and `models-bursts.png`.

## 8. Checks

- `python3 tools/checks.py`: 380 pass, 0 fail. For the items it checks:
  - each model's cube size for its role (0.025 m for items);
  - speckle: at most 6 lone cubes seen from the front, outside named motifs;
  - every burst box is whole 0.025 m cubes;
  - scale 0.8x to 1x;
  - items' cubes 3.5 to 7 px and scenery's 5 to 15 px on screen;
  - the parts and the 12-piece fuse;
  - the contrast of the seconds on every face.
- `python3 tools/grain_audit.py` prints nothing. It lists any model off its role's cube size, with speckle, or with a plain area wider than 0.4 m.

**Not checked:** the game's own light on the raised parts, and how the items look at the barn table and in the lobby, whose cameras are not in this folder.
