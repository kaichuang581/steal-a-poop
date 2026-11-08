import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { beat, DEX_KEY, dexProgress, meet, mergeDex, readBestiary } from '../bestiary';
import { getHuntBest, huntShareText, recordHuntBest } from '../record';
import { memoryStorage } from './helpers';

describe('the share text with a pack code', () => {
  it('carries the pack, the try, the marks, a walk home, a record, an older list and the link', () => {
    const text = huntShareText({
      defeated: 3, damage: 412, marks: ['hit', 'hit', 'crit', 'broke', 'hit', 'timeout', 'hit', 'item', 'hit', 'hit', 'hit', 'crit', 'hit', 'hit'],
      record: true, code: 'K7QX2', attempt: 1, stale: true, walked: 'Shadow Wolf', link: 'finishtheword.app/?pack=K7QX2',
    });
    expect(text).toBe([
      'Finish the Word · Hunt', 'Pack K7QX2 · 1st try', '3 predators beaten · 412 damage', 'oo*xo-o+oo', 'o*oo',
      'Walked home after the Shadow Wolf', 'New personal best', 'Made with an older word list', 'Fight this pack: finishtheword.app/?pack=K7QX2',
    ].join('\n'));
  });

  it('leaves out what the run did not have, and the link when there is no page', () => {
    expect(huntShareText({ defeated: 1, damage: 40, marks: ['hit'], code: 'K7QX1', attempt: 5 }))
      .toBe('Finish the Word · Hunt\nPack K7QX1 · 5th try\n1 predator beaten · 40 damage\no');
  });

  it('without a code it is the old text exactly', () => {
    expect(huntShareText({ defeated: 2, damage: 312, marks: ['hit', 'crit', 'broke', 'timeout'], record: true }))
      .toBe('Finish the Word · Hunt\n2 predators beaten · 312 damage\no*x-\nNew personal best');
  });
});

describe('records and the bestiary', () => {
  let data: Map<string, string>, done: () => void;
  beforeEach(() => ({ data, done } = memoryStorage()));
  afterEach(() => done());

  it('the best keeps its shape, gains the optional fields, and old records still load', () => {
    data.set('sap:hunt-best', JSON.stringify({ defeated: 1, damage: 30 }));
    expect(getHuntBest()).toEqual({ defeated: 1, damage: 30 });
    expect(recordHuntBest({ defeated: 2, damage: 90, code: 'K7QX1', attempt: 2, date: '2026-11-07' }).isNew).toBe(true);
    expect(getHuntBest()).toEqual({ defeated: 2, damage: 90, code: 'K7QX1', attempt: 2, date: '2026-11-07' });
  });

  it('a walk home counts as no more than the predators beaten', () => {
    recordHuntBest({ defeated: 5, damage: 700 });
    expect(recordHuntBest({ defeated: 5, damage: 600, walked: true }).isNew).toBe(false);
    expect(recordHuntBest({ defeated: 5, damage: 800, walked: true }).isNew).toBe(true);
    expect(getHuntBest()).toMatchObject({ defeated: 5, damage: 800, walked: true });
  });

  it('meet marks a kind once with the date; beat counts, keeps the higher level and the bigger word', () => {
    expect(dexProgress(readBestiary())).toEqual({ met: 0, beaten: 0, of: 6 });
    meet('fox', '2026-11-07');
    meet('fox', '2026-11-08');
    expect(readBestiary().fox).toEqual({ met: true, beaten: 0, highestLevel: 0, bestWord: null, firstMet: '2026-11-07' });
    beat('fox', 7, { word: 'blizzard', damage: 48 });
    beat('fox', 5, { word: 'cat', damage: 9 });
    beat('wolf', 6, null);
    const b = readBestiary();
    expect(b.fox).toMatchObject({ beaten: 2, highestLevel: 7, bestWord: { word: 'blizzard', damage: 48 } });
    expect(b.wolf).toMatchObject({ met: true, beaten: 1 });
    expect(dexProgress(b)).toEqual({ met: 2, beaten: 2, of: 6 });
  });

  it('a stored value missing a kind, or with a broken card, gets the default for it', () => {
    data.set(DEX_KEY, JSON.stringify({ fox: { met: true, beaten: 2, highestLevel: 6, bestWord: null }, lynx: { met: 'yes' } }));
    const b = readBestiary();
    expect(b.fox.beaten).toBe(2);
    expect(b.lynx).toEqual({ met: false, beaten: 0, highestLevel: 0, bestWord: null });
    expect(b.shadow.met).toBe(false);
  });

  it('merging two cards takes the maxima, the bigger word and the earlier first meeting', () => {
    expect(mergeDex(
      { met: true, beaten: 3, highestLevel: 6, bestWord: { word: 'storm', damage: 20 }, firstMet: '2026-11-09' },
      { met: true, beaten: 1, highestLevel: 9, bestWord: { word: 'blizzard', damage: 48 }, firstMet: '2026-11-02' },
    )).toEqual({ met: true, beaten: 3, highestLevel: 9, bestWord: { word: 'blizzard', damage: 48 }, firstMet: '2026-11-02' });
  });
});
