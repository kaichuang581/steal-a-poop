import { advance, Canvas, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ACESFilmicToneMapping, OrthographicCamera, PCFShadowMap, SRGBColorSpace, Vector3 } from 'three';
import { Chip, PaperPanel } from '../components/Materials';
import { voxelMaterial } from '../voxel/material';
import { buildGeometry } from '../voxel/mesher';
import { pick, T } from '../voxel/palette';
import { Grid, hash3 } from '../voxel/primitives';
import { ANIMAL_AVATAR_IDS } from '../../avatars/ids';
import { animalModel, animalModelWith, heightRatio } from '../voxel/animals';
import { anchorsOf } from '../voxel/animals/anchors';
import { NO_FACES, SPECIES_FACES } from '../voxel/animals/faces';
import type { FaceSwitch, Faces } from '../voxel/animals/faces';
import type { Animal } from '../voxel/animals';
import { HEAP, SHEEP_SCALE, seatPosition, speakerShot } from '../scene/layout';
import { DevLine, DevStats } from './DevStats';
import { Sheep } from './Sheep';
import type { SheepState, WoolLevel } from './Sheep';

const STATES: SheepState[] = ['idle', 'thinking', 'proud', 'happy', 'startled', 'cold', 'freezing', 'frozen', 'thawing', 'sleeping', 'grazing', 'flop', 'perch', 'lounge'];

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
      <Canvas shadows={{ type: PCFShadowMap }} dpr={[1, 2]} gl={{ outputColorSpace: SRGBColorSpace, toneMapping: ACESFilmicToneMapping }} camera={{ fov: 32, position: [0.5, 1.0, 2.6] }} onCreated={({ camera }) => camera.lookAt(0, 0.6, 0)}>
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
  // ?yaw=-0.9 turns every animal (a three-quarter view); ?level=0..4 picks the coat; ?bare=1 shows the sheep in its
  // fleece and the others with no coat; ?bg=%23f4f4f2 a plain background with no floor; ?fit=1 frames each animal by
  // its drawn height (the reference sheets' studio look, for comparing with tools/blender).
  const yaw = Number(q.get('yaw')) || 0;
  const level = (Number(q.get('level') ?? 2) || 0) as WoolLevel;
  const bare = q.get('bare') === '1';
  const bg = q.get('bg');
  const fit = q.get('fit') === '1';
  const floor = useFloor();
  const floorMat = useMemo(() => voxelMaterial(), []);
  return (
    <div className="h-full overflow-auto" style={{ background: silhouette ? '#FFFFFF' : bg ?? '#3A4E78' }}>
      <div id="lineup" className="flex" style={{ width: size * ANIMAL_AVATAR_IDS.length, height: size, filter: squint ? 'blur(6px)' : undefined }}>
        {ANIMAL_AVATAR_IDS.map((a) => (
          <div key={a} style={{ width: size, height: size, filter: silhouette ? 'brightness(0)' : undefined }}>
            <Canvas shadows={!silhouette && { type: PCFShadowMap }} dpr={1} gl={{ alpha: true, outputColorSpace: SRGBColorSpace, toneMapping: ACESFilmicToneMapping }} camera={{ fov: 32, position: fitPos(a, fit) }} onCreated={({ camera }) => camera.lookAt(0, fitLook(a, fit), 0)}>
              <hemisphereLight args={['#DCE6F2', '#8E3A31', 0.9]} />
              <directionalLight position={[3, 5, 4]} intensity={1.6} castShadow={!silhouette} shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} shadow-normalBias={0.02} />
              {!silhouette && !bg && <mesh geometry={floor} receiveShadow position={[-1.6, -0.1, -1.6]} material={floorMat} />}
              <group scale={animalModel(a).drawScale} rotation={[0, yaw, 0]}>
                <Sheep level={bare ? (a === 'sheep' ? 2 : 0) : level} state="idle" lookAt={yaw ? undefined : 'camera'} model={animalModel(a)} />
              </group>
            </Canvas>
          </div>
        ))}
      </div>
      {!silhouette && <DevLine />}
    </div>
  );
}

/** The lineup camera, or with ?fit=1 one pulled back by the animal's drawn height so the tallest is whole. */
const drawnHeight = (a: Animal) => animalModel(a).height * animalModel(a).drawScale;
const fitPos = (a: Animal, fit: boolean): [number, number, number] => { const k = fit ? Math.max(1, drawnHeight(a) / 1.05) : 1; return [1.3 * k, 1.2 * k, 3.4 * k]; };
const fitLook = (a: Animal, fit: boolean) => (fit ? Math.max(0.68, drawnHeight(a) * 0.55) : 0.68);

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
        <Canvas frameloop="never" shadows={{ type: PCFShadowMap }} dpr={1} gl={{ preserveDrawingBuffer: true, outputColorSpace: SRGBColorSpace, toneMapping: ACESFilmicToneMapping }} camera={{ fov: 30, position: [h * 1.1, h * 0.95, h * 2.6] }}>
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

/** One picture on a sheet: which model, how it is seen, how big, and where it goes. */
interface Shot { animal: Animal; faces: Faces; level: WoolLevel; view: 'front' | 'three' | 'side'; ppv: number; col: number; row: number }
interface SheetPlan { title: string; rows: string[]; cols: string[]; groups: { label: string; from: number; to: number }[]; shots: Shot[] }
declare global { interface Window { __faces?: string; __facesDone?: boolean } }

/** Pixels per voxel: the speaker shot's size (9 to 12, plan file 03, 4.10) and Home's (3 to 4), at their low ends. */
const SPEAKER_PPV = 9, HOME_PPV = 3;
const VIEWS = { front: [0, 0.18, 1], three: [0.72, 0.3, 0.72], side: [1, 0.18, 0] } as const;
const VIEW_NAME = { front: 'front', three: 'three-quarter', side: 'side' } as const;
const LABEL: Record<FaceSwitch, string> = {
  sheepFleece: 'fleece at power 4', sheepEyes: 'eyes 3 x 3', cowNoGlint: 'no glint', goatMouth: 'mouth 3 wide, flush',
  goatHorns: 'horns behind the ears', horseNose: 'soft nostrils', horseEyes: 'eyes flush', horseNeck: 'neck in 2-voxel treads',
  chickenTail: 'tail as 3 flat feathers',
};

/** The face sheet (4.10): six rows, today and the proposal (every switch of that species on), two sizes, two views; the sheep's eyes apart. */
function facesPlan(): SheetPlan {
  const shots: Shot[] = [];
  const species = [...ANIMAL_AVATAR_IDS] as Animal[];
  species.forEach((animal, row) => {
    const on = new Set<FaceSwitch>(SPECIES_FACES[animal as keyof typeof SPECIES_FACES] ?? []);
    let col = 0;
    for (const ppv of [SPEAKER_PPV, HOME_PPV]) for (const faces of [NO_FACES, on]) for (const view of ['front', 'three'] as const) shots.push({ animal, faces, level: 2, view, ppv, col: col++, row });
    if (animal === 'sheep') for (const ppv of [SPEAKER_PPV, HOME_PPV]) for (const faces of [NO_FACES, new Set<FaceSwitch>(['sheepEyes'])]) shots.push({ animal, faces, level: 2, view: 'front', ppv, col: col++, row });
  });
  const rows = species.map((a) => {
    const on = (SPECIES_FACES[a as keyof typeof SPECIES_FACES] ?? []) as readonly FaceSwitch[];
    return `${a}|proposal: ${on.length ? on.map((f) => LABEL[f]).join(', ') : 'no face change (shape switch only)'}`;
  });
  const half = ['today front', 'today 3/4', 'proposal front', 'proposal 3/4'];
  return {
    title: 'Face sheet (plan 03, 4.10): tick the rows to change. Coat level 2, still, eyes open, hat on.',
    rows, cols: [...half, ...half, 'eyes 2 x 2', 'eyes 3 x 3', 'eyes 2 x 2', 'eyes 3 x 3'],
    groups: [{ label: `Speaker shot size (1 voxel = ${SPEAKER_PPV} px)`, from: 0, to: 3 }, { label: `Home size (1 voxel = ${HOME_PPV} px)`, from: 4, to: 7 }, { label: 'Sheep only: eyes, speaker and Home size', from: 8, to: 11 }],
    shots,
  };
}

/** The fleece pair (4.9): the sheep at levels 0, 1 and 2, A today and B power 4 with its noise kept. */
function fleecePlan(): SheetPlan {
  const shots: Shot[] = [];
  [NO_FACES, new Set<FaceSwitch>(['sheepFleece'])].forEach((faces, row) => {
    let col = 0;
    for (const view of ['three', 'side'] as const) for (const level of [0, 1, 2] as WoolLevel[]) shots.push({ animal: 'sheep', faces, level, view, ppv: SPEAKER_PPV, col: col++, row });
  });
  const cols = (['three', 'side'] as const).flatMap((v) => [0, 1, 2].map((l) => `level ${l} ${VIEW_NAME[v]}`));
  return {
    title: `Sheep fleece pair (plan 03, 4.9): pick A or B. Still, 1 voxel = ${SPEAKER_PPV} px.`,
    rows: ['A|today', 'B|lobes and shorn body at power 4, noise kept'], cols, groups: [], shots,
  };
}

/**
 * ?skin=painted&preview=faces (plan file 03, 4.10; development only): the face sheet, drawn shot by shot on one canvas
 * whose clock is stepped by hand (frameloop "never"), each animal still under reduced motion (no blink, no breath), the
 * hat as shipped, seen by an orthographic camera framed on `anchorsOf(model).bounds` plus 10% at a fixed size per voxel.
 * The sheet is left on `window.__faces` (a PNG data URL). &sheet=fleece draws the fleece pair (4.9) instead.
 */
export function FacesPreview() {
  const q = new URLSearchParams(location.search);
  const plan = useMemo(() => (q.get('sheet') === 'fleece' ? fleecePlan() : facesPlan()), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [cur, setCur] = useState<Shot>(plan.shots[0]);
  const [log, setLog] = useState('');
  const set = useRef(setCur);
  set.current = setCur;
  const m = animalModelWith(cur.animal, cur.faces);
  return (
    <div className="p-4" style={{ background: '#273B66', color: '#fff', minHeight: '100%' }}>
      <div style={{ width: 200, height: 200, overflow: 'hidden' }}>
        <Canvas frameloop="never" shadows={{ type: PCFShadowMap }} dpr={1} gl={{ preserveDrawingBuffer: true, outputColorSpace: SRGBColorSpace, toneMapping: ACESFilmicToneMapping }}>
          <color attach="background" args={['#3A4E78']} />
          <hemisphereLight args={['#DCE6F2', '#8E3A31', 0.9]} />
          <directionalLight position={[3, 5, 4]} intensity={1.6} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} shadow-normalBias={0.02} />
          <Sheep key={`${cur.animal}|${[...cur.faces].sort().join()}|${cur.level}`} level={cur.level} state="idle" still reduced model={m} />
          <FacesDriver plan={plan} set={set} onLog={setLog} />
        </Canvas>
      </div>
      <p className="mt-2 text-xs">{log}</p>
    </div>
  );
}

/** The size of a shot's tile, and the camera that frames it: the bounds' corners projected on the view, plus 10%. */
function frame(shot: Shot) {
  const b = anchorsOf(animalModelWith(shot.animal, shot.faces)).bounds;
  const dir = new Vector3(...VIEWS[shot.view]).normalize();
  const cam = new OrthographicCamera();
  const c = new Vector3((b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2);
  cam.position.copy(c).addScaledVector(dir, 6);
  cam.lookAt(c);
  cam.updateMatrixWorld();
  const right = new Vector3().setFromMatrixColumn(cam.matrixWorld, 0), up = new Vector3().setFromMatrixColumn(cam.matrixWorld, 1);
  let w = 0, h = 0;
  for (const x of [b.min[0], b.max[0]]) for (const y of [b.min[1], b.max[1]]) for (const z of [b.min[2], b.max[2]]) {
    const d = new Vector3(x, y, z).sub(c);
    w = Math.max(w, Math.abs(d.dot(right))); h = Math.max(h, Math.abs(d.dot(up)));
  }
  w *= 1.1; h *= 1.1;
  const px = shot.ppv / 0.04; // pixels per metre at scale 1
  const W = Math.ceil(2 * w * px), H = Math.ceil(2 * h * px);
  cam.left = -W / 2 / px; cam.right = W / 2 / px; cam.top = H / 2 / px; cam.bottom = -H / 2 / px;
  cam.near = 0.1; cam.far = 20;
  cam.updateProjectionMatrix();
  return { cam, W, H };
}

function FacesDriver({ plan, set, onLog }: { plan: SheetPlan; set: { current: (s: Shot) => void }; onLog: (s: string) => void }) {
  const { gl, scene } = useThree();
  useEffect(() => {
    let alive = true;
    (async () => {
      const frames = plan.shots.map(frame);
      const colW = plan.cols.map((_, c) => Math.max(...plan.shots.map((s, i) => (s.col === c ? frames[i].W : 0))));
      const rowH = plan.rows.map((_, r) => Math.max(...plan.shots.map((s, i) => (s.row === r ? frames[i].H : 0))));
      const PAD = 10, LEFT = 210, TOP = plan.groups.length ? 96 : 70;
      const colX: number[] = [];
      let x = LEFT;
      for (const w of colW) { colX.push(x); x += w + PAD; }
      const rowY: number[] = [];
      let y = TOP;
      for (const h of rowH) { rowY.push(y); y += h + PAD; }
      const sheet = document.createElement('canvas');
      sheet.width = x; sheet.height = y;
      const ctx = sheet.getContext('2d')!;
      ctx.fillStyle = '#1E2A47'; ctx.fillRect(0, 0, sheet.width, sheet.height);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 20px sans-serif'; ctx.fillText(plan.title, 12, 28);
      ctx.font = '14px sans-serif';
      for (const g of plan.groups) {
        const x0 = colX[g.from], x1 = colX[g.to] + colW[g.to];
        ctx.fillStyle = '#E8C46A'; ctx.fillRect(x0, 50, x1 - x0, 2); ctx.fillText(g.label, x0, 44);
      }
      ctx.fillStyle = '#fff';
      plan.cols.forEach((label, c) => ctx.fillText(label, colX[c], TOP - 12));
      plan.rows.forEach((label, r) => {
        const [name, what] = label.split('|');
        ctx.font = 'bold 18px sans-serif'; ctx.fillText(`[  ] ${name}`, 12, rowY[r] + 24);
        ctx.font = '13px sans-serif';
        // The proposal's switches, wrapped to the label column.
        let line = '', ly = rowY[r] + 46;
        for (const word of what.split(' ')) {
          if (ctx.measureText(`${line} ${word}`).width > LEFT - 24) { ctx.fillText(line, 12, ly); ly += 17; line = word; } else line = line ? `${line} ${word}` : word;
        }
        ctx.fillText(line, 12, ly);
      });
      let t = 1;
      for (const [i, shot] of plan.shots.entries()) {
        if (!alive) return;
        onLog(`${shot.animal} ${shot.view} ${shot.ppv}px`);
        set.current(shot);
        await new Promise<void>((r) => setTimeout(r, 40));
        for (let k = 0; k < 4; k++) { advance(t); t += 0.25; }
        const { cam, W, H } = frames[i];
        gl.setSize(W, H, false);
        gl.render(scene, cam);
        ctx.drawImage(gl.domElement, 0, 0, W, H, colX[shot.col] + (colW[shot.col] - W) / 2, rowY[shot.row] + (rowH[shot.row] - H) / 2, W, H);
      }
      window.__faces = sheet.toDataURL('image/png');
      window.__facesDone = true;
      onLog('done');
    })();
    return () => { alive = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

/**
 * ?skin=painted&preview=sheet&species=cow&view=front (development only): one animal as the game draws it, at rest and
 * still, with no hat (?hats=0), from one of six orthographic views framed as tools/blender/lineup.py frames its `sheet`
 * renders (front, back, left, right, top, bottom), so the two can be laid side by side. The sheep wears its fleece,
 * every other animal no coat. 600 x 600.
 */
export function SheetPreview() {
  const q = new URLSearchParams(location.search);
  const a = (q.get('species') ?? 'sheep') as Animal;
  const view = q.get('view') ?? 'front';
  const m = animalModel(a);
  // The box Blender frames: every part's cells at rest, scaled to the drawn size.
  let lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const cells of Object.values(m.cells)) for (const v of cells.values()) {
    const c = [v.x, v.y, v.z];
    lo = lo.map((l, i) => Math.min(l, c[i])); hi = hi.map((h, i) => Math.max(h, c[i] + 1));
  }
  const k = 0.04 * m.drawScale;
  const mid = lo.map((l, i) => ((l + hi[i]) / 2) * k) as [number, number, number];
  const span = Math.max(...hi.map((h, i) => (h - lo[i]) * k)) * 1.15;
  const D = 20;
  const at: Record<string, { p: [number, number, number]; up: [number, number, number] }> = {
    front: { p: [mid[0], mid[1], mid[2] + D], up: [0, 1, 0] }, back: { p: [mid[0], mid[1], mid[2] - D], up: [0, 1, 0] },
    left: { p: [mid[0] + D, mid[1], mid[2]], up: [0, 1, 0] }, right: { p: [mid[0] - D, mid[1], mid[2]], up: [0, 1, 0] },
    top: { p: [mid[0], mid[1] + D, mid[2]], up: [-1, 0, 0] }, bottom: { p: [mid[0], mid[1] - D, mid[2]], up: [-1, 0, 0] },
  };
  const cam = at[view] ?? at.front;
  return (
    <div style={{ width: 600, height: 600, background: '#F4F4F2' }}>
      <Canvas orthographic dpr={1} gl={{ outputColorSpace: SRGBColorSpace, toneMapping: ACESFilmicToneMapping }}
        camera={{ position: cam.p, up: cam.up, zoom: 600 / span, near: 0.1, far: 100 }}
        onCreated={({ camera }) => { camera.lookAt(...mid); camera.updateProjectionMatrix(); (window as unknown as { __sheetReady?: boolean }).__sheetReady = true; }}>
        <hemisphereLight args={['#DCE6F2', '#B8B4AE', 0.9]} />
        <directionalLight position={[-3, 5, 4]} intensity={1.6} />
        <group scale={m.drawScale}>
          <Sheep level={a === 'sheep' ? 2 : 0} state="idle" still model={m} contact={false} />
        </group>
      </Canvas>
    </div>
  );
}
