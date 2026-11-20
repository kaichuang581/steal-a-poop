/**
 * The painted-miniature plan's review page (docs/miniature/04, section 7), development only (PaintedApp's PREVIEW):
 *   ?preview=mini&piece=<name>   one kit object (voxel/microKit.ts) or one Home model (barn, silo, coop, tractor,
 *       farmhouse, pine, fence, gate, snowman, orchardTree, or an animal), alone on a slab of snow against a plain
 *       background, with the player's sheep beside it for scale: two three-quarter views from opposite corners, a
 *       front view and a top view, none with perspective.
 *   ?preview=mini&sheet=kit      every kit object in rows, at one scale, each on its own slab.
 *   ?preview=mini&sheet=home     every Home model in rows, at one scale: the picture to hold next to the reference.
 * Lit as Home is by day (table/Rendering.tsx, `DAYLIGHT`), with the ground's shade map baked from what is on the page.
 * The slabs exist only here. `document.body.dataset.miniReady` is '1' once drawn (tools/miniature/shots.mjs waits for it).
 * A cluster is photographed on Home itself, where the wall it stands against is (`shots.mjs cluster <name>`).
 */
import { Canvas, useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { NeutralToneMapping, PCFShadowMap } from 'three';
import type { BufferGeometry, DirectionalLight, OrthographicCamera } from 'three';
import { ANIMAL_AVATAR_IDS as ANIMALS } from '../../avatars/ids';
import type { Animal } from '../avatars/catalog';
import { DAYLIGHT, LIGHT_BOUNDS, SUN } from '../table/Rendering';
import { Sheep } from '../table/Sheep';
import { animalModel } from '../voxel/animals';
import { bakeShade, noteShade } from '../voxel/groundShade';
import { voxelMaterial } from '../voxel/material';
import { buildGeometry } from '../voxel/mesher';
import type { Voxel } from '../voxel/mesher';
import { MICRO } from '../voxel/micro';
import { KIT } from '../voxel/microKit';
import { solid } from '../voxel/paint';
import { Grid } from '../voxel/primitives';
import { farmPiece } from './farmstead';
import type { PieceGrid } from './farmstead';
import { yardPiece } from './yard';

const BACKGROUND = '#F4F1EC';
/** The slab's own grid, and how far it reaches past what stands on it. */
const SLAB = 0.2;
/** Every kit object as the sheets show it: the options that show the most of it. */
const KIT_SHOWN: [string, Record<string, unknown>?][] = [
  ['crate', { snow: true }], ['crateOpen', { contents: 'apples' }], ['crateOpen', { contents: 'carrots' }], ['barrel', { snow: true }], ['milkCan'],
  ['pail', { contents: 'ice' }], ['pail', { contents: 'hay' }], ['pail', { contents: 'empty' }], ['sack'], ['pitchfork'], ['shovel'], ['broom'], ['wallLantern'],
  ['squareBale', { snow: true }], ['hayHeap'], ['choppingBlock'], ['splitLogs'], ['handPump'], ['cartWheel'], ['bench', { snow: true }], ['eggBasket'], ['skates'],
  ['shutter'], ['strapHinge'], ['latch'], ['knob'], ['horseshoe'], ['ropeCoil'], ['hoistRope'], ['cleat'],
];
const HOME_MODELS = ['barn', 'farmhouse', 'silo', 'coop', 'tractor', 'pine', 'orchardTree', 'fence', 'gate', 'snowman'];

interface Item { name: string; grids: PieceGrid[]; animal?: Animal }
/** What a name on the address shows: a kit object, a Home model or an animal. */
function itemOf(name: string, options?: Record<string, unknown>): Item | null {
  if (KIT[name]) { const o = KIT[name](options ?? KIT_SHOWN.find(([k]) => k === name)?.[1]); return { name, grids: [{ vox: o.cubes.map, size: MICRO }, ...(o.lit ? [{ vox: o.lit.map, size: MICRO, glow: true }] : [])] }; }
  if ((ANIMALS as readonly string[]).includes(name)) return { name, grids: [], animal: name as Animal };
  const grids = farmPiece(name) ?? yardPiece(name);
  return grids ? { name, grids } : null;
}

interface Laid { item: Item; at: [number, number]; solid: BufferGeometry[]; plain: BufferGeometry[]; glow: BufferGeometry[]; slab: BufferGeometry; box: { w: number; h: number; d: number } }
/** The stage: every item on its slab, set out in rows inside the shade map's own ground, and the box they fill. */
function layOut(items: Item[], rowWidth: number, scaleSheep: boolean, MARGIN: number, gap: number) {
  const laid: Laid[] = [];
  let x = -40, z = -12, rowDepth = 0;
  const all = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity, top: 0 };
  for (const item of items) {
    // The box the item's cubes fill, in metres (an animal: a box its own size).
    const lo = [Infinity, 0, Infinity], hi = [-Infinity, 0, -Infinity];
    for (const g of item.grids) for (const v of g.vox.values()) {
      lo[0] = Math.min(lo[0], v.x * g.size), hi[0] = Math.max(hi[0], (v.x + 1) * g.size);
      lo[2] = Math.min(lo[2], v.z * g.size), hi[2] = Math.max(hi[2], (v.z + 1) * g.size);
      hi[1] = Math.max(hi[1], (v.y + 1) * g.size);
    }
    if (item.animal) { lo[0] = lo[2] = -0.7; hi[0] = hi[2] = 0.7; hi[1] = 1.6; }
    const w = hi[0] - lo[0] + (scaleSheep ? 1.8 : 0), d = hi[2] - lo[2], slabW = Math.ceil((w + MARGIN * 2) / SLAB), slabD = Math.ceil((d + MARGIN * 2) / SLAB);
    if (x + slabW * SLAB > -40 + rowWidth && x > -40) { x = -40; z += rowDepth + gap; rowDepth = 0; }
    // Whole cells of the coarsest grid, so every cube of the item stays on its own grid where it lands.
    const snap = (m: number) => Math.round(m / SLAB) * SLAB, dx = snap(x + MARGIN - lo[0]), dz = snap(z + MARGIN - lo[2]);
    const slab = new Grid(SLAB), sx = Math.round(x / SLAB), sz = Math.round(z / SLAB);
    for (let i = 0; i < slabW; i++) for (let k = 0; k < slabD; k++) { slab.set(sx + i, -1, sz + k, solid('snow', 0)); slab.set(sx + i, -2, sz + k, solid('snow', -1)); }
    const out: Laid = { item, at: [dx, dz], solid: [], plain: [], glow: [], slab: buildGeometry(slab.map, SLAB), box: { w: slabW * SLAB, h: hi[1], d: slabD * SLAB } };
    for (const g of item.grids) {
      const geo = buildGeometry(g.vox, g.size, { ao: !g.plain && !g.glow });
      geo.translate(dx, 0, dz);
      (g.glow ? out.glow : g.plain ? out.plain : out.solid).push(geo);
      const ox = Math.round(dx / g.size), oz = Math.round(dz / g.size);
      noteShade((function* (): Generator<Voxel> { for (const v of g.vox.values()) yield { ...v, x: v.x + ox, z: v.z + oz }; })(), g.size);
    }
    laid.push(out);
    all.minX = Math.min(all.minX, x), all.maxX = Math.max(all.maxX, x + slabW * SLAB), all.minZ = Math.min(all.minZ, z), all.maxZ = Math.max(all.maxZ, z + slabD * SLAB), all.top = Math.max(all.top, hi[1]);
    x += slabW * SLAB + gap;
    rowDepth = Math.max(rowDepth, slabD * SLAB);
  }
  bakeShade();
  return { laid, all };
}

type View = { yaw: number; pitch: number };
/** Fits the camera (no perspective) to the stage from a view, and the day's light to the camera, as Home's is. */
function Look({ view, all }: { view: View; all: { minX: number; maxX: number; minZ: number; maxZ: number; top: number } }) {
  const { camera, size, scene, gl, invalidate } = useThree();
  const mid = useMemo(() => [(all.minX + all.maxX) / 2, all.top / 2 - 0.2, (all.minZ + all.maxZ) / 2] as const, [all]);
  const w = all.maxX - all.minX, d = all.maxZ - all.minZ, h = all.top + 0.4, reach = Math.hypot(w, d, h);
  const sun = useMemo(() => {
    const day = DAYLIGHT.day, el = (day.sunElevationDeg * Math.PI) / 180, az = view.yaw + (day.sunAzimuthOffsetDeg * Math.PI) / 180; // behind the camera and to its side, as on Home
    return [mid[0] + Math.sin(az) * Math.cos(el) * reach, mid[1] + Math.sin(el) * reach, mid[2] + Math.cos(az) * Math.cos(el) * reach] as [number, number, number];
  }, [view, mid, reach]);
  useEffect(() => {
    const cam = camera as OrthographicCamera, cp = Math.cos(view.pitch), sp = Math.sin(view.pitch);
    cam.position.set(mid[0] + Math.sin(view.yaw) * cp * reach * 2, mid[1] + sp * reach * 2, mid[2] + Math.cos(view.yaw) * cp * reach * 2);
    cam.up.set(0, view.pitch > 1.5 ? 0 : 1, view.pitch > 1.5 ? -1 : 0); // straight down: north is up the picture
    cam.lookAt(mid[0], mid[1], mid[2]);
    // What the stage spans across and up the screen from here, with a little air round it.
    const across = Math.abs(Math.cos(view.yaw)) * w + Math.abs(Math.sin(view.yaw)) * d, deep = Math.abs(Math.sin(view.yaw)) * w + Math.abs(Math.cos(view.yaw)) * d;
    cam.zoom = Math.min(size.width / (across * 1.12), size.height / ((deep * sp + h * cp) * 1.12));
    cam.near = 0.1, cam.far = reach * 6;
    cam.updateProjectionMatrix();
    gl.toneMapping = NeutralToneMapping;
    gl.toneMappingExposure = DAYLIGHT.day.exposure;
    gl.shadowMap.type = PCFShadowMap;
    scene.userData.groundShade = true;
    invalidate();
    const t = setTimeout(() => { document.body.dataset.miniReady = '1'; }, 600);
    return () => clearTimeout(t);
  }, [camera, size, scene, gl, invalidate, view, mid, w, d, h, reach]);
  const light = (l: DirectionalLight | null) => {
    if (!l) return;
    l.target.position.set(mid[0], mid[1], mid[2]);
    l.target.updateMatrixWorld();
    const c = l.shadow.camera;
    c.left = c.bottom = -reach * 0.62, c.right = c.top = reach * 0.62, c.near = 0.1, c.far = reach * 3;
    c.updateProjectionMatrix();
    l.shadow.mapSize.set(4096, 4096);
    l.shadow.bias = -0.0004, l.shadow.normalBias = 0.02, l.shadow.radius = 2.5;
  };
  return (
    <>
      <color attach="background" args={[BACKGROUND]} />
      <hemisphereLight args={[LIGHT_BOUNDS.fillSky, LIGHT_BOUNDS.fillGround, DAYLIGHT.day.fill]} />
      <directionalLight ref={light} position={sun} color={SUN.day.color} intensity={DAYLIGHT.day.sun} castShadow />
    </>
  );
}

function Stage({ laid, all, view, scaleSheep }: { laid: Laid[]; all: Parameters<typeof Look>[0]['all']; view: View; scaleSheep: boolean }) {
  const mat = useMemo(() => voxelMaterial(), []);
  const glow = useMemo(() => voxelMaterial({ emissive: '#FFB84A', emissiveIntensity: 0.85 }), []);
  return (
    <>
      <Look view={view} all={all} />
      {laid.map((l, i) => (
        <group key={i}>
          <mesh geometry={l.slab} material={mat} receiveShadow />
          {[...l.solid, ...l.plain].map((g, k) => <mesh key={k} geometry={g} material={mat} castShadow receiveShadow />)}
          {l.glow.map((g, k) => <mesh key={`g${k}`} geometry={g} material={glow} />)}
          {l.item.animal && (
            <group position={[l.at[0], 0, l.at[1]]} rotation={[0, Math.PI / 4, 0]} scale={1.5 * animalModel(l.item.animal).drawScale}>
              <Sheep level={2} state="idle" reduced model={l.item.animal === 'sheep' ? undefined : animalModel(l.item.animal)} />
            </group>
          )}
          {/* The player's sheep at the game's size, on the slab's east end, for scale. */}
          {scaleSheep && !l.item.animal && (
            <group position={[all.maxX - 0.9, 0, (all.minZ + all.maxZ) / 2]} rotation={[0, Math.PI / 4, 0]} scale={1.5}><Sheep level={2} state="idle" reduced /></group>
          )}
        </group>
      ))}
    </>
  );
}

const THREE_QUARTER = (35 * Math.PI) / 180;
const PIECE_VIEWS: View[] = [{ yaw: Math.PI / 4, pitch: THREE_QUARTER }, { yaw: (Math.PI * 5) / 4, pitch: THREE_QUARTER }, { yaw: 0, pitch: 0.06 }, { yaw: 0, pitch: Math.PI / 2 }];

export function MiniPreview() {
  const q = useMemo(() => new URLSearchParams(location.search), []);
  const piece = q.get('piece'), sheet = q.get('sheet');
  const built = useMemo(() => {
    const items = piece ? [itemOf(piece)] : sheet === 'kit' ? KIT_SHOWN.map(([k, o]) => itemOf(k, o ?? {})) : [...HOME_MODELS, ...ANIMALS].map((n) => itemOf(n));
    const found = items.filter((i): i is Item => !!i);
    return found.length ? layOut(found, sheet === 'kit' ? 7.4 : 64, !!piece, sheet === 'kit' ? 0.2 : 0.6, sheet === 'kit' ? 0.2 : 0.8) : null;
  }, [piece, sheet]);
  if (!built) return <p style={{ padding: 24, font: '16px sans-serif' }}>?preview=mini&amp;piece=&lt;name&gt; or &amp;sheet=kit|home. Nothing is called "{piece ?? sheet}".</p>;
  const views = piece ? PIECE_VIEWS : [PIECE_VIEWS[0]];
  return (
    <div style={{ position: 'fixed', inset: 0, background: BACKGROUND, display: 'grid', gridTemplateColumns: piece ? '1fr 1fr' : '1fr', gridTemplateRows: piece ? '1fr 1fr' : '1fr' }}>
      {views.map((view, i) => (
        <Canvas key={i} orthographic shadows frameloop="demand" gl={{ antialias: true, preserveDrawingBuffer: true }} dpr={1}>
          <Stage laid={built.laid} all={built.all} view={view} scaleSheep={!!piece} />
        </Canvas>
      ))}
    </div>
  );
}
