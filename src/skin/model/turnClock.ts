import type { GameState } from '../../engine';
import { useStore } from '../../state/store';

/**
 * The turn's clock, for the painted table (plan file 17, change 11). The store moves `now` on every frame, and a
 * component that selects it renders on every frame. So nothing here hands `now` to React: a screen selects the few
 * things that change a few times a second (is the fuse lit, the whole seconds left), and whatever is drawn frame by
 * frame asks as it draws: the frost `turnClock()`, the fuse and the bomb's digits `turnClockDrawn()`.
 */
interface Clock { game: GameState | null; now: number }
type Turn = NonNullable<GameState['turn']>;

/** What is left of a turn, in ms: the whole turn until its fuse is lit, and never under nothing. The view's own sum. */
const leftMs = (turn: Turn, now: number) => Math.min(turn.durationMs, Math.max(0, turn.endsAt - now));

/** Whether the turn's fuse is lit: false in the beat after a bomb, when the turn is the next sheep's but its clock has not started. */
export const fuseLit = (s: Clock): boolean => !!s.game?.turn && s.now >= s.game.turn.startedAt;

/**
 * The store's clock, held still between the moments that change what the table's view says: it moves when the fuse is
 * lit and when the whole seconds left (rounded up, as the bomb shows them) change. Given to `toTableView` as its
 * `now`, the view names the same sheep on turn as the real clock would, and its `secondsLeft` is those whole seconds.
 */
export function clockBySeconds(s: Clock): number {
  const turn = s.game?.turn;
  if (!turn) return 0;
  if (s.now < turn.startedAt) return turn.startedAt - 1;
  return Math.max(turn.startedAt, turn.endsAt - Math.ceil(leftMs(turn, s.now) / 1000) * 1000);
}

const NO_TURN = { secondsLeft: null, fraction: 0 } as const;

function clockOf({ game, now }: Clock): { readonly secondsLeft: number | null; readonly fraction: number } {
  const turn = game?.turn;
  if (!turn) return NO_TURN;
  const secondsLeft = leftMs(turn, now) / 1000;
  const turnSeconds = turn.durationMs / 1000;
  return { secondsLeft, fraction: turnSeconds ? secondsLeft / turnSeconds : 0 };
}

/**
 * The clock at this instant, read from the store without a render: the seconds left of the turn (null with no turn)
 * and the fraction of the turn left, 1 to 0. For a store listener or a frame loop outside the 3D scene, never for a
 * render's output.
 */
export const turnClock = () => clockOf(useStore.getState());

// The game and its clock as the 3D scene has been handed them: what the store held when the last task that changed
// them was over. A change is posted to the next task, which is when React used to get it to the scene.
let handed: Clock = { game: useStore.getState().game, now: useStore.getState().now };
const post = typeof window !== 'undefined' && typeof MessageChannel !== 'undefined' ? new MessageChannel() : null;
let posted = false;
const hand = () => {
  posted = false;
  const s = useStore.getState();
  handed = { game: s.game, now: s.now };
};
if (post) {
  post.port1.onmessage = hand;
  // Outside a browser (a test run with a page of its own) an open port must not keep the process alive.
  (post.port1 as { unref?: () => void }).unref?.();
}
useStore.subscribe((s) => {
  if (posted || (s.now === handed.now && s.game === handed.game)) return;
  if (!post) return hand();
  posted = true;
  post.port2.postMessage(0);
});

/**
 * The clock as the 3D scene has always drawn it: a step behind the store. The scene used to be handed the clock by
 * React, and what the store set during a frame reached the scene's frame loop only once that frame's work was done;
 * everything else the scene is given (who holds the bomb) still arrives that way. Read inside `useFrame`, this is the
 * clock that arrived with it: the fuse and the bomb's digits move at the same instants as before, and never show a
 * new turn's clock on the last turn's bomb.
 */
export const turnClockDrawn = () => clockOf(handed);
