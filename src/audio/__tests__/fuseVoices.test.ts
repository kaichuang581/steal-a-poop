import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { fuseBeat, fuseTones, MUSIC_BOX_TUNE, TICK_VOICES } from '../fuseVoices';
import type { Beat, TickVoice } from '../fuseVoices';
import { TICK_VOICE } from '../../skin/shop/catalog';
import { FakeContext } from './fakeAudio';

/**
 * The fuse sounds (Brian, 2026-11-13: "make the sounds actually useable"). They were one beep at eight pitches, quieter
 * than the music until the last three seconds; these hold them to being eight sounds a player can hear and tell apart.
 */
const SECS = 10;
/** The beats of a ten-second turn, first to last. */
const turn = (): Beat[] => Array.from({ length: SECS }, (_, i) => ({ at: 100 + i, left: SECS - i, through: i / SECS, step: i }));
const calm = turn().filter((b) => b.left > 3), last = turn().filter((b) => b.left <= 3);
const others = TICK_VOICES.filter((v) => v !== 'chime');
const play = (voice: TickVoice, b: Beat, gain = 1) => { const c = new FakeContext(); fuseBeat(c as unknown as BaseAudioContext, c.destination as unknown as AudioNode, voice, b, () => {}, gain); return c; };

describe('the fuse sounds', () => {
  it('has a voice for every fuse sound in the catalogue, and no voice without one', () => {
    expect([...new Set(Object.values(TICK_VOICE))].sort()).toEqual([...TICK_VOICES].sort());
  });

  it('leaves the ice chime, the beep everyone starts with, exactly as it was', () => {
    const quiet = play('chime', { at: 5, left: 7, through: 0.3, step: 3 }).oscs;
    expect(quiet).toHaveLength(1);
    expect([quiet[0].type, quiet[0].freq, quiet[0].startAt]).toEqual(['triangle', 520 + 0.3 * 480, 5]);
    expect(quiet[0].gain.gain.events).toEqual([['set', 0.0001, 5], ['exp', 0.08 + 0.3 * 0.22, 5.005], ['exp', 0.0001, 5.12]]);
    expect(quiet[0].stopAt).toBeCloseTo(5.15);
    const loud = play('chime', { at: 5, left: 2, through: 0.8, step: 8 }).oscs;
    expect(loud.map((o) => [o.type, o.freq, o.peak])).toEqual([['square', 1280, 0.9], ['sawtooth', 1920, 0.5]]);
    expect(loud[0].gain.gain.events[2]).toEqual(['exp', 0.0001, 5.22]);
  });

  it('sounds every voice on the beat: nothing before it, something exactly on it, all over within a second and a bit', () => {
    for (const voice of TICK_VOICES) for (const b of turn()) {
      const c = play(voice, b);
      expect(Math.min(...c.oscs.map((o) => o.startAt)), `${voice} ${b.left}`).toBe(b.at);
      expect(Math.max(...c.oscs.map((o) => o.stopAt)), `${voice} ${b.left}`).toBeLessThan(b.at + 1.25);
      for (const o of c.oscs) expect(o.stopAt, `${voice} ${b.left}`).toBeGreaterThan(o.startAt);
    }
  });

  it('makes every calm second loud enough to hear over the music, and the last three louder, with more in them', () => {
    // Loudness here is the level of everything struck at once, at the loudest strike of the beat. The music peaks at about 0.2.
    const struck = (voice: TickVoice, b: Beat) => {
      const tones = fuseTones(voice, b);
      return Math.max(...tones.map((t) => tones.filter((o) => Math.abs(o.delay - t.delay) < 0.01).reduce((s, o) => s + o.vol, 0)));
    };
    for (const voice of others) {
      for (const b of calm) expect(struck(voice, b), `${voice} ${b.left}`).toBeGreaterThanOrEqual(0.3);
      const quietest = Math.min(...last.map((b) => struck(voice, b))), calmest = Math.max(...calm.map((b) => struck(voice, b)));
      expect(quietest, voice).toBeGreaterThan(calmest);
      expect(fuseTones(voice, last[0]).length, voice).toBeGreaterThan(fuseTones(voice, calm[0]).length);
      // And never so loud that a beat clips by itself.
      for (const b of turn()) expect(struck(voice, b), `${voice} ${b.left}`).toBeLessThanOrEqual(1.1);
    }
    // The calm seconds grow a little as the fuse burns, as they always did.
    for (const voice of TICK_VOICES) expect(struck(voice, calm[calm.length - 1]), voice).toBeGreaterThan(struck(voice, calm[0]) * 0.99);
  });

  it('gives no two voices the same sound: different tones, different pitches', () => {
    for (const b of [calm[0], last[0]]) {
      const sign = (voice: TickVoice) => fuseTones(voice, b).map((t) => `${t.type}@${Math.round(t.freq)}+${t.delay.toFixed(2)}`).join(' ');
      expect(new Set(TICK_VOICES.map(sign)).size).toBe(TICK_VOICES.length);
      // Not the old way either, one tone at a different pitch: each voice but the chime strikes several.
      for (const voice of others) expect(fuseTones(voice, b).length, voice).toBeGreaterThanOrEqual(2);
    }
    // They spread over the ear's range: an owl low, a music box above it, sleigh bells high.
    const lowest = (voice: TickVoice) => Math.min(...fuseTones(voice, calm[0]).map((t) => t.freq));
    expect(lowest('owl')).toBeLessThan(450);
    expect(lowest('musicbox')).toBeGreaterThan(1000);
    expect(lowest('sleigh')).toBeGreaterThan(2000);
  });

  it('knocks tick then tock, hoots and answers lower, and plays the music box tune a note a second from the top', () => {
    const first = (voice: TickVoice, step: number) => fuseTones(voice, { at: 0, left: 9, through: 0.1, step })[0].freq;
    expect(first('wood', 0)).toBeGreaterThan(first('wood', 1));
    expect(first('wood', 2)).toBe(first('wood', 0));
    expect(first('owl', 0)).toBeGreaterThan(first('owl', 1));
    for (let step = 0; step < MUSIC_BOX_TUNE.length + 3; step++) expect(first('musicbox', step)).toBe(MUSIC_BOX_TUNE[step % MUSIC_BOX_TUNE.length]);
    // The tune carries on through the last three seconds: the note under the flourish is still the tune's.
    expect(fuseTones('musicbox', { at: 0, left: 2, through: 0.8, step: 8 })[0].freq).toBe(MUSIC_BOX_TUNE[8]);
    expect(new Set(MUSIC_BOX_TUNE).size).toBeGreaterThan(5);
  });

  it('climbs through the last three seconds in every voice', () => {
    for (const voice of TICK_VOICES.filter((v) => v !== 'musicbox')) {
      const top = (left: number) => Math.max(...fuseTones(voice, { at: 0, left, through: 1 - left / SECS, step: SECS - left }).map((t) => t.freq));
      expect(top(2), voice).toBeGreaterThan(top(3));
      expect(top(1), voice).toBeGreaterThan(top(2));
    }
  });

  it('is made of tones only: no noise, so nothing hisses', () => {
    // The stand-in context throws if a voice asks for a noise buffer.
    for (const voice of TICK_VOICES) for (const b of turn()) expect(() => play(voice, b), voice).not.toThrow();
    expect(readFileSync('src/audio/fuseVoices.ts', 'utf8')).not.toMatch(/createBuffer|Math\.random/);
  });

  it('plays quieter when asked to, and the cowbell through its filter', () => {
    const full = play('owl', calm[0]).oscs[0].peak, low = play('owl', calm[0], 0.25).oscs[0].peak;
    expect(low).toBeCloseTo(full * 0.25);
    const bell = play('cowbell', calm[0]);
    expect(bell.filters).toHaveLength(1);
    expect(bell.filters[0].to).toBe(bell.destination);
    for (const o of bell.oscs) expect(o.gain.to).toBe(bell.filters[0]);
  });
});
