import { TRAP_LETTERS, utcDateKey } from '../../engine';
import type { GameState, RoundModifier } from '../../engine';
import { getDaily, getStreak } from '../../lib/daily';
import { useMemo } from 'react';
import { useStore } from '../../state/store';
import type { Mode as StoreMode } from '../../state/store';
import type { CreatureId, Mode, PlayerView, TableView, TwistId } from './types';

const CREATURES: CreatureId[] = ['moss', 'pip', 'willow', 'bramble', 'fern', 'quill', 'juniper'];

/** Stable per seat: seat 0 is always moss, seat 1 pip, and so on, wrapping after seven. */
export function creatureFor(seat: number): CreatureId {
  return CREATURES[seat % CREATURES.length];
}

export const TWIST_OF: Record<RoundModifier, TwistId | null> = {
  none: null,
  no_e: 'noE', six_plus: 'sixPlus', double_letter: 'doubleLetter', vowel_double: 'vowelDouble', double_points_fast: 'doublePointsShort',
};

const MODE_OF: Record<StoreMode, Mode> = { quick: 'quick', daily: 'daily', practice: 'practice', tour: 'tutorial', room: 'rooms' };

/**
 * The last seven UTC days, oldest first; true when a Daily Table was played that day. Only today's daily record is
 * stored, so earlier days come from the streak: a run of `count` finished days ending today (when today is done) or
 * yesterday.
 */
export function streakDays(today = new Date()): boolean[] {
  const key = utcDateKey(today);
  const rec = getDaily(key);
  const count = getStreak(key);
  const runEnd = rec?.status === 'done' ? 0 : 1; // days back from today where the streak's last day is
  return Array.from({ length: 7 }, (_, i) => {
    const back = 6 - i;
    if (back === 0) return rec !== null;
    return back >= runEnd && back < runEnd + count;
  });
}

/** What the daily view needs from storage; read once per game (see useTableView), not every frame. */
export interface DailyView {
  streakDays?: boolean[];
  dailyPlayedToday: boolean;
}

export function readDailyView(mode: Mode): DailyView {
  return {
    streakDays: mode === 'daily' ? streakDays() : undefined,
    dailyPlayedToday: getDaily(utcDateKey(new Date())) !== null,
  };
}

/**
 * Pure mapping from the store to the painted view model. `typed` and `message` live in the input strip's own state
 * (the classic InputBar keeps them locally too), so they are passed in. `dimmed` comes from the visual events.
 */
export function toTableView(
  game: GameState | null, storeMode: StoreMode, mySeat: number, now: number,
  extra: { typed?: string; message?: TableView['message']; dimmed?: ReadonlySet<number>; daily?: DailyView } = {},
): TableView | null {
  if (!game) return null;
  const turn = game.turn;
  const players: PlayerView[] = game.players.map((p) => ({
    id: String(p.id),
    name: p.name,
    isYou: p.id === mySeat,
    isBot: !p.isHuman,
    difficulty: p.difficulty ?? undefined,
    creature: creatureFor(p.id),
    banked: p.banked,
    dimmed: extra.dimmed?.has(p.id) ?? false,
    lives: p.lives,
    frozen: p.frozen,
  }));
  const longest = game.players.reduce<{ word: string; playerId: string } | undefined>(
    (best, p) => (p.longestWord.length > (best?.word.length ?? 0) ? { word: p.longestWord, playerId: String(p.id) } : best),
    undefined,
  );
  const phase: TableView['phase'] =
    game.phase === 'gameOver' ? 'gameEnd' : game.phase === 'playing' ? 'turn' : game.round > 1 ? 'roundEnd' : 'setup';
  const mode = MODE_OF[storeMode];
  return {
    mode,
    phase,
    round: game.round,
    turn: turn ? game.players[turn.seat].turnsTaken + 1 : 1,
    twist: TWIST_OF[game.modifier],
    pile: game.pile,
    letter: game.chainLetter,
    isTrapLetter: TRAP_LETTERS.has(game.chainLetter),
    players,
    currentPlayerId: turn ? String(turn.seat) : '',
    youId: String(mySeat),
    secondsLeft: turn ? Math.max(0, turn.endsAt - now) / 1000 : 0,
    turnSeconds: turn ? turn.durationMs / 1000 : 0,
    typed: extra.typed ?? '',
    message: extra.message ?? null,
    longestWord: longest,
    winnerIds: game.winners?.map(String),
    ...(extra.daily ?? readDailyView(mode)),
  };
}

/** The only place that knows the store's shape. Read-only. */
export function useTableView(extra?: Parameters<typeof toTableView>[4]): TableView | null {
  const game = useStore((s) => s.game);
  const mode = useStore((s) => s.mode);
  const mySeat = useStore((s) => s.mySeat);
  const now = useStore((s) => s.now);
  // The view re-renders every frame; the daily record only changes when a game starts or ends.
  const viewMode = MODE_OF[mode];
  const over = game?.phase === 'gameOver';
  const seed = game?.seed;
  const daily = useMemo(() => readDailyView(viewMode), [viewMode, over, seed]); // eslint-disable-line react-hooks/exhaustive-deps
  return toTableView(game, mode, mySeat, now, { ...extra, daily });
}
