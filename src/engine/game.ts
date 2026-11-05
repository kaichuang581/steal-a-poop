import { PERSONALITIES, bankThresholdFor } from './bots';
import { hasPlayableWord } from './validation';
import { INTRO_MS, MAX_PLAYERS, MIN_PLAYERS } from './constants';
import { resolveSettings, startingWool } from './settings';
import type { GameSettings } from './settings';
import type { Dictionary } from './dictionary';
import { drawPick, drawRandom, hashSeed, shuffle } from './rng';
import type { Difficulty, GameMode, GameState, Player, RoundModifier } from './types';

export interface GameSetup {
  seed: string;
  now: number;
  /** Solo games: the one human, always seat 0. Ignored when `humans` is given. */
  humanName?: string;
  /** Room games: one entry per human, seats 0..k-1. Remaining seats up to `playerCount` are bots. */
  humans?: string[];
  playerCount: number;
  difficulty: Difficulty;
  /** Defaults to 'normal'. */
  mode?: GameMode;
  /** Game length settings; anything left out takes today's rules (DEFAULT_SETTINGS). */
  settings?: Partial<GameSettings>;
}

/**
 * Round twists: the word rules. The points-only twist (vowel_double) is retired with points, and the faster-round twist
 * (double_points_fast) with it: turns get faster every round on their own (TURN_MS_BY_ROUND), that is not a twist.
 */
const ALL_MODIFIERS: RoundModifier[] = ['no_e', 'six_plus', 'double_letter'];
const BOT_NAMES = ['Maya', 'Leo', 'Pip', 'Otis', 'Juno', 'Rex', 'Nadia', 'Bram', 'Sol'];
const BOT_EMOJIS = ['🦊', '🐸', '🐙', '🦉', '🐼', '🦄', '🐨', '🐯', '🦝'];
const BOT_COLORS = ['#f97316', '#22c55e', '#06b6d4', '#a78bfa', '#ec4899', '#eab308', '#38bdf8', '#f43f5e', '#84cc16'];
/** A tenth look, so ten humans can each have a distinct avatar. */
const EXTRA_LOOK = { emoji: '🐧', color: '#fb7185' };
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz'.split('');
const MIN_START_WORDS = 300;

export function createGame(setup: GameSetup, dict: Dictionary): GameState {
  const state = { rng: hashSeed(setup.seed) };
  const humans = setup.humans?.map((h) => h.trim());
  const room = !!humans && humans.length > 1;
  const wanted = room ? Math.max(setup.playerCount, humans.length) : setup.playerCount;
  const n = Math.min(MAX_PLAYERS, Math.max(MIN_PLAYERS, Math.round(wanted)));

  const settings = resolveSettings(setup.settings);
  // Round twists, drawn without repeats: round 1 plays plain, then the deck cycles for as long as the game runs.
  const modifierDeck: RoundModifier[] = settings.twists ? ['none', ...shuffle(state, ALL_MODIFIERS)] : ['none'];
  const playable = ALPHABET.filter((l) => hasPlayableWord(dict, l, [], modifierDeck[0]));
  const base = playable.length ? playable : ALPHABET;
  const common = base.filter((l) => dict.startingWith(l).length >= MIN_START_WORDS);
  const chainLetter = drawPick(state, common.length ? common : base);

  const names = shuffle(state, BOT_NAMES);
  const pool = BOT_EMOJIS.map((emoji, i) => ({ emoji, color: BOT_COLORS[i] }));
  const looks = shuffle(state, room ? [...pool, EXTRA_LOOK] : pool);

  const blank = {
    banked: 0, lives: startingWool(settings), frozen: false, frozenAt: null, stealCooldownUntil: 0, turnsTaken: 0, lastWord: null,
    steals: 0, wordsPlayed: 0, longestWord: '', bestWord: null,
  };
  const players: Player[] = room
    ? humans.map((name, seat) => ({
        ...blank, id: seat, name: name || `Player ${seat + 1}`, emoji: looks[seat].emoji, color: looks[seat].color,
        isHuman: true, difficulty: null, personality: null, bankThreshold: 0,
      }))
    : [
        {
          ...blank, id: 0, name: (humans?.[0] ?? setup.humanName ?? '').trim() || 'You', emoji: '😎', color: '#f5c26b',
          isHuman: true, difficulty: null, personality: null, bankThreshold: 0,
        },
      ];
  const firstBot = players.length;
  for (let seat = firstBot; seat < n; seat++) {
    const personality = drawPick(state, PERSONALITIES);
    players.push({
      ...blank, id: seat, name: names[seat - firstBot],
      emoji: looks[room ? seat : seat - 1].emoji, color: looks[room ? seat : seat - 1].color,
      isHuman: false, difficulty: setup.difficulty, personality,
      bankThreshold: bankThresholdFor(personality, drawRandom(state)),
    });
  }

  return {
    seed: setup.seed, settings,
    rng: state.rng,
    mode: setup.mode ?? 'normal',
    phase: 'intro',
    round: 1,
    modifier: modifierDeck[0],
    modifierDeck,
    chainLetter,
    pile: 0,
    used: [],
    players,
    turn: null,
    introEndsAt: setup.now + INTRO_MS,
    trap: null,
    history: [],
    events: [{ id: 1, at: setup.now, kind: 'roundStart', seat: null, text: 'Round 1', amount: 0 }],
    eventSeq: 1,
    winners: null,
  };
}

/** UTC date key, e.g. 2026-10-31. */
export function utcDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Everyone gets the same seed, letter, modifiers, and bot lineup for a given UTC day. */
export function dailySetup(date: Date, humanName: string, now: number): GameSetup {
  const seed = `daily:${utcDateKey(date)}`;
  return { seed, now, humanName, playerCount: 4 + (hashSeed(seed) % 5), difficulty: 'medium' };
}
