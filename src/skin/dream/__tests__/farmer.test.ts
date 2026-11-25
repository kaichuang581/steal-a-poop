import { readFileSync } from 'node:fs';
import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { blendPose, breathAt, farmerCells, farmerGeometry, lyingAt, PIECES, PIVOT, placePose, POSES, UNIT, worldOf } from '../farmer';
import type { Piece, PoseName } from '../farmer';
import { FARMER_BOXES } from '../farmerBoxes';

// The farmer of docs/dream/01-farmer.md: Brian's sheet as 106 boxes, drawn as voxels, with the plan's poses.
const cellsOf = (p: Piece) => [...farmerCells().get(p)!.map.values()];
const all = () => PIECES.flatMap((p) => cellsOf(p));
const hex = (c: readonly number[]) => c.map((v) => v.toFixed(3)).join(',');

describe('the farmer, box by box', () => {
  it('is the plan\'s data file, unchanged', () => {
    const data = JSON.parse(readFileSync('docs/dream/data/farmer.boxes.json', 'utf8')) as { boxes: { part: string; colour: string; x0: number; x1: number; y0: number; y1: number; z0: number; z1: number }[] };
    expect(FARMER_BOXES).toHaveLength(108); // 106, plus the jaw beard either side (2026-11-25)
    expect(FARMER_BOXES.map((b) => [...b])).toEqual(data.boxes.map((b) => [b.part, b.colour, b.x0, b.x1, b.y0, b.y1, b.z0, b.z1]));
  });

  it('stands 84 units tall on the floor, with every piece built', () => {
    const ys = all().map((c) => c.y);
    expect(Math.min(...ys)).toBe(0);
    expect(Math.max(...ys)).toBe(83); // the cell from 83 to 84
    for (const p of PIECES) expect(cellsOf(p).length).toBeGreaterThan(0);
    const g = farmerGeometry();
    for (const p of PIECES) expect(g.pieces[p].getAttribute('position').count).toBeGreaterThan(0);
  });

  it('has a true centre column: his body, head and cap are the same either side of it', () => {
    for (const p of ['lap', 'torso', 'head', 'cap'] as const) {
      const at = new Map(cellsOf(p).map((c) => [`${c.x},${c.y},${c.z}`, hex(c.c)]));
      for (const c of cellsOf(p)) expect(at.get(`${-c.x},${c.y},${c.z}`)).toBe(hex(c.c));
    }
    // The centre stripe, the placket and its three buttons are on column 0.
    const front = cellsOf('torso').filter((c) => c.x === 0 && c.z === 6);
    expect(new Set(front.map((c) => hex(c.c))).size).toBeGreaterThanOrEqual(3);
  });

  it('paints a thin box on the cell under it: nothing is thinner than a voxel', () => {
    // A stripe one unit wide down the skirt's front, on its outermost layer of cells.
    const skirt = cellsOf('lap'), frontZ = Math.max(...skirt.map((c) => c.z));
    const cloth = hex(skirt.find((c) => c.x === 2 && c.y === 15 && c.z === frontZ)!.c);
    for (const x of [0, 4, -4, 8, -8]) expect(hex(skirt.find((c) => c.x === x && c.y === 15 && c.z === frontZ)!.c)).not.toBe(cloth);
    for (const x of [1, 2, 3, 5, 6, 7]) expect(hex(skirt.find((c) => c.x === x && c.y === 15 && c.z === frontZ)!.c)).toBe(cloth);
  });

  it('wears red only on the cap\'s band and the ring of its tail', () => {
    const red = (c: readonly number[]) => c[0] > c[1] * 2.5 && c[0] > c[2] * 2.5;
    for (const p of PIECES) {
      const reds = cellsOf(p).filter((c) => red(c.c));
      if (p === 'cap') expect(new Set(reds.map((c) => c.y))).toEqual(new Set([74]));
      else if (p === 'capTail') expect(new Set(reds.map((c) => c.y))).toEqual(new Set([64]));
      else expect(reds).toHaveLength(0);
    }
  });
});

describe('the farmer\'s poses', () => {
  const names = Object.keys(POSES) as PoseName[];
  it('stands as the sheet: every joint at rest', () => {
    const placed = placePose(POSES.stand);
    for (const p of PIECES) expect(placed[p].quaternion.angleTo(placed.lap.quaternion)).toBeCloseTo(0, 9);
  });

  it('lies on his back with his head at the headboard and his right side to the room', () => {
    const { position, quaternion } = lyingAt(0.55);
    const at = (x: number, y: number, z: number) => new Vector3(x * UNIT, y * UNIT, z * UNIT).applyQuaternion(quaternion).add(new Vector3(...position));
    expect(at(0, 84, 0).x).toBeLessThan(at(0, 0, 0).x); // his cap toward the headboard (x = 0)
    expect(at(0, 40, 6.5).y).toBeGreaterThan(at(0, 40, -6.5).y); // his front to the ceiling
    expect(at(-10, 40, 0).z).toBeGreaterThan(at(10, 40, 0).z); // his right toward the room (+z)
    expect(at(0, 40, -6.5).y).toBeCloseTo(0.55, 9); // his back on the mattress
  });

  it('eases between any two poses without a jump in any joint', () => {
    for (const a of names) for (const b of names) {
      let prev = worldOf(blendPose(POSES[a], POSES[b], 0));
      for (let k = 1; k <= 60; k++) {
        const next = worldOf(blendPose(POSES[a], POSES[b], k / 60));
        // The tail is laid along a direction and may swing round; every other piece moves a little at a time.
        for (const p of PIECES) if (p !== 'capTail') {
          const moved = new Vector3().setFromMatrixPosition(next[p]).distanceTo(new Vector3().setFromMatrixPosition(prev[p]));
          expect(moved).toBeLessThan(0.05);
        }
        prev = next;
      }
    }
  });

  it('never puts an arm across his face or his beard, sitting up', () => {
    // In the head's own frame his face and beard are in front of z = 8.5 units, between the sideburns.
    for (const name of ['bedUpright', 'bedJolt'] as const) {
      const w = worldOf(POSES[name]), toHead = w.head.clone().invert();
      for (const p of ['armL', 'armR', 'foreL', 'foreR', 'handL', 'handR'] as const) {
        for (const c of cellsOf(p)) {
          const v = new Vector3((c.x - PIVOT[p][0]) * UNIT, (c.y + 0.5 - PIVOT[p][1]) * UNIT, (c.z - PIVOT[p][2]) * UNIT).applyMatrix4(w[p]).applyMatrix4(toHead).divideScalar(UNIT);
          const overFace = Math.abs(v.x) < 9 && v.y > -2 && v.y < 17 && v.z > 4;
          expect(overFace).toBe(false);
        }
      }
    }
  });

  it('hangs his near arm off the side of the bed when he is deep asleep, below the mattress top', () => {
    const { position, quaternion } = lyingAt(0.55);
    const w = worldOf(POSES.bedDeep);
    const hand = new Vector3().setFromMatrixPosition(w.handR).applyQuaternion(quaternion).add(new Vector3(...position));
    expect(hand.z).toBeGreaterThan(0.6); // past the mattress's edge (0.55) and the quilt's drape
    expect(hand.y).toBeLessThan(0.55);
    const sleeping = new Vector3().setFromMatrixPosition(worldOf(POSES.bedSleep).handR).applyQuaternion(quaternion).add(new Vector3(...position));
    expect(sleeping.y).toBeGreaterThan(0.6); // asleep in stages 1 and 2 it lies on the quilt
  });

  it('breathes: in and out once a breath, never past full, and a snore holds the top', () => {
    for (const name of names) {
      const b = POSES[name].breath;
      for (let t = 0; t < 12; t += 0.05) {
        const v = breathAt(t, b);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
    const deep = POSES.bedDeep.breath;
    expect(breathAt(0, deep)).toBeCloseTo(0, 6);
    const top = Array.from({ length: 400 }, (_, i) => breathAt((i / 400) * deep.every, deep)).filter((v) => v > 0.999).length;
    expect(top / 400).toBeGreaterThan(deep.hitch / deep.every - 0.01);
    expect(POSES.bedSleep.breath.every).toBe(3.2);
    expect(deep.every).toBe(4);
    expect(POSES.bedStir.breath.every).toBe(1.6);
  });
});
