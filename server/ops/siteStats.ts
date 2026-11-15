import type { Pool } from 'pg';

/**
 * Counting the people who open the site (requested by Kai, 2026-11-15), without knowing who they are.
 *
 *  - Visits: each tab tells the server once when it opens the game; the server adds one to that UTC day's counter, and one
 *    more to "new browsers" if the browser said it had never been here. That is all that is stored, and it is only numbers.
 *  - On the site now: each open tab pings every 45 s while it is on screen with a random code made for that tab. The codes
 *    are kept in memory for 90 s and counted, then forgotten. They are never written to the database or a log, and they
 *    mean nothing outside that one tab.
 */
export const PING_EVERY_MS = 45_000;
/** A tab that has not pinged for this long is no longer on the site. */
export const ON_SITE_FOR_MS = 90_000;
/** More codes than this at once are not people: the oldest are dropped. */
export const MAX_TABS = 20_000;

export interface DayCounts { day: string; visits: number; newBrowsers: number }

export interface VisitStore {
  add(day: string, newBrowser: boolean): Promise<void>;
  /** Every day with a count, oldest first. */
  all(): Promise<DayCounts[]>;
}

export class MemoryVisitStore implements VisitStore {
  private days = new Map<string, DayCounts>();
  async add(day: string, newBrowser: boolean) {
    const d = this.days.get(day) ?? { day, visits: 0, newBrowsers: 0 };
    d.visits += 1;
    if (newBrowser) d.newBrowsers += 1;
    this.days.set(day, d);
  }
  async all() {
    return [...this.days.values()].sort((a, b) => a.day.localeCompare(b.day)).map((d) => ({ ...d }));
  }
}

export class PostgresVisitStore implements VisitStore {
  constructor(private pool: Pick<Pool, 'query'>) {}
  async add(day: string, newBrowser: boolean) {
    await this.pool.query(
      `insert into site_visits (day, visits, new_browsers) values ($1, 1, $2)
       on conflict (day) do update set visits = site_visits.visits + 1, new_browsers = site_visits.new_browsers + $2`,
      [day, newBrowser ? 1 : 0],
    );
  }
  async all() {
    const { rows } = await this.pool.query('select day, visits::int as visits, new_browsers::int as new_browsers from site_visits order by day');
    return rows.map((r: { day: string; visits: number; new_browsers: number }) => ({ day: r.day, visits: r.visits, newBrowsers: r.new_browsers }));
  }
}

export const dayKey = (t: number) => new Date(t).toISOString().slice(0, 10);

export interface SiteSummary {
  /** Tabs on the site in the last 90 s. */
  onSiteNow: number;
  visits: { today: number; yesterday: number; last7: number; last30: number; total: number };
  newBrowsers: { today: number; last7: number; total: number };
  /** The first day anything was counted, or null. */
  since: string | null;
}

export class SiteStats {
  private tabs = new Map<string, number>(); // tab code -> when it last pinged

  constructor(private opts: { store: VisitStore; now?: () => number; log?: (line: string) => void }) {}
  private now() { return (this.opts.now ?? Date.now)(); }

  /** A tab opened the game (`open`) or is still there. Never throws: a failed count must not matter to the player. */
  async ping(tab: string, open: boolean, firstEver: boolean): Promise<void> {
    const t = this.now();
    this.tabs.delete(tab); // put it back at the end, so the map stays in the order the tabs last pinged
    this.tabs.set(tab, t);
    if (this.tabs.size > MAX_TABS) {
      for (const k of this.tabs.keys()) {
        this.tabs.delete(k);
        if (this.tabs.size <= MAX_TABS) break;
      }
    }
    if (!open) return;
    try {
      await this.opts.store.add(dayKey(t), firstEver);
    } catch {
      this.opts.log?.('[site] could not count a visit');
    }
  }

  onSiteNow(): number {
    const t = this.now();
    for (const [k, at] of this.tabs) {
      if (t - at >= ON_SITE_FOR_MS) this.tabs.delete(k);
      else break; // the map is in ping order, so the rest are newer
    }
    return this.tabs.size;
  }

  async summary(): Promise<SiteSummary> {
    const t = this.now();
    const rows = await this.opts.store.all();
    const day = (n: number) => dayKey(t - n * 86_400_000);
    const sumFrom = (from: string, pick: (d: DayCounts) => number) => rows.filter((r) => r.day >= from).reduce((s, r) => s + pick(r), 0);
    const only = (d: string, pick: (r: DayCounts) => number) => rows.filter((r) => r.day === d).reduce((s, r) => s + pick(r), 0);
    const v = (r: DayCounts) => r.visits;
    const n = (r: DayCounts) => r.newBrowsers;
    return {
      onSiteNow: this.onSiteNow(),
      visits: { today: only(day(0), v), yesterday: only(day(1), v), last7: sumFrom(day(6), v), last30: sumFrom(day(29), v), total: sumFrom('0000-00-00', v) },
      newBrowsers: { today: only(day(0), n), last7: sumFrom(day(6), n), total: sumFrom('0000-00-00', n) },
      since: rows[0]?.day ?? null,
    };
  }
}
