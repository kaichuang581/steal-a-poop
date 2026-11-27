import type { BufferGeometry } from 'three';
import { Gather, isGlow, meshModel, tokenColour } from '../../dream/models';
import type { Arrays } from '../../dream/models';
import { COLOURS as DREAM_COLOURS, GLOW, MODELS as DREAM_MODELS, PARTS as DREAM_PARTS } from '../../dream/models.gen';
import { FACE_SHADE } from '../../voxel/mesher';
import { addModels, MODELS as TP_MODELS, tpMesh } from '../models';
import { RINK, RINK_MODELS } from '../rink.gen';

addModels(RINK_MODELS);

/**
 * The rink (docs/trading-post-practice/P1): every placement of data/rink.json, merged into one lit mesh and one glow
 * mesh. Home's far farm (barn, silo, farmhouse, fence, pines) is the dream pack's copy of it. Each face keeps the
 * night's face light of P1 section 4 and the tint by depth, worked into its vertex colours: nothing here is lit by a lamp.
 */
type Light = readonly [number, number, number];
const L = RINK.light;
/** The plan's face light for a face, given its normal. */
function faceLight(nx: number, ny: number, nz: number): Light {
  if (ny > 0.5) return L.top as Light;
  if (ny < -0.5) return L.bottom as Light;
  if (nz > 0.5 || nz < -0.5) return L.front as Light;
  return (nx < 0 ? L.left : L.right) as Light;
}
const FACE_OF = (nx: number, ny: number, nz: number) => FACE_SHADE(Math.abs(nx) > 0.5 ? 0 : Math.abs(ny) > 0.5 ? 1 : 2, nx + ny + nz > 0 ? 1 : -1);

/** The tint by depth (P1 section 4), straight lines between the plan's stops. */
export function tintAt(z: number, stops: { z: readonly number[]; tint: readonly number[] } = RINK.tint_at_z): number {
  const { z: zs, tint } = stops;
  if (z <= zs[0]) return tint[0];
  for (let i = 1; i < zs.length; i++) if (z <= zs[i]) return tint[i - 1] + ((tint[i] - tint[i - 1]) * (z - zs[i - 1])) / (zs[i] - zs[i - 1]);
  return tint[tint.length - 1];
}

/** Relights a gathered mesh: the mesher's face shade out, the plan's face light and the depth tint in. */
function relight(a: Arrays, start: number, tint: number): void {
  for (let i = start; i < a.pos.length / 3; i++) {
    const nx = a.nor[i * 3], ny = a.nor[i * 3 + 1], nz = a.nor[i * 3 + 2];
    const l = faceLight(nx, ny, nz), s = FACE_OF(nx, ny, nz);
    for (let k = 0; k < 3; k++) a.col[i * 3 + k] = (a.col[i * 3 + k] / s) * l[k] * tint;
  }
}

/** A glow: where, its colour (linear), its radius and strength (P1 section 4). */
export interface Glow { at: [number, number, number]; rgb: [number, number, number]; radius: number; strength: number }

const PINE: Record<string, string> = { spire: 'pineSpire', cone: 'pineCone', round: 'pineRound' };

export interface Rink { lit: BufferGeometry; glow: BufferGeometry; glows: Glow[] }

export function buildRink(festive: boolean, low = false): Rink {
  const lit = new Gather(), glow = new Gather(), glows: Glow[] = [];
  const place = (mm: { lit: Arrays; glow: Arrays }, x: number, y: number, z: number, scale: readonly [number, number, number] = [1, 1, 1]) => {
    const n = lit.a.pos.length / 3;
    lit.add(mm.lit, x, y, z, 1, scale);
    relight(lit.a, n, tintAt(z));
    glow.add(mm.glow, x, y, z, 1, scale);
  };
  for (const it of RINK.items) {
    const id = it.model;
    // The game's own sheepdog sits on the chair, whistle and all, and the board is drawn with its face (RinkTable).
    if (id === 'dogStandIn' || id === 'whistle' || id === 'tallyBoard') continue;
    const pine = /^pine_(\w+)_([\d.]+)$/.exec(id);
    if (pine) {
      if (low) continue;
      const pid = PINE[pine[1]], m = DREAM_MODELS[pid], k = Number(pine[2]) / ((m.bounds[4] - m.bounds[1]) * m.cell);
      place(meshModel(pid, m, DREAM_COLOURS, GLOW, { festive, ao: false }), it.x, it.y, it.z, [k, k, k]);
      continue;
    }
    if (!TP_MODELS[id] && DREAM_MODELS[id]) {
      if (low && id === 'fenceBay') continue;
      const parts = it.parts ? (it.parts as readonly string[]).reduce((s, p) => s | (1 << DREAM_PARTS.indexOf(p)), 0) : 0;
      place(meshModel(id, DREAM_MODELS[id], DREAM_COLOURS, GLOW, { festive, ao: false, parts }), it.x, it.y, it.z);
      continue;
    }
    const mm = tpMesh(id, { festive });
    place(mm, it.x, it.y, it.z);
  }
  // Lantern glows of the models that give light (the corner posts), and the boards' bulbs.
  for (const it of RINK.items) {
    if (it.model !== 'lightPost') continue;
    glows.push({ at: [it.x, 2.35, it.z + 0.1], rgb: tokenColour('glow:lit', GLOW), radius: 1.1, strength: 0.55 });
  }
  for (const b of RINK.raw_boxes) {
    if (!festive && /season|bulb wire/.test(b.note)) continue; // the wire goes with its bulbs
    const g = isGlow(b.c), rgb = tokenColour(b.c, GLOW, festive);
    const t = b.tint ?? tintAt((b.b[2] + b.b[5]) / 2);
    if (g || b.unlit) { glow.box(b.b, rgb, 1, true); continue; }
    const n = lit.a.pos.length / 3;
    lit.box(b.b, rgb, 1);
    relight(lit.a, n, t);
  }
  return { lit: lit.geometry(), glow: glow.geometry(), glows };
}
