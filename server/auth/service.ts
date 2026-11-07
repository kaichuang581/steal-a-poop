/**
 * Account logic: finishing sign-up (age, country, nickname, banned identities), parental consent, logging
 * out, and deleting an account. Sign-in itself (passwords, email verification, Google and Meta) is done by
 * Supabase Auth; this service only adds what the game needs on top of a verified login.
 */
import { randomBytes } from 'node:crypto';
import type { SessionClaims } from '../contracts';
import { ageOn, checkCountry, cleanNickname, identityHash, mayChat, needsParentalConsent, normalizeEmail, sha256 } from './policy';
import type { AgePolicy, ConsentStatus } from './policy';
import type { Mailer } from './mailer';
import type { RevocationBus } from './revocations';
import type { AccountStore, ConsentRecord, Profile } from './store';

/** Removes a user from the Supabase Auth system (their email and password). Needs the service key. */
export interface AuthAdmin {
  deleteUser(userId: string): Promise<void>;
}

/** Supabase's documented admin call: DELETE {url}/auth/v1/admin/users/{id}, authorised with the service key. */
export class SupabaseAuthAdmin implements AuthAdmin {
  constructor(private opts: { url: string; serviceKey: string; fetchImpl?: typeof fetch }) {}
  async deleteUser(userId: string) {
    const res = await (this.opts.fetchImpl ?? fetch)(`${this.opts.url}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
      method: 'DELETE',
      headers: { apikey: this.opts.serviceKey, authorization: `Bearer ${this.opts.serviceKey}` },
    });
    if (!res.ok && res.status !== 404) throw new Error(`auth admin delete failed: ${res.status}`); // 404 = already gone
  }
}

export const CONSENT_POLICY_VERSION = '2026-11-draft';
export const CONSENT_VALID_MS = 7 * 24 * 3600_000;
export const RECENT_SIGN_IN_MS = 10 * 60_000;

export interface AccountServiceDeps {
  store: AccountStore;
  now: () => number;
  /** Null means no mail can be sent: sign-ups that need a parent's consent are refused rather than left stuck. */
  mailer: Mailer | null;
  agePolicy: AgePolicy;
  /** True if this nickname may be used (the chat filter's rules). */
  nicknameAllowed: (nickname: string) => boolean;
  blocks: { removeAllBy(userId: string): Promise<void> };
  bus: RevocationBus;
  authAdmin?: AuthAdmin;
  /** The site address, used to build the link in the consent email, for example "https://example.org/steal-a-poop/". */
  appUrl: string;
  /** Other modules that hold a player's personal data (game results, friends) register their erasers here. */
  erasers?: ((userId: string) => Promise<void>)[];
  /** What the moderation system knows about a player right now. Used so deleting an account does not wipe a suspension. */
  standing?: (userId: string) => { suspendedUntil: number | null; openItems: number };
  /** How long an email stays held after its account was deleted with a moderation case still open. Default 7 days. */
  openCaseHoldMs?: number;
  log?: (line: string) => void;
  randomToken?: () => string;
}

export type CreateProfileInput = { nickname: string; dateOfBirth: string; country: string; parentEmail?: string };
export type CreateProfileFailure =
  | 'profile_exists' | 'email_required' | 'bad_nickname' | 'nickname_taken' | 'bad_dob' | 'bad_country' | 'country_not_supported'
  | 'identity_banned' | 'identity_restricted' | 'parent_email_required' | 'parent_email_invalid' | 'parent_email_same' | 'consent_unavailable';

export interface PublicProfile {
  nickname: string;
  leaderboardVisible: boolean;
  country: string | null;
  consentStatus: ConsentStatus;
  createdAt: number;
}
const publicOf = (p: Profile): PublicProfile => ({ nickname: p.nickname, leaderboardVisible: p.leaderboardVisible, country: p.country, consentStatus: p.consentStatus, createdAt: p.createdAt });

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;

/** The words a parent reads. The exact text (with the link removed) is hashed and kept as the record of what was shown. */
export function consentEmailBody(childNickname: string, link: string): string {
  return [
    `Your child asked to create an account on Steal a Poop, a free word game with multiplayer rooms and a chat.`,
    ``,
    `Nickname: ${childNickname}`,
    ``,
    `What an account allows: playing alone or with other players, chatting in rooms (every message is checked before anyone sees it), and storing game results.`,
    `What we keep: the nickname, the child's email address, date of birth and country, and game results. See the privacy policy on the website.`,
    ``,
    `Until you decide, the account can play but cannot chat, and results are not stored.`,
    `To decide, open this link (it works once and expires in 7 days):`,
    link,
    ``,
    `If you did not expect this, ignore this email or choose "Refuse" on the page and nothing will be kept.`,
  ].join('\n');
}

export class AccountService {
  constructor(private d: AccountServiceDeps) {}

  private token = () => (this.d.randomToken ? this.d.randomToken() : randomBytes(32).toString('base64url'));
  private log = (line: string) => this.d.log?.(`[accounts] ${line}`);

  // ---------------------------------------------------------------- sign-up

  /** Show or hide the player on public leaderboards. A player who needed a parent's consent cannot turn it on. */
  async setLeaderboardVisible(userId: string, visible: boolean): Promise<'ok' | 'not_allowed' | 'no_profile'> {
    const p = await this.d.store.getProfile(userId);
    if (!p || p.deletedAt !== null) return 'no_profile';
    if (visible && p.consentStatus !== 'not_required') return 'not_allowed';
    await this.d.store.updateProfile(userId, { leaderboardVisible: visible, updatedAt: this.d.now() });
    return 'ok';
  }

  async getProfile(userId: string): Promise<PublicProfile | null> {
    const p = await this.d.store.getProfile(userId);
    return p && p.deletedAt === null ? publicOf(p) : null;
  }

  async createProfile(claims: SessionClaims, input: CreateProfileInput): Promise<{ ok: true; profile: PublicProfile; mailed: boolean } | { ok: false; reason: CreateProfileFailure }> {
    const now = this.d.now();
    const fail = (reason: CreateProfileFailure) => ({ ok: false as const, reason });
    if (await this.d.store.getProfile(claims.userId)) return fail('profile_exists');
    if (!claims.email) return fail('email_required'); // needed to recognise a banned person; a provider that hides it cannot be used

    const nickname = cleanNickname(String(input.nickname ?? ''));
    if (!nickname || !this.d.nicknameAllowed(nickname)) return fail('bad_nickname');
    if (await this.d.store.nicknameTaken(nickname)) return fail('nickname_taken');

    const age = ageOn(String(input.dateOfBirth ?? ''), now);
    if (age === null) return fail('bad_dob');
    const country = checkCountry(String(input.country ?? ''), this.d.agePolicy);
    if (!country.ok) return fail(country.reason);

    const emailHash = identityHash(claims.email);
    if (await this.d.store.isBannedIdentity(emailHash)) return fail('identity_banned');
    if (await this.d.store.restrictedUntil(emailHash, now)) return fail('identity_restricted');

    const needsConsent = needsParentalConsent(age, country.consentAge);
    let parentEmail = '';
    if (needsConsent) {
      parentEmail = String(input.parentEmail ?? '').trim();
      if (!parentEmail) return fail('parent_email_required');
      if (!EMAIL.test(parentEmail)) return fail('parent_email_invalid');
      if (normalizeEmail(parentEmail) === normalizeEmail(claims.email)) return fail('parent_email_same'); // the child cannot be their own parent
      if (!this.d.mailer) return fail('consent_unavailable');
    }

    const profile: Profile = {
      userId: claims.userId, nickname, emailHash, dateOfBirth: String(input.dateOfBirth), country: country.country,
      consentStatus: needsConsent ? 'pending' : 'not_required', leaderboardVisible: !needsConsent, isModerator: false, sessionsValidAfter: 0, createdAt: now, updatedAt: now, deletedAt: null,
    };
    try {
      if (!(await this.d.store.createProfile(profile))) return fail('profile_exists'); // lost a race with ourselves
    } catch {
      return fail('nickname_taken'); // the database's unique nickname rule caught someone who picked the same name a moment earlier
    }

    let mailed = true;
    if (needsConsent) mailed = await this.requestConsent(profile, parentEmail);
    this.log(`profile created (${needsConsent ? 'consent pending' : 'no consent needed'})`);
    return { ok: true, profile: publicOf(profile), mailed };
  }

  /**
   * The simple sign-up: a username and nothing else. No date of birth, country or parent email is asked, so the
   * profile is `unconfirmed`: progress is kept, but chat, friends and the public boards stay off.
   */
  async createUsernameProfile(claims: SessionClaims, rawNickname: string): Promise<{ ok: true; profile: PublicProfile } | { ok: false; reason: CreateProfileFailure }> {
    const now = this.d.now();
    const fail = (reason: CreateProfileFailure) => ({ ok: false as const, reason });
    if (await this.d.store.getProfile(claims.userId)) return fail('profile_exists');
    if (!claims.email) return fail('email_required');
    const nickname = cleanNickname(String(rawNickname ?? ''));
    if (!nickname || !this.d.nicknameAllowed(nickname)) return fail('bad_nickname');
    if (await this.d.store.nicknameTaken(nickname)) return fail('nickname_taken');
    const emailHash = identityHash(claims.email);
    if (await this.d.store.isBannedIdentity(emailHash)) return fail('identity_banned');
    if (await this.d.store.restrictedUntil(emailHash, now)) return fail('identity_restricted');
    const profile: Profile = {
      userId: claims.userId, nickname, emailHash, dateOfBirth: null, country: null,
      consentStatus: 'unconfirmed', leaderboardVisible: false, isModerator: false, sessionsValidAfter: 0, createdAt: now, updatedAt: now, deletedAt: null,
    };
    try {
      if (!(await this.d.store.createProfile(profile))) return fail('profile_exists');
    } catch {
      return fail('nickname_taken');
    }
    this.log('profile created (username only)');
    return { ok: true, profile: publicOf(profile) };
  }

  // ---------------------------------------------------------------- parental consent

  private async requestConsent(child: Profile, parentEmail: string): Promise<boolean> {
    const now = this.d.now();
    const token = this.token();
    const link = `${this.d.appUrl}#/consent/${token}`;
    const noticeHash = sha256(consentEmailBody(child.nickname, '{link}'));
    const record: ConsentRecord = {
      id: `pc-${child.userId}-${now}`, childUserId: child.userId, parentEmail, requestTokenHash: sha256(token), manageTokenHash: null,
      policyVersion: CONSENT_POLICY_VERSION, noticeHash, method: 'email_link', requestedAt: now, expiresAt: now + CONSENT_VALID_MS, decidedAt: null, decision: null,
    };
    await this.d.store.saveConsent(record);
    try {
      await this.d.mailer!.send({ to: parentEmail, subject: 'Your child wants to play Steal a Poop', text: consentEmailBody(child.nickname, link) });
      return true;
    } catch {
      this.log('consent email failed to send');
      return false;
    }
  }

  /** A child whose consent email never arrived (or expired) asks for another. */
  async resendConsent(userId: string): Promise<{ ok: true; mailed: boolean } | { ok: false; reason: 'not_pending' | 'consent_unavailable' | 'no_request' }> {
    const profile = await this.d.store.getProfile(userId);
    if (!profile || profile.deletedAt !== null || profile.consentStatus !== 'pending') return { ok: false, reason: 'not_pending' };
    if (!this.d.mailer) return { ok: false, reason: 'consent_unavailable' };
    const last = (await this.d.store.consentsForChild(userId)).at(-1);
    if (!last) return { ok: false, reason: 'no_request' };
    return { ok: true, mailed: await this.requestConsent(profile, last.parentEmail) };
  }

  /** What the parent's page shows. Unknown tokens answer null so nobody can probe for valid ones. */
  async consentInfo(token: string): Promise<{ state: 'open' | 'expired' | 'granted' | 'refused' | 'withdrawn'; childNickname: string } | null> {
    const rec = await this.d.store.consentByRequestHash(sha256(token));
    if (!rec) return null;
    const child = await this.d.store.getProfile(rec.childUserId);
    if (!child || child.deletedAt !== null) return null;
    const state = rec.decision ?? (this.d.now() > rec.expiresAt ? 'expired' : 'open');
    return { state, childNickname: child.nickname };
  }

  async decideConsent(token: string, decision: 'grant' | 'refuse'): Promise<{ ok: true; state: 'granted' | 'refused' } | { ok: false; reason: 'unknown' | 'expired' | 'already_decided' }> {
    const rec = await this.d.store.consentByRequestHash(sha256(token));
    if (!rec) return { ok: false, reason: 'unknown' };
    const child = await this.d.store.getProfile(rec.childUserId);
    if (!child || child.deletedAt !== null) return { ok: false, reason: 'unknown' };
    if (rec.decision) return { ok: false, reason: 'already_decided' };
    const now = this.d.now();
    if (now > rec.expiresAt) return { ok: false, reason: 'expired' };

    rec.decidedAt = now;
    rec.decision = decision === 'grant' ? 'granted' : 'refused';
    let manageToken: string | null = null;
    if (decision === 'grant') {
      manageToken = this.token();
      rec.manageTokenHash = sha256(manageToken);
    }
    await this.d.store.saveConsent(rec);
    await this.d.store.updateProfile(child.userId, { consentStatus: decision === 'grant' ? 'granted' : 'refused', updatedAt: now });
    this.d.bus.emit(child.userId, null, 'status'); // open connections reconnect and pick up the new state

    if (manageToken && this.d.mailer) {
      await this.d.mailer.send({
        to: rec.parentEmail, subject: 'You allowed an account on Steal a Poop',
        text: `You gave consent for the account "${child.nickname}".\n\nTo withdraw consent at any time, open this link:\n${this.d.appUrl}#/consent/manage/${manageToken}\n\nWithdrawing stops chat and the storing of results straight away.`,
      }).catch(() => this.log('confirmation email failed to send'));
    }
    this.log(`consent ${rec.decision}`);
    return { ok: true, state: decision === 'grant' ? 'granted' : 'refused' };
  }

  async withdrawConsent(manageToken: string): Promise<{ ok: true } | { ok: false; reason: 'unknown' | 'not_granted' }> {
    const rec = await this.d.store.consentByManageHash(sha256(manageToken));
    if (!rec) return { ok: false, reason: 'unknown' };
    if (rec.decision !== 'granted') return { ok: false, reason: 'not_granted' };
    const now = this.d.now();
    rec.decision = 'withdrawn';
    rec.decidedAt = now;
    await this.d.store.saveConsent(rec);
    await this.d.store.updateProfile(rec.childUserId, { consentStatus: 'withdrawn', updatedAt: now });
    this.d.bus.emit(rec.childUserId, null, 'status');
    this.log('consent withdrawn');
    return { ok: true };
  }

  // ---------------------------------------------------------------- sessions

  /** Ends this login. The token stays cryptographically valid until it expires, so the server refuses it from now on. */
  async logout(claims: SessionClaims): Promise<void> {
    await this.d.store.revokeSession(claims.sessionId, claims.userId, this.d.now(), claims.expiresAt + 60_000);
    this.d.bus.emit(claims.userId, claims.sessionId, 'logout');
  }

  /** Ends every login of this account, on every device. */
  async logoutAll(claims: SessionClaims): Promise<void> {
    const now = this.d.now();
    if (await this.d.store.getProfile(claims.userId)) await this.d.store.updateProfile(claims.userId, { sessionsValidAfter: now, updatedAt: now });
    else await this.logout(claims); // right after sign-up there is no profile to mark; end at least this session
    this.d.bus.emit(claims.userId, null, 'logout');
  }

  // ---------------------------------------------------------------- bans and deletion

  /** Called when a moderator bans an account: remember the person's email so it cannot sign up again. */
  async recordBan(userId: string, reason: string): Promise<void> {
    const p = await this.d.store.getProfile(userId);
    if (!p?.emailHash) return;
    await this.d.store.addBannedIdentity({ identityHash: p.emailHash, reason: reason.slice(0, 200), bannedAt: this.d.now(), sourceUserId: userId });
  }

  /**
   * Deletes the account: the login at Supabase, the player's blocks, and their personal profile fields.
   * Moderation items, evidence, child-safety reports, the audit log and consent records are NOT touched:
   * they are kept under the legal hold (see docs/legal/data-retention.md).
   */
  async deleteAccount(claims: SessionClaims): Promise<{ ok: true } | { ok: false; reason: 'reauth_required' | 'try_again' }> {
    const now = this.d.now();
    if (now - claims.authenticatedAt > RECENT_SIGN_IN_MS) return { ok: false, reason: 'reauth_required' }; // sign in again first
    try {
      await this.d.authAdmin?.deleteUser(claims.userId); // first, so a failure leaves everything as it was and can be retried
    } catch {
      this.log('login deletion failed; nothing else was changed');
      return { ok: false, reason: 'try_again' };
    }
    if (await this.d.store.getProfile(claims.userId)) await this.d.store.updateProfile(claims.userId, { sessionsValidAfter: now, updatedAt: now });
    this.d.bus.emit(claims.userId, null, 'logout');
    await this.d.blocks.removeAllBy(claims.userId);
    for (const erase of this.d.erasers ?? []) await erase(claims.userId);
    await this.holdIdentity(claims.userId, now); // before the profile is anonymised: that clears the email hash
    await this.d.store.anonymizeProfile(claims.userId, now);
    this.log('account deleted');
    return { ok: true };
  }

  /**
   * If the account being deleted is suspended or has a case open, remember its email (as a hash) for a limited time, so deleting
   * the account is not a way out of a suspension. A suspension is held until it would have ended; an open case for a short while.
   * A ban is already permanent (recordBan). Nothing is held for an account in good standing.
   */
  private async holdIdentity(userId: string, now: number): Promise<void> {
    const profile = await this.d.store.getProfile(userId);
    const standing = this.d.standing?.(userId);
    if (!profile?.emailHash || !standing) return;
    const suspensionEnd = standing.suspendedUntil && standing.suspendedUntil > now ? standing.suspendedUntil : 0;
    const caseEnd = standing.openItems > 0 ? now + (this.d.openCaseHoldMs ?? 7 * 24 * 3600_000) : 0;
    const until = Math.max(suspensionEnd, caseEnd);
    if (!until) return;
    await this.d.store.addRestriction({ identityHash: profile.emailHash, reason: suspensionEnd >= caseEnd ? 'suspension' : 'open_case', until, createdAt: now, sourceUserId: userId });
    this.log('email held after deletion while suspended or under review');
  }

  /** Called whenever a moderation case changes. If a person has cleared the deleted account, the hold on its email is lifted at once. */
  async refreshRestriction(userId: string): Promise<void> {
    const standing = this.d.standing?.(userId);
    if (!standing) return;
    if (standing.suspendedUntil && standing.suspendedUntil > this.d.now()) return;
    if (standing.openItems > 0) return;
    for (const hash of await this.d.store.restrictionsFrom(userId)) await this.d.store.removeRestriction(hash);
  }

  /** Housekeeping: forget logouts whose tokens have expired anyway, and holds that have run out. */
  async purge(): Promise<number> {
    const n = await this.d.store.purgeRevokedSessions(this.d.now());
    return n + (await this.d.store.purgeRestrictions(this.d.now()));
  }
}

export { mayChat };
