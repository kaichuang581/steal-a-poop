import { useEffect, useRef } from 'react';
import { inStealWindow } from '../../engine';
import type { GameEvent, GameState } from '../../engine';
import { useStore } from '../../state/store';
import { TWIST_OF } from './useTableView';
import type { TwistId } from './types';

export type VisualEvent =
  | { type: 'accepted'; playerId: string; word: string; points: number }
  | { type: 'banked'; playerId: string; amount: number }
  | { type: 'stole'; byId: string; fromId: string; amount: number; word: string }
  | { type: 'stealFailed'; playerId: string; lost: number }
  | { type: 'timedOut'; playerId: string; trapperId?: string }
  | { type: 'trapSet'; letter: string }
  | { type: 'stealWindowOpened'; playerId: string }
  | { type: 'roundStart'; round: number; twist: TwistId | null }
  | { type: 'roundEnd'; round: number }
  | { type: 'gameEnd'; winnerIds: string[] };

/**
 * Turns one engine event into visual events. `prev` is the game state before the event's batch, used for what the
 * engine does not put on the event: who was stolen from, who set a sprung trap.
 */
export function mapEngineEvent(e: GameEvent, prev: GameState | null, next: GameState): VisualEvent[] {
  const seat = e.seat === null ? '' : String(e.seat);
  switch (e.kind) {
    case 'play': return [{ type: 'accepted', playerId: seat, word: e.word ?? '', points: e.amount }];
    case 'bank': return [{ type: 'banked', playerId: seat, amount: e.amount }];
    case 'steal': return [{ type: 'stole', byId: seat, fromId: prev?.turn ? String(prev.turn.seat) : '', amount: e.amount, word: e.word ?? '' }];
    case 'stealFail': return [{ type: 'stealFailed', playerId: seat, lost: -e.amount }];
    case 'timeout': {
      const sprung = next.events.some((x) => x.kind === 'trapSprung' && x.seat === e.seat && Math.abs(x.id - e.id) <= 1);
      return [{ type: 'timedOut', playerId: seat, trapperId: sprung && prev?.trap ? String(prev.trap.trapperSeat) : undefined }];
    }
    case 'roundStart':
      return next.round > 1
        ? [{ type: 'roundEnd', round: next.round - 1 }, { type: 'roundStart', round: next.round, twist: TWIST_OF[next.modifier] }]
        : [{ type: 'roundStart', round: next.round, twist: TWIST_OF[next.modifier] }];
    case 'gameOver': return [{ type: 'gameEnd', winnerIds: (next.winners ?? []).map(String) }];
    default: return [];
  }
}

/**
 * Calls `handler` for every visual event after mount: engine events where the engine emits them, and two derived
 * ones (trapSet from the game's trap field, stealWindowOpened from the clock). Read-only.
 */
export function useVisualEvents(handler: (e: VisualEvent) => void) {
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  });
  useEffect(() => {
    const s0 = useStore.getState();
    let prev = s0.game;
    let last = prev?.eventSeq ?? 0;
    let stealWas = prev ? inStealWindow(prev, s0.now) : false;
    // The engine clones state on every step, so the trap is compared by value, not by reference.
    const trapKey = (g: GameState | null) => (g?.trap ? `${g.trap.trapperSeat}:${g.trap.victimSeat}:${g.trap.letter}` : '');
    let trapWas = trapKey(prev);
    return useStore.subscribe((s) => {
      const g = s.game;
      if (!g) {
        prev = null;
        last = 0;
        trapWas = '';
        return;
      }
      if (prev && g.seed !== prev.seed) last = 0; // a rematch replaces the game without passing through null
      if (g.eventSeq > last) {
        for (const e of g.events) if (e.id > last) mapEngineEvent(e, prev, g).forEach((v) => ref.current(v));
        last = g.eventSeq;
      }
      const trapNow = trapKey(g);
      if (g.trap && trapNow !== trapWas) ref.current({ type: 'trapSet', letter: g.trap.letter });
      trapWas = trapNow;
      const stealNow = inStealWindow(g, s.now);
      if (stealNow && !stealWas && g.turn) ref.current({ type: 'stealWindowOpened', playerId: String(g.turn.seat) });
      stealWas = stealNow;
      prev = g;
    });
  }, []);
}
