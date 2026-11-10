import { describe, expect, it } from 'vitest';
import type { GameResult } from '../contracts';
import { MemoryAccountStore } from '../auth/store';
import type { Profile } from '../auth/store';
import { EconomyService } from '../economy/service';
import { MemoryEconomyStore } from '../economy/store';
import { MemoryResultsStore } from './results';
import { GameDataService } from './service';

const NOW = Date.UTC(2026, 10, 4, 15, 0, 0);
const profile = (id: string, over: Partial<Profile> = {}): Profile => ({
  userId: id, nickname: id.toUpperCase(), emailHash: 'h', dateOfBirth: '1990-01-01', country: 'CA', consentStatus: 'not_required', leaderboardVisible: true,
  isModerator: false, sessionsValidAfter: 0, createdAt: 1, updatedAt: 1, deletedAt: null, ...over,
});
const result = (id: string, userIds: (string | null)[], winner: string, mode: 'room' | 'daily' = 'room'): GameResult => ({
  gameId: id, mode, roomCode: 'R', dailyDate: mode === 'daily' ? '2026-11-04' : null, finishedAt: NOW - 1000, winners: [winner],
  players: userIds.map((u, i) => ({ userId: u, name: u ? `Name${u}` : 'Bot', seat: i, banked: 50 - i * 10, wordsPlayed: 3, longestWord: 'cat' })),
});

async function setup(profiles: Profile[] = [], banned: string[] = []) {
  const accounts = new MemoryAccountStore();
  for (const p of profiles) await accounts.createProfile(p);
  const economyStore = new MemoryEconomyStore();
  const economy = new EconomyService(economyStore, () => NOW);
  const results = new MemoryResultsStore();
  const awards: [string, number][] = [];
  const svc = new GameDataService({ results, accounts, economy, isBanned: (id) => banned.includes(id), now: () => NOW, onAward: (u, r) => awards.push([u, r.coins]) });
  return { svc, accounts, economy, economyStore, results, awards };
}

describe('recording a finished game', () => {
  it('stores it, pays the players who may be paid, and tells them', async () => {
    const { svc, economyStore, awards, results } = await setup([profile('a'), profile('b')]);
    await svc.record(result('g1', ['a', 'b', null], 'a'));
    expect(results.games.size).toBe(1);
    expect(awards).toEqual([['a', 10 + 25], ['b', 10]]);
    expect(await economyStore.balance('a')).toBe(35);
  });

  it('recording the same game twice stores it once and pays once', async () => {
    const { svc, economyStore, awards } = await setup([profile('a')]);
    await svc.record(result('g1', ['a', null], 'a'));
    await svc.record(result('g1', ['a', null], 'a'));
    expect(awards).toHaveLength(1);
    expect(await economyStore.balance('a')).toBe(35);
  });

  it('a child without a parent\'s consent is stored as anonymous and earns nothing; the game is still complete', async () => {
    const { svc, economyStore, results } = await setup([profile('a'), profile('kid', { consentStatus: 'pending', leaderboardVisible: false })]);
    await svc.record(result('g1', ['a', 'kid'], 'a'));
    const stored = [...results.games.values()][0];
    expect(stored.players.map((p) => p.userId)).toEqual(['a', null]);
    expect(JSON.stringify(stored)).not.toContain('Namekid');
    expect(await economyStore.balance('kid')).toBe(0);
    expect((await svc.myStats('kid')).gamesPlayed).toBe(0);
  });

  it('a player with no profile (or a deleted one) is not stored under their id', async () => {
    const { svc, results } = await setup([profile('a'), profile('gone', { deletedAt: 5 })]);
    await svc.record(result('g1', ['a', 'gone', 'stranger'], 'a'));
    expect([...results.games.values()][0].players.map((p) => p.userId)).toEqual(['a', null, null]);
  });

  it('the Daily Table pays the daily amounts', async () => {
    const { svc, awards } = await setup([profile('a')]);
    await svc.record(result('d1', ['a'], 'a', 'daily'));
    expect(awards).toEqual([['a', 15 + 10]]);
  });
});

describe('leaderboards', () => {
  it('show current nicknames, rank in order, and leave out hidden, banned, deleted and child accounts', async () => {
    const { svc, accounts } = await setup([
      profile('a', { nickname: 'Ana' }), profile('b', { nickname: 'Ben' }), profile('c', { nickname: 'Cy', leaderboardVisible: false }),
      profile('d', { nickname: 'Di' }), profile('e', { nickname: 'Ed' }),
    ], ['d']);
    await svc.record(result('g1', ['a', 'b', 'c', 'd', 'e'], 'c'));
    await svc.record(result('g2', ['a', 'b', 'c', 'd', 'e'], 'a'));
    await svc.record(result('g3', ['a', 'b', 'c', 'd', 'e'], 'a'));
    await accounts.updateProfile('e', { deletedAt: 9 });
    await accounts.updateProfile('a', { nickname: 'AnaRenamed' });
    const board = (await svc.leaderboard('all', 'wins'))!;
    expect(board.rows.map((r) => [r.rank, r.name, r.value])).toEqual([[1, 'AnaRenamed', 2]]); // b has no wins; c hidden; d banned; e deleted
    const points = (await svc.leaderboard('all', 'points'))!;
    expect(points.rows.map((r) => r.name)).toEqual(['AnaRenamed', 'Ben']);
    expect(points.rows.map((r) => r.rank)).toEqual([1, 2]);
  });

  it('refuses a made-up period or metric', async () => {
    const { svc } = await setup();
    expect(await svc.leaderboard('century', 'wins')).toBeNull();
    expect(await svc.leaderboard('all', 'drop table')).toBeNull();
  });

  it('the Daily Table board lists only visible players\' scores for that date', async () => {
    const { svc } = await setup([profile('a', { nickname: 'Ana' }), profile('b', { nickname: 'Ben', leaderboardVisible: false })]);
    await svc.record(result('d1', ['a'], 'a', 'daily'));
    await svc.record(result('d2', ['b'], 'b', 'daily'));
    const board = await svc.dailyBoard('2026-11-04');
    expect(board.rows.map((r) => [r.rank, r.name, r.banked])).toEqual([[1, 'Ana', 50]]);
    expect((await svc.dailyBoard('2026-11-05')).rows).toEqual([]);
  });

  it('shows what a player wears beside their name', async () => {
    const { svc, economy, economyStore } = await setup([profile('a')]);
    await svc.record(result('g1', ['a'], 'a'));
    await economyStore.apply({ userId: 'a', delta: 500, reason: 'adjustment', ref: 'gift', at: 1 });
    await economy.buy('a', 'badge-fire');
    await economy.equip('a', 'badge', 'badge-fire');
    expect((await svc.leaderboard('all', 'wins'))!.rows[0].cosmetics).toEqual({ badge: '🔥' });
  });
});

describe('the Daily Table gate and account deletion', () => {
  it('lets a player start the Daily Table once a day', async () => {
    const { svc } = await setup();
    expect([await svc.claimDaily('a', '2026-11-04'), await svc.claimDaily('a', '2026-11-04'), await svc.claimDaily('a', '2026-11-05')]).toEqual([true, false, true]);
  });
  it('erasing takes the person out of the games and clears their coins and items, but keeps the games', async () => {
    const { svc, economyStore, results } = await setup([profile('a'), profile('b')]);
    await svc.record(result('g1', ['a', 'b'], 'a'));
    await svc.erase('a');
    expect(results.games.size).toBe(1);
    expect((await svc.myStats('a')).gamesPlayed).toBe(0);
    expect((await svc.myStats('b')).gamesPlayed).toBe(1);
    expect(await economyStore.balance('a')).toBe(0);
    expect(await economyStore.balance('b')).toBe(10);
  });
});
