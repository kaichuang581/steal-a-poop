import type { Pool } from 'pg';

/** One player's personal block list: their chat never shows messages from anyone on it. */
export interface BlockStore {
  load(): Promise<[blocker: string, blocked: string][]>;
  add(blocker: string, blocked: string, at: number): Promise<void>;
  remove(blocker: string, blocked: string): Promise<void>;
}

export class MemoryBlockStore implements BlockStore {
  readonly pairs = new Set<string>();
  async load() {
    return [...this.pairs].map((p) => JSON.parse(p) as [string, string]);
  }
  async add(blocker: string, blocked: string) {
    this.pairs.add(JSON.stringify([blocker, blocked]));
  }
  async remove(blocker: string, blocked: string) {
    this.pairs.delete(JSON.stringify([blocker, blocked]));
  }
}

/** Needs db/migrations/203_user_blocks.sql. */
export class PostgresBlockStore implements BlockStore {
  constructor(private pool: Pick<Pool, 'query'>) {}
  async load() {
    const { rows } = await this.pool.query('select blocker, blocked from user_blocks');
    return rows.map((r) => [r.blocker as string, r.blocked as string] as [string, string]);
  }
  async add(blocker: string, blocked: string, at: number) {
    await this.pool.query('insert into user_blocks (blocker, blocked, at) values ($1,$2,$3) on conflict do nothing', [blocker, blocked, at]);
  }
  async remove(blocker: string, blocked: string) {
    await this.pool.query('delete from user_blocks where blocker = $1 and blocked = $2', [blocker, blocked]);
  }
}

export const MAX_BLOCKS = 200;

/** In-memory working copy with background write-through, like the moderation state. */
export class BlockList {
  private by = new Map<string, Set<string>>();
  private queue: Promise<void> = Promise.resolve();
  failures = 0;

  constructor(private store: BlockStore = new MemoryBlockStore(), private now: () => number = Date.now, private onError?: (e: unknown) => void) {}

  async load(): Promise<void> {
    for (const [blocker, blocked] of await this.store.load()) this.add(blocker, blocked);
  }
  async flush(): Promise<void> {
    await this.queue;
  }

  isBlocked(blocker: string, blocked: string): boolean {
    return this.by.get(blocker)?.has(blocked) ?? false;
  }
  list(blocker: string): string[] {
    return [...(this.by.get(blocker) ?? [])];
  }

  block(blocker: string, blocked: string): 'ok' | 'self' | 'limit' | 'bad' {
    if (!blocked || blocked.length > 100) return 'bad';
    if (blocker === blocked) return 'self';
    const set = this.by.get(blocker) ?? new Set<string>();
    if (!set.has(blocked) && set.size >= MAX_BLOCKS) return 'limit';
    if (!set.has(blocked)) {
      this.add(blocker, blocked);
      this.write(() => this.store.add(blocker, blocked, this.now()));
    }
    return 'ok';
  }

  unblock(blocker: string, blocked: string): void {
    const set = this.by.get(blocker);
    if (set?.delete(blocked)) this.write(() => this.store.remove(blocker, blocked));
  }

  private add(blocker: string, blocked: string) {
    const set = this.by.get(blocker) ?? new Set<string>();
    set.add(blocked);
    this.by.set(blocker, set);
  }

  private write(op: () => Promise<void>) {
    this.queue = this.queue.then(op).catch((e) => {
      this.failures += 1;
      this.onError?.(e);
    });
  }
}
