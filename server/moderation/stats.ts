/**
 * Moderation numbers: how often the filter is wrong, how long people wait, how much there is.
 * Run against the database:  DATABASE_URL=... npm run mod:stats
 * `computeStats` is pure, so the same numbers can be produced from any list of items.
 */
import type { ReviewItem } from '../chat';
import type { AuditEntry } from './audit';

export interface ModerationStats {
  generatedAt: number;
  volume: { total: number; byCategory: Record<string, number>; byStatus: Record<string, number>; perDay: Record<string, number> };
  /** Held messages (not reports or appeals) that a reviewer or person decided. */
  filter: { decided: number; cleared: number; falsePositiveRate: number | null; clearedByPerson: number; clearedByReviewer: number };
  /** Hours from a message being held to a person deciding. Items still open are not counted here. */
  timeToHumanDecisionMs: { count: number; median: number | null; p90: number | null; max: number | null };
  open: { total: number; waitingForPerson: number; oldestAgeMs: number | null };
  /** Where the automatic reviewer's opinion and the person's final call both exist. */
  reviewerAgreement: { compared: number; agreed: number; rate: number | null };
}

const percentile = (sorted: number[], p: number) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)] : null);

export function computeStats(items: readonly ReviewItem[], audit: readonly AuditEntry[], now: number): ModerationStats {
  const byCategory: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  const perDay: Record<string, number> = {};
  for (const i of items) {
    byCategory[i.category] = (byCategory[i.category] ?? 0) + 1;
    byStatus[i.status] = (byStatus[i.status] ?? 0) + 1;
    const day = new Date(i.at).toISOString().slice(0, 10);
    perDay[day] = (perDay[day] ?? 0) + 1;
  }

  const held = items.filter((i) => i.category === 'blocked_word' && i.status === 'reviewed' && i.verdict);
  const cleared = held.filter((i) => i.verdict === 'clear');
  const clearedByPerson = cleared.filter((i) => i.decidedBy).length;

  // Time to a person's decision comes from the audit log, which has the decision time for every item.
  const heldAt = new Map<number, number>();
  for (const i of items) heldAt.set(i.id, i.at);
  const waits = audit
    .filter((e) => e.action === 'human_decision' && e.itemId !== undefined && heldAt.has(e.itemId))
    .map((e) => e.at - heldAt.get(e.itemId!)!)
    .filter((ms) => ms >= 0)
    .sort((a, b) => a - b);

  const open = items.filter((i) => i.status !== 'reviewed');
  const compared = items.filter((i) => i.opinion && i.decidedBy && i.verdict);
  const agreed = compared.filter((i) => i.opinion!.verdict === i.verdict).length;

  return {
    generatedAt: now,
    volume: { total: items.length, byCategory, byStatus, perDay },
    filter: {
      decided: held.length,
      cleared: cleared.length,
      falsePositiveRate: held.length ? cleared.length / held.length : null,
      clearedByPerson,
      clearedByReviewer: cleared.length - clearedByPerson,
    },
    timeToHumanDecisionMs: { count: waits.length, median: percentile(waits, 0.5), p90: percentile(waits, 0.9), max: waits.length ? waits[waits.length - 1] : null },
    open: {
      total: open.length,
      waitingForPerson: open.filter((i) => i.status === 'human').length,
      oldestAgeMs: open.length ? now - Math.min(...open.map((i) => i.at)) : null,
    },
    reviewerAgreement: { compared: compared.length, agreed, rate: compared.length ? agreed / compared.length : null },
  };
}

const pct = (n: number | null) => (n === null ? 'n/a' : `${(n * 100).toFixed(1)}%`);
const dur = (ms: number | null) => (ms === null ? 'n/a' : ms < 90_000 ? `${Math.round(ms / 1000)}s` : ms < 90 * 60_000 ? `${Math.round(ms / 60_000)}m` : `${(ms / 3_600_000).toFixed(1)}h`);

export function formatStats(s: ModerationStats): string {
  return [
    `Moderation stats at ${new Date(s.generatedAt).toISOString()}`,
    `Volume: ${s.volume.total} items. ${Object.entries(s.volume.byCategory).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'}`,
    `Filter false positives: ${s.filter.cleared}/${s.filter.decided} held messages ended cleared = ${pct(s.filter.falsePositiveRate)} (${s.filter.clearedByPerson} by a person, ${s.filter.clearedByReviewer} by the reviewer; undecided items are not counted)`,
    `Time to a person's decision: median ${dur(s.timeToHumanDecisionMs.median)}, p90 ${dur(s.timeToHumanDecisionMs.p90)}, max ${dur(s.timeToHumanDecisionMs.max)} over ${s.timeToHumanDecisionMs.count} decisions`,
    `Open now: ${s.open.total} (${s.open.waitingForPerson} waiting for a person), oldest ${dur(s.open.oldestAgeMs)}`,
    `Reviewer agreed with the person: ${s.reviewerAgreement.agreed}/${s.reviewerAgreement.compared} = ${pct(s.reviewerAgreement.rate)}`,
  ].join('\n');
}

/** Command line entry (scripts/mod-stats.ts): loads from the database and prints the numbers. */
export async function runStatsCli(): Promise<void> {
  const { Pool } = await import('pg');
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('Set DATABASE_URL to read the moderation tables.');
    process.exit(1);
  }
  const pool = new Pool({ connectionString: url, max: 1 });
  const { PostgresStore } = await import('./postgres');
  const { PostgresAudit } = await import('./audit');
  const [items, audit] = await Promise.all([new PostgresStore(pool).loadItems(), new PostgresAudit(pool).list()]);
  console.log(formatStats(computeStats(items, audit, Date.now())));
  await pool.end();
}
