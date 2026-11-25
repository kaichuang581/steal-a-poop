import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import type { Group, Material, Mesh } from 'three';
import { BED, bedroomGeometry, quiltSat, WAIST_X } from './bedroom';
import { IN_BED, lyingAt, POSES } from './farmer';
import type { Pose } from './farmer';
import { FarmerFigure } from './FarmerFigure';
import type { FarmerHandle } from './FarmerFigure';

/** Past this much of a rise he is sitting up, and the quilt is the one pushed down to his waist. */
const SAT_FROM = (50 * Math.PI) / 180;

/**
 * The farmer in his bed, in the bedroom's frame: the figure laid on its back with its head at the headboard, and the
 * quilt over it. The quilt breathes with him, the part over his chest lifts with him when he starts up, and once he
 * sits up it is the quilt pushed down to his waist. `apply` puts all of it in a pose; call it from a frame loop.
 */
export const FarmerInBed = forwardRef<FarmerHandle, { material: Material; pose: Pose }>(function FarmerInBed({ material, pose }, ref) {
  const b = useMemo(() => bedroomGeometry(), []);
  const sat = useMemo(() => quiltSat(), []);
  const lying = useMemo(() => lyingAt(BED.mattress.top), []);
  const farmer = useRef<FarmerHandle>(null);
  const over = useRef<Group>(null);
  const chest = useRef<Group>(null);
  const satMesh = useRef<Mesh>(null);
  const figure = useRef<Group>(null);
  const top = BED.mattress.top, up = pose.torso > SAT_FROM;
  useImperativeHandle(ref, () => ({
    apply(p, breath = 0) {
      farmer.current?.apply(p, breath);
      const sitting = p.torso > SAT_FROM;
      if (over.current) { over.current.visible = !sitting; over.current.scale.y = 1 + p.breath.rise * breath; }
      if (satMesh.current) { satMesh.current.visible = sitting; satMesh.current.position.x = -p.scoot; }
      if (figure.current) figure.current.position.x = lying.position[0] - p.scoot;
      // The quilt over his chest rides up with him (a start, a bump), about his waist.
      if (chest.current) chest.current.rotation.z = -Math.max(0, p.torso - POSES.bedSleep.torso);
    },
  }), [lying]);
  return (
    <>
      <group ref={over} position={[0, top, 0]} visible={!up}>
        <mesh geometry={b.quiltLegs} material={material} position={[0, -top, 0]} />
        <group ref={chest} position={[WAIST_X, 0, IN_BED.z]}>
          <mesh geometry={b.quiltChest} material={material} position={[-WAIST_X, -top, -IN_BED.z]} />
        </group>
      </group>
      <mesh ref={satMesh} geometry={sat} material={material} visible={up} position={[-pose.scoot, 0, 0]} />
      <group ref={figure} position={[lying.position[0] - pose.scoot, lying.position[1], lying.position[2]]} quaternion={lying.quaternion}>
        <FarmerFigure ref={farmer} material={material} pose={pose} />
      </group>
    </>
  );
});
