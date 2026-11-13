import { beforeEach, describe, expect, it, vi } from 'vitest';

/** Every note the band is asked for, written down instead of played: which instrument, which pitch, when, how long, how loud. */
interface Played { who: string; midi: number | null; at: number; dur: number; vol: number }
const played: Played[] = [];
vi.mock('../musicKit', async (original) => {
  const real = await original<typeof import('../musicKit')>();
  const one = (who: string) => (_k: unknown, midi: number, at: number, dur: number, vol: number) => { played.push({ who, midi, at, dur, vol }); };
  const many = (who: string) => (_k: unknown, chord: number[], at: number, dur: number, vol: number) => { for (const midi of chord) played.push({ who, midi, at, dur, vol }); };
  const drum = (who: string) => (_k: unknown, at: number, vol: number) => { played.push({ who, midi: null, at, dur: 0.1, vol }); };
  return {
    ...real,
    epiano: one('epiano'), vibes: one('vibes'), glock: one('glock'), marimba: one('marimba'), subBass: one('subBass'), pizz: one('pizz'),
    synthBass: one('synthBass'), chip: one('chip'), lead: one('lead'), whistle: one('whistle'), pad: many('pad'), stab: many('stab'),
    kick: drum('kick'), rim: drum('rim'), snare: drum('snare'), hat: drum('hat'), tom: drum('tom'),
  };
});

import { heatFor, MUSIC_SCENES, musicScene, setMusicOverlay, setMusicScene } from '../scene';
import type { Heat, MusicScene } from '../scene';
import { SONGS } from '../songs';
import type { Kit } from '../musicKit';

/**
 * The game's songs (Brian, 2026-11-13: lofi only on the start screen, something more intense in the game, a song for
 * each game mode, and a less boring lofi). These hold each song to being a song: in its key, in time, of its own, and
 * with a shape, so none of them is a short loop going round.
 */
const DRUMS = ['kick', 'rim', 'snare', 'hat', 'tom'], BASSES = ['subBass', 'pizz', 'synthBass'], TUNES = ['vibes', 'glock', 'whistle', 'lead', 'marimba'];
let seed = 1;
const kit = { rand: () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }, left: 'left', right: 'right', echo: 'echo', pump: 'pump', soft: 'soft', low: 'low', out: 'out', air: 'air' } as unknown as Kit;

/** One bar of a song, as the notes it asks for, with times counted in beats from the bar's start. */
function bar(scene: MusicScene, index: number, heat: Heat = 0): Played[] {
  played.length = 0;
  const song = SONGS[scene], beat = 60 / song.bpm(heat);
  // The same placing of the swung off-beat the player uses (music.ts playBar), with the bar starting at 0.
  const t = (b: number) => { const whole = Math.floor(b), f = b - whole; return (whole + (f <= 0.5 ? (f / 0.5) * song.swing : song.swing + ((f - 0.5) / 0.5) * (1 - song.swing))) * beat; };
  song.bar(kit, t, index, heat, beat);
  return played.map((p) => ({ ...p, at: p.at / beat, dur: p.dur / beat }));
}
const who = (notes: Played[]) => [...new Set(notes.map((p) => p.who))].sort();
const sign = (notes: Played[]) => notes.map((p) => `${p.who}:${p.midi}@${p.at.toFixed(2)}`).sort().join(' ');
beforeEach(() => { seed = 1; });

describe('every song', () => {
  it('there is one for each place a player can be, each with its own name', () => {
    expect(Object.keys(SONGS).sort()).toEqual([...MUSIC_SCENES].sort());
    expect(new Set(MUSIC_SCENES.map((s) => SONGS[s].name)).size).toBe(MUSIC_SCENES.length);
  });

  it('stays in its key: every note any instrument plays is in the song\'s scale', () => {
    for (const scene of MUSIC_SCENES) for (const heat of (scene === 'battle' ? [-1, 0, 1, 2, 3] : [0]) as Heat[]) for (let i = 0; i < 48; i++) {
      for (const p of bar(scene, i, heat)) if (p.midi !== null) expect(SONGS[scene].scale, `${scene} bar ${i}: ${p.who} plays ${p.midi}`).toContain(((p.midi % 12) + 12) % 12);
    }
  });

  it('stays in time: every note starts inside its bar, lasts a while, and is no louder than it should be', () => {
    for (const scene of MUSIC_SCENES) for (let i = 0; i < 48; i++) for (const p of bar(scene, i, scene === 'battle' ? 3 : 0)) {
      const where = `${scene} bar ${i}: ${p.who}`;
      expect(p.at, where).toBeGreaterThanOrEqual(-0.05);
      expect(p.at, where).toBeLessThan(SONGS[scene].beats);
      expect(p.dur, where).toBeGreaterThan(0);
      expect(p.vol, where).toBeGreaterThan(0);
      expect(p.vol, where).toBeLessThanOrEqual(0.7);
    }
  });

  it('keeps each instrument where it belongs: basses low, tunes above middle C', () => {
    for (const scene of MUSIC_SCENES) for (let i = 0; i < 48; i++) for (const p of bar(scene, i, scene === 'battle' ? 3 : 0)) {
      if (p.midi === null) continue;
      if (BASSES.includes(p.who)) { expect(p.midi, `${scene} ${p.who}`).toBeGreaterThanOrEqual(33); expect(p.midi, `${scene} ${p.who}`).toBeLessThanOrEqual(60); }
      if (['vibes', 'whistle', 'lead'].includes(p.who)) { expect(p.midi, `${scene} ${p.who}`).toBeGreaterThanOrEqual(65); expect(p.midi, `${scene} ${p.who}`).toBeLessThanOrEqual(86); }
    }
  });

  it('is a song of its own: no two share a tempo and a band', () => {
    const card = (scene: MusicScene) => `${SONGS[scene].bpm(0)} bpm in ${SONGS[scene].beats}, ${who(Array.from({ length: 32 }, (_, i) => bar(scene, i)).flat()).join('+')}`;
    expect(new Set(MUSIC_SCENES.map(card)).size).toBe(MUSIC_SCENES.length);
    // And no two play the same first eight bars.
    expect(new Set(MUSIC_SCENES.map((s) => Array.from({ length: 8 }, (_, i) => sign(bar(s, i))).join('|'))).size).toBe(MUSIC_SCENES.length);
  });

  it('is not a short loop: it takes at least sixteen bars to come round, with eight or more different bars on the way', () => {
    for (const scene of MUSIC_SCENES) {
      const bars = Array.from({ length: 64 }, (_, i) => sign(bar(scene, i, 0)).replace(/@-?\d+\.\d+/g, (m) => `@${Number(m.slice(1)).toFixed(1)}`));
      // Loose timing aside, how long before the song repeats itself exactly?
      // A bar's shape: who plays in it, the chord under it, and the tune over it.
      const shape = Array.from({ length: 64 }, (_, i) => { const b = bar(scene, i); return `${who(b).join('+')}:${b.filter((p) => TUNES.includes(p.who) || ['pad', 'epiano', 'stab'].includes(p.who)).map((p) => p.midi).join(',')}`; });
      const period = [4, 8, 16, 32].find((n) => shape.slice(0, 64 - n).every((b, i) => b === shape[i + n])) ?? 64;
      expect(period, scene).toBeGreaterThanOrEqual(16);
      expect(new Set(shape).size, scene).toBeGreaterThanOrEqual(8);
      expect(bars.length).toBe(64);
    }
  });
});

describe('the lofi, on the start screen only', () => {
  const round = (r: number) => Array.from({ length: 8 }, (_, i) => bar('home', r * 8 + i));
  it('is slow, swung and warm', () => {
    expect(SONGS.home.bpm(0)).toBeLessThan(80);
    expect(SONGS.home.swing).toBeGreaterThan(0.55);
    expect(SONGS.home.warm).not.toBeNull();
    // It is the slowest song with drums; only the lullaby is slower.
    for (const s of MUSIC_SCENES.filter((x) => x !== 'home' && x !== 'dream')) expect(SONGS[s].bpm(0), s).toBeGreaterThan(SONGS.home.bpm(0) + 10);
  });
  it('moves through eight chords, not four', () => {
    const chords = round(1).map((b) => b.filter((p) => p.who === 'epiano' && p.at < 0.2).map((p) => p.midi).join(','));
    expect(new Set(chords).size).toBe(8);
  });
  it('has a shape: the band comes in, a tune, its answer, then a breath without drums', () => {
    const drums = (b: Played[]) => b.some((p) => DRUMS.includes(p.who)), tune = (b: Played[]) => b.filter((p) => p.who === 'vibes').map((p) => p.midi).join(',');
    expect(round(0).map(drums)).toEqual([false, false, true, true, true, true, true, true]);
    expect(round(0).every((b) => tune(b) === '')).toBe(true);
    expect(round(1).every((b) => tune(b) !== '')).toBe(true);
    expect(round(2).map(tune)).not.toEqual(round(1).map(tune));
    expect(round(3).map(drums)).toEqual([false, false, false, false, true, true, true, true]);
    // A written tune, not notes picked at random: it is the same every time it comes round.
    expect(Array.from({ length: 8 }, (_, i) => tune(bar('home', 32 + 8 + i)))).toEqual(round(1).map(tune));
  });
  it('walks the bass into each next chord', () => {
    for (let i = 0; i < 8; i++) {
      const bass = bar('home', 8 + i).filter((p) => p.who === 'subBass').sort((a, b) => a.at - b.at), next = bar('home', 8 + ((i + 1) % 8)).filter((p) => p.who === 'subBass').sort((a, b) => a.at - b.at)[0];
      expect(bass).toHaveLength(4);
      // The last note of the bar is within a third of the next bar's root, and is not that root again (but for the one chord held over two bars).
      expect(Math.abs(bass[3].midi! - next.midi!), `bar ${i}`).toBeLessThanOrEqual(5);
    }
  });
});

describe('the battle song', () => {
  const eight = (heat: Heat) => Array.from({ length: 8 }, (_, i) => bar('battle', i, heat)).flat();
  it('is much faster than the lofi, straight, in a minor key, and gets faster every round', () => {
    expect(SONGS.battle.bpm(0)).toBeGreaterThanOrEqual(SONGS.home.bpm(0) * 1.5);
    expect(SONGS.battle.swing).toBe(0.5);
    expect([0, 1, 2, 3].map((h) => SONGS.battle.bpm(h as Heat))).toEqual([124, 128, 132, 138]);
    // A minor: the minor third above A is there, the major third is not.
    expect(SONGS.battle.scale).toContain(0);
    expect(SONGS.battle.scale).not.toContain(1);
  });
  it('adds to the band as the rounds go by: a galloping bass and an arp, then the tune, then a fill and a faster kick', () => {
    const count = [0, 1, 2, 3].map((h) => eight(h as Heat).length);
    expect(count[1]).toBeGreaterThan(count[0] * 1.5);
    expect(count[2]).toBeGreaterThan(count[1]);
    expect(count[3]).toBeGreaterThan(count[2]);
    expect(who(eight(0))).not.toContain('chip');
    expect(who(eight(1))).toContain('chip');
    expect(who(eight(1))).not.toContain('lead');
    expect(who(eight(2))).toContain('lead');
    expect(who(eight(3))).toContain('tom');
    // Four on the floor from the second round.
    expect(bar('battle', 0, 0).filter((p) => p.who === 'kick')).toHaveLength(2);
    expect(bar('battle', 0, 1).filter((p) => p.who === 'kick').map((p) => Math.round(p.at))).toEqual([0, 1, 2, 3]);
  });
  it('lets go when the game is over: no drums, just the chords held', () => {
    const after = eight(-1);
    expect(after.some((p) => DRUMS.includes(p.who))).toBe(false);
    expect(who(after)).toEqual(['glock', 'pad', 'subBass']);
    expect(SONGS.battle.bpm(-1)).toBeLessThan(SONGS.battle.bpm(0));
  });
  it('is led into by the lobby: the same key, at rest', () => {
    for (const pc of SONGS.lobby.scale) expect(SONGS.battle.scale).toContain(pc);
    expect(SONGS.lobby.bpm(0)).toBeLessThan(SONGS.battle.bpm(0));
  });
});

describe('the others', () => {
  it('Counting Sheep is a lullaby in three with no drums at all', () => {
    expect(SONGS.dream.beats).toBe(3);
    expect(Array.from({ length: 32 }, (_, i) => bar('dream', i)).flat().some((p) => DRUMS.includes(p.who))).toBe(false);
    expect(SONGS.dream.bpm(0)).toBeLessThan(SONGS.home.bpm(0));
  });
  it('the Trading Post swings harder than anything, on a walking bass: a note on every beat', () => {
    expect(SONGS.shop.swing).toBe(Math.max(...MUSIC_SCENES.map((s) => SONGS[s].swing)));
    for (let i = 0; i < 8; i++) expect(bar('shop', i).filter((p) => p.who === 'pizz').map((p) => Math.round(p.at) + 0)).toEqual([0, 1, 2, 3]);
  });
  it('practice and the tutorial are in major keys, and each has a whistled tune every other time round', () => {
    for (const scene of ['practice', 'tour'] as const) {
      expect(SONGS[scene].scale).toHaveLength(7);
      const whistled = (from: number) => Array.from({ length: 8 }, (_, i) => bar(scene, from + i)).flat().some((p) => p.who === 'whistle');
      expect([whistled(0), whistled(8), whistled(16), whistled(24)], scene).toEqual([false, true, false, true]);
    }
  });
});

describe('where the music is told to be', () => {
  it('plays what is under an overlay again when the overlay shuts', () => {
    setMusicScene('home');
    expect(musicScene()).toEqual({ scene: 'home', heat: 0 });
    setMusicOverlay('shop');
    expect(musicScene().scene).toBe('shop');
    setMusicOverlay(null);
    expect(musicScene().scene).toBe('home');
    setMusicScene('battle', 2);
    expect(musicScene()).toEqual({ scene: 'battle', heat: 2 });
    setMusicScene('home');
  });
  it('heats the battle up a round at a time, to the fourth, and cools it when the game is over', () => {
    expect([1, 2, 3, 4, 5, 9].map((r) => heatFor(r, false))).toEqual([0, 1, 2, 3, 3, 3]);
    expect(heatFor(3, true)).toBe(-1);
  });
});
