import { useState } from 'react';
import pkg from '../../../package.json';
import { useAuth } from '../../auth/authStore';
import { authEnabled } from '../../auth/config';
import { MAX_PLAYERS, MIN_PLAYERS, utcDateKey } from '../../engine';
import type { Difficulty } from '../../engine';
import { getDaily, getStreak } from '../../lib/daily';
import { checkNickname, MAX_NICKNAME } from '../../lib/nickname';
import { buildShareText } from '../../lib/share';
import { getServerUrl } from '../../net/config';
import { useRoomStore } from '../../state/roomStore';
import { useSocial } from '../../state/socialStore';
import { useStore } from '../../state/store';
import { AuthDialog } from '../../ui/auth/AuthDialog';
import { Guide } from '../../ui/Guide';
import { LEGAL_TITLES, legalHref } from '../../ui/legal/legalLinks';
import { Hub } from '../../ui/social/Hub';
import type { HubTab } from '../../ui/social/Hub';
import { Keeper } from '../components/Keeper';
import { Lantern, StreakString } from '../components/Lantern';
import { Chip, PaperPanel, WoodButton } from '../components/Materials';
import { Scene } from '../components/Scene';
import { Ticket } from '../components/Ticket';
import { useHour, useMotionLevel } from '../hooks/useAmbient';
import { streakDays } from '../model/useTableView';
import { PaintedSettings } from './PaintedSettings';

export const PAINTED_TITLE = 'Finish the Word';
const DIFFS: Difficulty[] = ['easy', 'medium', 'hard'];
const COUNTS = Array.from({ length: MAX_PLAYERS - MIN_PLAYERS + 1 }, (_, i) => MIN_PLAYERS + i);

/** Home and Quick Game setup on one screen in the meadow: mode tickets, nickname, bots and difficulty. */
export function PaintedHome() {
  const { settings, setSettings, start, startTour, dictStatus, retryDictionary } = useStore();
  const [help, setHelp] = useState(false);
  const [gear, setGear] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [signIn, setSignIn] = useState(false);
  const [hub, setHub] = useState<HubTab | null>(null);
  const coins = useSocial((st) => st.balance);
  const roomNotice = useRoomStore((st) => st.notice);
  const authStatus = useAuth((st) => st.status);
  const hour = useHour();
  const reduced = useMotionLevel() === 'reduced';
  const today = utcDateKey(new Date());
  const daily = getDaily(today);
  const streak = getStreak(today);
  const ready = dictStatus === 'ready';
  const rooms = !!getServerUrl();
  const signedIn = authEnabled() && authStatus === 'ready';

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
      steals: daily.steals ?? 0, longest: daily.longest ?? 0, streak,
    });
    try { await navigator.clipboard.writeText(text); } catch { window.prompt('Copy your result:', text); }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const openRooms = () => {
    // With real sign-in the nickname comes from the account, and a login is required first.
    if (authEnabled()) {
      if (authStatus !== 'ready') return setSignIn(true);
      return useRoomStore.getState().openLobby(useAuth.getState().profile?.nickname ?? '');
    }
    const nick = checkNickname(settings.name);
    if (!nick.ok) return setError(nick.message);
    setError('');
    useRoomStore.getState().openLobby(nick.name);
  };
  const nextTable = new Date(`${today}T00:00:00Z`);
  nextTable.setUTCDate(nextTable.getUTCDate() + 1);

  return (
    <main className="relative h-full overflow-y-auto">
      <div className="fixed inset-0 -z-0"><Scene place="meadow" hour={hour} season="winter" wind={0.7} frozen={false} still={reduced} /></div>
      <div className="relative mx-auto flex min-h-full w-full max-w-md flex-col justify-center gap-3 px-4 py-6">
        <div className="flex flex-col items-center">
          <div className="flex items-end gap-1">
            <Keeper mood={daily ? 'sleepy' : 'idle'} size={70} />
            <Lantern points={20} state="lit" sizeCap={56} />
          </div>
          <h1 className="sk-display mt-1 text-center text-4xl sm:text-5xl" style={{ color: 'var(--wood-ink)', textShadow: '0 2px 0 var(--paper)' }}>{PAINTED_TITLE}</h1>
          <p className="sk-hand text-lg" style={{ color: 'var(--ink)' }}>Chain words. Grow the lantern. Don’t get stolen from.</p>
        </div>

        <PaperPanel className="space-y-3 p-4">
          <label className="block">
            <span className="sk-hand text-base" style={{ color: 'var(--ink-soft)' }}>Your name</span>
            <input
              value={settings.name}
              onChange={(e) => { setSettings({ name: e.target.value.slice(0, MAX_NICKNAME) }); setError(''); }}
              maxLength={MAX_NICKNAME} placeholder="You" autoComplete="off" spellCheck={false}
              className="mt-1 min-h-12 w-full rounded-xl px-4 text-lg font-extrabold outline-none"
              style={{ background: 'var(--paper)', boxShadow: 'inset 0 0 0 2px var(--paper-edge)', color: 'var(--ink)' }}
            />
            {error && <span role="alert" className="mt-1 block text-sm font-bold" style={{ color: 'var(--coral-dark)' }}>{error}</span>}
          </label>
          <fieldset>
            <legend className="sk-hand text-base" style={{ color: 'var(--ink-soft)' }}>Players at the table</legend>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {COUNTS.map((c) => (
                <Chip key={c} onClick={() => setSettings({ playerCount: c })} aria-pressed={settings.playerCount === c}>{c}</Chip>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="sk-hand text-base" style={{ color: 'var(--ink-soft)' }}>Bot difficulty</legend>
            <div className="mt-1 flex gap-1.5">
              {DIFFS.map((d) => (
                <Chip key={d} onClick={() => setSettings({ difficulty: d })} aria-pressed={settings.difficulty === d} className="capitalize">
                  {{ easy: '🌱', medium: '🍃', hard: '🌰' }[d]} {d}
                </Chip>
              ))}
            </div>
          </fieldset>
        </PaperPanel>

        <Ticket
          icon="🏮" tone="cloth" title={ready ? 'Quick Game' : 'Loading words…'} disabled={!ready}
          line={`You and ${settings.playerCount - 1} bots in the meadow`} onSelect={() => go('quick')}
        />
        {dictStatus === 'error' && (
          <PaperPanel role="alert" className="p-3 text-center">
            <p className="text-sm font-bold" style={{ color: 'var(--coral-dark)' }}>The word list did not load. Check your connection, then try again.</p>
            <WoodButton onClick={() => void retryDictionary()} className="mt-2">Retry</WoodButton>
          </PaperPanel>
        )}
        {daily ? (
          <Ticket
            icon={<Keeper mood="asleep" size={34} />} disabled={daily.status !== 'done'} onSelect={shareDaily}
            title={daily.status === 'done' ? (copied ? 'Copied!' : `Daily done · #${daily.rank} · share`) : 'Daily attempt used'}
            line={`The next table opens at ${nextTable.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
          />
        ) : (
          <Ticket
            icon="⛵" title="Daily Table" line="One attempt today, the same table for everyone" disabled={!ready}
            onSelect={() => {
              // Signed in: the server runs the Daily Table (so it can be on the leaderboard). Otherwise it is played on this device only.
              if (signedIn && rooms) return useRoomStore.getState().startDaily();
              go('daily');
            }}
          />
        )}
        {(streak > 0 || daily) && (
          <div className="text-center">
            <StreakString days={streakDays()} />
            {streak > 0 && <p className="sk-hand" style={{ color: 'var(--ink)' }}>{streak}-day streak</p>}
          </div>
        )}
        <Ticket icon="☔" title="Practice" line="Easy bots, 25-second turns, no penalties, hints" disabled={!ready} onSelect={() => go('practice')} />
        <Ticket icon="🍵" title="Tutorial" line="A guided first game in the kitchen" disabled={!ready} onSelect={() => startTour('menu')} />
        <Ticket
          icon="🏯" title="Play with others" line={rooms ? '4 to 10 people in a room' : 'Rooms open when the game server is live'}
          disabled={!rooms} onSelect={openRooms}
        />
        {signedIn && rooms && (
          <div className="flex gap-2" role="group" aria-label="Community">
            {([['friends', '👥 Friends'], ['boards', '🏆 Boards'], ['shop', '🛍️ Shop']] as const).map(([t, label]) => (
              <WoodButton key={t} onClick={() => setHub(t)} className="flex-1 text-sm">{label}</WoodButton>
            ))}
            {coins !== null && <span aria-label="Coins" className="sk-chip">{coins} 🪙</span>}
          </div>
        )}
        {roomNotice && !useRoomStore.getState().open && <p role="status" className="sk-hand text-center">{roomNotice}</p>}
        <div className="flex gap-2">
          <WoodButton onClick={() => setHelp(true)} className="flex-1">How to Play</WoodButton>
          <WoodButton onClick={() => setGear(true)} aria-label="Settings">⚙️</WoodButton>
        </div>
        <footer className="sk-paper flex flex-wrap items-center justify-center gap-x-4 px-3 py-1 text-xs" style={{ color: 'var(--ink-soft)' }}>
          <span>v{pkg.version}</span>
          <a className="min-h-11 content-center underline" href="https://github.com/kaichuang581/steal-a-poop/issues/new/choose" target="_blank" rel="noreferrer">Send feedback</a>
          {(['privacy', 'terms', 'child-safety'] as const).map((slug) => (
            <a key={slug} className="min-h-11 content-center underline" href={legalHref(slug)} target="_blank" rel="noopener">{LEGAL_TITLES[slug]}</a>
          ))}
        </footer>
      </div>
      {signIn && <AuthDialog onClose={() => setSignIn(false)} />}
      {hub && <Hub initial={hub} onClose={() => setHub(null)} />}
      {help && <Guide onClose={() => setHelp(false)} />}
      {gear && <PaintedSettings onClose={() => setGear(false)} />}
    </main>
  );
}
