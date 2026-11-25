import { describe, expect, it } from 'vitest';
import { advance, BPM, bpmOf, phase, pulse, whole } from '../beat';
import { FLIGHT } from '../fly';
import { CLOSE_PX, isClose, TYPE_X } from '../run';

/** The beat and the effects (docs/dream/06-beat-and-effects.md). */
describe('the beat', () => {
  it('runs at each stage\'s beats a minute and never jumps when the stage changes', () => {
    expect(BPM).toEqual({ 1: 96, 2: 112, 3: 128 });
    expect(advance(0, 60000, 1)).toBeCloseTo(96, 9);
    expect(advance(0, 60000, 3)).toBeCloseTo(128, 9);
    // The same count, carried on at the new rate.
    const a = advance(0, 1000, 1), b = advance(a, 1000, 2);
    expect(b - a).toBeCloseTo(112 / 60, 9);
    expect(advance(5, 0, 2)).toBe(5);
    expect(bpmOf(7)).toBe(128);
  });
  it('pulses sharply on the beat and is gone in 35% of it', () => {
    expect(pulse(3)).toBe(1);
    expect(pulse(3.35)).toBe(0);
    expect(pulse(3.9)).toBe(0);
    expect(pulse(3.1)).toBeGreaterThan(pulse(3.2));
    expect(phase(4.25)).toBeCloseTo(0.25, 9);
    expect(whole(4.25)).toBe(4);
  });
  it('never pulses more than three times a second (the safety limit)', () => {
    for (const bpm of Object.values(BPM)) expect(bpm / 60).toBeLessThanOrEqual(3);
  });
});

describe('the effects\' numbers', () => {
  it('keeps to the pack\'s timings and limits', () => {
    expect(FLIGHT).toEqual({ ms: 320, stagger: 30, rise: 120, to: 16 });
  });
  it('calls a fence close when the meter would be at three of its eleven segments', () => {
    const near = 78 + 20;
    expect(CLOSE_PX).toBe(Math.round(((TYPE_X - near) * 3) / 11));
    expect(isClose({ x: near + CLOSE_PX, locked: false, passed: false })).toBe(true);
    expect(isClose({ x: near + CLOSE_PX + 1, locked: false, passed: false })).toBe(false);
    expect(isClose({ x: near + 10, locked: true, passed: false })).toBe(false);
  });
});
