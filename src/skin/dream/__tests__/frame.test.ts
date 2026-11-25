import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { signLayout } from '../Signs';
import { ART, dreamView, SHEEP_ART } from '../stage';
import {
  BED_BOX, BED_SIDE, bubbleShape, CAP_TIP, dreamFrame, isPhoneLayout, meterSegments, NOSE, pixelDisc, RIM, SHADE, SIGN_BOARD, signHeight, signWidth, stripCamera,
  stripExtent, stripPoint, tailPuffs, tileFit, TRAY, unitOf,
} from '../frame';
import { trayWord } from '../Interface';
import { ART_GRIDS } from '../pixelArt';

/** Counting Sheep's screen (docs/dream/02-layout-and-interface.md, section 3; 01-farmer.md, section 4). */
const COMPUTERS = [[1440, 900], [1280, 720], [1920, 1080], [900, 600], [2560, 1080]] as const;
/** Phones, as much of each as is visible above its keyboard. */
const PHONES = [[390, 544], [390, 844], [360, 380], [844, 390]] as const;
const points = (poly: string) => [...poly.matchAll(/(-?[\d.]+)px (-?[\d.]+)px/g)].map((m) => [Number(m[1]), Number(m[2])] as const);

describe('the layout', () => {
  it('is the computer\'s from 900 x 600 up, and the phone\'s otherwise', () => {
    expect(isPhoneLayout(900, 600)).toBe(false);
    expect(isPhoneLayout(899, 900)).toBe(true);
    expect(isPhoneLayout(1440, 599)).toBe(true);
  });
  it('gives a computer its bed strip, the dream window 6 above it, and the tray over the strip', () => {
    for (const [w, h] of COMPUTERS) {
      const f = dreamFrame(w, h);
      expect(f.strip.h).toBe(Math.min(240, Math.max(160, 0.24 * h)));
      expect(f.strip.y + f.strip.h).toBe(h);
      expect(f.bedZone).toBe(Math.min(590, Math.max(380, 0.36 * w)));
      // Inset 10 from the top, left and right; its straight lower edge 6 above the strip.
      expect([f.bubble.x, f.bubble.y, f.bubble.w]).toEqual([10, 10, w - 20]);
      expect(f.bubble.y + f.bubble.h).toBe(f.strip.y - 6);
      // The tray: centred on the middle of the space right of the bed zone, 14 above the bottom, on the strip alone.
      expect(Math.abs(f.tray.x + f.tray.w / 2 - (f.bedZone + w) / 2)).toBeLessThanOrEqual(1);
      expect(Math.abs(h - (f.tray.y + f.tray.h) - 14 * f.u)).toBeLessThanOrEqual(1);
      expect(f.tray.y).toBeGreaterThanOrEqual(f.strip.y);
      expect(f.tray.x).toBeGreaterThanOrEqual(f.bedZone);
      expect(f.tray.x + f.tray.w).toBeLessThanOrEqual(w);
      // The bedroom's canvas runs on up behind the window's cut bottom corners, so the wall shows right up to its shade.
      expect(f.room.y).toBeLessThanOrEqual(f.bubble.y + f.bubble.h - 12);
      expect(f.room.y + f.room.h).toBe(h);
    }
  });
  it('stacks a phone: the dream, the strip, the tray, and nothing over anything at 360 wide with the keyboard up', () => {
    for (const [w, h] of PHONES) {
      const f = dreamFrame(w, h);
      expect(f.phone).toBe(true);
      expect(f.u).toBe(1);
      expect([f.bubble.x, f.bubble.y, f.bubble.w, f.bubble.h]).toEqual([6, 6, w - 12, h - 152]);
      expect(f.strip.h).toBe(56);
      expect([f.tray.w, f.tray.h, h - (f.tray.y + f.tray.h)]).toEqual([w - 12, 84, 6]);
      // Top to bottom, each ends where the next begins (the window's shade lies on the strip's wall).
      expect(f.strip.y + f.strip.h).toBe(f.tray.y);
      expect(f.bubble.y + f.bubble.h).toBe(f.strip.y);
      // The hint is inside the dream window, along its bottom edge.
      expect(h - f.hint.bottom).toBeLessThanOrEqual(f.bubble.y + f.bubble.h);
      expect(f.hint.x).toBeGreaterThanOrEqual(f.bubble.x + RIM);
    }
  });
  it('scales the kit\'s unit with the screen, and leaves a phone\'s at 1', () => {
    expect(unitOf(1280, 720, false)).toBe(1);
    expect(unitOf(1440, 900, false)).toBe(1.125);
    expect(unitOf(4000, 3000, false)).toBe(1.5);
    expect(unitOf(900, 600, false)).toBe(0.8);
    expect(unitOf(390, 544, true)).toBe(1);
  });
});

describe('the thought bubble', () => {
  it('is a cloud: puffs along the top, a low wavy bottom over the room, and the rim 6 inside all round', () => {
    for (const [w, h] of [...COMPUTERS, ...PHONES]) {
      const f = dreamFrame(w, h), W = f.bubble.w, H = f.bubble.h, shape = bubbleShape(W, H);
      const outer = points(shape.outer), inner = points(shape.inner);
      // Inside its box and touching every side of it.
      for (const [x, y] of outer) { expect(x).toBeGreaterThanOrEqual(-0.1); expect(x).toBeLessThanOrEqual(W + 0.1); expect(y).toBeGreaterThanOrEqual(-0.1); expect(y).toBeLessThanOrEqual(H + 0.1); }
      expect(Math.min(...outer.map((p) => p[1]))).toBeLessThan(1);
      expect(Math.max(...outer.map((p) => p[1]))).toBeGreaterThan(H - 1);
      expect(Math.min(...outer.map((p) => p[0]))).toBeLessThan(1);
      expect(Math.max(...outer.map((p) => p[0]))).toBeGreaterThan(W - 1);
      // Puffs along the top: the edge dips and rises again at least five times.
      const top = outer.filter(([x, y]) => y < H / 3 && x > W * 0.1 && x < W * 0.9).sort((a, b) => a[0] - b[0]);
      let dips = 0;
      for (let i = 1; i < top.length - 1; i++) if (top[i][1] > top[i - 1][1] && top[i][1] >= top[i + 1][1] && top[i][1] > 4) dips++;
      expect(dips).toBeGreaterThanOrEqual(5);
      // The bottom, away from the corners, never rises past the 12 px where the room stands behind it.
      for (const [x, y] of outer) if (y > H / 2 && x > 40 && x < W - 40 && Math.abs(y - H) < 60) expect(y).toBeGreaterThanOrEqual(H - 12.5);
      // The dream's clip stays RIM inside the box.
      for (const [x, y] of inner) { expect(x).toBeGreaterThanOrEqual(RIM - 0.1); expect(x).toBeLessThanOrEqual(W - RIM + 0.1); expect(y).toBeGreaterThanOrEqual(RIM - 0.1); expect(y).toBeLessThanOrEqual(H - RIM + 0.1); }
    }
  });
  it('draws a puff as a round disc in 2 px steps, the same on both sides', () => {
    for (const d of [12, 16, 26, 40]) {
      const pts = points(pixelDisc(d));
      for (const [x, y] of pts) { expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThanOrEqual(d); expect(y % 2).toBe(0); }
      const right = pts.slice(0, pts.length / 2), left = pts.slice(pts.length / 2).reverse();
      right.forEach(([x, y], i) => { expect(left[i][1]).toBe(y); expect(left[i][0]).toBeCloseTo(d - x, 6); });
      // Widest at its middle, narrowest at the top.
      expect(Math.max(...right.map((p) => p[0]))).toBe(d);
      expect(right[0][0]).toBeLessThan(d);
    }
  });
});

describe('the tray', () => {
  it('holds seven 40 px tiles on a computer, shrinks them as the word grows, then slides', () => {
    const f = dreamFrame(1440, 900);
    expect(tileFit(4, f.tiles, false, f.u)).toEqual({ size: 40, fit: 4 });
    expect(tileFit(7, f.tiles, false, f.u)).toEqual({ size: 40, fit: 7 });
    expect(tileFit(8, f.tiles, false, f.u).size).toBe(32);
    expect(tileFit(9, f.tiles, false, f.u).size).toBe(28);
    const long = tileFit(19, f.tiles, false, f.u);
    expect(long.size).toBe(28);
    expect(long.fit).toBe(9);
    const p = dreamFrame(390, 544);
    expect(tileFit(5, p.tiles, true).size).toBe(28);
    expect(tileFit(19, p.tiles, true).size).toBe(20);
    expect(TRAY.computer.sizes).toEqual([40, 36, 32, 28]);
  });
  it('fits the meter\'s segments under the tiles', () => {
    const f = dreamFrame(1280, 720);
    const n = meterSegments(f.tiles, false, f.u);
    expect(n * 27 - 5).toBeLessThanOrEqual(f.tiles + 0.5);
    expect((n + 1) * 27 - 5).toBeGreaterThan(f.tiles);
  });
  it('takes the word typed whole or from where the sign stops', () => {
    // Typed whole: the sign's letters fall into their tiles, the rest follows.
    expect(trayWord(['c', 'a'], 'card')).toEqual({ rest: 'rd', word: 'card' });
    expect(trayWord(['c', 'a'], 'c')).toEqual({ rest: '', word: 'c' });
    // Typed from where the sign stops.
    expect(trayWord(['c', 'a'], 'rd')).toEqual({ rest: 'rd', word: 'card' });
    expect(trayWord(['s'], 'HEEP')).toEqual({ rest: 'heep', word: 'sheep' });
    // No fence coming: typing ahead shows what is typed.
    expect(trayWord([], 'barn')).toEqual({ rest: 'barn', word: 'barn' });
    expect(trayWord(['l'], 'llama')).toEqual({ rest: 'lama', word: 'llama' });
  });
});

describe('the bed strip\'s camera', () => {
  it('frames the bed: from 1.1 m over the mattress, the headboard 24 px in, the foot short of the bed zone, the strip its 20 degrees', () => {
    for (const [w, h] of COMPUTERS) {
      const f = dreamFrame(w, h), c = stripCamera(f);
      // The outer edge of the headboard's knob.
      expect(stripPoint(c, BED_BOX.headX, BED_BOX.headTop, BED_BOX.headFront)[0]).toBeCloseTo(24, 6);
      const foot = stripPoint(c, BED_BOX.footX, BED_BOX.top, BED_BOX.nearZ)[0];
      expect(foot).toBeLessThan(f.bedZone - 50);
      expect(foot).toBeGreaterThan(f.bedZone - 110);
      expect(c.position[1]).toBeCloseTo(BED_BOX.top + 1.1, 9);
      expect(c.position[0]).toBe(BED_BOX.midX);
      expect((2 * Math.atan(f.strip.h / 2 / c.focal) * 180) / Math.PI).toBeCloseTo(BED_SIDE.fov, 6);
      // The strip's bottom edge cuts the bed just under its side rail.
      expect(stripPoint(c, 1, BED_SIDE.cut, BED_BOX.nearZ)[1]).toBeCloseTo(h, 6);
      // From up there he is seen from above: his nose lands higher on the screen than the near edge of the mattress.
      expect(stripPoint(c, NOSE.x, NOSE.y, NOSE.z)[1]).toBeLessThan(stripPoint(c, NOSE.x, BED_BOX.top, BED_BOX.nearZ)[1]);
    }
  });
  it('keeps his head and the tip of his cap in a phone\'s strip', () => {
    for (const [w, h] of PHONES) {
      const f = dreamFrame(w, h), c = stripCamera(f);
      for (const p of [NOSE, CAP_TIP]) {
        const [x, y] = stripPoint(c, p.x, p.y, p.z);
        expect(x).toBeGreaterThan(0);
        expect(x).toBeLessThan(f.bedZone);
        expect(y).toBeGreaterThan(f.strip.y);
        expect(y).toBeLessThan(f.strip.y + f.strip.h);
      }
    }
  });
  it('shows what the dream is made of clear of the tray on screens 1280 wide or more', () => {
    for (const [w, h] of [[1280, 720], [1440, 900], [1920, 1080]] as const) {
      const f = dreamFrame(w, h), c = stripCamera(f);
      // The nightstand's right side, the basket's, and the bookshelf's (bedroom.ts).
      for (const [x, y, z] of [[3.6, 0.6, -0.75], [4.02, 0.2, -0.75], [4.05, 1.05, -1.3]] as const) {
        const [sx, sy] = stripPoint(c, x, y, z);
        expect(sx).toBeLessThan(f.tray.x);
        expect(sy).toBeGreaterThan(f.room.y);
      }
    }
  });
  it('runs the wall on to the screen\'s right edge, with the window at its end from 1200 wide', () => {
    for (const [w, h] of COMPUTERS) {
      const f = dreamFrame(w, h), c = stripCamera(f), e = stripExtent(f, c);
      expect(stripPoint(c, e.x1, 1, -1.3)[0]).toBeGreaterThanOrEqual(w);
      if (w < 1200) { expect(e.windowX).toBeNull(); continue; }
      const right = stripPoint(c, e.windowX! + 0.8, 1, -1.3)[0];
      expect(right).toBeLessThanOrEqual(w - 30);
      expect(right).toBeGreaterThanOrEqual(w - 60);
      expect(stripPoint(c, e.windowX!, 1, -1.3)[0]).toBeGreaterThan(f.tray.x + f.tray.w);
    }
    expect(stripExtent(dreamFrame(390, 544)).windowX).toBeNull();
  });
  it('brings the tail up from the tip of his cap to the window\'s shade, three round puffs, the smallest last', () => {
    for (const [w, h] of [...COMPUTERS, ...PHONES]) {
      const f = dreamFrame(w, h), c = stripCamera(f), puffs = tailPuffs(f, c), [cx, cy] = stripPoint(c, CAP_TIP.x, CAP_TIP.y, CAP_TIP.z);
      expect(puffs.map((p) => p.w)).toEqual(f.phone ? [26, 18, 12] : [40, 26, 16]);
      const mid = puffs.map((p) => [p.x + p.w / 2, p.y + p.h / 2] as const), k = f.phone ? 26 / 40 : 1;
      // The plan's steps between their middles: 24 up and 14 across, then 32 up and 26 across, toward the headboard
      // (left), where his face is not.
      expect(Math.abs(mid[2][0] - mid[1][0] - 14 * k)).toBeLessThanOrEqual(1);
      expect(Math.abs(mid[2][1] - mid[1][1] - 24 * k)).toBeLessThanOrEqual(1);
      expect(Math.abs(mid[1][0] - mid[0][0] - 26 * k)).toBeLessThanOrEqual(1);
      expect(Math.abs(mid[1][1] - mid[0][1] - 32 * k)).toBeLessThanOrEqual(1);
      // The smallest is 6 left of the cap's tip and at least 14 above it (more if all three moved up to the shade).
      expect(Math.abs(cx - mid[2][0] - 6 * k)).toBeLessThanOrEqual(1);
      expect(cy - mid[2][1]).toBeGreaterThanOrEqual(14 * k - 1);
      // The largest overlaps the window's shade by 4 at least.
      expect(puffs[0].y).toBeLessThanOrEqual(f.bubble.y + f.bubble.h + SHADE - 4);
    }
  });
});

describe('the sign\'s board', () => {
  it('keeps the letters\' tiles at least 26 px tall at every unit', () => {
    for (const u of [0.8, 1, 1.125, 1.5]) expect((SIGN_BOARD.computer.tile + SIGN_BOARD.computer.side) * u).toBeGreaterThanOrEqual(26);
    expect(SIGN_BOARD.phone.tile + SIGN_BOARD.phone.side).toBeGreaterThanOrEqual(26);
  });
  it('is as wide as its letters need and never under 150, and on a phone under 46% of the window', () => {
    expect(signWidth(1, false, 1)).toBe(150);
    expect(signWidth(3, false, 1)).toBe(40 + 3 * 42 + 3 * 8 + 3 * 10 + 2 * 4);
    for (const [w, h] of PHONES) {
      const f = dreamFrame(w, h);
      if (f.view.w >= 360) expect(signWidth(3, true, 1)).toBeLessThanOrEqual(0.46 * f.view.w);
    }
  });
  it('hangs clear of the standing sheep\'s head, and drops the word plank where the window is too short for it', () => {
    for (const [w, h] of [[1440, 900], [900, 600], [390, 544]] as const) {
      const f = dreamFrame(w, h), v = dreamView(f.view.w, f.view.h, w < 640), lay = signLayout(v, f);
      expect(lay.plank).toBe(true);
      // The board's bottom, above the ground line, clears the sheep with its hat.
      expect(lay.hang - signHeight(f.phone, f.u)).toBeGreaterThanOrEqual(ART * SHEEP_ART.hat * v.s + 10);
      // And the whole board is inside the window, under the counters.
      expect(lay.hang).toBeLessThan(v.ground - 40);
    }
    const small = dreamFrame(360, 380), v = dreamView(small.view.w, small.view.h, true);
    expect(signLayout(v, small).plank).toBe(false);
    expect(signLayout(v, small).hang).toBeLessThan(v.ground);
  });
});

describe('the pixel art', () => {
  it('is the packs\', grid for grid: version 3\'s, and version 2\'s that the flat scenery still draws', () => {
    const v3 = JSON.parse(readFileSync('docs/dream/v3/data/pixel-art.json', 'utf8')).grids as Record<string, { px: number; rows: string[] }>;
    const v2 = JSON.parse(readFileSync('docs/dream/data/pixel-art.json', 'utf8')).grids as Record<string, { px: number; rows: string[] }>;
    const own = ['cross'];
    expect(Object.keys(ART_GRIDS).sort()).toEqual([...new Set([...Object.keys(v3), ...Object.keys(v2), ...own])].sort());
    for (const [name, g] of Object.entries({ ...v2, ...v3 })) {
      const mine = ART_GRIDS[name as keyof typeof ART_GRIDS];
      expect(mine.px).toBe(g.px);
      expect([...mine.rows]).toEqual(g.rows);
    }
    // Every row of a grid is as wide as the first.
    for (const g of Object.values(ART_GRIDS)) for (const row of g.rows) expect(row.length).toBe(g.rows[0].length);
  });
});
