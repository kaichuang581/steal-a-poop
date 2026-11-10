import { advance, Canvas, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
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
    <div className="relative h-full" style={{ background: 'linear-gradient(#273B66, #4A5F8A)' }}>
      <Canvas shadows={{ type: PCFSoftShadowMap }} dpr={[1, 2]} gl={{ outputColorSpace: SRGBColorSpace, toneMapping: ACESFilmicToneMapping }} camera={{ fov: 32, position: [0.5, 1.0, 2.6] }} onCreated={({ camera }) => camera.lookAt(0, 0.6, 0)}>
        <hemisphereLight args={['#DCE6F2', '#8E3A31', 0.9]} />
        <directionalLight position={[3, 5, 4]} intensity={1.6} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} shadow-normalBias={0.02} />
        <mesh geometry={floor} receiveShadow position={[-1.6, -0.1, -1.6]} material={floorMat} />
        <group scale={SPEAKER_CAM ? SHEEP_SCALE * model.drawScale : 1}>
          <Sheep level={level} state={state} stateKey={key} lookAt={CAM === 'side' ? undefined : 'camera'} speaking={speaking} model={model} />
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

/** The wide shot, a close-up of the face, the front (?cam=front), a true profile (?cam=side, the head held straight) or the table's speaker camera (?cam=speaker, V5 Part 11.1). */
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
    else if (CAM === 'side') { camera.position.set(2.0, 0.7, 0.15); camera.lookAt(0, 0.55, 0.15); }
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
    <div className="h-full overflow-auto" style={{ background: silhouette ? '#FFFFFF' : 'linear-gradient(#273B66, #4A5F8A)' }}>
      <div id="lineup" className="flex" style={{ width: size * ANIMAL_AVATAR_IDS.length, height: size, filter: squint ? 'blur(6px)' : undefined }}>
        {ANIMAL_AVATAR_IDS.map((a) => (
          <div key={a} style={{ width: size, height: size, filter: silhouette ? 'brightness(0)' : undefined }}>
            <Canvas shadows={!silhouette && { type: PCFSoftShadowMap }} dpr={1} gl={{ alpha: true, outputColorSpace: SRGBColorSpace, toneMapping: ACESFilmicToneMapping }} camera={{ fov: 32, position: [1.3, 1.2, 3.4] }} onCreated={({ camera }) => camera.lookAt(0, 0.68, 0)}>
              <hemisphereLight args={['#DCE6F2', '#8E3A31', 0.9]} />
              <directionalLight position={[3, 5, 4]} intensity={1.6} castShadow={!silhouette} shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} shadow-normalBias={0.02} />
              {!silhouette && <mesh geometry={floor} receiveShadow position={[-1.6, -0.1, -1.6]} material={floorMat} />}
              <group scale={animalModel(a).drawScale}>
                <Sheep level={2} state="idle" lookAt="camera" model={animalModel(a)} />
              </group>
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

/** The strips (V5.1 Part 8): 12 frames of each timed state, 6 of grazing, run and jump, 160 px each, one sheet a species. */
const STRIP_STATES: { state: SheepState; frames: number; span: number }[] = [
  { state: 'proud', frames: 12, span: 1.2 }, { state: 'happy', frames: 12, span: 1.6 }, { state: 'startled', frames: 12, span: 0.9 },
  { state: 'cold', frames: 12, span: 2 }, { state: 'freezing', frames: 12, span: 2.4 }, { state: 'thawing', frames: 12, span: 1.2 },
  { state: 'bonk', frames: 12, span: 1.2 }, { state: 'grazing', frames: 6, span: 3 }, { state: 'run', frames: 6, span: 0.44 }, { state: 'jump', frames: 6, span: 0.72 },
];
declare global { interface Window { __strips?: Record<string, string>; __stripsDone?: boolean } }

/**
 * ?skin=painted&preview=strips (V5.1 Part 8): each species stepped through every state on a canvas whose clock is driven
 * frame by frame (frameloop "never"), each frame copied into a sheet, rows by state, 160 px a frame. The sheets are left
 * on `window.__strips` (JPEG data URLs by species) for tools/animalStrips.mjs to save into docs/skin/animals-v5_1/.
 * ?species=cow,pig limits the run.
 */
export function StripsPreview() {
  const q = new URLSearchParams(location.search);
  const list = (q.get('species')?.split(',') ?? [...ANIMAL_AVATAR_IDS]) as Animal[];
  const [cur, setCur] = useState<{ animal: Animal; state: SheepState; key: number }>({ animal: list[0], state: 'idle', key: 0 });
  const floor = useFloor();
  const floorMat = useMemo(() => voxelMaterial(), []);
  const [log, setLog] = useState('');
  const set = useRef(setCur);
  set.current = setCur;
  const m = animalModel(cur.animal);
  const h = m.height * m.drawScale;
  return (
    <div className="p-4" style={{ background: '#273B66', color: '#fff', minHeight: '100%' }}>
      <div style={{ width: 160, height: 160 }}>
        <Canvas frameloop="never" shadows={{ type: PCFSoftShadowMap }} dpr={1} gl={{ preserveDrawingBuffer: true, outputColorSpace: SRGBColorSpace, toneMapping: ACESFilmicToneMapping }} camera={{ fov: 30, position: [h * 1.1, h * 0.95, h * 2.6] }}>
          <color attach="background" args={['#3A4E78']} />
          <hemisphereLight args={['#DCE6F2', '#8E3A31', 0.9]} />
          <directionalLight position={[3, 5, 4]} intensity={1.6} castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0004} shadow-normalBias={0.02} />
          <mesh geometry={floor} receiveShadow position={[-1.6, -0.1, -1.6]} material={floorMat} />
          <group scale={m.drawScale}>
            <Sheep level={2} state={cur.state} stateKey={cur.key} model={m} />
          </group>
          <StripDriver list={list} set={set} onLog={setLog} />
        </Canvas>
      </div>
      <p className="mt-2 text-xs">{log}</p>
    </div>
  );
}

const tick = () => new Promise<void>((r) => setTimeout(r, 30));
function StripDriver({ list, set, onLog }: { list: Animal[]; set: { current: (v: { animal: Animal; state: SheepState; key: number }) => void }; onLog: (s: string) => void }) {
  const { gl, camera } = useThree();
  useEffect(() => {
    let alive = true;
    (async () => {
      const F = 160, out: Record<string, string> = {};
      let t = 1, key = 1;
      const frame = (at: number) => { advance(at); };
      for (const animal of list) {
        // The canvas's camera is made once: frame each animal by its own height (its draw scale included).
        const md = animalModel(animal), h = md.height * md.drawScale;
        camera.position.set(h * 1.1, h * 0.95, h * 2.6);
        camera.lookAt(0, h * 0.45, 0);
        camera.updateMatrixWorld();
        const sheet = document.createElement('canvas');
        sheet.width = F * 12; sheet.height = F * STRIP_STATES.length;
        const ctx = sheet.getContext('2d')!;
        ctx.fillStyle = '#273B66'; ctx.fillRect(0, 0, sheet.width, sheet.height);
        for (const [row, st] of STRIP_STATES.entries()) {
          if (!alive) return;
          onLog(`${animal} ${st.state}`);
          // Settle in idle, then start the state; the frames span its duration from that moment.
          set.current({ animal, state: 'idle', key: key++ });
          await tick(); frame(t); t += 0.5; frame(t);
          set.current({ animal, state: st.state, key: key++ });
          await tick();
          const start = t + 0.001;
          frame(start);
          for (let i = 0; i < st.frames; i++) {
            const at = start + (st.span * (i + 1)) / st.frames;
            frame(at);
            ctx.drawImage(gl.domElement, i * F, row * F, F, F);
          }
          t = start + st.span + 0.5;
          ctx.fillStyle = '#ffffff'; ctx.font = '12px sans-serif'; ctx.fillText(st.state, 4, row * F + 14);
        }
        out[animal] = sheet.toDataURL('image/jpeg', 0.86);
      }
      window.__strips = out;
      window.__stripsDone = true;
      onLog('done');
    })();
    return () => { alive = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
