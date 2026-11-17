// One thing about vitest's JSON report that both the runner and the ledger module must do the same way.
//
// vitest names each test file by its full path on the disk it ran on. The head's report is made in the repo, the base's
// in the base checkout under the cache, and on the build server a cached base report may have been made in a third
// place. Compared as they are, no file of one report is in the other. So every report the gate keeps is rewritten once,
// straight after vitest wrote it, to name its files from the checkout's own root: "src/skin/__tests__/a.test.ts".
//
//   relativeNames(file, root)   rewrite the report at `file`, which vitest made in the checkout at `root`
//
// The runner does it for the head's report (ctx.vitest.head). Whoever makes the base's (<cache>/<base>/vitest.json, the
// ledger module) calls it with the base checkout's directory. Doing it twice changes nothing.
import { readFileSync, realpathSync, renameSync, writeFileSync } from 'node:fs';
import { sep } from 'node:path';

/** A test file's name from its checkout's root, with forward slashes. A name that is not under `root` is left as it is. */
export function relativeName(name, roots) {
  for (const root of roots) {
    const prefix = root.endsWith(sep) ? root : `${root}${sep}`;
    if (name.startsWith(prefix)) return name.slice(prefix.length).split(sep).join('/');
  }
  return name;
}

/**
 * Rewrites the report at `file` so every test file is named from `root`. Returns how many names were changed; throws
 * when the file is not a vitest report. Written to a file beside it first and then moved into place, so a run that is
 * stopped half way leaves the old report or the new one, never half of one.
 */
export function relativeNames(file, root) {
  const json = JSON.parse(readFileSync(file, 'utf8'));
  if (!json || !Array.isArray(json.testResults)) throw new Error(`${file} is not a vitest JSON report`);
  // The same folder can have two spellings (a link on the way to it): vitest may have used either.
  const roots = [...new Set([root, (() => { try { return realpathSync(root); } catch { return root; } })()])];
  let changed = 0;
  for (const f of json.testResults) {
    if (typeof f?.name !== 'string') continue;
    const name = relativeName(f.name, roots);
    if (name !== f.name) { f.name = name; changed++; }
  }
  if (changed) {
    writeFileSync(`${file}.tmp`, JSON.stringify(json));
    renameSync(`${file}.tmp`, file);
  }
  return changed;
}
