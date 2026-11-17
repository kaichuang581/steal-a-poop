import { Component, Fragment, createRef } from 'react';
import type { ReactNode } from 'react';
import { Paper } from '../kit';
import { failText, isChunkError, isReloading, reloadOnceForChunk } from './AppBoundary';
import { FailCard } from './ReportCard';
import { noteError } from './report';

/*
 * Round every 3D scene (docs/visual-overhaul/17-performance-and-stability.md, changes 2 and 3).
 *
 * A scene that cannot draw (no WebGL, an error while building it, its code missing) is replaced by a card over its own
 * box, "This device could not draw the farm.", with Reload and "Copy device report". Everything round it, the menus and
 * the game's own controls, is ordinary HTML and goes on working.
 *
 * A scene whose WebGL context the browser takes away shows "Redrawing the farm..." over its canvas. The renderer puts
 * itself right when the context comes back. If it has not come back in three seconds the canvas is mounted again, once;
 * the second time a scene loses its context in a session, it gets the card.
 *
 * The boundary's own element takes no box (`display: contents`), so the canvas is laid out exactly as it was without
 * it; it is there to hear the canvas's context events on their way down, and to hold the card or the notice.
 */

/** How long a lost context has to come back by itself before the canvas is mounted again. */
const RESTORE_MS = 3000;
/** After that, the notice stays until the new canvas has drawn, or this long. */
const REDRAW_MAX_MS = 8000;
/** Contexts lost so far in this page's life, by scene. The second loss is the card; so a scene is remounted once at most. */
const losses = new Map<string, number>();

interface Props {
  /** The scene in words, as the card and the notice say it: "the farm", "the table". */
  scene: string;
  /** Where in the box the card sits: Home on a phone has its menu over the middle. */
  place?: 'center' | 'top';
  /** 'note' for a box too small for a card with buttons. */
  size?: 'card' | 'note';
  children: ReactNode;
}
interface State { failed: unknown; lost: boolean; epoch: number }

export class SceneBoundary extends Component<Props, State> {
  state: State = { failed: null, lost: false, epoch: 0 };
  private box = createRef<HTMLDivElement>();
  private timer = 0;
  private poll = 0;

  static getDerivedStateFromError(error: unknown): Partial<State> {
    return { failed: error ?? new Error('Something was thrown'), lost: false };
  }

  componentDidCatch(error: unknown) {
    noteError(error, this.props.scene);
    if (isChunkError(error) && reloadOnceForChunk()) this.forceUpdate();
  }

  componentDidMount() {
    // Context events do not bubble, but every event passes its target's ancestors on the way down.
    this.box.current?.addEventListener('webglcontextlost', this.onLost, true);
    this.box.current?.addEventListener('webglcontextrestored', this.onRestored, true);
  }

  componentWillUnmount() {
    this.box.current?.removeEventListener('webglcontextlost', this.onLost, true);
    this.box.current?.removeEventListener('webglcontextrestored', this.onRestored, true);
    this.clear();
  }

  private clear() {
    clearTimeout(this.timer);
    clearInterval(this.poll);
    this.timer = this.poll = 0;
  }

  private onLost = (e: Event) => {
    if (!(e.target instanceof HTMLCanvasElement)) return;
    e.preventDefault(); // without this the browser never gives the context back
    this.clear();
    const { scene } = this.props;
    const count = (losses.get(scene) ?? 0) + 1;
    losses.set(scene, count);
    if (count > 1) {
      const error = new Error('The WebGL context was lost a second time');
      noteError(error, scene);
      this.setState({ failed: error, lost: false });
      return;
    }
    this.setState({ lost: true });
    this.timer = window.setTimeout(this.remount, RESTORE_MS);
  };

  private onRestored = (e: Event) => {
    if (!(e.target instanceof HTMLCanvasElement)) return;
    this.clear();
    this.setState({ lost: false });
  };

  private remount = () => {
    this.setState((s) => ({ epoch: s.epoch + 1 }));
    const since = performance.now();
    this.poll = window.setInterval(() => {
      if (!this.box.current?.querySelector('canvas[data-drawn]') && performance.now() - since < REDRAW_MAX_MS) return;
      this.clear();
      this.setState({ lost: false });
    }, 200);
  };

  render() {
    const { scene, place, size, children } = this.props;
    const { failed, lost, epoch } = this.state;
    let body: ReactNode;
    if (failed !== null) {
      const { title, note } = failText(failed, `This device could not draw ${scene}.`);
      body = isReloading() ? null : <FailCard title={title} note={isChunkError(failed) ? note : 'The rest of the game still works.'} place={place} size={size} />;
    } else {
      body = (
        <>
          <Fragment key={epoch}>{children}</Fragment>
          {lost && (
            <div role="status" style={{ position: 'absolute', inset: 0, zIndex: 5, display: 'grid', placeItems: 'center', pointerEvents: 'none', background: 'rgba(27, 23, 48, 0.45)' }}>
              <Paper kind="slip">Redrawing {scene}...</Paper>
            </div>
          )}
        </>
      );
    }
    return <div ref={this.box} style={{ display: 'contents' }} data-scene={scene}>{body}</div>;
  }
}
