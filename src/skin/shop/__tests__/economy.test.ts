import { describe, expect, it } from 'vitest';
import { BLAST_PALETTE, BOMB_TINT, CATALOG, DEFAULTS, TICK_VOICE } from '../catalog';
import { DAILY_CAP, MISSIONS, equip, freshWallet, grantStreakItems, levelOf, mergeWallets, normalise, openSack, payGame, rewardLines, titleFor, xpForLevel } from '../economy';

const DAY = '2026-11-11';

describe('the catalogue', () => {
  it('is cosmetic, every sack item has a rarity, every mission item a mission, and every item has its look defined', () => {
    for (const i of CATALOG) {
      if (i.source === 'sack') expect(i.rarity, i.id).toBeTruthy();
      if (i.source === 'mission') expect(MISSIONS.some((m) => m.id === i.mission && m.itemId === i.id), i.id).toBe(true);
      if (i.kind === 'bomb') expect(BOMB_TINT[i.id], i.id).toBeTruthy();
      if (i.kind === 'blast') expect(BLAST_PALETTE[i.id], i.id).toBeTruthy();
      if (i.kind === 'tick') expect(TICK_VOICE[i.id], i.id).toBeTruthy();
    }
    expect(new Set(CATALOG.map((i) => i.id)).size).toBe(CATALOG.length);
  });
  it('a fresh wallet owns and wears the free items', () => {
    const w = freshWallet();
    expect(w.coins).toBe(0);
    for (const id of Object.values(DEFAULTS)) expect(w.owned).toContain(id);
  });
});

describe('earning', () => {
  it('pays a won quick game with long words, once', () => {
    const p = payGame(freshWallet(), 'g1', { mode: 'quick', won: true, words: ['cat', 'tomorrow', 'elephant'] }, DAY);
    expect(p.coins).toBe(20 + 30 + 4);
    expect(p.wallet.coins).toBe(54);
    const again = payGame(p.wallet, 'g1', { mode: 'quick', won: true, words: [] }, DAY);
    expect(again.lines).toEqual([]);
    expect(again.wallet.coins).toBe(54);
  });
  it('a lost game still pays for finishing; practice and dreams pay too', () => {
    expect(rewardLines({ mode: 'quick', won: false, words: [] })).toEqual([{ label: 'Finished the game', coins: 20 }]);
    expect(rewardLines({ mode: 'practice', score: 9, words: [] })[0].coins).toBe(9);
    expect(rewardLines({ mode: 'practice', score: 80, words: [] })[0].coins).toBe(30);
    expect(rewardLines({ mode: 'practice', score: 0, words: [] })).toEqual([]);
    expect(rewardLines({ mode: 'dream', sheep: 12, slept: true }).reduce((n, l) => n + l.coins, 0)).toBe(32);
  });
  it('stops at the daily cap, but XP keeps counting and the next day starts fresh', () => {
    let w = freshWallet();
    for (let i = 0; i < 10; i++) w = payGame(w, `g${i}`, { mode: 'quick', won: true, words: [] }, DAY).wallet;
    expect(w.earnedToday).toBe(DAILY_CAP);
    const capped = payGame(w, 'gx', { mode: 'quick', won: true, words: [] }, DAY);
    expect(capped.capped).toBe(true);
    expect(capped.xp).toBe(50);
    const tomorrow = payGame(capped.wallet, 'gy', { mode: 'quick', won: false, words: [] }, '2026-11-12');
    expect(tomorrow.capped).toBe(false);
    expect(tomorrow.wallet.earnedToday).toBe(20);
  });
});

describe('levels and achievements', () => {
  it('levels climb 100 XP more each time and carry titles', () => {
    expect(xpForLevel(2)).toBe(100);
    expect(xpForLevel(3)).toBe(300);
    expect(levelOf(0).level).toBe(1);
    expect(levelOf(299).level).toBe(2);
    expect(levelOf(300).level).toBe(3);
    expect(titleFor(1)).toBe('Lamb');
    expect(titleFor(4)).toBe('Word Wrangler');
  });
  it('a level-up and a word milestone pay their bonuses', () => {
    const words = Array.from({ length: 50 }, (_, i) => `word${i}`);
    const w = { ...freshWallet(), xp: 90 };
    const p = payGame(w, 'g1', { mode: 'quick', won: false, words }, DAY);
    expect(p.levelUp).toMatchObject({ from: 1, to: 2 });
    expect(p.achievements).toContain('50 different words');
    expect(p.wallet.words).toHaveLength(50);
  });
  it('counts each word once', () => {
    const p = payGame(freshWallet(), 'g1', { mode: 'quick', won: false, words: ['Cat', 'cat', 'dog'] }, DAY);
    expect(p.wallet.words).toEqual(['cat', 'dog']);
  });
});

describe('the Trading Post (Feed Sacks only since 2026-11-12: nothing is sold on its own)', () => {
  it('a sack takes its price in coins, and refuses without enough', () => {
    const r = openSack({ ...freshWallet(), coins: 1000 }, 'bomb', () => 0, 1);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.wallet.coins).toBe(1000 - 250 + r.entry.refund);
    expect(openSack(freshWallet(), 'bomb', () => 0, 1)).toEqual({ ok: false, reason: 'short' });
  });
  it('equips only what is owned', () => {
    expect(equip(freshWallet(), 'bomb-gold').equipped.bomb).toBe('bomb-ice');
    const r = openSack({ ...freshWallet(), coins: 1000 }, 'blast', () => 0, 1);
    if (!r.ok) throw new Error('open failed');
    expect(equip(r.wallet, r.entry.itemId).equipped.blast).toBe(r.entry.itemId);
  });
  it('streak items are given at their streak and kept', () => {
    const a = grantStreakItems(freshWallet(), 7);
    expect(a.granted).toEqual(['bomb-aurora']);
    expect(grantStreakItems(a.wallet, 3).wallet.owned).toContain('bomb-aurora');
  });
});

describe('storage', () => {
  it('a damaged wallet is repaired, and wearing something not owned falls back', () => {
    const w = normalise({ coins: -5, owned: ['bomb-gold', 'made-up'], equipped: { bomb: 'bomb-plum' }, words: 'x' });
    expect(w.coins).toBe(0);
    expect(w.owned).toContain('bomb-gold');
    expect(w.owned).not.toContain('made-up');
    expect(w.equipped.bomb).toBe('bomb-ice');
    expect(w.words).toEqual([]);
  });
  it('merging keeps the larger counts and everything owned', () => {
    const a = { ...freshWallet(), coins: 100, owned: [...freshWallet().owned, 'bomb-ember'] };
    const b = { ...freshWallet(), coins: 300, xp: 50, words: ['cat'] };
    const m = mergeWallets(a, b);
    expect(m.coins).toBe(300);
    expect(m.xp).toBe(50);
    expect(m.owned).toContain('bomb-ember');
    expect(m.words).toEqual(['cat']);
  });
});
