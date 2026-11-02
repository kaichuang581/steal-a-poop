import type { ChatService, ReviewItem, Verdict } from '../chat';
import type { Route, RouteResponse } from '../contracts';
import type { ChildSafetyService } from '../moderation/reporting';
import type { AuditLog } from '../moderation/audit';
import type { EconomyStore } from '../economy/store';

/**
 * HTTP endpoints owned by the "moderation" lane. They need the live ChatService, so main.ts
 * builds them with createModerationRoutes(chat) and adds them to the route list. The static
 * `routes` below stays empty so routes/index.ts needs no change.
 */
export const routes: Route[] = [];

const MAX_REASON = 500;
const VERDICTS: readonly Verdict[] = ['clear', 'suspend', 'ban'];

const summary = (i: ReviewItem) => ({
  id: i.id, at: i.at, userId: i.userId, roomCode: i.roomCode, category: i.category, status: i.status,
  mustReport: i.mustReport, term: i.term, verdict: i.verdict, decidedBy: i.decidedBy, decidedAt: i.decidedAt,
  opinion: i.opinion?.verdict, preview: i.text.slice(0, 80),
});

export interface ModerationRouteDeps {
  chat: ChatService;
  /** Child-safety reporting. Without it, the report route answers 503. */
  reporting?: ChildSafetyService;
  /** Logged for every decision; never contains message text. */
  log?: (line: string) => void;
  /** Coins support tool. Without them the coin routes answer 503. */
  economy?: EconomyStore;
  audit?: AuditLog;
}

/** The most one adjustment may change a balance. Bigger fixes should be several deliberate steps. */
export const MAX_COIN_ADJUSTMENT = 5000;

export function createModerationRoutes({ chat, reporting, economy, audit, log = () => {} }: ModerationRouteDeps): Route[] {
  const bad = (error: string, status = 400): RouteResponse => ({ status, json: { error } });
  return [
    {
      method: 'GET', path: '/api/mod/queue', auth: 'moderator',
      // Oldest first, so nothing sits unseen. ?status=pending|human|reviewed|all (default human).
      handler: (req) => {
        const status = req.query.status ?? 'human';
        if (!['pending', 'human', 'reviewed', 'all'].includes(status)) return bad('bad_status');
        const list = status === 'all' ? chat.queue() : chat.queue(status as 'pending' | 'human' | 'reviewed');
        const items = [...list].sort((a, b) => a.at - b.at).map(summary);
        // How long the oldest open item has waited, so nothing sits unseen.
        return { status: 200, json: { items, oldestUnreviewed: chat.oldestUnreviewed() } };
      },
    },
    {
      // A player's own case: standing, what is waiting, their appeal and the last decision.
      method: 'GET', path: '/api/me/moderation', auth: 'user',
      handler: (req) => ({ status: 200, json: chat.status(req.user!.userId) }),
    },
    {
      method: 'GET', path: '/api/mod/items/:id', auth: 'moderator',
      handler: (req) => {
        const item = chat.getItem(Number(req.params.id));
        if (!item) return bad('not_found', 404);
        // The item with its context and Claude's opinion, plus the sender's standing.
        return { status: 200, json: { item, standing: chat.userFile(item.userId) } };
      },
    },
    {
      method: 'GET', path: '/api/mod/users/:id', auth: 'moderator',
      handler: (req) => ({ status: 200, json: chat.userFile(req.params.id) }),
    },
    {
      // A person confirms that a child-safety item must be reported. Chooses the reporter by country.
      method: 'POST', path: '/api/mod/items/:id/report', auth: 'moderator',
      handler: async (req) => {
        if (!reporting) return bad('reporting_unavailable', 503);
        const id = Number(req.params.id);
        const item = chat.getItem(id);
        if (!item) return bad('not_found', 404);
        if (!item.mustReport) return bad('not_a_child_safety_item', 409);
        const report = await reporting.confirm(id, req.user!.userId);
        if (!report) return bad('no_report_on_file', 409);
        log(`[child-safety] item ${id} report ${report.status} (${report.reporter ?? 'none'}) confirmed by ${req.user!.userId}`);
        return { status: 200, json: { status: report.status, reporter: report.reporter, receipt: report.receipt } };
      },
    },
    {
      // A player's coins: balance and recent history, for support.
      method: 'GET', path: '/api/mod/coins/:userId', auth: 'moderator',
      handler: async (req) => {
        if (!economy) return bad('economy_unavailable', 503);
        const [balance, history] = await Promise.all([economy.balance(req.params.userId), economy.recent(req.params.userId, 30)]);
        return { status: 200, json: { balance, history } };
      },
    },
    {
      // Adds or removes coins with a reason, once. The balance cannot go below zero. Every change is logged with who made it.
      method: 'POST', path: '/api/mod/coins/:userId', auth: 'moderator',
      handler: async (req) => {
        if (!economy) return bad('economy_unavailable', 503);
        const b = (req.body ?? {}) as { delta?: unknown; note?: unknown; requestId?: unknown };
        const delta = b.delta;
        if (typeof delta !== 'number' || !Number.isInteger(delta) || delta === 0 || Math.abs(delta) > MAX_COIN_ADJUSTMENT) return bad('bad_amount');
        const note = typeof b.note === 'string' ? b.note.trim().slice(0, 200) : '';
        if (!note) return bad('note_required');
        // The caller's request id makes a double click or a retry do the change once.
        const requestId = typeof b.requestId === 'string' && /^[\w-]{6,64}$/.test(b.requestId) ? b.requestId : null;
        if (!requestId) return bad('request_id_required');
        const r = await economy.apply({ userId: req.params.userId, delta, reason: 'adjustment', ref: `${req.user!.userId}:${requestId}`, at: Date.now() });
        if (!r.ok) return bad(r.reason, 409);
        await audit?.record({ at: Date.now(), actor: req.user!.userId, action: 'coins_adjusted', userId: req.params.userId, details: { delta, note } }).catch(() => undefined);
        log(`[moderation] coins ${delta > 0 ? '+' : ''}${delta} by ${req.user!.userId}`);
        return { status: 200, json: { balance: r.balance } };
      },
    },
    {
      method: 'POST', path: '/api/mod/items/:id/resolve', auth: 'moderator',
      handler: (req) => {
        const body = (req.body ?? {}) as { verdict?: unknown; reason?: unknown };
        const verdict = body.verdict as Verdict;
        if (!VERDICTS.includes(verdict)) return bad('bad_verdict');
        const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
        if (!reason) return bad('reason_required');
        if (reason.length > MAX_REASON) return bad('reason_too_long');
        const id = Number(req.params.id);
        const ok = chat.resolveByHuman(id, verdict, reason, req.user!.userId);
        if (!ok) return bad('not_awaiting_a_person', 409);
        log(`[moderation] item ${id} -> ${verdict} by ${req.user!.userId}`);
        return { status: 200, json: { ok: true } };
      },
    },
  ];
}
