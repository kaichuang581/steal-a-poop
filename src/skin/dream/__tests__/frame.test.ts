import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { signLayout } from '../Signs';
import { ART, dreamView, SHEEP_ART } from '../stage';
import {
  BED_BOX, BED_SIDE, bubbleBottom, bubbleShape, dreamFrame, isPhoneLayout, meterSegments, RIM, scallopRow, SIGN_BOARD, signHeight, stripCamera, stripExtent, stripPoint,
  tailPuffs, tileFit, TRAY, unitOf,
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
      // Inset 10 from the top, left and right; the lowest points of its bottom edge 6 above the strip.
      expect([f.bubble.x, f.bubble.y, f.bubble.w]).toEqual([10, 10, w - 20]);
      expect(f.bubble.y + f.bubble.h).toBe(f.strip.y - 6);
      // The tray: centred on the middle of the space right of the bed zone, 14 above the bottom, on the strip alone.
      expect(Math.abs(f.tray.x + f.tray.w / 2 - (f.bedZone + w) / 2)).toBeLessThanOrEqual(1);
      expect(Math.abs(h - (f.tray.y + f.tray.h) - 14 * f.u)).toBeLessThanOrEqual(1);
      expect(f.tray.y).toBeGreaterThanOrEqual(f.strip.y);
      expect(f.tray.x).toBeGreaterThanOrEqual(f.bedZone);
      expect(f.tray.x + f.tray.w).toBeLessThanOrEqual(w);
      // The bedroom's canvas runs on up behind the bumps of the bubble's edge, so no gap shows.
      expect(f.room.y).toBeLessThanOrEqual(f.bubble.y + f.baseline);
      expect(f.room.y + f.room.h).toBe(h);
    }
  });
  it('stacks a phone: the dream, the strip, the tray, and nothing over anything at 360 wide with the keyboard up', () => {
    for (const [w, h] of PHONES) {
      const f = dreamFrame(w, h);
      expect(f.phone).toBe(true);
      expect(f.u).toBe(1);
      expect([f.bubble.x, f.bubble.y, f.bubble.w, f.bubble.h]).toEqual([6, 6, w - 12, h - 150]);
      expect(f.strip.h).toBe(56);
      expect([f.tray.w, f.tray.h, h - (f.tray.y + f.tray.h)]).toEqual([w - 12, 84, 6]);
      // Top to bottom, each ends where the next begins (the bubble's lowest bumps reach 2 px into the strip's wall).
      expect(f.strip.y + f.strip.h).toBe(f.tray.y);
      expect(f.bubble.y + f.bubble.h).toBeLessThanOrEqual(f.strip.y + 2);
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
  it('lays the scallops side by side from corner to corner, in the plan\'s widths', () => {
    for (const [w, widths] of [[1420, [72, 48, 60, 40]], [378, [48, 32, 40, 28]], [868, [72, 48, 60, 40]]] as const) {
      const row = scallopRow(w, widths);
      expect(row[0].c - row[0].r).toBeCloseTo(0, 6);
      expect(row[row.length - 1].c + row[row.length - 1].r).toBeCloseTo(w, 6);
      row.forEach((s, k) => expect(s.r * 2).toBe(widths[k % widths.length]));
      // Each overlaps the next, by the plan's 6 or a little more.
      for (let k = 1; k < row.length; k++) expect(row[k - 1].c + row[k - 1].r - (row[k].c - row[k].r)).toBeGreaterThanOrEqual(5.99);
    }
  });
  it('draws its edge in steps of 3, the lowest bumps on the box\'s bottom, the rim 6 inside all round', () => {
    for (const [w, h] of [...COMPUTERS, ...PHONES]) {
      const f = dreamFrame(w, h), shape = bubbleShape(f.bubble.w, f.baseline, f.scallops);
      const outer = points(shape.outer), inner = points(shape.inner);
      expect(Math.max(...outer.map((p) => p[1]))).toBe(f.bubble.h);
      expect(shape.depth).toBe(f.scallops[0] / 2);
      // Pixel steps: below the baseline every point sits a whole number of steps under it.
      for (const [, y] of outer) if (y > f.baseline) expect(Math.abs((y - f.baseline) / 3 - Math.round((y - f.baseline) / 3))).toBeLessThan(1e-6);
      // The dream's clip is inside the rim on every side.
      expect(Math.min(...inner.map((p) => p[0]))).toBe(RIM);
      expect(Math.max(...inner.map((p) => p[0]))).toBe(f.bubble.w - RIM);
      expect(Math.min(...inner.map((p) => p[1]))).toBe(RIM);
      expect(Math.max(...inner.map((p) => p[1]))).toBeLessThanOrEqual(f.bubble.h - RIM + 3);
      expect(bubbleBottom(f, f.bubble.w / 2)).toBeGreaterThan(f.baseline);
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
  it('frames the bed: the headboard 24 px in, the foot 70 px short of the bed zone, the strip its 20 degrees', () => {
    for (const [w, h] of COMPUTERS) {
      const f = dreamFrame(w, h), c = stripCamera(f);
      expect(stripPoint(c, BED_BOX.headX, 0.5, BED_BOX.nearZ)[0]).toBeCloseTo(24, 6);
      expect(stripPoint(c, BED_BOX.footX, 0.5, BED_BOX.nearZ)[0]).toBeCloseTo(f.bedZone - 70, 6);
      // 0.35 m above the mattress, looking straight at the bed's long side.
      expect(c.position[1]).toBeCloseTo(BED_BOX.top + BED_SIDE.lift, 9);
      expect(c.position[0]).toBe(BED_BOX.midX);
      expect((2 * Math.atan(f.strip.h / 2 / c.focal) * 180) / Math.PI).toBeCloseTo(BED_SIDE.fov, 6);
      // The strip's bottom edge cuts the bed just under its side rail.
      expect(stripPoint(c, 1, BED_SIDE.cut, BED_BOX.nearZ)[1]).toBeCloseTo(h, 6);
    }
  });
  it('shows what the dream is made of clear of the tray on screens 1280 wide or more', () => {
    for (const [w, h] of [[1280, 720], [1440, 900], [1920, 1080]] as const) {
      const f = dreamFrame(w, h), c = stripCamera(f);
      // The nightstand's right side, the basket's, and the bookshelf's (bedroom.ts).
      for (const [x, y, z] of [[3.6, 0.6, -0.75], [4.02, 0.2, -0.75], [4.05, 1.3, -1.3]] as const) {
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
  it('brings the tail down from the window\'s edge to just over his face, three puffs, the smallest last', () => {
    for (const [w, h] of [...COMPUTERS, ...PHONES]) {
      const f = dreamFrame(w, h), puffs = tailPuffs(f);
      expect(puffs.map((p) => p.w)).toEqual(f.phone ? [26, 18, 12] : [42, 26, 16]);
      // Stepping down and left.
      expect(puffs[0].y).toBeLessThan(puffs[1].y);
      expect(puffs[1].y).toBeLessThan(puffs[2].y);
      expect(puffs[0].x).toBeGreaterThan(puffs[1].x);
      expect(puffs[1].x).toBeGreaterThan(puffs[2].x);
      // The largest reaches the bubble's bottom edge; the smallest is on the strip's side of it.
      expect(puffs[0].y).toBeLessThanOrEqual(f.bubble.y + f.bubble.h);
      expect(puffs[2].y + puffs[2].h).toBeGreaterThan(f.room.y);
      expect(puffs[2].x).toBeGreaterThan(0);
    }
  });
});

describe('the sign\'s board', () => {
  it('keeps the letters\' tiles at least 26 px tall at every unit', () => {
    for (const u of [0.8, 1, 1.125, 1.5]) expect((SIGN_BOARD.computer.tile + SIGN_BOARD.computer.side) * u).toBeGreaterThanOrEqual(26);
    expect(SIGN_BOARD.phone.tile + SIGN_BOARD.phone.side).toBeGreaterThanOrEqual(26);
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
  it('is the pack\'s, grid for grid', () => {
    const pack = JSON.parse(readFileSync('docs/dream/data/pixel-art.json', 'utf8')).grids as Record<string, { px: number; rows: string[] }>;
    expect(Object.keys(ART_GRIDS)).toEqual(Object.keys(pack));
    for (const [name, g] of Object.entries(pack)) {
      const mine = ART_GRIDS[name as keyof typeof ART_GRIDS];
      expect(mine.px).toBe(g.px);
      expect([...mine.rows]).toEqual(g.rows);
      // Every row of a grid is as wide as the first.
      for (const row of g.rows) expect(row.length).toBe(g.rows[0].length);
    }
  });
});
