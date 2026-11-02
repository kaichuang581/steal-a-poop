import { CATALOG, SLOTS, itemById, publicCosmetics } from './catalog';
import type { Cosmetics, ShopItem, Slot } from './catalog';
import { DEFAULT_RULES, capReward, rewardFor } from './rules';
import type { EarnRules, Reward } from './rules';
import type { EconomyStore } from './store';
import type { StoredGame } from '../game/results';

export interface ShopView {
  balance: number;
  items: (ShopItem & { owned: boolean; equipped: boolean })[];
}

export type BuyResult = { ok: true; balance: number } | { ok: false; reason: 'unknown_item' | 'insufficient' | 'owned' };
export type EquipResult = { ok: true } | { ok: false; reason: 'unknown_item' | 'not_owned' | 'bad_slot' };

/**
 * Coins and the shop. Rewards are paid by finished games; purchases are cosmetic only. Every payment goes through the ledger so a
 * game can only pay once and a balance can never go below zero.
 */
export class EconomyService {
  private cache = new Map<string, Cosmetics>();
  private listeners = new Set<(userId: string, cosmetics: Cosmetics) => void>();

  constructor(
    private store: EconomyStore,
    private now: () => number = Date.now,
    private rules: EarnRules = DEFAULT_RULES,
  ) {}

  /** Pays every stored human player of a finished game. Returns what each earned (after the daily limit), for the end screen. */
  async awardGame(game: StoredGame): Promise<Map<string, Reward & { balance: number }>> {
    const out = new Map<string, Reward & { balance: number }>();
    const dayStart = Date.UTC(new Date(this.now()).getUTCFullYear(), new Date(this.now()).getUTCMonth(), new Date(this.now()).getUTCDate());
    for (const p of game.players) {
      if (!p.userId) continue;
      const earned = await this.store.earnedSince(p.userId, dayStart);
      const reward = capReward(rewardFor(game.mode, p, this.rules), earned, this.rules);
      const r = await this.store.apply({ userId: p.userId, delta: reward.coins, reason: game.mode === 'daily' ? 'daily_reward' : 'game_reward', ref: game.gameId, at: this.now() });
      if (r.ok) out.set(p.userId, { ...reward, balance: r.balance });
    }
    return out;
  }

  async balance(userId: string) {
    return this.store.balance(userId);
  }

  async shop(userId: string): Promise<ShopView> {
    const [balance, owned, worn] = await Promise.all([this.store.balance(userId), this.store.owned(userId), this.store.equipped(userId)]);
    return { balance, items: CATALOG.map((i) => ({ ...i, owned: owned.includes(i.id), equipped: worn[i.slot] === i.id })) };
  }

  async buy(userId: string, itemId: string): Promise<BuyResult> {
    const item = itemById(itemId);
    if (!item) return { ok: false, reason: 'unknown_item' };
    const r = await this.store.purchase(userId, item.id, item.price, this.now());
    return r.ok ? { ok: true, balance: r.balance } : { ok: false, reason: r.reason };
  }

  async equip(userId: string, slot: string, itemId: string | null): Promise<EquipResult> {
    if (!SLOTS.includes(slot as Slot)) return { ok: false, reason: 'bad_slot' };
    if (itemId !== null) {
      const item = itemById(itemId);
      if (!item || item.slot !== slot) return { ok: false, reason: 'unknown_item' };
      if (!(await this.store.owned(userId)).includes(itemId)) return { ok: false, reason: 'not_owned' };
    }
    await this.store.equip(userId, slot as Slot, itemId);
    await this.refresh(userId);
    return { ok: true };
  }

  /** What other players see beside this player's name. Cached after the first look so rooms do not hit the database. */
  async cosmetics(userId: string): Promise<Cosmetics> {
    const hit = this.cache.get(userId);
    if (hit) return hit;
    return this.refresh(userId, false);
  }
  cachedCosmetics(userId: string): Cosmetics | undefined {
    return this.cache.get(userId);
  }
  onCosmetics(l: (userId: string, c: Cosmetics) => void): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }
  forget(userId: string) {
    this.cache.delete(userId);
  }
  private async refresh(userId: string, notify = true): Promise<Cosmetics> {
    const c = publicCosmetics(await this.store.equipped(userId));
    this.cache.set(userId, c);
    if (notify) for (const l of this.listeners) l(userId, c);
    return c;
  }

  async erase(userId: string) {
    this.forget(userId);
    await this.store.erase(userId);
  }
}
