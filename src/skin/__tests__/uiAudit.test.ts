import { describe, expect, it } from 'vitest';
import allow from '../audit/allow.json';
import budget from '../audit/budget.json';
import { audit, KINDS, tally } from '../audit/uiAudit';
import type { AllowEntry, Kind } from '../audit/uiAudit';

/**
 * The farm kit's audit (docs/REDESIGN_PLAN_V6_UI.md Parts 3.1 and 7.1). Every count must stay at or under its budget,
 * and each milestone lowers the budget to its new count, so a number only ever goes down. U5 brings them all to 0.
 */
describe('the farm kit audit', () => {
  const findings = audit();
  const { open, counts } = tally(findings, allow as AllowEntry[]);

  it('no kind of finding is over its budget', () => {
    const over = KINDS.filter((k) => counts[k] > (budget as Record<Kind, number>)[k]);
    if (over.length) {
      const table = open.filter((f) => over.includes(f.kind)).map((f) => `${f.kind.padEnd(8)} ${f.file}:${f.line}  ${f.selector || f.text}`).join('\n');
      console.log(`Audit over budget (${over.map((k) => `${k} ${counts[k]} > ${(budget as Record<Kind, number>)[k]}`).join(', ')}):\n${table}`);
    }
    expect(over).toEqual([]);
  });

  it('the budget is not looser than the code needs, so a fix is banked as soon as it lands', () => {
    // A budget above the count would let a later regression through unnoticed: lower budget.json to the new count.
    for (const k of KINDS) expect((budget as Record<Kind, number>)[k], `budget for ${k}`).toBe(counts[k]);
  });

  it('every allow-list entry names a Part of the plan and still matches something', () => {
    for (const a of allow as AllowEntry[]) {
      expect(a.reason, `${a.file} ${a.selectorOrLine}`).toMatch(/Part \d/);
      expect(findings.some((f) => f.file === a.file && (a.selectorOrLine === '*' || f.selector.includes(a.selectorOrLine) || f.text.includes(a.selectorOrLine))), `${a.file} ${a.selectorOrLine} matches nothing`).toBe(true);
    }
  });

  it('never reads the Hunt, which keeps its own look', () => {
    expect(findings.some((f) => f.file.includes('/hunt/'))).toBe(false);
  });
});
