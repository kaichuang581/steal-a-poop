import { advance, apply, createGame } from '../engine';
import type { Action, ActionResult, Dictionary, GameSetup, GameState } from '../engine';

/**
 * The seam a realtime server replaces: the UI only talks to this interface.
 * A networked client would send `act` over a socket and apply server snapshots in `tick`.
 */
export interface GameClient {
  create(setup: GameSetup): GameState;
  tick(state: GameState, now: number): GameState;
  act(state: GameState, action: Action, now: number): ActionResult;
}

export function createLocalClient(dict: Dictionary): GameClient {
  const ctx = { dict };
  return {
    create: (setup) => createGame(setup, dict),
    tick: (state, now) => advance(state, ctx, now),
    act: (state, action, now) => apply(state, ctx, action, now),
  };
}
