/**
 * Friends. Players find each other by a private friend code that a player shares themselves. There is no name search, so a stranger
 * cannot look children up. Only players who may chat can have friends (a child still waiting for a parent's consent cannot).
 */
import { randomInt } from 'node:crypto';
import type { Pool } from 'pg';
import type { BlockList } from '../blocks';
import type { Cosmetics } from '../economy/catalog';
import { mayChat } from '../auth/policy';
import type { AccountStore } from '../auth/store';

export const MAX_FRIENDS = 100;
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O or 1/I
export const makeCode = (pick: (n: number) => number = randomInt) => Array.from({ length: 8 }, () => CODE_ALPHABET[pick(CODE_ALPHABET.length)]).join('');
export const normalizeCode = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '');

export interface Edge {
  status: 'pending' | 'accepted';
  requestedBy: string;
}

export interface FriendStore {
  /** The player's code, making one if they have none. */
  codeFor(userId: string, fresh: () => string): Promise<string>;
  resetCode(userId: string, fresh: () => string): Promise<string>;
  userByCode(code: string): Promise<string | null>;
  edge(a: string, b: string): Promise<Edge | null>;
  /** False if the pair already has a row. */
  createRequest(from: string, to: string, at: number): Promise<boolean>;
  accept(a: string, b: string, at: number): Promise<void>;
  remove(a: string, b: string): Promise<void>;
  friendsOf(userId: string): Promise<string[]>;
  incoming(userId: string): Promise<string[]>;
  outgoing(userId: string): Promise<string[]>;
  eraseUser(userId: string): Promise<void>;
}

const pair = (a: string, b: string): [string, string] => (a < b ? [a, b] : [b, a]);

export class MemoryFriendStore implements FriendStore {
  readonly codes = new Map<string, string>();
  readonly edges = new Map<string, Edge & { low: string; high: string }>();
  private key = (a: string, b: string) => pair(a, b).join('|');

  async codeFor(userId: string, fresh: () => string) {
    let c = this.codes.get(userId);
    if (!c) {
      do c = fresh();
      while ([...this.codes.values()].includes(c));
      this.codes.set(userId, c);
    }
    return c;
  }
  async resetCode(userId: string, fresh: () => string) {
    this.codes.delete(userId);
    return this.codeFor(userId, fresh);
  }
  async userByCode(code: string) {
    return [...this.codes].find(([, c]) => c === code)?.[0] ?? null;
  }
  async edge(a: string, b: string) {
    const e = this.edges.get(this.key(a, b));
    return e ? { status: e.status, requestedBy: e.requestedBy } : null;
  }
  async createRequest(from: string, to: string) {
    const k = this.key(from, to);
    if (this.edges.has(k)) return false;
    const [low, high] = pair(from, to);
    this.edges.set(k, { low, high, requestedBy: from, status: 'pending' });
    return true;
  }
  async accept(a: string, b: string) {
    const e = this.edges.get(this.key(a, b));
    if (e) e.status = 'accepted';
  }
  async remove(a: string, b: string) {
    this.edges.delete(this.key(a, b));
  }
  private other(e: { low: string; high: string }, me: string) {
    return e.low === me ? e.high : e.low;
  }
  async friendsOf(userId: string) {
    return [...this.edges.values()].filter((e) => e.status === 'accepted' && (e.low === userId || e.high === userId)).map((e) => this.other(e, userId));
  }
  async incoming(userId: string) {
    return [...this.edges.values()].filter((e) => e.status === 'pending' && e.requestedBy !== userId && (e.low === userId || e.high === userId)).map((e) => this.other(e, userId));
  }
  async outgoing(userId: string) {
    return [...this.edges.values()].filter((e) => e.status === 'pending' && e.requestedBy === userId).map((e) => this.other(e, userId));
  }
  async eraseUser(userId: string) {
    this.codes.delete(userId);
    for (const [k, e] of this.edges) if (e.low === userId || e.high === userId) this.edges.delete(k);
  }
}

/** Needs db/migrations/103_friends.sql. */
export class PostgresFriendStore implements FriendStore {
  constructor(private pool: Pick<Pool, 'query'>) {}

  async codeFor(userId: string, fresh: () => string) {
    for (let i = 0; i < 5; i++) {
      const { rows } = await this.pool.query('select code from friend_codes where user_id = $1', [userId]);
      if (rows[0]) return rows[0].code as string;
      await this.pool.query('insert into friend_codes (user_id, code) values ($1,$2) on conflict do nothing', [userId, fresh()]).catch(() => undefined); // a clash with someone else's code: try again
    }
    throw new Error('could not make a friend code');
  }
  async resetCode(userId: string, fresh: () => string) {
    await this.pool.query('delete from friend_codes where user_id = $1', [userId]);
    return this.codeFor(userId, fresh);
  }
  async userByCode(code: string) {
    const { rows } = await this.pool.query('select user_id from friend_codes where code = $1', [code]);
    return rows[0] ? (rows[0].user_id as string) : null;
  }
  async edge(a: string, b: string) {
    const [low, high] = pair(a, b);
    const { rows } = await this.pool.query('select status, requested_by from friendships where low_id = $1 and high_id = $2', [low, high]);
    return rows[0] ? { status: rows[0].status as Edge['status'], requestedBy: rows[0].requested_by as string } : null;
  }
  async createRequest(from: string, to: string, at: number) {
    const [low, high] = pair(from, to);
    const { rowCount } = await this.pool.query("insert into friendships (low_id, high_id, requested_by, status, created_at, updated_at) values ($1,$2,$3,'pending',$4,$4) on conflict do nothing", [low, high, from, at]);
    return rowCount === 1;
  }
  async accept(a: string, b: string, at: number) {
    const [low, high] = pair(a, b);
    await this.pool.query("update friendships set status = 'accepted', updated_at = $3 where low_id = $1 and high_id = $2", [low, high, at]);
  }
  async remove(a: string, b: string) {
    const [low, high] = pair(a, b);
    await this.pool.query('delete from friendships where low_id = $1 and high_id = $2', [low, high]);
  }
  private async others(sql: string, userId: string) {
    const { rows } = await this.pool.query(sql, [userId]);
    return rows.map((r) => r.other as string);
  }
  friendsOf(userId: string) {
    return this.others("select case when low_id = $1 then high_id else low_id end as other from friendships where status = 'accepted' and (low_id = $1 or high_id = $1)", userId);
  }
  incoming(userId: string) {
    return this.others("select case when low_id = $1 then high_id else low_id end as other from friendships where status = 'pending' and requested_by <> $1 and (low_id = $1 or high_id = $1)", userId);
  }
  outgoing(userId: string) {
    return this.others("select case when low_id = $1 then high_id else low_id end as other from friendships where status = 'pending' and requested_by = $1", userId);
  }
  async eraseUser(userId: string) {
    await this.pool.query('delete from friendships where low_id = $1 or high_id = $1', [userId]);
    await this.pool.query('delete from friend_codes where user_id = $1', [userId]);
  }
}

export interface FriendSummary {
  userId: string;
  name: string;
  online: boolean;
  cosmetics?: Cosmetics;
}
export type RequestResult =
  | { ok: true; state: 'sent' | 'accepted' }
  | { ok: false; reason: 'not_allowed' | 'unknown_code' | 'self' | 'already_friends' | 'already_requested' | 'blocked_by_you' | 'limit' };

export interface FriendsDeps {
  store: FriendStore;
  accounts: AccountStore;
  blocks: Pick<BlockList, 'isBlocked'>;
  now: () => number;
  online: (userId: string) => boolean;
  cosmetics?: (userId: string) => Cosmetics | undefined;
  makeCode?: () => string;
}

export class FriendsService {
  constructor(private d: FriendsDeps) {}
  private code = () => (this.d.makeCode ? this.d.makeCode() : makeCode());

  /** Only players who may chat can use friends; the rule that keeps a waiting child out of social features. */
  async eligible(userId: string): Promise<boolean> {
    const p = await this.d.accounts.getProfile(userId);
    return !!p && p.deletedAt === null && mayChat(p.consentStatus);
  }

  async myCode(userId: string): Promise<string | null> {
    return (await this.eligible(userId)) ? this.d.store.codeFor(userId, this.code) : null;
  }
  async resetCode(userId: string): Promise<string | null> {
    return (await this.eligible(userId)) ? this.d.store.resetCode(userId, this.code) : null;
  }

  async request(from: string, rawCode: string): Promise<RequestResult> {
    if (!(await this.eligible(from))) return { ok: false, reason: 'not_allowed' };
    const target = await this.d.store.userByCode(normalizeCode(rawCode));
    // An unknown code, a deleted account, and a child who cannot use friends all look the same.
    if (!target || !(await this.eligible(target))) return { ok: false, reason: 'unknown_code' };
    if (target === from) return { ok: false, reason: 'self' };
    if (this.d.blocks.isBlocked(from, target)) return { ok: false, reason: 'blocked_by_you' };
    const edge = await this.d.store.edge(from, target);
    if (edge?.status === 'accepted') return { ok: false, reason: 'already_friends' };
    if (edge?.status === 'pending') {
      if (edge.requestedBy === from) return { ok: false, reason: 'already_requested' };
      await this.accept(from, target); // they had asked first: asking back is saying yes
      return { ok: true, state: 'accepted' };
    }
    if ((await this.d.store.friendsOf(from)).length >= MAX_FRIENDS) return { ok: false, reason: 'limit' };
    // If they blocked you, it looks like it worked and nothing reaches them.
    if (this.d.blocks.isBlocked(target, from)) return { ok: true, state: 'sent' };
    await this.d.store.createRequest(from, target, this.d.now());
    return { ok: true, state: 'sent' };
  }

  async accept(userId: string, otherId: string): Promise<boolean> {
    const edge = await this.d.store.edge(userId, otherId);
    if (!edge || edge.status !== 'pending' || edge.requestedBy === userId) return false;
    if (!(await this.eligible(userId)) || !(await this.eligible(otherId))) return false;
    if ((await this.d.store.friendsOf(userId)).length >= MAX_FRIENDS) return false;
    await this.d.store.accept(userId, otherId, this.d.now());
    return true;
  }

  /** Decline a request, cancel your own, or end a friendship. */
  async remove(userId: string, otherId: string): Promise<void> {
    await this.d.store.remove(userId, otherId);
  }

  async areFriends(a: string, b: string): Promise<boolean> {
    return (await this.d.store.edge(a, b))?.status === 'accepted';
  }

  private async named(ids: string[], withPresence: boolean): Promise<FriendSummary[]> {
    const out: FriendSummary[] = [];
    for (const id of ids) {
      const p = await this.d.accounts.getProfile(id);
      if (!p || p.deletedAt !== null) continue;
      out.push({ userId: id, name: p.nickname, online: withPresence && this.d.online(id), cosmetics: this.d.cosmetics?.(id) });
    }
    return out.sort((x, y) => Number(y.online) - Number(x.online) || x.name.localeCompare(y.name));
  }

  async list(userId: string) {
    if (!(await this.eligible(userId))) return null;
    const [friends, incoming, outgoing] = await Promise.all([this.d.store.friendsOf(userId), this.d.store.incoming(userId), this.d.store.outgoing(userId)]);
    // A person who blocked you never shows up, and a request from someone you blocked is hidden.
    const visibleIncoming = incoming.filter((id) => !this.d.blocks.isBlocked(userId, id));
    return { friends: await this.named(friends, true), incoming: await this.named(visibleIncoming, false), outgoing: await this.named(outgoing, false) };
  }

  async erase(userId: string) {
    await this.d.store.eraseUser(userId);
  }
}
