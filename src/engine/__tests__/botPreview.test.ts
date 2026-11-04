import { describe, expect, it } from 'vitest';
import { createGame } from '../game';
import { advance, previewBotTurn } from '../reducer';
import type { GameState } from '../types';
import { ctx, dict, T0 } from './helpers';

/** A game of bots only (seat 0 handed to a bot), with no bot steals, so nothing draws before the bot on turn acts. */
function botGame(seed: string): GameState {
  const s = createGame({ seed, now: T0, humanName: 'h', playerCount: 4, difficulty: 'medium' }, dict);
  s.players[0].isHuman = false;
  s.players[0].difficulty = 'medium';
  s.players[0].personality = 'random';
  s.players[0].bankThreshold = 30;
  return s;
}

describe('previewBotTurn', () => {
  it('is null on a human turn and leaves the game untouched', () => {
    let s = createGame({ seed: 'p', now: T0, humanName: 'Me', playerCount: 4, difficulty: 'medium' }, dict);
    s = advance(s, ctx, T0 + 2500);
    expect(s.turn!.seat).toBe(0);
    expect(previewBotTurn(s, ctx)).toBeNull();
    const bot = structuredClone(s);
    bot.players[0].isHuman = false;
    bot.players[0].difficulty = 'medium';
    bot.turn!.botActAt = bot.turn!.startedAt + 1000;
    const before = structuredClone(bot);
    previewBotTurn(bot, ctx);
    expect(bot).toEqual(before);
  });

  it('matches what the bot then does, turn after turn', () => {
    let checked = 0;
    for (const seed of ['a', 'b', 'c', 'd']) {
      let s = advance(botGame(seed), ctx, T0 + 2500);
      for (let step = 0; step < 60 && s.phase !== 'gameOver'; step++) {
        if (s.phase !== 'playing' || !s.turn) { s = advance(s, ctx, (s.introEndsAt ?? s.events.at(-1)!.at) + 1); continue; }
        s = structuredClone(s);
        s.turn!.stealPlans = [];
        const plan = previewBotTurn(s, ctx)!;
        const late = s.turn!.botActAt! >= s.turn!.endsAt; // the clock runs out before this bot answers
        const seat = s.turn!.seat;
        const lastId = s.events.at(-1)?.id ?? -1;
        s = advance(s, ctx, s.turn!.botActAt!);
        const e = s.events.find((ev) => ev.id > lastId && ev.seat === seat)!;
        if (late) { expect(e.kind).toBe('timeout'); continue; }
        if (plan.kind === 'play') { expect(e.kind, JSON.stringify({ seed, step, plan, e })).toBe('play'); expect(e.word).toBe(plan.word); }
        if (plan.kind === 'bank') expect(e.kind).toBe('bank');
        if (plan.kind === 'fail') expect(['timeout', 'fumble', 'fail']).toContain(e.kind);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(20);
  });
});
