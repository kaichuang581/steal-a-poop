import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import type { Group, Material, Mesh } from 'three';
import { farmerGeometry, PARENT, PIECES, placePose, UNIT } from './farmer';
import type { Eyes, Mouth, Piece, Pose } from './farmer';

/** Puts the figure in a pose. Call it from a frame loop; `breath` is 0 to 1 (`breathAt`). */
export interface FarmerHandle { apply(pose: Pose, breath?: number): void }

const CHILDREN = Object.fromEntries(PIECES.map((p) => [p, PIECES.filter((c) => PARENT[c] === p)])) as Record<Piece, Piece[]>;
const EYES: Eyes[] = ['closed', 'open', 'wide'], MOUTHS: Mouth[] = ['closed', 'open'];

/**
 * The farmer as a jointed figure (the model and the poses are farmer.ts). Standing frame: his feet at the origin, his
 * front toward +z. Whoever mounts him places the whole figure (the bed lays him down with `lyingAt`).
 */
export const FarmerFigure = forwardRef<FarmerHandle, { material: Material; pose: Pose }>(function FarmerFigure({ material, pose }, ref) {
  const geo = useMemo(() => farmerGeometry(), []);
  const groups = useRef<Partial<Record<Piece, Group | null>>>({});
  const eyes = useRef<Partial<Record<Eyes, Mesh | null>>>({});
  const mouths = useRef<Partial<Record<Mouth, Mesh | null>>>({});
  const brows = useRef<Group>(null);
  const level = useRef<Mesh>(null);
  const grumpy = useRef<Mesh>(null);
  const first = useMemo(() => placePose(pose), []); // eslint-disable-line react-hooks/exhaustive-deps
  useImperativeHandle(ref, () => ({
    apply(p, breath = 0) {
      const placed = placePose(p, breath);
      for (const piece of PIECES) {
        const g = groups.current[piece];
        if (!g) continue;
        g.position.copy(placed[piece].position);
        g.quaternion.copy(placed[piece].quaternion);
        g.scale.copy(placed[piece].scale);
      }
      for (const e of EYES) { const m = eyes.current[e]; if (m) m.visible = e === p.eyes; }
      for (const k of MOUTHS) { const m = mouths.current[k]; if (m) m.visible = k === p.mouth; }
      if (brows.current) brows.current.position.y = p.brows * UNIT;
      if (level.current) level.current.visible = !p.grumpy;
      if (grumpy.current) grumpy.current.visible = p.grumpy;
      for (const s of ['slipperL', 'slipperR'] as const) { const g = groups.current[s]; if (g) g.visible = p.slippers; }
    },
  }), []);
  const piece = (p: Piece) => (
    <group key={p} ref={(g) => { groups.current[p] = g; }} position={first[p].position} quaternion={first[p].quaternion} scale={first[p].scale} visible={p.startsWith('slipper') ? pose.slippers : true}>
      <mesh geometry={geo.pieces[p]} material={material} />
      {p === 'head' && (
        <>
          {EYES.map((e) => <mesh key={e} ref={(m) => { eyes.current[e] = m; }} geometry={geo.face.eyes[e]} material={material} visible={e === pose.eyes} />)}
          {MOUTHS.map((k) => <mesh key={k} ref={(m) => { mouths.current[k] = m; }} geometry={geo.face.mouth[k]} material={material} visible={k === pose.mouth} />)}
          <group ref={brows} position={[0, pose.brows * UNIT, 0]}>
            <mesh ref={level} geometry={geo.face.brows.level} material={material} visible={!pose.grumpy} />
            <mesh ref={grumpy} geometry={geo.face.brows.grumpy} material={material} visible={pose.grumpy} />
          </group>
        </>
      )}
      {CHILDREN[p].map((c) => piece(c))}
    </group>
  );
  return piece('lap');
});
