import type { Shot } from './layout';
import { buildGeometry } from '../voxel/mesher';
import { ICE_CRACK, lin, pick, T } from '../voxel/palette';
import { box, ellipsoid, Grid, hash3, rng } from '../voxel/primitives';
import { detailed } from '../voxel/refine';

/**
 * The practice run's own place: a narrow spit of ice out on a black lake at night, with you and the bot face to face on
 * it and a crack running between you. The camera stands side on, like a showdown, and closes in as your clock runs out.
 * +y is up and the camera looks toward +z, so +x is the left of the screen and "you" stand on the left.
 */
export const DUEL = {
  /** Each sheep stands this far from the crack. */
  gap: 1.7,
  /** The spit's half length and half width. */
  halfX: 5.8, halfZ: 1.7,
  /** The lake's surface, under the ice. */
  waterY: -0.4,
  /** The bomb swells with every word, and a long run would swell it out of this closer frame. */
  maxBomb: 1.7,
  /** The two lanterns at the spit's ends, behind the sheep. */
  lamps: [[4.9, 2.4, 1.2], [-4.9, 2.4, 1.2]] as const,
  /**
   * The letter's signpost (V6 Part 5.2 on the ice): a post frozen into the crack behind the two of them, an arm over the
   * crack, and the carved letter board hanging from the arm's end at `hook`, low enough to stay in the closest shot.
   */
  post: { z: 0.9, armY: 2.9 },
  hook: [0, 2.9, 0] as const,
  /** Each name stake stands just behind its sheep's rump, tall enough for its plank to clear the sheep's back. */
  stake: { x: 2.35, z: 0.5, height: 26 },
};

/** Seat 0 is you, seat 1 the bot: on the same line, each looking straight at the other. */
export function duelSeat(index: number): { x: number; z: number; yaw: number } {
  const side = index === 0 ? 1 : -1;
  return { x: side * DUEL.gap, z: 0, yaw: -side * (Math.PI / 2) }; // the model's front is +z
}

/** `near` is the camera at full pressure, `far` with no pressure at all; a run opens further back still. */
const SHOT = {
  desktop: { far: 8.6, near: 6.8, open: 11.5, fov: 30, height: 2.5, aimY: 1.05, lean: 0.3 },
  // A tall screen is narrow: the two sheep only fit from further back, so a phone closes in less and never leans.
  phone: { far: 14.8, near: 13.8, open: 17, fov: 46, height: 3.0, aimY: 1.4, lean: 0 },
};

/** Where the camera wants to be: `pressure` runs 0 (a full clock) to 1 (out of time); no speaker is the wide opening shot. */
export function duelShot(speaker: number | null, pressure: number, phone: boolean): Shot {
  const s = phone ? SHOT.phone : SHOT.desktop;
  const d = speaker === null ? s.open : s.far + (s.near - s.far) * pressure;
  const x = speaker === null ? 0 : duelSeat(speaker).x * (s.lean / DUEL.gap) * (0.4 + 0.6 * pressure);
  return { position: [x, s.height, -d], target: [x, s.aimY, 0], fov: s.fov };
}

let built: ReturnType<typeof make> | null = null;
/** The static place, built once. */
export function buildDuel() {
  return (built ??= make());
}

function make() {
  return { ice: spit(), water: water(), floes: floes(), shore: shore(), pines: pines(), ...lamps() };
}

/** The ice spit: ragged at the edge, snow in drifts, top surface at y = 0, with the crack across its middle. */
function spit() {
  const g = new Grid(0.1);
  const crackAt = (z: number) => Math.round(Math.sin(z * 0.45) * 2 + (hash3(0, 0, z >> 1, 3) - 0.5) * 3);
  for (let x = -60; x <= 60; x++) {
    for (let z = -20; z <= 20; z++) {
      const u = Math.abs(x * g.size) / DUEL.halfX, v = Math.abs(z * g.size) / DUEL.halfZ;
      if (u ** 4 + v ** 4 > 1 - hash3(x >> 2, 0, z >> 2, 7) * 0.3) continue;
      const crack = x === crackAt(z);
      const snow = hash3(x >> 2, 1, z >> 2, 9) > 0.62;
      const r = hash3(x, 0, z, 11);
      for (let y = -6; y <= -1; y++) {
        if (y === -1) g.set(x, y, z, crack ? lin(ICE_CRACK) : snow ? pick(T.snow, r) : pick(T.ice, r));
        else g.set(x, y, z, pick(T.ice, r, [0.2, 0.5]));
      }
    }
  }
  return buildGeometry(g.map, g.size);
}

/** The black lake, in big blocks: the fog takes it well before the blocks show. */
function water() {
  const g = new Grid(2);
  box(g, [-90, -2, -60], [90, 0, 90], (x, y, z) => lin(hash3(x, y, z, 21) > 0.5 ? '#1A2D44' : '#182A40'));
  return buildGeometry(g.map, g.size);
}

/** Loose plates of ice drifting behind the spit, and a few in front. */
function floes() {
  const g = new Grid(0.2);
  const r = rng(31);
  for (let i = 0; i < 22; i++) {
    const front = i < 4;
    const x = (r() - 0.5) * (front ? 12 : 34);
    const z = front ? -3.2 - r() * 1.6 : 3.4 + r() * 16;
    const w = 0.5 + r() * 1.3;
    ellipsoid(g, [x, DUEL.waterY, z], [w, 0.24, w * (0.5 + r() * 0.5)], (a, b, c) => pick(T.ice, hash3(a, b, c, 33), [0.3, 0.7]), 0.25, i + 1);
  }
  const fine = detailed(g.map, g.size);
  return buildGeometry(fine.map, fine.size);
}

/** The far shore: a low bank of dark snow rising to a wall of rock that shuts the lake in. */
function shore() {
  const g = new Grid(1);
  for (let x = -70; x <= 70; x++) {
    for (let z = 24; z <= 56; z++) {
      const rise = Math.max(0, z - 36) * 0.45;
      const top = Math.round(1 + rise + hash3(x >> 2, 0, z >> 2, 41) * (2 + rise * 0.4));
      // Solid to the waterline: a shell shows the sky through the steps of the rock.
      for (let y = -2; y <= top; y++) g.set(x, y, z, lin(hash3(x, y, z, 43) > 0.5 ? '#34465C' : '#2A3A4E'));
    }
  }
  const fine = detailed(g.map, g.size);
  return buildGeometry(fine.map, fine.size);
}

/** Black pines along the bank, more a shape against the sky than trees. */
function pines() {
  const g = new Grid(0.5);
  const r = rng(51);
  for (let i = 0; i < 22; i++) {
    const x = -44 + i * 4.2 + (r() - 0.5) * 2.4;
    const z = 25 + r() * 9;
    const h = 7 + r() * 6;
    box(g, [x - 0.5, 1, z - 0.5], [x + 0.5, 3, z + 0.5], () => lin('#141C26'));
    for (let y = 3; y < h; y += 0.5) {
      const w = Math.max(0.5, (1 - (y - 3) / (h - 3)) * 2.6 * (0.75 + ((y * 2) % 3) * 0.12));
      box(g, [x - w, y, z - w], [x + w, y + 0.5, z + w], (a, b, c) => lin(hash3(a, b, c, 53) > 0.5 ? '#16222C' : '#101A24'));
    }
  }
  const fine = detailed(g.map, g.size);
  return buildGeometry(fine.map, fine.size);
}

/** Two lantern posts on the ice: the posts are lit by the scene, the lanterns glow on their own. */
function lamps() {
  const post = new Grid(0.1);
  const glow = new Grid(0.1);
  for (const [x, y, z] of DUEL.lamps) {
    box(post, [x - 0.1, 0, z - 0.1], [x + 0.1, y - 0.2, z + 0.1], (a, b, c) => pick(T.beam, hash3(a, b, c, 61)));
    box(post, [x - 0.3, y + 0.3, z - 0.3], [x + 0.3, y + 0.4, z + 0.3], () => lin(T.beam[2]));
    box(glow, [x - 0.1, y - 0.2, z - 0.1], [x + 0.1, y + 0.3, z + 0.1], (a, b, c) => pick(T.lantern, hash3(a, b, c, 63)));
  }
  // The letter's signpost: up out of the crack, then an arm forward over it, a little snow on the arm.
  const { z: pz, armY } = DUEL.post;
  box(post, [-0.05, -0.1, pz - 0.05], [0.05, armY + 0.1, pz + 0.05], (a, b, c) => pick(T.beam, hash3(a, b >> 1, c, 65)));
  box(post, [-0.05, armY, DUEL.hook[2] - 0.15], [0.05, armY + 0.1, pz - 0.05], (a, b, c) => pick(T.beam, hash3(a, b, c >> 1, 67)));
  // A crossbar at the arm's end for the board's two ropes.
  box(post, [-0.45, armY, -0.05], [0.45, armY + 0.1, 0.05], (a, b, c) => pick(T.beam, hash3(a >> 1, b, c, 73)));
  box(post, [-0.45, armY + 0.1, -0.05], [0.45, armY + 0.2, 0.05], (a, b, c) => (hash3(a, b, c, 69) > 0.35 ? pick(T.snow, hash3(a, 0, 0, 71)) : null));
  box(post, [-0.05, armY + 0.1, DUEL.hook[2] + 0.05], [0.05, armY + 0.2, pz + 0.05], (a, b, c) => (hash3(a, b, c, 69) > 0.35 ? pick(T.snow, hash3(c, 0, 0, 71)) : null));
  return { posts: buildGeometry(post.map, post.size), glow: buildGeometry(glow.map, glow.size) };
}
