/**
 * Art-style previews (Brian, 2026-11-09: "people keep saying that the voxels rn look like ai slop"). Preview switches
 * only, read from the URL, so the same scenes can be shot in each look and compared; with no `?art=` nothing changes.
 * Combine them with commas, e.g. `?art=chunky,flat,cel,quiet`.
 *
 * - chunky: no `refine`. Scenery stays on the grid it was built on instead of being halved and bevelled (the soft,
 *   upscaled look), the way touch screens already draw it.
 * - flat:   no per-voxel colour noise. `pick` takes each material's middle shade, snow is one white, refine adds no
 *   grain: colour comes in the shapes the models are built from, not in speckle.
 * - cel:    banded light. The finished frame's brightness is stepped into a few bands, and bloom is off.
 * - quiet:  no seasonal dressing (lights, wreaths, canes, presents, hats).
 */
const want = new Set((() => {
  try { return (new URLSearchParams(globalThis.location?.search ?? '').get('art') ?? '').split(','); } catch { return []; }
})().map((s) => s.trim()).filter(Boolean));

export const ART = {
  chunky: want.has('chunky'),
  flat: want.has('flat'),
  cel: want.has('cel'),
  quiet: want.has('quiet'),
} as const;
