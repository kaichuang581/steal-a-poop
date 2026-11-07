/** Pixel bombs for the turn clock. The fuse burns down as the turn runs out; the spark sits on the end of what is left. */
const FUSE: [number, number][] = [[8, 2], [9, 2], [10, 1], [11, 1], [12, 0], [13, 0]];

function BombBody({ red }: { red: boolean }) {
  const body = red ? '#6b1f1f' : '#2b2b33';
  const shine = red ? '#c05a4a' : '#5b5b6b';
  const rect = (x: number, y: number, w: number, h: number, f: string, k: string) => <rect key={k} x={x} y={y} width={w} height={h} fill={f} />;
  return (
    <>
      {rect(5, 5, 6, 1, body, 'r5')}{rect(4, 6, 8, 1, body, 'r6')}{rect(3, 7, 10, 7, body, 'r7')}{rect(4, 14, 8, 1, body, 'r14')}{rect(5, 15, 6, 1, body, 'r15')}
      {rect(6, 3, 4, 2, '#7d7d8a', 'neck')}
      {rect(5, 7, 2, 2, shine, 'shine')}{rect(5, 9, 1, 1, shine, 'shine2')}
    </>
  );
}

/** The big bomb on the letter card: `fraction` of the fuse (0..1) is left; red once others can steal. */
export function BombClock({ fraction, red, size = 44 }: { fraction: number; red: boolean; size?: number }) {
  const left = Math.max(0, Math.min(1, fraction));
  const n = Math.ceil(left * FUSE.length);
  const shown = FUSE.slice(0, n);
  const tip = shown[shown.length - 1];
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} shapeRendering="crispEdges" aria-hidden="true" className="sk-bomb" data-red={red || undefined}>
      <BombBody red={red} />
      {shown.map(([x, y], i) => <rect key={i} x={x} y={y} width={1} height={1} fill="#c9a66b" />)}
      {tip && <rect className="sk-bomb-spark" x={tip[0]} y={tip[1] - 1} width={1} height={1} fill={red ? '#ff5a3a' : '#ffd24a'} />}
    </svg>
  );
}

/** A small lit bomb for the sheep who has it right now. */
export function MiniBomb({ size = 18 }: { size?: number }) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} shapeRendering="crispEdges" aria-hidden="true" className="sk-bomb-pass">
      <BombBody red={false} />
      <rect x={8} y={2} width={1} height={1} fill="#c9a66b" /><rect x={9} y={1} width={1} height={1} fill="#c9a66b" />
      <rect className="sk-bomb-spark" x={10} y={0} width={1} height={1} fill="#ffd24a" />
    </svg>
  );
}
