import { describe, expect, it } from 'vitest';
import type { GameReward } from '../../src/skin/shop/economy';
import { freshWallet } from '../../src/skin/shop/economy';
import { BarnService, BOARD_TOP, IMPORT_BELL_CAP, IMPORT_LEGENDARY_CAP, IMPORT_RARE_CAP, IMPORT_STREAK_CAP } from './service';
import { MemoryBarnStore } from './store';

const DAY = Date.UTC(2026, 10, 12, 12);
const win: GameReward = { mode: 'quick', won: true, words: ['cat', 'tomorrow'] };
const loss: GameReward = { mode: 'quick', won: false, words: ['cat'] };

describe('the profile rank, by XP', () => {
  it('is null for a player with no XP, and they are not counted', async () => {
    const svc = new BarnService(new MemoryBarnStore(), () => DAY);
    await svc.wallet('nobody');
    expect(await svc.rank('nobody')).toBeNull();
    await svc.claim('a', 'quick:a1', win);
    expect(await svc.rank('a')).toMatchObject({ place: 1, players: 1, top: 100 });
  });

  it('places players by XP: more XP is a better place, ties share it', async () => {
    const svc = new BarnService(new MemoryBarnStore(), () => DAY);
    await svc.claim('lo', 'quick:lo', loss);
    for (const id of ['hi', 'tie1', 'tie2']) await svc.claim(id, `quick:${id}`, win);
    await svc.claim('hi', 'quick:hi2', win);
    expect(await svc.rank('hi')).toMatchObject({ place: 1, players: 4, top: 25 });
    expect(await svc.rank('tie1')).toMatchObject({ place: 2, players: 4, top: 50 });
    expect(await svc.rank('tie2')).toMatchObject({ place: 2, players: 4, top: 50 });
    expect(await svc.rank('lo')).toMatchObject({ place: 4, players: 4, top: 100 });
  });

  it('never says top 0%', async () => {
    const svc = new BarnService(new MemoryBarnStore(), () => DAY);
    for (let i = 0; i < 300; i++) await svc.claim(`p${i}`, `quick:p${i}`, loss);
    await svc.claim('best', 'quick:best', win);
    expect(await svc.rank('best')).toMatchObject({ place: 1, players: 301, top: 1 });
  });
});

describe('the profile board: the top 100 by XP, and where you stand', () => {
  const named = async (id: string) => (id.startsWith('hidden') ? null : `Name of ${id}`);

  it('lists players most XP first, by name, with no account ids, and marks the asker', async () => {
    const svc = new BarnService(new MemoryBarnStore(), () => DAY, named);
    await svc.claim('lo', 'quick:lo', loss);
    await svc.claim('hi', 'quick:hi', win);
    await svc.claim('hi', 'quick:hi2', win);
    const b = await svc.board('lo');
    expect(b.top.map((r) => r.name)).toEqual(['Name of hi', 'Name of lo']);
    expect(b.top.map((r) => r.place)).toEqual([1, 2]);
    expect(b.top.map((r) => r.you)).toEqual([false, true]);
    expect(JSON.stringify(b)).not.toMatch(/"userId"|"hi"|"lo"/);
    expect(b.you).toMatchObject({ place: 2 });
    expect(b.players).toBe(2);
  });

  it('leaves out players who must not be listed, and gives nobody a place before they have XP', async () => {
    const svc = new BarnService(new MemoryBarnStore(), () => DAY, named);
    await svc.claim('hidden1', 'quick:h', win);
    await svc.claim('a', 'quick:a', loss);
    const b = await svc.board('new');
    expect(b.top.map((r) => r.name)).toEqual(['Name of a']);
    expect(b.you).toBeNull();
  });

  it('shows 100 at most, and a player below them gets a place past the list', async () => {
    const svc = new BarnService(new MemoryBarnStore(), () => DAY, named);
    for (let i = 0; i < 130; i++) { await svc.claim(`p${i}`, `quick:p${i}`, win); await svc.claim(`p${i}`, `quick:p${i}b`, win); }
    await svc.claim('me', 'quick:me', loss);
    const b = await svc.board('me');
    expect(b.top).toHaveLength(BOARD_TOP);
    expect(b.top.some((r) => r.you)).toBe(false);
    expect(b.you!.place).toBe(131);
    expect(b.players).toBe(131);
  });

  it('is read once a minute at most, however many profiles open', async () => {
    let t = DAY;
    const store = new MemoryBarnStore();
    let reads = 0;
    const top = store.top.bind(store);
    store.top = async (n) => { reads++; return top(n); };
    const svc = new BarnService(store, () => t, named);
    await svc.claim('a', 'quick:a', win);
    for (let i = 0; i < 5; i++) await svc.board('a');
    expect(reads).toBe(1);
    t += 61_000;
    await svc.board('a');
    expect(reads).toBe(2);
  });
});

describe('what the server takes on a browser\'s word', () => {
  it('a Counting Sheep streak rises one night for each day gone by, whatever is claimed', async () => {
    let t = DAY;
    const svc = new BarnService(new MemoryBarnStore(), () => t);
    const first = await svc.streak('u', 3660);
    expect(first.wallet.bestStreak).toBe(1);
    expect(first.bells).toBe(0);
    expect((await svc.streak('u', 3660)).wallet.bestStreak).toBe(1); // the same day: no more
    t += 86_400_000;
    expect((await svc.streak('u', 3660)).wallet.bestStreak).toBe(2);
    t += 5 * 86_400_000; // five days on: a real streak could be 7 by now
    const week = await svc.streak('u', 3660);
    expect(week.wallet.bestStreak).toBe(7);
    expect(week.granted).toEqual(['bomb-aurora']);
    expect(week.bells).toBe(20);
  });

  it('an honest streak is never held back: it is reported a night at a time', async () => {
    let t = DAY;
    const svc = new BarnService(new MemoryBarnStore(), () => t);
    for (let night = 1; night <= 30; night++) { expect((await svc.streak('u', night)).wallet.bestStreak).toBe(night); t += 86_400_000; }
    expect((await svc.wallet('u')).wallet.owned).toEqual(expect.arrayContaining(['bomb-aurora', 'blast-starlight']));
  });

  it('a browser\'s wallet comes into an account under the caps: no made-up streak, Bells, legendaries or pity', async () => {
    const svc = new BarnService(new MemoryBarnStore(), () => DAY);
    const everything = ['bomb-gold', 'blast-northern', 'tick-owl', 'bomb-diamond', 'blast-solstice', 'tick-musicbox', 'bomb-brass', 'blast-lantern', 'bomb-aurora', 'blast-starlight', 'tick-lullaby', 'bomb-ember', 'bomb-plum'];
    const local = { ...freshWallet(), owned: [...freshWallet().owned, ...everything], bells: 9999, bestStreak: 3660, bellStreak: 0, pity: { bomb: { sinceRare: 9, sinceLegendary: 39 }, blast: { sinceRare: 9, sinceLegendary: 39 }, tick: { sinceRare: 9, sinceLegendary: 39 } } };
    const { wallet: w } = await svc.importLocal('u', local);
    const has = (ids: string[]) => ids.filter((id) => w.owned.includes(id)).length;
    expect(has(['bomb-gold', 'blast-northern', 'tick-owl'])).toBe(IMPORT_RARE_CAP);
    expect(has(['bomb-diamond', 'blast-solstice', 'tick-musicbox'])).toBe(IMPORT_LEGENDARY_CAP);
    expect(has(['bomb-ember', 'bomb-plum'])).toBe(2); // commons and uncommons come in whole
    expect(w.bestStreak).toBe(IMPORT_STREAK_CAP);
    expect(has(['bomb-aurora'])).toBe(1); // a week's streak has earned it
    expect(has(['blast-starlight', 'tick-lullaby'])).toBe(0);
    // Bell Shelf items count against the Bell cap with the Bells themselves (30 + 40 here).
    expect(has(['bomb-brass', 'blast-lantern'])).toBe(2);
    expect(w.bells).toBe(IMPORT_BELL_CAP - 70);
    expect(w.pity).toEqual(freshWallet().pity);
    // And the streak it brought cannot be claimed past again today.
    expect((await svc.streak('u', 3660)).wallet.bestStreak).toBe(IMPORT_STREAK_CAP);
  });
});

