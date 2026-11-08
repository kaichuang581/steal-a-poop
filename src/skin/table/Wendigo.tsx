import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { BufferAttribute, BufferGeometry, CatmullRomCurve3, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, SphereGeometry, Vector3 } from 'three';

/**
 * Lore (Brian, 2026-11-08): a wendigo at the edge of the pines on the slope behind the paddock, watching the farm. Not
 * voxels, unlike everything else, on purpose: smooth, gaunt and wrong. About 3.3 m tall and hunched: a starved body with
 * the ribs and spine showing through grey hide, digitigrade legs, arms that hang past its knees into long hooked
 * fingers, torn strips of hide hanging off it, and a bleached deer skull for a head, jaw hanging open, under a wide
 * spread of antlers, with two faint points of light deep in the sockets. It barely moves: a slow breath, and now and
 * then the head tilts, very slowly. Meant to be missed most of the time. Its spot is measured on the slope from the
 * paddock camera (POV_SHOTS.desktop[2]).
 */
export const WENDIGO_AT: [number, number, number] = [6.4, 5.45, -33.4];

const v = (x: number, y: number, z: number) => new Vector3(x, y, z);

/**
 * A smooth tube along the points whose radius follows `r(t)` (0 at the start, 1 at the end), with an elliptical
 * section (`squash` flattens it front to back). Capped at both ends.
 */
function taper(points: Vector3[], r: (t: number) => number, seg = 24, rad = 10, squash = 1): BufferGeometry {
  const curve = new CatmullRomCurve3(points, false, 'centripetal');
  const pos: number[] = [], idx: number[] = [];
  const T = new Vector3(), N = new Vector3(), B = new Vector3(), ref = new Vector3();
  for (let i = 0; i <= seg; i++) {
    const t = i / seg, P = curve.getPointAt(t);
    curve.getTangentAt(t, T);
    ref.set(Math.abs(T.x) > 0.85 ? 0 : 1, 0, Math.abs(T.x) > 0.85 ? 1 : 0);
    N.copy(ref).addScaledVector(T, -ref.dot(T)).normalize();
    B.crossVectors(T, N).normalize();
    const rr = Math.max(0.0008, r(t));
    for (let j = 0; j < rad; j++) {
      const a = (j / rad) * Math.PI * 2;
      pos.push(P.x + (N.x * Math.cos(a) + B.x * Math.sin(a) * squash) * rr, P.y + (N.y * Math.cos(a) + B.y * Math.sin(a) * squash) * rr, P.z + (N.z * Math.cos(a) + B.z * Math.sin(a) * squash) * rr);
    }
  }
  for (let i = 0; i < seg; i++) for (let j = 0; j < rad; j++) {
    const a = i * rad + j, b = i * rad + ((j + 1) % rad), c = a + rad, d = b + rad;
    idx.push(a, c, b, b, c, d);
  }
  const s = curve.getPointAt(0), e = curve.getPointAt(1), cs = pos.length / 3;
  pos.push(s.x, s.y, s.z, e.x, e.y, e.z);
  for (let j = 0; j < rad; j++) { idx.push(cs, j, (j + 1) % rad); idx.push(cs + 1, seg * rad + ((j + 1) % rad), seg * rad + j); }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** A radius profile through the given [t, r] stops, eased between them. */
const profile = (stops: [number, number][]) => (t: number) => {
  for (let i = 1; i < stops.length; i++) if (t <= stops[i][0]) {
    const [t0, r0] = stops[i - 1], [t1, r1] = stops[i], k = (t - t0) / (t1 - t0);
    return lerp(r0, r1, k * k * (3 - 2 * k));
  }
  return stops[stops.length - 1][1];
};
/** A bony limb: thin, with a knob at each joint. */
const bony = (r: number, end: number, joints: number[] = []) => (t: number) => {
  let x = lerp(r, end, t);
  for (const j of joints) x += r * 0.55 * Math.exp(-(((t - j) / 0.045) ** 2));
  return x;
};

function body() {
  const hide: BufferGeometry[] = [], rib: BufferGeometry[] = [], hoof: BufferGeometry[] = [];
  // The trunk: a narrow pelvis, the belly sucked in under the ribs, a deep ribcage, a hunched back into the neck.
  hide.push(taper([v(0, 1.5, -0.04), v(0, 1.72, -0.02), v(0, 1.98, 0.02), v(0, 2.26, 0.12), v(0, 2.44, 0.28), v(0, 2.52, 0.42)],
    profile([[0, 0.13], [0.18, 0.11], [0.3, 0.075], [0.55, 0.19], [0.75, 0.2], [0.9, 0.13], [1, 0.07]]), 32, 14, 0.72));
  // The spine ridged along the back, and the shoulder blades jutting.
  const spine = new CatmullRomCurve3([v(0, 1.6, -0.15), v(0, 1.95, -0.1), v(0, 2.25, -0.03), v(0, 2.45, 0.13), v(0, 2.55, 0.32)]);
  for (let i = 0; i < 12; i++) {
    const p = spine.getPointAt(i / 11);
    rib.push(taper([v(p.x, p.y - 0.02, p.z - 0.01), v(p.x, p.y, p.z - 0.03)], () => 0.022, 2, 6));
  }
  for (const s of [-1, 1]) hide.push(taper([v(s * 0.11, 2.36, 0.02), v(s * 0.17, 2.3, 0.0), v(s * 0.19, 2.18, 0.0)], profile([[0, 0.06], [0.5, 0.07], [1, 0.02]]), 8, 8, 0.5));
  // Ribs: hoops of bone pressing through the hide over the chest and sides.
  for (let i = 0; i < 7; i++) {
    const y = 1.98 + i * 0.065, w = 0.17 + Math.sin((i / 6) * Math.PI) * 0.035, f = (y - 1.98) * 0.5;
    for (const s of [-1, 1]) {
      const pts = Array.from({ length: 6 }, (_, k) => { const a = (k / 5) * 1.5; return v(s * Math.sin(a) * w, y - k * 0.012, -0.08 + Math.cos(a) * w * 0.75 + f + 0.06); });
      rib.push(taper(pts, () => 0.011, 10, 5));
    }
  }
  // Legs, bent backwards like a deer's: a long thigh, the hock high, a long cannon bone, a split black hoof.
  for (const s of [-1, 1]) {
    hide.push(taper([v(s * 0.1, 1.55, -0.02), v(s * 0.15, 1.25, 0.12), v(s * 0.17, 0.98, 0.2), v(s * 0.18, 0.66, 0.0), v(s * 0.18, 0.42, -0.16), v(s * 0.19, 0.16, -0.06), v(s * 0.19, 0.04, 0.02)],
      (t) => bony(0.085, 0.022, [0.42, 0.68])(t) * (t < 0.3 ? 1.25 - t : 1), 36, 10));
    hoof.push(taper([v(s * 0.19, 0.06, 0.0), v(s * 0.19, 0.0, 0.06)], profile([[0, 0.035], [1, 0.012]]), 4, 8));
    // Arms: long and thin, the elbows out, hanging past the knee.
    hide.push(taper([v(s * 0.2, 2.36, 0.3), v(s * 0.34, 2.12, 0.34), v(s * 0.42, 1.78, 0.4), v(s * 0.43, 1.42, 0.46), v(s * 0.38, 1.02, 0.44), v(s * 0.34, 0.8, 0.4)],
      bony(0.055, 0.022, [0.44, 0.97]), 36, 9));
    // Hands: four long fingers, knuckled, curling into hooked claws.
    for (let f = 0; f < 4; f++) {
      const sp = (f - 1.5) * 0.035, curl = 0.05 + f * 0.012;
      hide.push(taper([v(s * 0.34, 0.8, 0.4), v(s * (0.34 + sp), 0.66, 0.43 + sp * 0.4), v(s * (0.33 + sp * 1.3), 0.5, 0.45 + curl), v(s * (0.32 + sp * 1.4), 0.41, 0.42 + curl * 2.2)],
        bony(0.016, 0.0015, [0.35, 0.68]), 16, 6));
    }
    // Torn strips of hide hanging off the shoulders, ribs and hips.
    for (let k = 0; k < 6; k++) {
      const top = [v(s * 0.2, 2.3, 0.18), v(s * 0.2, 2.1, 0.12), v(s * 0.17, 1.9, 0.08), v(s * 0.14, 1.62, 0.04), v(s * 0.22, 2.25, -0.05), v(s * 0.13, 1.5, -0.08)][k];
      const len = 0.22 + ((k * 37) % 7) * 0.05;
      hide.push(taper([top, v(top.x + s * 0.03, top.y - len * 0.5, top.z + 0.02), v(top.x + s * 0.02, top.y - len, top.z + 0.01)], profile([[0, 0.022], [1, 0.002]]), 10, 5, 0.35));
    }
  }
  // The neck, thin and long, reaching forward and down to the head.
  hide.push(taper([v(0, 2.46, 0.36), v(0, 2.58, 0.52), v(0, 2.6, 0.68)], profile([[0, 0.07], [1, 0.045]]), 12, 9));
  return { hide, rib, hoof };
}

/** The head: a long bleached deer skull, the jaw hanging open, teeth, deep sockets, and wide branching antlers. */
function skull() {
  const bone: BufferGeometry[] = [], dark: BufferGeometry[] = [], horn: BufferGeometry[] = [];
  // Cranium to snout tip along +z: round at the back, long and narrowing to the muzzle.
  bone.push(taper([v(0, 0.02, -0.12), v(0, 0.03, 0.0), v(0, 0.0, 0.14), v(0, -0.04, 0.3), v(0, -0.07, 0.42)],
    profile([[0, 0.05], [0.12, 0.115], [0.35, 0.1], [0.7, 0.06], [1, 0.035]]), 24, 12, 0.85));
  // The lower jaw, hanging open.
  bone.push(taper([v(0, -0.08, 0.0), v(0, -0.13, 0.16), v(0, -0.17, 0.34)], profile([[0, 0.05], [1, 0.022]]), 14, 8, 0.45));
  // Teeth along both jaws.
  for (let i = 0; i < 7; i++) for (const s of [-1, 1]) {
    const z = 0.12 + i * 0.04;
    bone.push(taper([v(s * 0.035, -0.07 - i * 0.004, z), v(s * 0.035, -0.11 - i * 0.004, z + 0.01)], profile([[0, 0.009], [1, 0.001]]), 3, 4));
  }
  // The sockets and the nasal hollow: black holes into the bone.
  for (const s of [-1, 1]) {
    // Narrow, slanted, deep: they read as a glare, not as round surprised eyes.
    const eye = new SphereGeometry(0.04, 10, 8); eye.scale(1.05, 0.55, 0.9).rotateZ(s * -0.35).translate(s * 0.078, 0.04, 0.06);
    dark.push(eye);
    // Two thin nasal slits near the muzzle.
    const slit = new SphereGeometry(0.02, 6, 4); slit.scale(0.35, 0.3, 1.6).translate(s * 0.014, -0.03, 0.36);
    dark.push(slit);
  }
  // Antlers: a main beam each side sweeping up, out and back, branching into tines.
  for (const s of [-1, 1]) {
    const main = [v(s * 0.07, 0.1, -0.04), v(s * 0.2, 0.32, -0.1), v(s * 0.34, 0.6, -0.06), v(s * 0.48, 0.86, -0.14), v(s * 0.56, 1.12, -0.08)];
    horn.push(taper(main, profile([[0, 0.034], [1, 0.006]]), 30, 8));
    const curve = new CatmullRomCurve3(main);
    for (const [t, dx, dy, dz, len] of [[0.18, -0.08, 0.3, 0.16, 0.34], [0.42, 0.05, 0.36, 0.14, 0.38], [0.58, 0.24, 0.18, 0.08, 0.3], [0.74, -0.1, 0.34, -0.06, 0.3], [0.88, 0.16, 0.14, 0.1, 0.22]] as const) {
      const p = curve.getPointAt(t), q = v(p.x + s * dx * len * 2, p.y + dy * len * 2, p.z + dz * len * 2);
      horn.push(taper([p, v(lerp(p.x, q.x, 0.5) + s * 0.02, lerp(p.y, q.y, 0.5), lerp(p.z, q.z, 0.5)), q], profile([[0, 0.02], [1, 0.003]]), 12, 6));
    }
  }
  return { bone, dark, horn };
}

export function Wendigo({ reduced }: { reduced: boolean }) {
  const b = useMemo(() => body(), []);
  const h = useMemo(() => skull(), []);
  const hideMat = useMemo(() => new MeshStandardMaterial({ color: '#3A322B', roughness: 0.9, metalness: 0 }), []);
  const ribMat = useMemo(() => new MeshStandardMaterial({ color: '#4A423A', roughness: 0.85, metalness: 0 }), []);
  const boneMat = useMemo(() => new MeshStandardMaterial({ color: '#CDC2A6', roughness: 0.75, metalness: 0 }), []);
  const hornMat = useMemo(() => new MeshStandardMaterial({ color: '#3C3128', roughness: 0.9, metalness: 0 }), []);
  const voidMat = useMemo(() => new MeshBasicMaterial({ color: '#030202' }), []);
  const eyeMat = useMemo(() => new MeshBasicMaterial({ color: '#F2F6FF', transparent: true, opacity: 0.8, fog: false }), []);
  const eyeGeo = useMemo(() => new SphereGeometry(0.013, 6, 4), []);
  const root = useRef<Group>(null), neck = useRef<Group>(null);
  const eyes = useRef<(Mesh | null)[]>([]);
  // It faces the paddock and the farmyard.
  const yaw = useMemo(() => Math.atan2(16 - WENDIGO_AT[0], 4 - WENDIGO_AT[2]), []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (root.current) root.current.scale.y = 1 + (reduced ? 0 : Math.sin(t * 0.6) * 0.008); // a slow breath
    if (neck.current) {
      // Every 9 s the head tilts, slowly, and comes back: curious, not friendly.
      const k = reduced ? 0 : Math.max(0, Math.sin((t / 9) * Math.PI * 2)) ** 3;
      neck.current.rotation.set(0.35, Math.sin(t * 0.11) * 0.06, 0.12 + k * 0.5);
    }
    // The eyes barely there, and now and then catching the light.
    const glint = reduced ? 0.6 : 0.3 + 0.7 * Math.max(0, Math.sin(t * 0.8)) ** 14;
    eyes.current.forEach((m) => { if (m) (m.material as MeshBasicMaterial).opacity = glint; });
  });
  return (
    <group ref={root} position={WENDIGO_AT} rotation={[0, yaw, 0]}>
      {b.hide.map((g, i) => <mesh key={`h${i}`} geometry={g} material={hideMat} />)}
      {b.rib.map((g, i) => <mesh key={`r${i}`} geometry={g} material={ribMat} />)}
      {b.hoof.map((g, i) => <mesh key={`o${i}`} geometry={g} material={voidMat} />)}
      <group ref={neck} position={[0, 2.6, 0.7]} scale={1.4}>
        {h.bone.map((g, i) => <mesh key={`b${i}`} geometry={g} material={boneMat} />)}
        {h.dark.map((g, i) => <mesh key={`d${i}`} geometry={g} material={voidMat} />)}
        {h.horn.map((g, i) => <mesh key={`a${i}`} geometry={g} material={hornMat} />)}
        {[-1, 1].map((s, i) => <mesh key={s} ref={(el) => { eyes.current[i] = el; }} geometry={eyeGeo} material={eyeMat} position={[s * 0.08, 0.04, 0.085]} />)}
      </group>
    </group>
  );
}
