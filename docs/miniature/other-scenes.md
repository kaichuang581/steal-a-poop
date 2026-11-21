# The other scenes: every line that picks a tone or draws a random number (docs/miniature/07, section 8)

As the files stand at the end of M7. Verdicts: **Solid**: one colour for the part. **Step**: one colour, a step from its
neighbour. **Keep**: it places, sizes, counts or chooses for a whole part (a board, a course, a floe, a tuft), never for
a single cube. **Glow**: a light or a lit surface, untouched.

Since 2026-11-18 `pick(tone, r, weights)` no longer reads `r`: it returns the one tone its weights favour, so every
`pick(` below is already one colour a part, and the random number handed to it is dead. `pickBy` still chooses by `r`;
the two left choose a whole floorboard. The lines M7 changed are listed first: each tinted single cubes and is now its
part's average colour (treatment B), so it no longer appears in its file's table.

The tables were made by a script that reads each line (`pick(`, `pickBy(`, a random number indexing a list of tones
with a shift, a cube placed or left out, or anything else) and were checked by reading a sample of each kind, not
every line.

## Changed in M7 (cube-by-cube tints, now each part's average)

| File | Part | Was | Now |
|---|---|---|---|
| `duel.ts` | Water | either of two dark blues, by cube | their average |
| `duel.ts` | Shore bank | either of two slate blues, by cube | `BANK` |
| `duel.ts` | Shore pines' needles | either of two near-blacks, by cube | `NEEDLES` |
| `pen.ts` | Land beyond the pen | either of two snow blues, by cube | `LAND` |
| `pen.ts` | Mountain wall: snow and rock | either of two tones each, by cube | `PEAK_SNOW`, `PEAK_ROCK` |
| `Podium.tsx` | Podium timber | one of four browns, by column | `timber` |
| `Podium.tsx` | Straw on the lower blocks, the floor's straw and tufts, the bales | one of two to four straws, by cube | `thatch`, `bed`, `packed` |
| `world.ts` | Shrub leaves, sapling needles | one of three greens, by cube | their average |
| `world.ts` | Rock | its face's or its side's tone, two cubes at a time | their average; the lump beside it its side's tone (a step) |
| `world.ts` | Hurdle posts | one of two woods, two cubes at a time | their average |
| `world.ts` | Hay obstacle | one of three hays, by cube | their average, each as often as it fell |
| `world.ts` | Sign's planks | each row a few percent lighter or darker | one tone a plank |
| `bedroom.ts` | Window view's hill, the window's trim, the lamp's foot, the clock, the toy sheep, the cuff | one of two tones, by cube | their average, each as often as it fell |
| `bedroom.ts` | The farmer's hair, brows and moustache | a mix of four greys and a dark fleck, by cube | one grey a part: the mix's average |
| `bedroom.ts` | Shirt and sleeve stripes | the blue stripe flecked darker, by cube | one blue |
| `table.ts` (M2) | Letter board's planks | each row a few percent lighter or darker | one tone a plank |

## `src/skin/scene/barn.ts`

| Line | Code | Verdict |
|---|---|---|
| 157 | `const h = hash3(x, y, z, seed);` | Keep: places, sizes or turns a whole part |
| 309 | `const h2 = hash3(x >> 1, 0, z >> 1, 54);` | Keep: places, sizes or turns a whole part |
| 391 | `const top = 2 + Math.floor(hash3(i, 0, 0, 67) * 4);` | Keep: places, sizes or turns a whole part |
| 415 | `const torn = 2 + Math.floor(hash3(z, 0, 0, 71) * 5) + (hash3(z >> 1, 0, 0, 72) < 0.2 ? 4 : 0);` | Keep: chooses for a patch, board or course of several cubes |
| 418 | `const h = hash3(z, y, 0, 73);` | Keep: places, sizes or turns a whole part |

## `src/skin/scene/duel.ts`

| Line | Code | Verdict |
|---|---|---|
| 76 | `const crackAt = (z: number) => Math.round(Math.sin(z * 0.45) * 2 + (hash3(0, 0, z >> 1, 3) - 0.5) * 3);` | Keep: places, sizes or turns a whole part |
| 80 | `if (u ** 4 + v ** 4 > 1 - hash3(x >> 2, 0, z >> 2, 7) * 0.3) continue;` | Keep: places a cube of a ragged edge or a scatter (no cube may move) |
| 82 | `const snow = hash3(x >> 2, 1, z >> 2, 9) > 0.62;` | Keep: places, sizes or turns a whole part |
| 84 | `const r = hash3(x, 0, z, 11), patch = hash3(x >> 2, 0, z >> 2, 11);` | Keep: places, sizes or turns a whole part |
| 86 | `if (y === -1) g.set(x, y, z, crack ? lin(ICE_CRACK) : snow ? pick(T.snow, r) : pick(T.ice, patch));` | Solid: one tone a part (`pick` ignores its random number) |
| 87 | `else g.set(x, y, z, pick(T.ice, r, [0.2, 0.5]));` | Solid: one tone a part (`pick` ignores its random number) |
| 111 | `ellipsoid(g, [x, DUEL.waterY, z], [w, 0.24, w * (0.5 + r() * 0.5)], (a, b, c) => pick(T.ice, hash3(a, b, c, 33), [0.3...` | Solid: one tone a part (`pick` ignores its random number) |
| 122 | `return Math.round(1 + rise + hash3(x >> 2, 0, z >> 2, 41) * (2 + rise * 0.4));` | Keep: places, sizes or turns a whole part |
| 179 | `box(post, [x - 0.1, 0, z - 0.1], [x + 0.1, y - 0.2, z + 0.1], (a, b, c) => pick(T.beam, hash3(a, b, c, 61)));` | Solid: one tone a part (`pick` ignores its random number) |
| 181 | `box(glow, [x - 0.1, y - 0.2, z - 0.1], [x + 0.1, y + 0.3, z + 0.1], (a, b, c) => pick(T.lantern, hash3(a, b, c, 63)));` | Glow |
| 185 | `box(post, [-0.05, -0.1, pz - 0.05], [0.05, armY + 0.1, pz + 0.05], (a, b, c) => pick(T.beam, hash3(a, b >> 1, c, 65)));` | Solid: one tone a part (`pick` ignores its random number) |
| 186 | `box(post, [-0.05, armY, DUEL.hook[2] - 0.15], [0.05, armY + 0.1, pz - 0.05], (a, b, c) => pick(T.beam, hash3(a, b, c ...` | Solid: one tone a part (`pick` ignores its random number) |
| 188 | `box(post, [-0.45, armY, -0.05], [0.45, armY + 0.1, 0.05], (a, b, c) => pick(T.beam, hash3(a >> 1, b, c, 73)));` | Solid: one tone a part (`pick` ignores its random number) |
| 189 | `box(post, [-0.45, armY + 0.1, -0.05], [0.45, armY + 0.2, 0.05], (a, b, c) => (hash3(a, b, c, 69) > 0.35 ? pick(T.snow...` | Solid: one tone a part (`pick` ignores its random number) |
| 190 | `box(post, [-0.05, armY + 0.1, DUEL.hook[2] + 0.05], [0.05, armY + 0.2, pz + 0.05], (a, b, c) => (hash3(a, b, c, 69) >...` | Solid: one tone a part (`pick` ignores its random number) |

## `src/skin/scene/pen.ts`

| Line | Code | Verdict |
|---|---|---|
| 45 | `return { x, z, yaw: Math.PI - x * 0.06 + (hash3(i, 0, 0, 5) - 0.5) * 0.3 }; // the model's front is +z; the camera is...` | Keep: places, sizes or turns a whole part |
| 89 | `const r = hash3(gx, 0, gz, 3);` | Keep: places, sizes or turns a whole part |
| 90 | `let c: RGB = pick(T.snow, r, [0.5, 0.85]);` | Solid: one tone a part (`pick` ignores its random number) |
| 93 | `const patch = hash3(gx >> 2, 1, gz >> 2, 5);` | Keep: places, sizes or turns a whole part |
| 108 | `ellipsoid(g, [x, -0.1, z], [w, 0.34, w * 0.7], (px, py, pz) => pick(T.snow, hash3(px, py, pz, 9), [0.55, 0.9]), 0.15,...` | Solid: one tone a part (`pick` ignores its random number) |
| 165 | `const snowTop = (a: number, b: number, c: number) => pick(T.snow, hash3(a, b, c, 61), [0.55, 0.9]);` | Solid: one tone a part (`pick` ignores its random number) |
| 167 | `ellipsoid(g, [x, w * 0.45, z], [w, w * 0.7, w * 0.8], (a, b, c) => pick(T.stone, hash3(a >> 1, b >> 1, c >> 1, 62 + i...` | Solid: one tone a part (`pick` ignores its random number) |
| 171 | `ellipsoid(g, [x, w * 0.6, z], [w, w * 0.7, w], (a, b, c) => pick(T.pine, hash3(a >> 1, b, c >> 1, 64 + i)), 0.3, 23 +...` | Solid: one tone a part (`pick` ignores its random number) |
| 175 | `const blade = (x: number, z: number, h: number, seed: number) => box(g, [x, hill(x, z), z], [x + 0.125, hill(x, z) + ...` | Solid: one tone a part (`pick` ignores its random number) |
| 178 | `const cx = (hash3(k, 4, 0, 70) * 2 - 1) * 18, cz = -2 + hash3(k, 5, 0, 71) * 24;` | Keep: places, sizes or turns a whole part |
| 181 | `for (let b = 0; b < 4; b++) blade(cx + (hash3(k, b, 1, 72) - 0.5) * 0.5, cz + (hash3(k, b, 2, 73) - 0.5) * 0.5, 0.15 ...` | Keep: places, sizes or turns a whole part |
| 192 | `const top = 16 + Math.abs(Math.sin(wx * 0.0125 + 0.9)) * 16 + Math.sin(wx * 0.041) * 5 + hash3(x, 0, 0, 81) * 4 - sad...` | Keep: places, sizes or turns a whole part |
| 194 | `const high = y * 4 > top - 9 - hash3(x, y, 0, 82) * 5;` | Keep: places, sizes or turns a whole part |
| 209 | `const wood = (a: number, b: number, c: number) => pick(T.beam, hash3(a >> 1, b, c >> 1, 31), [0.45, 0.85]);` | Solid: one tone a part (`pick` ignores its random number) |
| 210 | `const dark = (a: number, b: number, c: number) => pick(T.trunk, hash3(a >> 1, b, c >> 1, 32), [0.45, 0.85]);` | Solid: one tone a part (`pick` ignores its random number) |
| 211 | `const snow = (a: number, b: number, c: number) => (hash3(a, b, c, 33) > 0.22 ? pick(T.snow, hash3(a, 0, c, 35)) : null);` | Solid: one tone a part (`pick` ignores its random number) |
| 217 | `box(g, [x - 0.1, h, z - 0.1], [x + 0.1, h + 0.1, z + 0.1], (a, b, c) => pick(T.snow, hash3(a, b, c, 37)));` | Solid: one tone a part (`pick` ignores its random number) |
| 254 | `box(g, [rx - 0.95, 0.55, rz - 0.24], [rx + 0.95, 0.98, rz + 0.25], (a, b, c) => pick(T.hay, hash3(a, b, c, 41), [0.4,...` | Solid: one tone a part (`pick` ignores its random number) |
| 256 | `box(g, [rx - 0.8, 0, rz - 0.75], [rx + 0.7, 0.1, rz - 0.35], (a, b, c) => (hash3(a, b, c, 43) > 0.35 ? pick(T.hay, ha...` | Solid: one tone a part (`pick` ignores its random number) |
| 260 | `box(g, [tx - 0.8, 0.4, tz - 0.2], [tx + 0.8, 0.5, tz + 0.2], (a, b, c) => pick(T.ice, hash3(a, b, c, 49)));` | Solid: one tone a part (`pick` ignores its random number) |
| 264 | `const dx = (hash3(i, k, 0, 51) - 0.5) * 0.7, dz = (hash3(i, k, 1, 52) - 0.5) * 0.6;` | Keep: places, sizes or turns a whole part |
| 265 | `const h = 0.1 + Math.round(hash3(i, k, 2, 53) * 3 * (1 - Math.hypot(dx, dz))) * 0.1;` | Keep: places, sizes or turns a whole part |
| 266 | `box(g, [px + dx, 0, pz + dz], [px + dx + 0.1, h, pz + dz + 0.1], (a, b, c) => pick(GRASS, hash3(a, b, c, 54 + i)));` | Solid: one tone a part (`pick` ignores its random number) |
| 278 | `box(glow, [lx - 0.15, ly - 0.15, lz - 0.8], [lx + 0.15, ly + 0.2, lz - 0.5], (a, b, c) => pick(T.lantern, hash3(a, b,...` | Glow |
| 281 | `box(glow, [qx - 0.1, qy - 0.15, qz - 0.1], [qx + 0.1, qy + 0.1, qz + 0.1], (a, b, c) => pick(T.lantern, hash3(a, b, c...` | Glow |

## `src/skin/dream/world.ts`

| Line | Code | Verdict |
|---|---|---|
| 112 | `for (const v of g.map.values()) if (!g.has(v.x, v.y + 1, v.z) && hash3(v.x, v.y, v.z, 5) < chance) tops.push([v.x, v....` | Keep: places, sizes or turns a whole part |
| 125 | `g.set(X + dx, Y + i - (edge && r > 1 ? 1 : 0), Z + dz, tier === 3 && hash3(dx, i, dz, 3) > 0.35 ? snow : green);` | Keep: places a cube of a ragged edge or a scatter (no cube may move) |
| 167 | `if (hash3(dx, 5, dz, 9) > 0.5) g.set(X + dx, Y + h + 1, Z + dz, snow);` | Keep: places, sizes or turns a whole part |
| 242 | `const bauble = hash3(dx, y, dz, 77); // the festive season's baubles (v0.3.0)` | Keep: places, sizes or turns a whole part |
| 382 | `const wood: Paint = (x, y, z) => pick(T.beam, hash3(x, y, z, 17), [0.45, 0.85]);` | Solid: one tone a part (`pick` ignores its random number) |
| 388 | `return index === 0 ? 'rail' : FENCE_LOOKS[Math.floor(hash3(index, 3, 1, 77) * FENCE_LOOKS.length)];` | Keep: places, sizes or turns a whole part |
| 440 | `g.set(x, y, z, tones[Math.floor(hash3(z >> 3, course, left ? 3 : 4, 3) * 2.99)]);` | Keep: chooses for a patch, board or course of several cubes |
| 452 | `for (let z = z0; z < z1; z++) g.set(x, y, z, z === z0 \|\| z === z1 - 1 ? cut[Math.floor(d) % 2] : bark[Math.floor(ha...` | Keep: chooses for a patch, board or course of several cubes |
| 561 | `for (let x = 1; x < W - 1; x++) if (hash3(x, H, 0, 41) > 0.3) { b.set(x, H, 0, snow); b.set(x, H, 1, snow); }` | Keep: places, sizes or turns a whole part |
| 586 | `if (hash3(x, SIGN.post, z, 9) > 0.25) p.set(x, SIGN.post + 1, z, snow);` | Keep: places, sizes or turns a whole part |

## `src/skin/dream/bedroom.ts`

| Line | Code | Verdict |
|---|---|---|
| 88 | `if (y <= 16) return mod(u, 4) === 0 ? lin(SAGE[2]) : lin(SAGE[hash3(Math.floor(u / 4), 0, seed, 41) < 0.55 ? 0 : 1]);` | Keep: places, sizes or turns a whole part |
| 92 | `const r = hash3(Math.floor((u + off) / 44), row, seed, 43);` | Keep: places, sizes or turns a whole part |
| 112 | `const pine = hash3(Math.floor(u / 5), 0, seed, 61) < 0.35 ? 5 - Math.abs(mod(u, 5) - 2) * 2 : 0;` | Keep: places, sizes or turns a whole part |
| 118 | `else if (hash3(u, y, seed, 67) < 0.025 && y > Math.max(hill + 7, h.y0 + 9)) col = hash3(u, y, seed, 69) < 0.5 ? '#FFF...` | Keep: places, sizes or turns a whole part |
| 140 | `const k = Math.min(u - h.u0, h.u1 - 1 - u), deep = k < 2 ? 3 : 1 + (hash3(u, 0, seed, 73) < 0.4 ? 1 : 0);` | Keep: places, sizes or turns a whole part |
| 186 | `const wood = (seed: number): Paint => (x, y, z) => pick(WALNUT, hash3(x >> 1, y >> 2, z >> 1, seed), [0.55, 0.92]);` | Solid: one tone a part (`pick` ignores its random number) |
| 203 | `g.set(x, -1, z, seam ? lin(FLOOR[2]) : pickBy(FLOOR, hash3(Math.floor((x + off) / 40), row, 0, 7), [0.5, 0.95]));` | Keep: chooses a whole board |
| 209 | `for (let x = Math.round(SIDE_X / B); x < Math.round(ROOM_X1 / B); x++) for (let y = by; y < by + 2; y++) for (let z =...` | Solid: one tone a part (`pick` ignores its random number) |
| 466 | `const skin: Paint = (x, y, z) => (y < 0 ? null : pick(SKIN, hash3(x >> 1, y >> 1, z >> 1, 5), [0.72, 0.97]));` | Solid: one tone a part (`pick` ignores its random number) |
| 489 | `const d = ((x + 0.5) / 8.4) ** 2 + ((z + 0.5) / 7.4) ** 2, tuft = hash3(x >> 1, y, z >> 1, 31);` | Keep: places, sizes or turns a whole part |
| 498 | `const ax = x < 0 ? -x - 1 : x, ragged = hash3(x, y, 0, 21);` | Keep: places, sizes or turns a whole part |
| 507 | `if (ax < 5 \|\| hash3(x, y, 0, 23) > (y === 4 ? 0.7 : 0.3)) continue;` | Keep: places a cube of a ragged edge or a scatter (no cube may move) |
| 542 | `for (let z = frontZ(g, x, y)!; z <= 7 + (y === 3 && hash3(x, y, 0, 15) < 0.3 ? 1 : 0); z++) g.set(x, y, z, stache(x, ...` | Keep: places, sizes or turns a whole part |
| 571 | `if (((x + 0.5) / rx) ** 2 + ((z + 0.5) / rz) ** 2 <= 1) cap.set(x, y, z, pick(WHISKER, hash3(x, y, z, 11), [0.6, 0.95...` | Solid: one tone a part (`pick` ignores its random number) |
| 574 | `ellipsoid(cap, [tip[0] + 0.02, tip[1] - 0.04, 0], [0.05, 0.05, 0.05], (x, y, z) => pick(WHISKER, hash3(x, y, z, 13), ...` | Solid: one tone a part (`pick` ignores its random number) |
| 599 | `const handSkin: Paint = (x, y, z) => pick(SKIN, hash3(x, y, z, 5), [0.72, 0.97]);` | Solid: one tone a part (`pick` ignores its random number) |
| 641 | `const fist: Paint = (x, y, z) => (z >= 9 && mod(x, 2) === 0 && y >= 7 ? lin('#B9735A') : pick(['#E5A47F', '#D8936F', ...` | Solid: one tone a part (`pick` ignores its random number) |

## `src/skin/table/Podium.tsx`

| Line | Code | Verdict |
|---|---|---|
| 100 | `g.set(x, y, 0, board[Math.floor(hash3(x >> 3, y, 0, 7) * 3)]);` | Keep: chooses for a patch, board or course of several cubes |
| 101 | `g.set(x, y, 1, rim ? groove : board[Math.floor(hash3(x >> 3, y, 1, 7) * 3)]);` | Keep: chooses for a patch, board or course of several cubes |
| 110 | `for (let x = -44; x < 44; x++) for (let y = 0; y < 28; y++) g.set(x, y, 0, x % 4 === 0 ? seam : red[Math.floor(hash3(...` | Keep: chooses for a patch, board or course of several cubes |
| 126 | `g.set(x, y, 0, frame \|\| cross ? white : lx % 4 === 0 ? seam : red[Math.floor(hash3(x >> 2, y >> 3, 0, 9) * 3)]);` | Keep: chooses for a patch, board or course of several cubes |
| 142 | `g.set(x, 0, z, hash3(x >> 1, 0, z >> 1, 11) < 0.06 ? dirt : bed); // the darker patches are two cubes a side, whole` | Keep: chooses for a patch, board or course of several cubes |
| 143 | `if (hash3(x, 1, z, 13) < 0.09) g.set(x, 1, z, bed); // a stray tuft: where it lay` | Keep: places, sizes or turns a whole part |

## `src/skin/voxel/table.ts`

| Line | Code | Verdict |
|---|---|---|
| 25 | `const r = hash3(board, 0, 0, 3), tone = shade(T.beam[r < 0.1 ? 0 : r < 0.45 ? 1 : 2]); // dark wood, one tone per board` | Keep: places, sizes or turns a whole part |
| 54 | `const toneR = hash3(i, 0, 0, 75);` | Keep: places, sizes or turns a whole part |

## `src/skin/voxel/props.ts`

| Line | Code | Verdict |
|---|---|---|
| 17 | `const wood = (x: number, y: number, z: number) => pick(T.beam, hash3(x, y >> 1, z, 91), [0.3, 0.75]);` | Solid: one tone a part (`pick` ignores its random number) |
| 24 | `g.set(x, y, -2, rim ? lin(T.beam[2]) : pick(T.beam, hash3(x >> 2, y, 0, 93), [0.15, 0.4]));` | Solid: one tone a part (`pick` ignores its random number) |
| 29 | `for (let x = x0; x <= x1; x++) if (hash3(x, top, 0, 95) > 0.3) g.set(x, top + 1, -2, pick(T.snow, hash3(x, 0, 0, 97)));` | Solid: one tone a part (`pick` ignores its random number) |
| 30 | `for (let x = -1; x <= 0; x++) for (let z = -1; z <= 0; z++) if (hash3(x, height, z, 99) > 0.2) g.set(x, height, z, pi...` | Solid: one tone a part (`pick` ignores its random number) |
| 36 | `g.set(x, y, z, pick(T.ice, hash3(x, y, z, 101)));` | Solid: one tone a part (`pick` ignores its random number) |
