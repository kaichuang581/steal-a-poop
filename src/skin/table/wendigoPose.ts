import { Vector3 } from 'three';
import type { Mesh, Object3D } from 'three';

/** The red eyes in the source model's own frame (they were taken out of the mesh and are drawn glowing instead). */
const EYES_SRC: [number, number, number][] = [[0.011, 0.179, 0.352], [-0.019, 0.177, 0.352]];

const ramp = (a: number, b: number, v: number) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
const X = new Vector3(1, 0, 0), Z = new Vector3(0, 0, 1);
/**
 * The model has no skeleton, and it came in a T-pose with its jaw hanging wide open, so it is posed here once, on load,
 * by turning its vertices about joints in its own frame (it faces +z, y up, about 0.54 tall), each by a weight that eases
 * in across the joint so nothing tears. In order: the jaw shuts, teeth meeting; the arms hang in close to the body with
 * a little bend at the elbow; and the head drops and cocks to one side, the way something does when it is watching you.
 * Each step is [weight of a point, axis, pivot, angle].
 */
type Step = [(p: Vector3) => number, Vector3, Vector3, number];
export const POSE: Step[] = [
  // The lower jaw: below the line between the jaws, forward of the throat. The hinge is under the ear.
  [(p) => (p.y < 0.156 - (p.z - 0.32) * 0.15 && p.y > 0.098 && Math.abs(p.x) < 0.045 ? ramp(0.316, 0.33, p.z) : 0), X, new Vector3(0, 0.152, 0.322), -0.68],
  ...[1, -1].flatMap((side): Step[] => [
    // Each arm from the shoulder, then the forearm from the elbow.
    [(p) => (p.y < 0.118 && p.y > -0.14 && p.x * side > 0 ? ramp(p.y > 0 ? 0.064 : 0.09, p.y > 0 ? 0.08 : 0.105, p.x * side) : 0), Z, new Vector3(side * 0.072, 0.095, 0.27), side * -0.2],
    [(p) => (p.x * side > 0.09 && p.y > -0.14 ? ramp(0.05, 0.02, p.y) : 0), Z, new Vector3(side * 0.105, 0.04, 0.27), side * -0.14],
  ]),
  // The head and antlers, from the top of the neck.
  [(p) => Math.max(ramp(0.17, 0.19, p.y), ramp(0.085, 0.1, p.y) * ramp(0.29, 0.32, p.z)), X, new Vector3(0, 0.13, 0.29), 0.14],
  [(p) => Math.max(ramp(0.17, 0.19, p.y), ramp(0.085, 0.1, p.y) * ramp(0.29, 0.32, p.z)), Z, new Vector3(0, 0.13, 0.29), 0.16],
];
const turn = (v: Vector3, step: Step, w: number, point: boolean) => {
  const [, axis, pivot, angle] = step;
  if (!w) return;
  if (point) v.sub(pivot);
  v.applyAxisAngle(axis, angle * w);
  if (point) v.add(pivot);
};
export function pose(root: Object3D) {
  const p = new Vector3(), n = new Vector3();
  root.traverse((o) => {
    const m = o as Mesh;
    if (!m.isMesh) return;
    const pos = m.geometry.attributes.position, nor = m.geometry.attributes.normal;
    for (let i = 0; i < pos.count; i++) {
      p.fromBufferAttribute(pos, i);
      if (nor) n.fromBufferAttribute(nor, i);
      const ws = POSE.map((s) => s[0](p)); // every weight from the rest pose, so one joint never moves a point out of the next
      POSE.forEach((s, k) => { turn(n, s, ws[k], false); turn(p, s, ws[k], true); });
      pos.setXYZ(i, p.x, p.y, p.z);
      if (nor) nor.setXYZ(i, n.x, n.y, n.z);
    }
    pos.needsUpdate = true;
    if (nor) nor.needsUpdate = true;
    m.geometry.computeBoundingBox();
    m.geometry.computeBoundingSphere();
  });
}
/** Where the eyes end up once the head has turned. */
export const EYES = EYES_SRC.map((e) => { const v = new Vector3(...e), ws = POSE.map((s) => s[0](v)); POSE.forEach((s, k) => turn(v, s, ws[k], true)); return v.toArray() as [number, number, number]; });
