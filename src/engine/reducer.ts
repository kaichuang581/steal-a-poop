import { BOT_PROFILES, PERSONALITIES, bankThresholdFor, pickBotWord } from './bots';
import {
  BASE_TURN_MS,
  FAIL_PENALTY, INTRO_MS, PRACTICE_TURN_MS, STEAL_BONUS,
  TRAP_LETTERS, TRAP_PAYOUT,
} from './constants';
import type { Dictionary } from './dictionary';
import { drawInt, drawPick, drawRandom } from './rng';
import { scoreWord } from './scoring';
import { computeWinners } from './standings';
import { roundTurnMs, turnDurationMs } from './timer';
import type { Action, ActionResult, Difficulty, EventKind, GameState, Round } from './types';
import { halveScore } from './penalties';
import { suggestCorrection } from './typos';
import { hasPlayableWord, validateWord } from './validation';

export interface EngineContext {
  dict: Dictionary;
}

const MAX_EVENTS = 40;
/**
 * The next seat after `seat` that can still take a turn this round: not frozen and under the round's turn count.
 * Null when nobody can.
 */
function nextSeat(s: GameState, seat: number): number | null {
  const n = s.players.length;
  for (let i = 1; i <= n; i++) {
    const p = s.players[(seat + i) % n];
    if (!p.frozen && p.turnsTaken < s.settings.turnsPerRound) return p.id;
  }
  return null;
}

function emit(s: GameState, at: number, kind: EventKind, seat: number | null, text: string, amount = 0, word?: string) {
  s.eventSeq += 1;
  s.events.push({ id: s.eventSeq, at, kind, seat, text, amount, ...(word ? { word } : {}) });
  if (s.events.length > MAX_EVENTS) s.events.splice(0, s.events.length - MAX_EVENTS);
}

/**
 * How long a bot takes to answer. Response times are tuned for a 10 s turn, so they scale with the round's turn
 * length: a bot answers at the same point of a 16 s first-round turn as of a 5 s last-round one.
 */
function botResponseMs(s: GameState, difficulty: Difficulty): number {
  const scale = roundTurnMs(s.round, s.settings.rounds) / BASE_TURN_MS;
  const [lo, hi] = BOT_PROFILES[difficulty].responseMs;
  return drawInt(s, Math.round(lo * scale), Math.round(hi * scale));
}

function startTurn(s: GameState, seat: number, t: number) {
  const active = s.players[seat];
  const learning = s.mode !== 'normal';
  const tour = s.mode === 'tour';
  const baseMs = turnDurationMs(s.pile, s.modifier, roundTurnMs(s.round, s.settings.rounds));
  const durationMs = learning && active.isHuman ? PRACTICE_TURN_MS : baseMs;
  const endsAt = t + durationMs;
  let botActAt: number | null = null;
  if (!active.isHuman) {
    if (tour) {
      // Bots answer quickly, except the last seat once the human has banked: that slow turn
      // runs into its steal window so the tutorial can show a steal.
      const slow = seat === s.players.length - 1 && s.history.some((h) => h.kind === 'bank' && h.seat === 0);
      botActAt = slow ? t + Math.max(1000, durationMs - 1500) : t + drawInt(s, 1200, 2200);
    } else {
      botActAt = t + botResponseMs(s, active.difficulty!);
    }
  }
  const stealPlans: { seat: number; at: number }[] = [];
  const windowMs = s.settings.stealWindowSeconds * 1000;
  for (const p of s.players) {
    if (tour || p.id === seat || p.isHuman || p.frozen || windowMs <= 0) continue;
    if (drawRandom(s) < BOT_PROFILES[p.difficulty!].stealChance) {
      stealPlans.push({ seat: p.id, at: endsAt - windowMs + drawRandom(s) * (windowMs - 500) });
    }
  }
  s.turn = { seat, startedAt: t, endsAt, durationMs, botActAt, stealPlans };
}

function concludeTurn(s: GameState, t: number) {
  const turn = s.turn!;
  s.players[turn.seat].turnsTaken += 1;
  s.turn = null;
  // Frozen players are skipped, so the round ends once every unfrozen player has used their turns.
  const next = nextSeat(s, turn.seat);
  if (next === null) return endRound(s, t);
  startTurn(s, next, t);
}

function endRound(s: GameState, t: number) {
  if (s.pile > 0) emit(s, t, 'burn', null, 'Pile burned', s.pile);
  s.pile = 0;
  s.trap = null;
  if (s.round === s.settings.rounds) {
    s.phase = 'gameOver';
    s.winners = computeWinners(s.players);
    emit(s, t, 'gameOver', null, 'Game over');
    return;
  }
  s.round = (s.round + 1) as Round;
  s.modifier = s.modifierDeck[s.round - 1];
  s.used = [];
  s.history = [];
  for (const p of s.players) {
    p.turnsTaken = 0;
  }
  s.phase = 'intro';
  s.introEndsAt = t + INTRO_MS;
  emit(s, t, 'roundStart', null, `Round ${s.round}`);
}

/** Clears a trap aimed at `seat`. Pays the trapper only if that seat failed. */
function resolveTrap(s: GameState, seat: number, failed: boolean, t: number) {
  const trap = s.trap;
  if (!trap || trap.victimSeat !== seat) return;
  s.trap = null;
  if (!failed) return;
  s.players[trap.trapperSeat].banked += TRAP_PAYOUT;
  emit(s, t, 'trapSprung', seat, `TRAP! ${s.players[seat].name} failed`, TRAP_PAYOUT);
}

/**
 * A word ending in X/Z/Q/J traps whoever owns the next turn. Nobody can trap themselves: when the next turn is the
 * trapper's own (they are the last unfrozen player, or they stole from the player just before them) no trap is set.
 */
function setTrap(s: GameState, word: string, trapperSeat: number, turnSeat: number) {
  const letter = word[word.length - 1];
  const victimSeat = nextSeat(s, turnSeat);
  s.trap = TRAP_LETTERS.has(letter) && victimSeat !== null && victimSeat !== trapperSeat ? { trapperSeat, victimSeat, letter } : null;
}

function recordWord(s: GameState, seat: number, word: string, points: number) {
  const p = s.players[seat];
  p.lastWord = word;
  p.wordsPlayed += 1;
  if (word.length > p.longestWord.length) p.longestWord = word;
  if (!p.bestWord || points > p.bestWord.points) p.bestWord = { word, points };
  s.used.push(word);
  s.chainLetter = word[word.length - 1];
}

function playTurn(s: GameState, seat: number, word: string, t: number) {
  const points = scoreWord(word, s.modifier);
  s.pile += points;
  recordWord(s, seat, word, points);
  s.history.push({ round: s.round, seat, kind: 'play', word, points });
  emit(s, t, 'play', seat, `${s.players[seat].name}: ${word.toUpperCase()} +${points}`, points, word);
  resolveTrap(s, seat, false, t);
  setTrap(s, word, seat, seat);
  concludeTurn(s, t);
}

function bankTurn(s: GameState, t: number) {
  const seat = s.turn!.seat;
  const amount = s.pile;
  s.players[seat].banked += amount;
  s.pile = 0;
  s.history.push({ round: s.round, seat, kind: 'bank', word: null, points: amount });
  emit(s, t, 'bank', seat, `${s.players[seat].name} banked ${amount}`, amount);
  resolveTrap(s, seat, false, t);
  concludeTurn(s, t);
}

/** Only a turn with no word submitted ends this way. A bad word never costs a turn. */
function failTurn(s: GameState, seat: number, t: number) {
  const p = s.players[seat];
  const penalty = s.mode === 'normal' ? FAIL_PENALTY : 0;
  p.banked -= penalty;
  s.history.push({ round: s.round, seat, kind: 'timeout', word: null, points: penalty ? -penalty : 0 });
  emit(s, t, 'timeout', seat, `Timeout ${p.name}${penalty ? ` -${penalty}` : ' (no penalty)'}`, penalty ? -penalty : 0);
  resolveTrap(s, seat, true, t);
  // Only a turn that runs out costs a life, and only in normal games; unlimited lives never run out.
  if (s.mode === 'normal' && s.settings.lives !== 'unlimited') {
    if (p.lives > 0) {
      p.lives -= 1;
      emit(s, t, 'lifeLost', seat, `${p.name} lost a life`, p.lives);
    }
    // The cold only gets in once the flames are out and there is no wool (banked score) left to keep it out.
    if (p.lives === 0 && p.banked <= 0 && !p.frozen) {
      p.frozen = true;
      emit(s, t, 'frozen', seat, `${p.name} is frozen`);
    }
  }
  concludeTurn(s, t);
}

/** A failed steal halves the stealer's whole banked score (normal games only). */
function stealFailed(s: GameState, seat: number, t: number) {
  const p = s.players[seat];
  const before = p.banked;
  const after = s.mode === 'normal' ? halveScore(before) : before;
  p.banked = after;
  const delta = after - before;
  s.history.push({ round: s.round, seat, kind: 'stealFail', word: null, points: delta });
  emit(s, t, 'stealFail', seat, delta ? `${p.name}'s steal failed: ${before} → ${after}` : `${p.name}'s steal failed`, delta);
}

function stealSucceeded(s: GameState, stealerSeat: number, word: string, t: number) {
  const turn = s.turn!;
  const stealer = s.players[stealerSeat];
  const points = scoreWord(word, s.modifier);
  const gain = s.pile + points + STEAL_BONUS;
  stealer.banked += gain;
  stealer.steals += 1;
  s.pile = 0;
  recordWord(s, stealerSeat, word, points);
  s.history.push({ round: s.round, seat: stealerSeat, kind: 'steal', word, points: gain });
  emit(s, t, 'steal', stealerSeat, `STOLEN by ${stealer.name}! +${gain}`, gain, word);
  resolveTrap(s, turn.seat, false, t);
  setTrap(s, word, stealerSeat, turn.seat);
  concludeTurn(s, t);
}

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz'.split('');

/**
 * A round can open on a letter nothing is legal for (letter E under "No E" is the classic case, and
 * the chain letter carries over between rounds). Pick another seeded letter so no round is dead.
 */
function ensurePlayable(s: GameState, ctx: EngineContext, at: number) {
  if (hasPlayableWord(ctx.dict, s.chainLetter, s.used, s.modifier)) return;
  const options = ALPHABET.filter((l) => hasPlayableWord(ctx.dict, l, s.used, s.modifier));
  if (!options.length) return;
  const common = options.filter((l) => ctx.dict.startingWith(l).length >= 300);
  const pool = common.length ? common : options;
  s.chainLetter = pool[Math.floor(drawRandom(s) * pool.length)];
  emit(s, at, 'chainReset', null, `No legal word starts here, so the chain letter is now ${s.chainLetter.toUpperCase()}`);
}

type Due = { at: number; kind: 'botAct' | 'timeout' } | { at: number; kind: 'botSteal'; index: number };

function nextDue(s: GameState, now: number): Due | null {
  const turn = s.turn!;
  const candidates: Due[] = [];
  if (turn.botActAt !== null) candidates.push({ at: turn.botActAt, kind: 'botAct' });
  turn.stealPlans.forEach((p, index) => candidates.push({ at: p.at, kind: 'botSteal', index }));
  candidates.push({ at: turn.endsAt, kind: 'timeout' });
  let best: Due | null = null;
  for (const c of candidates) if (c.at <= now && (!best || c.at < best.at)) best = c;
  return best;
}

/** What the bot on turn does: bank, fumble, or play a word. Draws from the game's random stream like any bot action. */
export type BotPlan = { kind: 'bank' } | { kind: 'fail' } | { kind: 'play'; word: string };

function decideBotTurn(s: GameState, ctx: EngineContext): BotPlan {
  const bot = s.players[s.turn!.seat];
  const profile = BOT_PROFILES[bot.difficulty!];
  const scripted = s.mode === 'tour'; // tutorial bots never bank or fumble
  if (!scripted && s.pile > 0 && s.pile >= bot.bankThreshold) return { kind: 'bank' };
  if (!scripted && drawRandom(s) < profile.failRate) return { kind: 'fail' };
  const word = pickBotWord({
    dict: ctx.dict, chainLetter: s.chainLetter, used: s.used, modifier: s.modifier,
    prefer: profile.prefer, random: () => drawRandom(s),
  });
  return word ? { kind: 'play', word } : { kind: 'fail' };
}

function runBotTurn(s: GameState, ctx: EngineContext, t: number) {
  const turn = s.turn!;
  turn.botActAt = null;
  const plan = decideBotTurn(s, ctx);
  if (plan.kind === 'bank') return bankTurn(s, t);
  if (plan.kind === 'fail') return failTurn(s, turn.seat, t);
  playTurn(s, turn.seat, plan.word, t);
}

/**
 * What the bot on turn is going to do, for display only (the table types its word out): the same decision the bot
 * makes when it acts, taken on a copy, so the game and its random stream are untouched. Null on a human's turn.
 * If something draws from the stream before the bot acts (a bot steal landing first), the real move can differ.
 */
export function previewBotTurn(state: GameState, ctx: EngineContext): BotPlan | null {
  const t = state.turn;
  if (state.phase !== 'playing' || !t || t.botActAt === null || state.players[t.seat].isHuman) return null;
  return decideBotTurn(structuredClone(state), ctx);
}

function runBotSteal(s: GameState, ctx: EngineContext, seat: number, t: number) {
  const bot = s.players[seat];
  const profile = BOT_PROFILES[bot.difficulty!];
  const word =
    drawRandom(s) < profile.failRate
      ? null
      : pickBotWord({
          dict: ctx.dict, chainLetter: s.chainLetter, used: s.used, modifier: s.modifier,
          prefer: profile.prefer, random: () => drawRandom(s),
        });
  if (!word) return stealFailed(s, seat, t);
  stealSucceeded(s, seat, word, t);
}

export function needsAdvance(s: GameState, now: number): boolean {
  if (s.phase === 'intro') return s.introEndsAt !== null && now >= s.introEndsAt;
  const t = s.turn;
  if (s.phase !== 'playing' || !t) return false;
  return t.endsAt <= now || (t.botActAt !== null && t.botActAt <= now) || t.stealPlans.some((p) => p.at <= now);
}

/**
 * Runs everything that became due by `now` (intro end, bot moves, bot steals,
 * timeouts) in timestamp order. Returns the same object if nothing was due.
 */
export function advance(state: GameState, ctx: EngineContext, now: number): GameState {
  if (!needsAdvance(state, now)) return state;
  const s = structuredClone(state);
  for (;;) {
    if (s.phase === 'intro') {
      if (s.introEndsAt === null || now < s.introEndsAt) break;
      const at = s.introEndsAt;
      s.introEndsAt = null;
      s.phase = 'playing';
      ensurePlayable(s, ctx, at);
      // The first player rotates each round; a frozen seat passes to the next unfrozen one.
      const n = s.players.length;
      const first = nextSeat(s, (((s.round - 1) % n) + n - 1) % n);
      if (first === null) endRound(s, at);
      else startTurn(s, first, at);
      continue;
    }
    if (s.phase !== 'playing' || !s.turn) break;
    const due = nextDue(s, now);
    if (!due) break;
    switch (due.kind) {
      case 'timeout':
        failTurn(s, s.turn.seat, due.at);
        break;
      case 'botAct':
        runBotTurn(s, ctx, due.at);
        break;
      case 'botSteal':
        runBotSteal(s, ctx, s.turn.stealPlans.splice(due.index, 1)[0].seat, due.at);
        break;
    }
  }
  return s;
}

/**
 * A human left mid-game: a bot takes the seat and keeps the score, so the round keeps its size.
 * If it is their turn the bot answers on its normal schedule.
 */
export function replaceWithBot(state: GameState, seat: number, difficulty: Difficulty, now: number): GameState {
  const player = state.players[seat];
  if (!player || !player.isHuman || state.phase === 'gameOver') return state;
  const s = structuredClone(state);
  const p = s.players[seat];
  const personality = drawPick(s, PERSONALITIES);
  p.isHuman = false;
  p.difficulty = difficulty;
  p.personality = personality;
  p.bankThreshold = bankThresholdFor(personality, drawRandom(s));
  emit(s, now, 'seatBot', seat, `${p.name} left. A bot took their seat`);
  if (s.turn && s.turn.seat === seat) {
    s.turn.botActAt = now + botResponseMs(s, difficulty);
  }
  return s;
}

export function inStealWindow(s: GameState, now: number): boolean {
  const t = s.turn;
  const windowMs = s.settings.stealWindowSeconds * 1000;
  return s.phase === 'playing' && !!t && windowMs > 0 && now >= t.endsAt - windowMs && now < t.endsAt;
}

/** Applies a human action at time `now`. Never mutates the input state. */
export function apply(state: GameState, ctx: EngineContext, action: Action, now: number): ActionResult {
  const s = structuredClone(advance(state, ctx, now));
  const reject = (reason: string): ActionResult => ({ state: s, accepted: false, reason });
  const turn = s.turn;
  if (s.phase !== 'playing' || !turn) return reject('not_playing');
  const player = s.players[action.seat];
  if (!player || !player.isHuman) return reject('no_such_player');
  const vctx = { dict: ctx.dict, chainLetter: s.chainLetter, used: s.used, modifier: s.modifier };
  const check = (word: string) => validateWord(word, vctx);
  // Only a word that is not in the dictionary or starts with the wrong letter can be a typo.
  const typoFix = (reason: string, word: string) =>
    reason === 'not_in_dictionary' || reason === 'wrong_start' ? suggestCorrection(word, vctx) : null;

  switch (action.type) {
    case 'play': {
      if (action.seat !== turn.seat) return reject('not_your_turn');
      const v = check(action.word);
      if (!v.ok) {
        // Never a penalty and the turn keeps running. A clear typo comes back with a suggested fix.
        const suggestion = typoFix(v.reason, action.word);
        return suggestion ? { ...reject(v.reason), suggestion } : reject(v.reason);
      }
      playTurn(s, turn.seat, v.word, now);
      return { state: s, accepted: true };
    }
    case 'bank':
      if (action.seat !== turn.seat) return reject('not_your_turn');
      bankTurn(s, now);
      return { state: s, accepted: true };
    case 'steal': {
      if (action.seat === turn.seat) return reject('own_turn');
      if (player.frozen) return reject('frozen');
      if (!inStealWindow(s, now)) return reject('outside_steal_window');
      const v = check(action.word);
      if (!v.ok) {
        // A clear typo gets a suggestion and no penalty. Anything else is a failed steal.
        const suggestion = typoFix(v.reason, action.word);
        if (suggestion) return { ...reject(v.reason), suggestion };
        if (s.mode !== 'normal') return reject(v.reason); // practice: try again
        stealFailed(s, action.seat, now);
        return { state: s, accepted: true, reason: v.reason };
      }
      stealSucceeded(s, action.seat, v.word, now);
      return { state: s, accepted: true };
    }
  }
}
