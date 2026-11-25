import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Group } from 'three';
import { BARN, HEAP, homeGameSeat, SHEEP_SCALE } from '../scene/layout';
import { animalModel } from '../voxel/animals';
import { BOMB_RADIUS, BOMB_TOSS_S } from '../voxel/bomb';
import { makeBomb } from '../tp/bomb';
import { voxelMaterial } from '../voxel/material';
import { pileGeometry, pileWidth, PLATFORM_HEIGHT, platformGeometry } from '../voxel/table';
import { LetterBoard } from './BarnTable';
import { Sheep } from './Sheep';

const SEATS = { computer: [0, 1, 2, 3, 4, 5], phone: [0, 2, 5] } as const;
/** Each sheep's coat (the game's lives), by seat. */
const COATS = [2, 3, 1, 2, 3, 2] as const;
const seatPosition = homeGameSeat;
/** The letter board hangs from the cross beam, east of the pile: over the middle it filled the top of the shot from inside. */
const BOARD_HOOK = [2.4, BARN.beamY - 0.15, 1.0] as const;
/** A chain as the game plays it: each word starts with the last letter of the one before, and the last leads back to the first. */
const WORDS = ['WOOL', 'LAMB', 'BARN', 'NIGHT', 'THISTLE', 'EWE', 'ECHO', 'OATS', 'SNOW', 'WINTER', 'RAM', 'MEADOW'];
const TURN_S = 4.5;
const BOMB_SCALE = 1.5;

/** Where the bomb lies for a seat: on the floor by its sheep's front hooves, toward the pile and a little to one side. */
function bombAt(seat: number): [number, number, number] {
  const p = seatPosition(seat), dx = HEAP[0] - p.x, dz = HEAP[2] - p.z, len = Math.hypot(dx, dz) || 1;
  return [p.x + (dx / len) * 0.95 - (dz / len) * 0.6, BOMB_RADIUS * BOMB_SCALE, p.z + (dz / len) * 0.95 + (dx / len) * 0.6];
}

/**
 * A game going on inside the barn, as Home sees it through the doors and from the shot inside: sheep in the table's own
 * ring round the wool pile, the letter board over it, the bomb passed to whoever's turn it is. Nothing is played: the
 * turn moves on every few seconds through a fixed chain of words. (Brian, 2026-11-20, of the one sheep that stood in
 * the doorway: "make his placement there more intentional, add more sheep in there and make it look like theyre
 * actually playing the game".)
 */
export function BarnGame({ reduced, phone, sleepy }: { reduced: boolean; phone: boolean; sleepy: boolean }) {
  const seats = phone ? SEATS.phone : SEATS.computer;
  const [turn, setTurn] = useState(0);
  useEffect(() => {
    if (reduced || sleepy) return;
    const id = setInterval(() => setTurn((t) => t + 1), TURN_S * 1000);
    return () => clearInterval(id);
  }, [reduced, sleepy]);
  const speaker = seats[turn % seats.length], before = turn > 0 ? seats[(turn - 1) % seats.length] : null;
  // The sheep whose word was just taken hops once.
  const [cheer, setCheer] = useState<number | null>(null);
  useEffect(() => {
    if (before === null) return;
    setCheer(before);
    const id = setTimeout(() => setCheer(null), 1200);
    return () => clearTimeout(id);
  }, [turn, before]);

  const mat = useMemo(() => voxelMaterial(), []);
  useEffect(() => () => { mat.dispose(); }, [mat]);
  const platform = useMemo(() => platformGeometry(), []);
  const mound = useMemo(() => pileGeometry(pileWidth(6 + (turn % WORDS.length))), [turn]);
  // The starter skin (docs/trading-post-practice/T2), its face showing 10: nobody's seconds run in this game.
  const ice = useMemo(() => makeBomb('ice', { rest: true, lit: mat }), [mat]);

  // The bomb is tossed to the new speaker in an arc, as at the table.
  const bomb = useRef<Group>(null);
  const toss = useRef({ from: bombAt(speaker), to: bombAt(speaker), at: -10 });
  useEffect(() => {
    const g = bomb.current;
    toss.current = { from: g ? [g.position.x, BOMB_RADIUS * BOMB_SCALE, g.position.z] : bombAt(speaker), to: bombAt(speaker), at: performance.now() / 1000 };
  }, [speaker]);
  useFrame(() => {
    const g = bomb.current;
    if (!g) return;
    const { from, to, at } = toss.current, k = reduced ? 1 : Math.min(1, (performance.now() / 1000 - at) / BOMB_TOSS_S);
    g.position.set(from[0] + (to[0] - from[0]) * k, to[1] + Math.sin(k * Math.PI) * 0.9, from[2] + (to[2] - from[2]) * k);
    g.rotation.x = (1 - k) * 5;
  });

  const head = useMemo((): [number, number, number] => { const p = seatPosition(speaker); return [p.x, 0.85 * SHEEP_SCALE, p.z]; }, [speaker]);
  const pileTop = useMemo((): [number, number, number] => [HEAP[0], 0.6, HEAP[2]], []);
  const sheepScale = SHEEP_SCALE * animalModel('sheep').drawScale;
  return (
    <>
      <group position={[HEAP[0], 0, HEAP[2]]}>
        <mesh geometry={platform} material={mat} castShadow receiveShadow />
        <mesh geometry={mound} material={mat} position={[0, PLATFORM_HEIGHT, 0]} castShadow receiveShadow />
      </group>
      <LetterBoard letter={WORDS[turn % WORDS.length][0]} isTrap={false} reduced={reduced} hook={BOARD_HOOK} />
      <group ref={bomb} position={bombAt(speaker)} scale={BOMB_SCALE}>
        <primitive object={ice.group} scale={BOMB_RADIUS / 0.25} position={[0, -BOMB_RADIUS, 0]} />
      </group>
      {seats.map((seat) => {
        const p = seatPosition(seat);
        return (
          <group key={seat} position={[p.x, 0, p.z]} rotation={[0, p.yaw, 0]} scale={sheepScale}>
            <Sheep level={COATS[seat]} state={sleepy ? 'sleeping' : seat === cheer ? 'happy' : seat === speaker ? 'thinking' : 'idle'} stateKey={seat === cheer ? turn : 0}
              reduced={reduced} lookAt={seat === speaker ? pileTop : head} />
          </group>
        );
      })}
    </>
  );
}
