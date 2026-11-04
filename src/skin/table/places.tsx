import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { Color, MeshLambertMaterial } from 'three';
import type { Group, Mesh } from 'three';
import type { Mode } from '../model/types';
import { BARN, YARD } from '../scene/layout';
import { sheepdogModel } from '../voxel/characters';
import { buildGeometry } from '../voxel/mesher';
import { lin, pick, T } from '../voxel/palette';
import { box, Grid, hash3 } from '../voxel/primitives';

/**
 * What each mode adds to the barn (plan V3 Milestone 6): the Daily Table's streak lanterns on the fence posts behind the
 * barn, the lambing pens in Practice, the sheepdog guide in the Tutorial. Rooms is the same barn at night (the caller
 * pins the hour).
 */
export function PlaceExtras({ mode, reduced, streak }: { mode: Mode; reduced: boolean; streak?: boolean[] }) {
  if (mode === 'daily' && streak) return <StreakPosts days={streak} />;
  if (mode === 'practice') return <LambingPens />;
  if (mode === 'tutorial') return <Sheepdog reduced={reduced} />;
  return null;
}

let lanternGeo: ReturnType<typeof buildGeometry> | null = null;
function smallLantern() {
  if (lanternGeo) return lanternGeo;
  const g = new Grid(0.1);
  box(g, [-0.1, 0, -0.1], [0.1, 0.3, 0.1], (x, y, z) => pick(T.lantern, hash3(x, y, z, 81)));
  box(g, [-0.15, 0.3, -0.15], [0.15, 0.4, 0.15], () => lin(T.beam[2]));
  box(g, [-0.15, -0.1, -0.15], [0.15, 0, 0.15], () => lin(T.beam[2]));
  lanternGeo = buildGeometry(g.map, 0.1);
  return lanternGeo;
}

/** Fence posts either side of the gate (x = 0), so the lanterns never sit in the gateway. */
const POSTS = [-8.4, -6.2, -4, -2, 2, 4, 6.2];

/** Seven lanterns on the fence posts behind the barn, lit for each of the last seven days played; today is last. */
function StreakPosts({ days }: { days: boolean[] }) {
  const geo = smallLantern();
  const lit = useMemo(() => new MeshLambertMaterial({ vertexColors: true, emissive: new Color(T.lantern[1]), emissiveIntensity: 0.9 }), []);
  const dark = useMemo(() => new MeshLambertMaterial({ vertexColors: true, color: '#7A7A80' }), []);
  return (
    <group>
      {days.map((on, i) => <mesh key={i} geometry={geo} material={on ? lit : dark} position={[POSTS[i], 1.25, YARD.fence.z]} />)}
    </group>
  );
}

let pensGeo: ReturnType<typeof buildGeometry> | null = null;
/** Low wooden hurdles and straw along the side walls: the lambing shed. */
function LambingPens() {
  const geo = useMemo(() => {
    if (pensGeo) return pensGeo;
    const g = new Grid(0.1);
    for (const side of [-1, 1]) {
      const x0 = side < 0 ? BARN.minX + 0.3 : BARN.maxX - 1.6;
      for (let z = -1; z <= 5; z += 2) {
        box(g, [x0, 0, z], [x0 + 1.3, 0.8, z + 0.1], (x, y, zz) => (y % 3 === 2 ? pick(T.beam, hash3(x, y, zz, 83)) : null));
        box(g, [x0, 0, z], [x0 + 0.1, 0.8, z + 0.1], () => lin(T.beam[2]));
        box(g, [x0, 0, z + 0.2], [x0 + 1.3, 0.1, z + 1.8], (x, y, zz) => pick(T.hay, hash3(x, y, zz, 85)));
      }
    }
    pensGeo = buildGeometry(g.map, 0.1);
    return pensGeo;
  }, []);
  const mat = useMemo(() => new MeshLambertMaterial({ vertexColors: true }), []);
  return <mesh geometry={geo} material={mat} castShadow receiveShadow />;
}

/** The tutorial's guide: a sheepdog sitting by the back door, wagging, pointing at the heap with its nose. */
function Sheepdog({ reduced }: { reduced: boolean }) {
  const m = useMemo(() => sheepdogModel(), []);
  const mat = useMemo(() => new MeshLambertMaterial({ vertexColors: true }), []);
  const tail = useRef<Mesh>(null);
  const head = useRef<Mesh>(null);
  const root = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (reduced) return;
    const t = clock.elapsedTime;
    if (tail.current) tail.current.rotation.y = Math.sin(t * 9) * 0.5;
    if (head.current) head.current.rotation.x = 0.15 + Math.sin(t * 0.7) * 0.05;
  });
  return (
    <group ref={root} position={[2.6, 0, BARN.maxZ - 1.2]} rotation={[0, Math.PI + 0.6, 0]}>
      <mesh geometry={m.body.geo} position={m.body.pivot} material={mat} castShadow />
      <mesh ref={head} geometry={m.head.geo} position={m.head.pivot} material={mat} castShadow />
      <mesh ref={tail} geometry={m.tail.geo} position={m.tail.pivot} material={mat} castShadow />
      {m.ears.map((p, i) => <mesh key={i} geometry={p.geo} position={p.pivot} material={mat} />)}
      {m.legs.map((p, i) => <mesh key={i} geometry={p.geo} position={p.pivot} material={mat} castShadow />)}
    </group>
  );
}
