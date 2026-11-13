import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { nowPlaying, playhead, renderScene, startMusic, useMusic } from '../music';
import { setMusicOverlay, setMusicScene } from '../scene';
import { SONGS } from '../songs';
import { previewTick, stopPreviewTick, unlockAudio } from '../sound';
import { FakeContext } from './fakeAudio';

/** The player: which song it plays, when it changes, and what it does while the music is off. On a stand-in for Web Audio. */
let ctx: FakeContext;
let tick: () => void = () => {};
const later: (() => void)[] = [];
beforeAll(() => {
  vi.stubGlobal('window', {
    AudioContext: class extends FakeContext { constructor() { super(); ctx = this; } },
    setInterval: (fn: () => void) => { tick = fn; return 1; },
    setTimeout: (fn: () => void) => { later.push(fn); return 1; },
    clearTimeout: () => {},
  });
  unlockAudio();
  startMusic();
});
beforeEach(() => { setMusicOverlay(null); setMusicScene('home'); stopPreviewTick(); if (!useMusic.getState().on) useMusic.getState().toggle(); });

/** Lets `seconds` go by, the player looking every tenth of a second as it does in the game. */
const pass = (seconds: number) => { for (let i = 0; i < Math.round(seconds * 10); i++) { ctx.currentTime += 0.1; tick(); } };
/** The oscillators started since a count was taken, by wave. */
const since = (n: number) => ctx.oscs.slice(n).map((o) => o.type);
/** The master's level as last asked for. */
const master = () => ctx.gains[0].gain.events.filter((e) => e[0] === 'target').at(-1)![1];

describe('the music player', () => {
  it('plays the start screen\'s lofi a bar at a time, each bar a moment before it starts', () => {
    pass(0.5);
    const first = ctx.oscs.length;
    expect(first).toBeGreaterThan(8);
    expect(nowPlaying()).toBe('Lofi in the barn');
    // Nothing more until the next bar is nearly due: a bar of the lofi is over three seconds.
    pass(1);
    expect(ctx.oscs.length).toBe(first);
    pass(60 / SONGS.home.bpm(0) * 4);
    expect(ctx.oscs.length).toBeGreaterThan(first);
    // Everything is scheduled ahead of the clock, never behind it.
    for (const o of ctx.oscs.slice(first)) expect(o.startAt).toBeGreaterThanOrEqual(ctx.currentTime - 60 / SONGS.home.bpm(0) * 4 - 0.3);
  });

  it('changes song when the player goes somewhere else: the old one fades out, the new one comes in from its top', () => {
    pass(0.5);
    const before = ctx.oscs.length, at = ctx.currentTime + 0.1;
    setMusicScene('battle', 1);
    pass(0.1);
    expect(nowPlaying()).toBe('Pass the bomb');
    // The lofi's fader is sent to nothing, and the battle's own waves start: squares and saws the lofi never uses.
    expect(ctx.gains.some((g) => g.gain.events.some((e) => e[0] === 'target' && e[1] === 0 && Math.abs(e[2] - at) < 1e-6))).toBe(true);
    expect(since(before)).toContain('square');
    expect(since(before)).toContain('sawtooth');
    expect(ctx.oscs.slice(0, before).some((o) => o.type === 'sawtooth')).toBe(false);
    // Its first note is its first bar's, a moment after the change.
    expect(Math.min(...ctx.oscs.slice(before).filter((o) => o.type === 'square').map((o) => o.startAt))).toBeCloseTo(at + 0.12, 1);
  });

  it('plays the Trading Post\'s song while it is open, and what was under it when it shuts', () => {
    setMusicScene('home'); pass(0.3);
    setMusicOverlay('shop'); pass(0.2);
    expect(nowPlaying()).toBe('The Trading Post shuffle');
    setMusicOverlay(null); pass(0.2);
    expect(nowPlaying()).toBe('Lofi in the barn');
  });

  it('picks the lofi up where it was left, instead of playing its opening again; other songs start from the top', () => {
    setMusicScene('home'); pass(60 / SONGS.home.bpm(0) * 4 * 3);
    const was = playhead()!;
    expect(was.scene).toBe('home');
    expect(was.bar).toBeGreaterThanOrEqual(3);
    setMusicOverlay('shop'); pass(1);
    setMusicOverlay(null); pass(0.3);
    expect(playhead()).toEqual({ scene: 'home', bar: was.bar + 1 });
    // The battle is a new game every time: from its first bar.
    setMusicScene('battle', 0); pass(5);
    expect(playhead()!.bar).toBeGreaterThan(1);
    setMusicScene('home'); pass(0.3);
    setMusicScene('battle', 0); pass(0.3);
    expect(playhead()).toEqual({ scene: 'battle', bar: 1 });
  });

  it('plays the battle faster when the round is hotter, from the very next bar', () => {
    setMusicScene('battle', 0); pass(0.3);
    const gap = (heat: 0 | 3) => {
      setMusicScene('battle', heat);
      pass(8);
      const kicks = [...new Set(ctx.oscs.filter((o) => o.startAt > ctx.currentTime - 4 && o.type === 'sine' && Math.abs(o.frequency.events.at(-1)![1] - 46) < 0.01).map((o) => +o.startAt.toFixed(3)))].sort((a, b) => a - b);
      // The usual gap between kicks (the hottest round slips an extra one in before some bars).
      const gaps = kicks.slice(1).map((k, i) => k - kicks[i]).sort((a, b) => a - b);
      return gaps[Math.floor(gaps.length / 2)];
    };
    const cool = gap(0), hot = gap(3);
    // Round one: a kick every two beats at 124. The hottest: one on every beat at 138.
    expect(cool).toBeCloseTo((60 / 124) * 2, 2);
    expect(hot).toBeCloseTo(60 / 138, 2);
  });

  it('schedules nothing while the music is switched off, and picks up again when it is switched on', () => {
    pass(0.5);
    useMusic.getState().toggle();
    pass(0.2);
    const off = ctx.oscs.length;
    expect(master()).toBe(0);
    pass(8);
    expect(ctx.oscs.length).toBe(off);
    useMusic.getState().toggle();
    pass(0.5);
    expect(ctx.oscs.length).toBeGreaterThan(off);
    expect(master()).toBeGreaterThan(0);
  });

  it('steps back to a quarter while a fuse sound is sampled, and comes back after', () => {
    pass(0.3);
    const full = master();
    previewTick('owl');
    pass(0.2);
    expect(master()).toBeCloseTo(full * 0.25);
    stopPreviewTick();
    pass(0.2);
    expect(master()).toBeCloseTo(full);
  });

  it('takes a finished song\'s stage down', () => {
    setMusicScene('practice'); pass(0.3);
    later.length = 0;
    setMusicScene('home'); pass(0.2);
    expect(later.length).toBe(1);
    expect(() => later[0]()).not.toThrow();
  });
});

describe('a song rendered by itself', () => {
  it('is as long as its bars, at any tempo and in any time', () => {
    for (const [scene, bars, heat] of [['home', 8, 0], ['dream', 4, 0], ['battle', 8, 3]] as const) {
      const c = new FakeContext();
      const secs = renderScene(c as unknown as BaseAudioContext, c.destination as unknown as AudioNode, scene, bars, heat);
      expect(secs).toBeCloseTo(0.05 + (bars * SONGS[scene].beats * 60) / SONGS[scene].bpm(heat));
      expect(c.oscs.length).toBeGreaterThan(bars * 3);
      // Tones only: the stand-in throws if a song asks for noise.
    }
  });
  it('comes out the same every time: its looseness is seeded', () => {
    const run = () => { const c = new FakeContext(); renderScene(c as unknown as BaseAudioContext, c.destination as unknown as AudioNode, 'home', 12); return c.oscs.map((o) => `${o.type}${o.freq.toFixed(1)}@${o.startAt.toFixed(4)}`).join(' '); };
    expect(run()).toBe(run());
  });
});
