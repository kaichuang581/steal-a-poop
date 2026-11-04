import { Canvas, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useState } from 'react';
import { ACESFilmicToneMapping, PCFSoftShadowMap, SRGBColorSpace } from 'three';
import { Chip, PaperPanel } from '../components/Materials';
import { voxelMaterial } from '../voxel/material';
import { buildGeometry } from '../voxel/mesher';
import { pick, T } from '../voxel/palette';
import { Grid, hash3 } from '../voxel/primitives';
import { sheepModel } from '../voxel/sheep';
import { DevLine, DevStats } from './DevStats';
import { Sheep } from './Sheep';
import type { SheepState, WoolLevel } from './Sheep';

const STATES: SheepState[] = ['idle', 'thinking', 'proud', 'happy', 'startled', 'cold', 'freezing', 'frozen', 'thawing', 'sleeping', 'grazing'];

/** ?skin=painted&preview=sheep: one sheep with buttons for every wool level and state (plan V3 Milestone 1). */
export function SheepPreview() {
  const [level, setLevel] = useState<WoolLevel>(2);
  const [state, setState] = useState<SheepState>('idle');
  const [key, setKey] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const [close, setClose] = useState(false);
  const floor = useFloor();
  const floorMat = useMemo(() => voxelMaterial(), []);
  return (
    <div className="relative h-full" style={{ background: 'linear-gradient(#273B66, #4A5F8A)' }}>
      <Canvas shadows={{ type: PCFSoftShadowMap }} dpr={[1, 2]} gl={{ outputColorSpace: SRGBColorSpace, toneMapping: ACESFilmicToneMapping }} camera={{ fov: 32, position: [0.5, 1.0, 2.6] }} onCreated={({ camera }) => camera.lookAt(0, 0.6, 0)}>
        <hemisphereLight args={['#DCE6F2', '#8E3A31', 0.9]} />
        <directionalLight position={[3, 5, 4]} intensity={1.6} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} shadow-normalBias={0.02} />
        <mesh geometry={floor} receiveShadow position={[-1.6, -0.1, -1.6]} material={floorMat} />
        <Sheep level={level} state={state} stateKey={key} lookAt="camera" speaking={speaking} />
        <Shot close={close} />
        <DevStats />
      </Canvas>
      <PaperPanel className="absolute left-2 top-2 max-w-[22rem] space-y-2 p-3">
        <div className="sk-display text-lg">Sheep preview · {sheepModel().voxels.toLocaleString()} voxels</div>
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

/** The wide shot, or a close-up of the face. */
function Shot({ close }: { close: boolean }) {
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    if (close) { camera.position.set(0.3, 0.95, 1.5); camera.lookAt(0.02, 0.8, 0.3); }
    else { camera.position.set(0.5, 1.0, 2.6); camera.lookAt(0, 0.6, 0); }
  }, [camera, close]);
  return null;
}

let floorGeo: ReturnType<typeof buildGeometry> | null = null;
function useFloor() {
  if (floorGeo) return floorGeo;
  const g = new Grid(0.1);
  for (let x = 0; x < 32; x++) for (let z = 0; z < 32; z++) g.set(x, 0, z, pick(T.hay, hash3(x, 0, z, 3)));
  floorGeo = buildGeometry(g.map, 0.1);
  return floorGeo;
}
