import type { ReviewItem } from '../chat';

export interface Standing {
  banned: boolean;
  /** Epoch milliseconds, or null when not suspended. */
  suspendedUntil: number | null;
}

/**
 * Where moderation state lives between restarts. ChatService keeps its working copy in memory and
 * writes through to a store in the background, so a slow or failing store never delays or breaks chat.
 *
 * Evidence is different from the rest: it is append-only and must never be deleted, because the law
 * may require it to be kept (see docs/MODERATION.md). Implementations must not offer a way to remove it.
 */
export interface ModerationStore {
  loadStandings(): Promise<Map<string, Standing>>;
  saveStanding(userId: string, standing: Standing): Promise<void>;
  loadItems(): Promise<ReviewItem[]>;
  /** Insert or update by id. */
  saveItem(item: ReviewItem): Promise<void>;
  /** Append a snapshot of a held message or report. Never updated, never deleted. */
  saveEvidence(item: ReviewItem): Promise<void>;
}

/** In-memory store, used by tests and as the fallback when no database is configured. */
export class MemoryStore implements ModerationStore {
  readonly standings = new Map<string, Standing>();
  readonly items = new Map<number, ReviewItem>();
  readonly evidence: { itemId: number; capturedAt: number; item: ReviewItem }[] = [];

  async loadStandings() {
    return new Map(this.standings);
  }
  async saveStanding(userId: string, standing: Standing) {
    this.standings.set(userId, { ...standing });
  }
  async loadItems() {
    return [...this.items.values()].map((i) => structuredClone(i));
  }
  async saveItem(item: ReviewItem) {
    this.items.set(item.id, structuredClone(item));
  }
  async saveEvidence(item: ReviewItem) {
    this.evidence.push({ itemId: item.id, capturedAt: Date.now(), item: structuredClone(item) });
  }
}
