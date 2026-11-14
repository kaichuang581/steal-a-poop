import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SACK, SACK_IDS } from '../sacks';
import { crateGrid, sackInCrate, SACK_IN_CRATE, stallGrid, stallLanternGrid, valanceGrid } from '../stallModels';
import { CRATE, CRATE_BOX, DEPTH, frame, LANTERN_BOX, POST_INSET, rise, SACK_ROWS, STALL_SIZES, STALLS, valanceBox } from '../stallPlan';
import { GRAIN, sackGrid } from '../thumbModels';
import { lin } from '../../voxel/palette';

/**
 * The Feed Sacks' market stall (Brian, 2026-11-13). The picture is baked from stallModels.ts and the page lays the crates,
 * tags and lantern over it from stallPlan.ts: these hold the two to each other, and to what was asked for.
 */
const css = readFileSync('src/skin/styles/skin.css', 'utf8');
const screen = readFileSync('src/skin/shop/FeedSacks.tsx', 'utf8');
const all = STALL_SIZES.map((s) => STALLS[s]);

describe('the stall, measured', () => {
  it('has an awning that starts and ends on red: every width is a whole, odd number of stripes', () => {
    for (const p of all) {
      expect(p.w % p.stripe, p.size).toBe(0);
      expect((p.w / p.stripe) % 2, p.size).toBe(1);
    }
  });
  it('stands the three crates between the posts, clear of each other and of the scale', () => {
    for (const p of all) {
      const half = CRATE.w / 2, left = POST_INSET + p.post, right = p.w - POST_INSET - p.post;
      expect(p.crates[0] - half, p.size).toBeGreaterThanOrEqual(left);
      expect(p.crates[2] + half, p.size).toBeLessThanOrEqual(right);
      expect(p.crates[1] - p.crates[0], p.size).toBeGreaterThanOrEqual(CRATE.w);
      expect(p.crates[2] - p.crates[1], p.size).toBeGreaterThanOrEqual(CRATE.w);
      // The scale is 16 voxels across, pans and all.
      if (p.scale !== null) {
        expect(p.scale - 8, p.size).toBeGreaterThanOrEqual(left);
        expect(p.scale + 8, p.size).toBeLessThanOrEqual(p.crates[0] - half);
      }
    }
  });
  it('hangs the sign between the first two sacks, under the awning edge, where neither sack covers it', () => {
    for (const p of all.filter((q) => q.sign)) {
      const s = p.sign!;
      // A sack is 14 voxels across at its widest.
      expect(s.x, p.size).toBeGreaterThanOrEqual(p.crates[0] + 7);
      expect(s.x + s.w - 1, p.size).toBeLessThanOrEqual(p.crates[1] - 7);
      expect(rise(s.y + s.h, 2), p.size).toBeLessThan(valanceBox(p).bottom + 0.4);
    }
  });
  it('keeps a phone to the awning, the counter front, the crates and the tags', () => {
    const p = STALLS.narrow;
    expect([p.stock, p.scale, p.sign]).toEqual([false, null, null]);
    for (const q of all.filter((x) => x.size !== 'narrow')) expect(q.stock, q.size).toBe(true);
    // Nothing stands on the wall or the floor of the phone's picture: no shelf, nothing hung, no barrel.
    const g = stallGrid(p);
    const behind = [...g.map.values()].filter((v) => v.y > p.top + 1 && v.y < p.valance && v.z >= 1 && v.z <= 12 && v.x > POST_INSET + p.post && v.x < p.w - POST_INSET - p.post - 1);
    expect(behind).toEqual([]);
    const onFloor = (q: typeof p) => [...stallGrid(q).map.values()].some((v) => v.y >= 0 && v.y < q.panel && v.z > DEPTH.lip);
    expect(onFloor(p)).toBe(false);
    expect(onFloor(STALLS.wide)).toBe(true);
  });
  it('makes each front panel tall enough for its tag, at the narrowest that stall is drawn', () => {
    // The stall's width in px at its narrowest, the tag's type size there, and the tag's height in ems (skin.css .sk-stall-tag).
    const cases = { wide: [744, 13.7, 3.65], low: [1088, 19, 3.65], mid: [460, 12, 3.9], narrow: [300, 12.15, 3.9] } as const;
    for (const p of all) {
      const [width, type, ems] = cases[p.size], px = width / p.w;
      const room = (rise(p.panel - 1, DEPTH.front + 1) - frame(p).bottom) * px;
      expect(room, p.size).toBeGreaterThanOrEqual(12 + ems * type);
    }
  });
  it('fits every crate, its sack and the lantern inside the picture', () => {
    for (const p of all) {
      const f = frame(p), foot = rise(p.top, DEPTH.crateRest);
      expect(foot - CRATE_BOX.below, p.size).toBeGreaterThan(f.bottom);
      expect(foot - CRATE_BOX.below + CRATE_BOX.h, p.size).toBeLessThan(f.top);
      p.crates.forEach((x, n) => {
        const lantern = x + p.lantern[n] * 8;
        expect(lantern - 3, `${p.size} lantern ${n}`).toBeGreaterThanOrEqual(POST_INSET);
        expect(lantern + 3, `${p.size} lantern ${n}`).toBeLessThanOrEqual(p.w - POST_INSET);
      });
      expect(LANTERN_BOX.h).toBeGreaterThan(8 + LANTERN_BOX.above);
    }
  });
  it('slides a picked crate no further than the plank goes', () => {
    expect(DEPTH.cratePicked).toBeLessThanOrEqual(DEPTH.front);
    expect(DEPTH.cratePicked - DEPTH.crateRest).toBeGreaterThan(0);
  });
});

describe('the stall, built', () => {
  it('keeps the sacks as they were: the same voxels, stood in a crate', () => {
    for (const s of SACK_IDS) {
      const a = sackGrid(s), b = sackInCrate(s);
      expect(b.count).toBe(a.count);
      for (const v of a.map.values()) expect(b.has(v.x + SACK_IN_CRATE.x, v.y + SACK_IN_CRATE.y, v.z + SACK_IN_CRATE.z)).toBe(true);
      expect(Math.max(...[...a.map.values()].map((v) => v.y)) + 1).toBe(SACK_ROWS);
    }
  });
  it('heaps each crate with its own grain, and puts a scoop in one', () => {
    const tin = lin('#b9c2ca');
    const hasTin = (s: (typeof SACK_IDS)[number]) => [...crateGrid(s).map.values()].some((v) => v.c[0] === tin[0] && v.c[1] === tin[1] && v.c[2] === tin[2]);
    for (const s of SACK_IDS) {
      const pale = lin(GRAIN[s][0]);
      const grains = [...crateGrid(s).map.values()].filter((v) => v.c[0] === pale[0] && v.c[1] === pale[1] && v.c[2] === pale[2]);
      expect(grains.length, s).toBeGreaterThan(20);
      // Heaped: some of it stands above the low front board.
      expect(Math.max(...grains.map((v) => v.y)), s).toBeGreaterThan(CRATE.front);
    }
    expect(SACK_IDS.filter(hasTin)).toEqual(['bomb']);
  });
  it('cuts a scallop under every stripe of the awning edge', () => {
    for (const p of all) {
      const g = valanceGrid(p), A = DEPTH.awningFront;
      for (let x = 0; x < p.w; x++) {
        const corner = x % p.stripe === 0 || x % p.stripe === p.stripe - 1;
        expect(g.has(x, p.valance, A), `${p.size} ${x}`).toBe(!corner);
        expect(g.has(x, p.bar + 1, A), `${p.size} ${x}`).toBe(true);
      }
      // The band the edge is sewn to is in the backdrop too, so nothing shows through when the edge sags.
      expect(stallGrid(p).has(0, p.bar, A)).toBe(true);
    }
  });
  it('dims the stock on the wall by a fifth, and nothing in front of it', () => {
    // A shelf's front edge is painted #e8bc7e and shown 20% darker: 0.8 as seen is 0.8 ^ 2.2 in linear light.
    const g = stallGrid(STALLS.wide), p = STALLS.wide;
    const edge = g.map.get(`${p.crates[1]},${p.top + 5},${DEPTH.shelf}`)!.c;
    const full = [0xe8, 0xbc, 0x7e].map((v) => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
    edge.forEach((v, i) => expect(v / full[i]).toBeCloseTo(0.8 ** 2.2, 2));
  });
  it('has a lantern that hangs from its ring', () => {
    const ys = [...stallLanternGrid().map.values()].map((v) => v.y);
    expect(Math.max(...ys)).toBe(-1);
    expect(Math.min(...ys)).toBe(-8);
  });
});

describe('the stall, on the page', () => {
  it('has every baked picture (node tools/renderStall.mjs)', () => {
    const names = [...STALL_SIZES.flatMap((s) => [s, `${s}-valance`]), ...SACK_IDS.flatMap((s) => [`crate-${s}`, `sack-${s}`]), 'lantern'];
    for (const n of names) expect(existsSync(`public/shop/stall/${n}.webp`), n).toBe(true);
  });
  it('chalks the price the roll uses on the sign', () => {
    expect(SACK.price).toBe(250);
    expect(screen).toMatch(/<span>Feed Sacks<\/span>.*\{formatCoins\(SACK\.price\)\} each/);
  });
  it('hangs each tag by 12 px of string, steps the picked crate 8 px forward, and rings its tag in amber', () => {
    expect(css).toMatch(/\.sk-stall-hang \{[^}]*padding-top: 12px/);
    expect(css).toMatch(/\.sk-stall-sack\[aria-checked="true"\] \.sk-stall-art \{[^}]*translate: 0 8px/);
    expect(css).toMatch(/\.sk-stall-sack\[aria-checked="true"\] \.sk-stall-tag \{[^}]*inset 0 0 0 3px var\(--amber\)/);
  });
  it('sways the awning edge by one degree in all, wobbles a hovered sack by two, and stops both under reduced motion', () => {
    const sway = /@keyframes sk-awning-sway \{ from \{ rotate: calc\(var\(--sway\) \* (-?[\d.]+)deg\); \} to \{ rotate: calc\(var\(--sway\) \* (-?[\d.]+)deg\); \} \}/.exec(css)!;
    expect(Number(sway[2]) - Number(sway[1])).toBeCloseTo(1);
    expect(css).toMatch(/\.sk-stall-sack:hover \.sk-stall-burlap \{ animation: sk-sack-wobble/);
    expect(css).toMatch(/@keyframes sk-sack-wobble \{[^@]*rotate: -2deg[^@]*rotate: 2deg/);
    const reduced = css.split('\n').filter((l) => l.includes('.sk-stall-valance > i') && l.includes('animation: none'));
    expect(reduced).toHaveLength(2);
    for (const l of reduced) expect(l).toContain('.sk-stall-burlap');
  });
  it('has no soft ellipse under a sack any more, and one lantern', () => {
    expect(screen).not.toMatch(/<ellipse/);
    expect(screen.match(/stallArt\('lantern'\)/g)).toHaveLength(1);
  });
});
