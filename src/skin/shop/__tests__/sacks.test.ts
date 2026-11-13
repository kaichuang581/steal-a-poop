import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CATALOG } from '../catalog';
import { BELLS, buy, freshWallet, grantStreakItems, MISSIONS, normalise, openSack, payGame } from '../economy';
import { NEAR_MISS, REEL, reelFor } from '../FeedSacks';
import type { Wallet } from '../economy';
import { freshPity, rollSack, tierFor } from '../roll';
import { POOL, poolFor, poolOf, RARITIES, SACK, SACK_IDS, oddsLine } from '../sacks';
import type { SackId } from '../sacks';

/** A seeded stand-in for crypto, so the simulations are repeatable. */
function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rich = (over: Partial<Wallet> = {}): Wallet => ({ ...freshWallet(), coins: 1_000_000, ...over });

describe('T0: the catalogue and the pool', () => {
  it('every sack item has a rarity, and nothing has a price: sacks are the only way to buy', () => {
    for (const i of POOL) {
      expect(i.source, i.id).toBe('sack');
      expect(i.rarity, i.id).toBeTruthy();
      expect('price' in i, i.id).toBe(false);
    }
  });
  it('mission and free items are never in a sack', () => {
    for (const i of CATALOG.filter((x) => x.source !== 'sack')) expect(POOL, i.id).not.toContain(i);
  });
  it('the odds add up to 100', () => {
    expect(RARITIES.reduce((n, r) => n + SACK.odds[r], 0)).toBe(100);
    expect(oddsLine()).toBe('Common 62% · Uncommon 28% · Rare 8% · Legendary 2%');
  });
});

describe('T1: Feed Sacks', () => {
  it('1. over 1,000,000 plain rolls the tiers land within 0.2 points of the table', () => {
    const rand = mulberry(7);
    const n = 1_000_000;
    const seen: Record<string, number> = { common: 0, uncommon: 0, rare: 0, legendary: 0 };
    for (let i = 0; i < n; i++) seen[tierFor(rand())]++;
    for (const r of RARITIES) expect(Math.abs((100 * seen[r]) / n - SACK.odds[r]), r).toBeLessThan(0.2);
  });

  it('2. no 10 sacks in a row lack a rare-or-better, and no 40 lack a legendary, even with the worst luck', () => {
    for (const [sack, rand] of SACK_IDS.flatMap((sk): [SackId, () => number][] => [[sk, () => 0.999999], [sk, mulberry(1)], [sk, mulberry(2)]])) {
      let pity = freshPity();
      let sinceRare = 0, sinceLeg = 0;
      for (let i = 0; i < 2000; i++) {
        const r = rollSack(sack, [], pity, rand)!;
        pity = r.counters;
        sinceRare = r.tier === 'rare' || r.tier === 'legendary' ? 0 : sinceRare + 1;
        sinceLeg = r.tier === 'legendary' ? 0 : sinceLeg + 1;
        expect(sinceRare).toBeLessThan(SACK.pity.rare);
        expect(sinceLeg).toBeLessThan(SACK.pity.legendary);
      }
    }
  });

  it('2b. the counters reset only when the guaranteed tier is received', () => {
    const allLow = () => 0.0; // common every time
    let pity = freshPity();
    for (let i = 0; i < 9; i++) pity = rollSack('blast', [], pity, allLow)!.counters;
    expect(pity).toEqual({ sinceRare: 9, sinceLegendary: 9 });
    const tenth = rollSack('blast', [], pity, () => 0.5)!; // forced: 0.5 is past the 20% legendary share, so rare
    expect(tenth.tier).toBe('rare');
    expect(tenth.counters).toEqual({ sinceRare: 0, sinceLegendary: 10 });
  });

  it('3. a duplicate pays its tier\'s refund and adds nothing', () => {
    const common = poolOf('tick', 'common');
    const w = rich({ owned: [...freshWallet().owned, ...common.map((i) => i.id)] });
    const r = openSack(w, 'tick', () => 0, 1);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.entry).toMatchObject({ tier: 'common', duplicate: true, refund: SACK.refund.common });
    expect(r.wallet.coins).toBe(w.coins - SACK.price + SACK.refund.common);
    expect(r.wallet.owned.length).toBe(w.owned.length);
  });

  it('4. with every rare owned a rare roll falls to an unowned uncommon; with the pool complete the sack will not open', () => {
    const rares = [...poolOf('blast', 'rare'), ...poolOf('blast', 'legendary')].map((i) => i.id);
    const ownedRares = [...freshWallet().owned, ...rares, poolOf('blast', 'uncommon')[0].id];
    const forced = rollSack('blast', ownedRares, { sinceRare: 9, sinceLegendary: 0 }, () => 0.5)!; // a rare is due
    expect(forced.tier).toBe('uncommon');
    expect(forced.duplicate).toBe(false);
    const allBombs = rich({ owned: [...freshWallet().owned, ...poolFor('bomb').map((i) => i.id)] });
    expect(rollSack('bomb', allBombs.owned, freshPity(), Math.random)).toBeNull();
    expect(openSack(allBombs, 'bomb', Math.random, 1)).toEqual({ ok: false, reason: 'complete' });
    expect(openSack(allBombs, 'blast', Math.random, 1).ok).toBe(true); // the other sacks still open
  });

  it('5. Golden Bells never open a sack, Wool Coins never buy an item, and nothing converts', () => {
    const bellsOnly = { ...freshWallet(), coins: SACK.price - 1, bells: 10_000 };
    for (const sack of SACK_IDS) expect(openSack(bellsOnly, sack, Math.random, 1)).toEqual({ ok: false, reason: 'short' });
    let w = rich({ bells: 77 });
    for (let i = 0; i < 60; i++) { const r = openSack(w, SACK_IDS[i % 3], mulberry(i), i); if (r.ok) { expect(r.wallet.bells).toBe(77); w = r.wallet; } }
    expect(buy(rich(), 'bomb-ember')).toEqual({ ok: false, reason: 'not_for_sale' }); // sack items are never sold
    expect(buy(rich(), 'bomb-aurora')).toEqual({ ok: false, reason: 'not_for_sale' }); // nor mission items
    expect(buy({ ...freshWallet(), coins: 99_999, bells: 0 }, 'bomb-brass')).toEqual({ ok: false, reason: 'short' });
    const b = buy({ ...freshWallet(), coins: 999, bells: 30 }, 'bomb-brass');
    expect(b.ok && [b.wallet.coins, b.wallet.bells]).toEqual([999, 0]);
    for (const f of ['economy.ts', 'store.ts', 'roll.ts', 'sacks.ts']) {
      const src = readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
      expect(src, f).not.toMatch(/coins\s*[+-]?=.*bells|bells\s*[+-]?=.*coins/);
    }
  });

  it('the reel lands on the real result; a planted near miss is rarer, on the side the pointer leans to, and not the rule', () => {
    let planted = 0, shortOfTop = 0;
    for (let k = 0; k < 2400; k++) {
      const tier = RARITIES[k % 4];
      const item = poolOf('blast', tier)[0];
      const reel = reelFor({ sack: 'blast', itemId: item.id, tier, duplicate: false, refund: 0, at: 0 }, mulberry(k));
      expect(reel.tiles[REEL.stop].id).toBe(item.id);
      for (const t of reel.tiles) expect(t.kind).toBe('blast');
      expect(Math.abs(reel.lean)).toBeLessThanOrEqual(0.45);
      if (tier === 'legendary') { expect(reel.nearMiss).toBe(false); continue; }
      shortOfTop++;
      if (!reel.nearMiss) continue;
      planted++;
      expect(RARITIES.indexOf(reel.tiles[REEL.stop + Math.sign(reel.lean)].rarity!)).toBeGreaterThan(RARITIES.indexOf(tier));
    }
    // About NEAR_MISS of the time (Brian: "less frequent"), and beside more than legendaries ("go close to other stuff too").
    expect(planted / shortOfTop).toBeGreaterThan(NEAR_MISS - 0.06);
    expect(planted / shortOfTop).toBeLessThan(NEAR_MISS + 0.06);
    const beside = new Set<string>();
    for (let k = 0; k < 600; k++) {
      const item = poolOf('blast', 'common')[0];
      const reel = reelFor({ sack: 'blast', itemId: item.id, tier: 'common', duplicate: false, refund: 0, at: 0 }, mulberry(9000 + k));
      if (reel.nearMiss) beside.add(reel.tiles[REEL.stop + Math.sign(reel.lean)].rarity!);
    }
    expect([...beside].sort()).toEqual(['legendary', 'rare', 'uncommon']);
  });
  it('the machine says nothing about a near miss', () => {
    expect(readFileSync(new URL('../FeedSacks.tsx', import.meta.url), 'utf8')).not.toMatch(/so close|was right next to/i);
  });

  it('7. the result is recorded in the wallet the call returns, before any reveal', () => {
    const w = rich();
    const r = openSack(w, 'bomb', mulberry(4), 123);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const back = normalise(JSON.parse(JSON.stringify(r.wallet))); // what a reload reads
    expect(back.coins).toBe(r.wallet.coins);
    expect(back.pity).toEqual(r.wallet.pity);
    expect(back.owned.includes(r.entry.itemId)).toBe(true);
  });

  it('an old wallet\'s log of openings is dropped quietly: nothing ever showed it', () => {
    const old = normalise({ coins: 5, sacks: [{ sack: 'bomb', itemId: 'bomb-ember', tier: 'common', duplicate: false, refund: 0, at: 1 }] });
    expect('sacks' in old).toBe(false);
    expect(old.coins).toBe(5);
  });

  it('8. the odds the screen shows are read from sacks.ts, the object the roll uses', () => {
    const roll = readFileSync(new URL('../roll.ts', import.meta.url), 'utf8');
    const screen = readFileSync(new URL('../FeedSacks.tsx', import.meta.url), 'utf8');
    expect(roll).toMatch(/SACK\.odds/);
    expect(screen).toMatch(/from '\.\/sacks'/);
    expect(screen).toMatch(/SACK\.odds|oddsLine/);
    expect(screen).not.toMatch(/\b62\b|\b28\b/);
  });
});

describe('Missions', () => {
  it('give their item once the goal is met, in a game or from a streak, and keep it', () => {
    expect(MISSIONS.map((m) => m.itemId)).toEqual(['bomb-aurora', 'blast-starlight', 'tick-lullaby']);
    const p = payGame({ ...freshWallet(), xp: 990 }, 'g1', { mode: 'quick', won: true, words: ['cat'] }, '2026-11-12');
    expect(p.levelUp?.to).toBe(5);
    expect(p.bells).toBe(BELLS.level);
    const s = grantStreakItems(freshWallet(), 30);
    expect(s.bells).toBe(4 * BELLS.streak7);
    expect(grantStreakItems(s.wallet, 30).bells).toBe(0);
    expect(s.granted).toEqual(['bomb-aurora', 'blast-starlight']);
    expect(s.wallet.bestStreak).toBe(30);
    const later = grantStreakItems(s.wallet, 2);
    expect(later.changed).toBe(false);
    expect(later.wallet.bestStreak).toBe(30);
    expect(later.wallet.owned).toContain('blast-starlight');
  });
  it('old wallets read with no pity, no log and no streak', () => {
    const old = normalise({ coins: 5, xp: 10, owned: ['bomb-ember'] });
    expect(old).toMatchObject({ pity: { bomb: freshPity(), blast: freshPity(), tick: freshPity() }, bestStreak: 0, streakDay: '', bells: 0 });
  });
});
