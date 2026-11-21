/**
 * The diorama's development pages (docs/diorama/PLAN.md, 5.3 and 5.4), development only (PaintedApp's PREVIEW):
 *   ?skin=painted&preview=prop&id=<id>&view=34|front|side|top    one recipe on the studio background, 600 x 600; the
 *       three flat views orthographic. window.__propReady is true once drawn, and window.__propParts holds where each
 *       part's most visible face centre lands, as shares of the frame, for tools/propMatch.mjs. &overlay=1 lays the
 *       reference over it at 50%.
 *   ?skin=painted&preview=props     every recipe on the studio board (Brian reviews it once, milestone D2).
 *   ?skin=painted&preview=palette   every palette token as a block under the game's day light (milestone D0's swatches).
 * Each is lit as the game lights the day (table/Rendering.tsx: the sky fill, the sun 20 degrees up, exposure 1), with the
 * game's tone mapping (look.ts: ACES today; ?tm= tries the others).
 */
import { Canvas, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useState } from 'react';
import { Box3, SRGBColorSpace, Vector3 } from 'three';
import type { Camera, OrthographicCamera } from 'three';
import { LOOK } from '../../look';
import { voxelMaterial } from '../../voxel/material';
import { LIGHT_BOUNDS, SUN } from '../../table/Rendering';
import { buildRecipe } from './kit';
import type { Recipe } from './kit';
import { hexOf, LADDER, SEASON, TOKEN_NAMES } from './palette';
import { RECIPES, recipeById } from './recipes';

const STUDIO = hexOf('studio');
// tools/propMatch.mjs reads which recipes there are, and their reference names, from here.
if (typeof window !== 'undefined') (window as Window & { __recipes?: unknown }).__recipes = RECIPES.map((r) => ({ id: r.id, reference: r.reference }));
type W = Window & { __propReady?: boolean; __propParts?: { name: string; token: string; x: number; y: number }[] };

/** The game's day light for a camera looking along `look` (x, z): the sky fill, and the sun 20 degrees up, 35 degrees to the side of the camera (Lights in table/Rendering.tsx). */
function DayLight({ look = [-1, -1] }: { look?: readonly [number, number] }) {
  const yaw = Math.atan2(look[0], look[1]), az = yaw + Math.PI + (LIGHT_BOUNDS.sunAzimuthOffsetDeg * Math.PI) / 180, el = (LIGHT_BOUNDS.sunElevationDeg * Math.PI) / 180;
  return (
    <>
      <hemisphereLight args={[LIGHT_BOUNDS.fillSky, LIGHT_BOUNDS.fillGround, LIGHT_BOUNDS.fillDay]} />
      <directionalLight position={[Math.sin(az) * Math.cos(el) * 20, Math.sin(el) * 20, Math.cos(az) * Math.cos(el) * 20]} color={SUN.day.color} intensity={SUN.day.intensity} />
    </>
  );
}

function RecipeMesh({ r, at = [0, 0, 0] }: { r: Recipe; at?: [number, number, number] }) {
  const meshes = useMemo(() => buildRecipe(r), [r]);
  const mat = useMemo(() => voxelMaterial(), []);
  return <group position={at}>{meshes.map((m) => <mesh key={m.step} geometry={m.geo} material={mat} />)}</group>;
}

/** The box a recipe fills, in metres. */
function boxOf(r: Recipe): Box3 {
  const b = new Box3();
  for (const p of r.parts) {
    const s = LADDER[p.step ?? r.step];
    b.expandByPoint(new Vector3(p.at[0] * s, p.at[1] * s, p.at[2] * s));
    b.expandByPoint(new Vector3((p.at[0] + p.size[0]) * s, (p.at[1] + p.size[1]) * s, (p.at[2] + p.size[2]) * s));
  }
  return b;
}

/** Hands propMatch where each part's face toward the camera lands in the frame. */
function Report({ r, view, mid }: { r: Recipe; view: string; mid: Vector3 }) {
  const { camera, gl } = useThree();
  useEffect(() => {
    camera.lookAt(mid); camera.updateMatrixWorld(); (camera as OrthographicCamera).updateProjectionMatrix(); // onCreated may not have run yet
    const dir = view === 'top' ? [0, 1, 0] : view === 'side' ? [1, 0, 0] : [0, 0, 1];
    const out: NonNullable<W['__propParts']> = [];
    for (const p of r.parts) {
      const s = LADDER[p.step ?? r.step], c = p.at.map((a, i) => (a + p.size[i] / 2) * s);
      const face = c.map((v, i) => v + (dir[i] * p.size[i] * s) / 2);
      const q = new Vector3(face[0], face[1], face[2]).project(camera as Camera);
      out.push({ name: p.name, token: p.token, x: (q.x + 1) / 2, y: (1 - q.y) / 2 });
    }
    (window as W).__propParts = out;
    requestAnimationFrame(() => requestAnimationFrame(() => { (window as W).__propReady = true; }));
  }, [r, view, camera, gl, mid]);
  return null;
}

export function PropPreview() {
  const q = new URLSearchParams(location.search);
  const id = q.get('id') ?? '', view = q.get('view') ?? '34', overlay = q.get('overlay') === '1';
  const r = recipeById(id);
  if (!r) return <p style={{ padding: 16 }}>No recipe "{id}". Recipes: {RECIPES.map((x) => x.id).join(', ') || 'none yet'}.</p>;
  const b = boxOf(r), mid = b.getCenter(new Vector3()), size = b.getSize(new Vector3());
  const span = Math.max(size.x, size.y, size.z) * 1.2, D = 30;
  const cam = view === 'front' ? { p: [mid.x, mid.y, mid.z + D], up: [0, 1, 0] } : view === 'side' ? { p: [mid.x + D, mid.y, mid.z], up: [0, 1, 0] }
    : view === 'top' ? { p: [mid.x, mid.y + D, mid.z], up: [0, 0, -1] } : { p: [mid.x + D * 0.6, mid.y + D * 0.45, mid.z + D * 0.66], up: [0, 1, 0] };
  return (
    <div style={{ position: 'relative', width: 600, height: 600, background: STUDIO }}>
      <Canvas orthographic dpr={1} gl={{ outputColorSpace: SRGBColorSpace, toneMapping: LOOK.toneMapping, preserveDrawingBuffer: true }}
        camera={{ position: cam.p as [number, number, number], up: cam.up as [number, number, number], zoom: 600 / span, near: 0.1, far: 200 }}
        onCreated={({ camera }) => { camera.lookAt(mid); camera.updateProjectionMatrix(); }}>
        <color attach="background" args={[STUDIO]} />
        <DayLight look={[mid.x - cam.p[0], view === 'top' ? -1 : mid.z - cam.p[2]]} />
        <RecipeMesh r={r} />
        <Report r={r} view={view} mid={mid} />
      </Canvas>
      {overlay && view !== '34' && <img alt="" src={`/docs/diorama/reference/${r.reference}-${view}.png`} style={{ position: 'absolute', inset: 0, width: 600, height: 600, objectFit: 'contain', opacity: 0.5, pointerEvents: 'none' }} />}
    </div>
  );
}

/** Every recipe on one studio board, in a row per ladder step, three-quarter view. */
export function PropBoard() {
  const placed = useMemo(() => {
    let x = 0;
    return RECIPES.map((r) => { const s = boxOf(r).getSize(new Vector3()); const at: [number, number, number] = [x + s.x / 2, 0, 0]; x += s.x + 0.6; return { r, at }; });
  }, []);
  const width = placed.length ? placed[placed.length - 1].at[0] + 2 : 4;
  return (
    <div style={{ position: 'fixed', inset: 0, background: STUDIO }}>
      {!RECIPES.length && <p style={{ position: 'absolute', padding: 16, font: '16px system-ui', color: '#555' }}>No recipes yet: they come in milestone D2, each matched against its reference sheet.</p>}
      <Canvas orthographic dpr={1} gl={{ outputColorSpace: SRGBColorSpace, toneMapping: LOOK.toneMapping }}
        camera={{ position: [width / 2 + 18, 14, 20], zoom: 1100 / Math.max(6, width), near: 0.1, far: 300 }}
        onCreated={({ camera }) => { camera.lookAt(width / 2, 0.6, 0); camera.updateProjectionMatrix(); (window as W).__propReady = true; }}>
        <color attach="background" args={[STUDIO]} />
        <DayLight look={[-18, -20]} />
        {placed.map(({ r, at }) => <RecipeMesh key={r.id} r={r} at={at} />)}
      </Canvas>
    </div>
  );
}

/** Every palette token as a 0.4 m block on the studio floor, one value step darker on its left and lighter on its right. */
export function PaletteSwatches() {
  const recipe = (token: (typeof TOKEN_NAMES)[number], value: number): Recipe => ({
    id: `${token}${value}`, step: 'M', footprint: [0.4, 0.4], support: 'floor', detail: 0, reference: '',
    parts: [{ name: token, at: [0, 0, 0], size: [4, 4, 4], token, value }],
  });
  const cols = 6, cells = TOKEN_NAMES.map((t, i) => ({ t, x: (i % cols) * 1.8, z: Math.floor(i / cols) * 2.2 }));
  const rows = Math.ceil(TOKEN_NAMES.length / cols);
  const [labels, setLabels] = useState<{ t: string; x: number; y: number }[]>([]);
  return (
    <div style={{ position: 'fixed', inset: 0, background: STUDIO, font: '13px system-ui', color: '#333' }}>
      <div style={{ position: 'absolute', zIndex: 1, padding: '10px 16px' }}>Palette swatches ({SEASON}): each token in the middle, one value step darker on its left and lighter on its right, under the game's day light; the small square is the paint itself.</div>
      <Canvas orthographic dpr={2} gl={{ outputColorSpace: SRGBColorSpace, toneMapping: LOOK.toneMapping }}
        camera={{ position: [cols * 0.9, 14, rows * 1.1 + 16], zoom: 95, near: 0.1, far: 100 }}
        onCreated={({ camera }) => { camera.lookAt(cols * 0.9 - 0.3, 0, rows * 1.1 - 0.6); camera.updateProjectionMatrix(); (window as W).__propReady = true; }}>
        <color attach="background" args={[STUDIO]} />
        <DayLight look={[0, -1]} />
        {cells.map(({ t, x, z }) => (
          <group key={t} position={[x, 0, z]}>
            {[-1, 0, 1].map((v) => <RecipeMesh key={v} r={recipe(t, v)} at={[v * 0.45, 0, 0]} />)}
          </group>
        ))}
        <Place points={cells.map((c) => ({ t: c.t, p: [c.x + 0.2, 0, c.z + 0.95] as const }))} onPlace={setLabels} />
      </Canvas>
      {labels.map((l) => (
        <div key={l.t} style={{ position: 'absolute', left: l.x, top: l.y, transform: 'translateX(-50%)', textAlign: 'center', lineHeight: 1.2, whiteSpace: 'nowrap' }}>
          {l.t}<br /><span style={{ display: 'inline-block', width: 12, height: 12, verticalAlign: -2, marginRight: 4, border: '1px solid #0002', background: hexOf(l.t as (typeof TOKEN_NAMES)[number]) }} /><span style={{ color: '#888' }}>{hexOf(l.t as (typeof TOKEN_NAMES)[number])}</span>
        </div>
      ))}
    </div>
  );
}

/** Where some points land on the page, in pixels, once the camera is set. */
function Place({ points, onPlace }: { points: { t: string; p: readonly [number, number, number] }[]; onPlace: (v: { t: string; x: number; y: number }[]) => void }) {
  const { camera, size } = useThree();
  useEffect(() => {
    const id = requestAnimationFrame(() => onPlace(points.map(({ t, p }) => { const q = new Vector3(...p).project(camera); return { t, x: ((q.x + 1) / 2) * size.width, y: ((1 - q.y) / 2) * size.height }; })));
    return () => cancelAnimationFrame(id);
  }, [camera, size]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
