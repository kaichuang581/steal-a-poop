import { describe, expect, it } from 'vitest';
import { MAX_TABS, MemoryVisitStore, ON_SITE_FOR_MS, SiteStats, dayKey } from './siteStats';

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 10, 15, 12, 0, 0);

function setup(start = T0) {
  let t = start;
  const store = new MemoryVisitStore();
  const stats = new SiteStats({ store, now: () => t });
  return { stats, store, advance: (ms: number) => { t += ms; }, at: () => t };
}

describe('counting visits', () => {
  it('adds one per tab that opens, and one more to new browsers when the browser says it is new', async () => {
    const { stats } = setup();
    await stats.ping('tab-aaaaaaaaaaaa', true, true);
    await stats.ping('tab-bbbbbbbbbbbb', true, false);
    await stats.ping('tab-bbbbbbbbbbbb', false, false); // still there: not a visit
    const s = await stats.summary();
    expect(s.visits).toEqual({ today: 2, yesterday: 0, last7: 2, last30: 2, total: 2 });
    expect(s.newBrowsers).toEqual({ today: 1, last7: 1, total: 1 });
    expect(s.since).toBe('2026-11-15');
  });

  it('ignores "first" on a ping that is not an open', async () => {
    const { stats } = setup();
    await stats.ping('tab-aaaaaaaaaaaa', false, true);
    expect((await stats.summary()).newBrowsers.total).toBe(0);
  });

  it('keeps a count for each UTC day and sums the last 7 and 30', async () => {
    const { stats, advance } = setup();
    for (let d = 0; d < 40; d++) {
      await stats.ping(`tab-${String(d).padStart(12, '0')}`, true, d % 2 === 0);
      advance(DAY);
    }
    // now it is day 40: the visits were on days 0..39
    const s = await stats.summary();
    expect(s.visits.total).toBe(40);
    expect(s.visits.today).toBe(0);
    expect(s.visits.yesterday).toBe(1);
    expect(s.visits.last7).toBe(6); // days 34 to 39 had a visit; today (day 40) has none
    expect(s.visits.last30).toBe(29);
    expect(s.newBrowsers.total).toBe(20);
  });

  it('starts empty', async () => {
    const { stats } = setup();
    expect(await stats.summary()).toEqual({ onSiteNow: 0, visits: { today: 0, yesterday: 0, last7: 0, last30: 0, total: 0 }, newBrowsers: { today: 0, last7: 0, total: 0 }, since: null });
  });

  it('never throws when the count cannot be saved', async () => {
    const lines: string[] = [];
    const stats = new SiteStats({ store: { add: async () => { throw new Error('db down'); }, all: async () => [] }, log: (l) => lines.push(l) });
    await expect(stats.ping('tab-aaaaaaaaaaaa', true, true)).resolves.toBeUndefined();
    expect(lines).toEqual(['[site] could not count a visit']);
  });
});

describe('who is on the site now', () => {
  it('counts each tab once however often it pings, and forgets a tab after 90 s', async () => {
    const { stats, advance } = setup();
    await stats.ping('tab-aaaaaaaaaaaa', true, false);
    await stats.ping('tab-bbbbbbbbbbbb', true, false);
    await stats.ping('tab-aaaaaaaaaaaa', false, false);
    expect(stats.onSiteNow()).toBe(2);
    advance(ON_SITE_FOR_MS - 1000);
    await stats.ping('tab-bbbbbbbbbbbb', false, false); // b is still there, a is not
    advance(2000);
    expect(stats.onSiteNow()).toBe(1);
    advance(ON_SITE_FOR_MS);
    expect(stats.onSiteNow()).toBe(0);
  });

  it('keeps at most MAX_TABS codes, dropping the oldest', async () => {
    const { stats } = setup();
    for (let i = 0; i < MAX_TABS + 5; i++) await stats.ping(`t${String(i).padStart(12, '0')}`, false, false);
    expect(stats.onSiteNow()).toBe(MAX_TABS);
  });

  it('stores no code anywhere: the store only ever sees a day and a flag', async () => {
    const { stats, store } = setup();
    await stats.ping('tab-secretcode0', true, true);
    expect(JSON.stringify(await store.all())).not.toContain('secretcode');
    expect(Object.keys((await store.all())[0]).sort()).toEqual(['day', 'newBrowsers', 'visits']);
  });
});

describe('days', () => {
  it('are UTC dates', () => {
    expect(dayKey(Date.UTC(2026, 10, 15, 23, 59, 59))).toBe('2026-11-15');
    expect(dayKey(Date.UTC(2026, 10, 16, 0, 0, 0))).toBe('2026-11-16');
  });
});
