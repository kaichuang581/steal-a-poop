import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { useStore } from '../../state/store';
import { TICK_VOICES } from '../fuseVoices';
import { musicDuck, previewTick, setTickVoice, startBombClock, stopBombClock, stopPreviewTick, unlockAudio } from '../sound';
import { FakeContext } from './fakeAudio';

/** The bomb's clock and the Trading Post's samples, on a stand-in for Web Audio. */
let ctx: FakeContext;
beforeAll(() => {
  vi.stubGlobal('window', { AudioContext: class extends FakeContext { constructor() { super(); ctx = this; } } });
  unlockAudio();
});
afterEach(() => { stopBombClock(); stopPreviewTick(); setTickVoice('chime'); useStore.setState({ muted: false }); ctx.oscs = []; ctx.currentTime = 0; });

/** When each second of the turn first sounds. */
const beats = () => [...new Set(ctx.oscs.map((o) => Math.floor(o.startAt + 1e-6)))].sort((a, b) => a - b).map((s) => Math.min(...ctx.oscs.filter((o) => Math.floor(o.startAt + 1e-6) === s).map((o) => o.startAt)));

describe("the bomb's clock", () => {
  it('sounds once on every whole second left, at the same moments whatever fuse sound is worn', () => {
    const when: Record<string, number[]> = {};
    for (const voice of TICK_VOICES) {
      ctx.oscs = []; ctx.currentTime = 50;
      setTickVoice(voice);
      startBombClock(10_000, 10_000);
      when[voice] = beats();
      expect(when[voice], voice).toEqual([50, 51, 52, 53, 54, 55, 56, 57, 58, 59]);
    }
  });
  it('waits out the beat after a bomb: nothing sounds for a second the turn does not have', () => {
    ctx.currentTime = 20;
    setTickVoice('wood');
    startBombClock(12_400, 10_000);
    expect(beats()[0]).toBeCloseTo(22.4);
    expect(beats()).toHaveLength(10);
  });
  it('plays the worn voice, and starts the music box tune from the top of each turn', () => {
    setTickVoice('musicbox');
    startBombClock(5_000, 5_000);
    const first = ctx.oscs.filter((o) => o.startAt === 0)[0].freq;
    ctx.oscs = [];
    startBombClock(8_000, 8_000);
    expect(ctx.oscs.filter((o) => o.startAt === 0)[0].freq).toBe(first);
  });
  it('stops what has not sounded yet, and fades what is ringing, when the turn changes', () => {
    setTickVoice('musicbox');
    startBombClock(10_000, 10_000);
    const all = [...ctx.oscs];
    ctx.currentTime = 3.2;
    stopBombClock();
    for (const o of all.filter((x) => x.startAt > 3.2)) expect(o.stopAt).toBe(3.2);
    const ringing = all.filter((o) => o.startAt <= 3.2 && o.startAt >= 3);
    expect(ringing.length).toBeGreaterThan(0);
    for (const o of ringing) {
      expect(o.gain.gain.events.slice(-2).map((e) => e[0])).toEqual(['hold', 'target']);
      expect(o.stopAt).toBeCloseTo(3.3);
    }
  });
});

describe('a sample in the Trading Post', () => {
  it('plays three calm seconds and the last three, and says how long that takes', () => {
    for (const voice of TICK_VOICES) {
      ctx.oscs = [];
      const ms = previewTick(voice);
      const starts = [...new Set(ctx.oscs.map((o) => Math.floor((o.startAt - 0.05 + 1e-6) / 0.6)))];
      expect(starts, voice).toEqual([0, 1, 2, 3, 4, 5]);
      expect(ms, voice).toBeGreaterThan(3000);
      expect(ms, voice).toBeLessThan(4000);
    }
  });
  it('plays one at a time: a new sample stops the one before it', () => {
    previewTick('owl');
    const owl = [...ctx.oscs];
    ctx.currentTime = 1;
    previewTick('cowbell');
    for (const o of owl.filter((x) => x.startAt > 1)) expect(o.stopAt).toBe(1);
  });
  it('steps the music back while it plays, and lets it up again when it is stopped', () => {
    expect(musicDuck()).toBe(1);
    previewTick('sleigh');
    expect(musicDuck()).toBeLessThan(0.5);
    stopPreviewTick();
    expect(musicDuck()).toBe(1);
  });
  it('plays nothing and says so (0) when sound is switched off', () => {
    useStore.setState({ muted: true });
    expect(previewTick('owl')).toBe(0);
    expect(ctx.oscs).toHaveLength(0);
    expect(musicDuck()).toBe(1);
  });
});
