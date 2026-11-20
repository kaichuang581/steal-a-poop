/**
 * The ground shade map (docs/miniature/04, section 5): one picture of the farm from above, white where the ground is
 * open and darker where something stands on it or close by. The voxel material multiplies the snow's colour by it on
 * ground-level top faces, so the snow is gently darker along a wall's foot and round a post. Baked once from the
 * models' own cubes; nothing is drawn or blurred per frame.
 *
 * Models tell it what stands where as they are built (`noteShade`); `bakeShade` turns that into the texture. Only
 * the start screen and the barn table read it (a scene with `userData.groundShade` set): every other scene, and
 * `?shade=off`, reads a white texel.
 */
import { ClampToEdgeWrapping, DataTexture, LinearFilter, RedFormat, UnsignedByteType, Vector2 } from 'three';
import type { Texture } from 'three';
import type { Voxel } from './mesher';

/** The map's ground: x from -44 to 44, z from the line (-16) to 50, one texel per 0.1 m. Behind the line there is no map. */
export const SHADE_AREA = { x: -44, z: -16, w: 88, d: 66, texel: 0.1 };
const NX = Math.round(SHADE_AREA.w / SHADE_AREA.texel), NZ = Math.round(SHADE_AREA.d / SHADE_AREA.texel);
/** Above this, a cube's underside shades nothing; at the ground it shades fully. */
const REACH = 0.8;
/** The barn's floor is the table's: never shaded. */
const BARN_FLOOR = { minX: -6.2, maxX: 6.2, minZ: -4.4, maxZ: 7.2 };

const white = () => {
  const t = new DataTexture(new Uint8Array([255]), 1, 1, RedFormat, UnsignedByteType);
  t.needsUpdate = true;
  return t;
};
const WHITE: Texture = white();
let baked: Texture | null = null;
/** The uniforms every voxel material shares (voxel/material.ts). */
export const SHADE_UNIFORMS = { uGroundShade: { value: WHITE }, uShadeOrigin: { value: new Vector2(SHADE_AREA.x, SHADE_AREA.z) }, uShadeSize: { value: new Vector2(SHADE_AREA.w, SHADE_AREA.d) } };
const OFF = typeof location !== 'undefined' && new URLSearchParams(location.search).get('shade') === 'off';
/** Points the shared uniform at the map for a scene that asks for it, at the white texel for any other. */
export const shadeFor = (scene: { userData: Record<string, unknown> }) => { SHADE_UNIFORMS.uGroundShade.value = scene.userData.groundShade && baked && !OFF ? baked : WHITE; };

/** How much stands over each texel, 0 to 1: the largest weight any cube gave it. */
let weight: Float32Array | null = null;
let fresh = false;

/**
 * Counts a model's cubes: every cube whose underside is under 0.8 m shades the texels beneath it, fully when it
 * touches the ground, less the higher it hangs. `lift` is the model's own height off the ground, in metres. The ground
 * itself (snow, drifts, paths, straw, ice) is never handed in.
 */
export function noteShade(cubes: Iterable<Voxel>, size: number, lift = 0, keep?: (v: Voxel) => boolean): void {
  weight ??= new Float32Array(NX * NZ);
  const { x: X, z: Z, texel } = SHADE_AREA;
  for (const v of cubes) {
    const under = v.y * size + lift;
    if (under >= REACH || under < -0.051 || (keep && !keep(v))) continue;
    const w = 1 - Math.max(0, under - 0.05) / (REACH - 0.05);
    const x0 = Math.floor((v.x * size - X) / texel + 1e-6), x1 = Math.max(x0, Math.ceil(((v.x + 1) * size - X) / texel - 1e-6) - 1);
    const z0 = Math.floor((v.z * size - Z) / texel + 1e-6), z1 = Math.max(z0, Math.ceil(((v.z + 1) * size - Z) / texel - 1e-6) - 1);
    for (let z = Math.max(0, z0); z <= Math.min(NZ - 1, z1); z++)
      for (let x = Math.max(0, x0); x <= Math.min(NX - 1, x1); x++)
        if (w > weight[z * NX + x]) { weight[z * NX + x] = w; fresh = true; }
  }
}

/** A box blur of `radius` texels, `times` over, along x then z. */
function blur(src: Float32Array, radius: number, times: number): Float32Array {
  let a = Float32Array.from(src), b = new Float32Array(src.length);
  const pass = (n: number, stride: number, lines: number, step: number) => {
    for (let l = 0; l < lines; l++) {
      const at = (i: number) => a[l * step + Math.max(0, Math.min(n - 1, i)) * stride];
      let sum = 0;
      for (let i = -radius; i <= radius; i++) sum += at(i);
      for (let i = 0; i < n; i++) { b[l * step + i * stride] = sum / (2 * radius + 1); sum += at(i + radius + 1) - at(i - radius); }
    }
    [a, b] = [b, a];
  };
  for (let t = 0; t < times; t++) { pass(NX, 1, NZ, NX); pass(NZ, NX, NX, 1); }
  return a;
}

/** The shade of every texel, 0.6 to 1, from what was noted: a tight blur for the dark line at a thing's foot, a wide one for the soft patch round it. */
export function shadeValues(): Float32Array {
  const w = weight ?? new Float32Array(NX * NZ), tight = blur(w, 1, 2), wide = blur(w, 4, 3), out = new Float32Array(NX * NZ);
  const { x: X, z: Z, texel } = SHADE_AREA;
  for (let z = 0; z < NZ; z++)
    for (let x = 0; x < NX; x++) {
      const mx = X + (x + 0.5) * texel, mz = Z + (z + 0.5) * texel, i = z * NX + x;
      const inBarn = mx > BARN_FLOOR.minX && mx < BARN_FLOOR.maxX && mz > BARN_FLOOR.minZ && mz < BARN_FLOOR.maxZ;
      out[i] = inBarn ? 1 : Math.max(0.6, 1 - 0.3 * tight[i] - 0.2 * wide[i]);
    }
  return out;
}

/**
 * Bakes the map from everything noted so far, if anything new was. `low`: one texel per 0.2 m. Cheap to call again:
 * it does nothing until a model notes something new.
 */
export function bakeShade(low = false): void {
  if (!fresh && baked) return;
  fresh = false;
  const s = shadeValues(), k = low ? 2 : 1, nx = NX / k, nz = NZ / k, data = new Uint8Array(nx * nz);
  for (let z = 0; z < nz; z++)
    for (let x = 0; x < nx; x++) {
      let sum = 0;
      for (let dz = 0; dz < k; dz++) for (let dx = 0; dx < k; dx++) sum += s[(z * k + dz) * NX + x * k + dx];
      data[z * nx + x] = Math.round((sum / (k * k)) * 255);
    }
  const t = new DataTexture(data, nx, nz, RedFormat, UnsignedByteType);
  t.magFilter = t.minFilter = LinearFilter;
  t.wrapS = t.wrapT = ClampToEdgeWrapping;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  baked?.dispose();
  baked = t;
}
