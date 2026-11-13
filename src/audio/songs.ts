import { chip, epiano, glock, hat, kick, lead, marimba, n, notes, pad, pizz, rim, snare, stab, subBass, synthBass, tom, vibes, whistle } from './musicKit';
import type { Kit } from './musicKit';
import type { Heat, MusicScene } from './scene';

/**
 * The game's songs, one for each place a player can be (scene.ts): written out note by note and played live on the
 * band in musicKit.ts (Brian, 2026-11-13: "the calm lofi should only be in the start screen. once u go in the game,
 * change it to something more intense ... ensure each gamemode and when u switch onto something else the music changes.
 * while ur at it, refine the lofi, rn its a bit too boring").
 *
 * A song is asked for one bar at a time. It knows which bar of its form that is, so it can bring the drums in late,
 * hand the tune from one phrase to another and drop out for a breath: none of them is a four-bar loop.
 */
export interface Song {
  name: string;
  /** Beats a minute. Only the battle song changes with the heat. */
  bpm(heat: Heat): number;
  /** Beats in a bar, and where the off-beat eighth falls in a beat: 0.5 is straight, more is swung. */
  beats: number; swing: number;
  /** A low-pass over the whole song, like a warm tape (Hz), or none. */
  warm: number | null;
  /** The echo: how many beats long, and how much of it comes back round. */
  echo: { beats: number; back: number };
  /** The song's own level, set so they all sit at about the same loudness (tools: see CLAUDE.md, the music). */
  level: number;
  /** The key, as the pitch classes its notes are drawn from (0 is C). For the tests. */
  scale: readonly number[];
  /** Schedules one bar. `t(beat)` is when a place in the bar sounds (beats from 0, swung); `beat` is a beat's length in seconds. */
  bar(k: Kit, t: (beat: number) => number, bar: number, heat: Heat, beat: number): void;
}

type Hit = readonly [beat: number, len: number, midi: number];
/** A phrase, written "A4@1.5:1 C5@2.5:0.5": a note, the beat it starts on (counting from 1), how many beats it lasts. */
const line = (s: string): Hit[] => s.trim().split(/\s+/).filter(Boolean).map((tok) => {
  const [note, rest] = tok.split('@'), [at, len] = rest.split(':').map(Number);
  return [at - 1, len, n(note)];
});
/** A little looseness: a player is never exactly on the grid or at one loudness. */
const loose = (k: Kit, by = 0.008) => (k.rand() - 0.5) * 2 * by;
const touch = (k: Kit, v: number, by = 0.15) => v * (1 - by + k.rand() * by * 2);

// ---------------------------------------------------------------- home: lofi in the barn at night

/** ii V I vi, then IV iv iii VI: eight bars that keep leaning into the next one. Rootless voicings, the root in the bass. */
const HOME = [
  { keys: notes('F3 A3 C4 E4'), bass: n('D2'), into: n('A2') },   // Dm9
  { keys: notes('F3 A3 B3 E4'), bass: n('G2'), into: n('B1') },   // G13
  { keys: notes('E3 G3 B3 D4'), bass: n('C2'), into: n('G2') },   // Cmaj9
  { keys: notes('G3 B3 C4 E4'), bass: n('A2'), into: n('G2') },   // Am9
  { keys: notes('E3 G3 A3 C4'), bass: n('F2'), into: n('E2') },   // Fmaj9
  { keys: notes('F3 Ab3 C4 D4'), bass: n('F2'), into: n('D2') },  // Fm6: the borrowed chord
  { keys: notes('G3 B3 D4 E4'), bass: n('E2'), into: n('G2') },   // Em7
  { keys: notes('G3 Bb3 C#4 F4'), bass: n('A2'), into: n('E2') }, // A7 with a flat 9 and 13, pulling back to Dm
];
/** Two tunes over the eight bars. The second answers the first: sparser, and higher at its ends. */
const HOME_A = [
  'A4@1.5:1 C5@2.5:0.5 E5@3:1.5', 'D5@1:1 B4@2.5:0.5 A4@3:1 G4@4.5:0.5', 'G4@1:2 E5@3.5:0.5 D5@4:1', 'C5@1:1.5 B4@2.5:0.5 G4@3:2',
  'A4@1.5:0.5 C5@2:1 E5@3:1 G5@4:1', 'F5@1:1.5 D5@2.5:0.5 C5@3:1 Ab4@4:1', 'G4@1:1 B4@2:1 D5@3:1.5 E5@4.5:0.5', 'C#5@1:1.5 Bb4@2.5:0.5 A4@3:2',
].map(line);
const HOME_B = [
  'E5@3:1 F5@4:0.5 E5@4.5:0.5', 'D5@1:2 B4@3.5:0.5 D5@4:1', 'E5@1:3', 'C5@2:0.5 B4@2.5:0.5 A4@3:1 G4@4:1',
  'A4@1:1 C5@2:0.5 A4@2.5:0.5 G4@3:2', 'Ab4@1:1 C5@2:1 D5@3:1 F5@4:1', 'E5@1:1.5 D5@2.5:0.5 B4@3:1 G4@4:1', 'A4@1:1 Bb4@2:0.5 C#5@2.5:0.5 E5@3:2',
].map(line);

const home: Song = {
  name: 'Lofi in the barn', bpm: () => 76, beats: 4, swing: 0.6, warm: 3200, echo: { beats: 0.75, back: 0.36 }, level: 1.05,
  scale: [0, 1, 2, 4, 5, 7, 8, 9, 10, 11],
  bar(k, t, bar, _heat, beat) {
    // Four times round the eight bars: the band comes in, the first tune, its answer, then a breath with no drums.
    const round = Math.floor(bar / 8) % 4, i = bar % 8, ch = HOME[i];
    const drums = !(round === 0 && i < 2) && !(round === 3 && i < 4), backbeat = drums && !(round === 0 && i < 4);
    // The piano: the chord rolled on 1, a softer answer later in the bar, in a different place every other bar.
    ch.keys.forEach((m, j) => epiano(k, m, t(0) + j * 0.028 + Math.abs(loose(k)), beat * 3.7, touch(k, 0.11)));
    ch.keys.slice(1).forEach((m, j) => epiano(k, m, t(i % 2 ? 2.5 : 1.5) + j * 0.02, beat * 1.3, touch(k, 0.06)));
    // The bass: the root, a pickup, the root again, and a step into the next bar's root.
    subBass(k, ch.bass, t(0), beat * 1.35, 0.34);
    subBass(k, ch.bass, t(1.5), beat * 0.42, 0.23);
    subBass(k, ch.bass, t(2), beat * 1.3, 0.3);
    subBass(k, ch.into, t(3.5), beat * 0.42, 0.24);
    // The tune, on the vibes.
    const tune = round === 1 ? HOME_A[i] : round === 2 ? HOME_B[i] : round === 3 ? (i < 4 ? HOME_B[i] : HOME_A[i]) : [];
    for (const [b, len, m] of tune) vibes(k, m, t(b) + loose(k, 0.012), len * beat, touch(k, 0.14));
    // Before the tune comes in, and under the breath: a few high notes of the chord, far away.
    if ((round === 0 && i >= 4) || (round === 3 && i < 4 && i % 2 === 1)) glock(k, ch.keys[3] + 12, t(2.5), beat, 0.045, k.left);
    if (!drums) return;
    kick(k, t(0), 0.46);
    kick(k, t(1.5), 0.35);
    if (i % 2) kick(k, t(2.5), 0.3);
    if (backbeat) {
      rim(k, t(1) + 0.018, touch(k, 0.2));
      rim(k, t(3) + 0.022, touch(k, 0.22));
      // Into the next eight: two soft knocks.
      if (i === 7) { rim(k, t(3.5), 0.1); rim(k, t(3.75), 0.13); }
    }
    for (let b = 0; b < 4; b += 0.5) hat(k, t(b) + loose(k, 0.006), touch(k, b % 1 ? 0.034 : 0.02, 0.25), i % 4 === 3 && b === 3.5);
  },
};

// ---------------------------------------------------------------- shop: the Trading Post's shuffle

/** I vi ii V, the second time with a brighter VI: the turnaround every shop has played. The bass walks a note a beat. */
const SHOP = [
  { keys: notes('G3 A3 C4 E4'), walk: notes('C3 E3 G3 A3') },    // C6
  { keys: notes('G3 A3 C4 E4'), walk: notes('A2 C3 E3 Eb3') },   // Am7
  { keys: notes('F3 A3 C4 D4'), walk: notes('D3 F3 A3 Ab3') },   // Dm7
  { keys: notes('F3 G3 B3 D4'), walk: notes('G2 B2 D3 B2') },    // G7
  { keys: notes('G3 A3 C4 E4'), walk: notes('C3 E3 G3 Bb3') },   // C6
  { keys: notes('G3 A3 C#4 E4'), walk: notes('A2 C#3 E3 Eb3') }, // A7
  { keys: notes('F3 A3 C4 D4'), walk: notes('D3 F3 A3 Ab3') },   // Dm7
  { keys: notes('F3 G3 B3 D4'), walk: notes('G2 B2 D3 B2') },    // G7
];
const SHOP_TUNE = [
  'E5@1:0.5 G5@1.5:0.5 A5@2:1 G5@3:1 E5@4:1', 'C5@1:1.5 E5@2.5:0.5 A5@3:2', 'D5@1:0.5 F5@1.5:0.5 A5@2:1 F5@3:1 D5@4:1', 'B4@1:1 D5@2:0.5 F5@2.5:0.5 G5@3:2',
  'E5@1:0.5 G5@1.5:0.5 A5@2:1 C6@3:1 A5@4:1', 'G5@1:1.5 E5@2.5:0.5 C#5@3:2', 'D5@1:1 F5@2:1 A5@3:0.5 G5@3.5:0.5 F5@4:1', 'D5@1:1 B4@2:1 G4@3:2',
].map(line);

const shop: Song = {
  name: 'The Trading Post shuffle', bpm: () => 98, beats: 4, swing: 0.64, warm: null, echo: { beats: 0.5, back: 0.22 }, level: 1.28,
  scale: [0, 1, 2, 3, 4, 5, 7, 8, 9, 10, 11],
  bar(k, t, bar, _heat, beat) {
    const round = Math.floor(bar / 8) % 3, i = bar % 8, ch = SHOP[i];
    ch.walk.forEach((m, b) => pizz(k, m, t(b) + loose(k, 0.006), beat * 0.9, touch(k, 0.4)));
    // The piano comps short, off the beat one bar and on it the next.
    for (const b of i % 2 ? [0.5, 2.5] : [0, 1.5]) ch.keys.forEach((m, j) => epiano(k, m, t(b) + j * 0.008, beat * 0.45, touch(k, 0.05), k.left));
    // The tune on the glockenspiel, two times in three; the third time the band plays alone.
    if (round !== 2) for (const [b, len, m] of SHOP_TUNE[i]) glock(k, m, t(b) + loose(k, 0.008), len * beat * 0.9, touch(k, 0.085));
    // A ride pattern on the hat, a feathered kick, a knock on 2 and 4.
    for (const b of [0, 1, 1.5, 2, 3, 3.5]) hat(k, t(b), touch(k, b % 1 ? 0.022 : 0.034, 0.2), b === 3.5 && i % 4 === 3);
    kick(k, t(0), 0.3);
    kick(k, t(2), 0.24);
    rim(k, t(1), touch(k, 0.13));
    rim(k, t(3), touch(k, 0.15));
  },
};

// ---------------------------------------------------------------- lobby: waiting for the gate

/** The battle's own key, at rest: A minor, F, G. The pads keep an E on top the whole way. */
const LOBBY = [
  { pad: notes('G3 C4 E4'), bass: n('A2'), into: n('G2') },
  { pad: notes('G3 C4 E4'), bass: n('A2'), into: n('G2') },
  { pad: notes('A3 C4 E4'), bass: n('F2'), into: n('F2') },
  { pad: notes('G3 B3 E4'), bass: n('G2'), into: n('G2') },
];
const LOBBY_CALL = ['', 'E5@1:1 A5@3:1', '', 'D5@3:0.5 E5@3.5:0.5 G5@4:0.5 E5@4.5:0.5'].map(line);

const lobby: Song = {
  name: 'Waiting at the gate', bpm: () => 100, beats: 4, swing: 0.5, warm: null, echo: { beats: 0.75, back: 0.4 }, level: 0.72,
  scale: [0, 2, 4, 5, 7, 9, 11],
  bar(k, t, bar, _heat, beat) {
    // Four times round the four chords: the pads and bass alone, the drums come in, then the call, then the call lower with a knock into the top.
    const i = bar % 4, ch = LOBBY[i], pass = Math.floor(bar / 4) % 4;
    pad(k, ch.pad, t(0), beat * 4, 0.2);
    subBass(k, ch.bass, t(0), beat * 1.4, 0.46);
    subBass(k, ch.bass, t(1.5), beat * 0.4, 0.32);
    subBass(k, ch.bass, t(2), beat * 0.9, 0.4);
    subBass(k, ch.into, t(3.5), beat * 0.4, 0.32);
    // A call on the marimba: a piece of the battle's tune.
    if (pass >= 2) for (const [b, len, m] of LOBBY_CALL[i]) marimba(k, m - (pass === 3 ? 12 : 0), t(b), len * beat, 0.1, k.echo);
    for (let b = 0; b < 4; b += 0.5) hat(k, t(b), touch(k, b % 1 ? 0.03 : 0.018, 0.2), pass === 3 && i === 3 && b === 3.5);
    if (pass === 0) return;
    kick(k, t(0), 0.46);
    kick(k, t(2.5), 0.34);
    rim(k, t(1), 0.13);
    rim(k, t(3), 0.15);
    if (pass === 3 && i === 3) { rim(k, t(3.5), 0.09); rim(k, t(3.75), 0.12); }
  },
};

// ---------------------------------------------------------------- battle: pass the bomb

/** A minor, twice round: i i VI VII, then i i VI V, the last bar's E major pulling hard back to the top. */
const AM = { root: n('A2'), triad: notes('A3 C4 E4'), tones: notes('A4 C5 E5 A5') };
const FM = { root: n('F2'), triad: notes('A3 C4 F4'), tones: notes('F4 A4 C5 F5') };
const BATTLE = [AM, AM, FM, { root: n('G2'), triad: notes('B3 D4 G4'), tones: notes('G4 B4 D5 G5') }, AM, AM, FM, { root: n('E2'), triad: notes('G#3 B3 E4'), tones: notes('E4 G#4 B4 E5') }];
const BATTLE_TUNE = [
  'E5@1:0.75 G5@2:0.5 E5@2.5:0.5 A5@3:1 G5@4:0.5 E5@4.5:0.5', 'D5@1:0.5 E5@1.5:0.5 C5@2:1 A4@3:1.5',
  'C5@1:0.75 F5@2:0.5 C5@2.5:0.5 A5@3:1 G5@4:0.5 F5@4.5:0.5', 'D5@1:0.5 G5@1.5:0.5 B4@2:1 D5@3:1 E5@4:0.5 D5@4.5:0.5',
  'E5@1:0.75 G5@2:0.5 E5@2.5:0.5 A5@3:1 G5@4:0.5 E5@4.5:0.5', 'C6@1:0.5 B5@1.5:0.5 A5@2:1 E5@3:1.5',
  'C5@1:0.75 F5@2:0.5 C5@2.5:0.5 A5@3:1 G5@4:0.5 F5@4.5:0.5', 'E5@1:0.5 G#5@1.5:0.5 B5@2:1 G#5@3:0.5 E5@3.5:0.5 D5@4:0.5 B4@4.5:0.5',
].map(line);
/** The arp's shape: up the chord and back, six steps against the bar's sixteen, so it never lands the same way twice running. */
const ARP = [0, 1, 2, 3, 2, 1];

const battle: Song = {
  name: 'Pass the bomb', bpm: (heat) => (heat < 0 ? 96 : [124, 128, 132, 138][heat]), beats: 4, swing: 0.5, warm: null, echo: { beats: 0.75, back: 0.3 }, level: 0.97,
  scale: [0, 2, 4, 5, 7, 8, 9, 11],
  bar(k, t, bar, heat, beat) {
    const i = bar % 8, ch = BATTLE[i], step = (s: number) => t(s / 4), sixteenth = beat / 4;
    // The game is over: the storm has passed. Only the chords, held, and a long bass note under them.
    if (heat < 0) {
      pad(k, ch.triad, t(0), beat * 4, 0.13);
      subBass(k, ch.root, t(0), beat * 3.6, 0.24);
      if (i % 2 === 0) glock(k, ch.tones[2], t(2), beat * 2, 0.04);
      return;
    }
    // The bass: eighths on the root in the first round; after that it gallops, with the octave on the end of each beat.
    for (let b = 0; b < 4; b++) {
      synthBass(k, ch.root, step(b * 4), sixteenth * 1.7, 0.3);
      synthBass(k, ch.root, step(b * 4 + 2), sixteenth * (heat ? 0.9 : 1.7), 0.24);
      if (heat >= 1) synthBass(k, ch.root + 12, step(b * 4 + 3), sixteenth * 0.9, 0.22);
    }
    // The chords, stabbed off the beat: 3 + 3 + 2 the first time through the eight bars; the second time they crowd in,
    // every third sixteenth, and a run up the chord leads into each next bar.
    const again = Math.floor(bar / 8) % 2 === 1;
    for (const s of again ? [2, 5, 8, 11, 14] : [3, 6, 11, 14]) stab(k, ch.triad, step(s), sixteenth * 1.6, 0.27);
    if (again) ch.tones.forEach((m, j) => chip(k, m, step(12 + j), sixteenth * 0.8, 0.05, k.echo));
    // From the second round: an arp running in sixteenths.
    if (heat >= 1) for (let s = 0; s < 16; s++) chip(k, ch.tones[ARP[(bar * 16 + s) % ARP.length]], step(s), sixteenth * 0.8, s % 4 === 0 ? 0.05 : 0.035, s % 2 ? k.left : k.right);
    // From the third: the tune, on the lead.
    if (heat >= 2) for (const [b, len, m] of BATTLE_TUNE[i]) lead(k, m, t(b), len * beat * 0.92, 0.042);
    // Drums. Round one: kick on 1 and 3. After that, four on the floor, the hat on every off-beat, then on every sixteenth.
    const floor = heat >= 1;
    for (const b of floor ? [0, 1, 2, 3] : i % 2 ? [0, 2, 2.5] : [0, 2]) kick(k, t(b), floor ? 0.5 : 0.46, floor);
    if (heat === 3 && i % 2) kick(k, step(15), 0.4, true);
    const fill = floor && i % 4 === 3;
    snare(k, t(1), 0.3);
    if (!(fill && heat === 3)) snare(k, t(3), 0.32);
    if (fill && heat === 3) ([[12, 0], [13, 0], [14, 1], [15, 2]] as const).forEach(([s, pitch]) => tom(k, step(s), 0.36, pitch));
    else if (fill) for (const s of [14, 15]) snare(k, step(s), 0.2);
    for (let s = 0; s < 16; s += heat >= 2 ? 1 : 2) {
      const off = s % 4 === 2;
      hat(k, step(s), touch(k, off ? 0.05 : s % 2 ? 0.02 : 0.03, 0.2), off && floor);
    }
  },
};

// ---------------------------------------------------------------- practice: clearing the ice

/** G major, bright and even: I vi IV V. A marimba keeps turning the chord over in eighths. */
const PRACTICE = [
  { tones: notes('G4 A4 B4 D5'), bass: n('G2'), fifth: n('D3'), pad: notes('G3 B3 D4') },
  { tones: notes('E4 G4 B4 D5'), bass: n('E2'), fifth: n('B2'), pad: notes('G3 B3 E4') },
  { tones: notes('E4 G4 B4 C5'), bass: n('C3'), fifth: n('G2'), pad: notes('G3 C4 E4') },
  { tones: notes('D4 F#4 A4 D5'), bass: n('D3'), fifth: n('A2'), pad: notes('F#3 A3 D4') },
];
const TURN = [0, 2, 3, 2, 1, 2, 3, 2];
const PRACTICE_TUNE = [
  'D5@1:1 B4@2:0.5 D5@2.5:0.5 G5@3:1.5', 'F#5@1:0.5 E5@1.5:0.5 D5@2:1 B4@3:1.5', 'E5@1:1 G5@2:1 E5@3:1 C5@4:1', 'D5@1:1.5 F#5@2.5:0.5 A5@3:2',
  'B5@1:1 A5@2:0.5 G5@2.5:0.5 D5@3:1.5', 'E5@1:1 G5@2:1 B5@3:1.5', 'C6@1:0.5 B5@1.5:0.5 G5@2:1 E5@3:1 G5@4:1', 'F#5@1:1 E5@2:1 D5@3:2',
].map(line);

const practice: Song = {
  name: 'Clearing the ice', bpm: () => 108, beats: 4, swing: 0.5, warm: null, echo: { beats: 0.75, back: 0.28 }, level: 0.87,
  scale: [0, 2, 4, 6, 7, 9, 11],
  bar(k, t, bar, _heat, beat) {
    const i = bar % 4, ch = PRACTICE[i], pass = Math.floor(bar / 8) % 2;
    TURN.forEach((tone, e) => marimba(k, ch.tones[tone], t(e / 2) + loose(k, 0.004), beat * 0.45, touch(k, e % 2 ? 0.085 : 0.12)));
    pizz(k, ch.bass, t(0), beat * 0.9, 0.42);
    pizz(k, ch.bass, t(1.5), beat * 0.4, 0.3);
    pizz(k, ch.fifth, t(2), beat * 0.9, 0.36);
    pizz(k, ch.bass, t(3), beat * 0.9, 0.36);
    // One time through the eight bars somebody whistles the tune; the next, the band holds the chords and rests.
    if (pass === 1) for (const [b, len, m] of PRACTICE_TUNE[bar % 8]) whistle(k, m, t(b), len * beat * 0.95, 0.085);
    else pad(k, ch.pad, t(0), beat * 4, 0.12);
    kick(k, t(0), 0.44);
    kick(k, t(2), 0.4);
    if (i % 2) kick(k, t(1.5), 0.26);
    rim(k, t(1), 0.14);
    rim(k, t(3), 0.16);
    for (let s = 0; s < 16; s++) hat(k, t(s / 4), touch(k, s % 2 ? 0.011 : s % 4 === 2 ? 0.03 : 0.02, 0.2));
  },
};

// ---------------------------------------------------------------- tour: the tutorial

/** C major and nothing to worry about: I IV I V, I IV V I. Bass on 1 and 3, the chord on 2 and 4. */
const C = { keys: notes('E4 G4 C5'), bass: [n('C3'), n('G2')] }, F = { keys: notes('F4 A4 C5'), bass: [n('F2'), n('C3')] }, G = { keys: notes('D4 G4 B4'), bass: [n('G2'), n('D3')] };
const TOUR = [C, F, C, G, C, F, G, C];
const TOUR_TUNE = [
  'E5@1:1 G5@2:1 C6@3:1.5 G5@4.5:0.5', 'A5@1:1.5 G5@2.5:0.5 F5@3:1 A5@4:1', 'G5@1:2 E5@3:1 C5@4:1', 'D5@1:1 E5@2:0.5 D5@2.5:0.5 B4@3:2',
  'E5@1:1 G5@2:1 C6@3:1.5 G5@4.5:0.5', 'A5@1:1 C6@2:1 A5@3:1 F5@4:1', 'G5@1:1 F5@2:0.5 E5@2.5:0.5 D5@3:1 B4@4:1', 'C5@1:3',
].map(line);

const tour: Song = {
  name: 'Whistling for the sheepdog', bpm: () => 92, beats: 4, swing: 0.57, warm: null, echo: { beats: 0.5, back: 0.2 }, level: 0.9,
  scale: [0, 2, 4, 5, 7, 9, 11],
  bar(k, t, bar, _heat, beat) {
    const i = bar % 8, ch = TOUR[i], sung = Math.floor(bar / 8) % 2 === 1;
    pizz(k, ch.bass[0], t(0), beat * 0.9, 0.42);
    pizz(k, ch.bass[1], t(2), beat * 0.9, 0.36);
    for (const b of [1, 3]) ch.keys.forEach((m, j) => epiano(k, m, t(b) + j * 0.006, beat * 0.5, touch(k, 0.06), k.left));
    // First the glockenspiel picks out the chord; the second time round somebody whistles the tune over it.
    if (sung) for (const [b, len, m] of TOUR_TUNE[i]) whistle(k, m, t(b), len * beat * 0.95, 0.09);
    else { glock(k, ch.keys[2] + 12, t(0), beat, 0.06); glock(k, ch.keys[0] + 12, t(2), beat, 0.045); glock(k, ch.keys[1] + 12, t(2.5), beat, 0.04); }
    kick(k, t(0), 0.32);
    kick(k, t(2), 0.28);
    rim(k, t(1), 0.1);
    rim(k, t(3), 0.11);
    for (const b of [0.5, 1.5, 2.5, 3.5]) hat(k, t(b), touch(k, 0.024, 0.2));
  },
};

// ---------------------------------------------------------------- dream: Counting Sheep

/** A lullaby in three, F major: slow chords, a music box turning them over, no drums at all. */
const FMAJ7 = { pad: notes('F3 A3 C4 E4'), arp: notes('F4 A4 C5 E5'), bass: n('F2') };
const BBMAJ7 = { pad: notes('F3 A3 Bb3 D4'), arp: notes('Bb3 D4 F4 A4'), bass: n('Bb2') };
const DREAM = [
  FMAJ7,
  { pad: notes('F3 A3 C4 D4'), arp: notes('D4 F4 A4 C5'), bass: n('D2') },  // Dm7
  BBMAJ7,
  { pad: notes('F3 G3 Bb3 D4'), arp: notes('C4 F4 G4 Bb4'), bass: n('C3') }, // C9sus
  FMAJ7,
  { pad: notes('E3 G3 A3 C4'), arp: notes('E4 G4 A4 C5'), bass: n('A2') },  // Am7
  BBMAJ7,
  { pad: notes('E3 G3 Bb3 C4'), arp: notes('C4 E4 G4 Bb4'), bass: n('C3') }, // C7
];
const DREAM_TUNE = ['A5@1:3', 'F5@1:2 A5@3:1', 'D5@1:2 F5@3:1', 'G5@1:3', 'A5@1:2 C6@3:1', 'E5@1:2 G5@3:1', 'F5@1:2 D5@3:1', 'E5@1:2 G5@3:1'].map(line);

const dream: Song = {
  name: 'Counting sheep', bpm: () => 66, beats: 3, swing: 0.5, warm: 3600, echo: { beats: 1, back: 0.45 }, level: 0.5,
  scale: [0, 2, 4, 5, 7, 9, 10],
  bar(k, t, bar, _heat, beat) {
    const i = bar % 8, ch = DREAM[i], sung = Math.floor(bar / 8) % 2 === 1;
    pad(k, ch.pad, t(0), beat * 3.1, 0.2);
    subBass(k, ch.bass, t(0), beat * 2.6, 0.32);
    ARP.forEach((tone, e) => glock(k, ch.arp[tone], t(e / 2) + loose(k, 0.01), beat * 0.9, touch(k, e === 0 ? 0.06 : 0.042), e % 2 ? k.left : k.right));
    if (sung) for (const [b, len, m] of DREAM_TUNE[i]) whistle(k, m, t(b), len * beat, 0.05);
  },
};

export const SONGS: Record<MusicScene, Song> = { home, shop, lobby, battle, practice, tour, dream };
