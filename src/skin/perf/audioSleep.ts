import { audioContext } from '../../audio/sound';

/**
 * Sound sleeps with the tab (plan file 17, change 12; Brian, 2026-11-16: yes). While the page is hidden the audio
 * context is suspended, so the music's scheduler finds nothing running and makes no notes (it used to start about
 * thirty oscillators a second in a tab nobody was looking at), and the sound card is let go.
 *
 * `audioContext()` only hands out a running context, so the one put to sleep is kept here to be woken. A browser that
 * will not start sound again without a tap gets the next tap or key press.
 */
export function installAudioSleep(): () => void {
  let kept: AudioContext | null = null;
  const settle = () => {
    if (!kept || document.hidden || kept.state !== 'running') return;
    kept = null;
    window.removeEventListener('pointerdown', wake, true);
    window.removeEventListener('keydown', wake, true);
  };
  const wake = () => {
    if (!kept || document.hidden) return;
    // Asked for even when the context still says "running": a suspend from a moment ago may not have landed yet.
    kept.resume().then(settle, () => { /* closed, or refused until a tap */ });
  };
  const onVisibility = () => {
    if (document.hidden) {
      kept ??= audioContext();
      kept?.suspend().catch(() => { /* closed: nothing to put to sleep */ });
    } else if (kept) {
      window.addEventListener('pointerdown', wake, true);
      window.addEventListener('keydown', wake, true);
      wake();
    }
  };
  document.addEventListener('visibilitychange', onVisibility);
  return () => {
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pointerdown', wake, true);
    window.removeEventListener('keydown', wake, true);
    // Never leave the game silent behind us.
    if (kept && !document.hidden) void kept.resume().catch(() => {});
    kept = null;
  };
}
