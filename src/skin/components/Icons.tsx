/** Small voxel-style icons drawn as crisp SVG rectangles (plan V3.1 Part 2.3: icons, not emoji). */

type P = { size?: number };
const R = (x: number, y: number, w: number, h: number, c: string, k: string) => <rect key={k} x={x} y={y} width={w} height={h} fill={c} />;

/** A hanging lantern: wood cap and foot, glow body in three bands, a hook. */
export function LanternIcon({ size = 36 }: P) {
  return (
    <svg viewBox="0 0 12 16" width={size * 0.75} height={size} aria-hidden="true" shapeRendering="crispEdges">
      {R(5, 0, 2, 2, 'var(--wood-ink)', 'hook')}
      {R(3, 2, 6, 2, 'var(--wood-dark)', 'cap')}
      {R(2, 4, 8, 8, 'var(--flame-dark)', 'body')}
      {R(3, 5, 6, 6, 'var(--flame-mid)', 'mid')}
      {R(4, 6, 4, 4, 'var(--flame-light)', 'core')}
      {R(3, 12, 6, 2, 'var(--wood-dark)', 'foot')}
      {R(5, 14, 2, 2, 'var(--wood-ink)', 'tip')}
    </svg>
  );
}

/** Three small lanterns on a string, with a day ticked off: the Daily Table. */
export function LanternStringIcon({ size = 36 }: P) {
  const lamp = (x: number, lit: boolean, k: string) => (
    <g key={k}>
      {R(x + 1, 2, 1, 2, 'var(--wood-ink)', k + 'h')}
      {R(x, 4, 3, 1, 'var(--wood-dark)', k + 'c')}
      {R(x, 5, 3, 4, lit ? 'var(--flame-mid)' : 'var(--paper-edge)', k + 'b')}
      {R(x + 1, 6, 1, 2, lit ? 'var(--flame-light)' : 'var(--mist)', k + 'g')}
      {R(x, 9, 3, 1, 'var(--wood-dark)', k + 'f')}
    </g>
  );
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} aria-hidden="true" shapeRendering="crispEdges">
      {R(0, 1, 16, 1, 'var(--wood-ink)', 'string')}
      {lamp(1, true, 'a')}
      {lamp(6, true, 'b')}
      {lamp(11, false, 'c')}
      {R(5, 12, 6, 4, 'var(--paper)', 'cal')}
      {R(5, 12, 6, 1, 'var(--coral-dark)', 'calTop')}
      {R(7, 14, 2, 1, 'var(--ink)', 'tick')}
    </svg>
  );
}

/** An open book: Practice. */
export function BookIcon({ size = 36 }: P) {
  return (
    <svg viewBox="0 0 16 12" width={size} height={size * 0.75} aria-hidden="true" shapeRendering="crispEdges">
      {R(0, 1, 16, 10, 'var(--wood-dark)', 'cover')}
      {R(1, 2, 6, 8, 'var(--paper)', 'left')}
      {R(9, 2, 6, 8, 'var(--paper)', 'right')}
      {R(7, 1, 2, 10, 'var(--wood-ink)', 'spine')}
      {R(2, 4, 4, 1, 'var(--ink-soft)', 'l1')}
      {R(2, 6, 4, 1, 'var(--ink-soft)', 'l2')}
      {R(10, 4, 4, 1, 'var(--ink-soft)', 'r1')}
      {R(10, 6, 3, 1, 'var(--ink-soft)', 'r2')}
    </svg>
  );
}

/** Difficulty chips: seedling, leaf, acorn. */
export function SeedlingIcon({ size = 16 }: P) {
  return (
    <svg viewBox="0 0 8 8" width={size} height={size} aria-hidden="true" shapeRendering="crispEdges">
      {R(3, 4, 2, 4, 'var(--sprout)', 'stem')}
      {R(0, 2, 3, 2, 'var(--cloth)', 'l')}
      {R(5, 1, 3, 2, 'var(--cloth)', 'r')}
      {R(2, 3, 1, 1, 'var(--sprout)', 'lj')}
      {R(5, 3, 1, 1, 'var(--sprout)', 'rj')}
    </svg>
  );
}
export function LeafIcon({ size = 16 }: P) {
  return (
    <svg viewBox="0 0 8 8" width={size} height={size} aria-hidden="true" shapeRendering="crispEdges">
      {R(2, 0, 4, 1, 'var(--cloth)', 'a')}
      {R(1, 1, 6, 4, 'var(--cloth)', 'b')}
      {R(2, 5, 4, 1, 'var(--cloth)', 'c')}
      {R(3, 1, 1, 6, 'var(--cloth-dark)', 'vein')}
      {R(3, 7, 1, 1, 'var(--sprout)', 'stem')}
    </svg>
  );
}
export function AcornIcon({ size = 16 }: P) {
  return (
    <svg viewBox="0 0 8 8" width={size} height={size} aria-hidden="true" shapeRendering="crispEdges">
      {R(3, 0, 2, 1, 'var(--wood-ink)', 'stalk')}
      {R(1, 1, 6, 2, 'var(--wood-dark)', 'cap')}
      {R(2, 3, 4, 3, 'var(--wood)', 'nut')}
      {R(3, 6, 2, 1, 'var(--wood)', 'tip')}
    </svg>
  );
}

/** Screen-corner controls. */
export function GearIcon({ size = 20 }: P) {
  return (
    <svg viewBox="0 0 10 10" width={size} height={size} aria-hidden="true" shapeRendering="crispEdges">
      {R(4, 0, 2, 10, 'currentColor', 'v')}
      {R(0, 4, 10, 2, 'currentColor', 'h')}
      {R(1, 1, 2, 2, 'currentColor', 'a')}
      {R(7, 1, 2, 2, 'currentColor', 'b')}
      {R(1, 7, 2, 2, 'currentColor', 'c')}
      {R(7, 7, 2, 2, 'currentColor', 'd')}
      {R(2, 2, 6, 6, 'currentColor', 'ring')}
      {R(4, 4, 2, 2, 'var(--paper)', 'hole')}
    </svg>
  );
}
export function SpeakerIcon({ size = 20, muted = false }: P & { muted?: boolean }) {
  return (
    <svg viewBox="0 0 10 10" width={size} height={size} aria-hidden="true" shapeRendering="crispEdges">
      {R(0, 3, 2, 4, 'currentColor', 'base')}
      {R(2, 2, 2, 6, 'currentColor', 'cone')}
      {R(4, 1, 1, 8, 'currentColor', 'rim')}
      {muted ? (
        <>
          {R(6, 2, 1, 1, 'currentColor', 'x1')}{R(7, 3, 1, 1, 'currentColor', 'x2')}{R(8, 4, 1, 1, 'currentColor', 'x3')}
          {R(8, 2, 1, 1, 'currentColor', 'y1')}{R(6, 4, 1, 1, 'currentColor', 'y3')}
        </>
      ) : (
        <>
          {R(6, 3, 1, 4, 'currentColor', 'w1')}
          {R(8, 2, 1, 6, 'currentColor', 'w2')}
        </>
      )}
    </svg>
  );
}
export function HelpIcon({ size = 20 }: P) {
  return (
    <svg viewBox="0 0 10 10" width={size} height={size} aria-hidden="true" shapeRendering="crispEdges">
      {R(2, 1, 6, 1, 'currentColor', 'a')}
      {R(1, 2, 2, 2, 'currentColor', 'b')}
      {R(7, 2, 2, 2, 'currentColor', 'c')}
      {R(5, 4, 2, 1, 'currentColor', 'd')}
      {R(4, 5, 2, 2, 'currentColor', 'e')}
      {R(4, 8, 2, 2, 'currentColor', 'f')}
    </svg>
  );
}

// ---------- More pixel icons, so no emoji is ever needed (all 10 x 10, currentColor unless noted). ----------
const px = (cells: string, color = 'currentColor') =>
  cells.trim().split('\n').flatMap((row, y) => [...row.trim()].map((ch, x) => (ch === '#' ? R(x, y, 1, 1, color, `${x}-${y}`) : null)));
function Pixel({ size = 20, rows, color, title }: P & { rows: string; color?: string; title?: string }) {
  return (
    <svg viewBox="0 0 10 10" width={size} height={size} aria-hidden={title ? undefined : true} role={title ? 'img' : undefined} aria-label={title} shapeRendering="crispEdges">
      {px(rows, color)}
    </svg>
  );
}
/** A list of words: the chain history. */
export const ChainIcon = (p: P) => <Pixel {...p} rows={`
..........
##.#######
..........
##.#######
..........
##.#####..
..........
##.######.
..........
..........`} />;
export const CloseIcon = (p: P) => <Pixel {...p} rows={`
..........
.##....##.
..##..##..
...####...
....##....
...####...
..##..##..
.##....##.
..........
..........`} />;
export const ChatIcon = (p: P) => <Pixel {...p} rows={`
..........
.########.
#........#
#.##.##..#
#........#
.########.
..##......
..#.......
..........
..........`} />;
/** Twist signs: no E, six or more, a double letter, a faster round. */
export const NoEIcon = (p: P) => <Pixel {...p} rows={`
.########.
##.....###
#.####.#.#
#.#...#..#
#.###.#..#
#.#.#....#
#.##.###.#
###......#
.########.
..........`} />;
export const RulerIcon = (p: P) => <Pixel {...p} rows={`
..........
..........
##########
#.#.#.#.##
#.#.#.#.##
#.......##
##########
..........
..........
..........`} />;
export const DoubleIcon = (p: P) => <Pixel {...p} rows={`
..........
.#....#...
.#....#...
.#....#...
.#....#...
.#....#...
.####.####
..........
..........
..........`} />;
export const ClockIcon = (p: P) => <Pixel {...p} rows={`
...####...
.##....##.
.#..#...#.
#...#....#
#...###..#
#........#
.#......#.
.##....##.
...####...
..........`} />;
/** A padlock, for the admin lock by the avatar. */
export const LockIcon = ({ size = 16 }: P) => (
  <svg viewBox="0 0 10 10" width={size} height={size} aria-hidden="true" shapeRendering="crispEdges">
    {px(`
...####...
..##..##..
..##..##..
..##..##..
.########.
.########.
.###..###.
.###..###.
.########.
.########.`)}
  </svg>
);
export const FlameIcon = ({ size = 16 }: P) => (
  <svg viewBox="0 0 10 10" width={size} height={size} aria-hidden="true" shapeRendering="crispEdges">
    {px(`
....#.....
...##.....
...###....
..####.#..
..######..
.########.
.###..###.
.##....##.
..##..##..
...####...`, 'var(--flame-dark)')}
    {px(`
..........
..........
..........
..........
....#.....
...###....
...####...
..##..##..
...#..#...
..........`, 'var(--flame-light)')}
  </svg>
);
export const CoinIcon = ({ size = 16 }: P) => (
  <svg viewBox="0 0 10 10" width={size} height={size} aria-hidden="true" shapeRendering="crispEdges">
    {px(`
...####...
..######..
.########.
.########.
.########.
.########.
.########.
..######..
...####...
..........`, 'var(--amber)')}
    {px(`
..........
..........
....##....
...#......
...#......
...#......
....##....
..........
..........
..........`, 'var(--wood-ink)')}
  </svg>
);
export const FriendsIcon = (p: P) => <Pixel {...p} rows={`
..........
.##....##.
.##....##.
..........
####..####
####..####
####..####
..........
..........
..........`} />;
export const TrophyIcon = (p: P) => <Pixel {...p} rows={`
.########.
##.####.##
#..####..#
.#.####.#.
...####...
....##....
....##....
...####...
..######..
..........`} />;
export const BagIcon = (p: P) => <Pixel {...p} rows={`
...####...
..#....#..
..#....#..
.########.
.########.
.########.
.########.
.########.
..######..
..........`} />;
export const CheckIcon = (p: P) => <Pixel {...p} rows={`
..........
.........#
........##
.......##.
#.....##..
##...##...
.##.##....
..###.....
...#......
..........`} />;
export const ResetIcon = (p: P) => <Pixel {...p} rows={`
..#####...
.#.....#..
#.......#.
#.......#.
#....#..#.
.#..###...
..#######.
.....#....
..........
..........`} />;
export const ArrowUpIcon = (p: P) => <Pixel {...p} rows={`
..........
....##....
...####...
..######..
.###..###.
.##....##.
..........
..........
..........
..........`} />;
export const ArrowDownIcon = (p: P) => <Pixel {...p} rows={`
..........
..........
..........
.##....##.
.###..###.
..######..
...####...
....##....
..........
..........`} />;
export const PlayIcon = (p: P) => <Pixel {...p} rows={`
.##.......
.####.....
.######...
.########.
.######...
.####.....
.##.......
..........
..........
..........`} />;
export const SnowflakeIcon = (p: P) => <Pixel {...p} rows={`
....#.....
.#..#..#..
..#.#.#...
...###....
#########.
...###....
..#.#.#...
.#..#..#..
....#.....
..........`} />;
export const GustIcon = (p: P) => <Pixel {...p} rows={`
..........
......##..
#######..#
.......##.
..........
#########.
.........#
......###.
..........
..........`} />;
/** A crescent moon with a star: Counting Sheep. */
export const MoonIcon = ({ size = 20 }: P) => (
  <svg viewBox="0 0 10 10" width={size} height={size} aria-hidden="true" shapeRendering="crispEdges">
    {px(`
..###.....
.##.......
##........
##........
##........
##.....#..
.##...##..
..######..
...####...
..........`, 'var(--glow)')}
    {px(`
......#...
.....###..
......#...
..........
..........
..........
..........
..........
..........
..........`, '#FFF4DC')}
  </svg>
);

/** A folded blanket (V4 Part 8): the Warm Blanket that keeps a streak warm. Hollow when not held. */
export function BlanketIcon({ size = 16, held = true }: P & { held?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" shapeRendering="crispEdges" role="img" aria-label={held ? 'Warm Blanket' : 'No blanket'}>
      <rect x="2" y="4" width="12" height="9" rx="1" fill={held ? '#D99B95' : 'none'} stroke="#8C5A2E" strokeWidth="1.5" />
      {held && <rect x="2" y="7" width="12" height="2" fill="#F3E9D2" />}
      {held && <rect x="2" y="10" width="12" height="1" fill="#8E7CC3" />}
    </svg>
  );
}
/** Share: a sheet with an arrow leaving it (V6 Part 4.11). */
export const ShareIcon = (p: P) => <Pixel {...p} rows={`
....##....
...####...
..#.##.#..
....##....
....##....
##..##..##
##......##
##......##
##########
##########`} />;
/** A brass drawing pin (V6 Part 4.11). */
export const PinIcon = (p: P) => <Pixel {...p} rows={`
...####...
..######..
..######..
...####...
.########.
..######..
....##....
....##....
....#.....
....#.....`} />;
