/** The loading screen doors' sizes in voxels (src/skin/loading/doorsModel.ts builds them; BarnDoors lays out their
 *  images from these). No imports, so the loading screen does not pull in the voxel code. */
export const DOOR_VOXEL = 0.05;
export const LEAF_W = 48;
export const LEAF_H = 52;
export const DOORS_W = LEAF_W * 2;
/** Rows of the header beam, the most snow piled on it, and the longest icicle under it. */
export const LINTEL_BEAM = 4;
export const LINTEL_SNOW = 3;
export const LINTEL_ICICLE = 6;
/** Rows of the drift at the foot of the doors, at most. */
export const SILL_ROWS = 7;
/** Each part's frame in voxels: the render fills its image with exactly this box, and BarnDoors lays the images out
 *  on one voxel size from the same numbers, so the parts meet where they should on any screen. */
export const DOOR_BOXES = {
  leaves: { x0: 0, y0: 0, w: DOORS_W, h: LEAF_H },
  lintel: { x0: 0, y0: -LINTEL_ICICLE, w: DOORS_W, h: LINTEL_ICICLE + LINTEL_BEAM + LINTEL_SNOW },
  sill: { x0: 0, y0: 0, w: DOORS_W, h: SILL_ROWS },
} as const;

