import type { ReactNode } from 'react';

/**
 * The pictures on Home's card, one for each way to play (Brian, 2026-11-20: "dont use images from the game, make ur
 * own artistic images that make the game look more exciting"). Each is a little poster: a painted backdrop in vector
 * shapes, and its characters in chunky pixel art with a dark outline, the way the farm is built from blocks.
 */

/** A pixel picture drawn on a grid: `put` sets cells, `rects` merges each row's runs into as few rectangles as it can. */
function canvas(w: number, h: number) {
  const g: string[][] = Array.from({ length: h }, () => Array(w).fill('.'));
  const put = (ch: string, x: number, y: number, cw = 1, chh = 1) => {
    for (let j = y; j < y + chh; j++) for (let i = x; i < x + cw; i++) if (g[j] && i >= 0 && i < w) g[j][i] = ch;
  };
  return { g, put, w, h };
}

/** Every empty cell next to a filled one becomes the outline, so each sprite reads as one shape against any backdrop. */
function outlined(src: string[][]): string[][] {
  const h = src.length + 2;
  const w = src[0].length + 2;
  const at = (x: number, y: number) => src[y - 1]?.[x - 1] ?? '.';
  return Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => {
    const c = at(x, y);
    if (c !== '.') return c;
    return [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => at(x + dx, y + dy) !== '.') ? 'k' : '.';
  }));
}

const INK = '#2A170B';
const PAL: Record<string, string> = {
  k: INK, w: '#F4ECDD', W: '#DDD3BE', f: '#EBCDB9', n: '#F2B6A0', e: '#3B3028', l: '#5B3A1E',
  b: '#2C4366', B: '#1E2F4A', h: '#9FB7D6', c: '#4F5B73', r: '#8C5A2E', y: '#FFD98A', Y: '#F2A444',
  R: '#A6453A', D: '#7E2420', T: '#F4ECDD', g: '#4F5B73', s: '#F3F0E6', d: '#2B2523', x: '#A8322C', t: '#E3B780', m: '#D8B460', M: '#8F6D22',
};

function Sprite({ grid, x, y, s, flip = false, rotate = 0 }: { grid: string[][]; x: number; y: number; s: number; flip?: boolean; rotate?: number }) {
  const w = grid[0].length;
  const out: ReactNode[] = [];
  grid.forEach((row, j) => {
    for (let i = 0; i < w;) {
      const c = row[i];
      let n = 1;
      while (i + n < w && row[i + n] === c) n++;
      if (c !== '.') out.push(<rect key={`${i}-${j}`} x={i} y={j} width={n} height={1} fill={PAL[c]} />);
      i += n;
    }
  });
  const cx = (w * s) / 2;
  const cy = (grid.length * s) / 2;
  const t = `translate(${x} ${y})${rotate ? ` rotate(${rotate} ${cx} ${cy})` : ''}${flip ? ` translate(${w * s} 0) scale(-${s} ${s})` : ` scale(${s})`}`;
  return <g transform={t} shapeRendering="crispEdges">{out}</g>;
}

// ---------- The sprites ----------
const SHEEP = (() => {
  const c = canvas(21, 13);
  c.put('w', 0, 2, 14, 7); c.put('w', 1, 1, 3, 1); c.put('w', 5, 1, 4, 1); c.put('w', 10, 1, 3, 1);
  c.put('.', 0, 2); c.put('.', 0, 8);
  c.put('W', 1, 8, 12, 1);
  c.put('f', 14, 3, 6, 7); c.put('w', 13, 1, 6, 3);
  c.put('n', 12, 4, 2, 2);
  c.put('e', 15, 5, 1, 2); c.put('e', 18, 5, 1, 2); c.put('n', 16, 8, 2, 1);
  c.put('l', 2, 9, 2, 3); c.put('l', 9, 9, 2, 3); c.put('e', 2, 11, 2, 1); c.put('e', 9, 11, 2, 1);
  return outlined(c.g);
})();
const JUMPER = (() => {
  // The same sheep with its legs tucked, mid-leap.
  const c = canvas(21, 11);
  c.put('w', 0, 2, 14, 7); c.put('w', 1, 1, 3, 1); c.put('w', 5, 1, 4, 1); c.put('w', 10, 1, 3, 1);
  c.put('.', 0, 2); c.put('.', 0, 8); c.put('W', 1, 8, 12, 1);
  c.put('f', 14, 3, 6, 7); c.put('w', 13, 1, 6, 3); c.put('n', 12, 4, 2, 2);
  c.put('e', 15, 5, 1, 1); c.put('e', 18, 5, 1, 1); c.put('n', 16, 8, 2, 1);
  c.put('l', 0, 9, 3, 1); c.put('l', 10, 9, 3, 1);
  return outlined(c.g);
})();
const BOMB = (() => {
  const c = canvas(15, 17);
  for (let y = 0; y < 13; y++) for (let x = 0; x < 13; x++) {
    const d = (x - 6) ** 2 + (y - 6) ** 2;
    if (d <= 40) c.put(x + y > 15 && d > 12 ? 'B' : 'b', x + 1, y + 4);
  }
  c.put('h', 3, 7, 2, 1); c.put('h', 3, 8, 1, 2); c.put('h', 6, 6);
  c.put('c', 5, 2, 5, 2);
  c.put('r', 8, 1); c.put('r', 9, 0); c.put('r', 10, 0);
  // The countdown on its face, as on the table's bomb.
  c.put('y', 6, 9, 3, 1); c.put('y', 6, 10); c.put('y', 6, 11, 3, 1); c.put('y', 8, 12); c.put('y', 6, 13, 3, 1);
  return outlined(c.g);
})();
const BARN = (() => {
  const c = canvas(26, 23);
  // A gambrel roof: shallow at the top, steep below, in the barn's dark red under a line of snow.
  const roof: [number, number][] = [[10, 15], [7, 18], [5, 20], [4, 21], [3, 22], [2, 23], [2, 23], [1, 24]];
  roof.forEach(([x0, x1], i) => c.put('D', x0, 1 + i, x1 - x0 + 1, 1));
  c.put('s', 10, 0, 6, 1); c.put('s', 7, 1, 3, 1); c.put('s', 16, 1, 3, 1); c.put('s', 5, 2, 2, 1); c.put('s', 19, 2, 2, 1);
  c.put('R', 2, 9, 22, 14);
  c.put('T', 2, 9, 1, 14); c.put('T', 23, 9, 1, 14); c.put('T', 1, 8, 24, 1);
  // The hayloft door, lit.
  c.put('T', 10, 10, 6, 4); c.put('y', 11, 11, 4, 2);
  // The big doors swung open on warm light, framed in white.
  c.put('T', 8, 14, 10, 1); c.put('y', 8, 15, 10, 8); c.put('Y', 8, 21, 10, 2);
  for (const x0 of [3, 18]) {
    c.put('R', x0, 15, 5, 8); c.put('T', x0, 15, 5, 1); c.put('T', x0, 22, 5, 1); c.put('T', x0, 15, 1, 8); c.put('T', x0 + 4, 15, 1, 8);
    c.put('T', x0, 18, 5, 1); c.put('T', x0 + 1, 17); c.put('T', x0 + 3, 19); // a rail across and its brace
  }
  return outlined(c.g);
})();
const FENCE = (() => {
  const c = canvas(30, 12);
  for (const x of [1, 14, 27]) { c.put('r', x, 1, 2, 11); c.put('s', x, 0, 2, 1); }
  c.put('t', 0, 3, 30, 2); c.put('t', 0, 8, 30, 2); c.put('s', 0, 3, 30, 1);
  return outlined(c.g);
})();
const WATCH = (() => {
  const c = canvas(17, 19);
  c.put('c', 6, 0, 5, 2); c.put('c', 7, 2, 3, 1); c.put('c', 1, 3, 3, 2); c.put('c', 13, 3, 3, 2);
  for (let y = 0; y < 15; y++) for (let x = 0; x < 15; x++) {
    const d = (x - 7) ** 2 + (y - 7) ** 2;
    if (d <= 52) c.put(d >= 34 ? 'g' : 's', x + 1, y + 3);
  }
  c.put('e', 8, 6, 1, 5); c.put('e', 8, 10, 4, 1); c.put('x', 8, 10);
  for (const [x, y] of [[8, 5], [13, 10], [8, 15], [3, 10]]) c.put('W', x, y);
  return outlined(c.g);
})();
const DOG = (() => {
  // The sheepdog sitting side-on, facing left: black with a white blaze, muzzle, chest and socks, and its red scarf.
  const c = canvas(20, 21);
  c.put('d', 3, 2, 7, 7);                     // head
  c.put('d', 8, 1, 3, 2); c.put('d', 9, 3, 2, 3); // the ear, folded over
  c.put('w', 0, 5, 4, 3); c.put('w', 4, 2, 1, 6); // muzzle and the blaze up the face
  c.put('e', 0, 5, 1, 1);                     // nose
  c.put('e', 5, 4); c.put('w', 6, 4);         // eye with its glint
  c.put('e', 1, 7, 2, 1);                     // mouth line
  c.put('x', 4, 9, 7, 2); c.put('x', 8, 11, 2, 2); // scarf and its tail
  c.put('d', 5, 11, 9, 7); c.put('d', 11, 13, 5, 6);
  c.put('w', 3, 11, 3, 5);                    // chest
  c.put('d', 4, 16, 2, 4); c.put('w', 3, 19, 3, 1); // front leg, white paw
  c.put('d', 12, 18, 4, 2); c.put('w', 11, 19, 3, 1); // hind leg, white paw
  c.put('d', 16, 14, 2, 3); c.put('d', 17, 12, 2, 2); c.put('w', 18, 11, 2, 2); // tail with a white tip
  return outlined(c.g);
})();
const KEY = (() => {
  const c = canvas(22, 9);
  for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) {
    const d = (x - 4) ** 2 + (y - 4) ** 2;
    if (d <= 20 && d >= 5) c.put(x + y > 9 ? 'M' : 'm', x, y);
  }
  c.put('m', 9, 3, 13, 3); c.put('M', 9, 5, 13, 1); c.put('m', 15, 6, 2, 3); c.put('m', 19, 6, 2, 2); c.put('M', 15, 8, 2, 1);
  return outlined(c.g);
})();
const Z = (() => {
  const c = canvas(5, 5);
  c.put('y', 0, 0, 5, 1); c.put('y', 3, 1); c.put('y', 2, 2); c.put('y', 1, 3); c.put('y', 0, 4, 5, 1);
  return outlined(c.g);
})();

// ---------- Vector pieces ----------
const VB = '0 0 192 108';
function Rays({ cx, cy, color, opacity, n = 18 }: { cx: number; cy: number; color: string; opacity: number; n?: number }) {
  const r = 240;
  const wedges = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    const b = a + Math.PI / n;
    return `M${cx} ${cy}L${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)}L${(cx + r * Math.cos(b)).toFixed(1)} ${(cy + r * Math.sin(b)).toFixed(1)}Z`;
  }).join('');
  return <path d={wedges} fill={color} opacity={opacity} />;
}
const Snow = ({ y }: { y: number }) => (
  <>
    <path d={`M0 ${y + 4}C40 ${y - 4} 70 ${y + 6} 110 ${y}S170 ${y - 2} 192 ${y + 3}V108H0Z`} fill="#F4ECDD" />
    <path d={`M0 ${y + 10}C50 ${y + 5} 90 ${y + 13} 140 ${y + 8}S180 ${y + 7} 192 ${y + 9}V108H0Z`} fill="#DDD3BE" opacity={0.6} />
  </>
);
const Spark = ({ x, y, r = 7 }: { x: number; y: number; r?: number }) => (
  <g transform={`translate(${x} ${y})`}>
    <circle r={r * 1.6} fill="#FFD98A" opacity={0.35} />
    <path d={`M0 ${-r}L${r * 0.28} ${-r * 0.28}L${r} 0L${r * 0.28} ${r * 0.28}L0 ${r}L${-r * 0.28} ${r * 0.28}L${-r} 0L${-r * 0.28} ${-r * 0.28}Z`} fill="#FFF4DC" />
  </g>
);
const Star = ({ x, y, r = 1.6 }: { x: number; y: number; r?: number }) => (
  <path transform={`translate(${x} ${y})`} d={`M0 ${-r * 2}L${r * 0.4} ${-r * 0.4}L${r * 2} 0L${r * 0.4} ${r * 0.4}L0 ${r * 2}L${-r * 0.4} ${r * 0.4}L${-r * 2} 0L${-r * 0.4} ${-r * 0.4}Z`} fill="#FFF4DC" />
);
function Tile({ x, y, ch, lit = false, size = 16, tilt = 0 }: { x: number; y: number; ch: string; lit?: boolean; size?: number; tilt?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${tilt} ${size / 2} ${size / 2})`}>
      <rect x={0} y={1.5} width={size} height={size} rx={2} fill={INK} />
      <rect width={size} height={size} rx={2} fill={lit ? '#FFD98A' : '#E3B780'} stroke={INK} strokeWidth={1.2} />
      <rect x={1.5} y={size - 3} width={size - 3} height={1.5} fill={lit ? '#F2A444' : '#B57F4A'} />
      <text x={size / 2} y={size * 0.74} textAnchor="middle" fontFamily="Fraunces, Georgia, serif" fontWeight={900} fontSize={size * 0.68} fill={lit ? '#7A3E12' : '#5B3A1E'}>{ch}</text>
    </g>
  );
}
const Lights = ({ y }: { y: number }) => {
  const cols = ['#E7705E', '#FFD98A', '#6BA372', '#9FB7D6'];
  return (
    <g>
      <path d={`M-4 ${y}Q48 ${y + 14} 96 ${y + 2}T196 ${y}`} fill="none" stroke={INK} strokeWidth={1.2} />
      {Array.from({ length: 12 }, (_, i) => {
        const t = (i + 0.5) / 12;
        const x = -4 + t * 200;
        const yy = y + Math.sin(t * Math.PI * 2) * 6 + 4;
        return <g key={i}><circle cx={x} cy={yy + 3} r={4} fill={cols[i % 4]} opacity={0.35} /><rect x={x - 1.6} y={yy} width={3.2} height={4.4} rx={1} fill={cols[i % 4]} stroke={INK} strokeWidth={0.6} /></g>;
      })}
    </g>
  );
};
const Speed = ({ x, y, dir = 1, color = '#FFD98A' }: { x: number; y: number; dir?: 1 | -1; color?: string }) => (
  <g stroke={color} strokeWidth={2} strokeLinecap="round" opacity={0.7}>
    {[0, 8, 16].map((dy, i) => <line key={dy} x1={x} y1={y + dy} x2={x - dir * (14 + (i % 2) * 8)} y2={y + dy} />)}
  </g>
);

// ---------- The scenes ----------
export type ArtId = 'queue' | 'lobby' | 'join' | 'dream' | 'practice' | 'tutorial';

const SCENES: Record<ArtId, () => ReactNode> = {
  // Two sheep face off across a lit bomb.
  queue: () => (
    <>
      <rect width={192} height={108} fill="#1E2F4A" />
      <Rays cx={96} cy={66} color="#F2A444" opacity={0.22} />
      <circle cx={96} cy={66} r={34} fill="#FFD98A" opacity={0.22} />
      <Snow y={86} />
      <Speed x={14} y={52} dir={-1} />
      <Speed x={178} y={52} />
      <Sprite grid={SHEEP} x={12} y={50} s={2.6} />
      <Sprite grid={SHEEP} x={121} y={50} s={2.6} flip />
      <Sprite grid={BOMB} x={76} y={48} s={2.5} />
      <Spark x={104} y={47} r={8} />
    </>
  ),
  // A barn of your own, lights up and doors open, friends on the way.
  lobby: () => (
    <>
      <rect width={192} height={108} fill="#24334F" />
      <circle cx={96} cy={78} r={60} fill="#FFD98A" opacity={0.12} />
      <Star x={22} y={22} /><Star x={170} y={30} r={1.2} /><Star x={150} y={12} r={1.4} /><Star x={36} y={44} r={1} />
      <Lights y={8} />
      <path d="M72 100L60 108H132L120 100Z" fill="#FFD98A" opacity={0.5} />
      <Snow y={90} />
      <Sprite grid={BARN} x={57} y={22} s={3} />
      <Sprite grid={SHEEP} x={18} y={74} s={1.7} />
      <Sprite grid={SHEEP} x={138} y={74} s={1.7} flip />
    </>
  ),
  // Your friend's code and the key to their barn.
  join: () => (
    <>
      <rect width={192} height={108} fill="#3F6A49" />
      <Rays cx={96} cy={54} color="#FFD98A" opacity={0.16} n={14} />
      <circle cx={96} cy={54} r={40} fill="#FFD98A" opacity={0.14} />
      {[...'FLOCK'].map((ch, i) => <Tile key={i} x={38 + i * 24} y={18 + (i % 2) * 4} ch={ch} size={20} tilt={(i - 2) * 4} lit={i === 4} />)}
      <Sprite grid={KEY} x={50} y={60} s={4} rotate={-8} />
      <Spark x={150} y={66} r={6} />
    </>
  ),
  // Over the fence under the moon: Counting Sheep.
  dream: () => (
    <>
      <rect width={192} height={108} fill="#1B2A42" />
      <circle cx={150} cy={30} r={30} fill="#FFD98A" opacity={0.12} />
      <circle cx={150} cy={30} r={16} fill="#FFE7A8" />
      <circle cx={158} cy={25} r={14} fill="#1B2A42" />
      {[[20, 18], [44, 10], [70, 26], [104, 12], [120, 40], [178, 60], [12, 50], [86, 46]].map(([x, y], i) => <Star key={i} x={x} y={y} r={i % 3 ? 1 : 1.6} />)}
      <path d="M0 86C50 76 120 80 192 90V108H0Z" fill="#DDD3BE" />
      <path d="M0 92C60 84 130 88 192 96V108H0Z" fill="#F4ECDD" />
      <path d="M40 74Q84 26 132 70" fill="none" stroke="#FFF4DC" strokeWidth={1.6} strokeDasharray="3 4" opacity={0.6} />
      <Sprite grid={FENCE} x={60} y={60} s={2.3} />
      <Sprite grid={JUMPER} x={66} y={22} s={2.4} rotate={-10} />
      <Sprite grid={Z} x={24} y={30} s={2.4} />
      <Sprite grid={Z} x={42} y={20} s={1.7} />
    </>
  ),
  // Against the clock, one life.
  practice: () => (
    <>
      <rect width={192} height={108} fill="#7E2420" />
      <Rays cx={70} cy={56} color="#FFD98A" opacity={0.14} n={16} />
      <circle cx={70} cy={56} r={44} fill="#E7705E" opacity={0.25} />
      <Speed x={150} y={30} />
      <Speed x={168} y={74} />
      <Sprite grid={WATCH} x={26} y={8} s={4.6} />
      <Sprite grid={BOMB} x={118} y={38} s={3} />
      <Spark x={152} y={36} r={8} />
    </>
  ),
  // The sheepdog shows you round.
  tutorial: () => (
    <>
      <rect width={192} height={108} fill="#5F8A49" />
      <Rays cx={150} cy={70} color="#FFF4DC" opacity={0.1} n={14} />
      <Snow y={88} />
      <g>
        <path d="M20 16H106Q114 16 114 24V48Q114 56 106 56H62L52 66L52 56H20Q12 56 12 48V24Q12 16 20 16Z" fill="#FFF4DC" stroke={INK} strokeWidth={1.6} />
        <Tile x={26} y={24} ch="H" size={22} tilt={-5} />
        <Tile x={52} y={23} ch="I" size={22} />
        <Tile x={78} y={24} ch="!" size={22} tilt={5} lit />
      </g>
      <Sprite grid={DOG} x={118} y={20} s={3.3} />
    </>
  ),
};

/** One poster, sized by its box (16:9). */
export function HomeArt({ id }: { id: ArtId }) {
  return (
    <svg viewBox={VB} preserveAspectRatio="xMidYMid slice" className="hm-art-svg" aria-hidden="true">
      {SCENES[id]()}
    </svg>
  );
}
