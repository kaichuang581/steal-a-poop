import { Component } from 'react';
import type { ReactNode } from 'react';
import { FailCard } from './ReportCard';
import { noteError } from './report';

/*
 * Fail soft (docs/visual-overhaul/17-performance-and-stability.md, changes 2 and 4). An error that reaches the top used
 * to leave an empty page. Here it is caught, written to the device report's last errors, and a card with Reload and
 * "Copy device report" takes the screen's place. A piece of the game that would not load (a tab left open across a
 * new version) reloads the page instead, once.
 */

/** Marks the one reload a tab gets for a piece that would not load. Kept for the tab's session, so it cannot loop. */
const CHUNK_RELOAD = 'sap:chunk-reload';
let reloading = false;

/** Whether the page is on its way to reloading for a missing piece: a boundary shows nothing in that moment. */
export const isReloading = () => reloading;

/** Whether an error is a piece of the game's code or styles failing to load, as each browser words it. */
export function isChunkError(error: unknown): boolean {
  const text = String((error as { message?: unknown } | null)?.message ?? error);
  return /dynamically imported module|Importing a module script failed|Unable to preload CSS|Loading (?:CSS )?chunk/i.test(text);
}

/**
 * A piece failed to load: reload the page, unless this tab already has for that reason (then the caller shows the
 * card). True when a reload is on its way. With session storage refused the reload cannot be marked, so it never happens.
 */
export function reloadOnceForChunk(): boolean {
  if (reloading) return true;
  try {
    if (sessionStorage.getItem(CHUNK_RELOAD)) return false;
    sessionStorage.setItem(CHUNK_RELOAD, '1');
  } catch { return false; }
  reloading = true;
  location.reload();
  return true;
}

/** What a boundary's card says for an error. */
export function failText(error: unknown, otherwise: string): { title: string; note: string } {
  return isChunkError(error)
    ? { title: 'Part of the game did not load.', note: 'Check your connection, then reload.' }
    : { title: otherwise, note: 'Reloading usually fixes it.' };
}

interface Props {
  /** What this boundary stands round, for the report's error line. */
  where?: string;
  /** Given for a window over the screen (the legal pages): its card can be closed, and the screen behind is kept. */
  onClose?: () => void;
  children: ReactNode;
}

/** Catches whatever its children throw while drawing and shows the card in their place. */
export class AppBoundary extends Component<Props, { failed: unknown }> {
  state: { failed: unknown } = { failed: null };

  static getDerivedStateFromError(error: unknown) {
    return { failed: error ?? new Error('Something was thrown') };
  }

  componentDidCatch(error: unknown) {
    noteError(error, this.props.where ?? 'app');
    if (isChunkError(error) && reloadOnceForChunk()) this.forceUpdate();
  }

  render() {
    const { failed } = this.state;
    if (failed === null) return this.props.children;
    if (isReloading()) return null;
    const { title, note } = failText(failed, this.props.onClose ? 'This page could not be opened.' : 'Something went wrong and the game had to stop.');
    return <FailCard fill={this.props.onClose ? 'window' : 'screen'} title={title} note={note} onClose={this.props.onClose} />;
  }
}
