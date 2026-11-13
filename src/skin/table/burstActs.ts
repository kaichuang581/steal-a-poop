import type { BurstShape } from '../shop/catalog';

/**
 * What each Trading Post burst does when the bomb goes off (drawn by Blast.tsx; cosmetic only). Only the frost ball is
 * an explosion: it alone has `bang`, the white flash, the shell flying apart, the sinking mist and the flash of light.
 * Every other burst is an act: the shell falls open with a puff and something appears where the bomb was.
 *
 * life: seconds until everything has gone. flames / sparks: how many glowing bits and small bits it uses, of the
 * clouds' 420 and 260. fs / ss: their sizes. glow: how bright a glowing bit is (they add up, so many bits want a low
 * number). fg / sg: gravity on each (negative rises). fd / sd: drag. sway: how much the small bits flutter.
 * sb: how bright a small bit is (1 unless given). twinkle: the small bits blink. fixed: each small bit keeps one colour
 * (straw, confetti, petals), from the sparks' colours or from all of the burst's. lands: small bits come to rest on the
 * floor. hang: they slow to a stop in the air. props: how many voxel things appear (the model is voxel/burstProps.ts).
 * unlit: they are drawn unlit at this brightness, not lit by the barn: 1 for a thing that is its own colour whatever the
 * light (a white cloud, a balloon), more for one lit from inside (a sun, a lantern, a star; over 1 catches the barn's
 * bloom). light: how strongly the act lights the barn. room: the floor it needs, as a radius in metres, so a haystack
 * stands beside the sheep and not in it.
 */
export interface Act {
  life: number; bang: boolean;
  flames: number; sparks: number; fs: number; ss: number; glow: number;
  fg: number; sg: number; fd: number; sd: number; sway: number;
  sb?: number; twinkle?: boolean; fixed?: 'spark' | 'all'; lands?: boolean; hang?: boolean;
  props: number; unlit?: number; light: number; room: number;
}

/** The most voxel things one act puts up. */
export const MAX_PROPS = 16;

export const ACTS: Record<BurstShape, Act> = {
  ball: { life: 2.4, bang: true, flames: 420, sparks: 260, fs: 1, ss: 0.34, glow: 0.2, fg: 0.5, sg: 3.5, fd: 0, sd: 1.2, sway: 0, props: 0, light: 110, room: 0 },
  haystack: { life: 2.9, bang: false, flames: 40, sparks: 260, fs: 0.4, ss: 0.17, glow: 0.05, fg: 0.4, sg: 6.2, fd: 3, sd: 2, sway: 2, sb: 0.8, fixed: 'all', lands: true, props: 1, light: 0, room: 0.75 },
  snowcloud: { life: 3.7, bang: false, flames: 0, sparks: 260, fs: 0.5, ss: 0.13, glow: 0.1, fg: 0, sg: 0.4, fd: 0, sd: 0, sway: 0.9, sb: 0.9, lands: true, props: 1, unlit: 1, light: 0, room: 0 },
  balloons: { life: 4, bang: false, flames: 0, sparks: 260, fs: 0.5, ss: 0.17, glow: 0.1, fg: 0, sg: 3.6, fd: 0, sd: 2.2, sway: 2.2, sb: 0.85, fixed: 'all', lands: true, props: 9, unlit: 1, light: 0, room: 0 },
  campfire: { life: 3.3, bang: false, flames: 420, sparks: 220, fs: 0.58, ss: 0.11, glow: 0.3, fg: -1.4, sg: -0.4, fd: 0.6, sd: 0.6, sway: 0.9, twinkle: true, props: 1, light: 12, room: 0.7 },
  heather: { life: 3.3, bang: false, flames: 70, sparks: 180, fs: 0.36, ss: 0.13, glow: 0.05, fg: 0, sg: -0.15, fd: 1.6, sd: 0.5, sway: 1.1, sb: 0.85, fixed: 'all', props: 14, light: 3, room: 1.1 },
  aurora: { life: 4.4, bang: false, flames: 420, sparks: 200, fs: 0.42, ss: 0.11, glow: 0.36, fg: 0, sg: 0, fd: 0, sd: 0, sway: 0, twinkle: true, props: 0, light: 3.5, room: 0 },
  sun: { life: 3.7, bang: false, flames: 252, sparks: 220, fs: 0.3, ss: 0.12, glow: 0.22, fg: 0, sg: 0.25, fd: 0, sd: 0.8, sway: 0.3, twinkle: true, props: 1, unlit: 1.1, light: 14, room: 0 },
  lanterns: { life: 4, bang: false, flames: 0, sparks: 160, fs: 0.9, ss: 0.1, glow: 0.2, fg: 0, sg: 0.3, fd: 0, sd: 0.6, sway: 0.6, twinkle: true, props: 7, unlit: 1.02, light: 6, room: 0 },
  stars: { life: 3.9, bang: false, flames: 0, sparks: 260, fs: 0.8, ss: 0.13, glow: 0.18, fg: 0, sg: 0.25, fd: 0, sd: 3.3, sway: 0, twinkle: true, hang: true, props: 12, unlit: 1.08, light: 3, room: 0 },
};
