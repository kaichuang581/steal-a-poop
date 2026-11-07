import { useFrame } from '@react-three/fiber';
import { createRef, useMemo, useRef } from 'react';
import type { ReactNode, RefObject } from 'react';
import { Vector3 } from 'three';
import type { Group } from 'three';
import { Slate, Tile } from '../kit';

/**
 * The seconds under the carved letter board (V6 Part 5.2): a mini chalk slate hung from the board's bottom edge on two
 * strings, coral in the steal window. The board carries the letter; when the camera loses the board (a close-up), the
 * slate waits at the frame's edge and carries the letter too, on a mini tile, so it is never off screen. It is the
 * chain tile the tour points at.
 */
export function LetterClock({ letter, isTrap, secondsLeft, stealOpen, pop }: { letter: string; isTrap: boolean; secondsLeft: number | null; stealOpen: boolean; pop: boolean }) {
  const L = letter.toUpperCase();
  const s = secondsLeft === null ? '' : secondsLeft < 5 ? Math.max(0, secondsLeft).toFixed(1) : String(Math.ceil(secondsLeft));
  return (
    <div className={`sk-clock ${pop ? 'sk-clock-pop' : ''}`} data-chain-tile data-tour="chain" aria-label={`Required starting letter ${L}${isTrap ? ', a trap letter' : ''}`}>
      <span className="kit-string" /><span className="kit-string" />
      <Slate size="mini" tone={stealOpen ? 'coral' : 'chalk'}>
        <Tile size="mini" trap={isTrap} className="sk-clock-letter">{L}</Tile>
        {s && <span aria-label={`${s} seconds left`}>{s}</span>}
      </Slate>
    </div>
  );
}

const clamp = (v: number, a: number, b: number) => Math.min(Math.max(v, a), b);

/**
 * Pins an HTML element (a stake's slips) to this point in the scene: centred on its screen position every frame,
 * hidden behind the camera, nearer slips over farther ones. Used instead of drei's Html, whose first-mounted root
 * came up empty under React 19's double mount (the speaker's own slip never showed).
 */
export function ScreenAnchor({ el, position }: { el: RefObject<HTMLDivElement | null>; position: readonly [number, number, number] }) {
  const g = useRef<Group>(null);
  const v = useMemo(() => new Vector3(), []);
  useFrame(({ camera, size }) => {
    const node = el.current;
    if (!node || !g.current) return;
    g.current.getWorldPosition(v).project(camera);
    const hidden = v.z > 1;
    if (hidden !== (node.style.display === 'none')) node.style.display = hidden ? 'none' : '';
    if (hidden) return;
    // Kept inside the frame's sides, so a stake at the edge still shows its whole name.
    const half = node.offsetWidth / 2 + 4;
    const px = clamp(((v.x + 1) / 2) * size.width, half, Math.max(half, size.width - half));
    node.style.transform = `translate3d(${px.toFixed(1)}px, ${(((1 - v.y) / 2) * size.height).toFixed(1)}px, 0) translate(-50%, -50%)`;
    node.style.zIndex = String(Math.round((1 - v.z) * 10000));
  });
  return <group ref={g} position={[position[0], position[1], position[2]]} />;
}

/**
 * Moves `el` every frame to the screen point under `at` (its top centre there), kept inside the frame above the word
 * bar. `board` is the letter's centre: when that leaves the frame `el` gets `data-off`, so the slate shows the letter.
 */
export function ProjectAnchor({ el, at, board, margin }: { el: RefObject<HTMLDivElement | null>; at: readonly [number, number, number]; board: readonly [number, number, number]; margin: number }) {
  const v = useMemo(() => new Vector3(), []);
  useFrame(({ camera, size }) => {
    const node = el.current;
    if (!node) return;
    v.set(board[0], board[1], board[2]).project(camera);
    const off = v.z > 1 || Math.abs(v.x) > 0.98 || v.y > 0.94;
    v.set(at[0], at[1], at[2]).project(camera);
    let px = ((v.x + 1) / 2) * size.width;
    let py = ((1 - v.y) / 2) * size.height;
    if (v.z > 1) { px = size.width / 2; py = 90; }
    px = clamp(px, 70, size.width - 70);
    py = clamp(py, 70, size.height - margin - 60);
    node.style.transform = `translate3d(${px.toFixed(1)}px, ${py.toFixed(1)}px, 0) translate(-50%, 0)`;
    if (off !== node.hasAttribute('data-off')) node.toggleAttribute('data-off', off);
  });
  return null;
}

/** One stable ref per seat, for the slips' DOM elements that `ScreenAnchor` moves. */
export function useSlipRefs(): (seat: number) => RefObject<HTMLDivElement | null> {
  const m = useRef(new Map<number, RefObject<HTMLDivElement | null>>());
  return (seat) => {
    let r = m.current.get(seat);
    if (!r) m.current.set(seat, (r = createRef<HTMLDivElement>()));
    return r;
  };
}

/** The stakes' slips, laid over the canvas; each is moved onto its stake by a `ScreenAnchor` in the scene. */
export function SlipLayer({ seats, refFor }: { seats: { seat: number; label: ReactNode }[]; refFor: (seat: number) => RefObject<HTMLDivElement | null> }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-[20] overflow-hidden">
      {seats.map((s) => <div key={s.seat} ref={refFor(s.seat)} className="absolute left-0 top-0" style={{ transform: 'translate3d(-9999px,0,0)' }}>{s.label}</div>)}
    </div>
  );
}
