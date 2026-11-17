import { Frustum, Matrix4, Vector3 } from 'three';
import type { Sphere } from 'three';
import { POV_SHOTS } from '../scene/homePov';
import type { PovShot } from '../scene/homePov';
import { CAMERA, SEAT_RING, speakerShot } from '../scene/layout';

/**
 * Faces no camera can ever be in front of (plan file 17, change 13, step 1). A voxel face lies in a plane square to
 * one axis, so a camera is in front of it only when it stands past that plane on the face's side: an east face at
 * x = 30 is seen only from x > 30. So all that matters is how far the game's cameras ever travel along each axis.
 * A face behind all of them is already thrown away by the graphics chip, one triangle at a time, every frame (the voxel
 * material draws front faces only); leaving it out of the mesh draws the same picture with less to throw away.
 *
 * Only for meshes that cast no shadow: the sun's shadow pass draws the faces turned away from the light, wherever the
 * camera stands.
 */

type V3 = readonly [number, number, number];
/** How far the cameras of one screen ever stand along each axis, in metres. */
export interface Reach { min: [number, number, number]; max: [number, number, number] }

/** Every camera is given this much more room than it uses, each way. */
export const SEEN_MARGIN = 1;

const reachOf = (points: V3[], pad: V3): Reach => {
  const min: [number, number, number] = [Infinity, Infinity, Infinity], max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (const p of points) for (let a = 0; a < 3; a++) {
    min[a] = Math.min(min[a], p[a] - pad[a] - SEEN_MARGIN);
    max[a] = Math.max(max[a], p[a] + pad[a] + SEEN_MARGIN);
  }
  return { min, max };
};

/** The start screen's drift, each way: `Drift` in table/FarmBackdrop.tsx sways 0.25 m across and 0.12 m up and down. */
const HOME_DRIFT: V3 = [0.25, 0.12, 0];

/**
 * Home: every scene of the tour, computer and phone, from where its camera starts to the end of its push, with the
 * drift on top (`Drift` in table/FarmBackdrop.tsx; the canvas opens on scene 0's start).
 */
export function homeReach(): Reach {
  const points: V3[] = [];
  for (const s of [...POV_SHOTS.desktop, ...POV_SHOTS.phone]) {
    points.push(s.position, [s.position[0] + s.push[0], s.position[1] + s.push[1], s.position[2] + s.push[2]]);
  }
  return reachOf(points, HOME_DRIFT);
}

/** How many can sit at a table (2 to 10): every seat of every size of table gets its own close shot. */
const TABLE_SEATS = { min: 2, max: 10 };
/** The speaker camera breathes on a 0.05 m ellipse while a sheep has the floor (`SpeakerCamera` in table/BarnTable.tsx). */
const TABLE_DRIFT = 0.05;

/**
 * The table: the two wide shots and every seat's close shot (108 of them: 2 to 10 seats, computer and phone). Between
 * two shots the camera swings round the pile, its distance from the pile and its height each going straight from one
 * shot's to the other's, so it never leaves the disc of the widest shot, between the lowest shot and the highest.
 */
export function tableReach(): Reach {
  const shots: V3[] = [CAMERA.desktop.position, CAMERA.phone.position];
  for (const phone of [false, true])
    for (let n = TABLE_SEATS.min; n <= TABLE_SEATS.max; n++)
      for (let i = 0; i < n; i++) shots.push(speakerShot(i, n, phone).position);
  const far = Math.max(...shots.map((p) => Math.hypot(p[0] - SEAT_RING.cx, p[2] - SEAT_RING.cz)));
  const ys = shots.map((p) => p[1]);
  return reachOf([
    [SEAT_RING.cx - far, Math.min(...ys), SEAT_RING.cz - far],
    [SEAT_RING.cx + far, Math.max(...ys), SEAT_RING.cz + far],
  ], [TABLE_DRIFT, TABLE_DRIFT, TABLE_DRIFT]);
}

/** Where a mesh is mounted: on which screens, whether it is turned half round (the far range behind the barn), and how
 *  far its geometry is moved after it is built (`geometry.translate`), which the planes here are measured before. */
export interface Mount { screens: 'home' | 'both'; turned?: boolean; lift?: number }

const join = (a: Reach, b: Reach): Reach => ({
  min: [Math.min(a.min[0], b.min[0]), Math.min(a.min[1], b.min[1]), Math.min(a.min[2], b.min[2])],
  max: [Math.max(a.max[0], b.max[0]), Math.max(a.max[1], b.max[1]), Math.max(a.max[2], b.max[2])],
});

/** The cameras' reach as one mount of a mesh sees it, in the mesh's own metres as the mesher lays them out. */
export function reachFor(m: Mount): Reach {
  let r = m.screens === 'both' ? join(homeReach(), tableReach()) : homeReach();
  // Turned half round about the upright axis: the mesh's x and z are the world's, the other way.
  if (m.turned) r = { min: [-r.max[0], r.min[1], -r.max[2]], max: [-r.min[0], r.max[1], -r.min[2]] };
  if (m.lift) r = { min: [r.min[0], r.min[1] - m.lift, r.min[2]], max: [r.max[0], r.max[1] - m.lift, r.max[2]] };
  return r;
}

/**
 * For the mesher's `unseen`: whether the face square to `axis`, looking along `sign`, in the plane at `plane` metres,
 * is behind every camera in every place the mesh is mounted. A mesh mounted twice loses a face only if neither sees it.
 */
export function unseenFrom(mounts: Mount[]): (axis: 0 | 1 | 2, sign: 1 | -1, plane: number) => boolean {
  const reaches = mounts.map(reachFor);
  return (axis, sign, plane) => reaches.every((r) => (sign > 0 ? r.max[axis] <= plane : r.min[axis] >= plane));
}

/**
 * Whether the sun's shadows can fall at (x, z), in metres, on the screens named. The sun stands behind the camera, 35
 * degrees to one side, and its shadow map is a box 40 m across laid along its light through the middle of the farm
 * (`Lights` in table/Rendering.tsx, whose numbers these are; the start screen's sun is set from its first scene, the
 * table's from straight ahead). Outside that box nothing is ever in shadow. `turned` is for a mesh mounted half round.
 * The mesher merges faces only out here (`merge`): a shadow's edge on a merged face lands a hair differently, and the
 * land must look as it did.
 */
const SUN = { asideDeg: 35, halfWidth: 20, margin: 3 };
export function sunReaches(x: number, z: number, screens: Mount['screens'], turned = false): boolean {
  const yaws = [POV_SHOTS.desktop[0], POV_SHOTS.phone[0]].map((s) => Math.atan2(s.target[0] - s.position[0], s.target[2] - s.position[2]));
  if (screens === 'both') yaws.push(0);
  const [px, pz] = turned ? [-x, -z] : [x, z];
  return yaws.some((yaw) => {
    const az = yaw + Math.PI + (SUN.asideDeg * Math.PI) / 180;
    return Math.abs(px * Math.cos(az) - pz * Math.sin(az)) <= SUN.halfWidth + SUN.margin;
  });
}

// ---------------------------------------------------------------------------------------------------------------------
// Shadows no camera can see (plan file 17, change 13, step 3)
// ---------------------------------------------------------------------------------------------------------------------

/** The scene of the tour that must stay exactly as it is, casters and all: the paddock, where the wendigo stands. */
export const PADDOCK_SHOT = 2;

/** Which scene of the tour a camera is on, from where it stands (each travels its own line, metres from the others'); -1 when on none. */
export function shotAt(shots: PovShot[], x: number, y: number, z: number): number {
  let best = -1, least = 0.6; // the drift is 0.28 m at most
  shots.forEach((s, i) => {
    const px = x - s.position[0], py = y - s.position[1], pz = z - s.position[2];
    const len2 = s.push[0] ** 2 + s.push[1] ** 2 + s.push[2] ** 2;
    const k = len2 ? Math.min(1, Math.max(0, (px * s.push[0] + py * s.push[1] + pz * s.push[2]) / len2)) : 0;
    const d = Math.hypot(px - s.push[0] * k, py - s.push[1] * k, pz - s.push[2] * k);
    if (d < least) { least = d; best = i; }
  });
  return best;
}

const STOPS = 8;
// Plain matrices, not a camera of three's: making one of those rolls the page's dice for its id.
const lens = new Matrix4(), stand = new Matrix4(), eye = new Vector3(), aimAt = new Vector3(), UP = new Vector3(0, 1, 0), end = new Vector3();

/**
 * Everything one scene of the tour can see, over the whole of its travel and drift: the camera's view at nine stops
 * along its push, each opened wider by as much as the camera turns before the next stop (it keeps looking at one
 * point as it moves, so it turns) and by the drift. `pad` is how far the camera can be from its nearest stop, in
 * metres: add it to the size of whatever is tested.
 */
export function viewsOf(shot: PovShot, aspect: number): { views: Frustum[]; pad: number } {
  const at = (k: number): [number, number, number] => [shot.position[0] + shot.push[0] * k, shot.position[1] + shot.push[1] * k, shot.position[2] + shot.push[2] * k];
  const aim = (k: number) => { const p = at(k); return new Vector3(shot.target[0] - p[0], shot.target[1] - p[1], shot.target[2] - p[2]); };
  let turn = 0, near = Infinity;
  for (let j = 0; j <= STOPS; j++) {
    near = Math.min(near, aim(j / STOPS).length());
    if (j) turn = Math.max(turn, aim(j / STOPS).angleTo(aim((j - 1) / STOPS)));
  }
  const drift = Math.hypot(HOME_DRIFT[0], HOME_DRIFT[1]);
  const wider = turn + 2 * Math.atan(drift / Math.max(1, near)) + 0.03;
  const up = Math.min(1.5, (shot.fov * Math.PI) / 360 + wider), across = Math.min(1.5, Math.atan(Math.tan((shot.fov * Math.PI) / 360) * aspect) + wider);
  const views: Frustum[] = [];
  const NEAR = 0.05, FAR = 1000, top = NEAR * Math.tan(up), right = NEAR * Math.tan(across);
  lens.makePerspective(-right, right, top, -top, NEAR, FAR);
  for (let j = 0; j <= STOPS; j++) {
    eye.set(...at(j / STOPS));
    aimAt.set(shot.target[0], shot.target[1], shot.target[2]);
    stand.identity().lookAt(eye, aimAt, UP).setPosition(eye).invert(); // the world as this stop's camera sees it
    views.push(new Frustum().setFromProjectionMatrix(stand.premultiply(lens)));
  }
  return { views, pad: Math.hypot(shot.push[0], shot.push[1], shot.push[2]) / (2 * STOPS) + drift };
}

/** No ground a shadow can fall on lies lower than this (the yard's footprints are 0.2 m deep), in metres. */
const LOWEST_GROUND = -1;
/** Room for the shadow's soft edge and the shadow map's own slack, in metres. */
const SHADOW_SLACK = 0.5;

/**
 * Whether the shadow of something inside `ball` (a sphere in the world) can fall anywhere these views see. `sun` is
 * the way the sun's light travels (a unit vector, pointing down). A thing's shadow lies along the light from the thing
 * down to the ground and no further, so it is a rod with round ends: the ball, swept from where it is to where its top
 * edge's light meets the lowest ground. Kept unless that rod is wholly outside one side of every view: when unsure, it
 * casts.
 */
export function shadowSeen(ball: Sphere, sun: Vector3, views: Frustum[], pad: number): boolean {
  if (sun.y > -0.05) return true; // a sun at the horizon: shadows without end
  const reach = Math.max(0, (ball.center.y + ball.radius - LOWEST_GROUND) / -sun.y);
  end.copy(ball.center).addScaledVector(sun, reach);
  const r = ball.radius + pad + SHADOW_SLACK;
  return views.some((f) => !f.planes.some((plane) => plane.distanceToPoint(ball.center) < -r && plane.distanceToPoint(end) < -r));
}
