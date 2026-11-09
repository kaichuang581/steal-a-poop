import { beforeEach, describe, expect, it } from 'vitest';
import { ADMIN_AVATAR_ID, ANIMAL_AVATAR_IDS, AVATAR_IDS, isAvatarId } from '../../../avatars/ids';
import { useAdmin } from '../../../lib/admin';
import { ANIMALS, CHARACTERS, byId } from '../catalog';
import { DISC, discPose } from '../discPose';
import { PORTRAIT } from '../portraits';
import { getAvatar, setAvatar } from '../store';

describe('avatar catalog', () => {
  it('offers the animals the server accepts, each once, and never the admin avatar', () => {
    expect(CHARACTERS.map((c) => c.id).sort()).toEqual([...ANIMAL_AVATAR_IDS].sort());
    expect([...AVATAR_IDS].sort()).toEqual([...ANIMAL_AVATAR_IDS, ADMIN_AVATAR_ID].sort());
    expect(byId(ADMIN_AVATAR_ID)).toBeUndefined();
  });
  it('is six distinct animals, one each, named after the animal', () => {
    expect(ANIMALS).toHaveLength(6);
    expect(new Set(CHARACTERS.map((c) => c.animal)).size).toBe(6);
    for (const c of CHARACTERS) expect(c.name.toLowerCase()).toBe(c.animal);
  });
  it('looks characters up by id', () => {
    expect(byId('sheep')?.name).toBe('Sheep');
    expect(byId('sheep-dash')).toBeUndefined();
    expect(isAvatarId('kaiyan')).toBe(true);
  });
});

describe('avatar store', () => {
  // The tests run in node: give the store a localStorage to keep things in.
  const mem = new Map<string, string>();
  beforeEach(() => {
    mem.clear();
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => { mem.set(k, v); }, removeItem: (k: string) => { mem.delete(k); }, clear: () => mem.clear(),
    };
    useAdmin.setState({ admin: false });
  });
  it('keeps an animal, and forgets an id that is no longer offered', () => {
    setAvatar('cow');
    expect(getAvatar()).toBe('cow');
    localStorage.setItem('sap:avatar', 'cow-mae');
    expect(getAvatar()).toBeNull();
  });
  it('only wears the admin avatar while admin is unlocked', () => {
    setAvatar(ADMIN_AVATAR_ID);
    expect(getAvatar()).toBeNull();
    useAdmin.setState({ admin: true });
    expect(getAvatar()).toBe(ADMIN_AVATAR_ID);
    useAdmin.setState({ admin: false });
    expect(getAvatar()).toBeNull();
  });
});

describe('the avatar coin', () => {
  it('draws every portrait inside the 12 x 12 grid', () => {
    for (const rects of Object.values(PORTRAIT)) for (const [x, y, w, h] of rects) { expect(x).toBeGreaterThanOrEqual(0); expect(y).toBeGreaterThanOrEqual(0); expect(x + w).toBeLessThanOrEqual(12); expect(y + h).toBeLessThanOrEqual(12); }
    expect(Object.keys(PORTRAIT)).toHaveLength(6);
  });
  it('rests on the snow, wiggles and hops when idle, and holds still when asked', () => {
    expect(DISC.rest).toBeGreaterThanOrEqual(DISC.radius * DISC.tall);
    let hopped = false, wiggled = false;
    for (let t = 0; t < 12; t += 0.05) { const p = discPose('idle', t, t, 0, true); if (p.lift > 0.1) hopped = true; if (Math.abs(p.rotZ) > 0.05) wiggled = true; expect(p.lift).toBeGreaterThan(-0.05); }
    expect(hopped && wiggled).toBe(true);
    const still = discPose('idle', 3, 3, 0, false);
    expect(still).toEqual({ lift: 0, rotX: 0, rotY: 0, rotZ: 0 });
  });
  it('jumps when happy, turns right round when proud, and does not move once frozen', () => {
    expect(discPose('happy', 0.2, 10, 0, true).lift).toBeGreaterThan(0.2);
    expect(discPose('proud', 0.5, 10, 0, true).rotY).toBeCloseTo(Math.PI, 1);
    expect(discPose('frozen', 1, 10, 0, true)).toEqual(discPose('frozen', 5, 20, 3, true));
  });
});
