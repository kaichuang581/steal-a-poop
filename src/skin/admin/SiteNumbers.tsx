import { useCallback, useEffect, useState } from 'react';
import { ApiError, api } from '../../auth/authStore';
import { apiBase } from '../../auth/config';
import { load, save } from '../../lib/storage';
import { ClothButton, WoodButton } from '../components/Materials';
import './siteNumbers.css';

/**
 * The admin panel's numbers (requested by Kai, 2026-11-15): who is on the site and in games right now, how many have visited,
 * and how many accounts there are. They come from the game server, which only answers with the stats key (ADMIN_STATS_KEY on
 * the server): the admin lock on this page is only a convenience, so it is not what keeps the numbers private. The key is
 * typed here once and kept on this device.
 */
export interface SiteNumbersData {
  at: number;
  site: {
    onSiteNow: number;
    visits: { today: number; yesterday: number; last7: number; last30: number; total: number };
    newBrowsers: { today: number; last7: number; total: number };
    /** Absent from a server from before unique visitors were counted. */
    uniqueVisitors?: { today: number; yesterday: number; thisWeek: number; thisMonth: number; total: number };
    since: string | null;
    uniqueSince?: string | null;
  };
  accounts: { total: number; today: number; last7: number };
  online: { connections: number; guests: number; accounts: number; rooms: number; playersInGames: number };
}

export const STATS_KEY = 'sap:stats-key';
export const REFRESH_MS = 15_000;

const n = (v: number) => v.toLocaleString();

export function describeNumbersError(code: string): string {
  switch (code) {
    case 'not_found': return 'This server has no stats key set (ADMIN_STATS_KEY), so the numbers are switched off.';
    case 'bad_key': return 'That key is not right.';
    case 'rate_limited': return 'Too many tries. Wait a while and try again.';
    case 'no_server': return 'These numbers come from the game server, and this copy of the game has none.';
    case 'network': return 'Could not reach the game server.';
    default: return 'Something went wrong asking the server.';
  }
}

/** Rows for the list: a label, and what it counts. Pure, so the page and the tests read the same words. */
export function numberRows(d: SiteNumbersData): Array<{ group: string; rows: Array<[string, string]> }> {
  return [
    {
      group: 'Right now',
      rows: [
        ['On the site', n(d.site.onSiteNow)],
        ['Connected to games', n(d.online.connections)],
        ['Guests', n(d.online.guests)],
        ['Signed in', n(d.online.accounts)],
        ['In a room', `${n(d.online.playersInGames)} in ${n(d.online.rooms)} ${d.online.rooms === 1 ? 'room' : 'rooms'}`],
      ],
    },
    {
      group: 'Visits',
      rows: [
        ['Today', n(d.site.visits.today)],
        ['Yesterday', n(d.site.visits.yesterday)],
        ['Last 7 days', n(d.site.visits.last7)],
        ['Last 30 days', n(d.site.visits.last30)],
        ['All time', n(d.site.visits.total)],
        ['New browsers today', n(d.site.newBrowsers.today)],
        ['New browsers, 7 days', n(d.site.newBrowsers.last7)],
        ['New browsers, all time', n(d.site.newBrowsers.total)],
      ],
    },
    ...(d.site.uniqueVisitors ? [{
      // Browsers, not visits: a browser that comes back ten times today is one (Brian, 2026-11-21).
      group: 'Unique visitors',
      rows: [
        ['Today', n(d.site.uniqueVisitors.today)],
        ['Yesterday', n(d.site.uniqueVisitors.yesterday)],
        ['This week', n(d.site.uniqueVisitors.thisWeek)],
        ['This month', n(d.site.uniqueVisitors.thisMonth)],
        ['All time', n(d.site.uniqueVisitors.total)],
      ] as Array<[string, string]>,
    }] : []),
    {
      group: 'Accounts',
      rows: [
        ['All accounts', n(d.accounts.total)],
        ['Made today', n(d.accounts.today)],
        ['Made in 7 days', n(d.accounts.last7)],
      ],
    },
  ];
}

export function SiteNumbers() {
  const [key, setKey] = useState(() => load<string>(STATS_KEY, ''));
  const [draft, setDraft] = useState('');
  const [data, setData] = useState<SiteNumbersData | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const hasServer = !!apiBase();

  const refresh = useCallback(async () => {
    if (!key) return;
    setBusy(true);
    try {
      setData(await api<SiteNumbersData>('POST', '/api/admin/stats', null, { key }));
      setError('');
    } catch (e) {
      const code = e instanceof ApiError ? e.code : 'other';
      setError(describeNumbersError(code));
      if (code === 'bad_key') { setKey(''); save(STATS_KEY, ''); setData(null); }
    } finally {
      setBusy(false);
    }
  }, [key]);

  useEffect(() => {
    if (!key || !hasServer) return;
    void refresh();
    const t = setInterval(() => void refresh(), REFRESH_MS);
    return () => clearInterval(t);
  }, [key, hasServer, refresh]);

  const saveKey = (e: React.FormEvent) => {
    e.preventDefault();
    const k = draft.trim();
    if (!k) return;
    save(STATS_KEY, k);
    setKey(k);
    setDraft('');
    setError('');
  };

  return (
    <section className="sk-paper mt-3 p-2" aria-label="Site numbers">
      <div className="flex items-center justify-between gap-2">
        <b className="sk-display block text-base">Numbers</b>
        {key && <ClothButton className="sk-btn" onClick={() => void refresh()} disabled={busy}>{busy ? 'Asking...' : 'Refresh'}</ClothButton>}
      </div>
      {!hasServer ? (
        <p className="sk-hand text-sm leading-tight" style={{ color: 'var(--ink-soft)' }}>{describeNumbersError('no_server')}</p>
      ) : !key ? (
        <form onSubmit={saveKey}>
          <p className="sk-hand text-sm leading-tight" style={{ color: 'var(--ink-soft)' }}>Type the stats key to see visits, who is on now and how many accounts there are.</p>
          <input
            className="sk-field mt-1 w-full" type="password" autoComplete="off" aria-label="Stats key" placeholder="Stats key"
            value={draft} onChange={(e) => setDraft(e.target.value)}
          />
          <WoodButton className="sk-btn mt-1 w-full" disabled={!draft.trim()}>Show the numbers</WoodButton>
        </form>
      ) : (
        <>
          {data && (
            <div className="sk-nums">
              {numberRows(data).map((g) => (
                <dl key={g.group} aria-label={g.group}>
                  <dt className="sk-nums-group">{g.group}</dt>
                  {g.rows.map(([label, value]) => (
                    <div key={label} className="sk-nums-row"><dt>{label}</dt><dd>{value}</dd></div>
                  ))}
                </dl>
              ))}
              <p className="sk-nums-note">
                {data.site.since ? `Visits counted since ${data.site.since}. ` : 'No visits counted yet. '}
                {data.site.uniqueVisitors && (data.site.uniqueSince ? `Unique visitors counted since ${data.site.uniqueSince}. ` : 'No unique visitors counted yet. ')}
                Only numbers are kept, never who. Updates every 15 seconds.
              </p>
            </div>
          )}
          {!data && !error && <p className="sk-hand text-sm" style={{ color: 'var(--ink-soft)' }}>Asking the server...</p>}
          <button type="button" className="sk-nums-link" onClick={() => { setKey(''); save(STATS_KEY, ''); setData(null); setError(''); }}>Forget the stats key on this device</button>
        </>
      )}
      {error && <p role="alert" className="sk-hand mt-1 text-sm" style={{ color: 'var(--coral-dark)' }}>{error}</p>}
    </section>
  );
}
