import { useMemo } from 'react';
import { Color, Euler, MeshBasicMaterial, Quaternion } from 'three';
import type { MeshLambertMaterial } from 'three';
import { BOMB_NECK_Y } from '../voxel/bomb';
import { bombLook, glintGeometry } from '../voxel/bombSkins';
import { voxelMaterial } from '../voxel/material';
import { buildGeometry } from '../voxel/mesher';
import { ACTS } from '../table/burstActs';
import { auraOf } from './bombAura';
import { BOMB_TINT, BURST_SHAPE } from './catalog';
import { burstGrid, soundGrid } from './thumbModels';

/**
 * The Trading Post's things as three.js objects, shared by the thumbnail bake (ThumbRender) and the live preview
 * (PreviewStage). A bomb skin is the game's own bomb in that skin, exactly as the table draws it: its model, its glowing
 * parts (`glow`: the material to draw them with, so the preview can make it throb; made here if not given), its fuse
 * and spark. `sparkles` adds three still glints for a skin that glints all the time (gold, a diamond), turned to face a camera looking down -z through
 * a parent turned by that much: the baked picture cannot flash, so it shows the flash.
 */
export function BombModel3d({ id, fuse = 0.45, glow, sparkles }: { id: string; fuse?: number; glow?: MeshLambertMaterial | null; sparkles?: [number, number, number] }) {
  const look = useMemo(() => bombLook(id), [id]);
  const aura = auraOf(id);
  const tint = BOMB_TINT[id] ?? BOMB_TINT['bomb-ice'];
  const body = useMemo(() => voxelMaterial({ emissive: tint.emissive, emissiveIntensity: 0.1 }), [tint]);
  const own = useMemo(() => (aura.glow ? voxelMaterial({ emissive: aura.glow.colors[0], emissiveIntensity: aura.glow.base + aura.glow.pulse * 0.5 }) : null), [aura]);
  const fuseMat = useMemo(() => voxelMaterial({ emissive: aura.fuseGlow, emissiveIntensity: 0.15 }), [aura]);
  const spark = useMemo(() => voxelMaterial({ emissive: aura.sparkGlow, emissiveIntensity: 2 }), [aura]);
  const glint = useMemo(() => new MeshBasicMaterial({ color: new Color(aura.glints?.colors[0] ?? '#ffffff').multiplyScalar(1.5) }), [aura]);
  const facing = useMemo(() => (sparkles ? new Quaternion().setFromEuler(new Euler(...sparkles)).invert() : null), [sparkles]);
  const glowMat = glow ?? own;
  return (
    <>
      <mesh geometry={look.body} material={body} />
      {look.glow && glowMat && <mesh geometry={look.glow} material={glowMat} />}
      {/* A short fuse, so the bomb itself fills the picture. */}
      <group position={[0, BOMB_NECK_Y, 0]} scale={[1, fuse, 1]}>
        <mesh geometry={look.fuse} material={fuseMat} />
        <mesh geometry={look.spark} material={spark} position={[0.04, 0.4, 0]} scale={[1, 1 / fuse, 1]} />
      </group>
      {facing && aura.glints && aura.glints.rate >= 2 && (
        <group quaternion={facing}>
          {([[0.2, 0.17, 0.2, 1.1], [-0.23, 0.02, 0.2, 0.8], [0.13, -0.15, 0.22, 0.55]] as const).map(([x, y, z, k], i) => (
            <mesh key={i} geometry={glintGeometry()} material={glint} position={[x, y, z]} scale={k} rotation={[0, 0, 0.3 * i]} />
          ))}
        </group>
      )}
    </>
  );
}

/**
 * A burst's picture or a fuse sound's object. A burst that is light itself (the frost ball, an aurora, a sun,
 * lanterns, stars) is drawn unlit; one that is a thing (a haystack, a cloud, balloons) is lit like everything else.
 */
export function GridModel3d({ id, kind }: { id: string; kind: 'blast' | 'tick' }) {
  const geo = useMemo(() => {
    const g = kind === 'blast' ? burstGrid(id) : soundGrid(id);
    return buildGeometry(g.map, g.size);
  }, [id, kind]);
  const act = ACTS[BURST_SHAPE[id] ?? 'ball'];
  const light = kind === 'blast' && (!!act.unlit || act.props === 0);
  const mat = useMemo(() => (light ? new MeshBasicMaterial({ vertexColors: true }) : voxelMaterial()), [light]);
  return <mesh geometry={geo} material={mat} />;
}
