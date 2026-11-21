/**
 * Where scenery keeps the colours it had before 2026-11-18 (Brian: "remove all glitchy/static textures"): the wendigo's
 * zone, whose every voxel is pinned (tools/scenes/wendigo.pins.json; CLAUDE.md, the wendigo zone). Builders paint there
 * with `asBefore` (voxel/palette.ts) and flat everywhere else. Numbers are WENDIGO_AT and POV_SHOTS.desktop[2]
 * (countryside.ts, homePov.ts), written out so the builders need not import them (wendigoFence.test.ts pins both).
 */
const W = [-9.6, -36.1] as const;
/** The paddock camera, about the middle of its push. */
const CAM = [20.3, 6.45] as const;

/** Within 14 m of the wendigo along the ground: its 12 m stand and a margin. */
export const nearWendigo = (x: number, z: number) => Math.hypot(x - W[0], z - W[1]) < 14;

/** Within `deg` degrees of the paddock camera's line to the wendigo, and `from` metres or more from the camera: its cone. */
export function inWendigoSight(x: number, z: number, deg = 14, from = 30): boolean {
  const wx = W[0] - CAM[0], wz = W[1] - CAM[1], px = x - CAM[0], pz = z - CAM[1], d = Math.hypot(px, pz);
  return d > from && (px * wx + pz * wz) / (d * Math.hypot(wx, wz)) > Math.cos((deg * Math.PI) / 180);
}

/**
 * Whether a thing standing at (x, z) and reaching up to 5 m from there (a tall pine's boughs) keeps the look it had:
 * within 17 m of the wendigo, or within 20 degrees of the paddock camera's line to it.
 */
export const standsInWendigoZone = (x: number, z: number) => Math.hypot(x - W[0], z - W[1]) < 17 || inWendigoSight(x, z, 20, 25);

/** Either: what must be painted as before. */
export const inWendigoZone = (x: number, z: number) => nearWendigo(x, z) || inWendigoSight(x, z);
