import { describe, expect, it } from 'vitest';
import { PLY, SHADOW } from '../yarn';
import { SLANT, START, TOTAL, VIEWBOX, WORD, WORD_PTS, guidePath, wordCubics } from '../yarnWord';

// The word the yarn spells: the prototype's 90 points (docs/landing/LANDING-PLAN.md, Appendix A), exactly.
const APPENDIX_A = [
  [18, 0], [18, 40], [18, 86],
  [30, 98], [44, 100], [48, 104], [42, 108], [20, 106], [0, 104], [-6, 100], [0, 96], [14, 98], [19, 110],
  [20, 138], [27, 157], [42, 166], [60, 166], [78, 172], [94, 186], [103, 192], [108, 184], [105, 150], [102, 90], [102, 30], [108, 6], [124, 0],
  [130, 22], [137, 50], [160, 51], [186, 52], [183, 80], [161, 100], [139, 88], [132, 52], [138, 16], [160, 0], [182, 4], [196, 16],
  [206, 40], [214, 50], [238, 51], [264, 52], [261, 80], [239, 100], [217, 88], [210, 52], [216, 16], [238, 0], [260, 4], [274, 16],
  [282, 46], [292, 80], [310, 101], [332, 104], [350, 94], [356, 84], [348, 96], [330, 100], [310, 94], [298, 64], [300, 26], [316, 3], [340, 0], [358, 12],
  [368, 40], [376, 50], [400, 51], [426, 52], [423, 80], [401, 100], [379, 88], [372, 52], [378, 16], [400, 0], [424, 2],
  [448, 1], [472, 0], [494, 12], [500, 50], [490, 88], [470, 100], [450, 88], [444, 50], [450, 14], [472, 0], [492, 6], [500, 24], [502, 80], [503, 140], [504, 175],
];

describe('the word', () => {
  it('has the 90 points of Appendix A, exactly, slanted by 0.1', () => {
    expect(WORD_PTS).toHaveLength(90);
    expect(WORD_PTS.map((p) => [...p])).toEqual(APPENDIX_A);
    expect(SLANT).toBe(0.1);
    expect(START).toEqual({ x: 18, y: -0 });
  });

  it('is 2,381.9 units long, give or take one', () => {
    expect(Math.abs(TOTAL - 2381.9)).toBeLessThanOrEqual(1);
    expect(WORD.pts[0].s).toBe(0);
    expect(WORD.pts[1].s - WORD.pts[0].s).toBe(1);
  });

  it('keeps every sample, with the strand\'s half-width and its shadow, inside the view box', () => {
    const reach = PLY.width / 2 + SHADOW.rings[0][0] / 2 + Math.hypot(SHADOW.dx, SHADOW.dy);
    for (const p of WORD.pts) {
      expect(p.x - reach).toBeGreaterThan(VIEWBOX.x);
      expect(p.x + reach).toBeLessThan(VIEWBOX.x + VIEWBOX.w);
      expect(p.y - reach).toBeGreaterThan(VIEWBOX.y);
      expect(p.y + reach).toBeLessThan(VIEWBOX.y + VIEWBOX.h);
      expect(Math.hypot(p.tx, p.ty)).toBeCloseTo(1, 6);
    }
  });

  it('is joined by Catmull-Rom cubics, and the guide is one path through them', () => {
    expect(wordCubics()).toHaveLength(89);
    const d = guidePath();
    expect(d.startsWith('M18 0 C')).toBe(true);
    expect(d.match(/ C/g)).toHaveLength(89);
    expect(d.length).toBeLessThan(3.5 * 1024);
  });
});
