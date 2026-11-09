import { useEffect, useState } from 'react';
import { useAuth } from '../../auth/authStore';
import { useSocial } from '../../state/socialStore';
import type { Metric, Period } from '../../state/socialStore';
import { NameTag } from './NameTag';

const PERIODS: [Period | 'daily', string][] = [['daily', 'Daily Table'], ['day', 'Today'], ['week', 'This week'], ['all', 'All time']];
const METRICS: [Metric, string][] = [['wins', 'Wins'], ['points', 'Points']];

export function BoardTab() {
  const { board, daily, stats, error, notice, loadBoard, loadDaily, loadStats, setVisible } = useSocial();
  const profile = useAuth((s) => s.profile);
  const [period, setPeriod] = useState<Period | 'daily'>('daily');
  const [metric, setMetric] = useState<Metric>('wins');

  useEffect(() => {
    void loadStats();
  }, [loadStats]);
  useEffect(() => {
    if (period === 'daily') void loadDaily();
    else void loadBoard(period, metric);
  }, [period, metric, loadBoard, loadDaily]);

  const tab = (on: boolean) => `min-h-11 flex-1 rounded-lg px-2 text-sm font-bold ${on ? 'bg-amber-400 text-amber-950' : 'bg-white/10'}`;
  const canShow = profile?.consentStatus === 'not_required';

  return (
    <div className="space-y-3">
      {error && <p role="alert" className="rounded-lg border border-red-400 bg-red-900/40 p-2 text-sm">{error}</p>}
      <div className="flex gap-1" role="tablist" aria-label="Period">
        {PERIODS.map(([p, label]) => <button key={p} role="tab" aria-selected={period === p} className={tab(period === p)} onClick={() => setPeriod(p)}>{label}</button>)}
      </div>
      {period !== 'daily' && (
        <div className="flex gap-1" role="tablist" aria-label="Ranked by">
          {METRICS.map(([m, label]) => <button key={m} role="tab" aria-selected={metric === m} className={tab(metric === m)} onClick={() => setMetric(m)}>{label}</button>)}
        </div>
      )}

      <ol aria-label="Leaderboard" className="space-y-1">
        {period === 'daily'
          ? daily?.rows.map((r) => (
              <li key={r.rank} className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-1">
                <span className="w-6 text-right font-black text-amber-300">{r.rank}</span>
                <span className="min-w-0 flex-1"><NameTag name={r.name} cosmetics={r.cosmetics} /></span>
                <span className="font-black">{r.banked}</span>
                <span className="w-16 truncate text-right text-xs text-white/60">{r.longestWord}</span>
              </li>
            ))
          : board?.rows.map((r) => (
              <li key={r.rank} className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-1">
                <span className="w-6 text-right font-black text-amber-300">{r.rank}</span>
                <span className="min-w-0 flex-1"><NameTag name={r.name} cosmetics={r.cosmetics} /></span>
                <span className="font-black">{r.value}</span>
                <span className="w-14 text-right text-xs text-white/60">{r.games} game{r.games === 1 ? '' : 's'}</span>
              </li>
            ))}
      </ol>
      {(period === 'daily' ? daily?.rows.length === 0 : board?.rows.length === 0) && <p className="text-sm text-white/60">Nobody here yet. Play a game to be first.</p>}
      {period === 'daily' && <p className="text-xs text-white/50">Today's Daily Table (UTC day), best score first. One try per day.</p>}

      <section aria-label="Your stats" className="rounded-xl bg-white/5 p-3">
        <h3 className="text-sm font-black uppercase tracking-wider text-white/60">Your stats</h3>
        {stats ? (
          <dl className="mt-1 grid grid-cols-3 gap-2 text-center text-sm">
            {([['Games', stats.gamesPlayed], ['Wins', stats.wins], ['Points', stats.points], ['Best score', stats.bestScore], ['Longest word', stats.longestWord ? stats.longestWord.toUpperCase() : '—']] as const).map(([k, v]) => (
              <div key={k}><dt className="text-xs text-white/50">{k}</dt><dd className="truncate font-black">{v}</dd></div>
            ))}
          </dl>
        ) : <p className="text-sm text-white/60">Loading…</p>}
        {notice && <p role="status" className="mt-2 text-sm text-sky-200">{notice}</p>}
        {canShow ? (
          <label className="mt-2 flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" checked={profile?.leaderboardVisible !== false} onChange={(e) => void setVisible(e.target.checked)} />
            Show me on the leaderboards
          </label>
        ) : (
          <p className="mt-2 text-xs text-white/60">Players who needed a parent's permission are never shown on the leaderboards.</p>
        )}
      </section>
    </div>
  );
}
