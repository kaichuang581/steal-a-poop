import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import type { Group, Material, Mesh } from 'three';
import { BED, bedroomGeometry, quiltSat, quiltTurned, TURN_STEP, WAIST_X } from './bedroom';
import { IN_BED, lyingAt, POSES } from './farmer';
import type { Pose } from './farmer';
import { FarmerFigure } from './FarmerFigure';
import type { FarmerHandle } from './FarmerFigure';

/** Past this much of a rise he is sitting up, and the quilt is the one pushed down to his waist. */
const SAT_FROM = (50 * Math.PI) / 180;
/** Under this much of a roll he lies as he sleeps, and so does the quilt. */
const ROLLED = (0.5 * Math.PI) / 180;

/**
 * The farmer in his bed, in the bedroom's frame: the figure laid on its back with its head at the headboard, and the
 * quilt over it. The quilt breathes with him, the part over his chest lifts with him when he starts up, as he turns
 * over (gate 3) it is the quilt pushed up over his near side for how far he has rolled (`quiltTurned`), and once he
 * sits up it is the quilt pushed down to his waist. `apply` puts all of it in a pose; call it from a frame loop.
 */
export const FarmerInBed = forwardRef<FarmerHandle, { material: Material; pose: Pose }>(function FarmerInBed({ material, pose }, ref) {
  const b = useMemo(() => bedroomGeometry(), []);
  const flat = useMemo(() => ({ chest: b.quiltChest, legs: b.quiltLegs }), [b]);
  const sat = useMemo(() => quiltSat(), []);
  const lying = useMemo(() => lyingAt(BED.mattress.top), []);
  const farmer = useRef<FarmerHandle>(null);
  const over = useRef<Group>(null);
  const chest = useRef<Group>(null);
  const chestMesh = useRef<Mesh>(null);
  const legsMesh = useRef<Mesh>(null);
  const satMesh = useRef<Mesh>(null);
  const figure = useRef<Group>(null);
  const top = BED.mattress.top, up = pose.torso > SAT_FROM;
  // The quilts he turns over under (gate 3) take a few tens of ms each to build: build them one at a time while the
  // dream opens, not in the middle of his turn.
  useEffect(() => {
    const ids = [1, 2, 3, 4].map((step, k) => window.setTimeout(() => quiltTurned(step), 1500 + k * 400));
    return () => ids.forEach((id) => window.clearTimeout(id));
  }, []);
  useImperativeHandle(ref, () => ({
    apply(p, breath = 0) {
      farmer.current?.apply(p, breath);
      const sitting = p.torso > SAT_FROM;
      if (over.current) { over.current.visible = !sitting; over.current.scale.y = 1 + p.breath.rise * breath; }
      // Turning over: the quilt for how far he has rolled, a step every TURN_STEP degrees.
      const roll = Math.abs(p.roll), quilt = roll < ROLLED ? flat : quiltTurned(Math.min(4, Math.ceil((roll * 180) / Math.PI / TURN_STEP - 1e-6)));
      if (chestMesh.current && chestMesh.current.geometry !== quilt.chest) chestMesh.current.geometry = quilt.chest;
      if (legsMesh.current && legsMesh.current.geometry !== quilt.legs) legsMesh.current.geometry = quilt.legs;
      if (satMesh.current) { satMesh.current.visible = sitting; satMesh.current.position.x = -p.scoot; }
      if (figure.current) figure.current.position.x = lying.position[0] - p.scoot;
      // The quilt over his chest rides up with him (a start, a bump), about his waist.
      if (chest.current) chest.current.rotation.z = -Math.max(0, p.torso - POSES.bedSleep.torso);
    },
  }), [lying, flat]);
  return (
    <>
      <group ref={over} position={[0, top, 0]} visible={!up}>
        <mesh ref={legsMesh} geometry={b.quiltLegs} material={material} position={[0, -top, 0]} />
        <group ref={chest} position={[WAIST_X, 0, IN_BED.z]}>
          <mesh ref={chestMesh} geometry={b.quiltChest} material={material} position={[-WAIST_X, -top, -IN_BED.z]} />
        </group>
      </group>
      <mesh ref={satMesh} geometry={sat} material={material} visible={up} position={[-pose.scoot, 0, 0]} />
      <group ref={figure} position={[lying.position[0] - pose.scoot, lying.position[1], lying.position[2]]} quaternion={lying.quaternion}>
        <FarmerFigure ref={farmer} material={material} pose={pose} />
      </group>
    </>
  );
});
