/**
 * Watching the running server. A snapshot of numbers is taken every minute; if something is wrong a short message goes to a webhook
 * (Slack and Discord both accept one). Messages hold counts and ages only: never player names, ids or message text.
 */
export interface Snapshot {
  at: number;
  connections: number;
  maxConnections: number;
  rooms: number;
  players: number;
  memoryMb: number;
  databaseOk: boolean | null; // null: no database configured
  /** Ages in milliseconds, or null when nothing is waiting. */
  oldestModerationItemMs: number | null;
  oldestChildSafetyItemMs: number | null;
  moderationWriteFailures: number;
  reviewer: null | { calls: number; escalated: number; capped: number; failures: number; tokensIn: number; tokensOut: number; estimatedCostUsd: number };
}

export interface AlertConfig {
  /** A moderation item waiting longer than this (default 2 hours) is a problem. */
  queueMs: number;
  /** A child-safety item waiting longer than this (default 30 minutes) is urgent. */
  childSafetyMs: number;
  connectionsFraction: number;
  memoryMb: number;
}
export const DEFAULT_ALERTS: AlertConfig = { queueMs: 2 * 3600_000, childSafetyMs: 30 * 60_000, connectionsFraction: 0.8, memoryMb: 420 };

export interface Alert {
  /** Stable name; an alert with the same key is not repeated until it clears or the cooldown passes. */
  key: string;
  text: string;
}

const mins = (ms: number) => (ms >= 3600_000 ? `${(ms / 3600_000).toFixed(1)} hours` : `${Math.round(ms / 60_000)} minutes`);

/** What is wrong right now. `previous` lets counters that only matter when they grow (failures) raise an alert once. */
export function evaluate(s: Snapshot, previous: Snapshot | null, cfg: AlertConfig = DEFAULT_ALERTS): Alert[] {
  const out: Alert[] = [];
  if (s.oldestChildSafetyItemMs !== null && s.oldestChildSafetyItemMs > cfg.childSafetyMs) {
    out.push({ key: 'child_safety_waiting', text: `URGENT: a child-safety item has waited ${mins(s.oldestChildSafetyItemMs)} for a person.` });
  }
  if (s.oldestModerationItemMs !== null && s.oldestModerationItemMs > cfg.queueMs) {
    out.push({ key: 'queue_stuck', text: `The moderation queue has an item waiting ${mins(s.oldestModerationItemMs)} (limit ${mins(cfg.queueMs)}).` });
  }
  if (s.databaseOk === false) out.push({ key: 'database_down', text: 'The database is not answering. Moderation and accounts are not being saved.' });
  if (previous && s.moderationWriteFailures > previous.moderationWriteFailures) {
    out.push({ key: 'write_failures', text: `${s.moderationWriteFailures - previous.moderationWriteFailures} moderation write(s) failed in the last minute. The in-memory state is ahead of the database.` });
  }
  if (s.reviewer && previous?.reviewer && s.reviewer.capped > previous.reviewer.capped) {
    out.push({ key: 'reviewer_capped', text: 'The automatic reviewer hit its daily limit. Every held message now waits for a person until midnight UTC.' });
  }
  if (s.reviewer && previous?.reviewer && s.reviewer.failures - previous.reviewer.failures >= 5) {
    out.push({ key: 'reviewer_failing', text: `The automatic reviewer failed ${s.reviewer.failures - previous.reviewer.failures} times in a minute. Held messages are going to a person.` });
  }
  if (s.maxConnections > 0 && s.connections >= s.maxConnections * cfg.connectionsFraction) {
    out.push({ key: 'connections_high', text: `${s.connections} of ${s.maxConnections} connections are in use.` });
  }
  if (s.memoryMb > cfg.memoryMb) out.push({ key: 'memory_high', text: `The server is using ${Math.round(s.memoryMb)} MB of memory (limit ${cfg.memoryMb} MB).` });
  return out;
}

export interface Sender {
  send(text: string): Promise<void>;
}

/** Slack and Discord incoming webhooks. Slack reads "text", Discord reads "content"; both are sent. */
export class WebhookSender implements Sender {
  constructor(private opts: { url: string; fetchImpl?: typeof fetch; timeoutMs?: number }) {}
  async send(text: string) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), this.opts.timeoutMs ?? 5000);
    try {
      const res = await (this.opts.fetchImpl ?? fetch)(this.opts.url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text, content: text }), signal: ctl.signal });
      if (!res.ok) throw new Error(`webhook answered ${res.status}`);
    } finally {
      clearTimeout(timer);
    }
  }
}

/** Takes a snapshot on a timer, sends new alerts, repeats a still-firing one only after the cooldown, and says when one clears. */
export class AlertMonitor {
  private previous: Snapshot | null = null;
  private firing = new Map<string, number>(); // key -> when it was last sent
  failures = 0;

  constructor(
    private d: { snapshot: () => Promise<Snapshot>; sender: Sender; cfg?: AlertConfig; cooldownMs?: number; now?: () => number; log?: (line: string) => void },
  ) {}

  async tick(): Promise<Alert[]> {
    const now = (this.d.now ?? Date.now)();
    const snap = await this.d.snapshot();
    const alerts = evaluate(snap, this.previous, this.d.cfg);
    this.previous = snap;
    const cooldown = this.d.cooldownMs ?? 30 * 60_000;
    const keys = new Set(alerts.map((a) => a.key));
    const outgoing: string[] = [];
    for (const a of alerts) {
      const last = this.firing.get(a.key);
      if (last === undefined || now - last >= cooldown) {
        this.firing.set(a.key, now);
        outgoing.push(`⚠️ ${a.text}`);
      }
    }
    for (const key of [...this.firing.keys()]) {
      if (!keys.has(key)) {
        this.firing.delete(key);
        outgoing.push(`✅ Cleared: ${key.replace(/_/g, ' ')}.`);
      }
    }
    for (const text of outgoing) {
      try {
        await this.d.sender.send(text);
      } catch {
        this.failures += 1;
        this.d.log?.('alert could not be sent');
      }
    }
    return alerts;
  }

  start(everyMs = 60_000): () => void {
    const t = setInterval(() => void this.tick().catch(() => this.d.log?.('alert check failed')), everyMs);
    t.unref();
    return () => clearInterval(t);
  }
}
