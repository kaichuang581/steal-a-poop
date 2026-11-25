import { Matrix4, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { BED, bedroomGeometry, farmerColumns, pillowDent, QUILT, quiltCells, quiltColour, quiltSat, TURN_STEP } from '../bedroom';
import { lyingAt, PIVOT, POSES, TURN_MS, turnPose, UNIT, worldOf } from '../farmer';
import type { Piece, Pose } from '../farmer';
import { CAP_TIP, NOSE } from '../frame';
import { solid } from '../../voxel/paint';

const tris = (g: { index: { count: number } | null }) => (g.index?.count ?? 0) / 3;

describe("the farmer's bedroom", () => {
  it('builds every piece, and the room keeps to its triangle budget once the unseen faces are culled', () => {
    const b = bedroomGeometry();
    for (const g of Object.values(b)) expect(tris(g)).toBeGreaterThan(0);
    // The whole room is one mesh; with the walls' backs and the floor's underside dropped it stays well under 100k.
    expect(tris(b.room)).toBeLessThan(70_000);
    expect(tris(b.room) + tris(b.glow)).toBeLessThan(100_000);
  });
  it('builds the quilt he sits up out of', () => {
    expect(tris(quiltSat())).toBeGreaterThan(0);
  });
});

// docs/dream/v3/09, sections 2 and 3, and 03, section 5: how he lies, and his quilt.
describe('the farmer in his bed', () => {
  const Q = QUILT.cell, top = BED.mattress.top;
  const roomAt = (pose: Pose, piece: Piece, x: number, y: number, z: number) => {
    const L = lyingAt(top), m = new Matrix4().compose(new Vector3(...L.position), L.quaternion, new Vector3(1, 1, 1)).multiply(worldOf(pose)[piece]);
    return new Vector3((x - PIVOT[piece][0]) * UNIT, (y - PIVOT[piece][1]) * UNIT, (z - PIVOT[piece][2]) * UNIT).applyMatrix4(m);
  };

  it('puts the strip\'s nose and cap tip where his nose and cap are as he sleeps', () => {
    expect(roomAt(POSES.bedSleep, 'head', 0, 66.5, 10.5).distanceTo(new Vector3(NOSE.x, NOSE.y, NOSE.z))).toBeLessThan(0.01);
    expect(roomAt(POSES.bedSleep, 'cap', 0, 84, 0).distanceTo(new Vector3(CAP_TIP.x, CAP_TIP.y, CAP_TIP.z))).toBeLessThan(0.01);
  });

  it('never puts his head through the pillow: the pillow is pressed down a cell where it lies', () => {
    const dent = new Set(pillowDent());
    for (const pose of [POSES.bedSleep, POSES.bedDeep, POSES.bedStir]) {
      for (const [key, { lo }] of farmerColumns(pose, ['head', 'cap', 'capTail'], 0.05)) {
        const [x, z] = key.split(',').map(Number);
        const onPillow = x >= 1 && x < 14 && z >= -6 && z < 10;
        // 3 mm is the turned voxels' own rounding.
        expect(lo).toBeGreaterThan((onPillow ? BED.pillowTop - (dent.has(key) ? 0.05 : 0) : top) - 0.003);
      }
    }
  });

  it('lies with his neck and both shoulders out of the quilt, his near hand resting on it', () => {
    const h = quiltCells();
    // The quilt's edge lies at his armpits: his chest from the top of his arms up (his collar, his shoulders) is out of it.
    expect(roomAt(POSES.bedSleep, 'torso', 0, PIVOT.armR[1] - 1, 6.5).x).toBeLessThanOrEqual(QUILT.edge);
    for (const pose of [POSES.bedSleep, POSES.bedStir]) {
      let rests = Infinity;
      for (const [key, { lo }] of farmerColumns(pose, ['handR'], Q, 0.01)) {
        const [i, k] = key.split(',').map(Number);
        if (h(i, k) > 0) rests = Math.min(rests, lo - top - h(i, k) * Q);
      }
      expect(rests).toBeLessThan(0.03); // on it, not over it
      if (pose === POSES.bedSleep) expect(rests).toBeGreaterThan(-0.005); // and not in it (stirring, he grips it)
    }
  });

  it('keeps him under the quilt as he turns over at gate 3', () => {
    for (let ms = 0; ms <= TURN_MS; ms += 50) {
      const pose = turnPose(ms), deg = (Math.abs(pose.roll) * 180) / Math.PI, h = quiltCells(deg < 0.5 ? 0 : Math.ceil(deg / TURN_STEP - 1e-6));
      for (const [key, { hi }] of farmerColumns(pose, ['lap', 'torso', 'legL', 'legR'], Q, 0.01)) {
        const [i, k] = key.split(',').map(Number);
        if ((i + 0.5) * Q > QUILT.edge + 0.04) expect(top + h(i, k) * Q - hi).toBeGreaterThan(-0.02);
      }
    }
    expect(turnPose(0)).toBe(POSES.bedSleep);
    expect(turnPose(TURN_MS)).toBe(POSES.bedSleep);
    expect(turnPose(TURN_MS / 2).roll).toBeCloseTo(POSES.bedTurn.roll, 6);
    expect(turnPose(TURN_MS / 2).eyes).toBe('closed');
    expect(turnPose(TURN_MS / 2, POSES.bedDeep).mouth).toBe('open');
  });

  it('squares the quilt by its rule: cream every second square, the four colours in turn, the sheet and its stitch', () => {
    const at = (ix: number, iz: number) => quiltColour(QUILT.edge + QUILT.band + (ix + 0.5) * QUILT.square, (iz + 0.5) * QUILT.square);
    const four = ['scarfRed', 'coopYellow', 'giftGreen', 'slate'] as const;
    for (let ix = 0; ix < 5; ix++) for (let iz = 0; iz < 6; iz++) {
      expect(at(ix, iz)).toEqual((ix + iz) % 2 === 0 ? solid('trimWhite', 0) : solid(four[Math.floor((ix + 3 * iz) / 2) % 4], 0));
    }
    // The turned-down sheet, and a stitch every 0.06 m along its lower edge.
    expect(quiltColour(QUILT.edge + 0.01, 0.05)).toEqual(solid('trimWhite', 2));
    const edge = QUILT.edge + QUILT.band - 0.01, stitches = Array.from({ length: 30 }, (_, k) => quiltColour(edge, (k + 0.5) * Q)).filter((c) => c === solid('scarfRed', 0));
    expect(stitches).toHaveLength(10);
  });
});
