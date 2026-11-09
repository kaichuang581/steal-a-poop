import { describe, expect, it } from 'vitest';
import { keysBlocked } from '../BarnDoors';

describe('the loading doors and the keyboard', () => {
  it('swallow keys only while they are coming down or shut', () => {
    expect(keysBlocked('veiling')).toBe(true);
    expect(keysBlocked('closing')).toBe(true);
    expect(keysBlocked('shut')).toBe(true);
  });
  it('let every key through once they open, and after they are gone (they stay mounted then)', () => {
    expect(keysBlocked('open')).toBe(false);
    expect(keysBlocked('gone')).toBe(false);
  });
});
