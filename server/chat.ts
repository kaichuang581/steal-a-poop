import { ChatFilter, childSafetySignal, emptyBuffer, pushBuffer } from './filter';
import type { SpellBuffer } from './filter';
import { resolveConfig, suspensionFor } from './moderation/config';
import type { ModerationConfig } from './moderation/config';
import type { ModerationStatus } from '../src/net/protocol';
import type { AuditEntry, AuditLog } from './moderation/audit';
import type { ModerationStore } from './moderation/store';
import { RateLimiter } from './ratelimit';

export type Category = 'blocked_word' | 'child_safety' | 'player_report' | 'appeal';
export type Verdict = 'clear' | 'suspend' | 'ban' | 'escalate';
export type ItemStatus = 'pending' | 'reviewed' | 'human';

/** One thing a reviewer must look at. Kept as evidence and never deleted. */
export interface ReviewItem {
  id: number;
  at: number;
  userId: string;
  roomCode: string;
  text: string;
  category: Category;
  /** What the filter matched, for a held message. */
  term?: string;
  reportedBy?: string;
  /** Child-safety items must go to NCMEC (or the local equivalent) after a person confirms. */
  mustReport: boolean;
  status: ItemStatus;
  verdict?: Verdict;
  reason?: string;
  /** The messages sent in the room just before a held message, so a reviewer sees what led to it. */
  context?: ChatMessage[];
  /** What the automatic reviewer thought, kept when a person makes the final call. */
  opinion?: { verdict: Verdict; reason: string };
  /** Who made the final call, and when. Set only by a person. */
  decidedBy?: string;
  decidedAt?: number;
}

export interface Reviewer {
  review(item: ReviewItem): Promise<{ verdict: Verdict; reason: string }>;
}

/** Where child-safety items are recorded for the reporting process. See docs/MODERATION.md. */
export interface ChildSafetySink {
  record(item: ReviewItem): void;
}

export interface ChatMessage {
  id: number;
  roomCode: string;
  userId: string;
  name: string;
  text: string;
  at: number;
}

export type SubmitResult =
  | { delivered: true; message: ChatMessage }
  | { delivered: false; reason: 'empty' | 'too_long' | 'rate_limited'; retryAfterMs?: number }
  | { delivered: false; reason: 'banned' }
  | { delivered: false; reason: 'suspended'; until: number }
  | { delivered: false; reason: 'blocked'; until: number };

export type PlayerModerationStatus = ModerationStatus;

export interface ChatDeps {
  now: () => number;
  filter: ChatFilter;
  reviewer?: Reviewer;
  sink?: ChildSafetySink;
  /** How long a violation suspends the sender before review. Default 24 hours. Shortcut for config.suspendMs. */
  suspendMs?: number;
  /** Tiers, graduated lengths and the allowlist. Defaults: every match suspends for 24 hours. */
  config?: Partial<ModerationConfig>;
  maxLength?: number;
  /** Where state is kept between restarts. Without one, state lives only in memory. */
  store?: ModerationStore;
  /** Append-only record of who did what. Failures are counted like store failures and never break chat. */
  audit?: AuditLog;
  /** Told when a write to the store fails. The failure never reaches the chat path. */
  onPersistError?: (error: unknown) => void;
}

export const DEFAULT_SUSPEND_MS = 24 * 60 * 60 * 1000;
const HISTORY_PER_ROOM = 50;
const CONTEXT_MESSAGES = 20;
const SPELL_WINDOW_MS = 30_000;

export class ChatService {
  private nextId = 1;
  private nextItemId = 1;
  private persistQueue: Promise<void> = Promise.resolve();
  /** Writes that failed. If this is above zero, the store is behind the in-memory state. */
  persistFailures = 0;
  private suspended = new Map<string, number>();
  private banned = new Set<string>();
  private items: ReviewItem[] = [];
  private history = new Map<string, ChatMessage[]>();
  private buffers = new Map<string, { buffer: SpellBuffer; at: number }>();
  private chatLimit = new RateLimiter(5, 10_000);
  private reportLimit = new RateLimiter(5, 60_000);
  private listeners = new Set<(userId: string) => void>();

  constructor(private deps: ChatDeps) {}

  /** Restores suspensions, bans and the review queue from the store. Call once at startup. */
  async load(): Promise<void> {
    const store = this.deps.store;
    if (!store) return;
    const [standings, items] = await Promise.all([store.loadStandings(), store.loadItems()]);
    const now = this.deps.now();
    for (const [userId, s] of standings) {
      if (s.banned) this.banned.add(userId);
      if (s.suspendedUntil && s.suspendedUntil > now) this.suspended.set(userId, s.suspendedUntil);
    }
    this.items = items;
    this.nextItemId = items.reduce((max, i) => Math.max(max, i.id), 0) + 1;
  }

  /** Drops rate-limit and spelling-buffer entries nobody needs any more. Call now and then. */
  prune(): void {
    const now = this.deps.now();
    this.chatLimit.prune(now);
    this.reportLimit.prune(now);
    for (const [id, b] of this.buffers) if (now - b.at > SPELL_WINDOW_MS) this.buffers.delete(id);
  }

  /** Told whenever something about a player's case changes (held, decided, appealed). Returns an unsubscribe. */
  onChange(listener: (userId: string) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  private changed(userId: string) {
    for (const l of this.listeners) {
      try {
        l(userId);
      } catch {
        /* a broken listener must not break moderation */
      }
    }
  }

  /** Waits for every pending write. Call before shutting down, and in tests. */
  async flush(): Promise<void> {
    await this.persistQueue;
  }

  private record(entry: Omit<AuditEntry, 'at'>) {
    const audit = this.deps.audit;
    if (!audit) return;
    const full = { ...entry, at: this.deps.now() };
    this.persistQueue = this.persistQueue
      .then(() => audit.record(full))
      .catch((error) => {
        this.persistFailures += 1;
        this.deps.onPersistError?.(error);
      });
  }

  /** Writes happen one after another in the background, and a failure is counted, never thrown. */
  private persist(write: (store: ModerationStore) => Promise<void>) {
    const store = this.deps.store;
    if (!store) return;
    this.persistQueue = this.persistQueue
      .then(() => write(store))
      .catch((error) => {
        this.persistFailures += 1;
        this.deps.onPersistError?.(error);
      });
  }

  private persistStanding(userId: string) {
    const until = this.suspended.get(userId);
    const standing = { banned: this.banned.has(userId), suspendedUntil: until && until > this.deps.now() ? until : null };
    this.persist((store) => store.saveStanding(userId, standing));
  }

  private persistItem(item: ReviewItem) {
    const snapshot = structuredClone(item);
    this.persist((store) => store.saveItem(snapshot));
  }

  state(userId: string): { banned: boolean; suspendedUntil: number | null } {
    const until = this.suspended.get(userId);
    return { banned: this.banned.has(userId), suspendedUntil: until && until > this.deps.now() ? until : null };
  }

  /**
   * A message is checked before anyone sees it. If it is held, nobody receives it, the sender is
   * suspended at once, and the message goes to review.
   */
  submit(input: { userId: string; name: string; roomCode: string; text: string }): SubmitResult {
    const now = this.deps.now();
    const { userId, roomCode } = input;
    const text = input.text.trim();
    if (this.banned.has(userId)) return { delivered: false, reason: 'banned' };
    const until = this.suspended.get(userId);
    if (until && until > now) return { delivered: false, reason: 'suspended', until };
    if (!text) return { delivered: false, reason: 'empty' };
    if (text.length > (this.deps.maxLength ?? 200)) return { delivered: false, reason: 'too_long' };
    if (!this.chatLimit.allow(userId, now)) {
      return { delivered: false, reason: 'rate_limited', retryAfterMs: this.chatLimit.retryAfter(userId, now) };
    }

    // Letters typed one at a time across messages are joined before checking.
    const prev = this.buffers.get(userId);
    const fresh = prev && now - prev.at < SPELL_WINDOW_MS ? prev.buffer : emptyBuffer();
    const buffer = text.length <= 3 ? pushBuffer(fresh, text) : emptyBuffer();
    this.buffers.set(userId, { buffer, at: now });

    const hit = this.deps.filter.check(text) ?? (text.length <= 3 ? this.deps.filter.checkBuffer(buffer) : null);
    const childSafety = childSafetySignal(text);
    if (hit || childSafety) {
      const config = resolveConfig({ ...(this.deps.suspendMs !== undefined ? { suspendMs: this.deps.suspendMs } : {}), ...this.deps.config });
      // A child-safety signal is always treated as the most serious tier.
      const tier = childSafety ? 'severe' : (hit?.tier ?? 'standard');
      const prior = this.items.filter((i) => i.userId === userId && (i.category === 'blocked_word' || i.category === 'child_safety') && i.verdict !== 'clear').length;
      const heldUntil = now + suspensionFor(config, tier, prior);
      this.suspended.set(userId, heldUntil);
      this.persistStanding(userId);
      const item = this.addItem({
        userId, roomCode, text, at: now,
        context: (this.history.get(roomCode) ?? []).slice(-CONTEXT_MESSAGES),
        category: childSafety ? 'child_safety' : 'blocked_word',
        term: hit?.term, mustReport: childSafety, status: 'pending',
      });
      if (childSafety) this.deps.sink?.record(item);
      this.record({ actor: 'system', action: 'message_held', itemId: item.id, userId, details: { category: item.category, tier, suspendedUntil: heldUntil } });
      this.changed(userId);
      return { delivered: false, reason: 'blocked', until: heldUntil };
    }

    const message: ChatMessage = { id: this.nextId++, roomCode, userId, name: input.name, text, at: now };
    const list = this.history.get(roomCode) ?? [];
    list.push(message);
    if (list.length > HISTORY_PER_ROOM) list.shift();
    this.history.set(roomCode, list);
    return { delivered: true, message };
  }

  /** A player reports a message they saw. It is reviewed like a held message. */
  report(input: { reporterId: string; messageId: number; roomCode: string; note?: string }): { ok: boolean; reason?: string } {
    const now = this.deps.now();
    if (!this.reportLimit.allow(input.reporterId, now)) return { ok: false, reason: 'rate_limited' };
    const msg = (this.history.get(input.roomCode) ?? []).find((m) => m.id === input.messageId);
    if (!msg) return { ok: false, reason: 'message_not_found' };
    if (msg.userId === input.reporterId) return { ok: false, reason: 'cannot_report_yourself' };
    const childSafety = childSafetySignal(msg.text);
    const item = this.addItem({
      userId: msg.userId, roomCode: input.roomCode, text: msg.text, at: now, category: childSafety ? 'child_safety' : 'player_report',
      reportedBy: input.reporterId, mustReport: childSafety, status: 'pending', reason: input.note?.slice(0, 200),
    });
    if (childSafety) this.deps.sink?.record(item);
    this.record({ actor: input.reporterId, action: 'message_reported', itemId: item.id, userId: msg.userId, details: { category: item.category } });
    return { ok: true };
  }

  /** A suspended or banned player asks for a person to look again. */
  appeal(userId: string, note: string): { ok: boolean; reason?: string } {
    const s = this.state(userId);
    if (!s.banned && !s.suspendedUntil) return { ok: false, reason: 'nothing_to_appeal' };
    if (this.items.some((i) => i.userId === userId && i.category === 'appeal' && i.status === 'human')) {
      return { ok: false, reason: 'appeal_already_open' };
    }
    this.addItem({
      userId, roomCode: '', text: note.slice(0, 500), at: this.deps.now(), category: 'appeal', mustReport: false, status: 'human',
    });
    this.record({ actor: userId, action: 'appeal_filed', userId, details: {} });
    this.changed(userId);
    return { ok: true };
  }

  /** Sends every pending item to the reviewer. A reviewer failure never punishes anyone. */
  async processReviews(): Promise<void> {
    const reviewer = this.deps.reviewer;
    for (const item of this.items.filter((i) => i.status === 'pending')) {
      if (!reviewer) {
        item.status = 'human';
        this.persistItem(item);
        continue;
      }
      try {
        const { verdict, reason } = await reviewer.review(item);
        item.reason = reason;
        item.opinion = { verdict, reason };
        this.record({ actor: 'reviewer', action: 'reviewer_verdict', itemId: item.id, userId: item.userId, details: { verdict } });
        // Child-safety items always get a person, whatever the reviewer says.
        if (item.category === 'child_safety') {
          item.verdict = verdict;
          item.status = 'human';
          this.persistItem(item);
          continue;
        }
        this.apply(item, verdict);
      } catch {
        item.status = 'human';
        item.reason = 'review failed; needs a person';
        this.persistItem(item);
      }
    }
  }

  /**
   * A person's decision on an item waiting for a human. Only clear, suspend and ban are allowed.
   * `decidedBy` and the time are kept on the item, which is never deleted.
   */
  resolveByHuman(itemId: number, verdict: Verdict, reason: string, decidedBy = 'unknown'): boolean {
    if (verdict !== 'clear' && verdict !== 'suspend' && verdict !== 'ban') return false;
    const item = this.items.find((i) => i.id === itemId && i.status === 'human');
    if (!item) return false;
    const now = this.deps.now();
    item.reason = reason.slice(0, 500);
    item.decidedBy = decidedBy;
    item.decidedAt = now;
    if (verdict === 'suspend' && !this.state(item.userId).suspendedUntil) {
      const config = resolveConfig({ ...(this.deps.suspendMs !== undefined ? { suspendMs: this.deps.suspendMs } : {}), ...this.deps.config });
      this.suspended.set(item.userId, now + config.suspendMs);
    }
    this.record({ actor: decidedBy, action: 'human_decision', itemId: item.id, userId: item.userId, details: { verdict, category: item.category, reason: item.reason ?? null } });
    this.apply(item, verdict);
    return true;
  }

  /** The player's own view of their case. */
  status(userId: string): PlayerModerationStatus {
    const mine = this.items.filter((i) => i.userId === userId);
    const open = mine.filter((i) => i.status !== 'reviewed');
    const held = [...mine].reverse().find((i) => i.category === 'blocked_word' || i.category === 'child_safety');
    const appeals = mine.filter((i) => i.category === 'appeal');
    const lastAppeal = appeals[appeals.length - 1];
    const decided = mine.filter((i) => i.status === 'reviewed' && i.verdict).sort((a, b) => (b.decidedAt ?? b.at) - (a.decidedAt ?? a.at))[0];
    return {
      ...this.state(userId),
      openItems: open.length,
      waitingSince: open.length ? Math.min(...open.map((i) => i.at)) : null,
      heldMessage: held ? { text: held.text, at: held.at } : null,
      appeal: !lastAppeal
        ? { state: 'none' }
        : lastAppeal.status === 'reviewed'
          ? { state: 'decided', note: lastAppeal.text, at: lastAppeal.at, verdict: lastAppeal.verdict, reason: lastAppeal.decidedBy ? lastAppeal.reason : undefined }
          : { state: 'open', note: lastAppeal.text, at: lastAppeal.at },
      lastDecision: decided
        ? { verdict: decided.verdict!, at: decided.decidedAt ?? decided.at, byPerson: !!decided.decidedBy, reason: decided.decidedBy ? decided.reason : undefined }
        : null,
    };
  }

  /** The item that has waited longest for a reviewer or a person, so nothing sits unseen. */
  oldestUnreviewed(): { id: number; at: number; ageMs: number; status: ItemStatus } | null {
    const open = this.items.filter((i) => i.status !== 'reviewed');
    if (!open.length) return null;
    const oldest = open.reduce((a, b) => (b.at < a.at ? b : a));
    return { id: oldest.id, at: oldest.at, ageMs: Math.max(0, this.deps.now() - oldest.at), status: oldest.status };
  }

  getItem(id: number): ReviewItem | undefined {
    return this.items.find((i) => i.id === id);
  }

  /** Everything a moderator needs to judge a person: current standing and every item about them. */
  userFile(userId: string): { userId: string; banned: boolean; suspendedUntil: number | null; items: ReviewItem[] } {
    return { userId, ...this.state(userId), items: this.items.filter((i) => i.userId === userId) };
  }

  queue(status?: ItemStatus): readonly ReviewItem[] {
    return status ? this.items.filter((i) => i.status === status) : this.items;
  }

  recentMessages(roomCode: string): readonly ChatMessage[] {
    return this.history.get(roomCode) ?? [];
  }

  private apply(item: ReviewItem, verdict: Verdict) {
    item.verdict = verdict;
    if (verdict === 'escalate') {
      item.status = 'human';
      this.persistItem(item);
      return;
    }
    item.status = 'reviewed';
    if (verdict === 'ban') {
      this.banned.add(item.userId);
      this.suspended.delete(item.userId);
    } else if (verdict === 'clear') {
      const stillOpen = this.items.some(
        (i) => i.userId === item.userId && i.id !== item.id && i.status !== 'reviewed' && i.category !== 'appeal',
      );
      // Winning an appeal restores the player outright. Otherwise standing is restored once nothing else is open.
      if (item.category === 'appeal' || !stillOpen) {
        if (this.suspended.has(item.userId) || this.banned.has(item.userId)) {
          this.record({ actor: item.decidedBy ?? 'reviewer', action: 'standing_restored', itemId: item.id, userId: item.userId, details: { wasBanned: this.banned.has(item.userId) } });
        }
        this.suspended.delete(item.userId);
        if (item.category === 'appeal') this.banned.delete(item.userId); // only an appeal can lift a ban
        // An appeal that is still open is moot once the player has been restored.
        for (const other of this.items) {
          if (other.userId === item.userId && other.id !== item.id && other.category === 'appeal' && other.status === 'human') {
            other.status = 'reviewed';
            other.verdict = 'clear';
            other.reason = 'standing already restored';
            this.persistItem(other);
          }
        }
      }
    }
    // 'suspend' keeps the suspension that is already in place.
    this.persistItem(item);
    this.persistStanding(item.userId);
    this.changed(item.userId);
  }

  private addItem(partial: Omit<ReviewItem, 'id'>): ReviewItem {
    const item: ReviewItem = { id: this.nextItemId++, ...partial };
    this.items.push(item);
    this.persistItem(item);
    const snapshot = structuredClone(item);
    this.persist((store) => store.saveEvidence(snapshot)); // evidence is captured when it happens, and kept
    return item;
  }
}
