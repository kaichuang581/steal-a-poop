import { describe, expect, it } from 'vitest';
import { DIVISION_POINTS, ELO_K, TIERS, TOP_FLOOR, expectedScore, rankOf, ratingChanges, signed } from '../ranked';

describe('the ladder', () => {
  it('has eight ranks, seven of them in three divisions of 100 points, the eighth open at the top', () => {
    expect(TIERS).toHaveLength(8);
    expect(new Set(TIERS.map((t) => t.id)).size).toBe(8);
    expect(TOP_FLOOR).toBe(7 * 3 * DIVISION_POINTS);
    expect(rankOf(0).label).toBe('Lamb I');
    expect(rankOf(99).label).toBe('Lamb I');
    expect(rankOf(100).label).toBe('Lamb II');
    expect(rankOf(299).label).toBe('Lamb III');
    expect(rankOf(300).label).toBe('Yearling I');
    expect(rankOf(1000).label).toBe('Ram II');
    expect(rankOf(2099).label).toBe('Blue Ribbon III');
    expect(rankOf(2100).label).toBe('Golden Fleece');
    expect(rankOf(2600)).toMatchObject({ tier: 7, division: null, points: 500, toNext: null, next: null });
  });

  it('says how far into a division a rating is and what comes next', () => {
    expect(rankOf(964)).toMatchObject({ tier: 3, name: 'Ram', division: 1, points: 64, toNext: 36, next: 'Ram II' });
    expect(rankOf(1199)).toMatchObject({ label: 'Ram III', toNext: 1, next: 'Bellwether I' });
    expect(rankOf(2050).next).toBe('Golden Fleece');
  });

  it('every rating belongs to exactly one rank, and ranks only go up with the rating', () => {
    let last = -1;
    for (let r = 0; r <= 2400; r += 7) {
      const k = rankOf(r);
      const order = k.tier * 3 + (k.division ?? 1) - 1;
      expect(order).toBeGreaterThanOrEqual(last);
      last = order;
    }
    expect(rankOf(-50).label).toBe('Lamb I');
    expect(rankOf(Number.NaN).label).toBe('Lamb I');
  });

  it('names nothing after another game\'s ranks', () => {
    for (const t of TIERS) expect(t.name).not.toMatch(/iron|bronze|silver|gold\b|platinum|diamond|ascendant|immortal|radiant|mythic|legendary|masters|pro\b/i);
  });
});

describe('the rating maths', () => {
  const at = (rating: number, ...places: number[]) => places.map((place, i) => ({ id: `p${i + 1}`, rating, place }));

  it('expects an even game between equals and a one-sided one across a wide gap', () => {
    expect(expectedScore(1000, 1000)).toBe(0.5);
    expect(expectedScore(1400, 1000)).toBeCloseTo(10 / 11);
    expect(expectedScore(1000, 1400)).toBeCloseTo(1 / 11);
  });

  it('a duel between equals moves both by half of K', () => {
    const r = ratingChanges(at(1200, 1, 2));
    expect(r.p1.delta).toBe(ELO_K / 2);
    expect(r.p2.delta).toBe(-ELO_K / 2);
    expect(r.p1).toMatchObject({ before: 1200, after: 1216, place: 1 });
  });

  it('at a table of four equals, first and last move as in a duel and the middle two a third as much', () => {
    const r = ratingChanges(at(1200, 1, 2, 3, 4));
    expect([r.p1.delta, r.p2.delta, r.p3.delta, r.p4.delta]).toEqual([16, 5, -5, -16]);
    expect(Object.values(r).reduce((a, x) => a + x.delta, 0)).toBe(0); // from Ram up, what one gains another loses
  });

  it('beating a much stronger player pays far more than beating a much weaker one', () => {
    const upset = ratingChanges([{ id: 'low', rating: 1000, place: 1 }, { id: 'high', rating: 1400, place: 2 }]);
    const routine = ratingChanges([{ id: 'low', rating: 1000, place: 2 }, { id: 'high', rating: 1400, place: 1 }]);
    expect(upset.low.delta).toBe(29);
    expect(upset.high.delta).toBe(-29);
    expect(routine.high.delta).toBe(3);
    expect(routine.low.delta).toBe(-3);
  });

  it('softens a loss at the bottom of the ladder: none in Lamb, half in Yearling, three quarters in Shearling, all from Ram up', () => {
    const lost = (rating: number) => ratingChanges([{ id: 'w', rating, place: 1 }, { id: 'l', rating, place: 2 }]).l.delta;
    expect(lost(150)).toBe(0);
    expect(lost(450)).toBe(-8);
    expect(lost(750)).toBe(-12);
    expect(lost(1050)).toBe(-16);
    expect(lost(1900)).toBe(-16);
  });

  it('a newcomer starts at 0, cannot go below it, and climbs by winning', () => {
    const r = ratingChanges(at(0, 1, 2, 3));
    expect(r.p1).toMatchObject({ before: 0, after: 16 });
    expect(r.p2.after).toBe(0);
    expect(r.p3.after).toBe(0);
    for (const x of Object.values(ratingChanges([{ id: 'a', rating: 3, place: 2 }, { id: 'b', rating: 900, place: 1 }]))) expect(x.after).toBeGreaterThanOrEqual(0);
  });

  it('coming first always gains at least a point, even against players far below', () => {
    const r = ratingChanges([{ id: 'top', rating: 2400, place: 1 }, { id: 'new', rating: 0, place: 2 }]);
    expect(r.top.delta).toBe(1);
  });

  it('a tie is a draw, and one player alone changes nothing', () => {
    const tie = ratingChanges(at(1200, 1, 1));
    expect(tie.p1.delta).toBe(0);
    expect(tie.p2.delta).toBe(0);
    expect(ratingChanges(at(1200, 1)).p1).toMatchObject({ before: 1200, after: 1200, delta: 0 });
    expect(ratingChanges([])).toEqual({});
  });

  it('writes a change with its sign', () => {
    expect(signed(16)).toBe('+16');
    expect(signed(-8)).toBe('-8');
    expect(signed(0)).toBe('+0');
  });
});
