import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useState } from 'react';
import type { MutableRefObject } from 'react';
import {
  BoxGeometry, BufferGeometry, Color, DirectionalLight, Float32BufferAttribute, Fog, Group, HemisphereLight, InstancedMesh, Mesh,
  MeshBasicMaterial, MeshLambertMaterial, Object3D, PlaneGeometry, Points, ShaderMaterial,
} from 'three';
import type { PerspectiveCamera, Scene } from 'three';
import { FIELD } from '../../../dream/dream';
import { hash3 } from '../../voxel/primitives';
import type { StageLive } from '../DreamStage';
import { artScale, camXOf, DREAM_CAM, horizonOf, moonIn, PLAN_M, placeDreamCamera, SIGNPOST } from '../camera';
import { meshModel, toGeometry, tokenColour } from '../models';
import { COLOURS, GLOW, MODELS, PARTS, STRIP_M } from '../models.gen';
import { PX, worldX } from '../stage';
import type { DreamView } from '../stage';
import { animGlow, animUniforms, restAttributes } from './anim';
import { AURORA, buildWorld, copiesFor } from './build';
import type { Strip, Tag, WorldBuild } from './build';
import { lookOf } from '../scene/types';
import type { Look } from '../scene/types';

/**
 * The dream in voxels (docs/dream/v3/02 to 07): the farm, its lift into the air and the bed, built from the pack's
 * models and seen through a camera that looks level across the track (camera.ts). The rules are untouched: the sheep,
 * every obstacle and every sign stand where the side-on mapping always put them; the world scrolls with the lane.
 * This draws only. The dream's loop (DreamScreen) says which world it is, where the gates stand and when a change of
 * world began, in `state`.
 */
import type { DreamWorldState, WorldN } from './state';
import { CHANGE_MS } from './state';
export type { DreamWorldState, WorldN } from './state';
/** Each world's sky fill, main light and haze (v3/02, section 5), the light's strengths in this renderer's units. */
const LIGHT: Record<WorldN, { sky: string; ground: string; fill: number; sun: string; power: number; from: [number, number, number] }> = {
  1: { sky: '#9FB4E8', ground: '#3A4670', fill: 0.6, sun: '#DDE6FF', power: 0.9, from: [-0.3, 0.8, 0.52] },
  2: { sky: '#8FD0CC', ground: '#2A3F5C', fill: 0.6, sun: '#D8F4EE', power: 0.85, from: [-0.3, 0.8, 0.52] },
  3: { sky: '#C9A9B8', ground: '#3A2A40', fill: 0.55, sun: '#FFDDB0', power: 1.0, from: [0.45, 0.75, 0.48] },
};
/** The plan's strengths are for a plain renderer; these turn them into this one's (tuned to the light targets). */
export const LIGHT_GAIN = { fill: 2.2, sun: 3.0 };

const easeIn = (t: number) => { const k = Math.min(1, Math.max(0, t)); return k * k; };
const easeOut = (t: number) => 1 - (1 - Math.min(1, Math.max(0, t))) ** 2;
const easeBack = (t: number) => { const k = Math.min(1, Math.max(0, t)); return k < 0.6 ? 1.1 * easeOut(k / 0.6) : 1.1 - 0.1 * easeOut((k - 0.6) / 0.4); };
const lerpColour = (a: string, b: string, k: number) => new Color(a).lerp(new Color(b), Math.min(1, Math.max(0, k)));

/** Which model the sheep jumps for a look in a world (v3/03, section 8; the build's rule for which look follows which). */
const OBSTACLE: Record<WorldN, Record<Look | 'crate', string>> = {
  1: { rail: 'obGate', picket: 'obPlanks', wall: 'obBrick', log: 'obLogs', bale: 'obBales', crate: 'obCrates' },
  2: { rail: 'obGateIced', picket: 'obPlanksIced', wall: 'obBrickIced', log: 'obLogsIced', bale: 'obBalesIced', crate: 'obCratesIced' },
  3: { rail: 'obPillows', picket: 'obBooks', wall: 'obClock', log: 'obSpools', bale: 'obPillows', crate: 'obBooks' },
};
/** world 1's set gains the crates: every fifth fence (v3/03, section 8). */
const obstacleOf = (world: WorldN, kind: 'fence' | 'bale', index: number) => OBSTACLE[world][kind === 'fence' && index % 5 === 4 ? 'crate' : lookOf(kind, index)];

/** An obstacle's body is drawn 0.70 m wide and 1.05 tall; the drawn rules box decides (v3/03, section 8). */
const BODY = { w: 0.7, h: 1.05 };
const ruleBox = () => {
  const w = Math.round(((1.35 * FIELD.fenceW * PX) / PLAN_M) / 0.05) * 0.05, h = Math.round(((1.35 * FIELD.fenceH * PX) / PLAN_M) / 0.05) * 0.05;
  return { w, h, sx: w / BODY.w, sy: h / BODY.h };
};

interface Props {
  live: MutableRefObject<StageLive>;
  state: MutableRefObject<DreamWorldState>;
  view: DreamView;
  festive: boolean; low: boolean; reduced: boolean; phone: boolean;
  /** The night: the small stars' places. */
  seed: string;
}

export function DreamWorld({ live, state, view, festive, low, reduced, phone, seed }: Props) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const scene = useThree((s) => s.scene) as Scene;
  // World 1 is built at once; the other two in the moments after, a world ahead (v3/02, section 6).
  const [builds, setBuilds] = useState<Partial<Record<WorldN, WorldBuild>>>(() => ({ 1: buildWorld(1, festive, low) }));
  useEffect(() => {
    let off = false;
    const next = (n: WorldN) => setTimeout(() => { if (off) return; const b = buildWorld(n, festive, low); setBuilds((was) => ({ ...was, [n]: b })); if (n === 2) next(3); }, 60);
    const t = next(2);
    return () => { off = true; clearTimeout(t); };
  }, [festive, low]);
  useEffect(() => () => { for (const b of Object.values(builds)) b?.materials.forEach((m) => m.dispose()); }, [builds]);

  // Each world's copies of each strip, laid end to end as the lane runs.
  // Made once for each world built (never again: a group belongs to one parent).
  const made = useMemo(() => new WeakMap<WorldBuild, { root: Group; strips: { s: Strip; copies: Group[] }[]; sub: Record<string, Group> }>(), []);
  const roots = useMemo(() => {
    const out: Partial<Record<WorldN, { root: Group; strips: { s: Strip; copies: Group[] }[]; sub: Record<string, Group> }>> = {};
    for (const [k, b] of Object.entries(builds) as [string, WorldBuild][]) {
      const was = made.get(b);
      if (was) { out[Number(k) as WorldN] = was; continue; }
      const root = new Group(), sub: Record<string, Group> = {};
      const strips = b.strips.map((s) => {
        const holder = (sub[s.tag] ??= new Group());
        const n = copiesFor(s.z, 16.5, DREAM_CAM.CAM);
        const copies = Array.from({ length: n }, () => s.group.clone(true));
        for (const c of copies) holder.add(c);
        const shade = s.tag === 'track' || s.tag === 'lane' || s.tag === 'lining' || s.group.name.includes('@');
        for (const c of copies) c.traverse((o) => { if ((o as Mesh).isMesh) { (o as Mesh).receiveShadow = shade; (o as Mesh).castShadow = s.tag === 'fence'; } });
        return { s, copies };
      });
      for (const g of Object.values(sub)) root.add(g);
      root.visible = false;
      out[Number(k) as WorldN] = { root, strips, sub };
      made.set(b, out[Number(k) as WorldN]!);
    }
    return out;
  }, [builds, made]);

  // The sky: one quad of the world's three colours and the one under the horizon, and the night's small stars.
  useEffect(() => { if (import.meta.env.DEV) Object.assign(window, { __dreamRoots: roots, __dreamCam: camera }); }, [roots, camera]);
  const sky = useMemo(() => skyQuad(), []);
  const stars = useMemo(() => starPoints(seed, phone), [seed, phone]);
  // The moons: the crescent of world 1, the full moon of worlds 2 and 3, hung 420 m away and sized in px.
  const moon = useMemo(() => moonMeshes(), []);
  // The lights: one sky fill and one main light a world, and nothing else real.
  const lights = useMemo(() => {
    const hemi = new HemisphereLight('#9FB4E8', '#3A4670', 1);
    const sun = new DirectionalLight('#DDE6FF', 1);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    // 12 m either side of the sheep, from z -6 to z 3 (v3/02, section 5).
    Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 8, bottom: -8, near: 1, far: 70 });
    sun.shadow.camera.updateProjectionMatrix();
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.02;
    return { hemi, sun };
  }, []);
  const fog = useMemo(() => new Fog('#2D406B', 26, 177), []);
  // The obstacles and their signposts, a few at a time; the gates.
  const kit = useMemo(() => obstacleKit(festive), [festive]);
  const gates = useMemo(() => gateKit(festive), [festive]);
  const particles = useMemo(() => particleKit(low || phone), [low, phone]);
  const moonSheep = useMemo(() => moonSheepKit(), []);

  useEffect(() => {
    const prev = scene.fog;
    scene.fog = fog;
    return () => { scene.fog = prev; };
  }, [scene, fog]);
  useEffect(() => { placeDreamCamera(camera, view); }, [camera, view]);

  useFrame(() => {
    const L = live.current, S = state.current, v = view;
    placeDreamCamera(camera, v);
    const A = artScale(v), camX = camXOf(v);
    const tNow = L.t;
    const ch = S.change, chT = ch ? (tNow - ch.at) / 1000 : 1e4, changing = !!ch && chT * 1000 < CHANGE_MS[ch.to];
    const shown = new Set<WorldN>([S.world]);
    // Under reduced motion a change of world is a cut (v3/07, section 3.5): the old world is gone at once.
    if (changing && ch && !reduced) shown.add(ch.from);
    const sceneX = (dist: number) => worldX(dist - L.dist) / PLAN_M;
    const gateX = ch ? sceneX(ch.dist) : 0;
    const beats = S.beats;

    // ---- the strips, laid end to end along the lane in each world shown
    for (const n of [1, 2, 3] as WorldN[]) {
      const r = roots[n], b = builds[n];
      if (!r || !b) continue;
      r.root.visible = shown.has(n);
      if (!r.root.visible) continue;
      const scroll = (L.dist * PX) / PLAN_M + 32 * (S.laps[n] - 1);
      for (const { s, copies } of r.strips) {
        const hw = (v.w * (DREAM_CAM.CAM - s.z)) / (2 * A * DREAM_CAM.CAM);
        const k0 = Math.floor((camX - hw + scroll) / STRIP_M);
        copies.forEach((c, i) => {
          const x = (k0 + i) * STRIP_M - scroll;
          c.position.x = x;
          c.visible = x < camX + hw + 1;
        });
        // What turns: the windmill's sails, an eighth of a turn each beat over 120 ms; the yarn balls, rolling.
        if (s.pivots) s.pivots.forEach((p, i) => {
          const lift = n === 2 ? (builds[2]?.uniforms.get('islands')?.uLift.value ?? 1) : 1;
          const bob = n === 2 && p.phase >= 0 && !reduced ? 0.18 * Math.sin((2 * Math.PI * beats) / 8 + p.phase) : 0;
          const step = (0.12 * (n === 1 ? 96 : 112)) / 60;
          for (const c of copies) {
            const m = c.children[i];
            if (!m) continue;
            if (p.tag === 'sails') {
              if (!reduced) m.rotation.z = -(Math.PI / 4) * (Math.floor(beats) + Math.min(1, (beats % 1) / step));
              m.position.y = p.y - p.lift * (1 - lift) + bob;
            } else if (!reduced) {
              // Toward -x at 0.6 m a beat along its row, turning as it rolls; round again at the strip's end.
              m.position.x = (((p.x - 0.6 * beats) % STRIP_M) + STRIP_M) % STRIP_M;
              m.rotation.z = (0.6 * beats) / 0.8;
            }
          }
        });
      }
      b.beat.value = reduced ? 0 : beats;
      b.chase.value = S.laps[n] % 2 === 0 ? -1 : 1;
      for (const [, u] of b.uniforms) { u.uBob.value = n === 2 && !reduced ? 1 : 0; u.uTurn.value = n === 3 && !reduced ? 1 : 0; }
      // At rest, unless a change of world below says otherwise.
      for (const g of Object.values(r.sub)) { g.position.y = 0; g.rotation.x = 0; g.visible = true; }
      for (const [, u] of b.uniforms) { u.uGrow.value = 1; u.uLift.value = 1; u.uPop.value = 0; u.uRise.value = 0; u.uReveal.value = 0; u.uWaveT.value = 1e4; u.uGateX.value = gateX; u.uDropT.value = 1e4; u.uDropDir.value = 1; }
    }
    const uni = (n: WorldN, tag: Tag) => builds[n]?.uniforms.get(tag);
    const sub = (n: WorldN, tag: Tag) => roots[n]?.sub[tag];
    // ---- a change of world (v3/07, section 3); under reduced motion a cut
    if (changing && ch && !reduced) {
      if (ch.to === 2) {
        for (const tag of ['ground', 'far'] as Tag[]) { const g = sub(1, tag); if (g) g.position.y = -9 * easeIn(chT / 0.9); }
        const f = sub(1, 'fence');
        if (f) { f.position.y = -6 * easeIn(chT / 0.6); f.rotation.x = -0.7 * easeIn(chT / 0.6); }
        for (const tag of ['track', 'farm', 'string', 'sails'] as Tag[]) { const g = sub(1, tag); if (g) g.visible = false; }
        for (const [tag, u] of builds[2]?.uniforms ?? []) { u.uGrow.value = easeOut(chT / (tag === 'lane' ? 0.5 : 0.4)); u.uLift.value = easeBack((chT - 0.4) / 0.6); }
        AURORA.rise.value = chT - 0.4;
      } else if (ch.to === 3) {
        for (const tag of ['islands', 'string', 'sails', 'aurora'] as Tag[]) { const g = sub(2, tag); if (g) g.position.y = -12 * easeIn(chT / 0.9); }
        AURORA.fade.value = easeIn(chT / 0.5);
        const lane2 = uni(2, 'lane');
        if (lane2) { lane2.uReveal.value = -1; lane2.uWaveT.value = chT; }
        for (const tag of ['lane', 'lining', 'things', 'quilt', 'yarn'] as Tag[]) {
          const u = uni(3, tag);
          if (!u) continue;
          u.uWaveT.value = chT; u.uReveal.value = tag === 'quilt' ? 0 : 1;
          if (tag === 'lane') u.uRise.value = 1;
          if (tag === 'quilt') u.uPop.value = 1;
        }
        const btn = uni(3, 'buttons');
        if (btn) btn.uDropT.value = chT - 0.6;
        const candle = sub(3, 'candle');
        if (candle) candle.position.y = -14 * (1 - easeOut((chT - 0.8) / 0.6));
      } else {
        for (const tag of ['lane', 'lining', 'things', 'yarn'] as Tag[]) { const u = uni(3, tag); if (u) { u.uReveal.value = -1; u.uWaveT.value = chT; } }
        const q = uni(3, 'quilt');
        if (q) { q.uPop.value = -1; q.uWaveT.value = chT; }
        const track = uni(1, 'track');
        if (track) { track.uReveal.value = 1; track.uRise.value = 1; track.uWaveT.value = chT; }
        for (const tag of ['ground', 'far', 'fence', 'string', 'farm', 'sails'] as Tag[]) { const g = sub(1, tag); if (g) g.position.y = -9 * (1 - easeOut((chT - 0.2) / 0.9)); }
        const btn = uni(3, 'buttons');
        if (btn) { btn.uDropDir.value = -1; btn.uDropT.value = chT; }
        const candle = sub(3, 'candle');
        if (candle) candle.position.y = -14 * easeIn(chT / 0.6);
        const far = sub(3, 'far');
        if (far) far.position.y = -6 * easeIn(chT / 0.9);
      }
    } else if (ch && !changing) {
      AURORA.rise.value = 1e4; AURORA.fade.value = 0;
    }
    if (S.world === 2 && !changing) { AURORA.rise.value = 1e4; AURORA.fade.value = 0; }

    // ---- sky, haze and lights: the world's own, or going evenly from one to the next over 1.2 s
    const from = changing && ch && !reduced ? ch.from : S.world, k = changing && ch && !reduced ? Math.min(1, chT / 1.2) : 1;
    const skyA = MODELS_SKY[from], skyB = MODELS_SKY[S.world];
    const su = (sky.material as ShaderMaterial).uniforms;
    for (const key of ['top', 'mid', 'horizon', 'below'] as const) (su[`u_${key}`].value as Color).copy(lerpColour(skyA[key], skyB[key], k));
    su.uHorizon.value = horizonOf(v) / v.h;
    fog.color.copy(lerpColour(skyA.fog, skyB.fog, k));
    const fA = FOG[from], fB = FOG[S.world];
    fog.near = fA.start + (fB.start - fA.start) * k; fog.far = fA.end + (fB.end - fA.end) * k;
    const la = LIGHT[from], lb = LIGHT[S.world];
    lights.hemi.color.copy(lerpColour(la.sky, lb.sky, k)); lights.hemi.groundColor.copy(lerpColour(la.ground, lb.ground, k));
    lights.hemi.intensity = (la.fill + (lb.fill - la.fill) * k) * LIGHT_GAIN.fill;
    lights.sun.color.copy(lerpColour(la.sun, lb.sun, k));
    lights.sun.intensity = (la.power + (lb.power - la.power) * k) * LIGHT_GAIN.sun;
    const dir = la.from.map((c, i) => c + (lb.from[i] - c) * k);
    const sheepX = worldX(FIELD.sheepX + FIELD.sheepW / 2) / PLAN_M;
    lights.sun.position.set(sheepX + dir[0] * 30, dir[1] * 30, dir[2] * 30 - 1.5);
    lights.sun.target.position.set(sheepX, 0, -1.5);
    lights.sun.target.updateMatrixWorld();
    (stars.material as ShaderMaterial).uniforms.uHorizon.value = horizonOf(v) / v.h;
    (stars.material as ShaderMaterial).uniforms.uDpr.value = window.devicePixelRatio || 1;

    // ---- the moon: it belongs to the sky and never moves with the lane
    const showT = S.moonShowAt === null || reduced ? -1 : tNow - S.moonShowAt;
    const beatMs = 60000 / (S.world === 1 ? 96 : S.world === 2 ? 112 : 128);
    const showBeats = showT < 0 ? -1 : showT / beatMs;
    const swell = showBeats < 0 || showBeats > 8 ? 1 : showBeats < 2 ? 1 + 0.6 * easeOut(showBeats / 2) : showBeats < 7 ? 1.6 : 1.6 - 0.6 * easeOut(showBeats - 7);
    const mA = moonIn(v, from), mB = moonIn(v, S.world);
    const mx = mA.x + (mB.x - mA.x) * k, my = mA.y + (mB.y - mA.y) * k, md = (mA.d + (mB.d - mA.d) * k) * swell;
    const full = S.world !== 1 || (changing && ch?.from !== 1 && !reduced && chT < 1.2) || (showBeats >= 0 && showBeats < 8);
    const fillK = changing && ch?.to === 2 && !reduced ? Math.min(1, Math.max(0, (chT - 0.3) / 0.6)) : changing && ch?.to === 1 && !reduced ? 1 - Math.min(1, chT / 1.2) : full ? 1 : 0;
    placeMoon(moon, v, mx, my, md, fillK, camX);
    // The moon show's ten sheep: the game's own sheep as dark shapes, hopping across it from left to right.
    moonSheep.group.visible = showBeats >= 1 && showBeats < 7.2;
    if (moonSheep.group.visible) {
      const z = -400, s = DREAM_CAM.CAM / (DREAM_CAM.CAM - z), wM = md / (A * s);
      const cx = camX + (mx - v.w / 2) / (A * s), cy = DREAM_CAM.EYE - (my - horizonOf(v)) / (A * s);
      moonSheep.sheep.forEach((sh, i) => {
        const p = (showBeats - 1 - i * 0.5) / 1.5;
        sh.visible = p > 0 && p < 1;
        if (!sh.visible) return;
        const len = wM / 5;
        sh.scale.setScalar(len / 1.3);
        sh.position.set(cx - wM / 2 + p * wM, cy - wM * 0.15 + Math.sin(Math.PI * p) * wM * 0.2, z);
      });
    }

    // ---- what the sheep jumps, and the signposts: the rules' boxes, fitted (v3/03, section 8)
    kit.place(L, S, sceneX, reduced, shown);
    // ---- the gates on the lane: scenery only
    gates.place(S, sceneX);
    // ---- snow, rising snow, feathers and the puffs at the hooves
    particles.step(L, S, camX, (L.dist * PX) / PLAN_M, reduced, changing && ch ? { to: ch.to, t: chT } : null);
  });

  return (
    <>
      <primitive object={sky} />
      <primitive object={stars} />
      <primitive object={moon.group} />
      <primitive object={moonSheep.group} />
      <primitive object={lights.hemi} />
      <primitive object={lights.sun} />
      <primitive object={lights.sun.target} />
      {([1, 2, 3] as WorldN[]).map((n) => roots[n] && <primitive key={n} object={roots[n]!.root} dispose={null} />)}
      <primitive object={kit.group} />
      <primitive object={gates.group} />
      <primitive object={particles.group} />
    </>
  );
}

const MODELS_SKY: Record<WorldN, { top: string; mid: string; horizon: string; below: string; fog: string }> = {
  1: { top: '#0E1834', mid: '#1C2B52', horizon: '#2D406B', below: '#2D406B', fog: '#2D406B' },
  2: { top: '#0B1730', mid: '#16304F', horizon: '#235066', below: '#0F2238', fog: '#1E4459' },
  3: { top: '#1A1430', mid: '#2C1F3F', horizon: '#5A3A4A', below: '#241A30', fog: '#4A3340' },
};
/** Haze (v3/02, section 5): from its start distance to full at its end, metres from the camera. */
const FOG: Record<WorldN, { start: number; end: number }> = { 1: { start: 26, end: 177 }, 2: { start: 26, end: 206 }, 3: { start: 20, end: 165 } };

/** The sky: a quad over the whole window, behind everything, three colours from the top to the horizon and one under it. */
function skyQuad(): Mesh {
  const m = new ShaderMaterial({
    depthWrite: false, depthTest: false,
    uniforms: { u_top: { value: new Color() }, u_mid: { value: new Color() }, u_horizon: { value: new Color() }, u_below: { value: new Color() }, uHorizon: { value: 0.4 } },
    vertexShader: /* glsl */ `varying float vY; void main() { vY = 0.5 - position.y * 0.5; gl_Position = vec4( position.xy, 0.9999, 1.0 ); }`,
    fragmentShader: /* glsl */ `
      uniform vec3 u_top, u_mid, u_horizon, u_below; uniform float uHorizon; varying float vY;
      void main() {
        float t = vY / uHorizon;
        vec3 c = t >= 1.0 ? u_below : t < 0.55 ? mix( u_top, u_mid, t / 0.55 ) : mix( u_mid, u_horizon, ( t - 0.55 ) / 0.45 );
        gl_FragColor = vec4( c, 1.0 );
        #include <colorspace_fragment>
      }`,
  });
  const q = new Mesh(new PlaneGeometry(2, 2), m);
  q.frustumCulled = false;
  q.renderOrder = -10;
  return q;
}

/** The night's small stars: squares of #B9C8E6, 2 and 3 px, at 35, 55 and 80%, above the horizon only; 60, 30 on a phone. */
function starPoints(seed: string, phone: boolean): Points {
  const n = phone ? 30 : 60, pos: number[] = [], size: number[] = [], amt: number[] = [];
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) | 0;
  for (let i = 0; i < n; i++) {
    pos.push(hash3(i, 1, 7, h) * 2 - 1, hash3(i, 2, 7, h), 0);
    size.push(hash3(i, 3, 7, h) < 0.7 ? 2 : 3);
    amt.push([0.35, 0.55, 0.8][Math.floor(hash3(i, 4, 7, h) * 3)]);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('size', new Float32BufferAttribute(size, 1));
  g.setAttribute('amount', new Float32BufferAttribute(amt, 1));
  // At the far plane and depth-tested: anything in front of the sky hides them.
  const m = new ShaderMaterial({
    depthWrite: false, depthTest: true, transparent: true,
    uniforms: { uHorizon: { value: 0.4 }, uDpr: { value: 1 }, uColour: { value: new Color('#B9C8E6') } },
    vertexShader: /* glsl */ `
      attribute float size, amount; uniform float uHorizon, uDpr; varying float vA;
      void main() {
        // y from the top of the window to just above the horizon.
        float yTop = 0.02 + position.y * ( uHorizon - 0.06 );
        gl_Position = vec4( position.x, 1.0 - 2.0 * yTop, 0.9998, 1.0 );
        gl_PointSize = floor( size * uDpr + 0.5 );
        vA = amount;
      }`,
    fragmentShader: /* glsl */ `uniform vec3 uColour; varying float vA; void main() { gl_FragColor = vec4( uColour, vA );
#include <colorspace_fragment>
}`,
  });
  const p = new Points(g, m);
  p.frustumCulled = false;
  p.renderOrder = -9;
  return p;
}

interface MoonKit { group: Group; crescent: Mesh; full: Mesh; fullU: ReturnType<typeof animUniforms>; crescentU: ReturnType<typeof animUniforms>; halo: Mesh }
function moonMeshes(): MoonKit {
  const make = (id: string) => {
    const u = animUniforms(), mm = meshModel(id, MODELS[id], COLOURS, GLOW, { festive: true, ao: false });
    const g = toGeometry({ pos: [...mm.lit.pos, ...mm.glow.pos], nor: [...mm.lit.nor, ...mm.glow.nor], col: [...mm.lit.col, ...mm.glow.col], idx: [...mm.lit.idx, ...mm.glow.idx.map((i) => i + mm.lit.pos.length / 3)] });
    const mesh = new Mesh(restAttributes(g), animGlow(u, { uChase: { value: 1 }, uGain: { value: 1 } }));
    mesh.renderOrder = -8;
    return { mesh, u };
  };
  const c = make('moonCrescent'), f = make('moonFull');
  const haloMat = new ShaderMaterial({
    transparent: true, depthWrite: false, blending: 2,
    uniforms: { uColour: { value: new Color(GLOW.moon).multiplyScalar(0.22) } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }`,
    fragmentShader: /* glsl */ `uniform vec3 uColour; varying vec2 vUv; void main() { float r = length( vUv ) * 2.0; float a = pow( max( 0.0, 1.0 - r ), 2.0 ); gl_FragColor = vec4( uColour * a, 1.0 );
#include <colorspace_fragment>
}`,
  });
  const halo = new Mesh(new PlaneGeometry(1, 1), haloMat);
  halo.renderOrder = -7;
  const group = new Group();
  group.add(c.mesh, f.mesh, halo);
  return { group, crescent: c.mesh, full: f.mesh, crescentU: c.u, fullU: f.u, halo };
}
/** The moon at a point of the window (CSS px), `d` px across, as full as `fill` (0 the crescent, 1 the full disc). */
function placeMoon(m: MoonKit, v: DreamView, x: number, y: number, d: number, fill: number, camX: number) {
  const z = -420, A = artScale(v), s = DREAM_CAM.CAM / (DREAM_CAM.CAM - z);
  const wx = camX + (x - v.w / 2) / (A * s), wy = DREAM_CAM.EYE - (y - horizonOf(v)) / (A * s), metres = d / (A * s);
  for (const mesh of [m.crescent, m.full]) { mesh.position.set(wx, wy, z); mesh.scale.setScalar(metres / 32); }
  m.halo.position.set(wx, wy, z + 1);
  m.halo.scale.setScalar(metres * 2.6);
  // It fills one column of its cells at a time, left to right: the full disc shows where the fill has reached.
  const left = wx - metres / 2;
  m.full.visible = fill > 0; m.crescent.visible = fill < 1;
  m.fullU.uReveal.value = fill > 0 && fill < 1 ? 1 : 0; m.fullU.uGateX.value = left; m.fullU.uWaveT.value = (fill * metres) / 16;
  m.crescentU.uReveal.value = fill > 0 && fill < 1 ? -1 : 0; m.crescentU.uGateX.value = left; m.crescentU.uWaveT.value = (fill * metres) / 16;
}

/** The moon show's sheep: the game's own sheep, as a dark shape (ink 0), never shorn, at most four at once on the moon. */
function moonSheepKit(): { group: Group; sheep: Group[] } {
  const group = new Group();
  const mat = new MeshBasicMaterial({ color: new Color(...tokenColour('ink:0', GLOW)), fog: false });
  const sheep: Group[] = [];
  // Built lazily from the sheep model on first use would need the animal module here; its silhouette is the sheep's
  // own boxes at the size the dream draws it, so it is made from the same model the stage runs.
  import('../../voxel/animals').then(({ animalModel }) => {
    const m = animalModel('sheep');
    const parts = [m.wools[2], m.head, m.hood, m.tail, ...m.legs, ...m.ears];
    // One mesh a sheep: its parts' positions gathered at their pivots (a dark shape needs nothing else).
    const pos: number[] = [], idx: number[] = [];
    for (const p of parts) {
      const at = p.geo.getAttribute('position'), base = pos.length / 3, ix = p.geo.getIndex();
      for (let i = 0; i < at.count; i++) pos.push(at.getX(i) + p.pivot[0], at.getY(i) + p.pivot[1], at.getZ(i) + p.pivot[2]);
      if (ix) for (let i = 0; i < ix.count; i++) idx.push(base + ix.getX(i));
      else for (let i = 0; i < at.count; i++) idx.push(base + i);
    }
    const one = new BufferGeometry();
    one.setAttribute('position', new Float32BufferAttribute(pos, 3));
    one.setIndex(idx);
    one.computeBoundingSphere();
    for (let i = 0; i < 10; i++) {
      const g = new Group();
      g.add(new Mesh(one, mat));
      g.rotation.y = Math.PI / 2;
      const holder = new Group();
      holder.add(g);
      holder.visible = false;
      holder.renderOrder = -6;
      group.add(holder);
      sheep.push(holder);
    }
  }).catch(() => {});
  group.visible = false;
  return { group, sheep };
}

/** The obstacles, their lanterns and their signposts: a small pool, one set a fence, moved every frame. */
function obstacleKit(festive: boolean) {
  const group = new Group();
  const box = ruleBox();
  const cache = new Map<string, { body: BufferGeometry; lanterns: BufferGeometry | null; glowBody: BufferGeometry | null }>();
  const geos = (id: string) => {
    let c = cache.get(id);
    if (!c) {
      const m = MODELS[id];
      const body = meshModel(id, m, COLOURS, GLOW, { festive, back: true, parts: maskOf(['body', 'ice']) });
      const lan = meshModel(id, m, COLOURS, GLOW, { festive, back: true, parts: maskOf(['lanterns']) });
      const shift = (box.w - BODY.w) / 2;
      const lg = lan.lit.idx.length || lan.glow.idx.length ? toGeometry(merge(lan.lit, lan.glow)) : null;
      // The lanterns are not stretched: they stay just outside the body's sides, at two thirds of its height.
      if (lg) { const p = lg.getAttribute('position'); for (let i = 0; i < p.count; i++) p.setX(i, p.getX(i) + Math.sign(p.getX(i)) * shift); }
      c = { body: toGeometry(body.lit), lanterns: lg, glowBody: body.glow.idx.length ? toGeometry(body.glow) : null };
      cache.set(id, c);
    }
    return c;
  };
  const post = (() => { const m = meshModel('signpost', MODELS.signpost, COLOURS, GLOW, { festive, back: true }); return toGeometry(m.lit); })();
  const litMat = new MeshLambertMaterial({ vertexColors: true });
  const slots = new Map<number, { g: Group; tilt: Group; body: Mesh; lanterns: Mesh | null; post: Mesh; gain: { value: number }; id: string; litAt: number | null }>();
  const make = (id: string) => {
    const c = geos(id), gain = { value: 0.15 };
    const g = new Group(), tilt = new Group();
    const body = new Mesh(c.body, litMat);
    body.castShadow = true;
    body.scale.set(box.sx, box.sy, 1);
    const lanterns = c.lanterns ? new Mesh(restAttributes(c.lanterns.clone()), animGlow(animUniforms(), { uChase: { value: 1 }, uGain: gain })) : null;
    tilt.add(body);
    if (lanterns) tilt.add(lanterns);
    const p = new Mesh(post, litMat);
    p.castShadow = true;
    g.add(tilt, p);
    group.add(g);
    return { g, tilt, body, lanterns, post: p, gain, id, litAt: null as number | null };
  };
  return {
    group,
    place(L: StageLive & { fences: { index: number; x: number; locked: boolean; passed: boolean; jumped: boolean; knockedAt: number | null; f?: { kind: 'fence' | 'bale' } }[] }, S: DreamWorldState, sceneX: (d: number) => number, reduced: boolean, _shown: Set<WorldN>) {
      const seen = new Set<number>();
      for (const fe of L.fences) {
        const kind = (fe as { f?: { kind: 'fence' | 'bale' } }).f?.kind ?? 'fence';
        const id = obstacleOf(S.worldOf(fe.index), kind, fe.index);
        let s = slots.get(fe.index);
        if (s && s.id !== id) { group.remove(s.g); slots.delete(fe.index); s = undefined; }
        if (!s) { s = make(id); slots.set(fe.index, s); }
        seen.add(fe.index);
        const mid = sceneX(L.dist + fe.x + FIELD.fenceW / 2);
        s.g.position.set(mid, 0, 0);
        s.post.position.set(SIGNPOST.dx, 0, SIGNPOST.z);
        // A bump tips it over about its far foot: to 78 degrees in 400 ms, then it settles at 70 (as built).
        const hitAt = fe.knockedAt ?? (L.crashAt !== null && !fe.passed && !fe.jumped && fe.x < FIELD.sheepX + FIELD.sheepW && fe.x + FIELD.fenceW > FIELD.sheepX ? L.crashAt : null);
        const e = hitAt === null ? 0 : (L.t - hitAt) / 1000;
        const deg = hitAt === null ? 0 : reduced ? 70 : e < 0.4 ? 78 * easeOut(e / 0.4) : e < 0.55 ? 78 - 8 * ((e - 0.4) / 0.15) : 70;
        s.tilt.position.x = box.w / 2; s.body.position.x = -box.w / 2; if (s.lanterns) s.lanterns.position.x = -box.w / 2;
        s.tilt.rotation.z = (-deg * Math.PI) / 180;
        // Its lanterns are dim until its word is taken; then they light to full over 120 ms.
        if (fe.locked && s.litAt === null) s.litAt = L.t;
        if (!fe.locked) s.litAt = null;
        s.gain.value = s.litAt === null ? 0.15 : reduced ? 1 : 0.15 + 0.85 * Math.min(1, (L.t - s.litAt) / 120);
      }
      for (const [i, s] of slots) if (!seen.has(i)) { group.remove(s.g); slots.delete(i); }
    },
  };
}
const maskOf = (names: string[]) => names.reduce((s, n) => (PARTS_INDEX(n) >= 0 ? s | (1 << PARTS_INDEX(n)) : s), 0);
const PARTS_INDEX = (n: string) => PARTS.indexOf(n);
const merge = (a: { pos: number[]; nor: number[]; col: number[]; idx: number[] }, b: typeof a) => ({ pos: [...a.pos, ...b.pos], nor: [...a.nor, ...b.nor], col: [...a.col, ...b.col], idx: [...a.idx, ...b.idx.map((i) => i + a.pos.length / 3)] });

/** The gates (v3/07): the farm gate over the track, the foot and the head of his bed standing behind it. */
function gateKit(festive: boolean) {
  const group = new Group();
  const litMat = new MeshLambertMaterial({ vertexColors: true });
  const glowMat = new MeshBasicMaterial({ vertexColors: true, fog: false });
  const build = (id: string) => {
    const m = meshModel(id, MODELS[id], COLOURS, GLOW, { festive, back: true });
    const g = new Group();
    const body = new Mesh(toGeometry(m.lit), litMat);
    body.castShadow = true;
    g.add(body);
    if (m.glow.idx.length) g.add(new Mesh(toGeometry(m.glow), glowMat));
    return g;
  };
  const farm = build('gateFarm'), foot = build('gateFootboard'), head = build('gateHeadboard');
  // Gate 2 stands where there is no ground: two of the yard's islands under it, end to end, touching the track.
  const yard = meshModel('islandYard', MODELS.islandYard, COLOURS, GLOW, { festive, back: true });
  for (const dx of [-3, 3]) { const i = new Mesh(toGeometry(yard.lit), litMat); i.position.set(dx, 0, -1.0); foot.add(i); }
  for (const g of [farm, foot, head]) { g.visible = false; group.add(g); }
  return {
    group,
    place(S: DreamWorldState, sceneX: (d: number) => number) {
      for (const g of [farm, foot, head]) g.visible = false;
      for (const gate of S.gates) {
        const g = gate.type === 1 ? farm : gate.type === 2 ? foot : head;
        const x = sceneX(gate.dist);
        g.visible = true;
        // Gate 1 stands over the track by its middle; gates 2 and 3 by their left post, at z -1.9.
        if (gate.type === 1) g.position.set(x, 0, 0);
        else g.position.set(x + 3.3, gate.type === 3 ? 0.1 : 0, -1.9);
      }
    },
  };
}

/** Snow (90 cubes, 45 on a phone or Low), feathers (40, 20) and the puffs at the hooves (24 at most). */
function particleKit(few: boolean) {
  const group = new Group();
  const snowN = few ? 45 : 90, featherN = few ? 20 : 40;
  const snowMat = new MeshLambertMaterial({ color: new Color(...tokenColour('snow:2', GLOW)) });
  const snow = new InstancedMesh(new BoxGeometry(0.05, 0.05, 0.05), snowMat, snowN);
  const fm = meshModel('feather', MODELS.feather, COLOURS, GLOW, { festive: true, back: true, ao: false });
  const feathers = new InstancedMesh(toGeometry(fm.lit), new MeshLambertMaterial({ vertexColors: true }), featherN);
  const puffs = new InstancedMesh(new BoxGeometry(0.05, 0.05, 0.05), snowMat, 24);
  for (const m of [snow, feathers, puffs]) { m.frustumCulled = false; group.add(m); }
  const seeds = Array.from({ length: 90 }, (_, i) => ({ x: hash3(i, 1, 3) * 40, y: hash3(i, 2, 3) * 6, z: -14 + hash3(i, 3, 3) * 20, v: 0.6 + hash3(i, 4, 3) * 0.4, r: 0.4 + hash3(i, 5, 3) * 0.3 }));
  const fseeds = Array.from({ length: 40 }, (_, i) => ({ x: hash3(i, 6, 3) * 40, y: hash3(i, 7, 3) * 6, z: -14 + hash3(i, 8, 3) * 20, v: 0.3 + hash3(i, 9, 3) * 0.2, ph: hash3(i, 10, 3) * 6.28 }));
  const O = new Object3D();
  let last = 0, wasAir = false;
  const live: { x: number; z: number; at: number; dx: number }[] = [];
  return {
    group,
    step(L: StageLive, S: DreamWorldState, camX: number, scroll: number, reduced: boolean, change: { to: WorldN; t: number } | null) {
      const t = L.t / 1000, dt = Math.max(0, Math.min(0.05, t - last));
      last = t;
      // Which kind falls: snow down in world 1, snow rising in world 2 (from 450 ms into lift-off), feathers in world 3.
      const w = change && change.t < 0.45 ? (change.to === 2 ? 1 : change.to === 3 ? 2 : 3) : S.world;
      snow.visible = w !== 3; feathers.visible = w === 3;
      const wrap = (x: number) => camX - 20 + ((((x - scroll) % 40) + 40) % 40);
      if (snow.visible) {
        for (let i = 0; i < snowN; i++) {
          const s = seeds[i];
          s.y += (w === 2 ? s.r : -s.v) * dt;
          if (s.y < 0) s.y += 6;
          if (s.y > 6) s.y -= 6;
          O.position.set(wrap(s.x), s.y, s.z); O.rotation.set(0, 0, 0); O.scale.setScalar(1); O.updateMatrix();
          snow.setMatrixAt(i, O.matrix);
        }
        snow.instanceMatrix.needsUpdate = true;
      }
      if (feathers.visible) {
        for (let i = 0; i < featherN; i++) {
          const s = fseeds[i];
          s.y -= s.v * dt;
          if (s.y < 0) s.y += 6;
          O.position.set(wrap(s.x) + (reduced ? 0 : 0.3 * Math.sin(t * 1.6 + s.ph)), s.y, s.z);
          O.rotation.set(0, 0, reduced ? 0 : 0.4 * Math.sin(t * 1.6 + s.ph));
          O.scale.setScalar(1); O.updateMatrix();
          feathers.setMatrixAt(i, O.matrix);
        }
        feathers.instanceMatrix.needsUpdate = true;
      }
      // The hooves: at each landing four snow cubes jump 0.25 m and fall back over 260 ms (world 2: they drift up and
      // stay up; world 3: two feathers would jump, drawn here as two cubes of the sheet's colour).
      const air = L.jumpAt !== null;
      if (wasAir && !air && L.crashAt === null) {
        const hx = worldX(FIELD.sheepX + FIELD.sheepW / 2) / PLAN_M;
        for (let i = 0; i < (S.world === 3 ? 2 : 4); i++) live.push({ x: hx - 0.3 + i * 0.15, z: -0.2 + (i % 2) * 0.4, at: L.t, dx: (i - 1.5) * 0.12 });
        while (live.length > 24) live.shift();
      }
      wasAir = air;
      for (let i = live.length - 1; i >= 0; i--) if (L.t - live[i].at > 260) live.splice(i, 1);
      puffs.count = live.length;
      live.forEach((p, i) => {
        const k = (L.t - p.at) / 260;
        const y = S.world === 2 ? 0.4 * Math.min(1, k * 1.5) : 0.25 * 4 * k * (1 - k);
        O.position.set(p.x + p.dx * k, 0.05 + y, p.z); O.rotation.set(0, 0, 0); O.scale.setScalar(1); O.updateMatrix();
        puffs.setMatrixAt(i, O.matrix);
      });
      puffs.instanceMatrix.needsUpdate = true;
    },
  };
}
