import { describe, expect, it } from 'vitest';
import { checkNickname, isInappropriateName } from '../nickname';

describe('username filter', () => {
  it('refuses rude, sexual and hateful names, including look-alike spellings', () => {
    for (const n of ['fuck', 'Sh1t', 'b!tch', 'N1gga', 'hitler', 'Heil_Me', 'pr0n', 'BigAss', 'big ass', 'kys', 'rape', '1488', 'sex', 'cumshot', 'Pedo', 'r3tard', 'niiiigga', 'KKK', 'k k k', 'b00bs']) {
      expect(isInappropriateName(n), n).toBe(true);
    }
  });
  it('lets ordinary names through, including ones that merely contain a short bad word', () => {
    for (const n of ['Dash', 'Class', 'Grape', 'Sheepy', 'Moo-Moo Mae', 'Crisis', 'Pakistan', 'Assist', 'Night', 'Knight', 'Nigel', 'Bob', 'Bobby', 'Cassidy', 'Raccoon', 'Analyst', 'Bombastic', 'Ana', 'Kai']) {
      expect(isInappropriateName(n), n).toBe(false);
    }
  });
  it('checkNickname reports a friendly message', () => {
    expect(checkNickname('fuck')).toEqual({ ok: false, message: 'Please pick a friendlier nickname.' });
    expect(checkNickname('Dash')).toEqual({ ok: true, name: 'Dash' });
  });
});
