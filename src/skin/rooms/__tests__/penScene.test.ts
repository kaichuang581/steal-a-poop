import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MAX_ROOM_SIZE } from '../../../../server/types';
import { RANKED_MAX_PLAYERS } from '../../../lib/ranked';
import { getKaiyanLook, pictureHeight } from '../../avatars/kaiyanLook';
import { buildMats, MATS, matSpot, penStep, STALKS } from '../../scene/pen';
import type { PenPace } from '../../scene/pen';
import { SHEEP_SCALE } from '../../scene/layout';
import { animalModel } from '../../voxel/animals';
import { anchorsOf } from '../../voxel/animals/anchors';
import { PenPlates, penPlate, standOffset } from '../PenStage';
import type { PenGuest } from '../PenStage';

/** The pen's scene, held to docs/pen/PEN-PLAN-V3.md section 9 without a GPU. */
const SPECIES = ['sheep', 'cow', 'pig', 'goat', 'horse', 'chicken'] as const;
const guests = (n: number): PenGuest[] => Array.from({ length: n }, (_, i) => ({ id: `u${i}`, name: `Name${i}`, avatar: SPECIES[i % 6], you: i === 0, host: i === 0 }));

describe('each sheep on its own mat (9.1)', () => {
  it('fills the front row left to right (mats 1 to 5), then the back row (6 to 10)', () => {
    const s = Array.from({ length: 10 }, (_, i) => matSpot(i, 10));
    for (let i = 1; i < 5; i++) expect(s[i].x).toBeLessThan(s[i - 1].x); // the screen's left is +x
    for (let i = 6; i < 10; i++) expect(s[i].x).toBeLessThan(s[i - 1].x);
    for (const b of s.slice(5)) expect(b.z).toBe(MATS.back);
    for (const f of s.slice(0, 5)) expect(f.z).toBe(MATS.front);
  });

  it('for every n from 1 to max, each player\'s animal comes to rest on its mat\'s centre within 0.05 m, its feet on the mat', () => {
    for (const max of [MAX_ROOM_SIZE, RANKED_MAX_PLAYERS]) {
      for (let n = 1; n <= max; n++) {
        for (let seat = 0; seat < n; seat++) {
          // The drop, the squash and the walk, a second and a half at 60 frames a second, as PenStage's Animal runs it.
          let pace: PenPace | null = null, at = { x: NaN, y: NaN, z: NaN, sy: NaN };
          for (let f = 0; f <= 90; f++) {
            const p = penStep(pace, seat, max, f / 60, 1 / 60, { reduced: false, opening: false });
            pace = p.pace; at = p;
          }
          const mat = matSpot(seat, max);
          expect(Math.hypot(at.x - mat.x, at.z - mat.z)).toBeLessThan(0.05);
          expect(at.y).toBe(MATS.top);
          expect(at.sy).toBe(1);
        }
      }
    }
  });

  it('walks to its new mat when a seat before it empties', () => {
    let pace: PenPace | null = null;
    for (let f = 0; f <= 60; f++) pace = penStep(pace, 3, 10, f / 60, 1 / 60, { reduced: false, opening: false }).pace;
    let at = { x: 0, y: 0, z: 0 };
    for (let f = 61; f <= 180; f++) { const p = penStep(pace, 2, 10, f / 60, 1 / 60, { reduced: false, opening: false }); pace = p.pace; at = p; }
    expect(Math.hypot(at.x - matSpot(2, 10).x, at.z - matSpot(2, 10).z)).toBeLessThan(0.05);
    expect(at.y).toBe(MATS.top);
  });

  it('sets every model back so its hooves are centred on its group\'s origin, the mat\'s centre', () => {
    for (const sp of SPECIES) {
      const m = animalModel(sp), k = SHEEP_SCALE * m.drawScale, off = standOffset(sp);
      const feet = m.legs.filter((l) => l.geo.getAttribute('position')?.count).map((l) => {
        l.geo.computeBoundingBox();
        const b = l.geo.boundingBox!;
        return [(b.min.x + l.pivot[0]) * k, (b.max.x + l.pivot[0]) * k, (b.min.z + l.pivot[2]) * k, (b.max.z + l.pivot[2]) * k];
      });
      const cx = (Math.min(...feet.map((f) => f[0])) + Math.max(...feet.map((f) => f[1]))) / 2 + off[0];
      const cz = (Math.min(...feet.map((f) => f[2])) + Math.max(...feet.map((f) => f[3]))) / 2 + off[2];
      expect(Math.hypot(cx, cz), sp).toBeLessThan(0.05);
      expect(anchorsOf(m).feet[1]).toBeCloseTo(0, 5);
    }
  });

  it('draws no numbers on the mats (9.2)', () => {
    expect(Object.keys(buildMats(10))).toEqual(['mats']);
  });
});

describe('plates (9.3)', () => {
  it('gives every player a plate, every time, for n from 1 to max', () => {
    for (const max of [MAX_ROOM_SIZE, RANKED_MAX_PLAYERS]) {
      for (let n = 1; n <= max; n++) {
        const html = renderToStaticMarkup(createElement(PenPlates, { guests: guests(n), reduced: false, plateOf: () => ({ current: null }) }));
        expect(html.match(/data-anchor/g)?.length).toBe(n);
        for (const g of guests(n)) expect(html).toContain(`<b>${g.name}</b>`);
        expect(html.match(/<svg/g)?.length ?? 0).toBe(1); // the host's crown, once
      }
    }
  });

  it('stands each plate over its own hat, 0.12 of the animal\'s height above it', () => {
    for (const sp of SPECIES) {
      const a = anchorsOf(animalModel(sp)), p = penPlate(sp);
      expect(p[0]).toBeCloseTo(a.hatTip[0]);
      expect(p[2]).toBeCloseTo(a.hatTip[2]);
      expect(p[1] - a.hatTip[1]).toBeCloseTo(0.12 * a.top);
    }
    // An admin's photo: over the picture's real top, however long its forehead is drawn on this device.
    expect(penPlate('kaiyan')[1]).toBeCloseTo(1.12 * pictureHeight(getKaiyanLook('kaiyan').length));
  });
});

describe('no litter (9.6)', () => {
  it('gathers the dead grass into three or four clumps of five to eight', () => {
    expect(STALKS.length).toBeGreaterThanOrEqual(3);
    expect(STALKS.length).toBeLessThanOrEqual(4);
    for (const [, , n] of STALKS) { expect(n).toBeGreaterThanOrEqual(5); expect(n).toBeLessThanOrEqual(8); }
  });
});
