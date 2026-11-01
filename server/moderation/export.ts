/**
 * A case file for a lawyer or an authority: everything held about one player, with a checksum so
 * it can be shown to be unaltered. Run:
 *   DATABASE_URL=... npm run mod:export -- --user <userId> --by <your moderator id> [--out file.json]
 * Exporting is itself written to the audit log.
 */
import { createHash } from 'node:crypto';
import type { ReviewItem } from '../chat';
import type { AuditEntry } from './audit';
import type { ChildSafetyReport } from './reporting';

export interface EvidenceRow {
  itemId: number;
  capturedAt: number;
  contentHash: string;
  payload: unknown;
}

export interface CaseExport {
  format: 'steal-a-poop-case-export/1';
  generatedAt: number;
  generatedBy: string;
  subject: { userId: string };
  items: ReviewItem[];
  evidence: EvidenceRow[];
  childSafetyReports: ChildSafetyReport[];
  audit: AuditEntry[];
  /** sha256 of the JSON of everything above. Recompute it to check nothing was changed. */
  checksum: string;
}

export function buildCaseExport(input: {
  userId: string;
  by: string;
  now: number;
  items: readonly ReviewItem[];
  evidence: readonly EvidenceRow[];
  reports: readonly ChildSafetyReport[];
  audit: readonly AuditEntry[];
}): CaseExport {
  const body = {
    format: 'steal-a-poop-case-export/1' as const,
    generatedAt: input.now,
    generatedBy: input.by,
    subject: { userId: input.userId },
    items: input.items.filter((i) => i.userId === input.userId).sort((a, b) => a.id - b.id),
    evidence: [...input.evidence].sort((a, b) => a.capturedAt - b.capturedAt),
    childSafetyReports: input.reports.filter((r) => r.evidence.userId === input.userId),
    audit: input.audit.filter((e) => e.userId === input.userId).sort((a, b) => a.at - b.at),
  };
  return { ...body, checksum: checksumOf(body) };
}

export const checksumOf = (body: Omit<CaseExport, 'checksum'>) => createHash('sha256').update(JSON.stringify(body)).digest('hex');

export function verifyExport(doc: CaseExport): boolean {
  const { checksum, ...body } = doc;
  return checksumOf(body) === checksum;
}

/** Command line entry (scripts/mod-export.ts). */
export async function runExportCli(argv: string[]): Promise<void> {
  const arg = (name: string) => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const userId = arg('user');
  const by = arg('by');
  const url = process.env.DATABASE_URL;
  if (!userId || !by || !url) {
    console.error('Usage: DATABASE_URL=... npm run mod:export -- --user <userId> --by <your moderator id> [--out file.json]');
    process.exit(1);
  }
  const { Pool } = await import('pg');
  const { PostgresStore, PostgresReportStore } = await import('./postgres');
  const { PostgresAudit } = await import('./audit');
  const pool = new Pool({ connectionString: url, max: 1 });
  const audit = new PostgresAudit(pool);
  const ev = await pool.query('select item_id, captured_at, content_hash, payload from moderation_evidence where user_id = $1 order by id', [userId]);
  const doc = buildCaseExport({
    userId, by, now: Date.now(),
    items: await new PostgresStore(pool).loadItems(),
    evidence: ev.rows.map((r) => ({ itemId: Number(r.item_id), capturedAt: Number(r.captured_at), contentHash: r.content_hash as string, payload: r.payload })),
    reports: await new PostgresReportStore(pool).load(),
    audit: await audit.list({ userId }),
  });
  await audit.record({ at: Date.now(), actor: by, action: 'case_exported', userId, details: { checksum: doc.checksum } });
  const out = arg('out');
  const text = JSON.stringify(doc, null, 2);
  if (out) (await import('node:fs')).writeFileSync(out, text, { mode: 0o600 });
  else console.log(text);
  await pool.end();
}
