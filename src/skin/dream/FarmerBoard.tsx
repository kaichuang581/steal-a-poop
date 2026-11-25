/**
 * The farmer board (docs/dream/01-farmer.md, section 2), development only: ?preview=farmer.
 * The built model from the front, back, left, right, above and three-quarter view on the sheet's off-white, each beside
 * the same view cut from Brian's sheet (docs/dream/reference/farmer-sheet.png); the outline match of the front and back
 * views against the sheet (pass mark 0.88) and twelve colour points; and under them every bed pose, in his bedroom,
 * seen from the bed's side. window.__farmerMatch holds the numbers once they are worked out.
 */
import { Canvas, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import { SRGBColorSpace, Vector3 } from 'three';
import type { OrthographicCamera, PerspectiveCamera } from 'three';
import sheetUrl from '../../../docs/dream/reference/farmer-sheet.png';
import { LOOK } from '../look';
import { voxelMaterial } from '../voxel/material';
import { BED, bedroomGeometry } from './bedroom';
import { farmerCells, PIECES, POSES, UNIT } from './farmer';
import type { PoseName } from './farmer';
import { FarmerFigure } from './FarmerFigure';
import { FarmerInBed } from './FarmerInBed';

const PAPER = '#E8E8E2';
/** On the sheet the front figure is 340 px tall, and he is 84 units: so many sheet pixels a unit. */
const PX = 340 / 84, ZOOM = PX / UNIT;
const FEET_Y = 445, FRONT_X = 196, BACK_X = 513;
/** Each view: where it is on the sheet (the cut's left, top), and where the camera stands round him. */
const VIEWS = [
  { id: 'front', label: 'Front', cut: [31, 85], dir: [0, 0, 1] },
  { id: 'back', label: 'Back', cut: [348, 85], dir: [0, 0, -1] },
  { id: 'left', label: 'Left side', cut: [670, 85], dir: [1, 0.1, 0.5] },
  { id: 'right', label: 'Right side', cut: [25, 560], dir: [-1, 0.1, 0.12] },
  { id: 'top', label: 'Top-down', cut: [348, 560], dir: [0, 1.15, 1] },
  { id: 'iso', label: 'Three-quarter', cut: [670, 560], dir: [1, 0.85, 1] },
] as const;
const CUT = { w: 330, h: 390 };

function Aim({ dir, y, dist = 6 }: { dir: readonly number[]; y: number; dist?: number }) {
  const camera = useThree((s) => s.camera) as OrthographicCamera;
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    const d = new Vector3(dir[0], dir[1], dir[2]).normalize().multiplyScalar(dist);
    camera.position.set(d.x, y + d.y, d.z);
    camera.lookAt(0, y, 0);
    camera.updateProjectionMatrix();
    invalidate();
  }, [camera, dir, y, dist, invalidate]);
  return null;
}
/** The sheet's own light, near enough: soft and even, the key from over the camera's left shoulder whichever way it looks. */
function StudioLight({ dir }: { dir: readonly number[] }) {
  const d = new Vector3(dir[0], 0, dir[2]).normalize(), side = new Vector3(d.z, 0, -d.x);
  const key = d.clone().multiplyScalar(5).addScaledVector(side, -3).setY(6);
  return (
    <>
      <hemisphereLight args={['#FFFFFF', '#E9E6DE', 2.1]} />
      <directionalLight position={[key.x, key.y, key.z]} intensity={0.9} />
    </>
  );
}
function Standing({ pose = 'stand' }: { pose?: PoseName }) {
  const vox = useMemo(() => voxelMaterial(), []);
  return <FarmerFigure material={vox} pose={POSES[pose]} />;
}

function ModelView({ dir, y = 0.815, clear = PAPER, width = CUT.w, height = CUT.h, onReady }: { dir: readonly number[]; y?: number; clear?: string | null; width?: number; height?: number; onReady?: (c: HTMLCanvasElement) => void }) {
  return (
    <Canvas orthographic frameloop="demand" dpr={1} style={{ width, height, background: clear ?? 'transparent' }}
      gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true, outputColorSpace: SRGBColorSpace, toneMapping: LOOK.toneMapping }}
      camera={{ zoom: ZOOM, near: 0.1, far: 30, position: [0, y, 6] }}
      onCreated={({ gl, scene, camera }) => { if (onReady) requestAnimationFrame(() => requestAnimationFrame(() => { gl.render(scene, camera); onReady(gl.domElement); })); }}>
      <Aim dir={dir} y={y} />
      <StudioLight dir={dir} />
      <Standing />
    </Canvas>
  );
}

// ---------- the match ----------

interface Match { front: number; back: number; points: { name: string; sheet: string; model: string; apart: number }[] }
const MATCH = { w: Math.round(44 * PX), h: Math.round(92 * PX) };
const hexOf = (r: number, g: number, b: number) => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
const toLinear = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const toSrgb = (v: number) => 255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055);
function oklab(hex: string): [number, number, number] {
  const [r, g, b] = [1, 3, 5].map((i) => toLinear(parseInt(hex.slice(i, i + 2), 16) / 255));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b), s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
/** The twelve points of the plan's check, in units on the front view (x: + is his left, the picture's right), the last on the back view. */
const POINTS: { name: string; x: number; y: number; back?: boolean }[] = [
  { name: 'cap', x: 0, y: 79 }, { name: 'band', x: 0, y: 74.5 }, { name: 'face', x: 5, y: 65.5 }, { name: 'eye', x: 4.5, y: 69 },
  { name: 'beard', x: 0, y: 59.5 }, { name: 'nightshirt', x: 2, y: 30 }, { name: 'stripe', x: 4, y: 20 }, { name: 'sleeve', x: 16, y: 37 },
  { name: 'hand', x: 15.5, y: 27 }, { name: 'leg', x: 6.5, y: 7 }, { name: 'slipper', x: 6.5, y: 2.5 }, { name: 'hair at the back', x: 0, y: 66, back: true },
];
/** The colour the model paints at a point of the front (or back) view: its frontmost (or rearmost) cell there. */
function paintedAt(x: number, y: number, back = false): string {
  // His open eyes are paint on the face (farmer.ts), not cells: columns 4 and 5, rows 68 and 69.
  if (!back && [4, 5].includes(Math.round(Math.abs(x))) && [68, 69].includes(Math.floor(y))) return '#3D2818';
  let best: { z: number; c: readonly number[] } | null = null;
  for (const p of PIECES) for (const c of farmerCells().get(p)!.map.values()) {
    if (c.x !== Math.round(back ? -x : x) || c.y !== Math.floor(y)) continue;
    if (!best || (back ? c.z < best.z : c.z > best.z)) best = { z: c.z, c: c.c };
  }
  if (!best) return '#000000';
  return hexOf(toSrgb(best.c[0]), toSrgb(best.c[1]), toSrgb(best.c[2]));
}
function sheetCut(img: HTMLImageElement, cx: number): ImageData {
  const c = document.createElement('canvas');
  c.width = MATCH.w; c.height = MATCH.h;
  const g = c.getContext('2d')!, bottom = FEET_Y + Math.round(4 * PX);
  g.drawImage(img, cx - MATCH.w / 2, bottom - MATCH.h, MATCH.w, MATCH.h, 0, 0, MATCH.w, MATCH.h);
  return g.getImageData(0, 0, MATCH.w, MATCH.h);
}
/** How well two outlines agree, from the cap's top down to the hem: shared area over total area, the best of a few px either way. */
function overlap(sheet: ImageData, model: HTMLCanvasElement): number {
  const c = document.createElement('canvas');
  c.width = MATCH.w; c.height = MATCH.h;
  const g = c.getContext('2d')!;
  g.drawImage(model, 0, 0, MATCH.w, MATCH.h);
  const m = g.getImageData(0, 0, MATCH.w, MATCH.h).data, s = sheet.data, bg = [s[(3 * MATCH.w + 3) * 4], s[(3 * MATCH.w + 3) * 4 + 1], s[(3 * MATCH.w + 3) * 4 + 2]];
  const hem = MATCH.h - Math.round((4 + 9.5) * PX);
  const inSheet = (x: number, y: number) => { const i = (y * MATCH.w + x) * 4; return Math.max(Math.abs(s[i] - bg[0]), Math.abs(s[i + 1] - bg[1]), Math.abs(s[i + 2] - bg[2])) > 13; };
  let best = 0;
  for (let dx = -4; dx <= 4; dx++) {
    let both = 0, either = 0;
    for (let y = 0; y < hem; y++) for (let x = 0; x < MATCH.w; x++) {
      const a = inSheet(x, y), xm = x - dx, b = xm >= 0 && xm < MATCH.w && m[(y * MATCH.w + xm) * 4 + 3] > 127;
      if (a && b) both++;
      if (a || b) either++;
    }
    best = Math.max(best, both / either);
  }
  return best;
}
/**
 * The sheet's colour at a point. The sheet is a picture, not a grid: a stripe or the cap's band is four pixels across
 * and may sit a pixel or two off the model's column, so the sheet's pixel nearest the model's colour within one unit
 * of the point is the one compared.
 */
function sheetColour(img: HTMLImageElement, cx: number, x: number, y: number, model: string): string {
  const R = 4, n = 2 * R + 1, c = document.createElement('canvas');
  c.width = n; c.height = n;
  const g = c.getContext('2d')!;
  g.drawImage(img, Math.round(cx + x * PX) - R, Math.round(FEET_Y - y * PX) - R, n, n, 0, 0, n, n);
  const d = g.getImageData(0, 0, n, n).data, want = oklab(model);
  let best = '#000000', near = Infinity;
  for (let i = 0; i < n * n * 4; i += 4) {
    const hex = hexOf(d[i], d[i + 1], d[i + 2]), a = oklab(hex), apart = Math.hypot(a[0] - want[0], a[1] - want[1], a[2] - want[2]);
    if (apart < near) { near = apart; best = hex; }
  }
  return best;
}

function MatchPanel() {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [views, setViews] = useState<{ front?: HTMLCanvasElement; back?: HTMLCanvasElement }>({});
  const [match, setMatch] = useState<Match | null>(null);
  useEffect(() => { const i = new Image(); i.onload = () => setImg(i); i.src = sheetUrl; }, []);
  useEffect(() => {
    if (!img || !views.front || !views.back) return;
    const points = POINTS.map((p) => {
      const model = paintedAt(p.x, p.y, p.back), sheet = sheetColour(img, p.back ? BACK_X : FRONT_X, p.back ? -p.x : p.x, p.y, model);
      const a = oklab(sheet), b = oklab(model);
      return { name: p.name, sheet, model, apart: Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) };
    });
    const m = { front: overlap(sheetCut(img, FRONT_X), views.front), back: overlap(sheetCut(img, BACK_X), views.back), points };
    setMatch(m);
    (window as Window & { __farmerMatch?: Match }).__farmerMatch = m;
  }, [img, views]);
  const y = ((88 - 4) / 2) * UNIT;
  return (
    <section style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      <div>
        <h2 style={H2}>Outline match</h2>
        <div style={{ display: 'flex', gap: 12 }}>
          {(['front', 'back'] as const).map((id) => (
            <figure key={id} style={{ margin: 0 }}>
              <div style={{ position: 'relative', width: MATCH.w, height: MATCH.h, background: PAPER }}>
                <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${sheetUrl})`, backgroundPosition: `${-((id === 'front' ? FRONT_X : BACK_X) - MATCH.w / 2)}px ${-(FEET_Y + Math.round(4 * PX) - MATCH.h)}px`, opacity: 0.55 }} />
                <div style={{ position: 'absolute', inset: 0, opacity: 0.55 }}>
                  <ModelView dir={id === 'front' ? [0, 0, 1] : [0, 0, -1]} y={y} clear={null} width={MATCH.w} height={MATCH.h} onReady={(c) => setViews((v) => ({ ...v, [id]: c }))} />
                </div>
              </div>
              <figcaption style={CAP}>{id === 'front' ? 'Front' : 'Back'}, model over sheet: <b>{match ? match[id].toFixed(3) : 'working it out'}</b> {match ? (match[id] >= 0.88 ? '(passes 0.88)' : '(under 0.88)') : ''}</figcaption>
            </figure>
          ))}
        </div>
      </div>
      <div>
        <h2 style={H2}>Twelve colour points</h2>
        <table style={{ borderCollapse: 'collapse', font: '13px/1.5 system-ui', color: '#333' }}>
          <thead><tr><th style={TH}>Point</th><th style={TH}>Sheet</th><th style={TH}>Model</th><th style={TH}>Apart</th></tr></thead>
          <tbody>
            {(match?.points ?? []).map((p) => (
              <tr key={p.name}>
                <td style={TD}>{p.name}</td>
                <td style={TD}><span style={{ ...SW, background: p.sheet }} />{p.sheet}</td>
                <td style={TD}><span style={{ ...SW, background: p.model }} />{p.model}</td>
                <td style={{ ...TD, fontVariantNumeric: 'tabular-nums' }}>{p.apart.toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ---------- the poses, in his bed ----------

/** The bed's side camera (plan file 01, section 4): on the room's open side, 0.35 m above the mattress, looking straight at the bed's long side. */
function BedCamera() {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => { camera.position.set(1.0, BED.mattress.top + 0.35, 4.6); camera.lookAt(1.0, BED.mattress.top + 0.35, 0); camera.updateProjectionMatrix(); invalidate(); }, [camera, invalidate]);
  return null;
}
function BedView({ pose }: { pose: PoseName }) {
  const b = useMemo(() => bedroomGeometry(), []);
  const vox = useMemo(() => voxelMaterial(), []);
  const mark = useRef(0);
  return (
    <Canvas frameloop="demand" dpr={1.5} style={{ width: 760, height: 380, background: '#141836' }}
      gl={{ antialias: true, outputColorSpace: SRGBColorSpace, toneMapping: LOOK.toneMapping }} camera={{ fov: 20, near: 0.1, far: 30 }}
      onCreated={({ invalidate }) => { mark.current = window.setTimeout(() => invalidate(), 300); }}>
      <BedCamera />
      {/* The board's own even light, so every pose reads: the game lights the room with its lamp and candle. */}
      <hemisphereLight args={['#B4B8F0', '#6A5A50', 2.1]} />
      <directionalLight position={[2, 3, 4]} color="#FFE2C4" intensity={1.6} />
      <mesh geometry={b.room} material={vox} />
      <mesh geometry={b.clock} material={vox} position={[0.4, 0.625, -0.84]} rotation={[0, 0.75, 0]} />
      <FarmerInBed material={vox} pose={POSES[pose]} />
    </Canvas>
  );
}

const H2: React.CSSProperties = { font: '600 15px system-ui', color: '#333', margin: '0 0 8px' };
const CAP: React.CSSProperties = { font: '13px system-ui', color: '#444', marginTop: 4 };
const TH: React.CSSProperties = { textAlign: 'left', padding: '2px 10px 2px 0', borderBottom: '1px solid #bbb' };
const TD: React.CSSProperties = { padding: '2px 10px 2px 0' };
const SW: React.CSSProperties = { display: 'inline-block', width: 14, height: 14, marginRight: 6, verticalAlign: -2, border: '1px solid #0002' };
const BED_POSES: { pose: PoseName; says: string }[] = [
  { pose: 'bedSleep', says: 'bedSleep: stages 1 and 2' },
  { pose: 'bedDeep', says: 'bedDeep: stage 3, the finale, the “drifted off” results' },
  { pose: 'bedStir', says: 'bedStir: the fence is close' },
  { pose: 'bedJolt', says: 'bedJolt: a bump' },
  { pose: 'bedUpright', says: 'bedUpright: the “woke up” results' },
];

export function FarmerBoard() {
  const only = new URLSearchParams(location.search).get('part');
  return (
    <main style={{ position: 'fixed', inset: 0, overflow: 'auto', background: PAPER, padding: 20 }} data-farmer-board>
      {only !== 'poses' && (
        <>
          <h1 style={{ font: '700 20px system-ui', color: '#222', margin: '0 0 12px' }}>The farmer: the model beside the sheet</h1>
          <section style={{ display: 'grid', gridTemplateColumns: `repeat(3, ${CUT.w * 2 + 8}px)`, gap: 16, marginBottom: 20 }}>
            {VIEWS.map((v) => (
              <figure key={v.id} style={{ margin: 0 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ width: CUT.w, height: CUT.h, backgroundImage: `url(${sheetUrl})`, backgroundPosition: `${-v.cut[0]}px ${-v.cut[1]}px` }} />
                  <ModelView dir={v.dir} />
                </div>
                <figcaption style={CAP}>{v.label}: the sheet, then the model</figcaption>
              </figure>
            ))}
          </section>
          <MatchPanel />
        </>
      )}
      {only !== 'views' && (
        <>
          <h1 style={{ font: '700 20px system-ui', color: '#222', margin: '24px 0 12px' }}>His poses, in his bed, from the bed's side</h1>
          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 760px)', gap: 16 }}>
            {BED_POSES.map((p) => (
              <figure key={p.pose} style={{ margin: 0 }}>
                <BedView pose={p.pose} />
                <figcaption style={CAP}>{p.says}</figcaption>
              </figure>
            ))}
          </section>
        </>
      )}
    </main>
  );
}
