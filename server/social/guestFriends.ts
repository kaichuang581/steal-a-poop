import { createHmac } from 'node:crypto';

/**
 * Friends for guests (no account). The friend LIST lives in each guest's own browser; the server only carries the
 * mail between them and says who is online, and keeps nothing on disk: a request waits in memory for up to two weeks
 * (or until the server restarts).
 *
 * A guest's friend code is derived from their guest id with a server secret, so it is stable, can be given out freely,
 * and cannot be claimed by anyone who does not hold that id.
 */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no I, L, O, 0 or 1
const CODE_RE = /^[A-HJKMNP-Z2-9]{10}$/;

export const MAX_PENDING_PER_CODE = 30;
export const MAX_EVENTS_PER_CODE = 30;
export const MAX_PENDING_TOTAL = 5000;
export const KEEP_MS = 14 * 24 * 3600_000;
const PRUNE_EVERY_MS = 60_000;

/** A typed code in its plain form (upper case, no spaces or dashes), or null when it cannot be a code. */
export function normalizeCode(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.length > 40) return null;
  const c = raw.toUpperCase().replace(/[\s-]/g, '');
  return CODE_RE.test(c) ? c : null;
}

export interface GuestRef { userId: string; name: string }
export interface Friend { code: string; name: string }
export interface FriendEvent { kind: 'accepted' | 'removed'; code: string; name: string; at: number }
interface Pending { name: string; at: number }

export type RequestResult =
  | { ok: true; state: 'sent' }
  | { ok: true; state: 'accepted'; friend: Friend }
  | { ok: false; reason: 'bad_code' | 'self' | 'limit' };

export class GuestFriends {
  private readonly pending = new Map<string, Map<string, Pending>>(); // to code -> from code -> request
  private readonly events = new Map<string, FriendEvent[]>(); // to code -> things that happened to their list
  private pendingTotal = 0;
  private lastPrune = 0;

  constructor(private readonly opts: { secret: string; now?: () => number }) {}

  private now() { return (this.opts.now ?? Date.now)(); }

  codeFor(userId: string): string {
    const digest = createHmac('sha256', this.opts.secret).update(`friend-code:${userId}`).digest();
    let code = '';
    for (let i = 0; i < 10; i++) code += ALPHABET[digest[i] % ALPHABET.length];
    return code;
  }

  /** Asks `toCode` to be friends. If they had already asked, the two become friends at once. */
  request(from: GuestRef, rawCode: unknown): RequestResult {
    this.prune();
    const to = normalizeCode(rawCode);
    if (!to) return { ok: false, reason: 'bad_code' };
    const me = this.codeFor(from.userId);
    if (to === me) return { ok: false, reason: 'self' };
    const mine = this.pending.get(me);
    const theirAsk = mine?.get(to);
    if (theirAsk) {
      // They asked me first: asking back is saying yes.
      this.dropPending(me, to);
      this.pushEvent(to, { kind: 'accepted', code: me, name: from.name, at: this.now() });
      return { ok: true, state: 'accepted', friend: { code: to, name: theirAsk.name } };
    }
    const queue = this.pending.get(to) ?? new Map<string, Pending>();
    if (!queue.has(me) && (queue.size >= MAX_PENDING_PER_CODE || this.pendingTotal >= MAX_PENDING_TOTAL)) return { ok: false, reason: 'limit' };
    if (!queue.has(me)) this.pendingTotal += 1;
    queue.set(me, { name: from.name, at: this.now() });
    this.pending.set(to, queue);
    return { ok: true, state: 'sent' };
  }

  /** What is waiting for this guest: requests to answer, and what happened to their list since they last looked. */
  inbox(userId: string): { code: string; requests: Friend[]; events: FriendEvent[] } {
    this.prune();
    const code = this.codeFor(userId);
    const requests = [...(this.pending.get(code) ?? [])].map(([from, p]) => ({ code: from, name: p.name }));
    const events = this.events.get(code) ?? [];
    this.events.delete(code); // delivered once: the browser keeps the result
    return { code, requests, events };
  }

  /** Says yes to a waiting request. Returns the new friend, or null when no such request is waiting. */
  accept(me: GuestRef, rawFrom: unknown): Friend | null {
    const from = normalizeCode(rawFrom);
    if (!from) return null;
    const mine = this.codeFor(me.userId);
    const ask = this.pending.get(mine)?.get(from);
    if (!ask) return null;
    this.dropPending(mine, from);
    this.pushEvent(from, { kind: 'accepted', code: mine, name: me.name, at: this.now() });
    return { code: from, name: ask.name };
  }

  /** Says no to a waiting request. The asker is not told. */
  decline(userId: string, rawFrom: unknown): void {
    const from = normalizeCode(rawFrom);
    if (from) this.dropPending(this.codeFor(userId), from);
  }

  /** Ends a friendship: the other browser is told so it can take this one off its list too. */
  remove(me: GuestRef, rawOther: unknown): void {
    const other = normalizeCode(rawOther);
    if (!other) return;
    const mine = this.codeFor(me.userId);
    if (other === mine) return;
    this.dropPending(mine, other); // also cancels a request either way
    this.dropPending(other, mine);
    this.pushEvent(other, { kind: 'removed', code: mine, name: me.name, at: this.now() });
  }

  /** Which of these codes belong to a guest who is connected right now, and under what name. */
  status(rawCodes: unknown, online: readonly GuestRef[]): Array<{ code: string; online: boolean; name?: string }> {
    const wanted = Array.isArray(rawCodes) ? rawCodes.slice(0, 100).map(normalizeCode).filter((c): c is string => !!c) : [];
    if (!wanted.length) return [];
    const here = new Map<string, string>();
    for (const g of online) here.set(this.codeFor(g.userId), g.name);
    return wanted.map((code) => (here.has(code) ? { code, online: true, name: here.get(code) } : { code, online: false }));
  }

  private dropPending(toCode: string, fromCode: string) {
    const q = this.pending.get(toCode);
    if (!q || !q.delete(fromCode)) return;
    this.pendingTotal -= 1;
    if (!q.size) this.pending.delete(toCode);
  }

  private pushEvent(toCode: string, e: FriendEvent) {
    const list = this.events.get(toCode) ?? [];
    list.push(e);
    if (list.length > MAX_EVENTS_PER_CODE) list.shift();
    this.events.set(toCode, list);
  }

  private prune() {
    const t = this.now();
    if (t - this.lastPrune < PRUNE_EVERY_MS) return;
    this.lastPrune = t;
    for (const [to, q] of this.pending) {
      for (const [from, p] of q) if (t - p.at > KEEP_MS) this.dropPending(to, from);
    }
    for (const [to, list] of this.events) {
      const fresh = list.filter((e) => t - e.at <= KEEP_MS);
      if (fresh.length) this.events.set(to, fresh);
      else this.events.delete(to);
    }
  }
}
