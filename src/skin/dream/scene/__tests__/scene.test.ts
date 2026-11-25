import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FIELD } from '../../../../dream/dream';
import { ART, PX, worldX } from '../../stage';
import { MOONS, moonAt, skyBetween, skyOf } from '../common';
import { hash2, Painter, wrap } from '../painter';
import { luma, mix, QUILT, STAGE_COLOURS } from '../palette';
import { paintFront, paintScene } from '../scene';
import { bulbLit, FARM, FENCE, hillHeight, HOUSE, sag, STAGE1 } from '../stage1';
import { alignIsles, ISLE_ROWS, isleLift, ISLES, LANE2, northernBar, rockDepth, STAGE2, stringY } from '../stage2';
import { BOX, freshMemory, GATE_MS, lookOf, S0 } from '../types';
import type { SceneState } from '../types';

/** The dream's flat scenery (docs/dream/03 to 05). */
const state = (over: Partial<SceneState> = {}): SceneState => ({
  W: 1408, H: 648, lane: 428, scroll: 0, t: 0, beats: 0, u: 1, stage: 1, gate: null, arch: null, finale: 0, counted: 0, seed: '2026-11-24',
  phone: false, low: false, reduced: false, festive: true, breath: 0, fences: [], sheep: { x: 310, lift: 0, w: 113, running: true }, ...over,
});
/** A canvas that only writes down what it is asked to fill. */
function canvas() {
  const rects: { x: number; y: number; w: number; h: number; fill: string; alpha: number }[] = [];
  const c = {
    globalAlpha: 1, fillStyle: '',
    fillRect(x: number, y: number, w: number, h: number) { rects.push({ x, y, w, h, fill: String(this.fillStyle), alpha: this.globalAlpha }); },
    save() {}, restore() {}, translate() {}, rotate() {}, setTransform() {}, clearRect() {},
  };
  return { c: c as unknown as CanvasRenderingContext2D, rects };
}

describe('the dream\'s colours', () => {
  it('are the pack\'s, stage for stage', () => {
    const pack = JSON.parse(readFileSync('docs/dream/data/palettes.json', 'utf8'));
    for (const n of [1, 2, 3] as const) {
      const mine = STAGE_COLOURS[n], theirs = pack.stages[n];
      for (const key of ['snow', 'glow', 'far', 'mid', 'shade', 'soil', 'soil2', 'rock', 'mist'] as const) expect(mine[key]).toBe(theirs[key]);
      expect([...mine.sky]).toEqual(theirs.sky);
      expect(mine.moon.across).toBe(theirs.moon.across);
      expect(MOONS[n].across).toBe(theirs.moon.across);
    }
    expect([...QUILT]).toEqual(pack.quilt);
    expect(MOONS.finale.across).toBe(pack.stages[3].moon.finaleAcross);
  });
  it('mixes one colour toward another', () => {
    expect(mix('#000000', '#FFFFFF', 0.5)).toBe('#808080');
    expect(mix('#102030', '#102030', 0.7)).toBe('#102030');
    expect(luma('#FFFFFF')).toBeCloseTo(1, 6);
    expect(luma('#000000')).toBe(0);
  });
  it('keeps the lane the brightest band of stage 1 (03, section 4)', () => {
    const C = STAGE1.C, track = luma(C.snow);
    for (const other of [C.field, C.ridge, C.ground, C.far, C.wallStone, C.wallSnow, C.shade, ...STAGE_COLOURS[1].sky]) expect(track).toBeGreaterThan(luma(other));
    // The field is in shadow: the lane is well over three times brighter (the pack measured 3.8).
    expect(track / luma(C.field)).toBeGreaterThan(3);
  });
  it('blends every sky colour across a gate, and is the stage\'s own before and after', () => {
    expect(skyBetween(1, 2, 0)).toEqual(skyOf(1));
    expect(skyBetween(1, 2, 1)).toEqual(skyOf(2));
    expect(skyBetween(2, 3, 0.5).bands[0]).toBe(mix(STAGE_COLOURS[2].sky[0], STAGE_COLOURS[3].sky[0], 0.5));
  });
});

describe('the scenery\'s measures', () => {
  it('draws an obstacle in the rules\' box, 1.35 times its size, in the plan\'s px', () => {
    expect(S0).toBeCloseTo((1440 - 20 - 12) / 320, 9);
    expect(BOX.w).toBeCloseTo(FIELD.fenceW * ART * S0, 9);
    expect(BOX.h).toBeCloseTo(FIELD.fenceH * ART * S0, 9);
    // The same mapping the sheep's camera has: a logical px is PX metres, and the sheep stands at 0.
    expect(worldX(FIELD.sheepX + 10)).toBeCloseTo(10 * PX, 9);
  });
  it('gives the fences four looks in turn and a bale its own', () => {
    expect([0, 1, 2, 3, 4].map((i) => lookOf('fence', i))).toEqual(['rail', 'picket', 'wall', 'log', 'rail']);
    expect(lookOf('bale', 12)).toBe('bale');
  });
  it('steps the far hills in twelves, inside the plan\'s heights', () => {
    for (let c = -200; c < 200; c++) {
      const h = hillHeight(c);
      expect(h % 12).toBe(0);
      expect(h).toBeGreaterThanOrEqual(12);
      expect(h).toBeLessThanOrEqual(108);
    }
  });
  it('fits the farm in its strip, in the plan\'s order, 60 px or more between groups', () => {
    const groups: [number, number][] = [[FARM.barn, 180], [FARM.silo, 50], [FARM.pines[0], 40], [FARM.pines[1], 60], [FARM.house, HOUSE.w], [FARM.scarecrow, 50], [FARM.bales, 82], [FARM.coop, 90], [FARM.pond, 140], [FARM.trees[0], 31], [FARM.trees[1], 52], [FARM.trees[2], 41]];
    for (let i = 1; i < groups.length; i++) expect(groups[i][0]).toBeGreaterThanOrEqual(groups[i - 1][0] + groups[i - 1][1]);
    expect(FARM.silo).toBe(FARM.barn + 180); // the silo stands against the barn's right side
    expect(groups[groups.length - 1][0] + 60).toBeLessThan(FARM.period);
    expect(FARM.house - (FARM.pines[1] + 60)).toBeGreaterThanOrEqual(60);
  });
  it('hangs the bulbs\' wire 8 px at the middle in 2 px steps, and walks one lit bulb in four along the fence', () => {
    expect(sag(0)).toBe(0);
    expect(sag(FENCE.post / 2)).toBe(8);
    for (let x = 0; x <= FENCE.post; x++) expect(sag(x) % 2).toBe(0);
    for (const beats of [0, 1.4, 7.9]) expect([0, 1, 2, 3, 4, 5, 6, 7].filter((i) => bulbLit(i, beats)).length).toBe(2);
    expect(bulbLit(0, 0)).toBe(true);
    expect(bulbLit(0, 1.2)).toBe(false);
    expect(bulbLit(3, 1.2)).toBe(true);
  });
  it('moves the moon from its stage\'s place to the finale\'s', () => {
    const one = moonAt(state()), fin = moonAt(state({ stage: 3, finale: 1, beats: 0.5 }));
    expect(one.crescent).toBe(1);
    expect(one.r).toBe(48);
    expect(one.cx).toBeCloseTo(0.82 * 1408, 6);
    expect(fin.r).toBe(150);
    expect(fin.cx).toBeCloseTo(0.44 * 1408, 6);
    expect(moonAt(state({ stage: 2 })).crescent).toBe(0);
  });
  it('has stable hashes and wraps', () => {
    expect(hash2(3, 7)).toBe(hash2(3, 7));
    expect(hash2(3, 7)).not.toBe(hash2(7, 3));
    expect(wrap(-1, 4)).toBe(3);
  });
});

describe('painting a frame', () => {
  const FENCES = (['rail', 'picket', 'wall', 'log', 'bale'] as const).map((look, i) => ({ index: i, look, stage: 1 as const, x: 500 + i * 160, lit: i % 2 === 0, tilt: i === 4 ? 1.2 : 0, signX: 536 + i * 160, signTop: 150 }));
  it('lands every edge on a whole device pixel, at any scale', () => {
    for (const K of [1, 0.886, 0.358 * 2, 1.5 * 2]) {
      const { c, rects } = canvas();
      paintScene(new Painter(c, K), state({ fences: FENCES, scroll: 12345.6, t: 4000, beats: 6.3 }), freshMemory(), () => {});
      expect(rects.length).toBeGreaterThan(300);
      for (const r of rects) for (const v of [r.x, r.y, r.w, r.h]) expect(Number.isInteger(v)).toBe(true);
      for (const r of rects) { expect(r.w).toBeGreaterThan(0); expect(r.h).toBeGreaterThan(0); }
    }
  });
  it('stays a light frame: a few thousand rectangles, fewer on the Low tier', () => {
    const count = (over: Partial<SceneState>) => { const { c, rects } = canvas(); paintScene(new Painter(c, 2), state({ fences: FENCES, scroll: 900, t: 2500, beats: 3.1, ...over }), freshMemory(), () => {}); return rects.length; };
    const full = count({}), low = count({ low: true });
    expect(full).toBeLessThan(4500);
    expect(low).toBeLessThan(full);
  });
  it('fills the whole window: the sky down to the lane, and the lane\'s track in snow right across it', () => {
    const { c, rects } = canvas();
    paintScene(new Painter(c, 1), state(), freshMemory(), () => {});
    const track = rects.find((r) => r.fill === STAGE_COLOURS[1].snow && r.y === 428 && r.w === 1408);
    expect(track?.h).toBe(14);
    expect(rects[0]).toMatchObject({ x: 0, y: 0, w: 1408, fill: STAGE_COLOURS[1].sky[0] });
  });
  it('draws nothing in front of the sheep on the Low tier or under reduced motion, and streaks otherwise', () => {
    const front = (over: Partial<SceneState>) => { const { c, rects } = canvas(); paintFront(new Painter(c, 1), state({ scroll: 700, ...over })); return rects.length; };
    expect(front({})).toBe(6);
    expect(front({ low: true })).toBe(0);
    expect(front({ reduced: true })).toBe(0);
    expect(front({ sheep: { x: 310, lift: 0, w: 113, running: false } })).toBe(0);
  });
  it('leaves a hoofprint at each stride and forgets it two seconds later', () => {
    const m = freshMemory(), { c } = canvas();
    for (let i = 0; i <= 10; i++) paintScene(new Painter(c, 1), state({ scroll: i * 40, t: i * 100 }), m, () => {});
    expect(m.prints.length).toBeGreaterThan(2);
    expect(m.prints.length).toBeLessThanOrEqual(24);
    paintScene(new Painter(c, 1), state({ scroll: 400, t: 4000, sheep: { x: 310, lift: 0, w: 113, running: false } }), m, () => {});
    expect(m.prints.length).toBe(0);
  });
});

describe('stage 2, the farm lifts off (04)', () => {
  it('keeps the lane the brightest band', () => {
    const C = STAGE2.C, top = luma(C.snow);
    for (const other of [C.shade, C.soil, C.soil2, C.rock, C.below, C.isleSnow, C.clod, ...STAGE_COLOURS[2].sky]) expect(top).toBeGreaterThan(luma(other));
  });
  it('builds every island the same way: five stepped rows, each narrower, and a top wide enough for what stands on it', () => {
    expect([...ISLE_ROWS]).toEqual([0.86, 0.66, 0.5, 0.3, 0.14]);
    expect(ISLES.tops).toEqual({ barn: 140, windmill: 150, farmhouse: 130, coop: 90, pond: 120 });
    // Three islands are on screen at a time on a computer.
    expect(Math.round(1408 / ISLES.gap)).toBe(3);
    // None enters the top 70 px: the highest top still leaves its building under the counters.
    for (let n = -20; n < 20; n++) { const lift = isleLift(n, 428); expect(428 - lift).toBeGreaterThan(70 + 100); expect(lift).toBeGreaterThan(90); }
  });
  it('raises an island from where its own building stands on the farm as the gate opens', () => {
    const st = state({ scroll: 5000, stage: 2 }), phase = alignIsles(st), period = ISLES.gap * ISLES.kinds.length;
    expect(phase).toBeGreaterThanOrEqual(0);
    expect(phase).toBeLessThan(period);
    // Some island's left edge is then where a building of the farm's strip is on screen.
    const farm = (home: number) => wrap(home - st.scroll * 0.35, 2400);
    const homes = [70, 700, 1380, 1600].map(farm), islands = ISLES.kinds.map((_, i) => wrap(i * ISLES.gap - st.scroll * ISLES.speed + phase, period));
    expect(homes.some((h) => islands.some((x) => Math.abs(x - h) < 1e-6 || Math.abs(Math.abs(x - h) - period) < 1e-6))).toBe(true);
  });
  it('waves the northern light and the string of bulbs, and steps the rock under the lane in eights', () => {
    for (let x = 0; x < 1400; x += 37) for (const t of [0, 1.3, 9]) {
      const b = northernBar(x, t);
      expect(b.h).toBeGreaterThanOrEqual(0);
      expect(b.h).toBeLessThanOrEqual(92);
      expect(b.top).toBeGreaterThanOrEqual(224);
      expect(b.top).toBeLessThanOrEqual(276);
      expect(Math.abs(stringY(x, t, 14) + 46)).toBeLessThanOrEqual(14);
      expect(stringY(x, t, 0)).toBe(-46);
      expect(rockDepth(x) % 8).toBe(0);
      expect(rockDepth(x)).toBeGreaterThanOrEqual(8);
      expect(rockDepth(x)).toBeLessThanOrEqual(72);
    }
    expect(LANE2).toEqual({ top: 12, lip: 4, soil: 24, soil2: 22 });
  });
  it('paints the stage, the gate into it, and the gate under reduced motion, on whole pixels', () => {
    const fences = [{ index: 6, look: 'wall' as const, stage: 2 as const, x: 700, lit: true, tilt: 0, signX: 736, signTop: 150 }];
    for (const over of [
      { stage: 2 as const },
      { stage: 2 as const, gate: { from: 1 as const, ms: 0 }, arch: { to: 2 as const, x: 300, since: 0 } },
      { stage: 2 as const, gate: { from: 1 as const, ms: 500 }, arch: { to: 2 as const, x: 240, since: 500 } },
      { stage: 2 as const, gate: { from: 1 as const, ms: 1100 } },
      { stage: 2 as const, gate: { from: 1 as const, ms: 100 }, reduced: true },
      { stage: 2 as const, low: true, phone: true },
    ]) {
      const { c, rects } = canvas();
      paintScene(new Painter(c, 1.3), state({ scroll: 9000, t: 30000, beats: 40.2, fences, ...over }), freshMemory(), () => {});
      expect(rects.length).toBeGreaterThan(200);
      expect(rects.length).toBeLessThan(6000);
      for (const r of rects) for (const v of [r.x, r.y, r.w, r.h]) expect(Number.isInteger(v)).toBe(true);
      for (const r of rects) { expect(r.alpha).toBeGreaterThan(0); expect(r.alpha).toBeLessThanOrEqual(1); }
    }
    expect(GATE_MS).toEqual({ 1: 1200, 2: 1000, reduced: 200 });
  });
  it('spreads one ring from the gate over the window for half a second, and never under reduced motion', () => {
    const ring = (over: Partial<SceneState>) => { const { c, rects } = canvas(); paintFront(new Painter(c, 1), state({ stage: 2, low: true, ...over })); return rects.length; };
    expect(ring({ arch: { to: 2, x: 300, since: 200 } })).toBeGreaterThan(50);
    expect(ring({ arch: { to: 2, x: 300, since: 600 } })).toBe(0);
    expect(ring({ arch: { to: 2, x: 300, since: -1 } })).toBe(0);
    expect(ring({ arch: { to: 2, x: 300, since: 200 }, reduced: true })).toBe(0);
  });
});

