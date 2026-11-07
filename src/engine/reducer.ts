import { BOT_PROFILES, PERSONALITIES, bankThresholdFor, pickBotWord } from './bots';
import {
  BASE_TURN_MS, BOT_PRESSURE_FAIL, CARRY_OPENING_TURN_MS, EXTRA_WOOL_CAP, PASS_MIN_MS, FIRST_ROUND_TURN_MS, INTRO_MS, LAST_ROUND_TURN_MS, PRACTICE_TURN_MS,
  STEAL_COOLDOWN_MS, STEAL_LATE_SHARE, STEAL_TURN_BOT_BOOST, STEAL_TURN_CHANCE, TRAP_LETTERS, TURN_MS_BY_ROUND,
} from './constants';
import type { Dictionary } from './dictionary';
import { drawInt, drawPick, drawRandom } from './rng';
import { computeWinners } from './standings';
import { carriedTurnMs, roundTurnMs, turnDurationMs, wordShiftMs } from './timer';
import { startingWool } from './settings';
import type { Action, ActionResult, Difficulty, EventKind, GameState, Round } from './types';
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
function botResponseMs(s: GameState, difficulty: Difficulty, turnMs: number = roundTurnMs(s.round)): number {
  const scale = turnMs / BASE_TURN_MS;
  const [lo, hi] = BOT_PROFILES[difficulty].responseMs;
  return drawInt(s, Math.round(lo * scale), Math.round(hi * scale));
}

function startTurn(s: GameState, seat: number, t: number) {
  const active = s.players[seat];
  const learning = s.mode !== 'normal';
  const tour = s.mode === 'tour';
  const roundBaseMs = turnDurationMs(0, s.modifier, roundTurnMs(s.round));
  // Time carry (normal games only): the opening turn is 10 s, then the last word's shift is applied to this turn once.
  const carryOn = !learning && !!s.settings.timeCarry && s.settings.timeCarry !== 'off';
  const baseMs = !carryOn ? roundBaseMs : s.history.length === 0 ? CARRY_OPENING_TURN_MS : carriedTurnMs(roundBaseMs, s.carryMs ?? 0);
  s.carryMs = 0;
  // A passed bomb: this sheep gets the fuse that was left, once.
  const turnBaseMs = s.passMs ?? baseMs;
  delete s.passMs;
  const durationMs = learning && active.isHuman ? PRACTICE_TURN_MS : turnBaseMs;
  const endsAt = t + durationMs;
  const windowMs = s.settings.stealWindowSeconds * 1000;
  // Steals are an event: some turns are steal turns, drawn here. The tour's turns all are, so it can show one, and
  // practice (where stealing is learnt, at no cost) makes the game's first bot turn one, so it comes up early.
  const firstPracticeBotTurn = s.mode === 'practice' && s.round === 1 && !active.isHuman && s.players.every((p) => p.isHuman || p.turnsTaken === 0);
  const stealable = windowMs > 0 && (tour || firstPracticeBotTurn || drawRandom(s) < STEAL_TURN_CHANCE);
  let botActAt: number | null = null;
  if (!active.isHuman) {
    if (tour) {
      // Bots answer quickly, except the last seat once the human has played a word: that slow turn
      // runs into its steal window so the tutorial can show a steal.
      const slow = seat === s.players.length - 1 && s.history.some((h) => h.kind === 'play' && h.seat === 0);
      botActAt = slow ? t + Math.max(1000, durationMs - 1500) : t + drawInt(s, 1200, 2200);
    } else {
      botActAt = t + botResponseMs(s, active.difficulty!, turnBaseMs);
      // On a steal turn the bot always hesitates into the red seconds, so the window the alarm announced really
      // opens, and answers only in the window's last share: a person who reads the letter and types has the first go.
      if (stealable) botActAt = Math.max(botActAt, endsAt - windowMs * (0.05 + drawRandom(s) * (STEAL_LATE_SHARE - 0.05)));
      botActAt = Math.min(botActAt, endsAt - 50);
    }
  }
  // The other bots only plan steals on a steal turn, and then more eagerly than their usual urge.
  const stealPlans: { seat: number; at: number }[] = [];
  for (const p of s.players) {
    if (tour || !stealable || p.id === seat || p.isHuman || p.frozen) continue;
    if (drawRandom(s) < Math.min(0.9, BOT_PROFILES[p.difficulty!].stealChance * STEAL_TURN_BOT_BOOST)) {
      // Only in the window's last share, once a person has had their go.
      stealPlans.push({ seat: p.id, at: endsAt - windowMs * (0.05 + drawRandom(s) * (STEAL_LATE_SHARE - 0.05)) });
    }
  }
  s.turn = { seat, startedAt: t, endsAt, durationMs, botActAt, stealPlans, stealable };
  if (stealable && !tour) emit(s, t, 'stealTurn', seat, `Steal turn: ${active.name} can be robbed in the red seconds`);
}

function concludeTurn(s: GameState, t: number) {
  const turn = s.turn!;
  if (s.phase === 'gameOver') { s.turn = null; return; }
  s.players[turn.seat].turnsTaken += 1;
  s.turn = null;
  // Frozen players are skipped, so the round ends once every unfrozen player has used their turns.
  const next = nextSeat(s, turn.seat);
  if (next === null) return endRound(s, t);
  startTurn(s, next, t);
}

/** Most wool a sheep can hold: what it started with plus a little from steals and traps. */
function woolCap(s: GameState): number {
  return startingWool(s.settings) + EXTRA_WOOL_CAP;
}

/** Wool can't go below zero or above the cap; at zero the sheep freezes. Returns true if it froze. */
function loseWool(s: GameState, seat: number, t: number, why: string): boolean {
  const p = s.players[seat];
  if (p.frozen || p.lives <= 0) return false;
  p.lives -= 1;
  emit(s, t, 'lifeLost', seat, `${p.name} lost a wool ball${why ? ` (${why})` : ''}`, p.lives);
  if (p.lives > 0) return false;
  p.frozen = true;
  p.frozenAt = t;
  emit(s, t, 'frozen', seat, `${p.name} is frozen solid`);
  checkLastSheep(s, t);
  return true;
}

function gainWool(s: GameState, seat: number): void {
  const p = s.players[seat];
  p.lives = Math.min(woolCap(s), p.lives + 1);
}

/** The game ends the moment one sheep (or none) is left unfrozen: last sheep standing wins. */
function checkLastSheep(s: GameState, t: number) {
  if (s.phase === 'gameOver') return;
  const alive = s.players.filter((p) => !p.frozen);
  if (alive.length > 1) return;
  s.phase = 'gameOver';
  s.introEndsAt = null;
  s.winners = computeWinners(s.players);
  emit(s, t, 'gameOver', null, alive.length ? `${alive[0].name} is the last sheep standing` : 'Game over');
}

function endRound(s: GameState, t: number) {
  s.pile = 0;
  s.trap = null;
  if (s.phase === 'gameOver') return;
  s.round = (s.round + 1) as Round;
  s.modifier = s.modifierDeck[(s.round - 1) % s.modifierDeck.length];
  s.used = [];
  s.history = [];
  for (const p of s.players) {
    p.turnsTaken = 0;
  }
  s.phase = 'intro';
  s.introEndsAt = t + INTRO_MS;
  emit(s, t, 'roundStart', null, `Round ${s.round}`);
}

/** Clears a trap aimed at `seat`. If that seat failed, the trapper gets a wool ball. */
function resolveTrap(s: GameState, seat: number, failed: boolean, t: number) {
  const trap = s.trap;
  if (!trap || trap.victimSeat !== seat) return;
  s.trap = null;
  if (!failed || s.players[trap.trapperSeat].frozen) return;
  gainWool(s, trap.trapperSeat);
  emit(s, t, 'trapSprung', seat, `TRAP! ${s.players[seat].name} failed`, 1);
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
  if (s.settings.timeCarry === 'more') s.carryMs = wordShiftMs(word);
  else if (s.settings.timeCarry === 'less') s.carryMs = -wordShiftMs(word);
}

function playTurn(s: GameState, seat: number, word: string, t: number) {
  recordWord(s, seat, word, word.length);
  s.history.push({ round: s.round, seat, kind: 'play', word, points: 0 });
  emit(s, t, 'play', seat, `${s.players[seat].name}: ${word.toUpperCase()}`, 0, word);
  resolveTrap(s, seat, false, t);
  setTrap(s, word, seat, seat);
  concludeTurn(s, t);
}

/** Who loses wool when a turn runs out: everyone in a normal game; in practice only the bots (the human is learning). */
function woolAtStake(s: GameState, seat: number): boolean {
  if (s.mode === 'tour') return false;
  if (s.mode === 'practice') return !s.players[seat].isHuman;
  return true;
}

/** Only a turn with no word submitted ends this way. A bad word never costs a turn. Running out costs a wool ball. */
function failTurn(s: GameState, seat: number, t: number) {
  const p = s.players[seat];
  s.history.push({ round: s.round, seat, kind: 'timeout', word: null, points: 0 });
  s.carryMs = 0;
  emit(s, t, 'timeout', seat, `Time's up for ${p.name}`, 0);
  resolveTrap(s, seat, true, t);
  if (woolAtStake(s, seat)) loseWool(s, seat, t, '');
  concludeTurn(s, t);
}

/** A bad steal word: nothing lost, just a short wait before that sheep can try again. */
function stealFailed(s: GameState, seat: number, t: number) {
  const p = s.players[seat];
  p.stealCooldownUntil = t + STEAL_COOLDOWN_MS;
  s.history.push({ round: s.round, seat, kind: 'stealFail', word: null, points: 0 });
  emit(s, t, 'stealFail', seat, `${p.name}'s steal missed`, 0);
}

/** A steal: the stealer answered first in the red seconds, so they take one of the wool balls of the sheep on turn. */
function stealSucceeded(s: GameState, stealerSeat: number, word: string, t: number) {
  const turn = s.turn!;
  const stealer = s.players[stealerSeat];
  const victim = s.players[turn.seat];
  stealer.steals += 1;
  recordWord(s, stealerSeat, word, word.length);
  s.history.push({ round: s.round, seat: stealerSeat, kind: 'steal', word, points: 1, fromSeat: turn.seat });
  emit(s, t, 'steal', stealerSeat, `${stealer.name} stole a wool ball from ${victim.name}!`, 1, word);
  resolveTrap(s, turn.seat, false, t);
  if (woolAtStake(s, turn.seat)) {
    gainWool(s, stealerSeat);
    loseWool(s, turn.seat, t, 'stolen');
  }
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

/** What the bot on turn does: fumble, or play a word. Draws from the game's random stream like any bot action. */
export type BotPlan = { kind: 'bank' } | { kind: 'fail' } | { kind: 'play'; word: string };

/**
 * A bot's chance of fumbling: its base, plus more as turns get shorter (none at 16 s, BOT_PRESSURE_FAIL at 5 s), plus a
 * little more every round spent at 5 s, so the game always closes in on its last sheep.
 */
export function botFailRate(s: GameState, difficulty: Difficulty): number {
  const ms = roundTurnMs(s.round);
  const squeeze = (FIRST_ROUND_TURN_MS - ms) / (FIRST_ROUND_TURN_MS - LAST_ROUND_TURN_MS);
  const floorRounds = Math.max(0, s.round - TURN_MS_BY_ROUND.length);
  return Math.min(0.85, BOT_PROFILES[difficulty].failRate + BOT_PRESSURE_FAIL * squeeze + floorRounds * 0.05);
}

function decideBotTurn(s: GameState, ctx: EngineContext): BotPlan {
  const bot = s.players[s.turn!.seat];
  const scripted = s.mode === 'tour'; // tutorial bots never fumble
  const profile = BOT_PROFILES[bot.difficulty!];
  if (!scripted && drawRandom(s) < botFailRate(s, bot.difficulty!)) return { kind: 'fail' };
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
  // A bot that can't find a word doesn't give up at once: like a person, it stares at the clock until it runs out,
  // so the whole red window is open for the others to steal.
  if (plan.kind !== 'play') return;
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
      if (first === null) checkLastSheep(s, at);
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

/** The red seconds of a steal turn (and only a steal turn): when the other sheep can steal. */
export function inStealWindow(s: GameState, now: number): boolean {
  const t = s.turn;
  const windowMs = s.settings.stealWindowSeconds * 1000;
  return s.phase === 'playing' && !!t && t.stealable && windowMs > 0 && now >= t.endsAt - windowMs && now < t.endsAt;
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
    case 'pass': {
      if (action.seat !== turn.seat) return reject('not_your_turn');
      if (s.mode === 'tour') return reject('no_pass');
      if (player.passedRound === s.round) return reject('already_passed');
      player.passedRound = s.round;
      s.passMs = Math.max(PASS_MIN_MS, turn.endsAt - now);
      s.history.push({ round: s.round, seat: turn.seat, kind: 'pass', word: null, points: 0 });
      emit(s, now, 'pass', turn.seat, `${player.name} passed the bomb`);
      s.carryMs = 0;
      concludeTurn(s, now);
      return { state: s, accepted: true };
    }
    case 'bank':
      // There is no pile to bank any more: words just pass the turn on.
      return reject('no_bank');
    case 'steal': {
      if (action.seat === turn.seat) return reject('own_turn');
      if (player.frozen) return reject('frozen');
      if (!inStealWindow(s, now)) return reject('outside_steal_window');
      if (now < player.stealCooldownUntil) return reject('steal_cooldown');
      const v = check(action.word);
      if (!v.ok) {
        // A clear typo gets a suggestion. Anything else misses: nothing lost, but a short wait before the next try.
        const suggestion = typoFix(v.reason, action.word);
        if (suggestion) return { ...reject(v.reason), suggestion };
        stealFailed(s, action.seat, now);
        return { state: s, accepted: true, reason: v.reason };
      }
      stealSucceeded(s, action.seat, v.word, now);
      return { state: s, accepted: true };
    }
  }
}
