import { describe, expect, it } from 'vitest';
import { itemById } from '../../shop/catalog';
import { freshWallet } from '../../shop/economy';
import { bellTile, bellsNote, missionSlips, whereFrom } from '../shopText';

describe('the words of T6', () => {
  it('says where each item comes from, from the catalogue', () => {
    expect(whereFrom(itemById('bomb-plum')!)).toBe('In the Oat Sack');
    expect(whereFrom(itemById('bomb-brass')!)).toBe('30 Bells, Bell Shelf');
    expect(whereFrom(itemById('bomb-aurora')!)).toBe('Mission: 7 dream nights');
  });
  it('the Bell Shelf tile says how many more Bells, then Buy', () => {
    const w = { ...freshWallet(), bells: 15 };
    expect(bellTile(itemById('bomb-brass')!, w).label).toBe('15 more Bells');
    expect(bellTile(itemById('bomb-brass')!, { ...w, bells: 30 }).label).toBe('Buy');
    expect(bellsNote()[0]).toBe('Golden Bells: +5 every level, +10 every milestone, +20 every 7 dream nights.');
  });
  it('seven nights is seven stamps; thirty is a knitted row', () => {
    const s = missionSlips({ ...freshWallet(), bestStreak: 3 });
    expect(s[0].stamps).toEqual([true, true, true, false, false, false, false]);
    expect(s[1].stamps).toBeNull();
  });
});
