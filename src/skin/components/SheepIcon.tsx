/** A 12 x 10 pixel sheep for cards and the tally, the same for every player (every sheep is the default sheep). */
export function SheepIcon({ size = 28, bare = false }: { size?: number; bare?: boolean }) {
  const px = (x: number, y: number, w: number, h: number, c: string) => <rect key={`${x}-${y}-${c}`} x={x} y={y} width={w} height={h} fill={c} />;
  return (
    <svg viewBox="0 0 12 10" width={size} height={size * (10 / 12)} aria-hidden="true" shapeRendering="crispEdges">
      {bare ? (
        <>
          {px(3, 3, 7, 4, 'var(--sheep-skin)')}
        </>
      ) : (
        <>
          {px(2, 2, 9, 1, 'var(--sheep-wool-dark)')}
          {px(1, 3, 10, 4, 'var(--sheep-wool)')}
          {px(2, 7, 9, 1, 'var(--sheep-wool-dark)')}
          {px(3, 1, 2, 1, 'var(--sheep-wool)')}
          {px(6, 1, 2, 1, 'var(--sheep-wool)')}
        </>
      )}
      {px(8, 3, 3, 4, 'var(--sheep-face)')}
      {px(9, 4, 1, 1, 'var(--paper)')}
      {px(11, 5, 1, 1, 'var(--sheep-nose)')}
      {px(3, 7, 1, 3, 'var(--sheep-face)')}
      {px(5, 7, 1, 3, 'var(--sheep-face)')}
      {px(7, 7, 1, 3, 'var(--sheep-face)')}
      {px(9, 7, 1, 3, 'var(--sheep-face)')}
    </svg>
  );
}
