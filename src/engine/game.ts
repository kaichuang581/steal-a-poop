import { PERSONALITIES, bankThresholdFor } from './bots';
import { INTRO_MS, MAX_PLAYERS, MIN_PLAYERS, TOKENS_PER_ROUND } from './constants';
import type { Dictionary } from './dictionary';
import { drawPick, drawRandom, hashSeed, shuffle } from './rng';
import type { Difficulty, GameState, Player, RoundModifier } from './types';

export interface GameSetup {
  seed: string;
  now: number;
  humanName: string;
  playerCount: number;
  difficulty: Difficulty;
}

const ALL_MODIFIERS: RoundModifier[] = ['no_e', 'six_plus', 'double_letter', 'vowel_double', 'double_points_fast'];
const BOT_NAMES = ['Maya', 'Leo', 'Pip', 'Otis', 'Juno', 'Rex', 'Nadia', 'Bram', 'Sol'];
const BOT_EMOJIS = ['🦊', '🐸', '🐙', '🦉', '🐼', '🦄', '🐨', '🐯', '🦝'];
const BOT_COLORS = ['#f97316', '#22c55e', '#06b6d4', '#a78bfa', '#ec4899', '#eab308', '#38bdf8', '#f43f5e', '#84cc16'];
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz'.split('');
const MIN_START_WORDS = 300;

export function createGame(setup: GameSetup, dict: Dictionary): GameState {
  const state = { rng: hashSeed(setup.seed) };
  const n = Math.min(MAX_PLAYERS, Math.max(MIN_PLAYERS, Math.round(setup.playerCount)));

  const modifierDeck = shuffle(state, ALL_MODIFIERS).slice(0, 3);
  const common = ALPHABET.filter((l) => dict.startingWith(l).length >= MIN_START_WORDS);
  const chainLetter = drawPick(state, common.length ? common : ALPHABET);

  const names = shuffle(state, BOT_NAMES);
  const looks = shuffle(state, BOT_EMOJIS.map((emoji, i) => ({ emoji, color: BOT_COLORS[i] })));

  const blank = {
    banked: 0, tokens: TOKENS_PER_ROUND, turnsTaken: 0, lastWord: null,
    steals: 0, wordsPlayed: 0, longestWord: '', bestWord: null,
  };
  const players: Player[] = [
    {
      ...blank, id: 0, name: setup.humanName.trim() || 'You', emoji: '😎', color: '#f5c26b',
      isHuman: true, difficulty: null, personality: null, bankThreshold: 0,
    },
  ];
  for (let seat = 1; seat < n; seat++) {
    const personality = drawPick(state, PERSONALITIES);
    players.push({
      ...blank, id: seat, name: names[seat - 1], emoji: looks[seat - 1].emoji, color: looks[seat - 1].color,
      isHuman: false, difficulty: setup.difficulty, personality,
      bankThreshold: bankThresholdFor(personality, drawRandom(state)),
    });
  }

  return {
    seed: setup.seed,
    rng: state.rng,
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
