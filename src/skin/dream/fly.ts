/**
 * A word is taken (docs/dream/06-beat-and-effects.md, section 2): the typed tiles leave the tray for the sign's word
 * plank, one after another, 30 ms apart. Each takes 320 ms along an arc that rises 120 px over the straight line and
 * shrinks to the plank's 16 px. The sign is moving all the while, so each frame asks where the plank now is. Plain DOM
 * moved by its own frames: it is drawn only, and outlives nothing (every tile removes itself on landing).
 */
export const FLIGHT = { ms: 320, stagger: 30, rise: 120, to: 16 } as const;

export function flyTiles(layer: HTMLElement, tiles: readonly { ch: string; from: DOMRect }[], target: () => DOMRect | null, onFirst: () => void): void {
  const t0 = performance.now();
  const nodes = tiles.map(({ ch, from }) => {
    const el = document.createElement('span');
    el.className = 'dr-tile dr-flyer';
    el.textContent = ch;
    el.style.setProperty('--t', `${from.width}px`);
    el.style.setProperty('--d', `${Math.max(0, from.height - from.width)}px`);
    layer.append(el);
    return el as HTMLElement | null;
  });
  let fired = false;
  const first = () => { if (!fired) { fired = true; onFirst(); } };
  if (!nodes.length) { first(); return; }
  const step = (now: number) => {
    const base = layer.getBoundingClientRect(), to = target();
    let alive = false;
    nodes.forEach((el, i) => {
      if (!el) return;
      const k = (now - t0 - i * FLIGHT.stagger) / FLIGHT.ms, from = tiles[i].from;
      if (k >= 1) { el.remove(); nodes[i] = null; first(); return; }
      alive = true;
      const u = Math.max(0, k), e = u * u * (3 - 2 * u);
      const fx = from.left + from.width / 2 - base.left, fy = from.top + from.height / 2 - base.top;
      // A sign still off the screen's right: the tile heads for the edge it will come in by, never out across the page.
      const tx = to ? Math.min(base.width - 24, Math.max(24, to.left + (to.width * (i + 0.5)) / tiles.length - base.left)) : fx, ty = to ? to.top + to.height / 2 - base.top : fy - 240;
      const x = fx + (tx - fx) * e, y = fy + (ty - fy) * e - FLIGHT.rise * 4 * u * (1 - u), s = 1 + (FLIGHT.to / from.width - 1) * e;
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -50%) scale(${s.toFixed(3)})`;
    });
    if (alive) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
