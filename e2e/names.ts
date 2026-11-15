import { isInappropriateName } from '../src/lib/nickname';

/**
 * A number for this run, from the clock, that leaves every name built from it acceptable. The game reads digits as
 * letters (1 as l, 5 as s), so a name like "Ana1..." is refused as rude, and the tests that took Date.now() as it came
 * failed on about one run in sixty, at sign-in, before testing anything.
 */
export function runNumber(prefixes: readonly string[]): string {
  for (let t = Date.now(); ; t++) {
    const run = String(t % 100000);
    if (prefixes.every((p) => !isInappropriateName(`${p}${run}`))) return run;
  }
}
