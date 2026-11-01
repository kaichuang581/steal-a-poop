import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createDictionary } from '../../src/engine/dictionary';
import { ChatFilter } from '../filter';
import { DEFAULT_MODERATION_CONFIG, suspensionFor } from './config';

// The abusive corpus is generated from the blocklist file at test time, so no slur is written in
// the repository by hand. The innocent corpus is ordinary game chat plus known trouble words.
const dict = createDictionary(readFileSync('public/words.txt', 'utf8').split('\n'));
const blocklist = readFileSync('server/data/blocklist-en.txt', 'utf8').split('\n');
const filter = new ChatFilter({ blocklist, isWord: (w) => dict.has(w) });

const INNOCENT = [
  'good game', 'nice word!', 'you stole my pile', 'lol that was close', 'my turn next', 'I love this game',
  'Steal a Poop is a funny name', 'ha you got me', 'that was a sneaky steal', 'bank now before it is too late',
  'how do I bank?', 'who is the host?', 'can we start?', 'ready when you are', 'one more round?', 'gg wp',
  'well played everyone', 'I need a word with Z', 'trap incoming', 'the timer is so short', 'my cat is called Pixel',
  'what a classic move', 'assume the best', 'I will pass this turn', 'the grass is green', 'a bass guitar',
  'Scunthorpe is a town in England', 'shiitake mushrooms are tasty', 'Nigeria has a great football team',
  'a cocktail party', 'hello world', 'good morning all', 'good night, see you tomorrow', 'thanks for the game',
  'sorry I was afk', 'brb two minutes', 'my phone is dying', 'who wants a rematch?', 'that word is not real',
  'check the dictionary', 'I think that is spelled wrong', 'typo!', 'nice typo save', 'the pile is huge',
  'I banked 40 points', 'you are winning', 'I am losing badly', 'bots are tough today', 'the bot stole from me',
  'it is my birthday', 'happy birthday!', 'congrats on the win', 'what a comeback', 'unlucky mate',
  'can you invite my friend?', 'the room code is on screen', 'I joined late', 'where did everyone go',
  'the host left', 'who is the new host', 'I will mute the music', 'turn the sound down', 'sound is fine here',
  'the class starts at nine', 'a passing grade', 'a bassoon solo', 'compass points north', 'the assistant helped me',
  'an assassin in the game', 'a massive pile', 'Hancock was a president', 'Dickens wrote novels', 'Essex is lovely',
  'the Sussex coast', 'Penistone is in Yorkshire', 'Lightwater Country Park', 'a night at the Arsenal match',
  'my grandma loves word games', 'we play after dinner', 'dinner time, back soon', 'homework first, game later',
  'my teacher likes this game', 'school was long today', 'weekend plans?', 'what is your favourite word?',
  'mine is quixotic', 'zebra is a great Z word', 'jazz and quartz are high scorers', 'fox, box, wax, six',
  'x words are rare', 'the letter Q is hard', 'quiz night', 'do you know any J words', 'jinx!',
  'I hope the next letter is easy', 'thirty seconds left', 'tick tock', 'too slow', 'too fast', 'so close',
  'one point behind', 'tie game', 'sudden death', 'final round', 'best of three', 'rematch please',
  'lovely game', 'that was fun', 'see you next time', 'bye everyone', 'take care', 'have a good one',
  'can I get a hint?', 'the hint helped', 'tutorial was good', 'the tour is short', 'practice mode is easy',
  'daily table done', 'my streak is 7', 'new high score', 'I unlocked nothing', 'no tokens, just skill',
];

const pick = (n: number, offset: number) => {
  const words = blocklist.map((w) => w.trim().toLowerCase()).filter((w) => /^[a-z]{4,}$/.test(w));
  return Array.from({ length: n }, (_, i) => words[(offset + i * 7) % words.length]);
};

const FULLWIDTH = (w: string) => [...w].map((c) => String.fromCharCode(c.charCodeAt(0) + 0xfee0)).join('');
const CYRILLIC: Record<string, string> = { a: 'а', e: 'е', o: 'о', p: 'р', c: 'с', x: 'х', y: 'у', i: 'і' };
const homoglyph = (w: string) => [...w].map((c) => CYRILLIC[c] ?? c).join('');
const leet = (w: string) => w.replace(/a/g, '4').replace(/e/g, '3').replace(/o/g, '0').replace(/s/g, '5');
const TRANSFORMS: Record<string, (w: string) => string> = {
  plain: (w) => w,
  'upper case': (w) => w.toUpperCase(),
  leet,
  symbols: (w) => w.replace(/a/g, '@').replace(/s/g, '$'),
  spaced: (w) => [...w].join(' '),
  stretched: (w) => w.replace(/(.)/, '$1$1$1$1'),
  'full-width': FULLWIDTH,
  homoglyph,
  'zero-width': (w) => [...w].join('​'),
  'in a sentence': (w) => `you are such a ${w} honestly`,
};

describe('filter corpus', () => {
  it('has the required size', () => {
    expect(INNOCENT.length).toBeGreaterThanOrEqual(100);
    expect(new Set(INNOCENT).size).toBe(INNOCENT.length);
  });

  // Honest list: real words the filter flags today. Fixing one means adding it to the allowlist.
  const KNOWN_FALSE_POSITIVES = ['Penistone is in Yorkshire'];

  it('flags almost no innocent message (false-positive rate printed)', () => {
    const flagged = INNOCENT.filter((m) => filter.check(m));
    const rate = flagged.length / INNOCENT.length;
    console.log(`filter false positives: ${flagged.length}/${INNOCENT.length} = ${(rate * 100).toFixed(1)}%${flagged.length ? ' -> ' + flagged.join(' | ') : ''}`);
    expect(flagged).toEqual(KNOWN_FALSE_POSITIVES);
  });

  it('the allowlist removes a known false positive without opening a hole', () => {
    const allowed = new ChatFilter({ blocklist, allowlist: ['penistone'], isWord: (w) => dict.has(w) });
    expect(allowed.check('Penistone is in Yorkshire')).toBeNull();
    expect(allowed.check('penis')).not.toBeNull();
  });

  const sample = pick(30, 3);
  let total = 0;
  let caught = 0;
  for (const [name, fn] of Object.entries(TRANSFORMS)) {
    it(`catches blocklist words disguised as: ${name}`, () => {
      const missed = sample.filter((w) => !filter.check(fn(w)));
      total += sample.length;
      caught += sample.length - missed.length;
      console.log(`  ${name}: caught ${sample.length - missed.length}/${sample.length}`);
      // Plain and simple disguises must be caught every time; the harder ones within a tolerance.
      const tolerance = ['plain', 'upper case', 'in a sentence', 'full-width'].includes(name) ? 0 : 2;
      expect(missed.length, `missed: ${missed.length} words`).toBeLessThanOrEqual(tolerance);
    });
  }

  it('has at least 100 abusive messages in the generated corpus', () => {
    expect(sample.length * Object.keys(TRANSFORMS).length).toBeGreaterThanOrEqual(100);
  });
});

describe('tiers, allowlist and graduated suspension', () => {
  it('defaults: every match is the same 24 hours', () => {
    for (const tier of ['mild', 'standard', 'severe'] as const) {
      expect(suspensionFor(DEFAULT_MODERATION_CONFIG, tier, 5)).toBe(24 * 3600_000);
    }
  });
  it('tier overrides and repeat multipliers apply when configured', () => {
    const cfg = { ...DEFAULT_MODERATION_CONFIG, tierSuspendMs: { mild: 3600_000 }, repeatMultipliers: [1, 3, 7] };
    expect(suspensionFor(cfg, 'mild', 0)).toBe(3600_000);
    expect(suspensionFor(cfg, 'mild', 1)).toBe(3 * 3600_000);
    expect(suspensionFor(cfg, 'standard', 9)).toBe(7 * 24 * 3600_000);
  });
  it('mild and severe terms carry their tier; the most serious listing wins', () => {
    const f = new ChatFilter({ blocklist: ['blorf'], mildTerms: ['zorgle', 'blorf'], severeTerms: ['snarkwad', 'blorf'], isWord: () => false });
    expect(f.check('zorgle')?.tier).toBe('mild');
    expect(f.check('blorf')?.tier).toBe('severe');
    expect(f.check('snarkwad')?.tier).toBe('severe');
    expect(new ChatFilter({ blocklist: ['blorf'], isWord: () => false }).check('blorf')?.tier).toBe('standard');
  });
  it('an allowlisted word is never flagged, a lookalike still is', () => {
    const f = new ChatFilter({ blocklist: ['blorfing'], allowlist: ['blorfingham'], isWord: () => false });
    expect(f.check('blorfingham')).toBeNull();
    expect(f.check('blorfing')).not.toBeNull();
    expect(new ChatFilter({ blocklist: ['blorfing'], isWord: () => false }).check('blorfingham')).not.toBeNull();
  });
  it('homoglyph and full-width letters are read as Latin', () => {
    const f = new ChatFilter({ blocklist: ['blorf'], isWord: () => false });
    expect(f.check('blоrf')).not.toBeNull(); // Cyrillic o
    expect(f.check('ｂｌｏｒｆ')).not.toBeNull(); // full-width
  });
});
