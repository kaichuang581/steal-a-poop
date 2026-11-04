import { describe, expect, it } from 'vitest';
import { Box3, Vector3 } from 'three';
import type { BufferGeometry } from 'three';
import { digitGeometry, heapModel, icicleModel, sheepdogModel, shearsModel, tuftGeometry, wolfEyes, wolfModel } from '../characters';
import type { Part } from '../sheep';

const sum = (parts: Part[]) => parts.reduce((n, p) => n + p.voxels, 0);
const size = (g: BufferGeometry) => { g.computeBoundingBox(); return g.boundingBox!.getSize(new Vector3()); };
const verts = (g: BufferGeometry) => g.getAttribute('position').count;

describe('characters', () => {
  it('wolf builds within budget', () => {
    const m = wolfModel();
    const n = sum([m.body, m.head, m.tail, m.eyes, ...m.legs]);
    expect(n).toBeGreaterThan(1000);
    expect(n).toBeLessThan(15000);
    expect(m.eyes.voxels).toBe(4);
    expect(verts(wolfEyes())).toBeGreaterThan(0);
  });
  it('sheepdog, shears and icicle build', () => {
    const d = sheepdogModel();
    const n = sum([d.body, d.head, d.tail, ...d.ears, ...d.legs]);
    expect(n).toBeGreaterThan(800);
    expect(n).toBeLessThan(15000);
    const sh = shearsModel();
    expect(sh.bladeA.voxels).toBeGreaterThan(20);
    expect(sh.bladeB.voxels).toBeGreaterThan(20);
    const ic = icicleModel();
    expect(ic.ice.voxels).toBeGreaterThan(40);
    expect(verts(ic.drip)).toBe(24);
  });
  it('tufts have 40 to 80 voxels', () => {
    for (const seed of [1, 7, 71, 99]) {
      const faces = verts(tuftGeometry(seed)) / 4;
      expect(faces).toBeGreaterThan(20);
      expect(faces).toBeLessThan(80 * 6);
    }
  });
  it('heap grows with level and is empty at 0', () => {
    const heap = heapModel();
    expect(verts(heap(0))).toBe(0);
    const a = size(heap(2)), b = size(heap(8));
    expect(b.x).toBeGreaterThan(a.x);
    expect(b.y).toBeGreaterThan(a.y);
    expect(b.x).toBeGreaterThan(1.2);
    expect(b.x).toBeLessThan(1.6);
    expect(b.y).toBeGreaterThan(0.65);
    expect(b.y).toBeLessThan(0.95);
    expect(heap(8)).toBe(heap(8));
  });
  it('digits are centred on the origin', () => {
    const g = digitGeometry('42');
    expect(verts(g)).toBeGreaterThan(0);
    g.computeBoundingBox();
    const c = g.boundingBox!.getCenter(new Vector3());
    expect(Math.abs(c.x)).toBeLessThan(0.07);
    expect(digitGeometry('42')).toBe(g);
    expect(new Box3().setFromBufferAttribute(g.getAttribute('position') as never).isEmpty()).toBe(false);
  });
});
