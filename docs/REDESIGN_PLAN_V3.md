# Finish the Word: winter barn v3 for Claude Code (lives, freezing, high-detail voxels)

Version 3.0, 3 November 2026. Supersedes `docs/REDESIGN_PLAN_V2.md` in full. Parts 1 to 4 of `docs/REDESIGN_PLAN.md` (v1 guardrails, discovery, game reference, view model and event contracts) still apply, with the one exception stated in Part 1 below: the lives rule is an approved engine change. The v2 reference page (`docs/skin/reference/winter-barn-reference.html`) may still be opened for the barn layout and seating, but its voxel grid is coarse; the grids, detail and character in this file override it.

---

## 0. For Brian

1. Save this file as `docs/REDESIGN_PLAN_V3.md` and commit it. Replace the v2 block in `CLAUDE.md` with the v3 block in Part 1.
2. Milestone 0 is the only engine change (lives). Run it first, review the diff and the tests, then the visual milestones one per session:

   ```
   Read @docs/REDESIGN_PLAN.md (Parts 1 to 4 only), @docs/REDESIGN_PLAN_V3.md and @docs/skin/DISCOVERY.md. Do Milestone 0 of V3 exactly as specified: the lives rule and its tests, nothing else. Report file by file.
   ```

3. Defaults for every open decision are in Part 12; change them there before Milestone 3 if you disagree.

---

## 1. Guardrails (replace the v2 block in CLAUDE.md)

```markdown
## Winter barn v3: lives, freezing, high-detail voxels
- The visual and rules target is docs/REDESIGN_PLAN_V3.md. The v1 hard rules still apply, with ONE exception:
  the lives rule in V3 Part 2 is an approved engine change. Implement it in its own commit, in the engine
  files DISCOVERY.md names, with the tests V3 Part 2.5 lists, and change nothing else in the engine.
- Every 3D object is built from axis-aligned voxels on one of the grid sizes in V3 Part 4. Characters use
  0.04 m voxels. No spheres, capsules, cylinders, extruded or imported smooth meshes except the sky dome,
  the aurora plane, snow and particle points, and line edges on ice.
- Voxel objects are rendered as face-culled merged meshes with per-vertex colour and ambient occlusion
  (V3 Part 8), not as one InstancedMesh per voxel. Instancing is for particles only.
- Materials: MeshLambertMaterial with vertexColors for all voxels. No MeshStandard/Physical, no env maps,
  no bloom, no depth of field. Ice may use a transparent Phong.
- One default sheep model for every player; customisation slots are reserved, not built.
- Approved dependencies: three, @react-three/fiber (@react-three/drei only if already installed). Ask before adding anything else.
- No studio, film or director names anywhere.
```

---

## 2. The lives rule (approved engine change)

### 2.1 Rule text (what the player is told)
- Every sheep starts a game with 3 lives, shown as three small flames on its card.
- If your turn runs out without a word or a bank, you lose 5 wool (the existing penalty) and one flame goes out.
- When your last flame goes out, the cold gets in: you are frozen for the rest of the game.
- A frozen sheep keeps its wool but cannot play, bank or steal, its turns are skipped, and it finishes behind every sheep that is not frozen.
- Losing a turn to a steal, or a failed steal, does not cost a life. Practice has no penalties and no lives.

### 2.2 Exact behaviour
| Situation | Lives | Other effects (unchanged rules) |
|---|---|---|
| Turn clock reaches 0 with no play and no bank | −1 | −5 points; trapper +5 if a trap was set |
| Victim of a successful steal | 0 | loses the turn (existing) |
| Failed steal | 0 | banked halved (existing) |
| Lives reach 0 | player.frozen = true | from now on the scheduler skips this player's turns; steal attempts by this player are rejected; a frozen player can still be the "previous word" source for the chain |
| Round twist "double points, 2 seconds shorter" | no change | |
| Practice mode | lives never decrease | no penalties at all (existing) |
| Tutorial | lives shown, never lost | scripted game unchanged |
| Daily Table and Quick Game | lives apply | streak unchanged |
| Game end ranking | unfrozen players first by banked points, then frozen players by banked points; existing tie-breaks apply within each group | |
| Game end | all players thaw: lives reset to 3, frozen false at the next game start | |
| Early end | none: the game still runs its 3 rounds even if every bot is frozen; if the human is frozen, the remaining turns play out at bot speed with the usual timers | |

Constants: `LIVES_PER_GAME = 3`, `TIMEOUT_PENALTY = 5` (existing). Both live in one constants file so they can be tuned without touching logic.

### 2.3 State additions (engine)
```ts
// on each player's state
lives: number;        // 3 at game start
frozen: boolean;      // false at game start
```

### 2.4 Events the engine must emit (or the skin derives, as v1 Part 4.2)
```ts
| { type: 'lifeLost'; playerId: string; livesLeft: number }
| { type: 'frozen'; playerId: string }
| { type: 'thawed'; playerId: string }   // at game start for players who were frozen last game
```
Add `lives: number` and `frozen: boolean` to `PlayerView` in `src/skin/model/types.ts`.

### 2.5 Tests (new file beside the engine's existing tests)
1. A time-out decrements lives by 1 and applies the existing −5.
2. Three time-outs freeze the player; `frozen` is true and the next turn goes to the following unfrozen player.
3. A steal victim's lives are unchanged. A failed steal leaves lives unchanged.
4. A frozen player's steal attempt is rejected with no score change.
5. Practice mode: time-outs do not change lives.
6. Ranking: a frozen player with 90 banked ranks below an unfrozen player with 10 banked; two frozen players rank by banked points.
7. A new game resets lives to 3 and frozen to false, and emits `thawed` for previously frozen players.
8. All previously existing engine tests still pass unchanged.

### 2.6 Where it goes
Only in the files DISCOVERY.md lists as the turn scheduler, the player state and the results ranking, plus the constants file and the new test file. If the scheduler cannot skip a player without a larger refactor, stop and report the smallest change that would.

---

## 3. Theme map (rules → visuals)

| Rule | What the player sees |
|---|---|
| Valid word | A wool tuft flies from the speaker to the heap in the barn's centre; the heap grows |
| Bank | The heap flies onto the banker's back; the coat thickens one level |
| Steal window (last 3 s) | The icicle over the speaker turns red; two yellow eyes open in the dark side door; STEAL appears |
| Successful steal | The wolf runs in, takes the heap to the stealer; the victim is startled, dimmed for the turn |
| Failed steal | Shears come down on the stealer; half the coat comes off in tufts; the sheep shivers for 3 s |
| Time out (−5, −1 life) | A gust of cold air sweeps in through the door, blows a tuft off the sheep's back and out of the door, and snuffs one flame on the card with a puff. The sheep hunches and shivers for 2 s |
| Last life lost | The freeze sequence (Part 6): the cold air circles the sheep and freezes it mid-motion in a block of ice |
| Frozen player | Stays in its seat inside the block for the rest of the game, skipped by the icicle; the card is iced over with its flames out |
| Trap letters X Z Q J | The next starting letter is carved in an ice block |
| Round twist | A snow-capped wooden sign lowers from the beam; "double points, 2 seconds shorter" brings a blizzard outside |
| Game end | Winner gets a knitted scarf and the spot by the lantern; frozen sheep thaw with a crack and a shake at the next game |

---

## 4. Art rules

### 4.1 Grid sizes (finer than v2 so nothing reads as blocky)
| Object class | Voxel | Scale examples |
|---|---|---|
| Characters (sheep, wolf, sheepdog), wool heap, shears, bell | 0.04 m | a sheep is about 30 voxels long, 22 tall; eyes are 2 to 3 voxels across |
| Barn interior, props, lanterns, hay | 0.10 m | a plank is 2 voxels thick with 1-voxel gaps; nail heads are single voxels |
| Yard, fences, trees, farmhouse, cart, pond | 0.20 m | a fence rail is 1 voxel thick; a pine branch is 1 voxel thick |
| Hills, village | 1.0 m | |
| Mountains | 3.0 m | |

The test for "not blocky": any curved silhouette (wool, hills, the heap, the pond edge) must cross at least 8 voxel steps; a straight edge (plank, beam, rail) is allowed to be a clean block edge. Rounded forms are made by voxelizing ellipsoids at these grids, not by smoothing.

### 4.2 Light and material
- One `MeshLambertMaterial({ vertexColors: true })` per static group; the colour and the ambient occlusion are baked into vertex colours by the mesher (Part 8).
- One hemisphere light, one directional sun (4096 shadow map on desktop, 2048 on phones, PCFSoft, bias −0.0004, normal bias 0.02), two lantern point lights.
- Fog (hour colour, 30 to 210 m). sRGB output, no tone mapping, pixel ratio capped at 1.5.
- Shadows plus vertex AO are what give the fine voxels their depth; without AO the detail disappears, so AO is not optional.

### 4.3 Colour (three tones per material now: light, mid, dark, chosen by seeded noise and by face direction)
| Material | Light | Mid | Dark |
|---|---|---|---|
| Wool | #FAF6EC | #F0E9D8 | #DDD3BE |
| Sheep face and legs | #4A4444 | #3F3A3A | #2E2929 |
| Nose, inner ear, blush | #F6C6C0 | #F2B6B0 | #D99B95 |
| Barn boards | #B5503F | #A6453A | #8E3A31 |
| Beam wood | #9A6B47 | #8B5E3C | #6F4A2E |
| Hay | #E6C46A | #D9B45C | #C59E45 |
| Snow | #FFFFFF | #F7F9FC | #DCE6F2 (path #CFD9E6) |
| Ice | #D9EEF8 | #BFE3F5 | #9ED2EE |
| Pine | #3A6E4A | #2F5E3E | #27503A (trunk #5A3C25) |
| Stone | #9A9DA6 | #8C8F99 | #737682 |
| Wolf | #7E7B85 | #6E6B75 | #4E4B55 (eyes #FFE066) |
| Lantern glow | #FFD56E | #FFC24B | #E8A92F |
| Farmhouse | #D2C4AE | #C7B8A1 | #B5A58C (roof #6B4F3A, shingles #7C5D45) |
| Frost tint (multiplied over a frozen sheep) | #CFE3F5 | | |
No pure black anywhere.

### 4.4 Time of day
As v2 (dawn, day, dusk, night values), crossfade 1.8 s, always winter, hour from the device clock. Night adds stars and aurora; dusk adds a faint aurora.

### 4.5 Camera
Fixed. Desktop: fov 44, position (0, 5.0, −10.2) looking at (0, 0.9, 2.0). Phone: fov 58, position (0, 5.6, −11.2) looking at (0, 1.0, 2.0). The "you" sheep sits at the far side, framed by the open back doors.

---

## 5. The default sheep at 0.04 m (one model for everyone)

All measurements in metres; the mesher voxelizes each primitive at 0.04 m. Origin between the hooves; +z is the front. Target: 9,000 to 14,000 voxels before face culling. Each row is a separate part (its own mesh) unless marked "wool".

### 5.1 Parts
| Part | Construction | Colour |
|---|---|---|
| Wool core (wool) | ellipsoid centre (0, 0.64, 0), radii (0.42, 0.37, 0.55), surface noise 0.12 | wool three-tone, 60/30/10 |
| Wool puffs (wool) | 22 ellipsoids radii (0.17, 0.15, 0.17), noise 0.1, centred on the core surface at seeded angles (as v2's formula, scaled) | wool |
| Wool curls (wool) | 60 helices on the surface: radius 0.03, pitch 0.02, 1.5 turns, 1 voxel thick, axis along the local surface normal | wool light and mid |
| Forehead tuft (wool) | ellipsoid (0, 0.98, 0.54), radii (0.22, 0.13, 0.20), with 6 curls | wool |
| Tail (wool) | ellipsoid (0, 0.70, −0.60), radii (0.15, 0.14, 0.14), with 3 curls | wool |
| Head | box x −0.14..0.14, y 0.62..0.90, z 0.50..0.80 with 2-voxel chamfers on all edges; a 1-voxel brow ridge at y 0.84 | face |
| Eyelids and brows | eyelid: 1-voxel row above each eye; brows: two 5-voxel bars at y 0.86, angle set by state (neutral, worried, scared) | face dark |
| Eyes | whites: ellipsoid radii (0.05, 0.045, 0.02) at (±0.085, 0.76, 0.80); iris: 3-voxel disc; pupil: 2-voxel disc; catchlight: 1 voxel at the upper-left | white, #3B2E2A, pupil #1E1B1B |
| Nose | ellipsoid (0, 0.68, 0.81), radii (0.05, 0.035, 0.03); two nostril voxels | pink |
| Mouth | 5-voxel line at y 0.64; states: flat, smile (ends up 1 voxel), grimace (zigzag 7 voxels, 2 teeth voxels) | face dark; teeth white |
| Cheeks | two 3×3 patches at (±0.11, 0.70, 0.78) | blush |
| Ears | two tapered boxes 0.14 long, 0.08 wide, 0.04 thick at (±0.19, 0.80, 0.56), angled down 25°, inner face pink; ear flick rotates them 15° | face, pink |
| Legs | four columns 0.08 × 0.08: y 0.04..0.32 at x ±0.19, z −0.30 and 0.34; knee notch 1 voxel at y 0.18 | face |
| Hooves | 0.10 × 0.06 × 0.10 at the base, split by a 1-voxel groove | hoof dark |
| Collar | torus of 1.5 voxel thickness around the neck ellipse (centre (0, 0.56, 0.42), radii 0.30 × 0.19), with a 3-voxel buckle | #B5443C, buckle #E7B64A |
| Bell | ellipsoid radii (0.05, 0.05, 0.05) at (0, 0.42, 0.62), clapper 1 voxel, slit 2 voxels | #E7B64A |
| Sheared body | ellipsoid (0, 0.60, 0), radii (0.26, 0.25, 0.42) with 8% stubble voxels; visible only at wool level 0 | skin |
| Breath puff | 6-voxel cluster at (0, 0.72, 0.86), animated | white, transparent |

### 5.2 Wool levels (banked points)
| Level | Points | Wool scale | Notes |
|---|---|---|---|
| 0 bare | 0 | hidden | sheared body, collar off |
| 1 thin | 1 to 14 | 0.80 | |
| 2 normal | 15 to 39 | 1.00 | |
| 3 fluffy | 40 to 79 | 1.15 | |
| 4 enormous | 80+ | 1.30 | head, eyes, nose and collar lift by (scale − 1) × 0.28 |

### 5.3 States
| State | Trigger | Motion and face |
|---|---|---|
| idle | default | breathing ±2%, head nod 0.04 rad, blink every 4.2 s (120 ms), ear flick every 9 s, brows neutral, mouth flat |
| proud | accepted, 8+ letters (1.2 s) | head up 0.25 rad, bell swing, mouth smile |
| happy | banked (1.6 s) | hop decaying, mouth smile, brows up |
| startled | victim of a steal (0.6 s) | jump 0.25 m, wool +18%, eyes ×1.4, brows scared, mouth grimace |
| cold | failed steal (3 s), time out (2 s) | hunch (body down 0.05 m), shiver x ±1.5 cm, breath puffs, brows worried |
| freezing | last life lost (2.4 s) | the sequence in Part 6 |
| frozen | after the sequence, until thaw | static inside the block; eyes wide, mouth grimace; frost tint on all parts |
| thawing | next game start (1.2 s) | block cracks and falls away in 6 pieces, sheep shakes (rotation.z ±0.1 rad at 20 rad/s), frost tint fades |
| sleeping | Daily played, Practice idle | eyes closed, slow breathing |

### 5.4 Customisation hooks (reserved)
`woolColour`, `facePattern`, `collar`, `hat`, `scarf`, `bell` as string ids with the default now; no UI, no store.

---

## 6. The freeze sequence (last life lost)

Modelled on the classic cartoon of a figure frozen mid-stride in a slab of ice with icicles on top and wind curls around it. Total 2.4 s; all timings from the `frozen` event.

| Time | What happens |
|---|---|
| 0.0 s | The lantern flames dim to 40%; the card's last flame puffs out. A low wind sound later, not now. |
| 0.0 to 0.8 s | A gust of cold air enters through the back doors: 40 thin voxel streaks (1 × 1 × 6 voxels at 0.04 m, ice light tone, additive opacity 0.6) travel from the door to the sheep along a sine path; 6 wind curls (voxel spirals, 1 voxel thick, radius 0.25 m) orbit the sheep at 2 rad/s. Snow particles inside the barn for this once: 120 points around the sheep. |
| 0.5 s | The sheep reacts: startled pose, then freezes mid-motion with one front leg lifted 0.12 m and the body leaning 8° back (the "caught running" pose), eyes wide, brows scared, mouth grimace with teeth. From here the sheep does not move. |
| 0.8 to 1.6 s | Frost creeps: the wool, face and legs tint toward the frost colour (material colour multiply from white to #CFE3F5 over 0.8 s); 30 frost voxels (ice light) appear on the wool's upper surface. |
| 1.2 to 2.0 s | The block forms: a box 1.5 × 1.4 × 1.9 m centred on the sheep, tilted 6° about z, scales from 0.2 to 1.0 with cubic ease-out; transparent Phong, ice mid, opacity 0.45, white edge lines. Nine icicles (voxel cones at 0.04 m, lengths 0.08 to 0.22 m) hang from the block's top edge; a snow cap 1-voxel thick (0.04 m grid, uneven edge) sits on top. Two comic cracks (dark blue, 1-voxel lines) appear on the front face at 1.8 s with a scale pop. |
| 2.0 to 2.4 s | The block settles with a 2% bounce; the wind curls fade; the card shows an ice overlay with the wool count still readable. |

While frozen: the icicle timer never stops above this sheep; the wolf ignores it; its seat is otherwise unchanged. Thaw at the next game start (Part 5.3).

Reduced motion: the block appears at 1.2 s with no gust, curls or frost creep; the pose change still happens.

---

## 7. The barn and the farm, with the detail that finer voxels buy

Positions are the same as v2 (seats, doors, lanterns, fence, farmhouse, pines, pond, hills, mountains). What follows is what must be added at the new grids so every layer is as detailed as the sheep.

### 7.1 Barn (0.10 m)
- Planks: individual boards 2 voxels thick with 1-voxel gaps that let slivers of outside light through on the back wall; one knot (3 dark voxels) every 2 to 4 boards; nail heads (1 voxel, stone dark) at the ends of each board.
- Beams: 0.3 m square with 1-voxel chamfered edges; peg joints (2 voxels) where beams meet posts; a hanging rope coil on one post.
- Floor: hay with 300 loose straws (1 × 1 × 4 to 8 voxel sticks at random angles, hay light and dark); a swept bare patch of plank floor around the heap; a trampled ring where the sheep stand.
- Hay bales: twine (2 dark voxels per band, 3 bands), uneven ends, a few straws sticking out, a cat asleep on the top bale (0.04 m voxels, grey tabby, tail hanging over the edge, breathes).
- Lanterns: a cage of 1-voxel wires around the glow box, a top ring, a hook; glow box uses the three lantern tones in vertical bands so it reads as a flame.
- Door: hinges (3 per leaf), a horseshoe above the header, a bolt; the leaves show snow on their outer faces.
- Side door (wolf): a hanging tarp with a torn edge; two eye boxes appear behind it.
- Props: a rake and a pitchfork leaning on the left wall, a bucket, a milk can, a wheelbarrow in the right corner, a feed sack with a 3-voxel patch, a bird (robin, 0.04 m) on a beam that hops every 12 s.
- Snow: drifts against the inside of the doorway (ellipsoid wedges at 0.10 m), and a line of footprints (sheep: two-toe marks) from the door to the seats.

### 7.2 Yard (0.20 m)
- Ground with 0.2 m drifts against the fence and barn; the path shows footprints and two sled tracks.
- Fence: posts with a snow cap each, two rails with nails, a gate with hinges and a latch; a lantern on the gate post.
- Pines: built as layered rows of 1-voxel branches with gaps between rows, snow on the upper face of every branch, a few bare lower branches; trunks with 2-voxel bark ridges.
- Snowman (3 ellipsoids, carrot nose, 2 coal eyes, 3 buttons, a stick arm, a scarf), a sled, a wood pile under a lean-to, a bird feeder, a mailbox at the gate.
- Farmhouse: shingled roof (alternating rows), window mullions, curtains, a warm interior gradient, smoke from the chimney (voxel puffs rising and fading, 0.20 m), a porch with two steps and a railing, a snow-covered bench.
- Water trough with ice, cattails at the pond edge, skate marks on the pond.

### 7.3 Distance (1 m and 3 m)
- Hills with tree lines (1-voxel dots in pine dark), a village of four tiny houses with lit windows, a windmill with four blades that turn once per 40 s.
- Mountains with ridgelines (stone dark along edges) and a glacier tongue (ice tones).
- Sky dome, stars, aurora and the moon (a 1 m voxel disc with three crater voxels) as v2.

### 7.4 Snow and weather
As v2: 1,600 points outside (400 under reduced motion), blizzard during the "double points, 2 seconds shorter" twist. Inside the barn snow appears only during the freeze gust.

### 7.5 Other characters (0.04 m)
- Wolf: lean body, pointed ears with inner tone, a bushy tail with 10 curls, fangs (2 voxels), yellow eyes; runs door → heap → stealer → door with a hop.
- Sheepdog (Tutorial guide): black and white, floppy ears, a red bandana, wags; sits by the door and points with its nose. Not a player.
- Shears, tufts, icicle timer as v2 but at 0.04 m (the icicle is 20 voxels long with a drip voxel that falls every 2 s).

---

## 8. Rendering architecture: the mesher

Per-voxel instancing cannot carry 300,000 voxels on a phone; face culling can. Build each static group once into one `BufferGeometry`:

```ts
// src/skin/voxel/mesher.ts
export type Voxel = { x: number; y: number; z: number; c: [number, number, number] }; // colour as linear RGB 0..1
export type VoxelMap = Map<string, Voxel>; // key "x,y,z"

// For each face: its normal axis and sign, and the two tangent axes used for ambient occlusion.
const FACES: { axis: 0 | 1 | 2; sign: 1 | -1; t1: 0 | 1 | 2; t2: 0 | 1 | 2 }[] = [
  { axis: 0, sign: 1, t1: 1, t2: 2 }, { axis: 0, sign: -1, t1: 1, t2: 2 },
  { axis: 1, sign: 1, t1: 0, t2: 2 }, { axis: 1, sign: -1, t1: 0, t2: 2 },
  { axis: 2, sign: 1, t1: 0, t2: 1 }, { axis: 2, sign: -1, t1: 0, t2: 1 },
];
const FACE_SHADE = (axis: number, sign: number) => axis === 1 ? (sign > 0 ? 1.0 : 0.72) : axis === 0 ? 0.88 : 0.82;

export function buildGeometry(vox: VoxelMap, size: number): THREE.BufferGeometry {
  const has = (p: number[]) => vox.has(`${p[0]},${p[1]},${p[2]}`);
  const pos: number[] = [], col: number[] = [], nor: number[] = [], idx: number[] = [];
  for (const v of vox.values()) {
    const P = [v.x, v.y, v.z];
    for (const f of FACES) {
      const N = [0, 0, 0]; N[f.axis] = f.sign;
      const outside = [P[0] + N[0], P[1] + N[1], P[2] + N[2]];
      if (has(outside)) continue;                       // face culling: never emit a hidden face
      // the four corners of this face, in a consistent winding; each corner has offsets 0/1 on the two tangent axes
      const corners = [[0, 0], [1, 0], [1, 1], [0, 1]];
      if (f.sign < 0) corners.reverse();
      const base = pos.length / 3;
      const aos: number[] = [];
      for (const [u, w] of corners) {
        const c = [0, 0, 0]; c[f.axis] = f.sign > 0 ? 1 : 0; c[f.t1] = u; c[f.t2] = w;
        pos.push((P[0] + c[0]) * size, (P[1] + c[1]) * size, (P[2] + c[2]) * size);
        nor.push(N[0], N[1], N[2]);
        // ambient occlusion (standard voxel AO): the two edge neighbours and the diagonal neighbour around this corner, one layer out
        const d1 = u ? 1 : -1, d2 = w ? 1 : -1;
        const s1 = [...outside]; s1[f.t1] += d1;
        const s2 = [...outside]; s2[f.t2] += d2;
        const cn = [...outside]; cn[f.t1] += d1; cn[f.t2] += d2;
        const a = has(s1) ? 1 : 0, b = has(s2) ? 1 : 0, cc = has(cn) ? 1 : 0;
        const ao = (a && b) ? 3 : a + b + cc;             // 0 open .. 3 fully occluded
        aos.push(ao);
        const k = (1 - 0.18 * ao) * FACE_SHADE(f.axis, f.sign);
        col.push(v.c[0] * k, v.c[1] * k, v.c[2] * k);
      }
      // flip the quad diagonal when needed so AO gradients have no seam
      if (aos[0] + aos[2] > aos[1] + aos[3]) idx.push(base + 1, base + 2, base + 3, base + 1, base + 3, base);
      else idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}
```

Implementation notes for Claude Code:
- Check the winding once in the preview route: if faces render inside-out, swap the `corners.reverse()` condition. Do not switch to `DoubleSide` to hide the problem.
- Greedy meshing is optional; face culling plus chunking is enough for the budget below. If a group exceeds 65,535 vertices, use `Uint32` indices (three.js chooses automatically for `setIndex` with large arrays) or split by chunk.
- Each part that moves (every sheep part, the wolf, the shears) is its own geometry; static groups (barn, yard, hills, mountains) are one geometry each, chunked by 8 m on the yard.
- Colours: pass linear RGB in the colour attribute; convert hex with `new THREE.Color(hex)` (three handles sRGB to linear when `outputColorSpace` is sRGB).
- Per-mesh tinting (frost, dimming) uses `material.color` on a cloned material; the vertex colours stay untouched.
- Budget: under 1.5 M triangles on screen in total (reference: sheep about 40 k each, barn about 300 k, yard about 400 k); frame under 6 ms on a mid-range phone; first render under 3.5 s on 4G. If over budget, reduce yard detail (fewer straws, fewer curls) before anything else.

Folder layout as v2 Part 8 (`src/skin/voxel/`, `src/skin/scene/`, `src/skin/table/`), with `mesher.ts` replacing the instanced `Vox.build`.

---

## 9. Interface over the scene (additions)

- Lives: three small flame icons on each card (lantern tones); a lost life plays a 300 ms puff (scale up, fade, a grey smoke voxel) and leaves a dark wick. A frozen card gets an ice overlay (ice light at 60%, white edge, 2 cracks) and reads "frozen"; its wool count stays visible.
- The icicle over the speaker remains the in-scene timer; the tile keeps its ring.
- Everything else as v2 Part 7.

---

## 10. Milestones (one per session)

Verification for every milestone: `npm run build`, type check, the full test suite (including Part 2.5), screenshots at 1280 and 400 px, the Part 11 checklist, and a triangle count and frame time printed from a dev overlay.

### Milestone 0: the lives rule (engine, one commit)
Everything in Part 2, including the eight tests and the `PlayerView` additions. No visual work. Stop after the report so Brian can review the diff.

### Milestone 1: mesher and the high-detail sheep
`mesher.ts` with AO, `primitives.ts` (ellipsoid, box with chamfer, helix curl, cone, torus, tapered box), the default sheep from Part 5 with all parts and states, a preview route behind the flag with buttons for level and state, including the full freeze sequence of Part 6 on one sheep.
Acceptance: silhouette test passes (8+ steps on curves); 9 k to 14 k voxels; every state runs from one `useFrame`; the freeze sequence matches the timing table.

### Milestone 2: the barn table
Barn at 0.10 m with all of Part 7.1, heap, icicle, seats, `PaintedTable` with the overlay including lives flames, mounted at the switch point.
Acceptance: full Quick Game playable with the flag on; lives flames update from `PlayerView.lives`; frozen players show the block and are skipped by the icicle.

### Milestone 3: the moments
Wolf, shears, tufts, the time-out gust and flame puff, the freeze sequence and thaw wired to `lifeLost`, `frozen` and `thawed`; all rows of Part 3.
Acceptance: one visual per event; nothing moves during the steal window except the icicle colour, eyes, ring and STEAL button.

### Milestone 4: yard, distance, sky, snow, hour
Parts 7.2 to 7.4 at the new grids with chunked meshes.
Acceptance: seven depth layers through the doors; budget met with numbers.

### Milestone 5: twists, tally, results
Snow-capped signs, round transition, tally board with wool-ball counters and frozen rows at the bottom, results with the scarf and the thaw at "Play again".

### Milestone 6: the other places
Daily Table: the sheep pen behind the barn with streak lanterns on fence posts; Practice: the lambing shed (no lives shown, no penalties); Tutorial: the farmhouse kitchen with the sheepdog, plus one scripted line explaining flames (text to be approved by Brian); Rooms: the big barn at night.

### Milestone 7: polish and tests
Reduced-motion pass, performance pass, screenshot tests at 400, 768, 1280 px at two hours.

---

## 11. Checklist (in addition to v1 Part 9)

1. No sphere, capsule, cylinder or smooth imported geometry except the sky dome; the breath puff is voxels now.
2. Every object on one of the five grids in Part 4.1; characters at 0.04 m.
3. All voxel meshes come from `mesher.ts` with AO; no `InstancedMesh` except particles.
4. Silhouette rule: curves cross at least 8 voxel steps.
5. Three tones per material, no pure black; frost tint only on frozen sheep.
6. All players use the identical default sheep; only level, state and seat differ.
7. The freeze sequence matches Part 6 within 100 ms per step; the block has icicles, a snow cap and two cracks.
8. Lives: flames update from engine state only; the skin never changes lives itself.
9. Triangle count and frame time within budget, reported with numbers.
10. `git diff --stat`: engine changes only in the Milestone 0 commit and only in the files DISCOVERY.md names.

---

## 12. Decisions and defaults

| Decision | Default until Brian says otherwise |
|---|---|
| Lives per game | 3 |
| What costs a life | A turn that runs out with no play and no bank; nothing else |
| Frozen player | Skipped, cannot steal, keeps wool, ranks below all unfrozen players, thaws at the next game |
| Lives in Practice | None (no penalties) |
| Lives in the Tutorial | Shown, never lost; one scripted line about flames, text to be approved |
| Early game end when the human is frozen | No; the rounds finish at bot speed |
| Lives icon | Three flames on the card |
| Tutorial guide | The sheepdog |
| Sound | Still deferred |
| Hand-made MagicaVoxel models | Allowed after Milestone 7 only, at the same grids and palette |
