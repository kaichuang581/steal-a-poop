import type { Shot } from './layout';
import { buildGeometry } from '../voxel/mesher';
import { lin, pick, T } from '../voxel/palette';
import { box, ellipsoid, Grid, hash3, rng } from '../voxel/primitives';
import { detailed } from '../voxel/refine';

/**
 * The lobby is a sheep pen: a rail fence on the snow on a winter night, a lantern on a post, a hay rack, and everyone who
 * has joined standing inside until the host opens the gate. +y is up and the camera looks toward +z from the gate side.
 */
export const PEN = {
  halfX: 3.4, halfZ: 2.1,
  /** The gap in the front rail, where people walk in. */
  gate: 1.1,
  lamp: [-3.4, 2.3, 2.1] as const,
  rack: [0, 0, 1.55] as const,
};

/** Where the i-th animal stands (ten places: five in front, five behind, filled from the middle out), facing the gate. */
export function penSpot(i: number): { x: number; z: number; yaw: number } {
  const col = [0, -1, 1, -2, 2][i % 5];
  const back = i >= 5;
  const x = col * 1.22 + (back ? 0.55 : 0);
  const z = back ? 0.75 : -0.75;
  return { x, z, yaw: Math.PI - x * 0.09 + (hash3(i, 0, 0, 5) - 0.5) * 0.3 }; // the model's front is +z; the camera is at -z
}

/** The wide, level shot of the whole pen; a phone stands further back because it is narrow. */
export function penShot(phone: boolean): Shot {
  return phone
    ? { position: [0, 3.6, -15.5], target: [0, 0.9, 0], fov: 40 }
    : { position: [0, 3.4, -13.2], target: [0, 0.85, 0], fov: 30 };
}

let built: ReturnType<typeof make> | null = null;
/** The static place, built once. */
export function buildPen() {
  return (built ??= make());
}

function make() {
  return { ground: ground(), land: land(), pines: pines(), ...fence() };
}

/** Trodden snow inside the pen, clean snow with soft drifts around it. Top surface at y = 0. */
function ground() {
  const g = new Grid(0.2);
  for (let x = -70; x <= 70; x++) {
    for (let z = -50; z <= 60; z++) {
      const inside = Math.abs(x * g.size) < PEN.halfX && Math.abs(z * g.size) < PEN.halfZ;
      const r = hash3(x, 0, z, 3);
      g.set(x, -1, z, inside && hash3(x >> 1, 1, z >> 1, 5) > 0.45 ? lin(r > 0.5 ? '#E4EAF2' : '#D3DCE8') : pick(T.snow, r, [0.5, 0.85]));
    }
  }
  const r = rng(7);
  for (let i = 0; i < 16; i++) {
    const a = r() * Math.PI * 2, d = 5.6 + r() * 6;
    const w = 0.9 + r() * 1.6;
    ellipsoid(g, [Math.cos(a) * d, -0.1, Math.sin(a) * d * 0.8 + 1], [w, 0.34, w * 0.7], (x, y, z) => pick(T.snow, hash3(x, y, z, 9), [0.55, 0.9]), 0.15, i + 1);
  }
  const fine = detailed(g.map, g.size);
  return buildGeometry(fine.map, fine.size);
}

/** Low white hills that close the view behind the pen. */
function land() {
  const g = new Grid(1);
  for (let x = -60; x <= 60; x++) {
    for (let z = 12; z <= 44; z++) {
      const top = Math.round((z - 12) * 0.22 + Math.sin(x * 0.16) * 1.4 + hash3(x >> 2, 0, z >> 2, 11) * 1.6);
      for (let y = -1; y <= top; y++) g.set(x, y, z, lin(hash3(x, y, z, 13) > 0.5 ? '#C9D6E6' : '#B8C8DC'));
    }
  }
  const fine = detailed(g.map, g.size);
  return buildGeometry(fine.map, fine.size);
}

/** Snow-laden pines behind and beside the pen, in loose clumps. */
function pines() {
  const g = new Grid(0.25);
  const r = rng(17);
  const at: [number, number][] = [[-7.5, 5.5], [-5.2, 7.4], [-9.6, 2.2], [6.4, 6.2], [8.8, 3.4], [4.2, 8.6], [-2.4, 9.4], [10.6, 7.2], [-11.5, 7.8], [1.4, 10.8]];
  at.forEach(([x, z], i) => {
    const h = 3.4 + r() * 2.4;
    box(g, [x - 0.25, 0, z - 0.25], [x + 0.25, 1, z + 0.25], () => lin(T.beam[2]));
    for (let y = 1; y < h; y += 0.25) {
      const k = (y - 1) / (h - 1);
      const w = Math.max(0.25, (1 - k) * 1.5 * (0.7 + ((y * 4) % 4) * 0.1));
      box(g, [x - w, y, z - w], [x + w, y + 0.25, z + w], (a, b, c) => (hash3(a, b, c, 19 + i) > 0.72 - k * 0.25 ? pick(T.snow, hash3(a, 0, c, 21)) : pick(T.pine, hash3(a, b, c, 23))));
    }
  });
  const fine = detailed(g.map, g.size);
  return buildGeometry(fine.map, fine.size);
}

/** The rail fence (posts every metre, two rails, snow along the top), the hay rack, the trough and the lantern post. */
function fence() {
  const g = new Grid(0.1);
  const glow = new Grid(0.1);
  const wood = (a: number, b: number, c: number) => pick(T.beam, hash3(a >> 1, b, c >> 1, 31), [0.45, 0.85]);
  const snow = (a: number, b: number, c: number) => (hash3(a, b, c, 33) > 0.28 ? pick(T.snow, hash3(a, 0, c, 35)) : null);
  const X = PEN.halfX, Z = PEN.halfZ;
  const post = (x: number, z: number, h = 0.8) => {
    box(g, [x - 0.1, 0, z - 0.1], [x + 0.1, h, z + 0.1], wood);
    box(g, [x - 0.1, h, z - 0.1], [x + 0.1, h + 0.1, z + 0.1], (a, b, c) => pick(T.snow, hash3(a, b, c, 37)));
  };
  const railX = (x0: number, x1: number, z: number) => {
    for (const y of [0.3, 0.6]) box(g, [x0, y, z - 0.05], [x1, y + 0.1, z + 0.05], wood);
    box(g, [x0, 0.7, z - 0.05], [x1, 0.8, z + 0.05], snow);
  };
  const railZ = (z0: number, z1: number, x: number) => {
    for (const y of [0.3, 0.6]) box(g, [x - 0.05, y, z0], [x + 0.05, y + 0.1, z1], wood);
    box(g, [x - 0.05, 0.7, z0], [x + 0.05, 0.8, z1], snow);
  };
  railX(-X, X, Z);
  railZ(-Z, Z, -X);
  railZ(-Z, Z, X);
  railX(-X, -PEN.gate / 2, -Z);
  railX(PEN.gate / 2, X, -Z);
  for (let x = -X; x <= X + 0.01; x += 1.7) { post(x, Z); if (Math.abs(x) > PEN.gate / 2 + 0.2) post(x, -Z); }
  for (const s of [-1, 1]) { post(s * (PEN.gate / 2), -Z, 1.0); post(s * X, 0); }
  // The gate, swung open outward on the left post.
  for (const y of [0.3, 0.6]) box(g, [-PEN.gate / 2 - 0.05, y, -Z - PEN.gate], [-PEN.gate / 2 + 0.05, y + 0.1, -Z], wood);
  box(g, [-PEN.gate / 2 - 0.05, 0.2, -Z - PEN.gate], [-PEN.gate / 2 + 0.05, 0.8, -Z - PEN.gate + 0.1], wood);
  // Hay rack at the back, and a little hay dropped under it.
  const [rx, , rz] = PEN.rack;
  for (const sx of [-0.8, 0.8]) for (const sz of [-0.2, 0.2]) box(g, [rx + sx - 0.05, 0, rz + sz - 0.05], [rx + sx + 0.05, 0.7, rz + sz + 0.05], wood);
  box(g, [rx - 0.85, 0.4, rz - 0.25], [rx + 0.85, 0.5, rz + 0.25], wood);
  box(g, [rx - 0.75, 0.5, rz - 0.2], [rx + 0.75, 0.8, rz + 0.2], (a, b, c) => pick(T.hay, hash3(a, b, c, 41), [0.4, 0.85]));
  box(g, [rx - 0.75, 0.8, rz - 0.2], [rx + 0.75, 0.9, rz + 0.2], snow);
  box(g, [rx - 0.5, 0, rz - 0.6], [rx + 0.4, 0.1, rz - 0.3], (a, b, c) => (hash3(a, b, c, 43) > 0.4 ? pick(T.hay, hash3(a, b, c, 45)) : null));
  // The lantern post at the back corner: a post, an arm, the lantern hanging from it.
  const [lx, ly, lz] = PEN.lamp;
  box(g, [lx - 0.1, 0.8, lz - 0.1], [lx + 0.1, ly + 0.5, lz + 0.1], wood);
  box(g, [lx - 0.1, ly + 0.4, lz - 0.7], [lx + 0.1, ly + 0.5, lz - 0.1], wood);
  box(g, [lx - 0.1, ly + 0.5, lz - 0.7], [lx + 0.1, ly + 0.6, lz + 0.1], snow);
  box(g, [lx - 0.05, ly + 0.2, lz - 0.6], [lx + 0.05, ly + 0.4, lz - 0.5], () => lin(T.beam[2]));
  box(glow, [lx - 0.15, ly - 0.15, lz - 0.7], [lx + 0.15, ly + 0.2, lz - 0.4], (a, b, c) => pick(T.lantern, hash3(a, b, c, 47)));
  return { fence: buildGeometry(g.map, g.size), glow: buildGeometry(glow.map, glow.size) };
}
