/**
 * Generates the word-twist pool and reports what the dictionary can play.
 *
 *   npx vite-node tools/buildTwists.ts -- [--out <file.json>]
 *
 * Singles first, then every pair of singles that both hold. A candidate is kept when the words it allows still let a
 * chain run (see the constants in src/engine/twists/rules.ts) and when it accepts a set of words no kept twist
 * already accepts. Prints the counts; with --out it also writes the kept twists as JSON.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createDictionary } from '../src/engine/dictionary';
import { LETTERS, MAX_TWIST_SHARE, MIN_CONTINUATIONS, MIN_START_LETTERS, MIN_TWIST_WORDS, pairRule, RULE_MIN_LENGTH, singleRules, type TwistRule } from '../src/twists/rules';

const arg = (name: string) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : null; };
const outFile = arg('--out');
/** How many twists to keep in the pool. The rest are reported, not written. */
const target = Number(arg('--target') ?? 1000);

const dict = createDictionary(readFileSync(new URL('../public/words.txt', import.meta.url), 'utf8').split('\n'));
const words: string[] = [];
for (const l of LETTERS) words.push(...dict.startingWith(l));
const base = words.map((w) => w.length >= RULE_MIN_LENGTH);
const baseCount = base.filter(Boolean).length;
const maxWords = Math.floor(baseCount * MAX_TWIST_SHARE);

/** Which words a rule allows (bit per dictionary word, already limited to the minimum length). */
function allowed(rule: TwistRule): Uint8Array {
  const out = new Uint8Array(words.length);
  for (let i = 0; i < words.length; i++) out[i] = base[i] && rule.accepts(words[i]) ? 1 : 0;
  return out;
}

/** Playable: a chain can start, and no letter the chain can end on leaves the next player stuck. */
function playable(mask: Uint8Array): { ok: boolean; count: number } {
  const starts = new Map<string, number>();
  const ends = new Set<string>();
  let count = 0;
  for (let i = 0; i < words.length; i++) {
    if (!mask[i]) continue;
    count++;
    const w = words[i];
    starts.set(w[0], (starts.get(w[0]) ?? 0) + 1);
    ends.add(w[w.length - 1]);
  }
  if (starts.size < MIN_START_LETTERS) return { ok: false, count };
  for (const e of ends) if ((starts.get(e) ?? 0) < MIN_CONTINUATIONS) return { ok: false, count };
  return { ok: true, count };
}

/** The set of words as a string, so two twists that allow exactly the same words are caught. */
function signature(mask: Uint8Array): string {
  let s = '';
  for (let i = 0; i < mask.length; i++) if (mask[i]) s += i.toString(36) + ',';
  return s;
}

const started = Date.now();
const singles = singleRules();
const seen = new Map<string, string>();
const kept: { id: string; label: string; detail: string; count: number }[] = [];
const dropped = { unplayable: 0, duplicate: 0, empty: 0, notATwist: 0 };
const singleMasks = new Map<string, Uint8Array>();

function consider(rule: TwistRule, mask: Uint8Array) {
  const p = playable(mask);
  if (p.count === 0) { dropped.empty++; return; }
  if (p.count < MIN_TWIST_WORDS || p.count > maxWords) { dropped.notATwist++; return; }
  if (!p.ok) { dropped.unplayable++; return; }
  const sig = signature(mask);
  const first = seen.get(sig);
  if (first) { dropped.duplicate++; return; }
  seen.set(sig, rule.id);
  kept.push({ id: rule.id, label: rule.label, detail: rule.detail, count: p.count });
}

for (const r of singles) {
  const m = allowed(r);
  singleMasks.set(r.id, m);
  consider(r, m);
}
const singlesKept = kept.length;

for (let i = 0; i < singles.length; i++) {
  for (let j = i + 1; j < singles.length; j++) {
    const a = singleMasks.get(singles[i].id)!;
    const b = singleMasks.get(singles[j].id)!;
    const m = new Uint8Array(words.length);
    for (let k = 0; k < words.length; k++) m[k] = a[k] & b[k];
    consider(pairRule(singles[i], singles[j]), m);
  }
}

const seconds = ((Date.now() - started) / 1000).toFixed(1);
console.log(`dictionary: ${words.length} words (${dict.size} read)`);
console.log(`single rules tried: ${singles.length}, kept: ${singlesKept}`);
console.log(`pairs tried: ${(singles.length * (singles.length - 1)) / 2}`);
console.log(`kept in total: ${kept.length}`);
console.log(`dropped: not a twist (under ${MIN_TWIST_WORDS} or over ${maxWords} words) ${dropped.notATwist}, unplayable ${dropped.unplayable}, same words as a kept twist ${dropped.duplicate}, no words ${dropped.empty}`);
console.log(`time: ${seconds}s`);
// Spread the pool over the rule families: take one from each family in turn, until the target is reached.
const family = (id: string) => id.split('+').map((part) => part.split(/[:=]/)[0]).sort().join('+');
const groups = new Map<string, typeof kept>();
for (const t of kept) {
  const g = family(t.id);
  groups.get(g)?.push(t) ?? groups.set(g, [t]);
}
const chosen: typeof kept = [];
const queues = [...groups.values()];
while (chosen.length < target && queues.some((q) => q.length)) {
  for (const q of queues) if (q.length && chosen.length < target) chosen.push(q.shift()!);
}
console.log(`families: ${groups.size}, pool: ${chosen.length} twists (target ${target})`);
if (outFile) {
  writeFileSync(outFile, JSON.stringify(chosen, null, 2));
  console.log(`wrote ${chosen.length} twists to ${outFile}`);
}
