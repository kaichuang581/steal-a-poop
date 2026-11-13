import { describe, expect, it } from 'vitest';
import { isInappropriateName, MAX_NICKNAME, readings } from '../nickname';

describe('name check sees through disguises', () => {
  it('refuses swears and slurs written with digits, symbols, accents, other alphabets, masks and sound-alikes', () => {
    const disguised = [
      // digits and symbols
      'sh1t', '5h1t', 'N1gg3r', 'ni99er', 'n166er', '8itch', 'a$$', '8008s', 'c0ck', 'd1ck', 's3x', '(unt', '€unt', '|<ys', 'sh!t',
      // accents, wide letters, Greek and Cyrillic look-alikes
      'fück', 'fùck', 'ｆｕｃｋ', 'fυck', 'niggеr', 'ƒuck', 'ВІТСН',
      // letters blanked out
      'sh*t', 'f*ck', 'f**k', 'w#ore', 'b?tch', 'd*ck',
      // sound-alikes and dropped vowels
      'phuck', 'fvck', 'biatch', 'fck', 'btch',
      // split up
      'f.u.c.k', 'f_u_c_k', 'f u c k', 'Big D1ck', 'n!gga',
    ];
    for (const n of disguised) expect(isInappropriateName(n), n).toBe(true);
  });

  it('still lets ordinary names through', () => {
    const fine = [
      'Steve', 'Dave', 'Vicky', 'Phil', 'Sophie', 'Joseph', 'Phoebe', 'Victor', 'Olivia', 'Liam', 'Noah', 'Emma', 'Ava',
      'Lucas', 'Mia', 'Ethan', 'Chloe', 'Scott', 'Nick', 'Ashton', 'Mitch', 'Butch',
      'Hitch', 'Player1', 'Sam2', 'Kai88', 'Star*', 'Mr*Cool', '#1Fan', 'L1ly', 'B3n', 'Zo3', 'J4ck', 'M1ke',
      'Sheep#2', 'Cassie', 'Basement', 'Maya', 'Kai', 'Grape', 'Nigel', 'Night', 'Assist', 'Raccoon', 'Pakistan', 'Moo-Moo Mae',
      'Sn0wflake', 'W00lly', 'Ba@baa', 'Shep', 'Peck', 'Cluck', 'Fluffy', 'Dottie',
    ];
    for (const n of fine) expect(isInappropriateName(n), n).toBe(false);
  });

  it('stays quick on the worst case', () => {
    const worst = '*#1|6€1|6€*#'.slice(0, MAX_NICKNAME);
    expect(readings(worst).length).toBeLessThanOrEqual(2 * 4096);
    const t = performance.now();
    isInappropriateName(worst);
    expect(performance.now() - t).toBeLessThan(500);
  });
});
