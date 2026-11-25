import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { advance, BPM, bpmOf, phase, pulse, whole } from '../beat';
import { DOT_FONT } from '../dotfont';
import { MOST_PARTICLES } from '../Fx';
import { FLIGHT } from '../fly';
import { CLOSE_PX, isClose, TYPE_X } from '../run';
import { clearPlace, STAR_WORDS, starPlaces, wordCentre, wordDots } from '../starWords';

/** The beat and the effects (docs/dream/06-beat-and-effects.md). */
describe('the beat', () => {
  it('runs at each stage\'s beats a minute and never jumps when the stage changes', () => {
    expect(BPM).toEqual({ 1: 96, 2: 112, 3: 128 });
    expect(advance(0, 60000, 1)).toBeCloseTo(96, 9);
    expect(advance(0, 60000, 3)).toBeCloseTo(128, 9);
    // The same count, carried on at the new rate.
    const a = advance(0, 1000, 1), b = advance(a, 1000, 2);
    expect(b - a).toBeCloseTo(112 / 60, 9);
    expect(advance(5, 0, 2)).toBe(5);
    expect(bpmOf(7)).toBe(128);
  });
  it('pulses sharply on the beat and is gone in 35% of it', () => {
    expect(pulse(3)).toBe(1);
    expect(pulse(3.35)).toBe(0);
    expect(pulse(3.9)).toBe(0);
    expect(pulse(3.1)).toBeGreaterThan(pulse(3.2));
    expect(phase(4.25)).toBeCloseTo(0.25, 9);
    expect(whole(4.25)).toBe(4);
  });
  it('never pulses more than three times a second (the safety limit)', () => {
    for (const bpm of Object.values(BPM)) expect(bpm / 60).toBeLessThanOrEqual(3);
  });
});

describe('the star words', () => {
  it('has the pack\'s dot letters: five tall, three wide but for M, N and W', () => {
    const pack = JSON.parse(readFileSync('docs/dream/data/dotfont.json', 'utf8')).letters as Record<string, string>;
    expect(Object.keys(DOT_FONT).sort()).toEqual('ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''));
    for (const [ch, rows] of Object.entries(pack)) {
      expect([...DOT_FONT[ch]]).toEqual(rows.split(' '));
      expect(DOT_FONT[ch].length).toBe(5);
      expect(DOT_FONT[ch][0].length).toBe(ch === 'M' || ch === 'W' ? 5 : ch === 'N' ? 4 : 3);
    }
  });
  it('spells a word in dots, one empty column between letters, accents dropped, twelve letters at most', () => {
    const hay = wordDots('hay');
    expect(hay.cols).toBe(3 + 1 + 3 + 1 + 3);
    expect(Math.max(...hay.dots.map((d) => d[1]))).toBe(4);
    expect(wordDots('été').dots).toEqual(wordDots('ete').dots);
    // Anything else leaves a gap two columns wide.
    expect(wordDots('a-a').cols).toBe(3 + 1 + 2 + 1 + 3);
    // A long word shows eleven letters and three dots.
    const long = wordDots('abcdefghijklmnop'), eleven = wordDots('abcdefghijk');
    expect(long.dots.length).toBe(eleven.dots.length + 3);
    expect(wordDots('abcdefghijkl').dots.length).toBeGreaterThan(eleven.dots.length + 3);
  });
  it('lays thirty places over the sky, in an order the night shuffles, clear of what they must not sit under', () => {
    const places = starPlaces(1408, 428, '2026-11-24');
    expect(places.length).toBe(30);
    for (const p of places) {
      expect(p.x).toBeGreaterThanOrEqual(0.08 * 1408);
      expect(p.x).toBeLessThanOrEqual(0.92 * 1408);
      expect(p.y).toBeGreaterThanOrEqual(STAR_WORDS.top - STAR_WORDS.nudge);
      expect(p.y).toBeLessThanOrEqual(428 - STAR_WORDS.aboveLane);
    }
    // The same night gives the same order; another night another.
    expect(starPlaces(1408, 428, '2026-11-24')).toEqual(places);
    expect(starPlaces(1408, 428, '2026-11-25').map((p) => Math.round(p.x))).not.toEqual(places.map((p) => Math.round(p.x)));
    const moon = { x: 1180, y: 20, w: 100, h: 100 };
    const clear = starPlaces(1408, 428, '2026-11-24', [moon]);
    expect(clear.length).toBeLessThan(30);
    for (const p of clear) expect(p.x > moon.x - 60 && p.x < moon.x + moon.w + 60 && p.y > moon.y - 14 && p.y < moon.y + moon.h + 14).toBe(false);
  });
  it('never hangs a word over another, on a phone\'s narrow sky either, and keeps every word inside the window', () => {
    // A phone: six columns 55 px apart, and seven-letter words about 120 px wide. With the keyboard up its sky is 46 px deep.
    const pitch = STAR_WORDS.pitch.phone;
    for (const [w, lane, least] of [[374, 400, 6], [374, 280, 3]] as const) {
      const places = starPlaces(w, lane, '2026-11-24', [], 104);
      let up: { place: { x: number; y: number }; cols: number }[] = [], n = 0;
      for (const word of ['haars', 'wabbles', 'habber', 'taharet', 'cabals', 'moaners', 'seabeds', 'rabats', 'nabbers', 'fablers']) {
        const { cols } = wordDots(word);
        up = up.slice(-(STAR_WORDS.phoneKeeps - 1));
        let at = clearPlace(places, n, up, cols, pitch, w);
        // As the effects do: the oldest come down until the new word has room.
        while (at < 0 && up.length) { up.shift(); at = clearPlace(places, n, up, cols, pitch, w); }
        expect(at).toBeGreaterThanOrEqual(0);
        const x = wordCentre(places[at], cols, pitch, w);
        for (const s of up) {
          const apart = Math.abs(wordCentre(s.place, s.cols, pitch, w) - x) >= ((s.cols + cols) / 2) * pitch || Math.abs(s.place.y - places[at].y) >= 5 * pitch;
          expect(apart, `${word} over another word`).toBe(true);
        }
        expect(x - (cols * pitch) / 2).toBeGreaterThanOrEqual(0);
        expect(x + (cols * pitch) / 2).toBeLessThanOrEqual(w);
        up.push({ place: places[at], cols }); n = at + 1;
      }
      expect(up.length).toBeGreaterThanOrEqual(least);
    }
    // With the sky clear, a word takes the next place in turn, as before.
    expect(clearPlace(starPlaces(374, 400, '2026-11-24'), 7, [], 30, pitch, 374)).toBe(7);
  });
});

describe('the effects\' numbers', () => {
  it('keeps to the pack\'s timings and limits', () => {
    expect(FLIGHT).toEqual({ ms: 320, stagger: 30, rise: 120, to: 16 });
    expect(MOST_PARTICLES).toBe(60);
    expect(STAR_WORDS.rise).toBe(700);
  });
  it('calls a fence close when the meter would be at three of its eleven segments', () => {
    const near = 78 + 20;
    expect(CLOSE_PX).toBe(Math.round(((TYPE_X - near) * 3) / 11));
    expect(isClose({ x: near + CLOSE_PX, locked: false, passed: false })).toBe(true);
    expect(isClose({ x: near + CLOSE_PX + 1, locked: false, passed: false })).toBe(false);
    expect(isClose({ x: near + 10, locked: true, passed: false })).toBe(false);
  });
});
