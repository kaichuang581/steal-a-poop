# Farm animals v5 for Claude Code: six species that read at a glance

Version 5.0, 7 November 2026. Addendum to v1, v3 and v3.3 (the sheep); the v1 guardrails and the v3 voxel rules still apply. This plan replaces the current pig, cow, goat and horse models (and the chicken, if it is kept) with species built from their own shapes, on one shared rig, so the existing animation states, the lives system and the avatar catalogue keep working. Six milestones: **A0** (discovery), **A1** (the shared rig, the eye standard and the pig), **A2** (cow and horse), **A3** (goat and chicken), **A4** (warmth layers, worn items, tests, the line-up), **A5** (the sheep's eyes, optional).

---

## 0. For Brian

Save as `docs/REDESIGN_PLAN_V5_ANIMALS.md`, add the Part 1 block to `CLAUDE.md`, and paste the prompt below. As with the dream, **the species models in your screenshots are not on GitHub**: `main` has the catalogue (`src/skin/avatars/catalog.ts`, fifteen characters across sheep, pig, cow, goat and horse), the 2D icons and the sheep model, but no voxel pig, cow, goat, horse or chicken. Push them first so A0 can map them. The chicken is not in the catalogue; Part 13 decision 13.1 says what to do with it.

Prompt to paste:

```
Read @docs/REDESIGN_PLAN.md (Parts 1 to 4), @docs/REDESIGN_PLAN_V3.md (Parts 4, 5 and 8), @docs/REDESIGN_PLAN_V3_3.md (Part 3) and @docs/REDESIGN_PLAN_V5_ANIMALS.md in full. Do Milestone A0 exactly as specified and stop: write docs/skin/ANIMALS_DISCOVERY.md with the current builders, the viewer, the voxel counts and screenshots of all five current models, and list every place the current code and the plan disagree. Do not start A1 until I say so.
```

Then one milestone per session: A1, A2, A3, A4; A5 only if I say so.

---

## 1. Guardrail additions (append to CLAUDE.md)

```markdown
- Farm animals v5 (approved by Brian, 2026-11-07): the plan is docs/REDESIGN_PLAN_V5_ANIMALS.md. Every species is its own
  model built from its own shapes on the 0.04 m grid (V5 Part 4.1 rig), never a recoloured sheep. The shared rules in
  V5 Part 4 are binding: the eye standard (4.3), horizontal heads (4.4), smooth bodies with shaped markings (4.5),
  three signature features at most (4.7), every part attached (the connectivity test in 4.13), thin collars (4.8),
  warmth layers as lives for the non-sheep species (4.9), three tones per material and no pure black (4.10).
  The sheep model (src/skin/voxel/sheep.ts) does not change except under Milestone A5, if approved.
  The catalogue (src/skin/avatars/catalog.ts, src/avatars/ids.ts) keeps its ids, names and colours; the models read the
  character's colours and worn item from it. The engine, the lives rule and Lives.tsx do not change.
```

---

## 2. What is wrong now, and the rule that prevents it

| Seen in the screenshots | Rule | Checked by |
|---|---|---|
| All five share the sheep's wool-lobe body and silhouette | 4.5: each species has its own body primitive; the 64 px silhouette line-up must separate all six | 11.2 |
| Heads are vertical planks (the cow, goat and horse read as llamas) | 4.4: heads are horizontal, muzzle forward, eyes at the front third | 11.1 screenshots |
| Eyes are one black band with white corners | 4.3: two separate eye blocks, iris, catchlight, lids and brows | test 4.13.3 |
| The horse's ear floats; horns are antennae; ears are planks | 4.7: three signature features at most, each attached by at least two voxels and built at the body's scale | test 4.13.1 |
| Collars like tyres | 4.8: one-voxel bands at the neck | test 4.13.6 |
| No neck, no shoulders, four identical posts | 4.6: necks, shoulder bulges, hooves and feet per species | sheets |
| Black patches and white slabs as random noise | 4.5: markings are shaped masks; 4.10: no per-voxel noise on smooth animals | test 4.13.4 |
| Pure black eyes and hooves; candy stripes | 4.10: three tones per material, darkest #1C1919, saturation caps | test 4.13.4 |

---

## 3. Milestone A0: discovery (one short session)

Write `docs/skin/ANIMALS_DISCOVERY.md`:

1. The files that build and render the current pig, cow, goat, horse and chicken (if present), how they are selected from `catalog.ts`, and whether they are parameterised copies of `sheepModel()`.
2. The viewer: its route or flag, its camera, its chips (species, wool level, state), and how it is reached.
3. For each model: voxels before culling at level 2, triangles after meshing, distinct colours, parts, and a screenshot from the viewer's default camera.
4. Which `SheepState`s and which coat levels each model supports today, and what level 0 and freezing look like.
5. How `worn` from the catalogue is rendered today (voxel part, nothing, or the 2D icon only).
6. Disagreements with this plan, as a list; do not resolve them.

Acceptance: the file exists with the six sections; no source file changed.

---

## 4. Shared rules (binding for every species)

### 4.1 The rig

One interface for all species, generalised from `SheepModel` so `Sheep.tsx` can become `Animal.tsx` with the same state machine:

```ts
export interface AnimalModel {
  species: Animal;                         // from catalog.ts
  coats: Record<1 | 2 | 3 | 4, Part>;      // sheep: wool lobes; others: warmth layers (4.9) over the body
  body: Part;                              // the bare body (sheep: the sheared body); always drawn under the coats for non-sheep
  frosts: Record<1 | 2 | 3 | 4, Part>;     // built by one shared frostOf(coat) from each coat's upper faces
  head: Part; hood?: Part;                 // hood only on the sheep
  neck?: Part;                             // cow, horse, goat, chicken
  eyes: [Part, Part]; lids: Record<Lids, Part>; brows: Record<Brows, Part>; mouths: Record<Mouth, Part>;
  ears: [Part, Part]; legs: [Part, Part, Part, Part] | [Part, Part]; tail: Part;
  signature: Part[];                       // comb and wattle, horns, mane, snout and so on: at most three
  collar?: Part; bell?: Part; worn?: Part;  // 4.8
  breath: Part;
  stats: { voxels: number; colours: number; parts: number };
}
```

- Pivots as in the sheep: the body's pivot at the ground between the legs; the head's at the neck joint; each leg's at its top; the tail's at its root; each eye's at its own centre; ears at their roots. The component animates by pivot, so a species with the right pivots inherits every state for free.
- Forward axis and handedness exactly as `sheep.ts` (A0 records which); every species faces the same way at the same seat.
- One builder per species in `src/skin/voxel/animals/<species>.ts`, each a pure function of `(character: Character) => AnimalModel`, memoised by character id; `sheep.ts` stays where it is and is wrapped to return an `AnimalModel`.
- `Animal.tsx` replaces the model-specific parts of `Sheep.tsx`; the state machine, the timed-state durations, the gust, the freeze and the thaw are unchanged. Species-specific motion (4.11) is a table of small functions the component calls, not a fork of the component.

### 4.2 The cute formula (numbers, measured on the model)

| Measure | Rule |
|---|---|
| Head width | at least 70% of body width (horse and cow: at least 60%, because their heads are long) |
| Head length (chin to crown or muzzle to crown) | at most 1.2 × head width; a head longer than it is wide is the llama failure |
| Eye height | at least 35% of head height; eye blocks from 4.3, never smaller |
| Eye position | centred at 55 to 60% of the head's height from the top; that is low, which reads young |
| Eye spacing | the gap between the eyes at least 25% of head width |
| Muzzle or snout | at most 60% of head width and at most 45% of head height; rounded (chamfer 1 at least) |
| Legs | at most 45% of body height (horse 60%); square section 3 × 3 voxels or more; hooves or feet distinct in tone |
| Neck | visible on every species but the pig and the sheep; the head never grows straight out of the body front |
| Corners | every box chamfered at least 1 voxel; nothing thinner than 2 voxels except the tail tip, whiskers and the chicken's toes |
| Height | bounding height 0.95 to 1.15 m at scale 1 (chicken 0.85, drawn at 1.15 × at the table); bounding length 0.80 to 1.00 m |

### 4.3 The eye standard

Two eye blocks per animal, identical, mirrored, each built as a 5 × 5 × 1 voxel plate standing one voxel proud of the face (so lids can cover it):

```
. W W W .       W = eye white  #F4F1EA (never pure white)
W H I I W       I = iris, the character's accent tone (never pure black; floor #1C1919)
W I I I W       H = catchlight, one voxel, #FFFFFF, always at the upper-left of the iris as seen by the camera
W I I I W       . = empty (rounded corners)
. W W W .
```

- Goat: the iris is 3 wide × 2 tall (rows 2 and 3), a horizontal bar, the goat's real pupil and a distinct detail.
- Chicken: a 4 × 4 variant (iris 2 × 2, one catchlight) because the head is a ball of 8 voxels.
- Placement: on round heads (pig, chicken, sheep) both eyes on the front face; on long heads (cow, horse, goat) each eye sits on the side face at the front third of the head and wraps two voxels onto the front face, so both eyes are visible from the three-quarter camera the table uses.
- Lids (`Lids`): `closed` is a 5-wide, 1-tall line in the face's mid tone at row 3, drawn over the eye; `arc` is rows 2 and 3 as an upward arc for happy. Brows (`Brows`): a 4 × 1 bar one voxel above the eye in the face's dark tone, tilted by state as on the sheep. Blink: both lids `closed` for 120 ms every 3.5 to 5 s.
- Never: a single band across both eyes; whites at the outer corners only; an iris without a catchlight; eyes narrower than 4 voxels.

### 4.4 Heads

Three head types, all horizontal:

| Type | Species | Shape |
|---|---|---|
| Block | pig | a chamfered box wider than it is tall, snout disc on the front |
| Wedge | cow, horse, goat | a chamfered box that narrows toward the muzzle (`taperedBox`), muzzle forward, the crown at the back over the neck; the cow's muzzle broad and pink, the horse's long, the goat's with a Roman bump |
| Ball | chicken | a sphere on a short neck, a small horizontal beak |

The head joins the body through a neck part (except the pig, whose head sits against a shoulder bulge, and the sheep). The head's centre line is level or pitched down at most 15°; it is never vertical.

### 4.5 Bodies and markings

- Smooth species (pig, cow, horse) use one `ellipsoid` or a chamfer-3 `box` blended with an ellipsoid at each end, noise 0. The goat may use noise 0.03 and a belly fringe. The chicken is an egg (an ellipsoid tilted 15° tail-up). No wool lobes on anything but the sheep.
- Shoulder and hip: a slight bulge (an ellipsoid 10% wider than the body) at the shoulders and a smaller one at the hips, so the legs grow out of something.
- Markings are shaped masks painted over the body tones: an ellipsoid or union of two ellipsoids with a one-voxel soft edge (the edge voxels take the body's mid tone), never random voxels. Each species sheet lists its masks. Markings use the catalogue's `accent`, `mane` and `nose` colours.

### 4.6 Legs, hooves and feet

- Hooved species: legs 3 × 3 voxels square or wider, a 1-voxel knee notch on the front legs (a lighter voxel ring two voxels from the bottom), hooves as the bottom 2 voxels in the hoof tone, split by a 1-voxel groove at the front. Socks where the sheet says.
- Chicken: two legs 2 × 2 voxels in the beak tone, 6 tall, with three toes forward (1 × 3 each) and one back.
- Pig: short legs, 3 × 3 × 5, hooves 2 voxels.
- Legs splay 1 voxel outward at the hoof (feet slightly apart reads friendly, as V3.3 says).

### 4.7 Signature features and attachment

- Each species has at most three signature features (listed in its sheet) and no other add-ons: a pig with a snout, floppy ears and a curly tail is a pig; a pig with those plus a hat, a bow and spots is a costume.
- Every feature overlaps the part it grows from by at least two voxels in every axis it touches, and the assembled level-2 model must be one 6-connected solid (test 4.13.1). A floating ear fails the build.
- Features are built at the body's scale: ears no longer than 45% of head length; horns no longer than 60%; combs and wattles no taller than 25% of head height.

### 4.8 Collars, bells and worn items

- The collar is a 1-voxel-thick band around the neck, hugging the body (ring thickness 1 on the 0.04 m grid), in the character's `wornColor` for the `collar` worn item or the sheep's red otherwise; the bell is 3 × 3 × 3 at the throat in `T.brass`. Never a ring thicker than one voxel, never hanging below the chest.
- The catalogue's `worn` item is a voxel accessory on the head or neck, built once per item at a size relative to the head (table below); items not yet built fall back to nothing, never to a placeholder. Warmth layers (4.9) never use the head, so a worn item and the lives never collide.

| Worn | Voxel item (size relative to head width W) |
|---|---|
| scarf | a ring 2 voxels thick at the neck with two tails 6 voxels long hanging at the chest; ribbed with the item's two tones |
| strawHat, sunHat | a brim disc 1.4 W across, 1 voxel thick, a crown 0.6 W, in `T.hay`-like tones (sunHat in the item colour) |
| cap | a crown 0.8 W with a 0.35 W peak forward |
| topHat | a cylinder 0.7 W wide, 0.6 W tall with a 1.1 W brim |
| chefHat | a puffed cylinder 0.8 W, 0.7 W tall, white |
| nightCap | the farmer's cap from V4 scaled to 0.9 W |
| flowerCrown | a ring 1 voxel thick with five 3 × 3 flowers in two tones |
| bow | a 0.5 W bow between the ears |
| crown | a ring with five 2-voxel points in `T.brass` |
| headphones | a band over the crown with two 0.3 W cups at the ears |
| shades, goggles | a 1-voxel band across the eyes with 5 × 5 lenses replacing the eye whites (the catchlight stays) |
| helmet | a half-sphere 1.05 W |
| rosette | a 0.4 W disc on the collar |
| hood | the sheep's wool hood shape in the item colour, over the crown and cheeks |
| stripe | no item: a 2-voxel marking stripe down the back in `wornColor` |

### 4.9 Warmth layers (lives) for the non-sheep species

The sheep keeps its wool levels. Every other species shows its lives as the farmer's knitwear, lost a layer at a time to the cold; the mapping follows `coatLevel` exactly as the sheep's, so level 2 is the normal start:

| Level | Sheep | Pig, goat, chicken | Cow, horse |
|---|---|---|---|
| 4 | thickest wool | sweater + scarf + leg warmers | blanket + scarf + leg warmers |
| 3 | thick wool | sweater + scarf | blanket + scarf |
| 2 (start) | normal wool | sweater | blanket |
| 1 | thin wool | scarf only | scarf only |
| 0 | sheared, shivering | bare, shivering (the `cold` pose, breath puffs) | bare, shivering |

- **Sweater**: a band over the torso from behind the shoulders to before the hips, 1 voxel proud of the body, covering the top and sides down to the belly line, with a 1-voxel ribbed hem (alternating the two knit tones) and a chest patch slot (a 5 × 5 pattern in the second tone: a heart, a star or a stripe, per character later; plain now).
- **Blanket**: a rectangular quilt over the back from the withers to the hips, hanging to the belly line on both sides, with a 1-voxel fringe of the second tone; the horse's has a saddle-pad shape, the cow's is square.
- **Scarf**: as the worn scarf but in the species' knit tones; if the character's worn item is also a scarf, the lives scarf is omitted and the worn scarf stays.
- **Leg warmers**: the bottom 4 voxels of each leg (above the hoof) in the knit tones, ribbed.
- **Losing a layer** uses the sheep's gust: the layer blows away toward `gustFrom` as the wool tuft does, over 600 ms, then the next level shows. **Freezing** uses `frostOf(coat)` on whatever is worn, then the ice block as today.
- Knit tones per species (two each; chosen to sit with the barn palette, saturation under 60%): pig teal #3F7F84 / cream #F3EAD6; goat mustard #C9A24A / grey #7F7973; chicken red #C24E45 / cream; cow lavender #8E7CC3 / cream; horse forest #3E6B4E / cream. These are the defaults; the shop can recolour them later.

### 4.10 Materials and colour

- Three tones per material, as V3 Part 4.3: light, base, dark. Bodies take `[lighten(body, 8%), body, shade]` from the catalogue; faces, manes and noses the same way from their colours. Darkest allowed #1C1919; no pure black anywhere (eyes, hooves, nostrils included).
- Saturation: bodies at most 55%, garments at most 70%, measured in HSL.
- No per-voxel noise on smooth animals; variation comes from the light, the baked AO and the markings. The goat's belly fringe and the chicken's tail are shape, not noise.
- Lambert with vertex colours, as everything else; eyes are not emissive.

### 4.11 Motion per species

All species inherit the sheep's state machine. The table gives the species-specific flavour the component calls per state; everything else is the sheep's behaviour (breathing ±2.5%, blink, ear twitch, gust, freeze, thaw).

| State | Pig | Cow | Horse | Goat | Chicken |
|---|---|---|---|---|---|
| idle | snout sniff (snout scales 1.08, 2 × per 6 s), ears flop with the breath | chew (jaw 4 frames) every 8 s, tail swish, ear flick | tail swish every 4 s, head toss every 9 s | head tilt 0.15 rad every 7 s, beard wag | head bob forward 0.03 m per second, comb wobble |
| proud | chest up, snout up | chin up, slow blink | neck arched higher, ears forward | head high, one hoof forward | chest out, wings half open |
| happy | hop × 2, tail curl spins | hop × 1, bell ring | rear slightly (front hooves 0.1 m up), mane shake | hop × 2 with a twist | wing flap × 3, hop |
| startled | jump, ears straight up, mouth `o` | jump, ears back | jump, ears back, tail up | jump sideways, ears back | feathers puff (body scale 1.1), wings out |
| cold | hunch, shiver, breath puffs | hunch, shiver, breath puffs | hunch, shiver, breath puffs | hunch, shiver, breath puffs | puff up, shiver, breath puffs |
| grazing | rooting: head down, snout pushes forward 3 × | head down, chew | head down, nibble, one hoof paws | head down, nibble, beard swings | peck × 3 at the ground |
| thinking | head tilt, one ear up | head tilt, ear flick | ear turns toward the speaker | head tilt, horizontal pupils widen (iris scale 1.2) | head tilt, one eye to the camera |
| sleeping | eyes closed, slow breathing, ears down | same | head lowered | same | head tucked 0.03 m into the body |

### 4.12 Budgets

| Measure | Per animal (level 2, before culling) |
|---|---|
| Voxels | at most 3,200 (the current horse is 2,901; the sheep about 2,400) |
| Triangles after meshing | at most 10,000 |
| Distinct colours | at most 14 |
| Parts | at most 24 |
| Build time | under 25 ms on desktop, memoised per character |
| Seven animals at the table | under 70,000 triangles together |

### 4.13 Tests (`src/skin/voxel/__tests__/animals.test.ts`, one block per species)

1. **Connectivity**: the assembled level-2 model (every part placed at its pivot) is one 6-connected solid; the same for levels 0, 1, 3 and 4.
2. **Symmetry**: eyes, ears and legs are mirror images about the centre plane within one voxel.
3. **Eye standard**: exactly two eye parts; each has 12 or 14 white voxels (5 × 5 or 4 × 4 variant), an iris of 8 (goat 5, chicken 3) and one catchlight; the catchlight is on the same side for both eyes.
4. **Palette**: at most three tones per material group, at most 14 colours in the model, no colour darker than #1C1919, body saturation at most 55%.
5. **Budgets**: 4.12, with the numbers printed.
6. **Collar**: the collar ring is one voxel thick and its lowest voxel is above the chest line (above 70% of body height).
7. **Signature**: the species' listed features exist with at least their minimum voxel counts (sheets).
8. **Levels**: for non-sheep species each level's garment set is the one in 4.9 (sweater or blanket present at 2, 3, 4; scarf at 1, 3, 4; leg warmers at 4 only); the body is identical at every level.
9. **States**: building the model and stepping `Animal.tsx` through every `SheepState` for every species throws nothing (a smoke test with the existing test renderer).
10. **Catalogue**: every `Character` in `catalog.ts` builds, and the worn item maps to a part or to nothing, never to an error.

---

## 5. Pig (the template animal; built first)

**Silhouette in a sentence**: a smooth, low, slightly oval barrel on four short legs, a wide head sitting right on the front of the body with a round snout disc, two floppy triangular ears that fall forward over the brow, and a curly tail.

| Part | Size (m, voxels) | Position and notes |
|---|---|---|
| Body | ellipsoid radii x 0.30 (7.5), y 0.29 (7), z 0.40 (10): 0.60 wide × 0.58 tall × 0.80 long | centre at y 0.48; a lighter belly mask (ellipsoid radii 0.22, 0.16, 0.30 at y 0.36) in the light tone |
| Shoulder bulge | ellipsoid 0.34 × 0.26 × 0.26 | at the body front, where the head sits |
| Head | box 0.52 wide (13) × 0.48 tall (12) × 0.36 deep (9), chamfer 2 | front face 0.08 ahead of the body; centre at y 0.56, pitched down 8°; the back third sinks into the shoulder bulge |
| Eyes | two 5 × 5 blocks (4.3) | on the front face, rows 3 to 7 of 12 from the top, one voxel in from each edge, three between (13 = 1 + 5 + 1 + 5 + 1) |
| Snout | a chamfered disc 0.24 wide (6) × 0.16 tall (4) × 0.08 deep (2) | centred under the eyes at rows 8 to 11, standing 2 voxels proud; two nostril voxels (dark tone) at row 9; the snout is the darker `nose` tone |
| Mouth | 5-voxel line at row 12 (the bottom row of the face) | `smile` curves up at the ends by one voxel; `o` is a 3 × 2 opening |
| Cheeks | two 3 × 2 patches in `T.pink[1]` | under the outer edge of each eye |
| Ears | two triangles 0.16 wide (4) at the base tapering to 1 voxel over 0.16 tall (4), 1 voxel thick | rooted at the top corners of the head, tilted 35° forward so the tips hang over the brow; pink inner face; they flop with the breath (rotation ±6° at the root) |
| Legs | four, 3 × 3 × 5 (0.12 × 0.12 × 0.20) | hooves the bottom 2 voxels in the hoof tone with the front groove |
| Tail | `helix` radius 0.03, pitch 0.02, 1.5 turns, 2 voxels thick | at the rump centre, pointing up and back; spins on happy |
| Signature (3) | snout disc, floppy ears, curly tail | nothing else |

- **Palette**: body tones from the character (`#f5b5c0` → light #FBC9D2, base #F5B5C0, dark #E393A2 for Truffle); nose tone from `nose`; hooves #5C4A4A / #4A3A3A / #3A2E2E. No mud spots, no stripes.
- **Warmth layers**: sweater (teal/cream) from behind the shoulders to the hips; scarf; leg warmers. The sweater's hem ribbing is one voxel.
- **Height**: 0.20 legs + 0.58 body, head top at about 0.80, ear tips 0.92; length 0.90 with the head. Drawn at scale 1.0 at the table.
- **Minimum counts for test 7**: snout ≥ 40 voxels; each ear ≥ 10; tail ≥ 12.
- **No-list**: no wool lobes; no hat as part of the model (hats are worn items); no vertical head; eyes never on the sides.

---

## 6. Cow

**Silhouette**: a long, boxy barrel with a square rump, a horizontal wedge head carried low on a short thick neck, a broad pink muzzle, sideways leaf ears, two small horn nubs, a bell under the chin, and a tufted tail.

| Part | Size (m, voxels) | Position and notes |
|---|---|---|
| Body | box 0.60 wide (15) × 0.58 tall (14.5 → 15) × 0.92 long (23), chamfer 3, the ends rounded by ellipsoids of the same section | centre at y 0.58; a square rump (chamfer 2 at the back), a rounder chest |
| Neck | `taperedBox` 0.30 long from the chest at 20° down, section 0.26 → 0.22 | the head hangs below the back line, as a cow's does |
| Head | wedge: box 0.44 long (11) × 0.40 wide (10) × 0.36 tall (9) narrowing to 0.32 wide at the muzzle, chamfer 2 | centre at y 0.62, pitched down 12° |
| Muzzle | rounded block 0.32 wide (8) × 0.16 tall (4) × 0.12 deep (3), chamfer 1, `nose` tone | the front of the head, lower half; two nostril pits (2 voxels each) in the dark nose tone; a 7-voxel mouth line under it |
| Eyes | two 5 × 5 blocks on the side faces at the front third, wrapping two voxels onto the front face | rows 3 to 7 of 9 |
| Ears | leaf shapes 0.18 long (4.5 → 5) × 0.10 wide × 1 thick, rounded tips | pointing sideways and slightly down from the head's top corners; pink inner face |
| Horns | two nubs 0.08 tall (2) × 2 × 2, curving one voxel outward, in `T.hoof` light tone | between the ears |
| Forelock | 3 voxels of the body light tone | between the horns |
| Legs | four, 4 × 4 × 7 (0.16 × 0.16 × 0.28) | hooves 2 voxels, knee notch |
| Tail | `line` 0.30 long falling from the rump with a 3 × 3 × 3 tuft in the `mane` colour | swishes ±20° |
| Collar and bell | 1-voxel band at the neck base, bell 3 × 3 × 3 brass under the chin | the cow's bell is its third signature; it rings on happy |
| Signature (3) | muzzle, patches, bell | — |

- **Markings**: three masks in the `accent` colour (dark for Clover's Holstein, brown for a Jersey character): a shoulder patch (union of two ellipsoids, 0.30 × 0.22 × 0.26, over the left shoulder), a hip patch (0.26 × 0.24 × 0.28, right hip) and a saddle patch (0.34 × 0.10 × 0.20 on the back, offset to the right). Edges take the body's mid tone for one voxel. No random voxels.
- **Palette**: body from the character (`#f6f1e8` for Mae: light #FBF7F0, base #F6F1E8, dark #E8E2D6); muzzle `nose` pink; hooves as the pig.
- **Warmth layers**: blanket (lavender/cream) with fringe; scarf; leg warmers.
- **Height**: 0.28 legs + 0.58 body = 0.86 at the back; horns to about 0.98; length 1.00.
- **Minimum counts**: muzzle ≥ 60 voxels; three patch masks ≥ 60 each; bell ≥ 20.
- **No-list**: no wool; no tower head; no planks for ears; no udder (keep it simple and cute).

---

## 7. Horse

**Silhouette**: the tallest animal; a smooth barrel, an arched neck rising from the shoulders with a mane along it, a long wedge head with a blaze, small upright ears, long legs with socks, and a long tail.

| Part | Size (m, voxels) | Position and notes |
|---|---|---|
| Body | ellipsoid-blended box 0.52 wide (13) × 0.56 tall (14) × 0.96 long (24), chamfer 3 | centre at y 0.64 |
| Neck | `taperedBox` 0.36 long rising at 50° from the shoulders, section 0.28 → 0.22, chamfer 2 | the arch is the horse's silhouette; the head sits at its top, level |
| Mane | a ridge 2 voxels wide × 2 tall along the neck's top from the withers to the ears, plus a forelock of 3 × 2 × 2 between the ears, in the `mane` colour | the ridge follows the neck's curve |
| Head | wedge: 0.48 long (12) × 0.28 wide (7) × 0.32 tall (8), narrowing to 0.20 wide at the muzzle, chamfer 2 | level, muzzle forward |
| Blaze | a 2-voxel-wide stripe of the light body tone from the forelock to the muzzle | straight down the face's centre |
| Muzzle | the front 3 voxels of the wedge in the `nose` tone; two nostril pits; a mouth line | — |
| Eyes | two 5 × 5 blocks on the side faces at the front third, wrapping two voxels | rows 2 to 6 of 8 |
| Ears | two triangles 3 wide × 4 tall × 1, upright, slightly turned out | pink inner face |
| Legs | four, 3 × 3 × 9 (0.12 × 0.12 × 0.36) | socks: the bottom 3 voxels above the hoof in the light tone on two diagonal legs (front-left, back-right); hooves 2 voxels |
| Tail | a `line` of 2-voxel thickness 0.32 long from the rump, in the `mane` colour, with a 3-voxel flare at the end | swishes ±25° |
| Signature (3) | arched neck with mane, blaze, socks | — |

- **Palette**: body from the character (`#b8793d` Sable: light #C78A50, base #B8793D, dark #8F5C2C; `#3f3a46` Sunny is a dark horse, floor the dark tone at #1C1919); mane and tail from `mane`.
- **Warmth layers**: a saddle-pad blanket (forest/cream) from the withers to the hips; scarf; leg warmers (which replace the socks' tone on all four legs at level 4).
- **Height**: 0.36 legs + 0.56 body = 0.92 at the back; ear tips at about 1.18; length 1.00. The tallest allowed.
- **Minimum counts**: mane ≥ 40 voxels; blaze ≥ 10; two socks ≥ 12 each.
- **No-list**: no wool lobes; no detached ears; no single white slab for the mane; the head never higher than the ear-tip limit.

---

## 8. Goat

**Silhouette**: a compact barrel with a shaggy belly fringe, a wedge head with a Roman nose and a beard, two horns sweeping back and out, long droopy ears, a short upturned tail, and horizontal pupils.

| Part | Size (m, voxels) | Position and notes |
|---|---|---|
| Body | ellipsoid-blended box 0.50 wide (12.5 → 13) × 0.50 tall (12) × 0.76 long (19), chamfer 2, noise 0.03 | centre at y 0.58 |
| Belly fringe | a row of 2-voxel drops every 2 voxels along both belly lines, in the dark body tone | the goat's long hair, as shape |
| Neck | `taperedBox` 0.24 long at 35° up, section 0.22 → 0.20 | the head is carried high |
| Head | wedge 0.40 long (10) × 0.28 wide (7) × 0.30 tall (7.5 → 8), narrowing to 0.18 at the muzzle; a Roman bump: the top line rises one voxel at the front third | level |
| Beard | 3 wide × 4 long × 2 deep under the chin, dark tone | wags on idle |
| Horns | two `line` paths of 6 segments each, 2 voxels thick, 0.24 long, rising from the crown then curving back and out 30°, in the horn tones #6B5D50 / #5A4D42 / #473C33 | tips never higher than 0.14 above the crown |
| Eyes | two 5 × 5 blocks on the side faces at the front third, wrapping two voxels; **iris 3 wide × 2 tall** (the horizontal pupil) | rows 2 to 6 of 8 |
| Ears | two flaps 0.18 long (4.5 → 5) × 0.08 wide × 1 thick, drooping 30° below horizontal | pink inner face |
| Legs | four, 3 × 3 × 7 (0.12 × 0.12 × 0.28) | hooves 2 voxels |
| Tail | a stub 2 × 2 × 3 pointing up and back | flicks on happy |
| Signature (3) | horns, beard, horizontal pupils | — |

- **Palette**: body from the character (`#cfc6b8` Gizmo: light #DAD2C6, base #CFC6B8, dark #9E9893); beard and fringe the dark tone; horns as above.
- **Warmth layers**: sweater (mustard/grey); scarf; leg warmers.
- **Height**: 0.28 + 0.50 = 0.78 at the back; head top about 0.96 with the neck up; horn tips 1.06; length 0.92.
- **Minimum counts**: each horn ≥ 14 voxels; beard ≥ 18; fringe ≥ 24.
- **No-list**: no antennae horns; no candy-striped collar or legs; no vertical head.

---

## 9. Chicken (if kept; decision 13.1)

**Silhouette**: an egg on two thin legs, a small ball head on a short neck, a tiny horizontal beak, a three-bump comb, a wattle, two flat wings against the flanks, and a fan tail rising at the back.

| Part | Size (m, voxels) | Position and notes |
|---|---|---|
| Body | ellipsoid radii x 0.22 (5.5 → 6), y 0.24 (6), z 0.28 (7), tilted 15° tail-up | centre at y 0.42 |
| Wings | two flat ellipsoids 0.24 long × 0.16 tall × 0.06 thick on the flanks, in the dark body tone with a 1-voxel light edge | tips out 10°; flap on happy and startled |
| Tail | a fan of 5 flat slabs 0.20 tall × 0.04 wide × 0.02 thick rising at 45° and spreading 15° apart, in the dark tone | — |
| Neck | a cylinder-like box 0.10 wide × 0.10 tall | from the body's front top |
| Head | a ball of radius 0.16 (4): 8 voxels across | centre at y 0.72 |
| Beak | `taperedBox` 0.10 long × 0.08 wide × 0.06 tall, horizontal, tone #E8A43A / #D4922E / #B87A22 | at the head's front, lower half |
| Comb | three 2 × 2 × 2 bumps along the crown in #C24E45 / #B5443C / #9C3A33 | — |
| Wattle | one 2 × 3 × 1 drop under the beak, comb tones | — |
| Eyes | two 4 × 4 blocks on the head's sides at the front, wrapping one voxel | centred at 55% of head height |
| Legs | two, 2 × 2 × 6 (0.08 × 0.08 × 0.24), beak tones; three toes 1 × 3 forward and one 1 × 2 back | — |
| Signature (3) | comb with wattle, tail fan, beak | — |

- **Palette**: body light #FBF8F1 / base #F7F3EA / dark #D2C9B7 (a white hen); a character may be brown or black-laced later.
- **Warmth layers**: a knitted vest (the sweater shape on the egg, red/cream); scarf; leg warmers as the bottom 3 voxels of each leg.
- **Height**: 0.24 legs + body to 0.66, head top 0.88, comb 0.94; drawn at scale 1.15 at the table so it keeps presence beside the others.
- **Minimum counts**: comb ≥ 18 voxels; tail fan 5 slabs; each wing ≥ 24.
- **No-list**: no wool; no collar ring (the chicken gets a scarf as its worn-style collar); no beak as a vertical plank.

---

## 10. The sheep (Milestone A5, optional)

The sheep keeps its model. If Brian approves A5, the only change is the eye standard (4.3): two 5 × 5 eye blocks on the front face of the wedge head at 58% height, replacing the current eyes, with the lids and brows rebuilt to the same sizes; the dark face, the hood, the wool levels and the freeze stay exactly as they are. Everything else about the sheep is out of scope.

---

## 11. The viewer and acceptance

### 11.1 Per milestone

Screenshots from the species viewer at its default camera (A0 records it) and from the table's speaker camera (`speakerShot` in `layout.ts`) at 400 px tall: idle, happy, cold, level 0, level 4, frozen, for each species built in the milestone. Attach them with the report.

### 11.2 The line-up (A4)

- A single image of all six species side by side at the viewer camera, 400 px each, in idle at level 2.
- The same six as black silhouettes at 64 px tall. Acceptance: two people who have not seen the game name every species from the silhouettes alone; if one species is missed by both, its silhouette is changed before A4 closes.
- The squint test: the 400 px line-up blurred with a 6 px Gaussian; every species still identifiable from its colour blocks and shape.

### 11.3 Tests

All of 4.13 passing for every species, and the voxel, triangle and colour counts printed in the report.

---

## 12. Milestones and prompts

| Session | Milestone | Scope | Prompt |
|---|---|---|---|
| 1 | A0 | discovery | the Part 0 prompt |
| 2 | A1 | `AnimalModel`, `Animal.tsx`, the eye builder, `frostOf`, the pig (Part 5), tests 1 to 9 for the pig | "Read Parts 4, 5 and 11 of @docs/REDESIGN_PLAN_V5_ANIMALS.md and @docs/skin/ANIMALS_DISCOVERY.md. Do Milestone A1 exactly as specified. Attach the Part 11.1 screenshots for the pig and report the test output." |
| 3 | A2 | cow (Part 6) and horse (Part 7) | "Read Parts 4, 6, 7 and 11. Do Milestone A2. Attach screenshots for both and the test output." |
| 4 | A3 | goat (Part 8) and chicken (Part 9) if kept | "Read Parts 4, 8, 9 and 11. Do Milestone A3. Attach screenshots and the test output." |
| 5 | A4 | warmth layers for all (4.9), worn items (4.8), test 10, the line-up (11.2) | "Read Parts 4.8, 4.9, 4.13 and 11.2. Do Milestone A4. Attach the line-up, the silhouette strip and the squint image, and the two people's answers." |
| 6 | A5 | the sheep's eyes | only when Brian says so |

After every milestone: `npm run build`, `npm test`, and the e2e suite in the classic build, as CLAUDE.md requires.

---

## 13. Decisions (change any before starting)

| # | Decision | Alternative |
|---|---|---|
| 13.1 | The chicken is kept as a sixth species and added to the catalogue with three characters (names to come from Brian) | drop the chicken (it is not in the catalogue today) |
| 13.2 | Lives on non-sheep species are knitwear layers, never the head | natural winter coats (fluffier animals); harder to read at the table |
| 13.3 | Level 2 is a sweater or blanket, level 1 a scarf alone | level 1 as a thinner sweater |
| 13.4 | The horse is the tallest at 1.18 m; the chicken is drawn at 1.15 × | one height for all (less distinct) |
| 13.5 | The goat has horizontal pupils | round irises like the others |
| 13.6 | The cow has no udder | add a small one |
| 13.7 | Worn items are head and neck only; `stripe` is a marking | allow body items (conflicts with the warmth layers) |
| 13.8 | The sheep is unchanged (A5 optional) | apply the eye standard to the sheep now, for consistency |
| 13.9 | Markings use the catalogue's `accent` colour; patch shapes are fixed per species, not per character | per-character patch layouts (more work, little gain) |
| 13.10 | Budget 3,200 voxels per animal | 4,000 (more detail, slower table) |

---

## 14. In one paragraph

Each farm animal becomes its own model on the shared sheep rig: a smooth body shaped for the species, a horizontal head with two big low-set eyes that have an iris and a catchlight, at most three signature features that are attached and built to scale, shaped markings instead of noise, thin collars, and the farmer's knitwear standing in for the sheep's wool as lives, so the pig, cow, horse, goat and chicken are told apart from their silhouettes at 64 pixels, stay cute at the table's camera, keep every animation state, and sit in the winter-farm palette with the sheep.
