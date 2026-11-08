import { Euler, Matrix4, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import type { VoxelMap } from '../../voxel/mesher';
import { animalModel } from '../../voxel/animals';
import type { AnimalModel, Species } from '../../voxel/animals/rig';
import { cavityOf, S } from '../../voxel/animals/rig';
import { __rig, tailLiftOf } from '../Sheep';
import type { SheepState } from '../Sheep';

/**
 * V5.1 Part 7.7: for every species and every state, the pose sampled 12 times across the state's duration (6 s for the
 * continuous ones) at pace 0 and 1. Every channel stays inside Part 6.6's ranges, and the hard constraints hold on the
 * posed parts. The transforms below mirror how the Sheep component applies a pose (root squash, body, neck group, head
 * group, then each part about its own pivot); the attention turn is left out (it is clamped to the same +-0.6).
 */
const { poseFor, face0, N, CH, RANGES, DURATION } = __rig;
const SPECIES: Species[] = ['sheep', 'pig', 'cow', 'horse', 'goat', 'chicken'];
const STATES: SheepState[] = ['idle', 'thinking', 'sleeping', 'grazing', 'proud', 'happy', 'startled', 'cold', 'freezing', 'frozen', 'thawing', 'run', 'jump', 'land', 'bonk'];

const key = (x: number, y: number, z: number) => `${x},${y},${z}`;
const centre = (k: string) => { const [x, y, z] = k.split(',').map(Number); return new Vector3((x + 0.5) * S, (y + 0.5) * S, (z + 0.5) * S); };
const cellOf = (v: Vector3) => key(Math.floor(v.x / S), Math.floor(v.y / S), Math.floor(v.z / S));
const at = (p: [number, number, number] | number[]) => new Matrix4().makeTranslation(p[0], p[1], p[2]);
const rot = (x: number, y: number, z: number) => new Matrix4().makeRotationFromEuler(new Euler(x, y, z));
/** A part turning about its own pivot: translate to the pivot, turn, translate back. */
const about = (pivot: number[], r: Matrix4) => at(pivot).multiply(r).multiply(at([-pivot[0], -pivot[1], -pivot[2]]));
/** A solid's cells: the shell plus its hollowed cavity. */
const solid = (m: VoxelMap) => new Set([...m.keys(), ...(cavityOf(m)?.keys() ?? [])]);

interface Frames { body: Matrix4; head: Matrix4; legs: Matrix4[]; earL: Matrix4; earR: Matrix4; tail: Matrix4; wingL: Matrix4; wingR: Matrix4 }
/** The body-frame transforms of every moving part (the body frame is the body group; its own turn is applied last). */
function frames(m: AnimalModel, c: Float32Array, live: SheepState): Frames {
  const sq = Math.max(0.5, c[CH.squash] || 1);
  const body = new Matrix4().makeScale(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq)).multiply(at([0, c[CH.bodyY], 0])).multiply(rot(c[CH.bodyRotX], 0, c[CH.bodyRotZ]));
  const nb = m.neckBase ?? [0, 0, 0];
  const neck = about(nb, rot(m.neckBase ? c[CH.neckX] : 0, 0, 0));
  const head = neck.clone().multiply(about(m.head.pivot, rot(c[CH.headX] + (m.headPitch ?? 0), c[CH.headY], c[CH.headZ])));
  const legX = [-c[CH.legSwing] - c[CH.legLift] * 5 + c[CH.legFront], c[CH.legSwing] + c[CH.legFront], c[CH.legSwing] + c[CH.legBack], -c[CH.legSwing] + c[CH.legBack]];
  const legs = m.legs.map((l, i) => at([0, i === 0 ? c[CH.legLift] : 0, 0]).multiply(about(l.pivot, rot(legX[i], 0, 0))));
  const earL = head.clone().multiply(about(m.ears[0].pivot, rot(0, -c[CH.earBack], c[CH.earL])));
  const earR = head.clone().multiply(about(m.ears[1].pivot, rot(0, c[CH.earBack], -c[CH.earR])));
  const lift = live === 'proud' || (m.species === 'horse' && live === 'startled') ? tailLiftOf(m) : 0;
  const tail = about(m.tail.pivot, rot(lift, c[CH.tail], 0));
  const open = live === 'run' ? 0.2 : live === 'proud' ? 0.4 : live === 'startled' ? 0.6 : live === 'jump' ? 0.7 : live === 'happy' ? 0.9 : 0;
  const wing = (dir: number, name: string) => { const w = m.signature.find((s) => s.anim === name); return w ? about(w.pivot, rot(0, 0, dir * open)) : new Matrix4(); };
  return { body, head, legs, earL, earR, tail, wingL: wing(1, 'wingL'), wingR: wing(-1, 'wingR') };
}

for (const species of SPECIES) {
  describe(`${species} poses (V5.1 Part 7.7)`, () => {
    const m = animalModel(species);
    const r = RANGES[species];
    const c = m.cells;
    const torso = solid(c.body);
    const headCells = new Set([...c.head.keys(), ...(c.beak?.keys() ?? []), ...(c.muzzle?.keys() ?? [])]);
    const hb = [...headCells].map(centre);
    const zFront = Math.max(...hb.map((v) => v.z));
    const muzzle = [...headCells].filter((k) => centre(k).z >= zFront - 2.5 * S);
    const bellyLine = Math.min(...[...c.body.keys()].map((k) => centre(k).y));
    const eyes = new Set([...(c.eye0?.keys() ?? []), ...(c.eye1?.keys() ?? [])]);
    // The tail's free length: its voxels more than one voxel clear of the torso at rest (the first ones are its root, and
    // a wag swings them through the curve of the rump they grow from).
    const near = (k: string) => { const [x, y, z] = k.split(',').map(Number); for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) if (torso.has(key(x + dx, y + dy, z + dz))) return true; return false; };
    const tailOut = [...(c.tail?.keys() ?? [])].filter((k) => !near(k));
    const wings = [c.wing0, c.wing1].filter(Boolean) as VoxelMap[];

    for (const state of STATES) for (const pace of [0, 1]) {
      it(`${state} at pace ${pace}`, () => {
        const dur = DURATION[state] ?? 6;
        const p = new Float32Array(N), f = face0();
        for (let i = 0; i < 12; i++) {
          const e = (dur * i) / 11;
          poseFor(p, f, state, e, e + 3.7, true, false, false, 0, null, pace, species);
          const at_ = `${state} e=${e.toFixed(2)}`;
          // Every channel inside 6.6.
          expect(p[CH.headX], `${at_} headX`).toBeGreaterThanOrEqual(r.headX[0] - 1e-6);
          expect(p[CH.headX], `${at_} headX`).toBeLessThanOrEqual(r.headX[1] + 1e-6);
          expect(p[CH.neckX], `${at_} neckX`).toBeGreaterThanOrEqual(r.neckX[0] - 1e-6);
          expect(p[CH.neckX], `${at_} neckX`).toBeLessThanOrEqual(r.neckX[1] + 1e-6);
          expect(Math.abs(p[CH.headY]), `${at_} headY`).toBeLessThanOrEqual(r.headY + 1e-6);
          expect(Math.abs(p[CH.headZ]), `${at_} headZ`).toBeLessThanOrEqual(r.headZ + 1e-6);
          expect(p[CH.bodyY], `${at_} bodyY`).toBeGreaterThanOrEqual(r.bodyY[0] - 1e-6);
          expect(p[CH.bodyY], `${at_} bodyY`).toBeLessThanOrEqual(r.bodyY[1] + 1e-6);
          expect(p[CH.squash], `${at_} squash`).toBeGreaterThanOrEqual(r.squash[0] - 1e-6);
          expect(p[CH.squash], `${at_} squash`).toBeLessThanOrEqual(r.squash[1] + 1e-6);
          expect(Math.abs(p[CH.legSwing]), `${at_} legSwing`).toBeLessThanOrEqual(r.legSwing + 1e-6);
          for (const ch of [CH.earL, CH.earR]) {
            expect(p[ch], `${at_} ears`).toBeGreaterThanOrEqual(r.ears[0] - 1e-6);
            expect(p[ch], `${at_} ears`).toBeLessThanOrEqual(r.ears[1] + 1e-6);
          }
          for (let k = 0; k < N; k++) expect(Number.isFinite(p[k]), `${at_} channel ${k}`).toBe(true);

          // The hard constraints, on the posed parts.
          const fr = frames(m, p, state);
          // No hoof above the belly line (in the body's own frame, so a sit or a jump is measured against the body).
          m.legs.forEach((l, li) => {
            const hooves = [...(l as { cells?: VoxelMap }).cells?.values() ?? []].filter((v) => v.y <= 1);
            for (const v of hooves) expect(centre(key(v.x, v.y, v.z)).applyMatrix4(fr.legs[li]).y, `${at_} hoof of leg ${li}`).toBeLessThan(bellyLine);
          });
          // No muzzle voxel below the ground or inside the torso.
          for (const k of muzzle) {
            const local = centre(k).applyMatrix4(fr.head);
            expect(local.clone().applyMatrix4(fr.body).y, `${at_} muzzle below the ground`).toBeGreaterThan(0);
            expect(torso.has(cellOf(local)), `${at_} muzzle inside the torso`).toBe(false);
          }
          // No ear voxel inside an eye plate (both in the head's frame).
          for (const [ear, mat] of [[c.ear0, fr.earL], [c.ear1, fr.earR]] as const) {
            if (!ear) continue;
            const toHead = fr.head.clone().invert().multiply(mat);
            for (const k of ear.keys()) expect(eyes.has(cellOf(centre(k).applyMatrix4(toHead))), `${at_} ${ear === c.ear0 ? 'left' : 'right'} ear in an eye`).toBe(false);
          }
          // The tail never inside the torso.
          for (const k of tailOut) expect(torso.has(cellOf(centre(k).applyMatrix4(fr.tail))), `${at_} tail inside the torso`).toBe(false);
          // Wings never inside the head.
          const headNow = new Set([...headCells].map((k) => cellOf(centre(k).applyMatrix4(fr.head))));
          wings.forEach((w, wi) => {
            for (const k of w.keys()) expect(headNow.has(cellOf(centre(k).applyMatrix4(wi === 0 ? fr.wingL : fr.wingR))), `${at_} wing in the head`).toBe(false);
          });
        }
      });
    }
  });
}
