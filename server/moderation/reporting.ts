/**
 * Child-safety reporting. This is the adapter layer only: nothing here talks to a real authority.
 *
 * Flow: the chat service records a child-safety item (ChildSafetySink.record). A report is built and
 * stored as "awaiting_confirmation". A person confirms it (POST /api/mod/items/:id/report), and only
 * then is a reporter chosen for the sender's country and asked to submit.
 *
 * The default reporter is a dry run: it stores the full report and sends it nowhere. The NCMEC reporter
 * exists as a shape only and refuses to run. Its real transport must be written from NCMEC's own
 * documentation after registration, never from guesses. See docs/lanes/trust.md for what is needed.
 */
import { createHash } from 'node:crypto';
import type { ChatMessage, ChildSafetySink, ReviewItem } from '../chat';
import type { AuditLog } from './audit';

export type ReportStatus = 'awaiting_confirmation' | 'dry_run' | 'submitted' | 'failed' | 'not_configured';

export interface ChildSafetyReport {
  id: string;
  itemId: number;
  status: ReportStatus;
  reporter: string | null;
  country: string | null;
  createdAt: number;
  confirmedBy: string | null;
  confirmedAt: number | null;
  /** The authority's receipt, once one exists. */
  receipt: string | null;
  /** Evidence must not be deleted while a report is open or may be needed by law. Always true here. */
  legalHold: boolean;
  evidence: {
    userId: string;
    roomCode: string;
    /** When the message was held (epoch ms). */
    heldAt: number;
    text: string;
    /** sha256 of the exact text, so later copies can be shown to be unaltered. */
    contentHash: string;
    context: Pick<ChatMessage, 'id' | 'userId' | 'at' | 'text'>[];
    reportedBy: string | null;
  };
}

export interface SubmitOutcome {
  status: Extract<ReportStatus, 'dry_run' | 'submitted'>;
  receipt?: string;
}

export interface ChildSafetyReporter {
  readonly name: string;
  submit(report: ChildSafetyReport): Promise<SubmitOutcome>;
}

export class ReporterNotConfiguredError extends Error {
  constructor(reporter: string, why: string) {
    super(`${reporter} is not configured: ${why}`);
  }
}

/** Default. Keeps the report so nothing is lost, and sends it nowhere. */
export class DryRunReporter implements ChildSafetyReporter {
  readonly name = 'dry_run';
  async submit(): Promise<SubmitOutcome> {
    return { status: 'dry_run' };
  }
}

/** What a real NCMEC transport must do. Supplied only after registration and legal review. */
export type NcmecTransport = (report: ChildSafetyReport) => Promise<{ receipt: string }>;

/** Refuses to run until it is registered and has a real transport. No API details are assumed here. */
export class NcmecReporter implements ChildSafetyReporter {
  readonly name = 'ncmec';
  constructor(private cfg: { registered?: boolean; transport?: NcmecTransport } = {}) {}
  isConfigured(): boolean {
    return Boolean(this.cfg.registered && this.cfg.transport);
  }
  async submit(report: ChildSafetyReport): Promise<SubmitOutcome> {
    if (!this.cfg.registered) throw new ReporterNotConfiguredError('ncmec', 'the organisation is not registered for reporting');
    if (!this.cfg.transport) throw new ReporterNotConfiguredError('ncmec', 'no transport has been written');
    const { receipt } = await this.cfg.transport(report);
    return { status: 'submitted', receipt };
  }
}

/** Per-country choice. A country not listed gets the fallback (a dry run unless told otherwise). */
export function selectReporter(
  country: string | null | undefined,
  byCountry: Readonly<Record<string, ChildSafetyReporter>>,
  fallback: ChildSafetyReporter = new DryRunReporter(),
): ChildSafetyReporter {
  return (country && byCountry[country.toUpperCase()]) || fallback;
}

/** Where reports are kept. Reports are never deleted. */
export interface ReportStore {
  save(report: ChildSafetyReport): Promise<void>;
  load(): Promise<ChildSafetyReport[]>;
}

export class MemoryReportStore implements ReportStore {
  readonly reports = new Map<string, ChildSafetyReport>();
  async save(r: ChildSafetyReport) {
    this.reports.set(r.id, structuredClone(r));
  }
  async load() {
    return [...this.reports.values()].map((r) => structuredClone(r));
  }
}

export interface ReportingDeps {
  store: ReportStore;
  now: () => number;
  byCountry?: Record<string, ChildSafetyReporter>;
  fallback?: ChildSafetyReporter;
  countryOf?: (userId: string) => string | null | undefined;
  onError?: (error: unknown) => void;
  audit?: AuditLog;
}

export class ChildSafetyService implements ChildSafetySink {
  private reports = new Map<number, ChildSafetyReport>(); // by item id
  private queue: Promise<void> = Promise.resolve();

  constructor(private deps: ReportingDeps) {}

  async load(): Promise<void> {
    for (const r of await this.deps.store.load()) this.reports.set(r.itemId, r);
  }
  async flush(): Promise<void> {
    await this.queue;
  }

  /** Called by the chat service when a child-safety item is created. Builds and keeps the report. */
  record(item: ReviewItem): void {
    if (this.reports.has(item.id)) return;
    const report: ChildSafetyReport = {
      id: `csr-${item.id}-${item.at}`,
      itemId: item.id,
      status: 'awaiting_confirmation',
      reporter: null,
      country: this.deps.countryOf?.(item.userId) ?? null,
      createdAt: this.deps.now(),
      confirmedBy: null,
      confirmedAt: null,
      receipt: null,
      legalHold: true,
      evidence: {
        userId: item.userId,
        roomCode: item.roomCode,
        heldAt: item.at,
        text: item.text,
        contentHash: createHash('sha256').update(item.text).digest('hex'),
        context: (item.context ?? []).map(({ id, userId, at, text }) => ({ id, userId, at, text })),
        reportedBy: item.reportedBy ?? null,
      },
    };
    this.reports.set(item.id, report);
    this.persist(report);
  }

  get(itemId: number): ChildSafetyReport | undefined {
    return this.reports.get(itemId);
  }
  all(): ChildSafetyReport[] {
    return [...this.reports.values()];
  }

  /** A person has confirmed the item. Chooses the reporter for the sender's country and submits. */
  async confirm(itemId: number, by: string): Promise<ChildSafetyReport | null> {
    const report = this.reports.get(itemId);
    if (!report) return null;
    if (report.status === 'submitted' || report.status === 'dry_run') return report; // already done
    const reporter = selectReporter(report.country, this.deps.byCountry ?? {}, this.deps.fallback);
    report.confirmedBy = by;
    report.confirmedAt = this.deps.now();
    report.reporter = reporter.name;
    try {
      const out = await reporter.submit(structuredClone(report));
      report.status = out.status;
      report.receipt = out.receipt ?? null;
    } catch (error) {
      // Not configured is a known state, not a crash. The report stays and can be retried.
      report.status = error instanceof ReporterNotConfiguredError ? 'not_configured' : 'failed';
      if (report.status === 'failed') this.deps.onError?.(error);
    }
    this.persist(report);
    this.queue = this.queue
      .then(() => this.deps.audit?.record({ at: this.deps.now(), actor: by, action: 'child_safety_report_confirmed', itemId, userId: report.evidence.userId, details: { status: report.status, reporter: report.reporter } }))
      .catch((e) => this.deps.onError?.(e));
    return report;
  }

  private persist(report: ChildSafetyReport) {
    const snapshot = structuredClone(report);
    this.queue = this.queue.then(() => this.deps.store.save(snapshot)).catch((e) => this.deps.onError?.(e));
  }
}
