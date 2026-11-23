import { Canvas, addAfterEffect, invalidate, useFrame, useStore, useThree } from '@react-three/fiber';
import type { CanvasProps } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ACESFilmicToneMapping, Color, FogExp2, HalfFloatType, NeutralToneMapping, PCFShadowMap, Vector2, WebGLRenderTarget } from 'three';
import type { DirectionalLight, HemisphereLight, PointLight, ToneMapping } from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { doorsShut } from '../components/BarnDoors';
import { STUDIO } from '../voxel/material';
import type { Hour } from '../model/types';
import { createPacer, newPace, noteSceneDrawn } from '../perf/governor';
import type { Pace } from '../perf/governor';
import { FailCard } from '../perf/ReportCard';
import { watchScene } from '../perf/report';
import { applyPendingTier, createSlowWatch, createTierJudge, exemptShot, getTier, oldLightShot, proposeTier } from '../perf/tier';
import type { Tier } from '../perf/tier';
import { BARN } from '../scene/layout';
import { LOOK, PADDOCK_FOG, WARM_DAY_SKY } from '../look';

/** The look, applied once and globally (plan V3.1 Part 1.3). */
// A warm white Christmas that is still winter (Brian, 2026-11-08: "warmer and more welcoming ... it looks a little dark"):
// the day's haze is a warm white rather than icy blue, and the night's a softer navy.
export const FOG: Record<Hour, string> = { dawn: '#F3CDB9', day: '#CED6DF', dusk: '#D49AA8', night: '#323E68' };
// The hours by key colour (plan file 02, change 2): dawn pink and cool, dusk amber and warm, where both were #FFD3A8.
// Colour only: the strengths, the angle, the fill and the exposure are as they were.
export const SUN: Record<Hour, { color: string; intensity: number }> = {
  dawn: { color: '#FFD6C4', intensity: 1.55 },
  day: { color: '#FFE8C8', intensity: 1.85 },
  dusk: { color: '#FFC08A', intensity: 1.7 },
  night: { color: '#C6CDE4', intensity: 1.15 }, // moonlight, less blue than it was; the lanterns carry the barn
};
/**
 * The diorama's light (Brian, 2026-11-19: "disregard all prior limits besides what i said about touching the wendigo";
 * his farm picture is lit like a soft studio): a high, gentle key and a strong sky fill, so snow reads white, shadows are
 * short and open, and colours are their paint. Per hour: the key's colour and strength, how high it stands, the fill's
 * strength and its sky and ground colours, and the haze. Every scene lit by `Lights` takes it, but the wendigo's paddock
 * shot, which keeps the light it had (SUN, LIGHT_BOUNDS, FOG).
 */
export const DIORAMA: Record<Hour, { sun: string; intensity: number; elevationDeg: number; fill: number; sky: string; ground: string; fog: string }> = {
  dawn: { sun: '#FFD9C6', intensity: 1.25, elevationDeg: 30, fill: 0.95, sky: '#F1DFDC', ground: '#C4B4AC', fog: '#F6DDD0' },
  day: { sun: '#FFF3E0', intensity: 1.45, elevationDeg: 42, fill: 1.1, sky: '#E3ECF7', ground: '#CFC8BE', fog: '#E3EAF1' },
  dusk: { sun: '#FFC9A0', intensity: 1.3, elevationDeg: 28, fill: 0.9, sky: '#EAD3DA', ground: '#B9A8A0', fog: '#E0B4BC' },
  night: { sun: '#CBD6F2', intensity: 0.95, elevationDeg: 40, fill: 0.8, sky: '#8C9ECB', ground: '#4C536C', fog: '#3A4772' },
};
/** The key colours before the hour grades, kept for the wendigo's shot, which draws today's light on every tier. */
export const TODAY_SUN: Record<Hour, string> = { dawn: '#FFD3A8', day: '#FFE8C8', dusk: '#FFD3A8', night: '#C6CDE4' };
// Physical falloff (decay 2) needs candela-scale intensity; 40 here lands where the plan's nominal 2.0 reads on screen.
export const LANTERN_LIGHT = { color: '#FFC890', /* a less orange amber (docs/depth section 3.3); was #FFB862 */ intensity: 40, distance: 14, decay: 2 };
/**
 * At night the lanterns burn brighter and reach further, and the moon and the sky's fill are up a little (Brian,
 * 2026-11-13, of a room game, which is always at night: "make the room a little brighter ngl i cant see a thing").
 * The fill stays modest: a strong one flattens the snow (see Lights).
 */
const NIGHT = { lantern: 1.5, reach: 19, fill: 0.62 };
/**
 * Brian's light limits as one tested set (plan file 02, change 1; src/skin/table/__tests__/lightBounds.test.ts): the
 * sky fill's two colours and strengths, exposure, the moon, the night lanterns, the sun's angle and the shadow type.
 * Lights reads them from here, so a change to one is a change the test sees.
 */
export const LIGHT_BOUNDS = {
  fillSky: '#AEBEDA', fillGround: '#655F5C', fillDay: 0.58, fillNight: NIGHT.fill,
  exposure: 1, moon: SUN.night.intensity, nightLantern: NIGHT.lantern, nightReach: NIGHT.reach,
  sunElevationDeg: 20, sunAzimuthOffsetDeg: 35, shadowType: PCFShadowMap,
} as const;
/**
 * Home's picture by hour (docs/miniature/02, section 6). By day and at
 * dawn: a higher sun a little further round, strong enough that sunlit snow is white and a shadow on it is plainly a
 * shadow (the plan's targets, section 4), the haze fitted to each shot and the sun's shadow box fitted to each view.
 * Dusk and night are as they were (Brian likes them: the plan's default), so their sun and fill are DIORAMA's.
 *
 * The plan reaches its targets by exposure (2.2) because, in the code it was written against, a stronger sun pushed
 * snow over the bloom's threshold. Here it cannot (SHOULDER in voxel/material.ts keeps every lit voxel under the
 * threshold), and exposure also multiplies everything the sun does not light: the sky, the haze, lanterns, bulbs and
 * windows all went white. So the sun and the fill carry it and exposure stays 1 on every canvas
 * (docs/miniature/review/M1-light.md has the measurements).
 * The wendigo's paddock shot takes none of this: `shotLight` hands it the light it always had.
 */
export interface Daylight {
  toneMapping: ToneMapping; exposure: number; sun: number; fill: number; sunElevationDeg: number; sunAzimuthOffsetDeg: number; fitHaze: boolean; fitShadow: boolean;
  /** The golden afternoon (docs/depth/DEPTH-PLAN.md, part A2): the sun's colour, the sky light's two colours, a bounce
   *  light opposite the sun (strength, colour, height), the haze's colour, the soft shading's wrap and self-fill, and how
   *  much brighter what glows of itself burns (part A3). */
  sunColour: string; sky: string; ground: string; bounce: number; bounceColour: string; bounceEl: number; haze: string;
  softWrap: number; softFill: number; glow: number;
}
export const DAYLIGHT: Record<Hour, Daylight> = {
  dawn: { toneMapping: NeutralToneMapping, exposure: 1.05, sun: 3.3, fill: 1.15, sunElevationDeg: 22, sunAzimuthOffsetDeg: 60, fitHaze: true, fitShadow: true,
    sunColour: '#FFCFA8', sky: '#C4B6E2', ground: '#F2D0C0', bounce: 1.9, bounceColour: '#FFC0A8', bounceEl: 15, haze: '#F4DDD2', softWrap: 0.14, softFill: 0.15, glow: 1.6 },
  day: { toneMapping: NeutralToneMapping, exposure: 1.05, sun: 3.9, fill: 1.25, sunElevationDeg: 32, sunAzimuthOffsetDeg: 60, fitHaze: true, fitShadow: true,
    sunColour: '#FFDDB0', sky: '#B8B9E6', ground: '#EFD8C4', bounce: 2.1, bounceColour: '#FFCBA8', bounceEl: 15, haze: '#F2E6DA', softWrap: 0.14, softFill: 0.15, glow: 1.6 },
  dusk: { toneMapping: LOOK.toneMapping, exposure: 1, sun: DIORAMA.dusk.intensity, fill: DIORAMA.dusk.fill, sunElevationDeg: DIORAMA.dusk.elevationDeg, sunAzimuthOffsetDeg: LIGHT_BOUNDS.sunAzimuthOffsetDeg, fitHaze: false, fitShadow: false,
    sunColour: '#FFB27A', sky: '#CDB4DA', ground: '#EBC6B0', bounce: 0.95, bounceColour: '#FFB89A', bounceEl: 12, haze: '#E8B7A6', softWrap: 0.16, softFill: 0.15, glow: 1.3 },
  night: { toneMapping: LOOK.toneMapping, exposure: 1, sun: DIORAMA.night.intensity, fill: DIORAMA.night.fill, sunElevationDeg: DIORAMA.night.elevationDeg, sunAzimuthOffsetDeg: LIGHT_BOUNDS.sunAzimuthOffsetDeg, fitHaze: false, fitShadow: false,
    sunColour: DIORAMA.night.sun, sky: DIORAMA.night.sky, ground: DIORAMA.night.ground, bounce: 0, bounceColour: '#000000', bounceEl: 15, haze: DIORAMA.night.fog, softWrap: 0.35, softFill: 0.22, glow: 1 },
};
/** The haze a fitted shot may take, and the sun's shadow box's half-size by tier (docs/miniature/02, changes A and D). */
export const HAZE_FIT = { min: 0.004, max: 0.014, share: 0.5 } as const;
export const SHADOW_FIT = { min: 20, max: 44, maxLow: 30, perMetre: 0.75, plus: 6 } as const;
/**
 * `?light=today` on a development server draws Home as it was before the table above on every shot, `?light=mini` forces
 * the day's fitted haze and shadow box at every hour (the plan's option 2 for dusk and night), for pairs. Read once.
 */
const ASKED_LIGHT = import.meta.env.DEV && typeof location !== 'undefined' ? new URLSearchParams(location.search).get('light') : null;
/** The farm rectangle the haze is fitted to (docs/miniature/02, change A): the yard and the pens, back to the line z = -16. */
export const FARM_RECT = { minX: -40, maxX: 40, minZ: -16, maxZ: 46 } as const;
/** What one Home shot is drawn with. `centre` is where the sun's shadow box is centred on the ground, `half` its half-size. */
export interface ShotLight { haze: number; half: number; centre: readonly [number, number]; exposure: number; toneMapping: ToneMapping; sun: number; fill: number; sunElevationDeg: number; sunAzimuthOffsetDeg: number;
  sunColour: string; sky: string; ground: string; bounce: number; bounceColour: string; bounceEl: number; hazeColour: string; softWrap: number; softFill: number; glow: number }
/** The light a shot had before the table: the paddock shot's on every tier (through exemptShot), and `?light=today`'s. */
const lookBefore = (hour: Hour, paddock: boolean): ShotLight => ({
  haze: paddock ? PADDOCK_FOG : LOOK.fog, half: SHADOW_FIT.min, centre: [0, 0], exposure: 1, toneMapping: paddock ? ACESFilmicToneMapping : LOOK.toneMapping,
  sun: paddock ? SUN[hour].intensity : DIORAMA[hour].intensity, fill: paddock ? (hour === 'night' ? LIGHT_BOUNDS.fillNight : LIGHT_BOUNDS.fillDay) : DIORAMA[hour].fill,
  sunElevationDeg: paddock ? LIGHT_BOUNDS.sunElevationDeg : DIORAMA[hour].elevationDeg, sunAzimuthOffsetDeg: LIGHT_BOUNDS.sunAzimuthOffsetDeg,
  // As it was before the golden afternoon: no bounce light, the old haze, the material's own soft shading, lamps as made.
  sunColour: DIORAMA[hour].sun, sky: DIORAMA[hour].sky, ground: DIORAMA[hour].ground, bounce: 0, bounceColour: '#000000', bounceEl: 15,
  hazeColour: hour === 'day' && LOOK.warmSky ? WARM_DAY_SKY[1] : DIORAMA[hour].fog, softWrap: STUDIO.wrap, softFill: STUDIO.fill, glow: 1,
});
/**
 * How far it is from a shot's camera to the farthest point of the board's outer edge that the shot's horizontal view
 * holds, at the shot's start (docs/miniature/02, change A): the haze is fitted so that point is `HAZE_FIT.share` gone.
 */
export function farEdge(shot: { position: readonly number[]; target: readonly number[]; fov: number }, aspect: number): number {
  const [px, py, pz] = shot.position, fx = shot.target[0] - px, fz = shot.target[2] - pz, fl = Math.hypot(fx, fz) || 1;
  const halfView = Math.atan(Math.tan((shot.fov * Math.PI) / 360) * aspect);
  let far = 0;
  const see = (x: number, z: number) => {
    const dx = x - px, dz = z - pz, d = Math.hypot(dx, dz);
    if (d > 0 && Math.acos(Math.min(1, Math.max(-1, (dx * fx + dz * fz) / (d * fl)))) <= halfView) far = Math.max(far, Math.hypot(d, py));
  };
  for (let x = FARM_RECT.minX; x <= FARM_RECT.maxX; x += 0.5) { see(x, FARM_RECT.minZ); see(x, FARM_RECT.maxZ); }
  for (let z = FARM_RECT.minZ; z <= FARM_RECT.maxZ; z += 0.5) { see(FARM_RECT.minX, z); see(FARM_RECT.maxX, z); }
  return far;
}
/** A Home shot's picture at an hour. `paddock`: the wendigo's shot, which is always what it was. */
export function shotLight(shot: { position: readonly number[]; target: readonly number[]; fov: number }, hour: Hour, { paddock = false, low = false, aspect = 1.6 } = {}): ShotLight {
  if (paddock || ASKED_LIGHT === 'today') return lookBefore(hour, paddock);
  const t = DAYLIGHT[hour], before = lookBefore(hour, false), fit = ASKED_LIGHT === 'mini';
  const edge = farEdge(shot, aspect);
  const d = Math.hypot(shot.target[0] - shot.position[0], shot.target[2] - shot.position[2]);
  return {
    haze: (t.fitHaze || fit) && edge > 0 ? Math.min(HAZE_FIT.max, Math.max(HAZE_FIT.min, HAZE_FIT.share / edge)) : before.haze,
    half: t.fitShadow || fit ? Math.min(low ? SHADOW_FIT.maxLow : SHADOW_FIT.max, Math.max(SHADOW_FIT.min, SHADOW_FIT.perMetre * d + SHADOW_FIT.plus)) : before.half,
    centre: t.fitShadow || fit ? [shot.target[0], shot.target[2]] : before.centre,
    exposure: t.exposure, toneMapping: t.toneMapping, sun: t.sun, fill: t.fill, sunElevationDeg: t.sunElevationDeg, sunAzimuthOffsetDeg: t.sunAzimuthOffsetDeg,
    sunColour: t.sunColour, sky: t.sky, ground: t.ground, bounce: t.bounce, bounceColour: t.bounceColour, bounceEl: t.bounceEl, hazeColour: t.haze,
    softWrap: t.softWrap, softFill: t.softFill, glow: t.glow,
  };
}
/** Home's shot as the tour set it in the dip (`Drift` in FarmBackdrop.tsx); null wherever there is no tour (the table). */
let shotNow: ShotLight | null = null;
export function setShotLight(look: ShotLight | null): void { shotNow = look; }

/** How bright a lantern burns at this hour. */
export const lanternIntensity = (hour: Hour) => LANTERN_LIGHT.intensity * (hour === 'night' ? NIGHT.lantern : 1);

/** Exponential fog in the hour's colour; the sky dome, stars and aurora ignore it (their materials have fog off). */
export function Atmosphere({ hour }: { hour: Hour }) {
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    const fog = hour === 'day' && LOOK.warmSky ? WARM_DAY_SKY[1] : DIORAMA[hour].fog;
    scene.fog = new FogExp2(fog, LOOK.fog);
    scene.background = new Color(fog);
  }, [scene, hour]);
  // The wendigo's paddock shot keeps the fog it had, colour and density; every other shot the diorama's.
  const was = useRef('');
  useFrame(() => {
    const f = scene.fog as FogExp2 | null, exempt = oldLightShot();
    // Home's haze is fitted to each shot (shotLight), set in the dip with the camera's jump.
    const density = exempt ? PADDOCK_FOG : shotNow?.haze ?? LOOK.fog, key = `${exempt}|${density}|${shotNow?.hazeColour ?? ''}`;
    if (!f || was.current === key) return;
    was.current = key;
    f.density = density;
    f.color.set(exempt ? FOG[hour] : shotNow?.hazeColour ?? (hour === 'day' && LOOK.warmSky ? WARM_DAY_SKY[1] : DIORAMA[hour].fog));
    (scene.background as Color).copy(f.color);
  });
  return null;
}

/**
 * How the sun's shadow map is drawn (plan file 02, change 3; file 17, change 15). `redraw`: 'frame' every picture (as
 * it always was), 'clock' on SUN_CLOCK_MS and at once when the shot changes or a caster jumps, 'shot' once a shot.
 * Home redraws on the clock on High and Medium; the table keeps every picture on every tier, because the bomb is lobbed
 * through the air and the animals move all the time there, and a shadow a tenth of a second behind its bomb shows.
 * The wendigo's shot (`exempt`) is today's on every tier.
 */
export const SUN_CLOCK_MS = 100;
/**
 * What a casting light's shadow camera draws: layer 0, and layer 1, where each animal's two shadow stand-ins are
 * (PROXY_LAYER in table/Sheep.tsx, plan file 03, change 4.13). An animal casts through its stand-ins only where every
 * casting light in its scene has layer 1 on.
 */
export const SHADOW_LAYERS = 0b11;
export type SunPlace = 'home' | 'table';
/** How much of the diorama's sky fill reaches inside the barn at the table. */
export const INDOOR_FILL = 0.62;
export function sunPlan(tier: Tier, phone: boolean, exempt: boolean, place: SunPlace): { size: number; redraw: 'frame' | 'clock' | 'shot' } {
  const today = phone ? 2048 : 4096;
  if (exempt) return { size: today, redraw: 'frame' };
  const size = tier === 'high' ? today : tier === 'medium' ? Math.min(today, 2048) : 1024;
  if (place === 'table') return { size, redraw: 'frame' };
  return { size, redraw: tier === 'low' ? 'shot' : 'clock' };
}
/** A low tier's map is drawn when the shot changes and once more this long after (pieces that mount a frame late). */
const SHOT_AGAIN_MS = 1000;
/** Home's shot changed (Drift, in the dip): the sun's map is drawn again at once. */
let shotSeq = 0;
export function noteNewShot(): void { shotSeq++; }
/** Something that casts moves a lot for a while (the hero's hop): the map is drawn every picture until then. */
let sunBusyUntil = 0;
export function sunEveryFrameFor(ms: number): void { sunBusyUntil = Math.max(sunBusyUntil, performance.now() + ms); }
/**
 * The gate's picture helper steps frames with WebGL's draws switched off (tools/gate/lib/determinism.js) and draws only
 * the last ones: a map redrawn in a skipped frame is never really drawn, so the redraw waits for a frame that is.
 */
const drawsSkipped = () => (globalThis as { __gate?: { drawing?: boolean } }).__gate?.drawing === false;

/**
 * One warm sun 20 degrees up and 35 degrees to the side of the camera (`viewYaw` is the camera's horizontal heading,
 * so shadows fall across the view), a cool sky fill, and the two lantern point lights. The set of lights never changes
 * with the tier: only the sun's map size, how often it is drawn and, on the wendigo's shot, its colour.
 */
export function Lights({ hour, phone, viewYaw, lampRef, place = 'table' }: { hour: Hour; phone: boolean; viewYaw: number; lampRef?: (i: number, l: PointLight | null) => void; place?: SunPlace }) {
  const sun = SUN[hour], look = DIORAMA[hour];
  // The start screen and the barn table read the ground's shade map (voxel/groundShade.ts); no other scene has these lights.
  const shaded = useThree((three) => three.scene);
  useEffect(() => { shaded.userData.groundShade = true; return () => { shaded.userData.groundShade = false; }; }, [shaded]);
  // Under the barn's roof at the table the open sky's fill is cut, or the lanterns' light is lost in it and the
  // inside reads as washed out; Home's farm is out of doors and takes it all.
  const fillShare = place === 'table' ? INDOOR_FILL : 1;
  const at = (deg: number, offsetDeg: number = LIGHT_BOUNDS.sunAzimuthOffsetDeg): [number, number, number] => {
    const el = (deg * Math.PI) / 180, az = viewYaw + Math.PI + (offsetDeg * Math.PI) / 180;
    return [Math.sin(az) * Math.cos(el) * 60, Math.sin(el) * 60, Math.cos(az) * Math.cos(el) * 60];
  };
  const pos = at(look.elevationDeg);
  const light = useRef<DirectionalLight>(null);
  const fill = useRef<HemisphereLight>(null);
  const kick = useRef<DirectionalLight>(null);
  const st = useRef({ colour: '', seq: -1, last: -Infinity, again: 0, owed: true, plain: null as boolean | null, shot: null as ShotLight | null });
  // Before the first picture: the map's size, and nothing drawn on a stale plan.
  useFrame(() => {
    const l = light.current;
    if (!l) return;
    const s = st.current, now = performance.now();
    const exempt = place === 'home' && oldLightShot();
    const colour = exempt ? TODAY_SUN[hour] : (place === 'home' ? shotNow?.sunColour : null) ?? look.sun;
    if (hour + colour !== s.colour) { s.colour = hour + colour; l.color.set(colour); }
    // The paddock shot's light is the light it had; every other shot's is the diorama's (the tour cuts in the dark).
    // Home's sun stands where the shot's look says, over a shadow box centred on what the shot looks at and as wide as
    // its view (docs/miniature/02, changes B and D); the table's is DIORAMA's, over the barn, as it was.
    const shot = place === 'home' ? shotNow : null;
    if (s.plain !== exempt || s.shot !== shot) {
      s.plain = exempt;
      s.shot = shot;
      l.intensity = shot?.sun ?? (exempt ? sun.intensity : look.intensity);
      const from = shot ? at(shot.sunElevationDeg, shot.sunAzimuthOffsetDeg) : at(exempt ? LIGHT_BOUNDS.sunElevationDeg : look.elevationDeg);
      const [cx, cz] = shot?.centre ?? [0, 0], half = shot?.half ?? SHADOW_FIT.min, cam = l.shadow.camera;
      l.position.set(cx + from[0], from[1], cz + from[2]);
      l.target.position.set(cx, 0, cz);
      l.target.updateMatrixWorld();
      if (cam.right !== half) {
        cam.left = cam.bottom = -half; cam.right = cam.top = half;
        cam.updateProjectionMatrix();
        l.shadow.bias = (-0.0004 * half) / SHADOW_FIT.min;
        l.shadow.normalBias = (0.02 * half) / SHADOW_FIT.min;
      }
      const h = fill.current;
      if (h) {
        h.color.set(exempt ? LIGHT_BOUNDS.fillSky : shot?.sky ?? look.sky);
        h.groundColor.set(exempt ? LIGHT_BOUNDS.fillGround : shot?.ground ?? look.ground);
        h.intensity = shot?.fill ?? (exempt ? (hour === 'night' ? LIGHT_BOUNDS.fillNight : LIGHT_BOUNDS.fillDay) : look.fill * fillShare);
      }
      // The bounce light (docs/depth/DEPTH-PLAN.md, A2): opposite the sun across the compass, low, no shadow. It lifts
      // the sides turned from the sun so nothing goes dark. Never on the paddock shot.
      const k = kick.current;
      if (k) {
        k.intensity = !exempt && shot ? shot.bounce : 0;
        if (shot) { k.color.set(shot.bounceColour); k.position.set(...at(shot.bounceEl, shot.sunAzimuthOffsetDeg + 180)); }
      }
      s.owed = true;
    }
    const plan = sunPlan(getTier(), phone, place === 'home' && exemptShot(), place);
    let due = false;
    if (l.shadow.mapSize.x !== plan.size) { l.shadow.mapSize.set(plan.size, plan.size); due = true; }
    if (s.seq !== shotSeq) { s.seq = shotSeq; due = true; s.again = now + SHOT_AGAIN_MS; }
    const every = plan.redraw === 'frame' || now < sunBusyUntil;
    l.shadow.autoUpdate = every && !drawsSkipped();
    if (every) { s.last = now; return; }
    if (plan.redraw === 'clock' && now - s.last >= SUN_CLOCK_MS) due = true;
    if (plan.redraw === 'shot' && s.again && now >= s.again) { s.again = 0; due = true; }
    if (due) s.owed = true;
    if (s.owed && !drawsSkipped()) { l.shadow.needsUpdate = true; s.owed = false; s.last = now; }
  });
  return (
    <>
      {/* A strong sky fill and a soft bounce from below: the diorama's open shadows. Snow gets its shape from its steps
          and drifts and from the key's soft shadows. */}
      <hemisphereLight ref={fill} args={[look.sky, look.ground, look.fill * fillShare]} />
      {place === 'home' && <directionalLight ref={kick} intensity={0} />}
      <directionalLight
        ref={light} position={pos} color={look.sun} intensity={look.intensity} castShadow shadow-radius={LOOK.shadowRadius ?? 2.5}
        shadow-bias={-0.0004} shadow-normalBias={0.02} shadow-camera-layers-mask={SHADOW_LAYERS}
        shadow-camera-left={-20} shadow-camera-right={20} shadow-camera-top={20} shadow-camera-bottom={-20} shadow-camera-near={1} shadow-camera-far={160}
      />
      {BARN.lanterns.map((p, i) => (
        <pointLight key={i} ref={(l) => lampRef?.(i, l)} position={[p[0], p[1] - 0.3, p[2]]} color={LANTERN_LIGHT.color} intensity={lanternIntensity(hour)} distance={hour === 'night' ? LIGHT_BOUNDS.nightReach : LANTERN_LIGHT.distance} decay={LANTERN_LIGHT.decay} />
      ))}
    </>
  );
}

/** A light tilt-shift: a vertical blur that only touches the top and bottom fifth of the frame. */
const TiltShiftShader = {
  uniforms: { tDiffuse: { value: null }, strength: { value: 0.15 }, texelY: { value: 1 / 1080 } },
  vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float strength; uniform float texelY; varying vec2 vUv;
    void main() {
      float band = smoothstep(0.2, 0.0, vUv.y) + smoothstep(0.8, 1.0, vUv.y);
      float r = band * strength * 40.0;
      vec4 sum = vec4(0.0); float wsum = 0.0;
      for (int i = -6; i <= 6; i++) {
        float w = 1.0 - abs(float(i)) / 7.0;
        sum += texture2D(tDiffuse, vUv + vec2(0.0, float(i) * r / 6.0 * texelY)) * w;
        wsum += w;
      }
      gl_FragColor = sum / wsum;
    }`,
};

/**
 * Home's grade, on the finished picture after tone mapping (docs/depth/DEPTH-PLAN.md, section 3.4): pure greens lean
 * teal (the woods and hills, which cannot be repainted), the brightest whites roll toward cream, the deepest darks lift
 * to a warm plum. Off on the wendigo's paddock shot and in every other scene.
 */
const GradeShader = {
  uniforms: { tDiffuse: { value: null } },
  vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv); vec3 x = c.rgb;
      float gr = max(0.0, x.g - max(x.r, x.b)); x.g -= 0.45 * gr; x.b += 0.25 * gr; x.r += 0.08 * gr;
      float lw = dot(x, vec3(0.2126, 0.7152, 0.0722)); x = mix(x, x * vec3(1.0, 0.975, 0.93), smoothstep(0.75, 1.0, lw) * 0.6);
      x = vec3(0.07, 0.05, 0.07) + x * (1.0 - vec3(0.07, 0.05, 0.07));
      gl_FragColor = vec4(x, c.a);
    }`,
};

/**
 * What the picture costs at a fine resolution (Brian, 2026-11-13: "make the website less laggy"). Measured at the barn
 * table at 1.5x on a Retina laptop: 24.5 ms a frame, of which the 4x multisampling was about 7.5 (every pass of the
 * composer resolves it again) and the bloom about 7.5, and both grow with every pixel. So: 4 samples only at 1x, where
 * the edges need them, 2 a little above, and none from 1.5x up, where the pixels are too small to show a stair (looked
 * at side by side, with and without); and the bloom, which only has to find the lanterns and the things that glow,
 * works on a picture no wider than BLOOM_MAX_W whatever the screen. After: 60 frames a second at 1.5x and at the full
 * 2x, where it had been 41 at 1.5x. Shadows were measured too and cost next to nothing.
 */
// From 1.5x up it had no samples at all, which on a Retina screen left the far pines' tier steps and the long shadows on
// the back slopes blinking as Home's camera drifted (Brian, 2026-11-22: "z-fighting and flickering in the back"; with
// the camera held still nothing changes, so it is crawl, not depth). Two samples there take nearly all of it away.
const samplesFor = (pixelRatio: number) => (pixelRatio > 1.1 ? 2 : 4);
const BLOOM_MAX_W = 720;
/**
 * The composer by tier (plan file 02, change 3): High today's; Medium the bloom on a picture at most 480 px across;
 * Low no bloom, and no tilt-shift except on the wendigo's shot, which is today's on every tier (change 4). Passes are
 * switched, never added or taken out, so nothing recompiles.
 */
/** Over this, a pixel blooms. Lit white (snow, wool) stays under it; lamps, windows and bulbs are over it. */
export const BLOOM_THRESHOLD = 1.05;
/** The wendigo's paddock shot blooms from where it always did. */
const PADDOCK_BLOOM = 0.85;
export function effectsPlan(tier: Tier, exempt: boolean): { bloomMaxW: number; tiltShift: boolean } {
  if (exempt || tier === 'high') return { bloomMaxW: BLOOM_MAX_W, tiltShift: true };
  return tier === 'medium' ? { bloomMaxW: 480, tiltShift: true } : { bloomMaxW: 0, tiltShift: false };
}

/**
 * The composer: the scene into a multisampled half-float target, bloom for the lanterns and windows only
 * (threshold 0.85), the optional tilt-shift, then tone mapping and sRGB in the output pass.
 */
export function Effects({ tiltShift = 0, home = false }: { tiltShift?: number; home?: boolean }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  // The resolution can change under it (AdaptiveDpr), and the composer's targets must follow or it draws blurred.
  const dpr = useThree((s) => s.viewport.dpr);
  const composer = useMemo(() => {
    const target = new WebGLRenderTarget(size.width, size.height, { type: HalfFloatType, samples: samplesFor(gl.getPixelRatio()) });
    const c = new EffectComposer(gl, target);
    c.addPass(new RenderPass(scene, camera));
    // Bloom at half resolution: it only has to catch the lanterns, and the full-size blur chain costs most of a frame.
    // Only what gives light blooms (lanterns, windows, bulbs: brighter than any lit surface): at 0.85 white wool and
    // sunlit snow bloomed too, and the sheep glowed (Brian, 2026-11-19).
    c.addPass(new UnrealBloomPass(new Vector2(Math.ceil(size.width / 2), Math.ceil(size.height / 2)), 0.35, 0.4, BLOOM_THRESHOLD));
    if (tiltShift > 0) {
      const pass = new ShaderPass(TiltShiftShader);
      pass.uniforms.strength.value = tiltShift;
      pass.uniforms.texelY.value = 1 / size.height;
      c.addPass(pass);
    }
    c.addPass(new OutputPass());
    if (home) { const g = new ShaderPass(GradeShader); g.enabled = false; c.addPass(g); }
    return c;
    // The size is applied by the effect below; recreating on every resize would drop frames.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, scene, camera, tiltShift, home]);
  // What the tier asks of the composer, applied in the frame that first draws under it (a tier changes in a dip).
  const plan = useRef('');
  const fit = (maxW: number, tilt: boolean) => {
    const ratio = gl.getPixelRatio();
    for (const p of composer.passes) {
      if (p instanceof ShaderPass && p.uniforms.texelY) p.enabled = tilt;
      // The bloom works at half of whatever size it is given: give it no more than its width across.
      if (p instanceof UnrealBloomPass) {
        p.enabled = maxW > 0;
        if (maxW > 0) { const w = size.width * ratio, k = Math.min(1, (maxW * 2) / w); p.setSize(w * k, size.height * ratio * k); }
      }
    }
  };
  useEffect(() => {
    const ratio = gl.getPixelRatio(), samples = samplesFor(ratio);
    // Fewer samples at a finer resolution: changing the count means new buffers, which setSize alone would not make.
    for (const t of [composer.renderTarget1, composer.renderTarget2]) if (t.samples !== samples) { t.samples = samples; t.dispose(); }
    composer.setPixelRatio(ratio);
    composer.setSize(size.width, size.height);
    for (const p of composer.passes) if (p instanceof ShaderPass && p.uniforms.texelY) p.uniforms.texelY.value = 1 / size.height;
    plan.current = ''; // setSize gave the bloom the whole picture: the frame below fits it again
  }, [composer, gl, size, dpr]);
  useEffect(() => () => composer.dispose(), [composer]);
  // The composer is several draws; counting across all of them keeps the dev overlay's triangle count honest.
  useEffect(() => {
    gl.info.autoReset = false;
    return () => { gl.info.autoReset = true; };
  }, [gl]);
  useFrame(() => {
    // The wendigo's paddock shot keeps its tier exemption (bloom and tilt-shift on every tier); it is drawn in its old
    // light, plain Lambert (voxel/material.ts) under the old tone mapping, only while PADDOCK_OLD_LIGHT (look.ts) is on.
    const exempt = home && exemptShot(), old = home && oldLightShot();
    scene.userData.plainLight = old;
    // The golden afternoon (docs/depth/DEPTH-PLAN.md, A1 to A3): Home's shots set the soft shading's amounts, the
    // exposure and how bright the lamps burn; the paddock shot and every other scene keep the material's own.
    const golden = home && !old && shotNow ? shotNow : null;
    scene.userData.studio = golden ? { wrap: golden.softWrap, fill: golden.softFill } : undefined;
    scene.userData.glow = golden ? golden.glow : 1;
    gl.toneMappingExposure = golden ? golden.exposure : 1;
    gl.toneMapping = old ? ACESFilmicToneMapping : (home ? shotNow?.toneMapping : null) ?? LOOK.toneMapping;
    for (const p of composer.passes) {
      if (p instanceof UnrealBloomPass) p.threshold = old ? PADDOCK_BLOOM : BLOOM_THRESHOLD;
      if (p instanceof ShaderPass && p.material.fragmentShader === GradeShader.fragmentShader) p.enabled = home && !old && !LOOK.noGrade;
    }
    const want = effectsPlan(getTier(), exempt);
    if (home && !exempt && !LOOK.tilt) want.tiltShift = false; // ?tilt=0 (look.ts): off but on the wendigo's shot
    const key = `${want.bloomMaxW}|${want.tiltShift}`;
    if (key !== plan.current) { plan.current = key; fit(want.bloomMaxW, want.tiltShift); }
    gl.info.reset();
    composer.render();
  }, 1);
  return null;
}

/** The camera's horizontal heading (0 = looking toward +z) from a position and a target. */
export function yawToward(from: readonly number[], to: readonly number[]): number {
  return Math.atan2(to[0] - from[0], to[2] - from[2]);
}

/**
 * Marks the canvas once the scene has drawn a few frames, so the barn doors (BarnDoors) open onto a finished picture.
 * The canvases draw on demand (see Governor), so until the mark is set each frame asks for the next one itself: a scene's
 * first pictures never wait on a rate.
 */
const DRAWN_AFTER = 3;
export function MarkDrawn() {
  const gl = useThree((s) => s.gl);
  const frames = useRef(0);
  useFrame((state) => {
    if (frames.current >= DRAWN_AFTER) return;
    if (++frames.current === DRAWN_AFTER) gl.domElement.setAttribute('data-drawn', '');
    else state.invalidate();
  });
  useEffect(() => () => gl.domElement.removeAttribute('data-drawn'), [gl]);
  return null;
}

/** The loading doors (or their quick dark fade) are up and fully shut: the page itself shows none of any scene. */
const behindShutDoors = () => typeof document !== 'undefined' && (document.querySelector('.sk-doors[data-phase="shut"]') !== null || document.getElementById('boot-doors') !== null);

/**
 * The frame governor's loop, one in each canvas (perf/governor.ts has the why and the arithmetic). The canvas draws on
 * demand; this counts the screen's refreshes and asks for a picture on the ones that are due: at most 60 a second (72
 * at 144 Hz), fewer where the scene's `fps` asks for fewer, none at 0 or in a hidden tab. A scene is never held back
 * before its first pictures (`data-drawn`), which the loading doors wait for.
 *
 * It asks first and books its own next refresh after: the canvas library's loop, started by the asking, is then always
 * ahead of this one in the browser's queue, so a picture asked for on one refresh is drawn on the next and one is asked
 * for on every refresh that wants one. The other way round every second picture would be lost.
 */
function Governor({ pace, scene }: { pace: Pace; scene?: string }) {
  const store = useStore();
  useEffect(() => {
    const pacer = createPacer();
    let id = 0, marked = false, resting = false;
    const draw = () => {
      const state = store.getState();
      // A scene that rested under its cover goes on from where it stopped: the rest is not one enormous step of time.
      if (resting) { resting = false; state.clock.getDelta(); }
      invalidate(state);
    };
    const refresh = (now: number) => {
      const drawn = store.getState().gl.domElement.hasAttribute('data-drawn');
      if (drawn !== marked) { marked = drawn; noteSceneDrawn(scene, drawn); }
      const hidden = typeof document !== 'undefined' && document.hidden;
      // Behind doors that are fully shut nobody sees the scene: once it has its first pictures (the doors wait for
      // them) it draws nothing more until they open, and the build going on behind them has the page to itself.
      const fps = !drawn ? undefined : hidden || behindShutDoors() ? 0 : pace.fps;
      const due = pacer.step(now, fps);
      pace.targetMs = pacer.targetMs;
      pace.capMs = pacer.capMs;
      if (due) draw();
      else if (fps === 0 && !hidden) resting = true;
      id = requestAnimationFrame(refresh);
    };
    // The cover is going (AdaptiveCanvas calls this as the rate changes): a picture now, not a refresh or two later.
    pace.wake = () => { if (resting && pace.fps !== 0) draw(); };
    id = requestAnimationFrame(refresh);
    return () => { cancelAnimationFrame(id); pace.wake = null; noteSceneDrawn(scene, false); };
  }, [store, pace, scene]);
  return null;
}

/**
 * Keeps a scene smooth on any device by trading resolution for frame rate (Brian, 2026-11-09: "make the game less laggy
 * without removing anything ... optimize this for all devices whether thats ipad, laptop, phone, pc"). Nothing in the
 * scene changes; only how many pixels it is drawn at. The scenes are limited by the graphics chip filling pixels, not
 * by the page's code: the barn ran at 30 fps on a Retina laptop at 2x and at 60 on a phone. So every half second this
 * looks at the frame rate: under about 48 fps for a second running (or under about 36 fps for one half second), it draws
 * a quarter step coarser; at the display's full rate for eight seconds, a quarter step finer, but never back up to a
 * resolution that was already too slow. It starts at the device's own pixel ratio (capped at `max`), ignores the first
 * 1.5 s (the scene is still being built and its shaders compiled) and any frame over 250 ms (a stall or a hidden tab
 * says nothing about the steady cost). It used to look once a second and wait 3 s, so a short practice run (Brian,
 * 2026-11-09: "the bomb explosion for the practice gamemode is still super laggy") spent its whole life at the slow
 * resolution and only got smooth after the bang.
 *
 * Repaired (plan file 17, change 10; a friend's game was "broken-looking", one cause being a resolution stuck at 0.75x
 * for good after one slow second). The figures above are now ratios of the governor's own target, so a scene asked for
 * 30 pictures a second is not called slow for drawing 30: slow is over 1.25 times the target twice running, or over
 * 1.65 times once; fast is under 1.05 times for sixteen looks, and only at the full rate (a scene keeping a slower pace
 * shows nothing about what it could do). A level found too slow is no longer refused for good: it is tried again after
 * RETRY_S of play, and twice as long after each time it fails again, so a device at its limit is not jolted every
 * minute. Each look leaves out its one worst frame, so a single hitch (a piece of the scene being built, the garbage
 * collector) is not taken for the steady cost. Nothing is judged while the loading doors are shut, during a hold (a
 * burst, a dip of Home's camera), or for QUIET_S after the resolution, the rate or the canvas's size changed. Five
 * frames running over 250 ms are no longer ignored as stalls: that is a device drawing under four pictures a second.
 */
export const DPR_STEP = 0.25;
/** How long each look at the frame rate averages over, and how many looks each way move the resolution. */
export const DPR_WINDOW_S = 0.5;
const SLOW_LOOKS = 2, FAST_LOOKS = 16;
/** A look against the target interval: slow above SLOW_X of it, clearly slow above CLEARLY_SLOW_X, fast under FAST_X. */
const SLOW_X = 1.25, CLEARLY_SLOW_X = 1.65, FAST_X = 1.05;
/** Seconds of play before a refused level is tried again; doubled for each time in a row it was refused (to 2^7). */
export const RETRY_S = 60;
const retryAfter = (tries: number) => RETRY_S * 2 ** (Math.min(Math.max(tries, 1), 8) - 1);
/** The judge's memory: looks in a row each way, the level found too slow, when (seconds of play), and how many times running. */
export interface DprStreak { slow: number; fast: number; ceiling: number; refusedAt?: number; tries?: number }
/** What a look is measured against: the governor's target interval, whether that is the full rate, and the time of play. */
export interface DprLook { targetMs?: number; climb?: boolean; now?: number }
/** The level `cur` was too slow: a step coarser, and `cur` is remembered as refused. */
export function refuseDpr(cur: number, streak: DprStreak, min: number, now = 0): number {
  if (cur <= min) return cur;
  streak.tries = cur >= streak.ceiling ? (streak.tries ?? 1) + 1 : 1;
  streak.slow = 0; streak.fast = 0; streak.ceiling = cur; streak.refusedAt = now;
  return Math.max(min, cur - DPR_STEP);
}
export function nextDpr(cur: number, avgMs: number, streak: DprStreak, min: number, max: number, look: DprLook = {}): number {
  const target = look.targetMs ?? 1000 / 60, now = look.now ?? 0;
  if (avgMs > target * SLOW_X) {
    streak.slow++; streak.fast = 0;
    if (streak.slow >= SLOW_LOOKS || avgMs > target * CLEARLY_SLOW_X) return refuseDpr(cur, streak, min, now);
  } else if (avgMs < target * FAST_X && look.climb !== false) {
    streak.fast++; streak.slow = 0;
    if (streak.fast >= FAST_LOOKS) {
      // The refused level itself has held for sixteen looks: it is no longer refused.
      if (cur >= streak.ceiling) { streak.ceiling = Infinity; streak.tries = 0; }
      const up = Math.min(max, cur + DPR_STEP);
      if (up > cur && (up < streak.ceiling || now - (streak.refusedAt ?? 0) >= retryAfter(streak.tries ?? 1))) { streak.fast = 0; return up; }
    }
  } else { streak.slow = 0; streak.fast = 0; }
  return cur;
}
/**
 * Until when (performance.now) the judge looks away. A burst such as the bomb going off slows a few frames on purpose; a
 * resolution change in the middle of it reallocates every buffer, a 70 to 100 ms hitch of its own at the worst moment.
 */
let holdUntil = 0;
export function holdDpr(ms: number): void { holdUntil = Math.max(holdUntil, performance.now() + ms); }

/** A frame longer than this is a stall, not a slow frame; this many running are a device that cannot draw the scene. */
const STALL_S = 0.25, STALLS_SLOW = 5;
/** How long the judge looks away after a scene comes up, and after its resolution, rate or size changes. */
const QUIET_S = 1.5;

/** The steady frame rate's judge, inside a canvas: it reports a new resolution, and the level it found too slow. */
function AdaptiveDpr({ max, min, value, kept, pace, onChange }: { max: number; min: number; value: number; kept: Settled; pace: Pace; onChange: (next: Settled, keep?: boolean) => void }) {
  const st = useRef({ sum: 0, n: 0, worst: 0, stalls: 0, age: 0, quiet: QUIET_S, value, target: 0, w: 0, h: 0, streak: { slow: 0, fast: 0, ceiling: kept.ceiling, refusedAt: 0, tries: kept.tries } as DprStreak });
  useFrame(({ size }, dt) => {
    const s = st.current;
    if (dt <= 0) return;
    // The judge's clock is time the scene was seen drawing: a hidden tab or a stall adds a quarter second at most.
    s.age += Math.min(dt, STALL_S);
    const restart = () => { s.sum = 0; s.n = 0; s.worst = 0; s.stalls = 0; s.streak.slow = 0; };
    // A change of resolution, of the governor's rate or of the canvas's size reallocates or re-times the picture.
    const target = pace.targetMs;
    if (value !== s.value || Math.abs(target - s.target) > s.target * 0.1 || size.width !== s.w || size.height !== s.h) {
      s.value = value; s.target = target; s.w = size.width; s.h = size.height;
      s.quiet = Math.max(s.quiet, s.age + QUIET_S);
      s.streak.fast = 0;
      restart();
      return;
    }
    if (s.age < s.quiet) return;
    if (performance.now() < holdUntil || doorsShut()) { restart(); return; }
    const report = (next: number, keep = true) => {
      s.quiet = s.age + QUIET_S;
      restart();
      if (next !== value) onChange({ dpr: next, ceiling: s.streak.ceiling, tries: s.streak.tries ?? 0 }, keep);
    };
    if (dt > STALL_S) {
      // Stalls step down for now but are not kept: a reload, a tab switch or a load hitch is not the device being slow.
      if (++s.stalls >= STALLS_SLOW) report(refuseDpr(value, s.streak, min, s.age), false);
      return;
    }
    s.stalls = 0;
    s.sum += dt; s.n++;
    if (dt > s.worst) s.worst = dt;
    if (s.sum < DPR_WINDOW_S) return;
    // The look's mean without its one worst frame.
    const avg = (s.n > 2 ? (s.sum - s.worst) / (s.n - 1) : s.sum / s.n) * 1000;
    s.sum = 0; s.n = 0; s.worst = 0;
    const next = nextDpr(value, avg, s.streak, min, max, { targetMs: target, climb: target <= pace.capMs * 1.01, now: s.age });
    if (next !== value) report(next);
    // A refused level that has now held is kept as cleared, so the next visit does not doubt it again.
    else if (s.streak.ceiling !== kept.ceiling && s.streak.ceiling === Infinity) onChange({ dpr: value, ceiling: Infinity, tries: 0 });
  });
  return null;
}

/**
 * The tier's eyes (perf/tier.ts has the rules): every picture a canvas draws, against the governor's target. With
 * `judge` (Home's farm, once it is built and shown) the frames are fed to the tier rules, and what they earn waits for
 * Home's dip. On Low, every canvas watches for a device still under 10 pictures a second after 10 s: `onSlow`, and the
 * canvas gives way to the failure card. Frames behind shut doors, in a hold (a dip, a burst, a build slice) and in the
 * first QUIET_S are left out, as the resolution judge leaves them out.
 */
function TierWatch({ judge, pace, dpr, max, min, onSlow }: { judge: boolean; pace: Pace; dpr: number; max: number; min: number; onSlow: () => void }) {
  const st = useRef({ judge: createTierJudge(), slow: createSlowWatch(), age: 0, failed: false });
  useFrame((_, dt) => {
    const s = st.current, ms = dt * 1000;
    if (!(ms > 0)) return;
    s.age += Math.min(dt, STALL_S);
    if (s.age < QUIET_S || doorsShut() || performance.now() < holdUntil) { s.judge.reset(); return; }
    const tier = getTier();
    if (tier === 'low' && !s.failed && !PINNED_DPR && s.slow.frame(ms)) { s.failed = true; onSlow(); }
    if (!judge) return;
    const earned = s.judge.frame({ ms, targetMs: pace.targetMs, atMax: dpr >= max, atMin: dpr <= min }, tier);
    if (earned) proposeTier(earned);
  });
  return null;
}

/** What each scene is called on the failure card. */
const SCENE_WORDS: Record<string, string> = { farm: 'the farm', table: 'the table', ice: 'the ice', pen: 'the pen', podium: 'the podium', dream: 'the dream', bedroom: 'the bedroom' };

/**
 * What a scene settled on, on this device: the next visit starts there instead of stepping down again. `ceiling` is the
 * level found too slow (Infinity: none) and `tries` how many times running it was.
 */
export interface Settled { dpr: number; ceiling: number; tries: number }
/**
 * Which way of drawing a kept level was measured under. A level settled on before the picture got cheaper (see
 * `samplesFor`), or by the judge before its repair (which kept one slow second for good), says a resolution is too slow
 * that no longer is, so it is not believed: the scene finds its level again.
 */
const SETTLED_UNDER = 3;
/** A kept level is believed for this long. A device changes (a new driver, a charger, a cooler room). */
export const SETTLED_DAYS = 7;
/** A stored level as text, read back: null when it is not one, was measured another way, or is too old. */
export function believeSettled(raw: string | null, now: number = Date.now()): Settled | null {
  try {
    const v = JSON.parse(raw ?? 'null') as { dpr?: unknown; ceiling?: unknown; tries?: unknown; v?: unknown; at?: unknown } | null;
    if (!v || v.v !== SETTLED_UNDER || typeof v.dpr !== 'number' || !Number.isFinite(v.dpr) || typeof v.at !== 'number') return null;
    if (!(Math.abs(now - v.at) <= SETTLED_DAYS * 86_400_000)) return null;
    return { dpr: v.dpr, ceiling: typeof v.ceiling === 'number' && Number.isFinite(v.ceiling) ? v.ceiling : Infinity, tries: typeof v.tries === 'number' && v.tries > 0 ? Math.floor(v.tries) : 0 };
  } catch { return null; }
}
/** A stored level as text, to keep. */
export function keepSettled(v: Settled, now: number = Date.now()): string {
  return JSON.stringify({ dpr: v.dpr, ceiling: Number.isFinite(v.ceiling) ? v.ceiling : null, tries: v.tries, v: SETTLED_UNDER, at: now });
}
const SETTLED_KEY = 'sap:dpr:';
/** The scene's kept level. One that is no longer believed is dropped from storage, so the device report shows only live ones. */
function readSettled(key: string | undefined): Settled | null {
  if (!key) return null;
  try {
    const raw = localStorage.getItem(SETTLED_KEY + key);
    const v = believeSettled(raw);
    if (!v && raw !== null) localStorage.removeItem(SETTLED_KEY + key);
    return v;
  } catch { return null; }
}
/** The lowest resolution any scene settled on, on this device: a scene seen for the first time starts there, not at
 *  the screen's full density, since the same graphics chip draws them all. Only levels still believed count. */
function deviceHint(): number | null {
  let low: number | null = null;
  try {
    // The names first: reading one may drop it, which would shift the list under a loop over it.
    const names: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(SETTLED_KEY)) names.push(k.slice(SETTLED_KEY.length));
    }
    for (const name of names) {
      const v = readSettled(name);
      if (v && (low === null || v.dpr < low)) low = v.dpr;
    }
  } catch { /* storage blocked */ }
  return low;
}
function writeSettled(key: string | undefined, v: Settled) {
  if (!key) return;
  try { localStorage.setItem(SETTLED_KEY + key, keepSettled(v)); } catch { /* storage blocked */ }
}

/**
 * A scene canvas whose resolution follows the frame rate (see `nextDpr`). The resolution lives here, as the canvas's own
 * `dpr`: the canvas re-applies its `dpr` prop every time it renders, and the game screen renders every frame, so a
 * resolution set from inside the scene was put straight back (and each round trip reallocated the buffers, a 120 ms
 * hitch every two seconds). `memory` names the scene, so the level it settles on is kept per device and the next visit
 * starts there: each change of resolution reallocates the buffers, a short hitch best paid once.
 *
 * The canvas is measured by its layout box (`resize: { offsetSize: true }`) unless the caller says otherwise, so a
 * transform on a parent (the swoop into a game scales the whole screen) cannot make it bigger than its box.
 *
 * It draws on demand, paced by its Governor: `fps` is how many pictures a second the scene asks for (none given: the
 * full rate, at most 60 a second; 0: none, once the scene has drawn). `frameloop="never"` still stops it dead, as Home's
 * farm does behind the Trading Post. And it asks for the device's default graphics chip, not its hungriest: on a
 * laptop with two, the browser's choice is the one that spares the battery.
 */
export function AdaptiveCanvas({ maxDpr, minDpr = 0.75, memory, fps, judgeTier = false, children, ...given }: Omit<CanvasProps, 'dpr'> & { maxDpr: number; minDpr?: number; memory?: string; fps?: number; judgeTier?: boolean }) {
  const frameloop = given.frameloop === 'never' ? 'never' as const : 'demand' as const;
  const props = { ...given, resize: given.resize ?? LAYOUT_SIZE, frameloop, gl: easyOnPower(given.gl) };
  const [state, setState] = useState<Settled>(() => {
    const device = Math.max(minDpr, Math.min(maxDpr, typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1));
    const kept = readSettled(memory);
    if (kept) return { ...kept, dpr: Math.max(minDpr, Math.min(device, kept.dpr)) };
    const hint = memory ? deviceHint() : null;
    return { dpr: hint === null ? device : Math.max(minDpr, Math.min(device, hint)), ceiling: Infinity, tries: 0 };
  });
  const onChange = (next: Settled, keep = true) => {
    setState(next);
    if (keep) writeSettled(memory, next);
  };
  // A scene change is one of the two places a tier earned elsewhere may come in (Home's dip is the other).
  useLayoutEffect(() => { applyPendingTier(); }, []);
  // Low and still under 10 pictures a second: the card in the canvas's place (plan file 17, change 15).
  const [slow, setSlow] = useState(false);
  const top = Math.max(minDpr, Math.min(maxDpr, typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1));
  // The rate goes to the governor through an object both sides hold, not through the scene's own tree: the tree inside
  // a canvas is rendered a moment after the page's, and a scene coming out from under its cover must draw at once.
  const [pace] = useState(() => newPace(fps));
  useLayoutEffect(() => {
    pace.fps = fps;
    pace.wake?.();
  }, [pace, fps]);
  // As each canvas gets its renderer the device report starts watching it (perf/report.ts): when it draws, what a frame
  // costs, and its WebGL context being taken away (asked back with preventDefault) or given back. What the player sees
  // then, "Redrawing the farm..." or the card, is SceneBoundary's, which stands round this canvas.
  const onCreated: CanvasProps['onCreated'] = (root) => {
    watchScene(memory, root.gl, addAfterEffect);
    given.onCreated?.(root);
  };
  // `?dpr=1.5` pins the resolution, for measuring what a scene or an effect costs at one size (nothing adapts, nothing is kept).
  if (slow) return <FailCard title={`This device is too slow to draw ${SCENE_WORDS[memory ?? ''] ?? 'this scene'}.`} note="Closing other tabs and apps, or plugging in, can help. Then reload." />;
  if (PINNED_DPR) return <Canvas {...props} onCreated={onCreated} dpr={PINNED_DPR}><Governor pace={pace} scene={memory} /><TierWatch judge={judgeTier} pace={pace} dpr={PINNED_DPR} max={top} min={minDpr} onSlow={() => setSlow(true)} />{children}</Canvas>;
  return (
    <Canvas {...props} onCreated={onCreated} dpr={state.dpr}>
      <Governor pace={pace} scene={memory} />
      <TierWatch judge={judgeTier} pace={pace} dpr={state.dpr} max={top} min={minDpr} onSlow={() => setSlow(true)} />
      <AdaptiveDpr max={maxDpr} min={minDpr} value={state.dpr} kept={state} pace={pace} onChange={onChange} />
      {children}
    </Canvas>
  );
}
/** The canvas's renderer settings with the default graphics chip asked for, unless the caller chose or made its own. */
function easyOnPower(gl: CanvasProps['gl']): CanvasProps['gl'] {
  if (gl === undefined) return DEFAULT_CHIP;
  if (typeof gl === 'function' || 'render' in gl) return gl;
  return { powerPreference: 'default', ...gl };
}
const DEFAULT_CHIP = { powerPreference: 'default' } as const;
const LAYOUT_SIZE = { offsetSize: true };
const PINNED_DPR = (() => {
  if (typeof location === 'undefined') return 0;
  const v = Number(new URLSearchParams(location.search).get('dpr'));
  return Number.isFinite(v) && v >= 0.5 && v <= 3 ? v : 0;
})();
