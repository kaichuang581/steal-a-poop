import type { Route } from '../contracts';
import type { EconomyService } from '../economy/service';
import type { EconomyStore } from '../economy/store';
import { RateLimiter } from '../ratelimit';

const bad = (error: string, status = 400) => ({ status, json: { error } });

/** The shop and the wallet. Coins are earned by playing; there is no way to pay money for them here. */
export function createShopRoutes(deps: { economy: EconomyService; store: EconomyStore; now?: () => number }): Route[] {
  const now = deps.now ?? Date.now;
  const buyLimit = new RateLimiter(30, 60_000);
  const readLimit = new RateLimiter(60, 60_000);
  return [
    {
      method: 'GET', path: '/api/shop', auth: 'user',
      handler: async (req) => (readLimit.allow(req.user!.userId, now()) ? { status: 200, json: await deps.economy.shop(req.user!.userId) } : bad('rate_limited', 429)),
    },
    {
      method: 'GET', path: '/api/wallet', auth: 'user',
      handler: async (req) => {
        if (!readLimit.allow(req.user!.userId, now())) return bad('rate_limited', 429);
        const [balance, history] = await Promise.all([deps.store.balance(req.user!.userId), deps.store.recent(req.user!.userId, 20)]);
        return { status: 200, json: { balance, history } };
      },
    },
    {
      method: 'POST', path: '/api/shop/buy', auth: 'user',
      handler: async (req) => {
        if (!buyLimit.allow(req.user!.userId, now())) return bad('rate_limited', 429);
        const itemId = (req.body as { itemId?: unknown } | null)?.itemId;
        if (typeof itemId !== 'string') return bad('bad_request');
        const r = await deps.economy.buy(req.user!.userId, itemId);
        if (r.ok) return { status: 200, json: { balance: r.balance } };
        return bad(r.reason, r.reason === 'unknown_item' ? 404 : 409);
      },
    },
    {
      method: 'POST', path: '/api/shop/equip', auth: 'user',
      handler: async (req) => {
        if (!buyLimit.allow(req.user!.userId, now())) return bad('rate_limited', 429);
        const b = (req.body ?? {}) as { slot?: unknown; itemId?: unknown };
        if (typeof b.slot !== 'string' || !(b.itemId === null || typeof b.itemId === 'string')) return bad('bad_request');
        const r = await deps.economy.equip(req.user!.userId, b.slot, b.itemId);
        return r.ok ? { status: 200, json: { ok: true } } : bad(r.reason, r.reason === 'not_owned' ? 403 : 404);
      },
    },
  ];
}
