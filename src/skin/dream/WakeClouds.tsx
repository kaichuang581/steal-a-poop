/**
 * The clouds between the dream and the farmer's bedroom (Brian, 2026-11-09: "the animation transition with the clouds
 * from dream to farmer scenery is trash refine it"). Three acts, each its own `state`:
 * - 'in': painted clouds sweep in from the left and right edges, the outer ones first, closing on the middle, and a
 *   cloud-coloured wash fills the last gaps under them just as they land, so the dream never shows through a hole;
 * - 'hold': the screen is all cloud, softly billowing, while the bedroom is built behind it;
 * - 'out': they part like curtains, each cloud carried back out the side it came from, opaque until it is nearly off
 *   the screen, so nothing lingers over the room as a see-through ghost.
 * `gentle` (the farmer drifting off) takes it all slower. Never mounted under reduced motion.
 */
export type CloudState = 'in' | 'hold' | 'out';

/** How long each act takes (ms). The screen is fully covered `covered` ms after 'in' starts. */
export const CLOUD_MS = {
  in: 760, covered: 1050, out: 1150,
  gentleIn: 1250, gentleCovered: 1700,
} as const;

interface Cloud { x: number; y: number; w: number; layer: 0 | 1 | 2; shape: number; delay: number; flip: boolean }

/** A deterministic bank of clouds over the screen: three rows of big back clouds, a middle layer and a few nearer ones. */
function bank(): Cloud[] {
  const out: Cloud[] = [];
  let k = 0;
  const jitter = (i: number, s: number) => ((Math.sin(i * 12.9898 + s * 78.233) * 43758.5453) % 1 + 1) % 1;
  const row = (ys: number[], xs: number[], w: [number, number], layer: 0 | 1 | 2) => {
    for (const y of ys) for (const x of xs) {
      const i = k++;
      // Outer clouds land first, the middle last: the delay grows toward the centre line.
      const toCentre = 1 - Math.min(1, Math.abs(x - 50) / 55);
      out.push({
        x: x + (jitter(i, 1) - 0.5) * 8, y: y + (jitter(i, 2) - 0.5) * 8, w: w[0] + jitter(i, 3) * (w[1] - w[0]),
        layer, shape: i % 3, delay: Math.round(toCentre * 260 + jitter(i, 4) * 60 + layer * 40), flip: jitter(i, 5) > 0.5,
      });
    }
  };
  row([4, 50, 96], [-6, 26, 50, 74, 106], [46, 58], 0);
  row([24, 72], [8, 38, 62, 92], [36, 46], 1);
  row([30, 74], [20, 52, 84], [26, 36], 2);
  return out;
}
const CLOUDS = bank();

/** Three cloud outlines (lobes as [cx, cy, r], plus a base ellipse), drawn in a 200 x 120 box. */
const SHAPES: { base: [number, number, number, number]; lobes: [number, number, number][] }[] = [
  { base: [100, 82, 92, 28], lobes: [[44, 70, 32], [86, 48, 40], [132, 54, 34], [164, 74, 26]] },
  { base: [100, 84, 90, 26], lobes: [[36, 76, 26], [70, 56, 34], [112, 40, 42], [154, 62, 32]] },
  { base: [100, 82, 94, 27], lobes: [[40, 66, 30], [80, 52, 30], [118, 44, 36], [158, 66, 30], [100, 70, 34]] },
];
/** Back to front: each layer a little lighter, with a shade under it and a lit top. */
const TONES = [
  { shade: '#B9AEE0', body: '#D6CEF1', light: '#E4DEF7' },
  { shade: '#C7BDE8', body: '#E2DCF6', light: '#EEEAFB' },
  { shade: '#D2C9EE', body: '#ECE8FA', light: '#F8F6FE' },
] as const;

function CloudArt({ shape, layer, flip }: { shape: number; layer: 0 | 1 | 2; flip: boolean }) {
  const s = SHAPES[shape], t = TONES[layer];
  const body = (dy: number, fill: string) => (
    <g fill={fill} transform={`translate(0 ${dy})`}>
      <ellipse cx={s.base[0]} cy={s.base[1]} rx={s.base[2]} ry={s.base[3]} />
      {s.lobes.map(([cx, cy, r], i) => <circle key={i} cx={cx} cy={cy} r={r} />)}
    </g>
  );
  return (
    <svg viewBox="0 0 200 120" className="dr-cloud-art" style={flip ? { transform: 'scaleX(-1)' } : undefined}>
      {body(7, t.shade)}
      {body(0, t.body)}
      {/* Each lobe's sunlit cap: the same lobe, smaller and up to the left, so the body shows as a shaded rim below it. */}
      <g fill={t.light}>{s.lobes.map(([cx, cy, r], i) => <circle key={i} cx={cx - r * 0.14} cy={cy - r * 0.2} r={r * 0.74} />)}</g>
    </svg>
  );
}

export function WakeClouds({ state, gentle = false }: { state: CloudState; gentle?: boolean }) {
  return (
    <div className="dr-clouds" data-state={state} data-gentle={gentle || undefined} aria-hidden="true"
      style={{ '--in-ms': `${gentle ? CLOUD_MS.gentleIn : CLOUD_MS.in}ms`, '--out-ms': `${CLOUD_MS.out}ms` } as React.CSSProperties}>
      <i className="dr-clouds-fill" />
      {CLOUDS.map((c, i) => {
        // Each cloud comes in from (and leaves by) the side it is nearer, a little up or down with its row.
        const side = c.x < 50 ? -1 : 1;
        const dx = side * (70 + Math.abs(c.x - 50) * 0.6);
        const dy = (c.y - 50) * 0.35;
        return (
          <div key={i} className="dr-cloud" data-layer={c.layer}
            style={{ left: `${c.x}%`, top: `${c.y}%`, width: `${c.w}vmax`, '--dx': `${dx}vw`, '--dy': `${dy}vh`, '--d': `${gentle ? c.delay * 1.6 : c.delay}ms`, '--od': `${Math.round((1 - Math.abs(c.x - 50) / 60) * 120)}ms`, '--bob': `${3.2 + (i % 5) * 0.45}s` } as React.CSSProperties}>
            <div className="dr-cloud-bob">
              <CloudArt shape={c.shape} layer={c.layer} flip={c.flip} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
