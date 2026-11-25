import { describe, expect, it } from 'vitest';
import { buildRink } from '../rink/scene';
import { RINK } from '../rink.gen';
import { MARKET } from '../market.gen';

describe('out of season (X2 check 9)', () => {
  it('every bulb and its wire in both scenes is the season\'s, so FESTIVE off leaves none', () => {
    for (const b of [...RINK.raw_boxes, ...MARKET.raw_boxes]) if (/bulb/.test(b.c) || /bulb/.test(b.note)) expect(b.note, b.note).toMatch(/season|bulb wire/);
  });
  it('the rink builds with and without the season', () => {
    expect(() => buildRink(false)).not.toThrow();
    expect(() => buildRink(true)).not.toThrow();
  });
});
