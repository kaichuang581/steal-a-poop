import { useId } from 'react';

/**
 * A cap of settled snow for the top of a sign or tile: a lumpy, rounded top, soft overhangs that droop over the edge,
 * cool blue shading underneath, a few glints, and (on the wide cap) little icicles. Stretches to its box, so the
 * same cap fits a plank, a tile and the Play sign.
 */
export function SnowCap({ className, variant = 'wide' }: { className?: string; variant?: 'wide' | 'small' }) {
  const id = useId().replace(/:/g, '');
  const wide = variant === 'wide';
  const vb = wide ? '0 0 120 26' : '0 0 40 18';
  const body = wide
    ? 'M1,14 C1,8 7,5 13,7 C17,2 27,1 33,5 C39,1 51,1 56,6 C62,2 74,2 79,6 C85,1 97,2 101,6 C107,3 117,5 119,12 C120,15 118,17 115,16 ' +
      'C111,16 108,16 104,16 C102,16 101,22 97,22 C93,22 93,16 90,16 L62,16 C60,16 60,19 57,19 C54,19 54,16 52,16 L28,16 ' +
      'C26,16 26,23 22,23 C18,23 18,16 15,16 C10,16 6,17 3,17 C1,17 1,16 1,14 Z'
    : 'M1,11 C1,6 5,3 9,5 C12,1 20,1 23,4 C27,1 35,2 37,6 C40,8 39,12 37,12 L30,12 C28,12 28,16 25,16 C22,16 22,12 20,12 ' +
      'L6,12 C3,12 1,13 1,11 Z';
  return (
    <svg className={className} viewBox={vb} preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}-g`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="0.5" stopColor="#F6FAFE" />
          <stop offset="0.82" stopColor="#D9E9F5" />
          <stop offset="1" stopColor="#B9D3E8" />
        </linearGradient>
      </defs>
      {/* A soft shadow the snow casts on the wood. */}
      <path d={body} transform="translate(0 2)" fill="rgba(40,30,60,0.22)" />
      {wide && (
        <g fill="#CFE8F7" stroke="#9ED2EE" strokeWidth="0.6" vectorEffect="non-scaling-stroke">
          <path d="M40,16 L42,24 L44,16 Z" />
          <path d="M68,16 L69.5,22 L71,16 Z" />
          <path d="M82,16 L84,26 L86,16 Z" />
          <path d="M8,16 L9.5,21 L11,16 Z" />
        </g>
      )}
      <path d={body} fill={`url(#${id}-g)`} stroke="#A9C7DF" strokeWidth="0.8" vectorEffect="non-scaling-stroke" />
      {/* Glints and a brighter crest along the top. */}
      <path d={wide ? 'M14,8 C18,4 26,3 31,6 M58,6 C63,3 71,3 76,6 M88,5 C94,3 102,4 106,7' : 'M7,6 C10,3 16,3 20,5'} fill="none" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <g fill="#BFDCF0">
        {(wide ? [[24, 10], [47, 9], [70, 11], [95, 10], [110, 12]] : [[12, 8], [28, 8]]).map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="0.9" />)}
      </g>
    </svg>
  );
}
