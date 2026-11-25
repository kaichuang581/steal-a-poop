import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FIELD } from '../../../../dream/dream';
import { ART, PX, worldX } from '../../stage';
import { MOONS, moonAt, skyBetween, skyOf } from '../common';
import { hash2, Painter, wrap } from '../painter';
import { luma, mix, QUILT, STAGE_COLOURS } from '../palette';
import { paintFront, paintScene } from '../scene';
import { bulbLit, FARM, FENCE, hillHeight, HOUSE, sag, STAGE1 } from '../stage1';
import { BOX, freshMemory, lookOf, S0 } from '../types';
import type { SceneState } from '../types';

/** The dream's flat scenery (docs/dream/03 to 05). */
const state = (over: Partial<SceneState> = {}): SceneState => ({
  W: 1408, H: 648, lane: 428, scroll: 0, t: 0, beats: 0, u: 1, stage: 1, gate: null, finale: 0, counted: 0, seed: '2026-11-24',
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
  const FENCES = (['rail', 'picket', 'wall', 'log', 'bale'] as const).map((look, i) => ({ index: i, look, x: 500 + i * 160, lit: i % 2 === 0, tilt: i === 4 ? 1.2 : 0, signX: 536 + i * 160, signTop: 150 }));
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
