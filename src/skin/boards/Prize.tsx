import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { AdditiveBlending, BufferGeometry, CanvasTexture, Float32BufferAttribute, Points, SRGBColorSpace, Sprite, SpriteMaterial, Vector2 } from 'three';
import type { Group, ShaderMaterial } from 'three';
import { spritePoints } from './points';
import { voxelMaterial } from '../voxel/material';
import { cupGeometry, PRIZE_BOB, PRIZE_SCALE } from './cup';

/**
 * The champion's trophy, floating and glowing over its head (Brian, 2026-11-22, with a picture of a champion with both
 * arms raised: "make first place more like this with the trophy floating and glowing above his head"). The cup of cup.ts
 * lit from within, a warm halo behind it, slow rays turning, six sparkles twinkling round it; the cup bobs and turns a
 * little to show its handles. No light of its own on the wool (it whitened the champion in version 2). Under reduced
 * motion: the same, still.
 */
const SWAY = 0.35;

const make = (w: number, h: number, draw: (x: CanvasRenderingContext2D) => void) => {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d')!);
  const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; return t;
};

export function Prize({ reduced }: { reduced: boolean }) {
  const cup = cupGeometry();
  const gold = useMemo(() => voxelMaterial({ emissive: '#FFB020', emissiveIntensity: 0.55 }), []);
  const ruby = useMemo(() => voxelMaterial({ emissive: '#FF2A6A', emissiveIntensity: 0.9 }), []);
  const fx = useMemo(() => {
    const halo = make(128, 128, (x) => {
      const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
      g.addColorStop(0, 'rgba(255,236,170,0.95)'); g.addColorStop(0.35, 'rgba(255,200,90,0.45)'); g.addColorStop(1, 'rgba(255,170,60,0)');
      x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    });
    const rays = make(256, 256, (x) => {
      x.translate(128, 128);
      for (let i = 0; i < 12; i++) {
        x.rotate((Math.PI * 2) / 12);
        const g = x.createLinearGradient(0, 0, 0, -128);
        g.addColorStop(0, 'rgba(255,240,190,0.7)'); g.addColorStop(1, 'rgba(255,220,140,0)');
        x.fillStyle = g;
        x.beginPath(); x.moveTo(-5, 0); x.lineTo(-16, -128); x.lineTo(16, -128); x.lineTo(5, 0); x.fill();
      }
    });
    const spark = make(64, 64, (x) => {
      x.fillStyle = '#FFFFFF';
      x.beginPath(); x.moveTo(32, 0); x.lineTo(37, 27); x.lineTo(64, 32); x.lineTo(37, 37); x.lineTo(32, 64); x.lineTo(27, 37); x.lineTo(0, 32); x.lineTo(27, 27); x.closePath(); x.fill();
    });
    const sprite = (map: CanvasTexture, opacity = 1) => new Sprite(new SpriteMaterial({ map, transparent: true, depthWrite: false, blending: AdditiveBlending, opacity, fog: false }));
    // The six sparkles in one draw.
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(new Float32Array(18), 3));
    g.setAttribute('size', new Float32BufferAttribute(new Float32Array(6), 1));
    g.setAttribute('alpha', new Float32BufferAttribute(new Float32Array(6).fill(1), 1));
    const sparks = new Points(g, spritePoints(spark));
    sparks.frustumCulled = false;
    return { halo: sprite(halo, 0.85), rays: sprite(rays, 0.6), sparks, maps: [halo, rays, spark] };
  }, []);
  useEffect(() => () => fx.maps.forEach((m) => m.dispose()), [fx]);
  const spin = useRef<Group>(null);
  const gl = useThree((st) => st.gl);
  const buf = useMemo(() => new Vector2(), []);
  const h = cup.height * PRIZE_SCALE, mid = h * 0.55;
  useFrame(({ clock }) => {
    const t = reduced ? 0 : clock.elapsedTime;
    if (spin.current) {
      spin.current.position.y = (PRIZE_BOB * (1 + Math.sin(t * 2.6))) / 2;
      spin.current.rotation.y = SWAY * Math.sin(t * 0.9);
    }
    fx.rays.material.rotation = t * 0.25;
    fx.halo.scale.setScalar(h * 2.1 * (1 + 0.05 * Math.sin(t * 3.1)));
    const pos = fx.sparks.geometry.getAttribute('position'), size = fx.sparks.geometry.getAttribute('size');
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + t * 0.6, r = h * (0.62 + 0.08 * Math.sin(t * 1.7 + i));
      pos.setXYZ(i, Math.cos(a) * r, mid + Math.sin(a) * r * 0.85, 0.1);
      size.setX(i, h * 0.16 * (0.35 + 0.65 * Math.abs(Math.sin(t * 2.2 + i * 1.3))));
    }
    pos.needsUpdate = size.needsUpdate = true;
    (fx.sparks.material as ShaderMaterial).uniforms.scale.value = gl.getDrawingBufferSize(buf).y / 2;
  });
  return (
    <group>
      <primitive object={fx.rays} position={[0, mid, -0.15]} scale={[h * 2.3, h * 2.3, 1]} renderOrder={1} />
      <primitive object={fx.halo} position={[0, mid, -0.1]} renderOrder={1} />
      <group ref={spin}>
        <mesh geometry={cup.body} material={gold} scale={PRIZE_SCALE} castShadow />
        <mesh geometry={cup.gem} material={ruby} scale={PRIZE_SCALE} />
      </group>
      <primitive object={fx.sparks} renderOrder={2} />
    </group>
  );
}
