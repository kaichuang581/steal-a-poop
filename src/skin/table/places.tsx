import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { Color, MeshLambertMaterial } from 'three';
import { withRoundedEdges } from '../voxel/rounded';
import type { Group, Mesh } from 'three';
import type { Mode } from '../model/types';
import { BARN, YARD } from '../scene/layout';
import { sheepdogModel } from '../voxel/characters';
import { buildGeometry } from '../voxel/mesher';
import { lin, pick, T } from '../voxel/palette';
import { box, Grid, hash3 } from '../voxel/primitives';
import { SantaHat } from './Sheep';

/**
 * What each mode adds to the barn (plan V3 Milestone 6): the Daily Table's streak lanterns on the fence posts behind the
 * barn and the sheepdog guide in the Tutorial. Practice is not in the barn at all (DuelTable). Rooms is the same barn at night (the caller
 * pins the hour).
 */
export function PlaceExtras({ mode, reduced, streak }: { mode: Mode; reduced: boolean; streak?: boolean[] }) {
  if (mode === 'daily' && streak) return <StreakPosts days={streak} />;
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
  const lit = useMemo(() => withRoundedEdges(new MeshLambertMaterial({ vertexColors: true, emissive: new Color(T.lantern[1]), emissiveIntensity: 0.9 })), []);
  const dark = useMemo(() => withRoundedEdges(new MeshLambertMaterial({ vertexColors: true, color: '#7A7A80' })), []);
  return (
    <group>
      {days.map((on, i) => <mesh key={i} geometry={geo} material={on ? lit : dark} position={[POSTS[i], 1.25, YARD.fence.z]} />)}
    </group>
  );
}

/** The tutorial's guide: a sheepdog sitting by the back door, wagging, pointing at the heap with its nose. */
function Sheepdog({ reduced }: { reduced: boolean }) {
  const m = useMemo(() => sheepdogModel(), []);
  const mat = useMemo(() => withRoundedEdges(new MeshLambertMaterial({ vertexColors: true })), []);
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
      <mesh ref={head} geometry={m.head.geo} position={m.head.pivot} material={mat} castShadow><SantaHat parts={[m.head.geo]} material={mat} /></mesh>
      <mesh ref={tail} geometry={m.tail.geo} position={m.tail.pivot} material={mat} castShadow />
      {m.ears.map((p, i) => <mesh key={i} geometry={p.geo} position={p.pivot} material={mat} />)}
      {m.legs.map((p, i) => <mesh key={i} geometry={p.geo} position={p.pivot} material={mat} castShadow />)}
    </group>
  );
}
