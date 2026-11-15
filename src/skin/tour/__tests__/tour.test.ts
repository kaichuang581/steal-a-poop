import { existsSync, readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { LIVES_PER_GAME, MIN_WORD_LENGTH, TURN_MS_BY_ROUND, createDictionary } from '../../../engine';
import type { GameState } from '../../../engine';
import { TWIST_TEXT } from '../../model/types';
import { EVERYDAY_RANK, everydayIdeas, setIdeaRanks } from '../ideas';
import { clearMarks, covered, markRect, rectAround, ringFor, setMark } from '../marks';
import { ENTER_GUARD_MS, TOUR_STEPS, enterMovesOn, myPlays, turnLengths } from '../steps';
import type { TourCtx } from '../steps';

// The painted game's tutorial: its script (steps.ts) and where its ring goes (marks.ts).
const NAMES = ['You', 'Nettle', 'Sorrel', 'Hazel'];
/** A table as the script sees it: only the parts it reads. */
function table(over: { letter?: string; history?: [seat: number, word: string][]; turn?: number | null; phase?: string; lives?: number } = {}): TourCtx {
  const game = {
    chainLetter: over.letter ?? 'j', phase: over.phase ?? 'playing',
    turn: over.turn === null ? null : { seat: over.turn ?? 0 },
    players: NAMES.map((name, seat) => ({ name, lives: over.lives ?? LIVES_PER_GAME, isHuman: seat === 0 })),
    history: (over.history ?? []).map(([seat, word]) => ({ round: 1, seat, kind: 'play', word, points: 0 })),
  };
  return { game: game as unknown as GameState, mySeat: 0 };
}
const step = (id: string) => TOUR_STEPS.find((s) => s.id === id)!;
const text = (id: string, c: TourCtx) => [step(id).title, step(id).body(c), step(id).note?.(c) ?? ''].join(' ');

describe('the script', () => {
  it('is one guided round: read, play, watch the chain, read, play once more', () => {
    expect(TOUR_STEPS.map((s) => s.id)).toEqual(['welcome', 'letter', 'play', 'chain', 'bomb', 'wool', 'rounds', 'again', 'done']);
    expect(new Set(TOUR_STEPS.map((s) => s.id)).size).toBe(TOUR_STEPS.length);
    expect(TOUR_STEPS[0].kind).toBe('info');
    expect(TOUR_STEPS.at(-1)!.kind).toBe('info');
    for (const s of TOUR_STEPS.filter((x) => x.kind === 'wait')) {
      expect(s.done, s.id).toBeTypeOf('function');
      expect(s.targets.length, `${s.id} points at something`).toBeGreaterThan(0);
    }
  });

  it('says what the engine does, in the engine\'s own numbers', () => {
    expect(turnLengths()).toBe(`${TURN_MS_BY_ROUND.map((ms) => ms / 1000).slice(0, -1).join(', ')}, then ${TURN_MS_BY_ROUND.at(-1)! / 1000} seconds`);
    expect(text('rounds', table())).toContain(turnLengths());
    expect(text('rounds', table())).toContain(TWIST_TEXT.noE);
    expect(text('play', table())).toContain(`${MIN_WORD_LENGTH} letters or more`);
    expect(text('wool', table({ lives: 3 }))).toContain('You have 3');
    expect(text('wool', table({ lives: 5 }))).toContain('You have 5');
  });

  it('never speaks of things the game no longer has', () => {
    const tables = [table(), table({ history: [[0, 'jelly']], turn: 1 }), table({ history: [[0, 'jelly'], [1, 'yak']], turn: 2 }), table({ turn: 2 })];
    for (const s of TOUR_STEPS) for (const c of tables) {
      const t = text(s.id, c);
      expect(t, s.id).not.toMatch(/\bring\b|\bpile\b|\bbank|\bsteal|\bpoints?\b|even faster|\bhint\b|\btap\b/i); // a timer ring, the pile, banking, steals, points, the faster-round twist, a Hint button
      expect(t, s.id).not.toMatch(/undefined|null|NaN/);
      // Nobody ever wins a wool ball: the game has no traps (Brian, 2026-11-13).
      expect(t, s.id).not.toMatch(/\btraps?\b|win a wool|wins? one|get a wool/i);
    }
  });

  it('names the letter on the board, in capitals', () => {
    expect(text('letter', table({ letter: 'q' }))).toContain('Right now that is Q.');
    expect(text('play', table({ letter: 'm', turn: 0 }))).toContain('starts with M');
  });
});

describe('the steps where you play', () => {
  it('your turn: waits for you, and is done the moment you have played a word', () => {
    const play = step('play');
    expect(play.body(table({ turn: 2 }))).toBe('Your turn is coming up.');
    expect(play.body(table({ turn: null, phase: 'intro' }))).toBe('Your turn is coming up.');
    expect(play.note!(table({ turn: 2 }))).toBeNull();
    expect(play.note!(table({ turn: 0 }))).toMatch(/book/);
    expect(play.done!(table())).toBe(false);
    expect(play.done!(table({ history: [[1, 'yak']] }))).toBe(false);
    expect(play.done!(table({ history: [[0, 'jelly']] }))).toBe(true);
  });

  it('the chain: spells out why the letter changed, names who answers, and waits for their word', () => {
    const chain = step('chain');
    const mine = table({ letter: 'y', history: [[0, 'jelly']], turn: 1 });
    expect(chain.body(mine)).toBe('JELLY ends in Y, so the next word starts with Y. Watch Nettle answer.');
    expect(chain.done!(mine)).toBe(false);
    const answered = table({ letter: 'k', history: [[0, 'jelly'], [1, 'yak']], turn: 2 });
    expect(chain.done!(answered)).toBe(true);
    // The line does not change under the reader when the answer comes: still your word, still the sheep that answered.
    expect(chain.body(answered)).toBe(chain.body(mine));
    // A word of theirs from before yours is not the answer to yours.
    expect(chain.done!(table({ history: [[3, 'raj'], [0, 'jelly']], turn: 1 }))).toBe(false);
  });

  it('one more: done after your second word, and says whose turn it is meanwhile', () => {
    const again = step('again');
    expect(again.done!(table({ history: [[0, 'jelly'], [1, 'yak'], [2, 'kite']] }))).toBe(false);
    expect(again.done!(table({ history: [[0, 'jelly'], [1, 'yak'], [2, 'kite'], [3, 'egg'], [0, 'goat']] }))).toBe(true);
    expect(again.body(table({ letter: 'g', turn: 0 }))).toBe('Your turn again: a word that starts with G.');
    expect(again.body(table({ turn: 2 }))).toMatch(/comes back round to you/);
    expect(myPlays(table({ history: [[0, 'jelly'], [1, 'yak'], [0, 'kite']] }))).toHaveLength(2);
  });
});

describe('Enter', () => {
  it('cannot dismiss a card it has only just brought up, and a held key does nothing', () => {
    // The Enter that plays a word brings the next card up. The old tutorial let that same press click Next: a card was never seen.
    expect(enterMovesOn(0, false)).toBe(false);
    expect(enterMovesOn(ENTER_GUARD_MS - 1, false)).toBe(false);
    expect(enterMovesOn(ENTER_GUARD_MS, false)).toBe(true);
    expect(enterMovesOn(5000, true)).toBe(false);
  });
});

describe('where the ring goes', () => {
  const canvas = { left: 0, top: 0, width: 1000, height: 500 };
  beforeEach(clearMarks);

  it('boxes the projected corners of a thing in the scene, in page pixels', () => {
    const r = rectAround([{ x: -0.2, y: 0.4, z: 0.5 }, { x: 0.2, y: 0.4, z: 0.5 }, { x: -0.2, y: 0, z: 0.5 }, { x: 0.2, y: 0, z: 0.5 }], canvas)!;
    expect(r).toEqual({ x: 400, y: 150, width: 200, height: 100 });
    expect(rectAround([{ x: 0, y: 0, z: 0.5 }], { left: 100, top: 40, width: 1000, height: 500 })).toEqual({ x: 600, y: 290, width: 0, height: 0 });
  });

  it('has nothing to ring when the thing is behind the camera or off the picture', () => {
    expect(rectAround([{ x: 0, y: 0, z: 1.2 }, { x: 0.1, y: 0.1, z: 0.5 }], canvas)).toBeNull();
    expect(rectAround([{ x: 1.4, y: 0, z: 0.5 }, { x: 1.6, y: 0.2, z: 0.5 }], canvas)).toBeNull();
    expect(rectAround([], canvas)).toBeNull();
  });

  it('keeps what the scene last reported, and forgets it when the tutorial ends', () => {
    expect(markRect('board')).toBeNull();
    setMark('board', { x: 1, y: 2, width: 3, height: 4 });
    expect(markRect('board')).toEqual({ x: 1, y: 2, width: 3, height: 4 });
    setMark('board', null);
    expect(markRect('board')).toBeNull();
    setMark('bomb', { x: 1, y: 2, width: 3, height: 4 });
    clearMarks();
    expect(markRect('bomb')).toBeNull();
  });

  it('knows how much of a thing the card is lying over', () => {
    const card = { x: 100, y: 100, width: 300, height: 200 };
    expect(covered(card, { x: 500, y: 100, width: 50, height: 50 })).toBe(0);
    expect(covered(card, { x: 150, y: 150, width: 50, height: 50 })).toBe(1);
    expect(covered(card, { x: 350, y: 250, width: 100, height: 100 })).toBeCloseTo(0.25);
    expect(covered(card, { x: 0, y: 290, width: 800, height: 170 })).toBeLessThan(0.05); // a wide word bar the card's foot just touches
  });

  it('stands a little clear of the thing and never runs off the screen', () => {
    expect(ringFor({ x: 100, y: 100, width: 50, height: 20 }, 1000, 800)).toEqual({ x: 94, y: 94, width: 62, height: 32 });
    // The round tab in the top-left corner, and a board the close camera has made taller than the screen.
    expect(ringFor({ x: 0, y: 0, width: 220, height: 37 }, 1000, 800)).toEqual({ x: 3, y: 3, width: 223, height: 40 });
    const tall = ringFor({ x: 500, y: -130, width: 400, height: 1200 }, 1000, 800);
    expect(tall.y).toBe(3);
    expect(tall.y + tall.height).toBe(797);
  });
});

describe('the hint book', () => {
  const dict = createDictionary(['bread', 'black', 'board', 'beach', 'begin', 'bevor', 'briners', 'berthas', 'be', 'bee', 'beautifully']);
  const list = new Map([['bread', 3000], ['black', 500], ['board', 900], ['beach', 4000], ['begin', 700], ['briners', 60000], ['bee', 5000], ['beautifully', 7000]]);
  const round = (over: Partial<{ used: string[]; modifier: GameState['modifier'] }> = {}) => ({ chainLetter: 'b', used: over.used ?? [], modifier: over.modifier ?? 'none' as GameState['modifier'] });
  beforeEach(() => setIdeaRanks(list));

  it('offers everyday words only: never one the frequency list has not heard of, or one far down it', () => {
    for (let k = 0; k < 40; k++) {
      const ideas = everydayIdeas(dict, round(), 3)!;
      expect(ideas).toHaveLength(3);
      expect(new Set(ideas).size).toBe(3);
      for (const w of ideas) {
        expect(['bread', 'black', 'board', 'beach', 'begin']).toContain(w); // not bevor (unlisted), briners (rare), bee (short), beautifully (long)
        expect(list.get(w)!).toBeLessThanOrEqual(EVERYDAY_RANK);
      }
    }
  });

  it('offers only what would be accepted: not a word already used, not one the round\'s twist rules out', () => {
    for (let k = 0; k < 20; k++) expect(everydayIdeas(dict, round({ used: ['black', 'board'] }), 3)).toEqual(expect.arrayContaining(['bread', 'beach', 'begin']));
    // No letter E leaves black and board: too few for three, so the caller falls back to the engine's picker.
    expect(everydayIdeas(dict, round({ modifier: 'no_e' }), 3)).toBeNull();
    expect(everydayIdeas(dict, round({ modifier: 'no_e' }), 2)!.sort()).toEqual(['black', 'board']);
  });

  it('says so when it has no list yet, so the book still gives something', () => {
    setIdeaRanks(null);
    expect(everydayIdeas(dict, round(), 3)).toBeNull();
    expect(readFileSync('src/skin/hooks/useWordInput.ts', 'utf8')).toContain('everydayIdeas(dict, game, 3)) || suggest(3)');
  });
});

describe('the pieces it is made of', () => {
  it('has the sheepdog\'s picture, baked from the game\'s own model', () => {
    expect(existsSync('public/tour/sheepdog.webp')).toBe(true);
    expect(readFileSync('tools/renderGuide.mjs', 'utf8')).toContain('public/tour/sheepdog.webp');
  });

  it('is what the painted game mounts, and the old look keeps its own', () => {
    const game = readFileSync('src/skin/screens/PaintedGame.tsx', 'utf8');
    expect(game).toContain('<PaintedTour />');
    expect(game).not.toContain("from '../../ui/Tour'");
    expect(readFileSync('src/ui/GameScreen.tsx', 'utf8')).toMatch(/<Tour\b/);
  });

  it('every thing a step points at by selector is something the painted game draws', () => {
    const src = ['src/skin/components/InputStrip.tsx', 'src/skin/components/Ledger.tsx', 'src/skin/screens/PaintedGame.tsx'].map((f) => readFileSync(f, 'utf8')).join('\n');
    const kit = readFileSync('src/skin/styles/kit.css', 'utf8');
    for (const s of TOUR_STEPS) for (const t of s.targets) {
      if (t.startsWith('mark:')) { expect(['mark:board', 'mark:bomb']).toContain(t); continue; }
      for (const cls of t.match(/\.[\w-]+/g) ?? []) expect(src.includes(cls.slice(1)) || kit.includes(cls), `${s.id}: ${cls}`).toBe(true);
      for (const attr of t.match(/data-tour="(\w+)"/g) ?? []) expect(src, `${s.id}: ${attr}`).toMatch(/data-tour=/);
    }
  });
});
