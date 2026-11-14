import type { Route, RouteRequest, RouteResponse } from '../contracts';
import type { CaptchaVerifier } from '../auth/captcha';
import { normalizeEmail, sha256 } from '../auth/policy';
import { RateLimiter } from '../ratelimit';
import type { AccountService, CreateProfileFailure } from '../auth/service';
import { limitKey } from '../address';

/**
 * HTTP endpoints owned by the "accounts" lane. They need the live AccountService, so main.ts builds them
 * with createAccountRoutes(...) and adds them to the route list. The static `routes` stays empty so
 * routes/index.ts needs no change.
 */
export const routes: Route[] = [];

export interface AccountRouteDeps {
  service: AccountService;
  captcha: CaptchaVerifier;
  now?: () => number;
}

const HOUR = 3_600_000;
const bad = (error: string, status = 400): RouteResponse => ({ status, json: { error } });

// Failures that mean "fix your input" are shown as they are. A banned identity is not revealed as such.
const STATUS: Record<CreateProfileFailure, [number, string]> = {
  profile_exists: [409, 'profile_exists'],
  email_required: [400, 'email_required'],
  bad_nickname: [400, 'bad_nickname'],
  nickname_taken: [409, 'nickname_taken'],
  bad_dob: [400, 'bad_dob'],
  bad_country: [400, 'bad_country'],
  country_not_supported: [403, 'country_not_supported'],
  identity_banned: [403, 'cannot_create_account'],
  identity_restricted: [403, 'cannot_create_account'], // same answer: the reason is not revealed
  parent_email_required: [400, 'parent_email_required'],
  parent_email_invalid: [400, 'parent_email_invalid'],
  parent_email_same: [400, 'parent_email_same'],
  consent_unavailable: [503, 'consent_unavailable'],
};

export function createAccountRoutes({ service, captcha, now = Date.now }: AccountRouteDeps): Route[] {
  // All limits are per hour unless stated. They are in memory: one server process, as everything else here.
  const signupByIp = new RateLimiter(10, HOUR);
  const signupByUser = new RateLimiter(5, HOUR);
  const parentMailByEmail = new RateLimiter(3, 24 * HOUR); // one parent address cannot be mail-bombed
  const resendByUser = new RateLimiter(3, HOUR);
  const consentByIp = new RateLimiter(60, 10 * 60_000);
  const decideByIp = new RateLimiter(20, HOUR);
  const sessionByUser = new RateLimiter(20, 60_000);
  const deleteByUser = new RateLimiter(5, HOUR);
  const renameByUser = new RateLimiter(5, 24 * HOUR); // a name is not a chat channel: a few changes a day
  const renameTries = new RateLimiter(30, HOUR); // tries that change nothing (a name that is taken or not allowed) are not changes
  const limited = (l: RateLimiter, key: string) => !l.allow(key, now());
  const tooMany = () => bad('rate_limited', 429);
  const body = (req: RouteRequest) => (req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {});

  return [
    {
      // Finishes sign-up after Supabase has created and verified the login: nickname, date of birth, country.
      method: 'POST', path: '/api/account/profile', auth: 'session',
      handler: async (req) => {
        const b = body(req);
        if (limited(signupByIp, limitKey(req.ip)) || limited(signupByUser, req.session!.userId)) return tooMany();
        if (!(await captcha.verify(typeof b.captchaToken === 'string' ? b.captchaToken : undefined, req.ip))) return bad('captcha_failed', 403);
        const parentEmail = typeof b.parentEmail === 'string' ? b.parentEmail.trim() : '';
        if (parentEmail && limited(parentMailByEmail, sha256(normalizeEmail(parentEmail)))) return tooMany();
        const out = await service.createProfile(req.session!, {
          nickname: String(b.nickname ?? ''), dateOfBirth: String(b.dateOfBirth ?? ''), country: String(b.country ?? ''), parentEmail,
        });
        if (!out.ok) return bad(STATUS[out.reason][1], STATUS[out.reason][0]);
        return { status: 201, json: { profile: out.profile, parentMailed: out.mailed } };
      },
    },
    {
      // The simple sign-up step: a username and nothing else (see AccountService.createUsernameProfile).
      method: 'POST', path: '/api/account/username', auth: 'session',
      handler: async (req) => {
        const b = body(req);
        if (limited(signupByIp, limitKey(req.ip)) || limited(signupByUser, req.session!.userId)) return tooMany();
        if (!(await captcha.verify(typeof b.captchaToken === 'string' ? b.captchaToken : undefined, req.ip))) return bad('captcha_failed', 403);
        const out = await service.createUsernameProfile(req.session!, String(b.nickname ?? ''));
        if (!out.ok) return bad(STATUS[out.reason][1], STATUS[out.reason][0]);
        return { status: 201, json: { profile: out.profile } };
      },
    },
    {
      // Changing the nickname afterwards, from the profile page. Same rules as sign-up.
      method: 'POST', path: '/api/account/nickname', auth: 'user',
      handler: async (req) => {
        // Five changes a day, counted only when the name really changes: five tries at names that were taken used
        // to lock a player out for the day without one rename.
        const id = req.user!.userId;
        if (renameByUser.retryAfter(id, now()) > 0 || limited(renameTries, id)) return tooMany();
        const out = await service.renameProfile(id, String(body(req).nickname ?? ''));
        if (!out.ok) return out.reason === 'not_found' ? bad('not_found', 404) : bad(out.reason, out.reason === 'nickname_taken' ? 409 : 400);
        if (out.changed) renameByUser.allow(id, now());
        return { status: 200, json: { profile: out.profile } };
      },
    },
    {
      // Works before a profile exists, so the app can tell "finish sign-up" from "signed in".
      method: 'GET', path: '/api/account/me', auth: 'session',
      handler: async (req) => ({ status: 200, json: { profile: await service.getProfile(req.session!.userId) } }),
    },
    {
      method: 'POST', path: '/api/account/consent/resend', auth: 'session',
      handler: async (req) => {
        if (limited(resendByUser, req.session!.userId)) return tooMany();
        const out = await service.resendConsent(req.session!.userId, (email) => !limited(parentMailByEmail, sha256(normalizeEmail(email))));
        if (!out.ok) return out.reason === 'rate_limited' ? tooMany() : bad(out.reason, out.reason === 'consent_unavailable' ? 503 : 409);
        return { status: 200, json: { parentMailed: out.mailed } };
      },
    },
    {
      // Ends this login on the server. The app also signs out of Supabase.
      method: 'POST', path: '/api/account/logout', auth: 'session',
      handler: async (req) => {
        if (limited(sessionByUser, req.session!.userId)) return tooMany();
        await service.logout(req.session!);
        return { status: 200, json: { ok: true } };
      },
    },
    {
      // Ends every login of the account, on every device, and closes their game connections.
      method: 'POST', path: '/api/account/logout-all', auth: 'session',
      handler: async (req) => {
        if (limited(sessionByUser, req.session!.userId)) return tooMany();
        await service.logoutAll(req.session!);
        return { status: 200, json: { ok: true } };
      },
    },
    {
      // POST rather than DELETE: the HTTP layer reads no body on DELETE, and this one needs a confirmation word.
      method: 'POST', path: '/api/account/delete', auth: 'session',
      handler: async (req) => {
        if (limited(deleteByUser, req.session!.userId)) return tooMany();
        if (body(req).confirm !== 'DELETE') return bad('confirmation_required');
        const out = await service.deleteAccount(req.session!);
        if (!out.ok) return bad(out.reason, out.reason === 'reauth_required' ? 403 : 503);
        return { status: 200, json: { ok: true } };
      },
    },
    {
      method: 'GET', path: '/api/consent/:token', auth: 'none',
      handler: async (req) => {
        if (limited(consentByIp, limitKey(req.ip))) return tooMany();
        const info = await service.consentInfo(req.params.token);
        return info ? { status: 200, json: info } : bad('not_found', 404);
      },
    },
    {
      method: 'POST', path: '/api/consent/:token', auth: 'none',
      handler: async (req) => {
        if (limited(decideByIp, limitKey(req.ip))) return tooMany();
        const decision = body(req).decision;
        if (decision !== 'grant' && decision !== 'refuse') return bad('bad_decision');
        const out = await service.decideConsent(req.params.token, decision);
        if (!out.ok) return bad(out.reason === 'unknown' ? 'not_found' : out.reason, out.reason === 'unknown' ? 404 : 409);
        return { status: 200, json: { state: out.state } };
      },
    },
    {
      method: 'POST', path: '/api/consent/manage/:token/withdraw', auth: 'none',
      handler: async (req) => {
        if (limited(decideByIp, limitKey(req.ip))) return tooMany();
        const out = await service.withdrawConsent(req.params.token);
        if (!out.ok) return bad(out.reason === 'unknown' ? 'not_found' : out.reason, out.reason === 'unknown' ? 404 : 409);
        return { status: 200, json: { state: 'withdrawn' } };
      },
    },
  ];
}
