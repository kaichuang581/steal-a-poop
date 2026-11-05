import { describe, expect, it } from 'vitest';
import { keystrokeAt, lastRejectAt, typingScript } from '../model/botTyping';

describe('bot typing under pressure', () => {
  it('sends the word the moment it is typed: no pause at the end', () => {
    for (const word of ['cat', 'garden', 'thunderstorm']) {
      for (const ms of [1500, 4000, 9000]) {
        for (let seed = 1; seed < 30; seed++) {
          const script = typingScript(word, ms, seed, word[0], 16000);
          expect(script.at(-1)!.text).toBe(word);
          expect(ms - script.at(-1)!.at).toBeLessThan(260);
        }
      }
    }
  });

  it('a bot answering late in its turn panics: junk words bounced before the real one, flailing from early on', () => {
    let rejects = 0, firstKeyShare = 0;
    for (let seed = 1; seed <= 100; seed++) {
      const script = typingScript('pancakes', 15000, seed, 'p', 16000); // lands 15 s into a 16 s turn
      rejects += script.filter((k) => k.kind === 'reject').length;
      firstKeyShare += script[0].at / 15000;
      expect(script.every((k) => k.at < 15000)).toBe(true);
      expect(script.at(-1)!.text).toBe('pancakes');
      expect(script.filter((k) => k.kind === 'reject').every((k) => k.text.startsWith('p') && k.text.length >= 3)).toBe(true);
    }
    expect(rejects).toBeGreaterThan(120);
    expect(firstKeyShare / 100).toBeLessThan(0.4);
    // A bot answering early is calm: it never sends junk.
    for (let seed = 1; seed <= 100; seed++) expect(typingScript('pancakes', 5000, seed, 'p', 16000).some((k) => k.kind === 'reject')).toBe(false);
  });

  it('a bot that will run out of time spams words that are not words and is bounced every time', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const script = typingScript(null, 8000, seed, 's', 8000);
      const rejects = script.filter((k) => k.kind === 'reject');
      expect(rejects.length).toBeGreaterThanOrEqual(2);
      expect(rejects.every((k) => k.text.startsWith('s') && k.text.length >= 3)).toBe(true);
      expect(script.at(-1)!.text).toBe('');
      expect(script.every((k) => k.at < 8000)).toBe(true);
    }
  });

  it('reads the keystroke, and the latest bounce, at a moment', () => {
    const script = [{ at: 100, text: 'c' }, { at: 200, text: 'ca', kind: 'reject' as const }, { at: 300, text: '' }];
    expect(keystrokeAt(script, 50)).toBeNull();
    expect(keystrokeAt(script, 250)?.kind).toBe('reject');
    expect(keystrokeAt(script, 999)?.text).toBe('');
    expect(lastRejectAt(script, 150)).toBeNull();
    expect(lastRejectAt(script, 999)?.at).toBe(200);
  });
});
