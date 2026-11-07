import { describe, expect, it } from 'vitest';
import { BOT_PROFILES } from '../bots';
import { BOT_PRESSURE_FAIL, SOFT_GAME_PRESSURE } from '../constants';
import { createGame } from '../game';
import { botFailRate } from '../reducer';
import { dict, T0 } from './helpers';

const game = (softGame?: boolean) =>
  createGame({ seed: 'soft', now: T0, humanName: 'Me', playerCount: 6, difficulty: 'easy', settings: softGame === undefined ? undefined : { softGame } }, dict);

describe('a soft game', () => {
  it('raises the bots\' chance of fumbling by a share of BOT_PRESSURE_FAIL', () => {
    expect(botFailRate(game(true), 'easy')).toBeCloseTo(BOT_PROFILES.easy.failRate + BOT_PRESSURE_FAIL * SOFT_GAME_PRESSURE);
  });
  it('changes nothing in any other game', () => {
    expect(botFailRate(game(), 'easy')).toBe(BOT_PROFILES.easy.failRate);
    expect(botFailRate(game(false), 'easy')).toBe(BOT_PROFILES.easy.failRate);
  });
  it('never takes a bot past the most it can fumble', () => {
    const s = game(true);
    s.round = 40;
    expect(botFailRate(s, 'easy')).toBeLessThanOrEqual(0.85);
  });
});

describe('the bots', () => {
  it('are the farm\'s own sheep', () => {
    const names = game().players.slice(1).map((p) => p.name);
    expect(new Set(names).size).toBe(names.length);
    const flock = ['Maple', 'Clover', 'Bram', 'Hazel', 'Barley', 'Thistle', 'Nettle', 'Sorrel', 'Tansy'];
    for (const n of names) expect(flock).toContain(n);
  });
});
