import { describe, expect, it } from 'vitest';
import { seedOf, typedAt, typingScript } from '../model/botTyping';

describe('bot typing', () => {
  it('always ends on the exact word, inside the time the bot takes', () => {
    for (const word of ['cat', 'garden', 'thunderstorm', 'quixotically']) {
      for (const ms of [800, 2500, 6000]) {
        for (let seed = 1; seed < 40; seed++) {
          const script = typingScript(word, ms, seed);
          expect(script.at(-1)!.text).toBe(word);
          expect(script.every((k) => k.at >= 0 && k.at < ms)).toBe(true);
          expect(script.every((k, i) => i === 0 || k.at >= script[i - 1].at)).toBe(true);
        }
      }
    }
  });

  it('types like a person: a think first, bursts with stops, and sometimes a slip it backspaces', () => {
    let slips = 0, stops = 0;
    for (let seed = 1; seed < 200; seed++) {
      const script = typingScript('pancakes', 5000, seed);
      expect(script[0].at).toBeGreaterThan(5000 * 0.15);
      // A slip shows as a text that is not a prefix of the word.
      if (script.some((k) => !'pancakes'.startsWith(k.text))) slips++;
      const gaps = script.slice(1).map((k, i) => k.at - script[i].at);
      if (gaps.some((g) => g > 400)) stops++;
    }
    expect(slips).toBeGreaterThan(30);
    expect(slips).toBeLessThan(170);
    expect(stops).toBeGreaterThan(50);
  });

  it('keeps the same script for the same turn, so the tag never flickers', () => {
    expect(typingScript('meadow', 4000, seedOf('turn-7'))).toEqual(typingScript('meadow', 4000, seedOf('turn-7')));
  });

  it('a bot about to run out of time starts, stalls and deletes, and never finishes', () => {
    const script = typingScript(null, 8000, 5, 's');
    expect(script.length).toBeGreaterThan(2);
    expect(script.every((k) => k.text === '' || k.text.startsWith('s'))).toBe(true);
    expect(script.at(-1)!.text).toBe('');
  });

  it('reads the text at a moment', () => {
    const script = [{ at: 100, text: 'c' }, { at: 200, text: 'ca' }, { at: 300, text: 'cat' }];
    expect(typedAt(script, 50)).toBe('');
    expect(typedAt(script, 250)).toBe('ca');
    expect(typedAt(script, 999)).toBe('cat');
  });
});
