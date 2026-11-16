// Reading and comparing the gate's pictures. No new package: PNGs are decoded with the reader that ships inside
// playwright-core (pngjs, in its utilsBundle). That file is not part of Playwright's public face, so if a later version
// moves it, the small decoder at the foot of this file takes over (8-bit RGB and RGBA, not interlaced: what a browser
// screenshot is). Both give the same bytes (checked on real shots; see README.md).
//
//   compare(a, b)            how far apart two pictures are: the plan's numbers (file 16, section 4.1 d)
//   withinLimits(result, limits)  whether that is inside the plan's limits, or a shot's own tighter ones
//   maskIoU(a, b, isMagenta) how well the wendigo's debug shape in two pictures overlaps
import { createRequire } from 'node:module';
import { inflateSync } from 'node:zlib';

let PNG = null;
try { PNG = createRequire(import.meta.url)('playwright-core/lib/utilsBundle').PNG ?? null; } catch { PNG = null; }
/** Which decoder is in use: 'playwright-core' or 'built-in'. */
export const decoder = PNG ? 'playwright-core' : 'built-in';

/** A PNG file's bytes as { width, height, data }: data is RGBA, one byte each, row by row from the top left. */
export function decode(buffer) {
  if (buffer && buffer.data && buffer.width && buffer.height) return buffer; // already decoded
  if (PNG) {
    const img = PNG.sync.read(Buffer.from(buffer));
    return { width: img.width, height: img.height, data: img.data };
  }
  return decodePlain(buffer);
}

/**
 * The plan's two limits (file 16, section 4.1 d): at most 0.5 % of pixels more than 24 of 255 apart, and no 16 x 9
 * tile's mean more than 3 apart. A shot's own tolerance may be tighter (four times its measured noise), never looser.
 */
export const PLAN_LIMITS = { share: 0.005, tileMean: 3 };

/**
 * How far apart two pictures are. A pixel differs when any of its red, green, blue or alpha is more than `threshold`
 * (of 255) from the other picture's. Then the mean colour of each tile is compared: a faint change spread over an area
 * moves no single pixel far, but it moves the mean.
 *
 * "No 16 x 9 tile's mean" can be read two ways, and both are measured:
 *   worstTileMeanDelta    the picture cut into a grid of tileCols x tileRows tiles (16 x 9: 80 x 89 pixels each at 1280 x 800);
 *   worstPatchMeanDelta   the picture cut into tiles of patchWidth x patchHeight pixels (16 x 9 pixels).
 * The second is the stricter, and the one that does what the plan asks of this check ("a 40 px change in one scene
 * fails"): a 40 x 40 block moved 40 px, at 400 places in each of five of the gate's own shots, was caught by the grid
 * 24 to 57 % of the time and by the small tiles 81 to 99.8 % (README.md, "The tile rule"). withinLimits() holds both to the limit.
 *
 * Returns { sameSize, width, height, pixels, differing, share, worstTileMeanDelta, worstTile: { col, row },
 * worstPatchMeanDelta, worstPatch: { x, y } }. `share` is differing / pixels (0 to 1). A mean delta is the largest gap,
 * on any one channel, between a tile's mean in the two pictures; worstPatch is that tile's top left pixel. Pictures of
 * different sizes are wholly different: share 1, both deltas 255. a and b are PNG bytes, or pictures already decoded.
 */
export function compare(a, b, { threshold = 24, tileCols = 16, tileRows = 9, patchWidth = 16, patchHeight = 9 } = {}) {
  const A = decode(a), B = decode(b);
  const pixels = A.width * A.height;
  if (A.width !== B.width || A.height !== B.height) {
    return { sameSize: false, width: A.width, height: A.height, pixels, differing: pixels, share: 1, worstTileMeanDelta: 255, worstTile: { col: 0, row: 0 }, worstPatchMeanDelta: 255, worstPatch: { x: 0, y: 0 } };
  }
  const { width, height } = A;
  const da = A.data, db = B.data;
  const tiles = tileCols * tileRows;
  const patchCols = Math.ceil(width / patchWidth), patchRows = Math.ceil(height / patchHeight);
  // Per tile and channel, the sum of (a - b): the gap between the two means is that over the tile's pixel count.
  const sums = new Float64Array(tiles * 3);
  const counts = new Uint32Array(tiles);
  const patchSums = new Float64Array(patchCols * patchRows * 3);
  const patchCounts = new Uint32Array(patchCols * patchRows);
  let differing = 0;
  for (let y = 0; y < height; y++) {
    const row = Math.min(tileRows - 1, Math.floor((y * tileRows) / height));
    const patchRow = Math.floor(y / patchHeight) * patchCols;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const dr = da[i] - db[i], dg = da[i + 1] - db[i + 1], dbl = da[i + 2] - db[i + 2], dal = da[i + 3] - db[i + 3];
      if (Math.abs(dr) > threshold || Math.abs(dg) > threshold || Math.abs(dbl) > threshold || Math.abs(dal) > threshold) differing++;
      const t = row * tileCols + Math.min(tileCols - 1, Math.floor((x * tileCols) / width));
      sums[t * 3] += dr; sums[t * 3 + 1] += dg; sums[t * 3 + 2] += dbl;
      counts[t]++;
      const p = patchRow + Math.floor(x / patchWidth);
      patchSums[p * 3] += dr; patchSums[p * 3 + 1] += dg; patchSums[p * 3 + 2] += dbl;
      patchCounts[p]++;
    }
  }
  const worstOf = (total, count) => {
    let worst = 0, at = 0;
    for (let t = 0; t < count.length; t++) {
      if (!count[t]) continue;
      const d = Math.max(Math.abs(total[t * 3]), Math.abs(total[t * 3 + 1]), Math.abs(total[t * 3 + 2])) / count[t];
      if (d > worst) { worst = d; at = t; }
    }
    return { worst, at };
  };
  const grid = worstOf(sums, counts), patch = worstOf(patchSums, patchCounts);
  return {
    sameSize: true, width, height, pixels, differing, share: pixels ? differing / pixels : 0,
    worstTileMeanDelta: grid.worst, worstTile: { col: grid.at % tileCols, row: Math.floor(grid.at / tileCols) },
    worstPatchMeanDelta: patch.worst, worstPatch: { x: (patch.at % patchCols) * patchWidth, y: Math.floor(patch.at / patchCols) * patchHeight },
  };
}

/**
 * Whether what compare() found is inside the limits: the share of differing pixels, and the tile rule under both of
 * its readings. `limits` may be tighter than the plan's (a shot's own tolerance); a looser one is cut back to the
 * plan's, so no caller can let more through than the plan does.
 */
export function withinLimits(result, limits = PLAN_LIMITS) {
  const share = Math.min(limits.share ?? PLAN_LIMITS.share, PLAN_LIMITS.share);
  const tileMean = Math.min(limits.tileMean ?? PLAN_LIMITS.tileMean, PLAN_LIMITS.tileMean);
  return result.sameSize && result.share <= share && result.worstTileMeanDelta <= tileMean && result.worstPatchMeanDelta <= tileMean;
}

/**
 * The wendigo's debug colour. `?wendigoDebug` paints its hide with an unlit, unfogged #ff00ff
 * (src/skin/table/Wendigo.tsx:81). On the gate's shot the middle of the figure comes out near (240, 32, 224), and its
 * soft edge (the shot is tilt-shifted) fades toward the pines behind: paler by day, darker at night. So: red and blue
 * both well over green, close to each other, and not near black. Measured on the gate's own shots (README.md, "The
 * wendigo's mask"): 693 pixels by day, 864 at night, none in any other place the gate photographs.
 */
export function isMagenta(r, g, b) {
  return Math.min(r, b) - g >= 60 && Math.abs(r - b) <= 80 && Math.max(r, b) >= 90;
}

/** How many pixels of a picture `isMask(r, g, b, a)` picks out. */
export function countMask(a, isMask = isMagenta) {
  const A = decode(a);
  let n = 0;
  for (let i = 0; i < A.data.length; i += 4) if (isMask(A.data[i], A.data[i + 1], A.data[i + 2], A.data[i + 3])) n++;
  return n;
}

/**
 * Intersection over union of the pixels `isMask` picks out of two pictures: 1 when the two shapes cover exactly the
 * same pixels, 0 when they share none. Returns { iou, a, b, both, either, sameSize } (pixel counts). Two empty masks
 * score 0, not 1: a check that never saw the shape must not pass. So do pictures of different sizes.
 */
export function maskIoU(a, b, isMask = isMagenta) {
  const A = decode(a), B = decode(b);
  if (A.width !== B.width || A.height !== B.height) return { iou: 0, a: countMask(A, isMask), b: countMask(B, isMask), both: 0, either: 0, sameSize: false };
  let inA = 0, inB = 0, both = 0, either = 0;
  for (let i = 0; i < A.data.length; i += 4) {
    const ma = isMask(A.data[i], A.data[i + 1], A.data[i + 2], A.data[i + 3]);
    const mb = isMask(B.data[i], B.data[i + 1], B.data[i + 2], B.data[i + 3]);
    if (ma) inA++;
    if (mb) inB++;
    if (ma && mb) both++;
    if (ma || mb) either++;
  }
  return { iou: either ? both / either : 0, a: inA, b: inB, both, either, sameSize: true };
}

// ---------------------------------------------------------------------------------------------------------------------
// The stand-in decoder, used only if playwright-core's reader cannot be reached
// ---------------------------------------------------------------------------------------------------------------------

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** A plain PNG decoder on node:zlib: 8 bits a channel, RGB or RGBA, not interlaced. Throws on anything else. */
export function decodePlain(buffer) {
  const buf = Buffer.from(buffer);
  if (buf.length < 8 || !buf.subarray(0, 8).equals(SIGNATURE)) throw new Error('not a PNG file');
  let width = 0, height = 0, channels = 0;
  const idat = [];
  for (let at = 8; at + 8 <= buf.length;) {
    const length = buf.readUInt32BE(at);
    const type = buf.toString('latin1', at + 4, at + 8);
    const body = buf.subarray(at + 8, at + 8 + length);
    if (type === 'IHDR') {
      width = body.readUInt32BE(0); height = body.readUInt32BE(4);
      const depth = body[8], colour = body[9], interlace = body[12];
      if (depth !== 8 || (colour !== 2 && colour !== 6) || interlace !== 0) throw new Error(`this PNG is not 8-bit RGB or RGBA, or is interlaced (depth ${depth}, colour type ${colour}, interlace ${interlace})`);
      channels = colour === 6 ? 4 : 3;
    } else if (type === 'IDAT') idat.push(body);
    else if (type === 'IEND') break;
    at += 12 + length;
  }
  if (!width || !height) throw new Error('this PNG has no header');
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const out = new Uint8Array(width * height * 4);
  const line = new Uint8Array(stride), prev = new Uint8Array(stride);
  for (let y = 0; y < height; y++) {
    const from = y * (stride + 1);
    const filter = raw[from];
    for (let x = 0; x < stride; x++) {
      const v = raw[from + 1 + x];
      const left = x >= channels ? line[x - channels] : 0;
      const up = prev[x];
      const upLeft = x >= channels ? prev[x - channels] : 0;
      let add = 0;
      if (filter === 1) add = left;
      else if (filter === 2) add = up;
      else if (filter === 3) add = (left + up) >> 1;
      else if (filter === 4) {
        const p = left + up - upLeft;
        const pa = Math.abs(p - left), pb = Math.abs(p - up), pc = Math.abs(p - upLeft);
        add = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
      } else if (filter !== 0) throw new Error(`unknown PNG row filter ${filter}`);
      line[x] = (v + add) & 255;
    }
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4, s = x * channels;
      out[o] = line[s]; out[o + 1] = line[s + 1]; out[o + 2] = line[s + 2];
      out[o + 3] = channels === 4 ? line[s + 3] : 255;
    }
    prev.set(line);
  }
  return { width, height, data: out };
}
