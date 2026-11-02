import type { Pool } from 'pg';
import type { ConsentStatus } from './policy';

export interface Profile {
  userId: string;
  nickname: string;
  emailHash: string;
  dateOfBirth: string | null;
  country: string | null;
  consentStatus: ConsentStatus;
  /** Shown on public leaderboards. Starts off for anyone who needed a parent's consent. */
  leaderboardVisible: boolean;
  isModerator: boolean;
  sessionsValidAfter: number;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

export interface ConsentRecord {
  id: string;
  childUserId: string;
  parentEmail: string;
  requestTokenHash: string;
  manageTokenHash: string | null;
  policyVersion: string;
  noticeHash: string;
  method: 'email_link';
  requestedAt: number;
  expiresAt: number;
  decidedAt: number | null;
  decision: 'granted' | 'refused' | 'withdrawn' | null;
}

export interface BannedIdentity {
  identityHash: string;
  reason: string;
  bannedAt: number;
  sourceUserId: string;
}

/** Where accounts live. The game server reads and writes through this; the browser never touches it. */
export interface AccountStore {
  getProfile(userId: string): Promise<Profile | null>;
  /** False if a profile already exists for this user. */
  createProfile(p: Profile): Promise<boolean>;
  updateProfile(userId: string, patch: Partial<Omit<Profile, 'userId'>>): Promise<void>;
  /** Case-insensitive, among accounts that are not deleted. */
  nicknameTaken(nickname: string): Promise<boolean>;
  /** Removes personal fields. The row stays so game history keeps a stable id. */
  anonymizeProfile(userId: string, now: number): Promise<void>;

  saveConsent(c: ConsentRecord): Promise<void>;
  consentByRequestHash(hash: string): Promise<ConsentRecord | null>;
  consentByManageHash(hash: string): Promise<ConsentRecord | null>;
  consentsForChild(userId: string): Promise<ConsentRecord[]>;

  addBannedIdentity(b: BannedIdentity): Promise<void>;
  isBannedIdentity(hash: string): Promise<boolean>;

  revokeSession(sessionId: string, userId: string, now: number, expiresAt: number): Promise<void>;
  isSessionRevoked(sessionId: string): Promise<boolean>;
  purgeRevokedSessions(now: number): Promise<number>;
}

export const DELETED_NICKNAME = 'Deleted player';

export class MemoryAccountStore implements AccountStore {
  readonly profiles = new Map<string, Profile>();
  readonly consents = new Map<string, ConsentRecord>();
  readonly banned = new Map<string, BannedIdentity>();
  readonly revoked = new Map<string, { userId: string; expiresAt: number }>();

  async getProfile(userId: string) {
    const p = this.profiles.get(userId);
    return p ? { ...p } : null;
  }
  async createProfile(p: Profile) {
    if (this.profiles.has(p.userId)) return false;
    this.profiles.set(p.userId, { ...p });
    return true;
  }
  async updateProfile(userId: string, patch: Partial<Omit<Profile, 'userId'>>) {
    const cur = this.profiles.get(userId);
    if (cur) this.profiles.set(userId, { ...cur, ...patch });
  }
  async nicknameTaken(nickname: string) {
    const n = nickname.toLowerCase();
    return [...this.profiles.values()].some((p) => p.deletedAt === null && p.nickname.toLowerCase() === n);
  }
  async anonymizeProfile(userId: string, now: number) {
    const cur = this.profiles.get(userId);
    if (!cur) return;
    this.profiles.set(userId, { ...cur, nickname: DELETED_NICKNAME, dateOfBirth: null, country: null, emailHash: '', isModerator: false, deletedAt: now, updatedAt: now });
  }
  async saveConsent(c: ConsentRecord) {
    this.consents.set(c.id, structuredClone(c));
  }
  async consentByRequestHash(hash: string) {
    return structuredClone([...this.consents.values()].find((c) => c.requestTokenHash === hash) ?? null);
  }
  async consentByManageHash(hash: string) {
    return structuredClone([...this.consents.values()].find((c) => c.manageTokenHash === hash) ?? null);
  }
  async consentsForChild(userId: string) {
    return [...this.consents.values()].filter((c) => c.childUserId === userId).map((c) => structuredClone(c));
  }
  async addBannedIdentity(b: BannedIdentity) {
    if (!this.banned.has(b.identityHash)) this.banned.set(b.identityHash, { ...b });
  }
  async isBannedIdentity(hash: string) {
    return this.banned.has(hash);
  }
  async revokeSession(sessionId: string, userId: string, _now: number, expiresAt: number) {
    this.revoked.set(sessionId, { userId, expiresAt });
  }
  async isSessionRevoked(sessionId: string) {
    return this.revoked.has(sessionId);
  }
  async purgeRevokedSessions(now: number) {
    let n = 0;
    for (const [id, r] of this.revoked) if (r.expiresAt < now) (this.revoked.delete(id), n++);
    return n;
  }
}

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
const profileFrom = (r: Record<string, unknown>): Profile => ({
  userId: r.user_id as string,
  nickname: r.nickname as string,
  emailHash: r.email_hash as string,
  dateOfBirth: r.date_of_birth ? (r.date_of_birth instanceof Date ? r.date_of_birth.toISOString().slice(0, 10) : String(r.date_of_birth).slice(0, 10)) : null,
  country: (r.country as string | null) ?? null,
  consentStatus: r.consent_status as ConsentStatus,
  leaderboardVisible: r.leaderboard_visible as boolean,
  isModerator: r.is_moderator as boolean,
  sessionsValidAfter: Number(r.sessions_valid_after),
  createdAt: Number(r.created_at),
  updatedAt: Number(r.updated_at),
  deletedAt: num(r.deleted_at),
});
const consentFrom = (r: Record<string, unknown>): ConsentRecord => ({
  id: r.id as string,
  childUserId: r.child_user_id as string,
  parentEmail: r.parent_email as string,
  requestTokenHash: r.request_token_hash as string,
  manageTokenHash: (r.manage_token_hash as string | null) ?? null,
  policyVersion: r.policy_version as string,
  noticeHash: r.notice_hash as string,
  method: r.method as 'email_link',
  requestedAt: Number(r.requested_at),
  expiresAt: Number(r.expires_at),
  decidedAt: num(r.decided_at),
  decision: (r.decision as ConsentRecord['decision']) ?? null,
});

/** Needs db/migrations/100_accounts.sql. */
export class PostgresAccountStore implements AccountStore {
  constructor(private pool: Pick<Pool, 'query'>) {}

  async getProfile(userId: string) {
    const { rows } = await this.pool.query('select * from profiles where user_id = $1', [userId]);
    return rows[0] ? profileFrom(rows[0]) : null;
  }
  async createProfile(p: Profile) {
    const { rowCount } = await this.pool.query(
      `insert into profiles (user_id, nickname, email_hash, date_of_birth, country, consent_status, leaderboard_visible, is_moderator, sessions_valid_after, created_at, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) on conflict (user_id) do nothing`,
      [p.userId, p.nickname, p.emailHash, p.dateOfBirth, p.country, p.consentStatus, p.leaderboardVisible, p.isModerator, p.sessionsValidAfter, p.createdAt, p.updatedAt],
    );
    return rowCount === 1;
  }
  async updateProfile(userId: string, patch: Partial<Omit<Profile, 'userId'>>) {
    const cols: Record<string, string> = {
      nickname: 'nickname', emailHash: 'email_hash', dateOfBirth: 'date_of_birth', country: 'country', consentStatus: 'consent_status', leaderboardVisible: 'leaderboard_visible',
      isModerator: 'is_moderator', sessionsValidAfter: 'sessions_valid_after', updatedAt: 'updated_at', deletedAt: 'deleted_at',
    };
    const sets: string[] = [];
    const values: unknown[] = [];
    for (const [k, v] of Object.entries(patch)) {
      if (!(k in cols)) continue;
      values.push(v);
      sets.push(`${cols[k]} = $${values.length}`);
    }
    if (!sets.length) return;
    values.push(userId);
    await this.pool.query(`update profiles set ${sets.join(', ')} where user_id = $${values.length}`, values);
  }
  async nicknameTaken(nickname: string) {
    const { rows } = await this.pool.query('select 1 from profiles where lower(nickname) = lower($1) and deleted_at is null limit 1', [nickname]);
    return rows.length > 0;
  }
  async anonymizeProfile(userId: string, now: number) {
    await this.pool.query(
      `update profiles set nickname = $2, date_of_birth = null, country = null, email_hash = '', is_moderator = false, deleted_at = $3, updated_at = $3 where user_id = $1`,
      [userId, DELETED_NICKNAME, now],
    );
  }
  async saveConsent(c: ConsentRecord) {
    await this.pool.query(
      `insert into parental_consents (id, child_user_id, parent_email, request_token_hash, manage_token_hash, policy_version, notice_hash, method, requested_at, expires_at, decided_at, decision)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       on conflict (id) do update set manage_token_hash = excluded.manage_token_hash, decided_at = excluded.decided_at, decision = excluded.decision`,
      [c.id, c.childUserId, c.parentEmail, c.requestTokenHash, c.manageTokenHash, c.policyVersion, c.noticeHash, c.method, c.requestedAt, c.expiresAt, c.decidedAt, c.decision],
    );
  }
  async consentByRequestHash(hash: string) {
    const { rows } = await this.pool.query('select * from parental_consents where request_token_hash = $1', [hash]);
    return rows[0] ? consentFrom(rows[0]) : null;
  }
  async consentByManageHash(hash: string) {
    const { rows } = await this.pool.query('select * from parental_consents where manage_token_hash = $1', [hash]);
    return rows[0] ? consentFrom(rows[0]) : null;
  }
  async consentsForChild(userId: string) {
    const { rows } = await this.pool.query('select * from parental_consents where child_user_id = $1 order by requested_at', [userId]);
    return rows.map(consentFrom);
  }
  async addBannedIdentity(b: BannedIdentity) {
    await this.pool.query('insert into banned_identities (identity_hash, reason, banned_at, source_user_id) values ($1,$2,$3,$4) on conflict do nothing', [b.identityHash, b.reason, b.bannedAt, b.sourceUserId]);
  }
  async isBannedIdentity(hash: string) {
    const { rows } = await this.pool.query('select 1 from banned_identities where identity_hash = $1', [hash]);
    return rows.length > 0;
  }
  async revokeSession(sessionId: string, userId: string, now: number, expiresAt: number) {
    await this.pool.query('insert into revoked_sessions (session_id, user_id, revoked_at, expires_at) values ($1,$2,$3,$4) on conflict do nothing', [sessionId, userId, now, expiresAt]);
  }
  async isSessionRevoked(sessionId: string) {
    const { rows } = await this.pool.query('select 1 from revoked_sessions where session_id = $1', [sessionId]);
    return rows.length > 0;
  }
  async purgeRevokedSessions(now: number) {
    const { rowCount } = await this.pool.query('delete from revoked_sessions where expires_at < $1', [now]);
    return rowCount ?? 0;
  }
}
