import { describe, expect, it } from 'vitest';
import { freshWallet } from '../../src/skin/shop/economy';
import { SACK } from '../../src/skin/shop/sacks';
import { createBarnRoutes } from '../routes/barn';
import { BarnService } from './service';
import { MemoryBarnStore } from './store';

const NOW = Date.UTC(2026, 10, 12, 12);

async function rich(store: MemoryBarnStore, userId: string, coins = 5000) {
  store.rows.set(userId, { wallet: { ...freshWallet(), coins }, imported: true });
}

describe('Trading Post v2 on the server', () => {
  it('opens a sack for Wool Coins, rolled and saved on the server', async () => {
    const store = new MemoryBarnStore();
    const svc = new BarnService(store, () => NOW);
    await rich(store, 'u1');
    const r = await svc.openSack('u1', 'bomb', () => 0);
    expect(r.ok).toBe(true);
    const saved = (await svc.wallet('u1')).wallet;
    expect(saved.owned.length + (r.ok && r.entry.duplicate ? 1 : 0)).toBe(freshWallet().owned.length + 1);
    expect(saved.coins).toBe(5000 - SACK.price + (r.ok && r.entry.duplicate ? r.entry.refund : 0));
  });

  it('ignores anything the browser sends with a sack', async () => {
    const store = new MemoryBarnStore();
    const svc = new BarnService(store, () => NOW);
    await rich(store, 'u1');
    const route = createBarnRoutes({ barn: svc, now: () => NOW }).find((r) => r.path === '/api/barn/sack')!;
    const res = await route.handler({ params: {}, query: {}, body: { sack: 'blast', itemId: 'bomb-diamond', tier: 'legendary' }, user: { userId: 'u1' } } as never);
    expect(res.status).toBe(200);
    const entry = (res.json as { entry: { itemId: string; sack: string } }).entry;
    expect(entry.sack).toBe('blast');
    expect(entry.itemId.startsWith('blast-')).toBe(true);
    const bad = await route.handler({ params: {}, query: {}, body: { sack: 'everything' }, user: { userId: 'u1' } } as never);
    expect(bad.status).toBe(400);
  });
  it('sells only Bell Shelf items, for Golden Bells', async () => {
    const store = new MemoryBarnStore();
    const svc = new BarnService(store, () => NOW);
    store.rows.set('u1', { wallet: { ...freshWallet(), coins: 99_999, bells: 35 }, imported: true });
    expect(await svc.buy('u1', 'bomb-diamond')).toEqual({ ok: false, reason: 'not_for_sale' });
    const r = await svc.buy('u1', 'bomb-brass');
    expect(r.ok && [r.wallet.bells, r.wallet.coins]).toEqual([5, 99_999]);
    expect(await svc.buy('u1', 'blast-lantern')).toEqual({ ok: false, reason: 'short' });
    const paths = createBarnRoutes({ barn: svc }).map((x) => x.path);
    expect(paths).not.toContain('/api/barn/shelf');
  });
});
