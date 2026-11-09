/** Lowers src/skin/audit/budget.json to today's counts (V6 Part 3.1: the budget only goes down). `npx vite-node scripts/ui-audit-budget.ts` */
import { readFileSync, writeFileSync } from 'node:fs';
import { audit, KINDS, tally } from '../src/skin/audit/uiAudit';
import allow from '../src/skin/audit/allow.json';

const path = 'src/skin/audit/budget.json';
const old = JSON.parse(readFileSync(path, 'utf8')) as Record<string, number>;
const now = tally(audit(), allow).counts as Record<string, number>;
const next = Object.fromEntries(KINDS.map((k) => [k, Math.min(old[k] ?? Infinity, now[k] ?? 0)]));
writeFileSync(path, JSON.stringify(next) + '\n');
console.log(KINDS.map((k) => `${k} ${old[k]} -> ${next[k]}${(now[k] ?? 0) > old[k] ? ` (OVER: ${now[k]})` : ''}`).join('\n'));
