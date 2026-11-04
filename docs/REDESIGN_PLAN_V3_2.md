# Finish the Word v3.2 for Claude Code: the table screen

Version 3.2, 3 November 2026. Addendum to v3 and v3.1; the v1 guardrails and the v3 rules still apply. One milestone, **T**, to run after v3.1 Milestone R. No rule changes.

---

## 0. For Brian
Save as `docs/REDESIGN_PLAN_V3_2.md`.
```
Read @docs/REDESIGN_PLAN.md (Parts 1 to 4), @docs/REDESIGN_PLAN_V3.md (Parts 4 to 8), @docs/REDESIGN_PLAN_V3_1.md (Part 1) and @docs/REDESIGN_PLAN_V3_2.md. Do Milestone T exactly as specified. Attach before and after screenshots at 1920 by 1080 and report file by file.
```

---

## 1. What is wrong in the current table screen
- The camera is about two metres off the floor and close to the ring, so hay fills two thirds of the frame, the two nearest sheep are cropped giants, and the barn (walls, beams, lanterns, the open doors) is not in the shot. With no roof in frame the sky shows above the hay, which breaks the "inside the barn" idea.
- The two things the player must read every second have no presence: the wool pile is a small lump at the bottom edge, half behind the input bar; the letter tile is a 64 px circle at the top edge with the seconds in a tiny label over the sky.
- The floor is one saturated yellow texture of large cubes with random noise, so there is nothing for the cream wool to stand out against.
- Everyone starts bare: wool level is tied to banked points, and banked points start at 0, so the player's sheep is a pink body with a stray tuft on top. That is a mapping bug, fixed in Part 4.
- The render runs at dpr 1 with 4.3 ms of headroom; it can afford full resolution.

---

## 2. Camera and composition (desktop; phone in Part 7)
- Camera: fov 32, position (0, 6.2, −11.8), looking at (0, 0.9, 0.6). This is higher and farther than v3's table camera and is the new value. The pile sits at the frame's centre, slightly below the middle line; the ring is fully inside the frame; the far open doors sit behind the "you" sheep in the upper third; the side walls, the z = 1 cross beam and both lanterns are in frame; no sky is visible except through the doors.
- Seats on a ring of radius 4.0 m centred on the pile, angles measured from the camera axis: you at 180° (far side, facing the camera); bots at ±40°, ±80°, ±120° in that order of seating; no seat within 25° of the camera axis on the near side, so no sheep is cropped. Each sheep faces the pile; the current speaker steps 0.35 m toward it.
- Sheep scale: unchanged model; at this camera the nearest sheep spans about 22% of the frame height, the far one about 12%.
- Vignette: a soft radial darkening of 18% at the corners (post pass or a static overlay) to hold the eye on the centre.

---

## 3. The pile (the hero)
- Size: a 0.9 m wide mound at 0 to 9 points, growing to 2.2 m at 80 points (linear in between), built from the v3 wool primitives with curls; it sits on a round wooden platform 2.6 m across, dark beam wood with 1-voxel gaps between boards, raised 0.15 m, so cream wool stands on dark wood instead of yellow hay.
- Light: a `SpotLight` from the ridge beam straight down on the pile (#FFD9A0, intensity 2.4, angle 0.42 rad, penumbra 0.7, distance 9, casting shadow) and a 2.4 m ring of warm light on the platform. The spot brightens 25% for 400 ms on `accepted`.
- Number: a 3D-anchored HTML tag (projected from the scene point (0, pileTop + 0.35, 0) every frame) showing the pile in Fraunces 800 at 44 px on a paper tag with a wooden pin, label "wool in the pile" in Patrick Hand under it; the tag scales 1.0 to 1.15 and back on `accepted`. The tag never sits behind the input bar: if the projected point falls within 120 px of the bottom edge, pin it 120 px above the edge.
- The input bar moves down to 12 px from the bottom and shrinks to 44 px tall so the platform is never covered.

---

## 4. The letter and the clock
- The starting letter lives in the scene: a wooden board 0.9 m by 0.6 m hanging on two ropes from the z = 1 beam directly above the pile (bottom edge at 2.6 m), with the letter carved as voxels in `--wood-ink` 0.5 m tall; trap letters are carved in an ice block instead. The board swings 1.5° with the wind. The icicle timer hangs from the same beam 0.7 m to the right, shrinking with the clock (v3), red in the steal window.
- A 3D-anchored HTML chip just under the board shows the seconds in Nunito 800 at 22 px (coral in the steal window) and the word "starts with" is dropped; the input placeholder reads "Type a word starting with S".
- The round chip and the twist sign stay top-left; the sign gets its snow cap and the twist icon.

---

## 5. Floor and walls
- Hay at the 0.10 m grid, three tones from v3 (#E6C46A, #D9B45C, #C59E45) with the noise capped at 4% on broad areas, 300 loose straws, a trampled darker ring (hay dark) 0.8 m wide under the seats, and bare boards under the platform. Saturation 25% lower than now.
- The far doors open; the snowy yard, fence, pines and farmhouse visible through them (v3 Part 7).
- Both lanterns at (±4.3, 4.5, 1.0) in frame with their cages and ropes; interior light 20% dimmer than now so the pile spot and the lanterns read as pools of light; shadows on with 4096 maps (v3.1 R).

---

## 6. Wool level mapping (fix)
Replace the v3 Part 5.2 table with:

```
coatLevel = clamp( 2 + tier(bankedPoints) - shears, 0, 4 )
tier(p): 0 for p < 40, 1 for 40..79, 2 for 80+
shears: +1 for each failed steal this game (max 3); time-outs do not change the level (they blow one tuft)
```
Everyone starts at level 2 (normal coat). Level 0 shows the sheared body with no tufts (hide the forehead tuft and tail puff too). The frozen sheep keeps whatever level it had.

---

## 7. Phone
Camera fov 46, position (0, 6.8, −12.6), looking at (0, 0.9, 0.6); cards in one row at the top; the letter board and clock chip anchored in 3D as on desktop; the pile tag pinned at least 140 px above the bottom; input bar 44 px at the bottom.

---

## 8. Render settings in this milestone
- `dpr = min(devicePixelRatio, 2)` on desktop (currently 1), `min(devicePixelRatio, 1.5)` on phones; antialias on; shadows on (v3.1 R).
- Keep the dev overlay (triangles, ms per frame, draws, dpr) behind a query flag only.

---

## 9. Acceptance
- At 1920 by 1080: the pile tag and the letter board are the two largest text elements on screen; both readable from two metres away from the monitor.
- The hay occupies no more than 35% of the frame; the far doors, both lanterns and the cross beam are visible; no sky above the walls.
- No sheep is cropped by the frame edge; the "you" sheep has a normal coat at game start.
- The pile never overlaps the input bar at any pile size.
- Frame time under 6 ms on a mid-range phone and under 4 ms on desktop at the new dpr; report numbers.
