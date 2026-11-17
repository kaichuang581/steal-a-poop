import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, it } from 'vitest';

// The fences of the visual overhaul (docs/visual-overhaul/16-qa-and-acceptance.md, section 4.1 c): arithmetic, hashes
// and one `git ls-files`, nothing built. The pins are in fences.json beside this file.
//
// The checking itself lives in tools/gate/fences.mjs, which the gate runs too, so this test and `npm run gate` cannot
// disagree. Each check hands back lines: none when all is well, else what differs, by name, and what to do about it.
// When one fails, read its whole message, or run `node tools/gate/fences.mjs` for the same lines.
//
// A change that is meant (Kai's server work on another branch, say) is pinned again with
// `node tools/gate/fences.mjs --write` and said in the pull request, where the gate prints it as a decision for Brian.
interface Fences {
  fileProblems(root: string): string[];
  keyProblems(root: string): string[];
  replaceableProblems(root: string): string[];
}

// The tests run from the repo's root, as every test here that reads a file expects.
const root = process.cwd();
const fences = async (): Promise<Fences> => import(/* @vite-ignore */ pathToFileURL(join(root, 'tools', 'gate', 'fences.mjs')).href);

/** Fails with every line a check handed back, so the report names each file. */
function mustBeEmpty(lines: string[]): void {
  if (lines.length) throw new Error(lines.join('\n'));
}

describe('the fences round what the visual overhaul may not touch', () => {
  it('no fenced file has changed, appeared or gone: the engine, the dream\'s rules, the stores, the server, the database, the old look and the word lists', async () => {
    mustBeEmpty((await fences()).fileProblems(root));
  });

  it('the keys the game saves under are the pinned set: none new, none gone, none renamed', async () => {
    mustBeEmpty((await fences()).keyProblems(root));
  });

  it('the tests that may be replaced are the same list in replaceable.json, in the milestone table and in the plan\'s own sentence', async () => {
    mustBeEmpty((await fences()).replaceableProblems(root));
  });
});
