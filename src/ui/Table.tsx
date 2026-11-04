import { Billboard, Html, Text3D } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { AnimatePresence, motion } from 'framer-motion';
import { Component, Suspense, useRef } from 'react';
import type { ReactNode } from 'react';
import { Vector3 } from 'three';
// three's npm package does not ship its example fonts, so the pile count's typeface (from the three.js repo, licence
// alongside it) is served from public/fonts: the page's content security policy only lets it fetch from itself.
const FONT = `${import.meta.env.BASE_URL}fonts/helvetiker_bold.typeface.json`;
import type { Player } from '../engine';
import { inStealWindow } from '../engine';
import { useRoomStore } from '../state/roomStore';
import { useStore } from '../state/store';
import { ChainTile } from './ChainTile';
import { pileColor, relativeSeat } from './geometry';
import { Flights } from './Flights';
import { Seat } from './Seat';
import { useReduceMotion } from './useReduceMotion';

const TABLE_R = 3;
const SEAT_R = 3.7;

/** Unit direction from the table centre to seat i; seat 0 (you) faces the default camera and play runs counterclockwise. */
function seatDir(i: number, n: number): Vector3 {
  const a = (i * 2 * Math.PI) / n;
  return new Vector3(Math.sin(a), 0, Math.cos(a));
}

export function Table() {
  const game = useStore((s) => s.game)!;
  const stealOpen = useStore((s) => (s.game ? inStealWindow(s.game, s.now) : false));
  const mySeat = useStore((s) => s.mySeat);
  const room = useStore((s) => s.mode === 'room');
  const roomView = useRoomStore((s) => s.room);
  const n = game.players.length;
  // Who sits where, so a human's badge can be shown on their seat.
  const wearing = (seat: number) => {
    const uid = roomView && Object.keys(roomView.seatOf).find((u) => roomView.seatOf[u] === seat);
    return roomView?.members.find((m) => m.userId === uid)?.cosmetics;
  };
  const focus = game.turn ? relativeSeat(game.turn.seat, mySeat, n) : null;
  return (
    <div className="relative size-full" data-table>
      <Canvas shadows dpr={[1, 2]} camera={{ fov: 45, position: [0, 6, SEAT_R + 4] }}>
        <color attach="background" args={['#120a26']} />
        <ambientLight intensity={0.45} />
        <spotLight position={[0, 9, 0]} angle={0.75} penumbra={0.6} intensity={120} castShadow shadow-mapSize={[1024, 1024]} />
        <CameraRig focus={focus} n={n} />
        <TableModel />
        <PileStack pile={game.pile} />
        {game.players.map((p) => (
          <Character key={p.id} player={p} dir={seatDir(relativeSeat(p.id, mySeat, n), n)} active={game.turn?.seat === p.id}>
            <Seat player={p} turn={game.turn} mine={room && p.id === mySeat} cosmetics={room ? wearing(p.id) : undefined} />
          </Character>
        ))}
      </Canvas>
      <div className="pointer-events-none absolute inset-x-0 top-2 z-30 flex justify-center">
        <ChainTile letter={game.chainLetter} />
      </div>
      <AnimatePresence>
        {stealOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
            className="absolute left-1/2 top-[30%] z-10 -translate-x-1/2 rounded-full border-2 border-fuchsia-300 bg-fuchsia-600/90 px-3 py-1 text-xs font-black uppercase tracking-wider shadow-lg sm:text-sm"
            role="status"
          >
            {game.turn?.seat === mySeat ? '⚠ Others can steal!' : '⚡ Steal window'}
          </motion.div>
        )}
      </AnimatePresence>
      <Flights />
    </div>
  );
}

/**
 * With a turn running, the camera sits over the far side of the table looking at that player, so
 * you see their character with the pile in the foreground. Between turns it pulls back to a wide
 * shot from behind your own seat. Reduced motion cuts instead of gliding.
 */
function CameraRig({ focus, n }: { focus: number | null; n: number }) {
  const reduced = useReduceMotion();
  const look = useRef(new Vector3());
  const pos = new Vector3();
  const target = new Vector3();
  useFrame(({ camera }, dt) => {
    if (focus === null) {
      pos.set(0, 6, SEAT_R + 4);
      target.set(0, 0, 0);
    } else {
      const d = seatDir(focus, n);
      pos.copy(d).multiplyScalar(-2.6).setY(4.2);
      target.copy(d).multiplyScalar(1.8).setY(2.1);
    }
    const k = reduced ? 1 : 1 - Math.exp(-dt * 3);
    camera.position.lerp(pos, k);
    look.current.lerp(target, k);
    camera.lookAt(look.current);
  });
  return null;
}

function TableModel() {
  return (
    <group>
      <mesh position={[0, 0.85, 0]} receiveShadow>
        <cylinderGeometry args={[TABLE_R, TABLE_R, 0.1, 64]} />
        <meshStandardMaterial color="#1f6b45" roughness={0.95} />
      </mesh>
      <mesh position={[0, 0.9, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
        <torusGeometry args={[TABLE_R, 0.18, 24, 96]} />
        <meshStandardMaterial color="#6b4423" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.4, 0]} castShadow>
        <cylinderGeometry args={[0.5, 0.9, 0.8, 32]} />
        <meshStandardMaterial color="#4a2e17" roughness={0.6} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[14, 64]} />
        <meshStandardMaterial color="#1a1033" />
      </mesh>
    </group>
  );
}

/** Decoration that may fail to load (the 3D pile count's font): if it does, it is left out instead of taking the table down. */
class Optional extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/** Chips in stacks of ten, one chip per four points, with the count standing above in 3D. */
function PileStack({ pile }: { pile: number }) {
  const chips = Math.min(60, Math.ceil(pile / 4));
  // three.js only reads the comma form of hsl(), so the CSS heat colour gets its commas back.
  const color = pileColor(pile).replaceAll(' ', ', ');
  const stacks = Math.ceil(chips / 10);
  return (
    <group position={[0, 0.9, 0]}>
      {Array.from({ length: chips }, (_, i) => {
        const s = Math.floor(i / 10);
        const a = (s * 2 * Math.PI) / Math.max(1, stacks);
        const r = stacks > 1 ? 0.45 : 0;
        return (
          <mesh key={i} position={[Math.sin(a) * r, 0.04 + (i % 10) * 0.07, Math.cos(a) * r]} castShadow>
            <cylinderGeometry args={[0.22, 0.22, 0.06, 32]} />
            <meshStandardMaterial color={color} roughness={0.4} />
          </mesh>
        );
      })}
      <Optional>
        <Suspense fallback={null}>
          <Billboard position={[0, 0.85, 0]}>
            <Text3D font={FONT} size={0.35} height={0.1} bevelEnabled bevelSize={0.015} bevelThickness={0.02} position={[-0.13 * String(pile).length, 0, 0]}>
              {String(pile)}
              <meshStandardMaterial color={color} />
            </Text3D>
          </Billboard>
        </Suspense>
      </Optional>
      <Html position={[0, 0.65, 0]} center>
        <div className="pointer-events-none text-[10px] font-bold uppercase tracking-widest text-white/70" data-pile data-tour="pile" aria-label={`Pile ${pile} points`}>pile</div>
      </Html>
    </group>
  );
}

/** A player made of round shapes: rounded body, ball head, two hands resting on the table rim. */
function Character({ player, dir, active, children }: { player: Player; dir: Vector3; active: boolean; children: ReactNode }) {
  const pos = dir.clone().multiplyScalar(SEAT_R);
  const glow = active ? 0.45 : 0;
  return (
    <group position={pos} rotation={[0, Math.atan2(dir.x, dir.z), 0]}>
      <mesh position={[0, 1.15, 0]} castShadow>
        <capsuleGeometry args={[0.38, 0.6, 8, 24]} />
        <meshStandardMaterial color={player.color} emissive={player.color} emissiveIntensity={glow} roughness={0.5} />
      </mesh>
      <mesh position={[0, 2.0, 0]} castShadow>
        <sphereGeometry args={[0.3, 32, 32]} />
        <meshStandardMaterial color="#f2d2b0" roughness={0.6} />
      </mesh>
      {[-0.3, 0.3].map((x) => (
        <mesh key={x} position={[x, 1.12, -0.55]} castShadow>
          <sphereGeometry args={[0.12, 24, 24]} />
          <meshStandardMaterial color="#f2d2b0" roughness={0.6} />
        </mesh>
      ))}
      <Html position={[0, 2.65, 0]} center zIndexRange={[20, 0]}>{children}</Html>
    </group>
  );
}
