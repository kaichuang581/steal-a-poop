import { FeedbackDialog } from '../skin/components/FeedbackDialog';
import { Px } from '../skin/components/PixelIcons';
import { FireIcon } from '../skin/components/PixelIcons';
import { LEGAL_TITLES, legalHref } from './legal/legalLinks';
import { authEnabled } from '../auth/config';
import { useAuth } from '../auth/authStore';
import { AuthDialog } from './auth/AuthDialog';
import { Hub } from './social/Hub';
import type { HubTab } from './social/Hub';
import { useSocial } from '../state/socialStore';
import { useState } from 'react';
import pkg from '../../package.json';
import { GAME_TAGLINE, GAME_TITLE } from '../config';
import { MAX_PLAYERS, MIN_PLAYERS, utcDateKey } from '../engine';
import type { Difficulty } from '../engine';
import { getDaily, getStreak } from '../lib/daily';
import { checkNickname, MAX_NICKNAME } from '../lib/nickname';
import { buildShareText } from '../lib/share';
import { getServerUrl } from '../net/config';
import { useRoomStore } from '../state/roomStore';
import { useStore } from '../state/store';
import { Guide } from './Guide';
import { Settings } from './Settings';

const DIFFS: Difficulty[] = ['easy', 'medium', 'hard'];
const COUNTS = Array.from({ length: MAX_PLAYERS - MIN_PLAYERS + 1 }, (_, i) => MIN_PLAYERS + i);

export function StartScreen() {
  const { settings, setSettings, start, startTour, dictStatus, retryDictionary } = useStore();
  const [help, setHelp] = useState(false);
  const [gear, setGear] = useState(false);
  const [feedback, setFeedback] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [signIn, setSignIn] = useState(false);
  const [hub, setHub] = useState<HubTab | null>(null);
  const coins = useSocial((st) => st.balance);
  const roomNotice = useRoomStore((st) => st.notice);
  const authStatus = useAuth((st) => st.status);
  const today = utcDateKey(new Date());
  const daily = getDaily(today);
  const streak = getStreak(today);
  const ready = dictStatus === 'ready';

  const go = (mode: 'quick' | 'daily' | 'practice') => {
    const nick = checkNickname(settings.name);
    if (!nick.ok) return setError(nick.message);
    setError('');
    start(mode);
  };

  const shareDaily = async () => {
    if (daily?.status !== 'done') return;
    const text = buildShareText({
      daily: today, rank: daily.rank ?? 1, players: daily.players ?? 0, banked: daily.banked ?? 0,
      longest: daily.longest ?? 0, streak,
    });
    try { await navigator.clipboard.writeText(text); } catch { window.prompt('Copy your result:', text); }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const seg = (on: boolean) =>
    `min-h-11 min-w-10 flex-1 rounded-lg px-2 text-sm font-bold capitalize ${on ? 'bg-amber-400 text-amber-950' : 'bg-white/10 hover:bg-white/15'}`;

  return (
    <main className="flex h-full flex-col items-center justify-center overflow-y-auto px-4 py-6">
      <div className="w-full max-w-md">
        <div className="text-center">
          <div className="text-6xl" aria-hidden="true"><Px e="💩" size={64} /></div>
          <h1 className="mt-1 text-4xl font-black tracking-tight text-amber-300 sm:text-5xl">{GAME_TITLE}</h1>
          <p className="mt-1 text-sm text-white/70">{GAME_TAGLINE}</p>
        </div>

        <div className="mt-6 space-y-4 rounded-3xl border border-white/10 bg-white/5 p-4">
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wide text-white/60">Nickname</span>
            <input
              value={settings.name}
              onChange={(e) => { setSettings({ name: e.target.value.slice(0, MAX_NICKNAME) }); setError(''); }}
              maxLength={MAX_NICKNAME} placeholder="You" autoComplete="off" spellCheck={false}
              className="mt-1 min-h-12 w-full rounded-xl border-2 border-white/20 bg-black/40 px-4 text-lg font-bold focus:border-amber-300 focus:outline-none"
            />
            {error && <span role="alert" className="mt-1 block text-sm font-bold text-red-300">{error}</span>}
          </label>

          <fieldset>
            <legend className="text-xs font-bold uppercase tracking-wide text-white/60">Players</legend>
            <div className="mt-1 flex gap-1.5">
              {COUNTS.map((c) => (
                <button key={c} onClick={() => setSettings({ playerCount: c })} aria-pressed={settings.playerCount === c} className={seg(settings.playerCount === c)}>{c}</button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-xs font-bold uppercase tracking-wide text-white/60">Bot difficulty</legend>
            <div className="mt-1 flex gap-1.5">
              {DIFFS.map((d) => (
                <button key={d} onClick={() => setSettings({ difficulty: d })} aria-pressed={settings.difficulty === d} className={seg(settings.difficulty === d)}>{d}</button>
              ))}
            </div>
          </fieldset>

          <div className="flex flex-col gap-2 pt-1">
            <button
              onClick={() => go('quick')} disabled={!ready}
              className="min-h-12 rounded-xl bg-emerald-500 text-lg font-black text-emerald-950 disabled:opacity-40"
            >
              {ready ? 'Quick Game' : 'Loading dictionary…'}
            </button>
            {dictStatus === 'error' && (
              <div role="alert" className="rounded-xl border-2 border-red-300 bg-red-900/40 p-3 text-center">
                <p className="text-sm font-bold">The word list did not load. Check your connection, then try again.</p>
                <button
                  onClick={() => void retryDictionary()}
                  className="mt-2 min-h-11 rounded-lg bg-red-300 px-4 font-black text-red-950"
                >
                  Retry
                </button>
              </div>
            )}
            {daily ? (
              <button
                onClick={shareDaily} disabled={daily.status !== 'done'}
                className="min-h-12 rounded-xl bg-fuchsia-700/60 text-base font-black disabled:opacity-60"
              >
                {daily.status === 'done' ? (copied ? 'Copied!' : `Daily done · #${daily.rank} · share`) : 'Daily attempt used — back tomorrow'}
              </button>
            ) : (
              <button
                onClick={() => {
                  // Signed in: the server runs the Daily Table (so it can be on the leaderboard). Otherwise it is played on this device only.
                  if (authEnabled() && authStatus === 'ready' && getServerUrl()) return useRoomStore.getState().startDaily();
                  go('daily');
                }} disabled={!ready}
                className="min-h-12 rounded-xl bg-fuchsia-700 text-lg font-black disabled:opacity-40"
              >
                Daily Table <span className="text-sm font-bold">· one attempt</span>
              </button>
            )}
            {streak > 0 && <p className="text-center text-sm text-amber-200"><FireIcon size={14} /> {streak}-day streak</p>}
            {getServerUrl() && (
              <button
                onClick={() => {
                  // With real sign-in the nickname comes from the account, and a login is required first.
                  if (authEnabled()) {
                    if (authStatus !== 'ready') return setSignIn(true);
                    return useRoomStore.getState().openLobby(useAuth.getState().profile?.nickname ?? '');
                  }
                  const nick = checkNickname(settings.name);
                  if (!nick.ok) return setError(nick.message);
                  setError('');
                  useRoomStore.getState().openLobby(nick.name);
                }}
                className="min-h-12 rounded-xl bg-orange-500 text-lg font-black text-orange-950"
              >
                Play with others <span className="text-sm font-bold">· rooms</span>
              </button>
            )}
            {authEnabled() && authStatus === 'ready' && getServerUrl() && (
              <div className="flex gap-2" role="group" aria-label="Community">
                {([['friends', '👥', 'Friends'], ['boards', '🏆', 'Boards'], ['shop', '🛍️', 'Shop']] as const).map(([t, ico, label]) => (
                  <button key={t} onClick={() => setHub(t)} className="min-h-12 flex-1 rounded-xl bg-white/10 text-sm font-bold hover:bg-white/15" aria-label={label} title={label}><Px e={ico} size={20} /></button>
                ))}
                {coins !== null && <span aria-label="Coins" className="flex min-h-12 items-center rounded-xl bg-black/30 px-3 font-black">{coins} <Px e="🪙" /></span>}
              </div>
            )}
            {roomNotice && !useRoomStore.getState().open && <p role="status" className="text-center text-sm text-amber-200">{roomNotice}</p>}
            <button
              onClick={() => go('practice')} disabled={!ready}
              className="min-h-12 rounded-xl bg-sky-500/70 font-black disabled:opacity-40"
            >
              Practice <span className="text-sm font-bold">· 1v1, one life, high score</span>
            </button>
            <div className="flex gap-2">
              <button onClick={() => startTour('menu')} disabled={!ready} className="min-h-12 flex-1 rounded-xl bg-white/10 font-bold hover:bg-white/15 disabled:opacity-40">Tutorial</button>
              <button onClick={() => setHelp(true)} className="min-h-12 flex-1 rounded-xl bg-white/10 font-bold hover:bg-white/15">How to Play</button>
              <button onClick={() => setGear(true)} className="min-h-12 min-w-12 rounded-xl bg-white/10 text-lg hover:bg-white/15" aria-label="Settings" title="Settings"><Px e="⚙" size={20} /></button>
            </div>
          </div>
        </div>
      </div>
      <footer className="mt-4 flex items-center justify-center gap-4 text-xs text-white/55">
        <span>v{pkg.version}</span>
        <button className="min-h-11 content-center underline" onClick={() => setFeedback(true)}>Send feedback</button>
        {feedback && <FeedbackDialog onClose={() => setFeedback(false)} />}
        {(['privacy', 'terms', 'child-safety'] as const).map((slug) => (
          <a key={slug} className="min-h-11 min-w-11 content-center text-center underline" href={legalHref(slug)} target="_blank" rel="noopener">
            {LEGAL_TITLES[slug]}
          </a>
        ))}
      </footer>
      {signIn && <AuthDialog onClose={() => setSignIn(false)} />}
      {hub && <Hub initial={hub} onClose={() => setHub(null)} />}
      {help && <Guide onClose={() => setHelp(false)} />}
      {gear && <Settings onClose={() => setGear(false)} />}
    </main>
  );
}
