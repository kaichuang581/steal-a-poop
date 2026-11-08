import { useFrame } from '@react-three/fiber';
import { createRef, useMemo, useRef } from 'react';
import type { ReactNode, RefObject } from 'react';
import { Vector3 } from 'three';
import type { Group } from 'three';

const clamp = (v: number, a: number, b: number) => Math.min(Math.max(v, a), b);

/**
 * Pins an HTML element (a seat's name plate and speech bubble) to this point in the scene every frame: centred on it,
 * or with `above` standing on it (its bottom centre there, kept below the top bar), hidden behind the camera, nearer
 * ones over farther ones. Used instead of drei's Html, whose first-mounted root came up empty under React 19's double
 * mount (the speaker's own slip never showed).
 */
export function ScreenAnchor({ el, position, above = false }: { el: RefObject<HTMLDivElement | null>; position: readonly [number, number, number]; above?: boolean }) {
  const g = useRef<Group>(null);
  const v = useMemo(() => new Vector3(), []);
  useFrame(({ camera, size }) => {
    const node = el.current;
    if (!node || !g.current) return;
    g.current.getWorldPosition(v).project(camera);
    // Behind the camera, or (for a name over a head) a sheep that is off the frame's side: hidden, not pinned to the edge.
    const hidden = v.z > 1 || (above && Math.abs(v.x) > 1.02);
    if (hidden !== (node.style.display === 'none')) node.style.display = hidden ? 'none' : '';
    if (hidden) return;
    // Kept inside the frame's sides, so a sheep at the edge still shows its whole name.
    const half = node.offsetWidth / 2 + 4;
    const px = clamp(((v.x + 1) / 2) * size.width, half, Math.max(half, size.width - half));
    const top = above ? node.offsetHeight + 64 : 0;
    const py = Math.max(top, ((1 - v.y) / 2) * size.height);
    node.style.transform = `translate3d(${px.toFixed(1)}px, ${py.toFixed(1)}px, 0) translate(-50%, ${above ? '-100%' : '-50%'})`;
    node.style.zIndex = String(Math.round((1 - v.z) * 10000));
  });
  return <group ref={g} position={[position[0], position[1], position[2]]} />;
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

/** The seats' name plates, laid over the canvas; each is moved over its sheep's head by a `ScreenAnchor` in the scene. */
export function SlipLayer({ seats, refFor }: { seats: { seat: number; label: ReactNode }[]; refFor: (seat: number) => RefObject<HTMLDivElement | null> }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-[20] overflow-hidden">
      {seats.map((s) => <div key={s.seat} ref={refFor(s.seat)} className="absolute left-0 top-0" style={{ transform: 'translate3d(-9999px,0,0)' }}>{s.label}</div>)}
    </div>
  );
}
