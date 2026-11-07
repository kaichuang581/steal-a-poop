# The craft of small voxel animal characters (readability, charm, consistency)

Scope note: the target is a set of farm animals (pig, cow, goat, horse, chicken) standing beside an existing dark-faced white sheep, each roughly 20–30 voxels tall on a 0.04 m grid (0.8–1.2 m), rendered flat-shaded with 2–3 colour tones per material and no textures. Minecraft model units below are 1/16 of a block (0.0625 m); Minecraft dimensions are given as width × height × depth in those units unless stated otherwise. Everything taken from the Mojang `bedrock-samples` files is primary data; press articles are secondary.

## Key question 1 — Minecraft's pig, cow, sheep, chicken, horse (and goat) models: exact block dimensions and what each animal's signature is

### Takeaway
Mojang's farm animals share one grammar — a single box body, a box head overlapping the body's front, four (or two) identical square-section legs pivoted at the hip — and each animal is distinguished by exactly one or two tiny attached boxes (pig snout plate, cow horns + udder, chicken beak + wattle, horse muzzle + mane + angled neck, goat horns + tilted head) plus the wool "inflate" shell on the sheep. Leg cross-section is 4×4 for every quadruped except the goat (3×3); head widths step 8 (pig, cow) → 6 (sheep, horse) → 5 (goat) → 4 (chicken).

### Cited Findings

**Pig** (`geometry.pig.v1.8`, texture 64×32) — [Mojang bedrock-samples pig.geo.json](https://github.com/Mojang/bedrock-samples/blob/main/resource_pack/models/entity/pig.geo.json)
- Body: one cube size [10, 16, 8] with the body bone's `bind_pose_rotation` [90, 0, 0], so it lies along the body axis: 10 wide, 8 tall, 16 long. Body pivot [0, 13, 2].
- Head: cube [8, 8, 8] at origin [-4, 8, -14], pivot [0, 12, -6] (pivot at the back of the head where it meets the body, at the head's vertical centre). The head overlaps the body front (z -14 to -6 vs body front ≈ -6).
- Snout: a single plate [4, 3, 1] at origin [-2, 9, -15] — 4 wide, 3 tall, 1 deep, sitting one unit above the bottom of the 8-unit face, centred horizontally, protruding 1 unit in front of the face.
- Legs: four cubes [4, 6, 4]; leg pivots at y = 6 (the top of the leg), x = ±3, z = 7 and −5; leg1/leg3 are bone-mirrored.
- Overall: legs 6 + body 8 = 14 units to the back; head top at y = 16 (≈ one block). Visible bounds width 2, height 1.5.

**Cow** (`geometry.cow.v1.8`, texture 64×32) — [Mojang bedrock-samples cow.geo.json](https://github.com/Mojang/bedrock-samples/blob/main/resource_pack/models/entity/cow.geo.json)
- Body: cube [12, 18, 10] rotated 90° → 12 wide, 10 tall, 18 long; pivot [0, 19, 2].
- Udder: cube [4, 6, 1] at origin [-2, 11, -6] (a 4×6 plate, 1 unit thick, on the underside toward the rear).
- Head: cube [8, 8, 6] at origin [-4, 16, -14], pivot [0, 20, -8] (the cow's head is shallower front-to-back than the pig's: 6 vs 8).
- Horns: two cubes [1, 3, 1] at origins [-5, 22, -12] and [4, 22, -12] — each a 1×1 post 3 tall, placed just outside the head's side faces (head spans x −4..4; horns at x −5 and 4..5), rising 1 unit above the head top (head top y 24, horn top y 25).
- Legs: four cubes [4, 12, 4], pivots at y 12, x ±4, z 7 / −6.
- Overall: legs 12 + body 10 = 22 to the back; head top 24 (1.5 blocks). Visible bounds height 1.75.

**Sheep** (`geometry.sheep.sheared.v1.8` and the wool overlay `geometry.sheep.v1.8`) — [Mojang bedrock-samples sheep.geo.json](https://github.com/Mojang/bedrock-samples/blob/main/resource_pack/models/entity/sheep.geo.json)
- Sheared body: cube [8, 16, 6] rotated 90° → 8 wide, 6 tall, 16 long; pivot [0, 19, 2]. The underlying body is the thinnest of the quadrupeds.
- Head: cube [6, 6, 8] at origin [-3, 16, -14], pivot [0, 18, -8]; the head bone is a root (not parented to body) and carries the `lead` locator.
- Legs: four cubes [4, 12, 4], pivots at y 12, x ±3, z 7 / −5.
- Wool overlay geometry: head cube [6, 6, 6] with inflate 0.6 (wool stops short of the face — the front 2 units of the 8-deep head stay bare); body cube [8, 16, 6] with inflate 1.75 (so the woolly body reads as ≈11.5 wide × 9.5 tall × 19.5 long); legs [4, 6, 4] with inflate 0.5, covering only the upper 6 of the 12-unit legs.

**Chicken** (`geometry.chicken.v1.12`, texture 64×32) — [Mojang bedrock-samples chicken.geo.json](https://github.com/Mojang/bedrock-samples/blob/main/resource_pack/models/entity/chicken.geo.json)
- Body: cube [6, 8, 6] with rotation [90, 0, 0] → 6 wide, 6 tall, 8 long; pivot [0, 8, 0].
- Head: cube [4, 6, 3] at origin [-2, 9, -6]; pivot [0, 9, -4] (bottom-back of head).
- Beak: cube [4, 2, 2] at origin [-2, 11, -8] — as wide as the head, 2 tall, protruding 2, at the vertical middle of the 6-tall head.
- Comb/wattle: cube [2, 2, 2] at origin [-1, 9, -7], directly beneath the beak at the bottom of the head.
- Legs: two cubes [3, 5, 3], pivots [-2, 5, 1] and [1, 5, 1].
- Wings: two cubes [1, 4, 6] — one voxel thin, 4 tall, 6 long — pivots [±3, 11, 0] at the top of the body sides.
- Overall: ≈ 15 units from feet to head top, with the head top at y 15.

**Horse** (`geometry.horse.v3`, texture 64×64, visible bounds 4 × 3) — [Mojang bedrock-samples horse_v3.geo.json](https://github.com/Mojang/bedrock-samples/blob/main/resource_pack/models/entity/horse_v3.geo.json)
- Body: cube [10, 10, 22] at origin [-5, 11, -11]; pivot [0, 13, 9].
- Legs: four cubes [4, 11, 4], pivots at y 11, x ±3, z ±9 (legs are taller than the body is deep: 11 vs 10).
- Neck: cube [4, 12, 7] at origin [-2, 16, -11], pivot [0, 17, -8], rotation [30, 0, 0] — a 12-tall neck block tilted 30° forward.
- Head: cube [6, 5, 7] at origin [-3, 28, -11], parented to Neck, pivot [0, 28, -11].
- Muzzle: cube [4, 5, 5] at origin [-2, 28, -16], parented to Head — the head is two stacked boxes, a 6-wide cranium and a 4-wide 5-long muzzle in front of it.
- Ears: two cubes [2, 3, 1] at origins [-0.5/−1.5, 32, -5.01], rotated ±5° about Z. Mule/donkey ears are [2, 7, 1] rotated ±15° — the same ear slot, more than twice as long and splayed.
- Mane: cube [2, 16, 2] at origin [-1, 17, -3.95] along the back of the neck (a 2×2 strip 16 long).
- Tail: cube [3, 14, 4] at origin [-1.5, 6, 9], pivot [0, 20, 11], rotation [25, 0, 0].
- Saddle/bags/bridle/reins exist as extra cubes (bridle is the head re-drawn with inflate 0.25; reins are zero-thickness planes).
- Overall: body top y 21, head y 28–33, ear tips y 35 (≈ 2.2 blocks). 

**Goat** (`geometry.goat`, texture 64×64) — [Mojang bedrock-samples goat.geo.json](https://github.com/Mojang/bedrock-samples/blob/main/resource_pack/models/entity/goat.geo.json)
- Body: two cubes — [9, 11, 16] at origin [-4, 6, -7] (rear/barrel) and [11, 14, 11] at origin [-5, 4, -8] (front chest, bigger and lower). The chest is the fatter block.
- Head: cube [5, 7, 10] at origin [-2, 15, -16] with its own pivot [1, 18, -8] and rotation [55, 0, 0] — a long 10-deep box tilted 55° downward, so the goat reads as a long drooping muzzle; head bone pivot [0.5, 17, -8].
- Ears: two cubes [3, 2, 1] at origins [3, 19, -10] and [-5, 19, -10] (sideways-sticking flaps, 3 long, 2 tall, 1 thick), one mirrored.
- Horns: two cubes [2, 7, 2] at origins [-1.99, 19, -10] and [0.99, 19, -10], parented to head, pivot [1, 18, -8] (2×2 posts, 7 tall, touching at the centre of the skull).
- A zero-width plane [0, 7, 5] at origin [0.5, 6, -14] hangs under the head front (unnamed in the file; reads as the beard/chin feature, and being a plane it depends on texture alpha).
- Legs: back legs [3, 6, 3] (pivot y 10), front legs [3, 10, 3] (pivot y 10) — front legs are 10 tall, rear 6, because the chest cube hangs lower.

**Shared grammar and animation pivots across the set**
- Every Mojang quadruped above uses leg pivots at the top of the leg (the hip/shoulder line) and head pivots at the back of the head where it meets the body — [pig.geo.json](https://github.com/Mojang/bedrock-samples/blob/main/resource_pack/models/entity/pig.geo.json), [cow.geo.json](https://github.com/Mojang/bedrock-samples/blob/main/resource_pack/models/entity/cow.geo.json), [sheep.geo.json](https://github.com/Mojang/bedrock-samples/blob/main/resource_pack/models/entity/sheep.geo.json), [horse_v3.geo.json](https://github.com/Mojang/bedrock-samples/blob/main/resource_pack/models/entity/horse_v3.geo.json).
- The shared quadruped walk is one expression per leg: `math.cos(query.anim_time * 38.17) * 80.0` on leg0 and leg3, and `* -80.0` on leg1 and leg2 (diagonal pairs in phase — a trot), driven by `query.modified_distance_moved`, looped — [quadruped.animation.json](https://github.com/Mojang/bedrock-samples/blob/main/resource_pack/animations/quadruped.animation.json).
- The chicken uses the same formula on its two legs, wings rotate about Z by `variable.wing_flap` (mirrored on the other wing), and the baby form simply scales the head by 2.0 — [chicken.animation.json](https://github.com/Mojang/bedrock-samples/blob/main/resource_pack/animations/chicken.animation.json).
- Mojang's 2019 Texture Update is described as aiming "to improve overall contrast, make patterns larger, and reduce the finer details in many cases"; the creeper kept its original texture — [Sportskeeda explainer](https://widgets.sportskeeda.com/minecraft/what-minecraft-texture-update) (secondary source; the Minecraft Wiki page confirms "a few iconic textures" were left unchanged — [Minecraft Wiki: Texture Update](https://minecraft.wiki/w/Texture_Update)).
- Jasper Boerstra (Mojang texture artist) said the main feedback on the new textures was that things "looked blurry due to the use of anti-aliasing, so he reduced anti-aliasing" — [OnMSFT](https://onmsft.com/news/minecraft-updates-texture-pack-on-java-again-coming-soon-to-bedrock-platforms); and advised redesigners to "keep it consistent, with shared techniques and style rules" — [Minecraft.net Q&A (search snippet; page timed out on fetch)](https://www.minecraft.net/en-us/article/try-new-minecraft-textures).

### Inferences
- Signature-feature table implied by the geometry (one or two attachments each, everything else shared): pig = flat 4×3×1 snout plate low on an 8-cube face; cow = two 1×3×1 horn posts at the head corners + 4×6×1 udder; sheep = inflated wool shell that leaves a bare 6×6 face and the lower half of the legs exposed; chicken = 4×2×2 beak with 2×2×2 wattle under it, 1-thick wings, two 3×3 legs; horse = 30°-tilted 12-tall neck, two-box head (6-wide cranium + 4-wide muzzle), 2×2 mane strip, 25° tail, 2×3×1 ears; goat = 55°-drooped long head with 2×7×2 horns and a chest fatter than the rump; donkey/mule = the horse with the ear box stretched from 3 to 7 tall and splayed 15°.
- Proportion rules you can lift directly: head width is 67–80 % of body width for pig and cow (8/10, 8/12) and 60 % for horse (6/10); leg thickness is 33–40 % of body width (4 on 10–12) and 50 % on the chicken (3 on 6); leg height ≥ body height for cow (12/10), sheep (12/6), horse (11/10) but < body for the pig (6/8). The pig's short legs and the sheep's thin body under a fat shell are what make them read as "pig" and "sheep" at silhouette level.
- Features are never smaller than 1 unit in any dimension, and the smallest readable attachments are 1×3×1 (cow horn), 2×2×2 (wattle) and 2×3×1 (horse ear). At the project's 0.04 m grid, 1 unit ≈ 1.56 voxels, so a horn of 1–2 voxels square and 4–5 tall, or an ear of 3×4–5×1–2 voxels, is the equivalent minimum.
- Mojang's chicken is deliberately oversized relative to a real chicken (≈15 units tall vs a 16-unit pig). The design priority is that the beak (4 wide) and wattle (2×2) stay readable; a chicken scaled "correctly" beside a cow would lose its face.
- Scaling to the brief: the Minecraft sheep is ≈22–24 units tall with wool (≈1.4 m). If the existing 0.04 m-grid sheep is ~24 voxels, a straight Mojang ratio gives pig ≈ 17–18, cow ≈ 26, horse ≈ 36 (too tall for the 20–30 brief) and chicken ≈ 16; so keep Mojang's relative part ratios within each animal but compress the inter-animal scale (e.g. chicken 12–14, pig 18–20, goat/sheep 22–24, cow 26–28, horse 28–30 with the neck + head accounting for the top 8–10).

### Gaps
- I could not fetch Minecraft Wiki pages describing eye pixel sizes on the mob textures (the eyes are texture pixels, not geometry), so eye dimensions for Mojang mobs are not documented here.
- No Mojang statement was found about which features were consciously chosen as each animal's "signature"; the signature list above is inferred from the geometry, not quoted from designers.
- The Boerstra Minecraft.net Q&A timed out twice; his principles are quoted from search snippets and a secondary news site only.
- The goat's zero-width chin plane is unnamed in the file; I could not confirm whether it is a beard or something else.

## Key question 2 — How Crossy Road (and similar voxel games) keep dozens of animals distinct yet consistent

### Takeaway
Crossy Road's consistency comes from one artist (Ben Weatherall) building every character in one tool (Qubicle) on one fixed hop-grid with deliberately "obvious hit boxes and sharp edges", at a camera angle chosen because voxels look better rotated; distinctness came from treating every character as cosmetic with its own gimmick, shipped in batches of 15–16 a month. I found no published breakdown of their voxel grid size, eye style or palette rules.

### Cited Findings
- Ben Weatherall, who had worked with Matt Hall on the card game Deck War, was brought on to create the art in Qubicle, a 3D voxel editor he had "mastered" within a year; Hall decided the visual style while Andy Sum prototyped gameplay, and Sum said finding a style that suited the gameplay was a particular challenge — [PocketGamer.biz, The making of Crossy Road](https://www.pocketgamer.biz/making-of-crossy-road/).
- Hall wanted to angle the camera "because voxels look better at an angle"; Sum initially thought it would hurt movement precision, but once prototyped "there was no denying that it looked 100 times better" — [PocketGamer.biz](https://www.pocketgamer.biz/making-of-crossy-road/).
- Sum wanted the game to stay "very 'pure'", with "really obvious hit boxes and sharp edges" so players could judge hops precisely — [PocketGamer.biz](https://www.pocketgamer.biz/making-of-crossy-road/).
- Characters are purely aesthetic; some only change the sprite, others add a visual or audio quirk or an environmental effect (Mad Wizard zaps trees, Wolf toggles day/night, Hipster Whale takes photos); "over 50 to unlock just from the start" — [PocketGamer.biz](https://www.pocketgamer.biz/making-of-crossy-road/).
- Sum said the team planned to release up to 15 new characters a month; the Australia Day update "featured 16 new characters" — [Thumbsticks](https://www.thumbsticks.com/crossy-road-how-hipster-whale-reinvented-free-to-play/); [Cult of Mac](https://www.cultofmac.com/news/crossy-road-developers-made-10-million-90-days) (also credits Weatherall with the "cubelike design, called voxel art").
- Hipster Whale on translating Bluey: Crossy Road Castle "has a very bold, blocky style, while Bluey is much rounder and softer. But thankfully both Bluey and Crossy Castle have a chunky toy-like sense of scale and simplicity" — [Bluey.tv blog (search snippet; page returned 403 on fetch)](https://www.bluey.tv/blog/a-deeper-dive-into-blueys-crossy-road-castle/).
- The GDC 2015 session "Crossy Road: A Whale of a Time" (Free to Play Summit) exists but is behind the GDC Vault login — [GDC Vault](https://gdcvault.com/play/1021897).
- Zach Soares (Voxelnauts, Spartan Fist, Critical Annihilation) recommends oversized heads as a readability hierarchy because dynamic shadows "hide a lot of details" put into colour work, and says to use few colours, typically one base colour plus a lighter highlight for contours, with "contrasting colors instead of subtle gradients" — [Game Developer: Voxel Art — Reducing the Greebles](https://www.gamedeveloper.com/design/voxel-art-reducing-the-greebles).
- Sir Carma: "scale is the most important thing"; "the best voxel art is when it stays simple"; "the general scene can be very detailed, but still stays small"; on characters, "Goku's hair is made of like 5 or 6 cubes!"; and because there are no textures, "it's really tough" to paint — [80.lv interview](https://80.lv/articles/sir-carma-magica-voxel-was-like-having-infinite-legos-in-my-computer).

### Inferences
- Crossy Road's "consistency" levers, from the evidence: one tool and one artist, a camera angle fixed for the whole cast, a fixed hop cell (every character must fit the same tile and read as a sharp box for collision), and a one-gimmick-per-character rule that doubles as the "one signature feature" the brief asks for.
- The Bluey quote is the clearest statement of the translation principle: keep "chunky toy-like scale and simplicity", drop roundness/softness, and let a shared scale carry recognition.
- Applied to the farm set: same voxel grid, same leg cross-section (as Mojang does with its 4×4 legs), same eye construction, one hue family per animal (pink, black-and-white, white/grey-brown, chestnut, white-with-red) and exactly one geometric signature each (snout plate, horns+udder, horns+beard, neck+mane, beak+wattle).

### Gaps
- No primary source describes Crossy Road's voxel grid size per character, eye style, or palette rules; the GDC talk and Weatherall's own process are not publicly transcribed as far as I could find.
- The Bluey.tv and Thumbsticks pages had no further art-pipeline detail; Thumbsticks covers monetisation only.

## Key question 3 — What voxel and pixel-art tutorials say about roundness, faces, eye size, and colour count

### Takeaway
Practitioner guidance converges on: suggest curves with as little stepping as possible (stepping adds geometry and clutters the silhouette), build eyes from 1–3 cells with a white + black pair at most, keep one base colour plus a lighter highlight (or a darker edge) per material rather than gradients or noise, and test readability by squinting or filling the sprite black.

### Cited Findings
- Soares: limit the stepping used to define shapes — his early dwarves relied on too much of it and he "wasn't prioritizing shape/design clarity"; avoid procedural noise, which "will only cloud the design you intend to make"; flat shading can make shadows explicit through colour, using "contrasting colors instead of subtle gradients"; his summary principle is "EVERY VOXEL COUNTS" — [Game Developer](https://www.gamedeveloper.com/design/voxel-art-reducing-the-greebles).
- Sir Carma: voxels are "by definition very simple", stylised unrealistic forms suit cubes better than realism, and with no textures the painting on the voxel surfaces carries the form — [80.lv](https://80.lv/articles/sir-carma-magica-voxel-was-like-having-infinite-legos-in-my-computer).
- Kodeco's MagicaVoxel pig tutorial starts from a 9×9×9 model; the body is a 1-high slab extruded to 6 high; the head is a box from (2,6,5) to (6,4,5); the snout is a dark-pink box; nostrils are made by erasing two voxels in the snout; the tail is a dark-pink spiral built voxel by voxel; ears are built with x-mirroring on so "the other ear [is] built at the same time"; legs are built hind first then front with mirroring; finishing is Paint Mode with "the eye whites white and the pupils black" and ears/nostrils painted dark. Colours named: light piggy-pink, dark pink, white, black — [Kodeco MagicaVoxel 3D Art Tutorial, page 1](https://www.kodeco.com/375-magicavoxel-3d-art-tutorial) and [page 2](https://www.kodeco.com/375-magicavoxel-3d-art-tutorial?page=2).
- Pixel-art readability guides: "Sometimes 2-3 pixels is all you need for an eye!" and eyes/hair/buttons should be added last and sparingly; the "squint test" — hold the design at arm's length and squint until details blur, and if it becomes an undefined blob the silhouette and contrast need work — [gamineai composition rules](https://gamineai.com/blog/10-pixel-art-composition-rules-readability-in-game-2026) (practitioner blog, search snippet).
- A silhouette test variant: fill the sprite with pure black and check it is still identifiable — [freegamesprites silhouette test](https://freegamesprites.com/pt/news/sprite-silhouette-test-character-readability) (search snippet).
- One pixel artist says they "rarely use more than three pixels for eyes" and that making the head as large as the body "isn't just a style choice; it's a readability choice" — [pixelartnerds, art of 8-pixel game design](https://pixelartnerds.pages.dev/content/art-of-8-pixel-game-design) (search snippet).
- NES-era sprites use a chibi proportion where "the head is roughly a third of the whole sprite", with a shortened torso to leave room for expressive eyes — [Aseprite community thread](https://community.aseprite.org/t/i-cannot-figure-out-these-eyes/24563).
- On eye sensitivity: "A single pixel wrong, and you'll be screwed, your characters will look crazy, dumb, or completely stunned" — [NESdev forum](https://nesdev.nes.science/f21/t10923.xhtml).
- For tiny noses, put shadow on the underside and edges and "a white highlight on top" — [PixelJoint thread](https://pixeljoint.com/forum/printer_friendly_posts.asp?TID=24896).
- Save the brightest highlight for the focal point (face), keep everything else calmer; readability depends mostly on light–dark value, not hue — [wayline.io colour lesson](https://www.wayline.io/learn/color-palettes/1) (search snippet).
- A Minecraft-style art blog warns against darkening shadows with the burn tool and suggests picking a new hue for shadows instead — [presentationbuilder Minecraft drawing guide](https://presentationbuilder.internationaltrucks.com/draw-characters-minecraft) (low-quality source; the advice matches standard pixel-art hue-shifting).
- AI-generated "voxel art skill" pages (low authority) repeat rules of thumb: model for silhouette first, detail second; a 32³ character "often reads better than 64³"; limit palettes to 16–32 colours; Rayman-style floating hands/feet concentrate detail on the head — [skills.sh voxel-art](https://www.skills.sh/omer-metin/skills-for-antigravity/voxel-art), [openskillindex](https://openskillindex.com/skills/vibeforge1111-vibeship-spawner-skills-voxel-art).

### Inferences
- Roundness in a 20–30-voxel body is best suggested by chamfering only the corners of a box (knock off a 1-voxel edge, or a 2-voxel edge on the big cow barrel) rather than by stair-stepping the whole surface — this matches Soares' "limit stepping" and Sir Carma's "stays simple". A belly that is 1 voxel wider than the shoulders, or a rump chamfered more than the chest, reads as a curve without noise.
- Eye construction for flat-shaded voxels with no textures: a 1×1 painted voxel is the smallest readable eye (and is what the 0.04 m grid gives at 4 cm on a 1 m animal); a 2×2 white block with one black voxel, or a 2-tall × 1-wide black with a 1-voxel white catchlight above, is the largest that still looks animal rather than cartoon-human. The Kodeco pig uses white-with-black-pupil geometry eyes and inset nostrils; neither needs a texture, so both transfer directly.
- Colour budget per animal: one base colour + one lighter top/highlight tone + (optionally) one darker underside/edge tone per material, plus the eye black/white and the one accent (snout pink, wattle red). That is the 2–3-tone constraint in the brief and is exactly Soares' "base + lighter highlight" rule; never per-voxel noise.

### Gaps
- No dedicated, authoritative tutorial on voxel eye sizes (1×1 vs 2×2 vs 3×2 with catchlight) was found; the sizes above are inferred from pixel-art practice (1–3 pixels per eye) and the Kodeco pig.
- Pedro Medeiros' (saint11) tutorial site (blog.studiominiboss.com) did not resolve; his "Portraits" tutorial is known to exist but its content could not be cited.
- The Construct "Designing a 2D Pixel Character" tutorial (which has a Head-and-Eyes section) returned 403.

## Key question 4 — Splitting and pivoting parts for animation; idle animations that work on blocky bodies

### Takeaway
Industry practice for voxel characters is rigid-part hierarchies rather than skinned meshes: separate head, legs, tail, ears, wings as their own objects, pivoted where they meet the parent (hip line for legs, neck for head, rump for tail), with slight size variation between limb pieces to hide clipping. Mojang's shipped animations are tiny — a cosine leg swing, a wing-flap angle, a head-scale for babies — which is a good ceiling for how little a blocky body needs.

### Cited Findings
- Soares: use separate, rigid limb pieces rather than skin rigging; "variable limb sizes hide clipping"; limbless Rayman-style designs work when gameplay calls for them; workflow is plan the final design → break the model into animatable parts → block out → simplify → rig and animate — [Game Developer](https://www.gamedeveloper.com/design/voxel-art-reducing-the-greebles).
- Mojang bone hierarchy for quadrupeds: body is the root; head, leg0–leg3 are children of body; head pivot at the back of the head ([0, 12, -6] pig, [0, 20, -8] cow); leg pivots at the hip line ([±3, 6, ±z] pig, [±4, 12, ±z] cow) — [pig.geo.json](https://github.com/Mojang/bedrock-samples/blob/main/resource_pack/models/entity/pig.geo.json), [cow.geo.json](https://github.com/Mojang/bedrock-samples/blob/main/resource_pack/models/entity/cow.geo.json).
- Horse hierarchy: Body → Neck (pivot [0, 17, -8], 30° forward) → Head (pivot [0, 28, -11]) → Muzzle, EarL/EarR (±5° Z), Bridle → BitL/BitR; Body → Tail (pivot [0, 20, 11], 25°); Neck → Mane — [horse_v3.geo.json](https://github.com/Mojang/bedrock-samples/blob/main/resource_pack/models/entity/horse_v3.geo.json).
- Goat: horns parented to head at pivot [1, 18, -8]; the head cube itself is tilted 55° — [goat.geo.json](https://github.com/Mojang/bedrock-samples/blob/main/resource_pack/models/entity/goat.geo.json).
- Chicken: comb and beak parented to head (pivot [0, 9, -4]); wings pivot at the top of the body sides [±3, 11, 0]; legs pivot at [±2/1, 5, 1] — [chicken.geo.json](https://github.com/Mojang/bedrock-samples/blob/main/resource_pack/models/entity/chicken.geo.json).
- Walk: `leg rotation X = math.cos(query.anim_time * 38.17) * ±80.0`, diagonal pairs in phase, driven by distance moved — [quadruped.animation.json](https://github.com/Mojang/bedrock-samples/blob/main/resource_pack/animations/quadruped.animation.json). Chicken: same on two legs; wings `rotation Z = variable.wing_flap` (negated on the other wing); baby = head scale 2.0 — [chicken.animation.json](https://github.com/Mojang/bedrock-samples/blob/main/resource_pack/animations/chicken.animation.json).
- MagicaVoxel 0.99+ supports multiple objects with individual rotations and translations (the T-Rex sample animates with transforms; the deer sample only swaps whole models per frame) — [arlorean devlog on MagicaVoxel 0.99 animation support](https://arlorean.itch.io/magicavoxel-thumbnails/devlog/543925/magicavoxel-099-multiple-object-and-animation-support).
- Exporting .vox → .obj → Unity can misplace the pivot; the fix (0.99.4.2) is World Editor → Edit column → Move → Ground, then export — [The Bitcave: MagicaVoxel to Unity](https://thebitcave.gitbook.io/magicavoxel-resources/exporting-models/magicavoxel-to-unity).
- A free Joey Carlino tutorial covers exporting from MagicaVoxel, cleanup, building an armature in Blender and choosing rig parenting options — [Class Central listing](https://classcentral.com/course/youtube-rig-magicavoxel-characters-in-blender-209608).
- In the film Pixels, separate voxel spaces were parented "one to his head, one to his upper arm, lower arm etc.", and any squash and stretch caused re-voxelisation within that domain — [fxguide](https://www.fxguide.com/?p=59722).
- Unity's Humanoid avatar expects at least 15 bones; a tail is not part of the Humanoid set and needs a Generic rig or a separate bone chain — [habr.com rigging article (Russian)](https://habr.com/en/articles/422255).

### Inferences
- Part list for the farm set, following Mojang and Soares: body (root), head (pivot at the neck, back-centre of the head box), ears (pivot at the ear base on the head), snout/beak/muzzle (child of head, usually static), four legs (pivot at the hip line, top-centre of each leg box), tail (pivot at the rump, top of the tail box), wings for the chicken (pivot at the top edge of the body side), horns rigid to the head. Keep legs 1 voxel inset from the body's side faces or 1 voxel shorter than the gap so a 80° swing does not visibly interpenetrate (Soares' "variable limb sizes hide clipping").
- Idle animations that suit boxes: a whole-body squash/stretch of ±1 voxel on a breathing cycle (scale the root slightly, as Mojang scales baby heads); head yaw/pitch of ±10–20° on the neck pivot; ear flicks (rotate an ear 20–30° for 2–3 frames); tail swish about the rump pivot (the horse tail already hangs at 25°); chicken head-bob (translate head forward/back 1 voxel on alternate steps) and a wing flap on Z. The Crossy Road hop (as squash-on-land, stretch-in-air) should be applied as root scale, not per-voxel re-modelling, since re-voxelising per frame is what the Pixels pipeline had to do and is not needed here.
- Because the renderer is flat-shaded with no textures, texture-driven tricks (wool inflate overlay with alpha, zero-thickness planes for reins/beard, baby-head texture reuse) do not apply; every animated part must be a real ≥1-voxel box, and the sheep's wool shell must be modelled as a larger body box, not an inflated duplicate.

### Gaps
- No source describes Crossy Road's own rig (whether the hop is root squash-stretch or per-part animation).
- Mojang's head-look (yaw/pitch) and tail/ear idles are driven in code/render controllers, not in the fetched animation JSON, so their exact ranges are not cited.

## Key question 5 — Failure modes and fixes (mushy silhouettes, noise, too many colours, too-small features)

### Takeaway
The repeated failures named by practitioners are uniform detail ("greebles"/noise) that clouds the design, stepping that bloats geometry and blurs the silhouette, subtle gradients that die under flat shading, highlights spread everywhere so the face stops being the focal point, and eyes that are a pixel off. Fixes are all subtractive: fewer colours, fewer steps, bigger shapes, one highlight on the face, and a squint/black-fill test.

### Cited Findings
- Noise from uniform detail: a classic beginner mistake is using texturing to add a uniform amount of detail at a uniform resolution, which produces noise — [gamedev.net voxel character feedback thread](https://gamedev.net/forums/topic/715354-i-could-need-some-feedback-on-a-voxel-character/5460790/) (search snippet; page returned 403).
- Soares names his own early failure — too much stepping and "not prioritizing shape/design clarity" — and that dynamic shadows "hide a lot of details" put into colour, so designs must rely on shape hierarchy (oversized heads) — [Game Developer](https://www.gamedeveloper.com/design/voxel-art-reducing-the-greebles).
- Procedural noise "will only cloud the design you intend to make" and gives less control — [Game Developer](https://www.gamedeveloper.com/design/voxel-art-reducing-the-greebles).
- Pixel-art: two colours different in hue but equal in value "will blend into an unreadable mush at small sizes" — [wayline.io](https://www.wayline.io/learn/color-palettes/1) (search snippet).
- Confusable shapes: in a Reddit critique, goggle lenses were mistaken for pupils; the fix suggested was changing the palette or removing highlights — [r/PixelArt thread](https://lr.us.psf.lt/r/PixelArt/comments/1l31gsz/how_do_these_sprites_read) (search snippet).
- Over-scale assets: Sir Carma warns "you have to be careful about the size of your different assets" — tiny cubes make proportions easy to get wrong, so check each object against the others — [80.lv](https://80.lv/articles/sir-carma-magica-voxel-was-like-having-infinite-legos-in-my-computer).
- Mojang's texture update direction was to raise contrast, enlarge patterns and reduce fine detail — [Sportskeeda](https://widgets.sportskeeda.com/minecraft/what-minecraft-texture-update) — and Boerstra reduced anti-aliasing because the result looked blurry — [OnMSFT](https://onmsft.com/news/minecraft-updates-texture-pack-on-java-again-coming-soon-to-bedrock-platforms).
- Eye placement is unforgiving: one pixel off makes characters look "crazy, dumb, or completely stunned" — [NESdev forum](https://nesdev.nes.science/f21/t10923.xhtml).

### Inferences
- Legs too thin: Mojang never goes below 33 % of body width (4 on 12) or 3 units absolute; at 0.04 m that is a 3-voxel minimum leg square on an 8–10-wide body, 4–5 on a cow. Thin legs also break the "obvious hit box" sharpness that Crossy Road prized.
- Head too small: pig/cow heads are 67–80 % of body width and as tall as the body; horse/goat compensate for narrower heads with a long neck/muzzle so the head-plus-neck mass still dominates the front silhouette. If a head reads small, widen it before adding features.
- Noise instead of lobes: wool, feathers and manes should be modelled as 1–2 large lobes (Mojang's whole sheep wool is a single inflated box; the horse mane is one 2×2 strip) and coloured in two tones, not as scattered voxels.
- Features vanishing at distance: anything under 2 voxels in its smallest visible dimension (ear 1 thick is fine if it is 3–4 tall and a contrasting tone; a 1×1 horn is not) will drop out at 20–30 voxel character height; Mojang's smallest attachments are 1×3×1 (horn) and 2×2×2 (wattle), and they survive only because the horn is a light colour on a dark head and the wattle is saturated red on white.
- Too many colours: budget ≈ 5–7 colours per animal (base ×2–3 tones, eye black + white, one accent) — in line with Soares' base + highlight and the pixel-art "fewer than sixteen colours" rule of thumb; if the flat-shaded renderer already darkens side faces, drop the darker tone and use only base + highlight.
- Final checks: black-fill silhouette test on the five animals in a row (each must be nameable from silhouette alone); squint test for face focal point (eyes and signature feature should be the two highest-contrast marks); and a side-by-side scale check against the sheep baseline, per Sir Carma's warning.

### Gaps
- The gamedev.net critique thread and the r/PixelArt thread could not be fetched in full, so the exact wording of the fixes is from search snippets only.
- No source quantifies the "too-small feature" threshold in voxels; the 2-voxel floor above is my inference from Mojang's smallest attachments and the project's grid.
