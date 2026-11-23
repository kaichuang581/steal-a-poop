import { describe, expect, it } from 'vitest';
import { describeNumbersError, numberRows } from '../SiteNumbers';
import type { SiteNumbersData } from '../SiteNumbers';

const data: SiteNumbersData = {
  at: 1,
  site: { onSiteNow: 12, visits: { today: 40, yesterday: 55, last7: 300, last30: 1200, total: 12345 }, newBrowsers: { today: 9, last7: 80, total: 4000 }, since: '2026-11-15' },
  accounts: { total: 1500, today: 3, last7: 40 },
  online: { connections: 9, guests: 4, accounts: 5, rooms: 1, playersInGames: 3 },
};

describe('the admin numbers', () => {
  it('say each figure under its own heading, in plain words', () => {
    const rows = numberRows(data);
    expect(rows.map((g) => g.group)).toEqual(['Right now', 'Visits', 'Accounts']);
    const flat = Object.fromEntries(rows.flatMap((g) => g.rows));
    expect(flat['On the site']).toBe('12');
    expect(flat['Connected to games']).toBe('9');
    expect(flat['Guests']).toBe('4');
    expect(flat['Signed in']).toBe('5');
    expect(flat['In a room']).toBe('3 in 1 room');
    expect(flat['All time']).toBe('12,345');
    expect(flat['New browsers today']).toBe('9');
    expect(flat['All accounts']).toBe('1,500');
  });

  it('show unique visitors under their own heading when the server counts them', () => {
    const rows = numberRows({ ...data, site: { ...data.site, uniqueVisitors: { today: 30, yesterday: 41, thisWeek: 150, thisMonth: 900, total: 4000 }, uniqueSince: '2026-11-21' } });
    expect(rows.map((g) => g.group)).toEqual(['Right now', 'Visits', 'Unique visitors', 'Accounts']);
    expect(rows[2].rows).toEqual([['Today', '30'], ['Yesterday', '41'], ['This week', '150'], ['This month', '900'], ['All time', '4,000']]);
  });

  it('say "rooms" for any number but one', () => {
    const flat = Object.fromEntries(numberRows({ ...data, online: { ...data.online, rooms: 0, playersInGames: 0 } }).flatMap((g) => g.rows));
    expect(flat['In a room']).toBe('0 in 0 rooms');
  });

  it('explain each way the server can answer', () => {
    expect(describeNumbersError('not_found')).toMatch(/ADMIN_STATS_KEY/);
    expect(describeNumbersError('bad_key')).toMatch(/not right/);
    expect(describeNumbersError('rate_limited')).toMatch(/Too many/);
    expect(describeNumbersError('no_server')).toMatch(/no/);
    expect(describeNumbersError('network')).toMatch(/Could not reach/);
    expect(describeNumbersError('weird')).toMatch(/Something went wrong/);
  });
});
