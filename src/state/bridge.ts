import type { Action, ActionResult } from '../engine';

/**
 * The game store and the room store need each other (one drives the table, the other talks to the
 * server). They meet here instead of importing each other, which would be circular.
 */
export const bridge: {
  act?: (action: Action) => Promise<ActionResult | null>;
  leaveRoom?: () => void;
  /** Server clock minus this browser's clock, in ms. */
  skew: () => number;
} = { skew: () => 0 };
