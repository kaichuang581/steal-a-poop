import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createDictionary } from '../src/engine';
import { ChatFilter, childSafetySignal, deLeet, emptyBuffer, pushBuffer, squash, tokenize } from './filter';
import { RateLimiter } from './ratelimit';

// A made-up list, so evasion handling is tested without real slurs in the repo.
const fake = new ChatFilter({
  blocklist: ['blorf', 'zorgle', 'snarkwad', 'two words here', 'ass'],
  isWord: (w) => ['classic', 'passage', 'blorfing'].includes(w) || w === 'assist',
});
const hit = (s: string) => fake.check(s)?.kind ?? null;

describe('normalizing', () => {
  it('undoes number and symbol swaps, accents and invisible characters', () => {
    expect(deLeet('Bl0rf')).toBe('blorf');
    expect(deLeet('b​lörf')).toBe('blorf');
    expect(squash('b.l-0_r f')).toBe('blorf');
    expect(squash('bllllorfff')).toBe('bllorff');
    expect(tokenize('A  b3 c!')).toEqual(['a', 'be', 'c']); // a trailing symbol is punctuation
    expect(tokenize('sh!t $hit')).toEqual(['shit', 'shit']); // inside or leading, it is a letter
  });
});

describe('the evasion cases from the chat policy', () => {
  it('catches the plain word, in any case', () => {
    expect(hit('you blorf')).toBe('word');
    expect(hit('BLORF')).toBe('word');
  });
  it('catches numbers and symbols standing in for letters', () => {
    expect(hit('bl0rf')).toBe('word');
    expect(hit('8l0rf')).toBe('word');
    expect(hit('z0rg|e')).toBe('word');
    expect(hit('$narkwad')).toBe('word');
  });
  it('a trailing symbol cannot be used to hide a word', () => {
    expect(hit('blorf!')).toBe('word');
    expect(hit('blorf!!!')).toBe('word');
    expect(hit('zorgle.')).toBe('word');
  });
  it('reads "1" and "|" as either "i" or "l"', () => {
    expect(hit('b1orf')).toBe('word'); // l
    expect(hit('snarkwad'.replace('a', '4'))).toBe('word');
    expect(hit('z0rg|e')).toBe('word'); // l
  });
  it('catches stretched letters', () => {
    expect(hit('bloooorf')).toBe('word');
    expect(hit('blorrrrf')).toBe('word');
  });
  it('catches spaced-out and dotted-out spelling in one message', () => {
    expect(hit('b l o r f')).toBe('spaced');
    expect(hit('b.l.o.r.f')).toBe('spaced');
    expect(hit('z - o - r - g - l - e')).toBe('spaced');
  });
  it('catches the word hidden inside a longer made-up word', () => {
    expect(hit('xxblorfxx')).toBe('embedded');
  });
  it('catches a phrase entry', () => {
    expect(hit('say two words here please')).toBe('spaced');
  });
  it('catches one letter at a time across messages', () => {
    let buffer = emptyBuffer();
    const results: (string | null)[] = [];
    for (const ch of ['b', 'l', 'o', 'r', 'f']) {
      buffer = pushBuffer(buffer, ch);
      results.push(fake.checkBuffer(buffer)?.kind ?? null);
    }
    expect(results).toEqual([null, null, null, null, 'spaced']);
  });
});

describe('not flagging innocent text', () => {
  it('lets ordinary words through, including ones that contain a short entry', () => {
    for (const msg of ['hello there', 'what a classic', 'passage to india', 'can you assist', 'good game everyone']) {
      expect(hit(msg), msg).toBeNull();
    }
  });
  it('ignores a blocked string inside a real dictionary word', () => {
    expect(hit('blorfing')).toBeNull(); // listed as an ordinary word in this test dictionary
  });
  it('treats very short entries as whole words only', () => {
    expect(hit('ass')).toBe('word');
    expect(hit('assume class pass bass')).toBeNull();
  });
});

describe('with the real English blocklist and the game dictionary', () => {
  const dict = createDictionary(readFileSync('public/words.txt', 'utf8').split('\n'));
  const real = new ChatFilter({
    blocklist: readFileSync('server/data/blocklist-en.txt', 'utf8').split('\n'),
    isWord: (w) => dict.has(w),
  });
  it('holds plain, swapped, spaced and stretched profanity', () => {
    for (const msg of ['what the shit', 'sh1t', 's h i t', 'shiiiiit', 'sh!t', 'bullsh1t']) {
      expect(real.check(msg), msg).not.toBeNull();
    }
  });
  it('does not flag everyday chat or the game\'s own name', () => {
    for (const msg of [
      'Steal a Poop', 'nice word!', 'you stole my pile', 'good game', 'lol that was close', 'my turn next',
      'assume the best', 'classic move', 'Scunthorpe', 'shiitake', 'I love this game', 'Nigeria', 'cocktail',
    ]) {
      expect(real.check(msg), msg).toBeNull();
    }
  });
});

describe('child-safety signals', () => {
  it('flags concrete grooming phrases', () => {
    for (const msg of ["don't tell your parents", 'are you home alone', 'send me nudes', "what's your address"]) {
      expect(childSafetySignal(msg), msg).toBe(true);
    }
  });
  it('leaves friendly questions alone', () => {
    for (const msg of ['how old are you?', 'nice to meet you', 'are you playing again?', 'tell your friends about this game']) {
      expect(childSafetySignal(msg), msg).toBe(false);
    }
  });
});

describe('RateLimiter', () => {
  it('allows max events per window, then refuses, then recovers', () => {
    const r = new RateLimiter(3, 1000);
    expect([0, 100, 200].map((t) => r.allow('a', t))).toEqual([true, true, true]);
    expect(r.allow('a', 300)).toBe(false);
    expect(r.retryAfter('a', 300)).toBe(700);
    expect(r.allow('b', 300)).toBe(true); // separate key
    expect(r.allow('a', 1001)).toBe(true);
  });
});

describe('RateLimiter.prune', () => {
  it('forgets keys whose events have all expired, and keeps active ones', () => {
    const r = new RateLimiter(3, 1000);
    r.allow('old', 0);
    r.allow('fresh', 900);
    expect(r.size).toBe(2);
    r.prune(1500);
    expect(r.size).toBe(1);
    expect(r.allow('fresh', 1500)).toBe(true);
  });
});
