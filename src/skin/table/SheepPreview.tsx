import { Canvas, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useState } from 'react';
import { ACESFilmicToneMapping, PCFSoftShadowMap, SRGBColorSpace } from 'three';
import { Chip, PaperPanel } from '../components/Materials';
import { voxelMaterial } from '../voxel/material';
import { buildGeometry } from '../voxel/mesher';
import { pick, T } from '../voxel/palette';
import { Grid, hash3 } from '../voxel/primitives';
import { ANIMAL_AVATAR_IDS } from '../../avatars/ids';
import { animalModel, heightRatio } from '../voxel/animals';
import type { Animal } from '../voxel/animals';
import { HEAP, SHEEP_SCALE, seatPosition, speakerShot } from '../scene/layout';
import { DevLine, DevStats } from './DevStats';
import { Sheep } from './Sheep';
import type { SheepState, WoolLevel } from './Sheep';

const STATES: SheepState[] = ['idle', 'thinking', 'proud', 'happy', 'startled', 'cold', 'freezing', 'frozen', 'thawing', 'sleeping', 'grazing'];

/** ?skin=painted&preview=sheep: one sheep (or any animal avatar) with buttons for every wool level and state (plan V3 Milestone 1). */
export function SheepPreview() {
  const [animal, setAnimal] = useState<Animal>('sheep');
  const model = animalModel(animal);
  const [level, setLevel] = useState<WoolLevel>(2);
  const [state, setState] = useState<SheepState>('idle');
  const [key, setKey] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const [close, setClose] = useState(false);
  const floor = useFloor();
  const floorMat = useMemo(() => voxelMaterial(), []);
  return (
    <div className="relative h-full" style={{ background: '#3A4E78' }}>
      <Canvas shadows={{ type: PCFSoftShadowMap }} dpr={[1, 2]} gl={{ outputColorSpace: SRGBColorSpace, toneMapping: ACESFilmicToneMapping }} camera={{ fov: 32, position: [0.5, 1.0, 2.6] }} onCreated={({ camera }) => camera.lookAt(0, 0.6, 0)}>
        <hemisphereLight args={['#DCE6F2', '#8E3A31', 0.9]} />
        <directionalLight position={[3, 5, 4]} intensity={1.6} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} shadow-normalBias={0.02} />
        <mesh geometry={floor} receiveShadow position={[-1.6, -0.1, -1.6]} material={floorMat} />
        <group scale={SPEAKER_CAM ? SHEEP_SCALE * model.drawScale : 1}>
          <Sheep level={level} state={state} stateKey={key} lookAt="camera" speaking={speaking} model={model} />
        </group>
        <Shot close={close} animal={animal} />
        <DevStats />
      </Canvas>
      <PaperPanel className="absolute left-2 top-2 max-w-[22rem] space-y-2 p-3">
        <div className="sk-display text-lg">{animal} preview · {model.voxels.toLocaleString()} voxels</div>
        <div className="flex flex-wrap gap-1">
          {ANIMAL_AVATAR_IDS.map((a) => <Chip key={a} aria-pressed={animal === a} onClick={() => setAnimal(a)}>{a}</Chip>)}
        </div>
        <div className="flex flex-wrap gap-1">
          {([0, 1, 2, 3, 4] as WoolLevel[]).map((l) => <Chip key={l} aria-pressed={level === l} onClick={() => setLevel(l)}>wool {l}</Chip>)}
        </div>
        <div className="flex flex-wrap gap-1">
          {STATES.map((s) => (
            <Chip key={s} aria-pressed={state === s} onClick={() => { setState(s); setKey((k) => k + 1); }}>{s}</Chip>
          ))}
          <Chip aria-pressed={speaking} onClick={() => setSpeaking((v) => !v)}>speaker</Chip>
          <Chip aria-pressed={close} onClick={() => setClose((v) => !v)}>close-up</Chip>
        </div>
      </PaperPanel>
      <DevLine />
    </div>
  );
}

const CAM = new URLSearchParams(location.search).get('cam');
const SPEAKER_CAM = CAM === 'speaker';

/** The wide shot, a close-up of the face, the front (?cam=front) or the table's speaker camera (?cam=speaker, V5 Part 11.1). */
function Shot({ close, animal }: { close: boolean; animal: Animal }) {
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    if (SPEAKER_CAM) {
      // Seat 0 of six, stepped toward the pile as on its turn, moved to the origin; the animal faces +z as at the table.
      const p = seatPosition(0, 6);
      const dx = HEAP[0] - p.x, dz = HEAP[2] - p.z, len = Math.hypot(dx, dz) || 1;
      const hx = p.x + (dx / len) * 0.35, hz = p.z + (dz / len) * 0.35;
      const shot = speakerShot(0, 6, false, 0.95 * heightRatio(animal));
      // Into the seat's frame: the table turns the seat by p.yaw, so the camera turns back by it.
      const local = ([x, y, z]: readonly [number, number, number]): [number, number, number] => {
        const dx = x - hx, dz = z - hz, c = Math.cos(-p.yaw), sn = Math.sin(-p.yaw);
        return [dx * c + dz * sn, y, -dx * sn + dz * c];
      };
      const [px, py, pz] = local(shot.position), [tx, ty, tz] = local(shot.target);
      if ('fov' in camera) { (camera as { fov: number }).fov = shot.fov; (camera as unknown as { updateProjectionMatrix(): void }).updateProjectionMatrix(); }
      camera.position.set(px, py, pz);
      camera.lookAt(tx, ty, tz);
    }
    else if (CAM === 'front') { camera.position.set(0, 0.7, 2.4); camera.lookAt(0, 0.55, 0); }
    else if (close) { camera.position.set(0.3, 0.95, 1.5); camera.lookAt(0.02, 0.8, 0.3); }
    else { camera.position.set(0.5, 1.0, 2.6); camera.lookAt(0, 0.6, 0); }
  }, [camera, close, animal]);
  return null;
}

/**
 * ?skin=painted&preview=lineup (V5 Part 11.2): the six species side by side at the viewer camera, 400 px each, idle at
 * level 2. ?silhouette=1 draws them as black shapes on white (the 64 px strip is shot with ?size=64); ?squint=1 blurs
 * the row by 6 px.
 */
export function LineupPreview() {
  const q = new URLSearchParams(location.search);
  const silhouette = q.get('silhouette') === '1';
  const squint = q.get('squint') === '1';
  const size = Number(q.get('size')) || 400;
  const floor = useFloor();
  const floorMat = useMemo(() => voxelMaterial(), []);
  return (
    <div className="h-full overflow-auto" style={{ background: silhouette ? '#FFFFFF' : '#3A4E78' }}>
      <div id="lineup" className="flex" style={{ width: size * ANIMAL_AVATAR_IDS.length, height: size, filter: squint ? 'blur(6px)' : undefined }}>
        {ANIMAL_AVATAR_IDS.map((a) => (
          <div key={a} style={{ width: size, height: size, filter: silhouette ? 'brightness(0)' : undefined }}>
            <Canvas shadows={!silhouette && { type: PCFSoftShadowMap }} dpr={1} gl={{ alpha: true, outputColorSpace: SRGBColorSpace, toneMapping: ACESFilmicToneMapping }} camera={{ fov: 32, position: [0.5, 1.0, 2.6] }} onCreated={({ camera }) => camera.lookAt(0, 0.6, 0)}>
              <hemisphereLight args={['#DCE6F2', '#8E3A31', 0.9]} />
              <directionalLight position={[3, 5, 4]} intensity={1.6} castShadow={!silhouette} shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} shadow-normalBias={0.02} />
              {!silhouette && <mesh geometry={floor} receiveShadow position={[-1.6, -0.1, -1.6]} material={floorMat} />}
              <Sheep level={2} state="idle" lookAt="camera" model={animalModel(a)} />
            </Canvas>
          </div>
        ))}
      </div>
      {!silhouette && <DevLine />}
    </div>
  );
}

let floorGeo: ReturnType<typeof buildGeometry> | null = null;
function useFloor() {
  if (floorGeo) return floorGeo;
  const g = new Grid(0.1);
  for (let x = 0; x < 32; x++) for (let z = 0; z < 32; z++) g.set(x, 0, z, pick(T.hay, hash3(x, 0, z, 3)));
  floorGeo = buildGeometry(g.map, 0.1);
  return floorGeo;
}
