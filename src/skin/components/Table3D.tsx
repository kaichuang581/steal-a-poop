import { Billboard, Html, Text3D } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { Suspense, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import { Vector3 } from 'three';
import type { Mesh, PointLight } from 'three';
import type { CreatureId } from '../model/types';

// three's npm package does not ship its example fonts, so the pile count's typeface comes from the three.js repo.
const FONT = 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r187/examples/fonts/helvetiker_bold.typeface.json';
const TABLE_R = 3;
const SEAT_R = 3.7;

/** Reads a colour token from the painted skin so the 3D materials use the same palette as the interface. */
function token(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export interface Seat3D {
  seat: number;
  /** Position around the table: 0 is the local player, counting the direction of play. */
  index: number;
  creature: CreatureId;
  active: boolean;
  dimmed: boolean;
  label: ReactNode;
}

interface Props {
  seats: Seat3D[];
  pile: number;
  /** Index (as in Seat3D.index) the camera frames, or null for the wide shot. */
  focus: number | null;
  frozen: boolean;
  reduced: boolean;
}

function seatDir(i: number, n: number): Vector3 {
  const a = (i * 2 * Math.PI) / n;
  return new Vector3(Math.sin(a), 0, Math.cos(a));
}

/**
 * The 3D table in painted colours, drawn over the painted Scene (transparent background). The pile is a paper lantern
 * that grows and glows with the points it holds, with its count standing above it in 3D.
 */
export function Table3D({ seats, pile, focus, frozen, reduced }: Props) {
  const n = seats.length;
  const colors = useMemo(() => ({
    wood: token('--wood'), woodDark: token('--wood-dark'), cloth: token('--cloth-dark'), amber: token('--amber'),
    glow: token('--glow'), woodInk: token('--wood-ink'), ink: token('--ink'), keeper: token('--keeper'), paper: token('--paper'),
  }), []);
  return (
    <Canvas shadows dpr={[1, 2]} gl={{ alpha: true }} camera={{ fov: 45, position: [0, 6, SEAT_R + 4] }}>
      <ambientLight intensity={0.75} />
      <directionalLight position={[4, 9, 5]} intensity={1.4} castShadow shadow-mapSize={[1024, 1024]} />
      <CameraRig focus={focus} n={n} reduced={reduced} />
      <group>
        <mesh position={[0, 0.85, 0]} receiveShadow>
          <cylinderGeometry args={[TABLE_R, TABLE_R, 0.12, 64]} />
          <meshStandardMaterial color={colors.wood} roughness={0.8} />
        </mesh>
        <mesh position={[0, 0.915, 0]} receiveShadow>
          <cylinderGeometry args={[TABLE_R * 0.78, TABLE_R * 0.78, 0.02, 64]} />
          <meshStandardMaterial color={colors.cloth} roughness={1} />
        </mesh>
        <mesh position={[0, 0.9, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <torusGeometry args={[TABLE_R, 0.14, 20, 96]} />
          <meshStandardMaterial color={colors.woodDark} roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.4, 0]} castShadow>
          <cylinderGeometry args={[0.45, 0.8, 0.8, 32]} />
          <meshStandardMaterial color={colors.woodDark} roughness={0.7} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <circleGeometry args={[9, 64]} />
          <shadowMaterial opacity={0.22} />
        </mesh>
      </group>
      <LanternPile pile={pile} frozen={frozen || reduced} colors={colors} />
      {seats.map((s) => (
        <Creature3D key={s.seat} seat={s} dir={seatDir(s.index, n)} colors={colors} />
      ))}
    </Canvas>
  );
}

/** Frames whoever's turn it is from across the table, or pulls back behind your seat between turns. */
function CameraRig({ focus, n, reduced }: { focus: number | null; n: number; reduced: boolean }) {
  const look = useRef(new Vector3());
  useFrame(({ camera }, dt) => {
    const pos = new Vector3();
    const target = new Vector3();
    if (focus === null) {
      pos.set(0, 6, SEAT_R + 4);
      target.set(0, 0.6, 0);
    } else {
      const d = seatDir(focus, n);
      pos.copy(d).multiplyScalar(-2.6).setY(4.2);
      target.copy(d).multiplyScalar(1.8).setY(2.4);
    }
    const k = reduced ? 1 : 1 - Math.exp(-dt * 3);
    camera.position.lerp(pos, k);
    look.current.lerp(target, k);
    camera.lookAt(look.current);
  });
  return null;
}

function LanternPile({ pile, frozen, colors }: { pile: number; frozen: boolean; colors: Record<string, string> }) {
  const body = useRef<Mesh>(null);
  const light = useRef<PointLight>(null);
  // Width grows with points (capped at 80), like the 2D lantern: 72 + min(80, points) × 1.1 px, in table units.
  const scale = (72 + Math.min(80, pile) * 1.1) / 160;
  const steps = Math.floor(pile / 10);
  useFrame(({ clock }) => {
    if (!body.current || !light.current) return;
    const t = clock.elapsedTime;
    const s = body.current.scale.x + (scale - body.current.scale.x) * 0.12; // spring-ish growth
    body.current.scale.setScalar(s);
    // The flame flickers faster at each 10-point step; it holds still in the steal window and with reduced motion.
    const flicker = frozen ? 0 : Math.sin(t * (6 + steps * 2)) * 0.12 + Math.sin(t * 13.7) * 0.06;
    light.current.intensity = (2 + Math.min(80, pile) * 0.12) * (1 + flicker);
  });
  return (
    <group position={[0, 0.92, 0]}>
      <mesh ref={body} position={[0, 0.45, 0]} castShadow>
        <sphereGeometry args={[0.42, 32, 24]} />
        <meshStandardMaterial color={pile > 0 ? colors.amber : colors.paper} emissive={colors.glow} emissiveIntensity={pile > 0 ? 0.35 + Math.min(80, pile) / 160 : 0.05} roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.22, 0.26, 0.06, 24]} />
        <meshStandardMaterial color={colors.woodDark} />
      </mesh>
      <pointLight ref={light} position={[0, 0.6, 0]} color={colors.glow} distance={6} />
      <Suspense fallback={null}>
        <Billboard position={[0, 1.25, 0]}>
          <Text3D font={FONT} size={0.3} height={0.08} bevelEnabled bevelSize={0.015} bevelThickness={0.02} position={[-0.11 * String(pile).length, 0, 0]}>
            {String(pile)}
            <meshStandardMaterial color={colors.woodInk} />
          </Text3D>
        </Billboard>
      </Suspense>
      <Html position={[0, -0.05, 0.75]} center>
        <div className="sk-hand pointer-events-none text-sm" style={{ color: 'var(--button-text)', textShadow: '0 1px 2px var(--ink)' }} data-pile data-tour="pile" aria-label={`Pile ${pile} points`}>
          the pile
        </div>
      </Html>
    </group>
  );
}

/** A round creature: body, head with ears or not, dot eyes, two paws on the table rim. */
function Creature3D({ seat, dir, colors }: { seat: Seat3D; dir: Vector3; colors: Record<string, string> }) {
  const color = useMemo(() => token(`--creature-${seat.creature}`), [seat.creature]);
  const pos = dir.clone().multiplyScalar(SEAT_R);
  const ears = seat.creature === 'pip' || seat.creature === 'juniper' || seat.creature === 'quill';
  return (
    <group position={pos} rotation={[0, Math.atan2(dir.x, dir.z), 0]}>
      <mesh position={[0, 1.2, 0]} castShadow>
        <sphereGeometry args={[0.48, 32, 24]} />
        <meshStandardMaterial color={color} emissive={colors.glow} emissiveIntensity={seat.active ? 0.12 : 0} roughness={0.8} transparent opacity={seat.dimmed ? 0.55 : 1} />
      </mesh>
      <mesh position={[0, 1.88, 0]} castShadow>
        <sphereGeometry args={[0.32, 32, 24]} />
        <meshStandardMaterial color={color} roughness={0.8} transparent opacity={seat.dimmed ? 0.55 : 1} />
      </mesh>
      {ears && [-0.22, 0.22].map((x) => (
        <mesh key={x} position={[x, 2.2, 0]} scale={[0.6, 1.3, 0.6]} castShadow>
          <sphereGeometry args={[0.14, 16, 12]} />
          <meshStandardMaterial color={color} roughness={0.8} />
        </mesh>
      ))}
      {[-0.15, 0.15].map((x) => (
        <mesh key={x} position={[x, 1.93, -0.29]}>
          <sphereGeometry args={[0.04, 12, 10]} />
          <meshStandardMaterial color={colors.ink} />
        </mesh>
      ))}
      {[-0.3, 0.3].map((x) => (
        <mesh key={x} position={[x, 1.08, -0.55]} castShadow>
          <sphereGeometry args={[0.11, 20, 16]} />
          <meshStandardMaterial color={colors.keeper} roughness={0.8} />
        </mesh>
      ))}
      <Html position={[0, 2.65, 0]} center zIndexRange={[20, 0]}>{seat.label}</Html>
    </group>
  );
}
