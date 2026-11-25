import { useMemo } from 'react';
import type { CSSProperties } from 'react';
import { Art } from './Interface';
import { hash01 } from './starWords';

/**
 * One star for each sheep (docs/dream/v3/08, section 9), in place of the night's words in the sky: as the sheep clears
 * a fence a small gold star leaves the sign's word plank, rises to its place in the sky over 700 ms, grows to 1.35 and
 * back as it arrives, cools to frost at 80%, and stays for the night. Plain DOM over the sky, inside the dream window.
 * At a moon show every star grows and shrinks once, in a wave from left to right over two beats.
 */
export const SKY_STARS = { most: 240, rise: 700, size: 10, moonGap: 80, edge: 12 } as const;

/** A box the stars keep out of (the chip, the counter and its tab), CSS px in the dream's box. */
export interface KeepOut { x: number; y: number; w: number; h: number }

/**
 * Sheep `n`'s place in a sky of `w` across whose stars stop `horizon` px down: hashed from the night and the number, as
 * fractions of that sky, tried again (the next of its own hashes) while it lands in `bad`. The same fractions place it
 * on the results board's strip.
 */
export function starPlace(seed: string, n: number, bad: (fx: number, fy: number) => boolean = () => false): [number, number] {
  let at: [number, number] = [hash01(seed, n * 64), hash01(seed, n * 64 + 1)];
  for (let k = 1; k < 32 && bad(...at); k++) at = [hash01(seed, n * 64 + 2 * k), hash01(seed, n * 64 + 2 * k + 1)];
  return at;
}

/** Where a star sits in the window: above the horizon, clear of the top bar's boxes and 80 px from every moon's middle. */
export function starsIn(seed: string, count: number, w: number, horizon: number, keepOut: readonly KeepOut[], moons: readonly { x: number; y: number }[]): [number, number][] {
  const e = SKY_STARS.edge, top = e, bottom = Math.max(top + 20, horizon - 16), half = SKY_STARS.size / 2;
  const toPx = (fx: number, fy: number): [number, number] => [e + fx * (w - 2 * e), top + fy * (bottom - top)];
  const bad = (fx: number, fy: number) => {
    const [x, y] = toPx(fx, fy);
    return keepOut.some((k) => x + half > k.x && x - half < k.x + k.w && y + half > k.y && y - half < k.y + k.h)
      || moons.some((m) => Math.hypot(x - m.x, y - m.y) < SKY_STARS.moonGap);
  };
  const first = Math.max(1, count - SKY_STARS.most + 1);
  return Array.from({ length: Math.max(0, count - first + 1) }, (_, i) => toPx(...starPlace(seed, first + i, bad)));
}

interface Props {
  seed: string;
  /** Sheep counted so far: star n is sheep n's. */
  count: number;
  w: number; horizon: number;
  keepOut: readonly KeepOut[];
  moons: readonly { x: number; y: number }[];
  /** The star on its way up: sheep `n`'s, from the middle of its sign's plank (CSS px in the dream's box). */
  rising: { n: number; from: [number, number] } | null;
  /** How many moon shows so far: each starts the wave again. */
  wave: number;
}

export function SkyStars({ seed, count, w, horizon, keepOut, moons, rising, wave }: Props) {
  const places = useMemo(() => starsIn(seed, count, w, horizon, keepOut, moons), [seed, count, w, horizon, keepOut, moons]);
  const first = Math.max(1, count - SKY_STARS.most + 1);
  return (
    <div className="dr-stars" aria-hidden="true">
      {places.map(([x, y], i) => {
        const n = first + i, up = rising?.n === n ? rising.from : null;
        const style = {
          left: Math.round(x - SKY_STARS.size / 2), top: Math.round(y - SKY_STARS.size / 2), '--wave': (x / Math.max(1, w)).toFixed(3),
          ...(up ? { '--fx': `${Math.round(up[0] - x)}px`, '--fy': `${Math.round(up[1] - y)}px` } : {}),
        } as CSSProperties;
        // Two names for the one wave, in turn, so each moon show starts it again without remounting the stars.
        return (
          <span key={n} className="dr-star" data-new={up ? '' : undefined} data-wave={wave > 0 ? wave % 2 : undefined} style={style}>
            <Art name="star-plus" px={2} color="currentColor" />
          </span>
        );
      })}
    </div>
  );
}
