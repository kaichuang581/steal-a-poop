import type { Route, RouteResponse } from '../contracts';
import { RateLimiter } from '../ratelimit';
import { limitKey } from '../address';

export interface FeedbackDeps {
  /** A GitHub token that may create issues in `repo` (fine-grained, Issues: read and write). Without it the route says it is unavailable. */
  token: string | undefined;
  /** "owner/name" of the repository that receives the issues. */
  repo: string;
  fetchFn?: typeof fetch;
  now?: () => number;
}

export const FEEDBACK_KINDS = { bug: 'bug', idea: 'enhancement', other: 'feedback' } as const;
type Kind = keyof typeof FEEDBACK_KINDS;

const bad = (error: string, status = 400): RouteResponse => ({ status, json: { error } });
// eslint-disable-next-line no-control-regex
const clean = (s: unknown) => (typeof s === 'string' ? s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim() : '');
// Feedback is posted to a public GitHub issue: no @mentions, and no links of any kind (http://, www. autolinks, markdown
// [text](url) and images), so nobody can use the form to post links or ping people through the game's account.
const defang = (s: string) => s
  .replace(/@/g, '@\u200b')
  .replace(/https?:\/\//gi, (m) => m.replace('//', '/\u200b/'))
  .replace(/\bwww\./gi, (m) => `${m.slice(0, 3)}\u200b.`)
  .replace(/\]\(/g, ']\u200b(');

/** Sends a player's feedback to GitHub as an issue, so the form never has to leave the game. */
export function createFeedbackRoutes({ token, repo, fetchFn = fetch, now = Date.now }: FeedbackDeps): Route[] {
  const perIp = new RateLimiter(4, 3_600_000);
  const overall = new RateLimiter(40, 3_600_000);
  return [{
    method: 'POST', path: '/api/feedback', auth: 'none',
    handler: async (req) => {
      if (!token) return bad('feedback_unavailable', 503);
      if (!perIp.allow(limitKey(req.ip), now()) || !overall.allow('all', now())) return bad('rate_limited', 429);
      const b = req.body && typeof req.body === 'object' ? (req.body as Record<string, unknown>) : {};
      const kind = (typeof b.kind === 'string' && Object.hasOwn(FEEDBACK_KINDS, b.kind) ? b.kind : 'other') as Kind;
      const title = clean(b.title).replace(/\s+/g, ' ');
      const message = clean(b.message);
      if (title.length < 3 || title.length > 80) return bad('bad_title');
      if (message.length < 10 || message.length > 1500) return bad('bad_message');
      let res: Response;
      try {
        res = await fetchFn(`https://api.github.com/repos/${repo}/issues`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'User-Agent': 'steal-a-poop-feedback',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: `[${kind}] ${defang(title)}`,
            body: `${defang(message)}\n\n---\nSent from the in-game feedback form.`,
            labels: [FEEDBACK_KINDS[kind], 'from-game'],
          }),
        });
      } catch {
        return bad('feedback_failed', 502);
      }
      if (!res.ok) return bad('feedback_failed', 502);
      return { status: 200, json: { ok: true } };
    },
  }];
}
