import { describe, expect, it } from 'vitest';
import { DROWSY_LID, drowsyAt, farmerGeometry, farmerRubArm, settleAt, STIR_MS, stirAt } from '../dream/bedroom';

/** A snap is a pose crossing most of its range in a frame or two; an eased move takes at least eight. */
const SNAP = 0.12;
const rest = { roll: 0, nod: 0, lidA: 1, lidB: 1, heave: 0 };
const near = (a: Record<string, number>, b: Record<string, number>) => Object.keys(b).forEach((k) => expect(a[k]).toBeCloseTo(b[k], 9));

/** The largest jump in any channel between two frames 1/60 s apart, over a stretch of time (ms). */
function biggestStep(at: (ms: number) => object, from: number, to: number): number {
  const values = (ms: number) => (Object.values(at(ms)) as (number | number[])[]).flat();
  let worst = 0, prev = values(from);
  for (let ms = from + 1000 / 60; ms <= to; ms += 1000 / 60) {
    const next = values(ms);
    next.forEach((v, i) => { worst = Math.max(worst, Math.abs(v - prev[i])); });
    prev = next;
  }
  return worst;
}

describe("the farmer stirs on a bump instead of waking", () => {
  it('starts from his sleeping pose, so the stir never snaps', () => {
    near({ ...stirAt(0) }, rest);
    expect(stirAt(-50)).toEqual(stirAt(0));
  });
  it('moves smoothly: no channel jumps more than a little between frames', () => {
    expect(biggestStep(stirAt, 0, STIR_MS + 500)).toBeLessThan(SNAP);
    expect(biggestStep(settleAt, 0, 2000)).toBeLessThan(SNAP);
  });
  it('ends peeking, one eye cracked open, never wide awake', () => {
    const end = stirAt(STIR_MS + 1000);
    expect(Math.min(end.lidA, end.lidB)).toBeLessThan(0.7);
    expect(Math.min(end.lidA, end.lidB)).toBeGreaterThan(0.4);
    expect(end).toEqual(stirAt(STIR_MS));
  });
  it('settles back to sleep after a bump that does not end the night', () => {
    near({ ...settleAt(2000) }, rest);
  });
});

describe('propped up and drowsy in the results', () => {
  it('is half-lidded at most, never wide-eyed, and eases between poses', () => {
    for (let t = 0; t < 30; t += 0.05) expect(drowsyAt(t, false).lid).toBeGreaterThanOrEqual(DROWSY_LID - 1e-9);
    expect(biggestStep((ms) => drowsyAt(ms / 1000, false), 0, 30000)).toBeLessThan(SNAP);
  });
  it('blinks and nods off now and then', () => {
    const lids = Array.from({ length: 600 }, (_, i) => drowsyAt(2 + i * 0.05, false).lid);
    expect(Math.max(...lids)).toBeGreaterThan(0.9);
  });
  it('holds one pose under reduced motion', () => {
    expect(drowsyAt(0, true)).toEqual(drowsyAt(7.3, true));
    expect(drowsyAt(0, true).lid).toBe(DROWSY_LID);
  });
  it('builds his lids and the arm that rubs his eye', () => {
    const f = farmerGeometry();
    for (const g of [f.lidA, f.lidB, farmerRubArm()]) expect(g.getAttribute('position').count).toBeGreaterThan(0);
    expect(f.asleep.getAttribute('position').count).toBeGreaterThan(f.awake.getAttribute('position').count);
  });
});
