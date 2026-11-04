import { useState } from 'react';
import type { PointerEvent, ReactNode } from 'react';
import pkg from '../../../package.json';
import { useAuth } from '../../auth/authStore';
import { authEnabled } from '../../auth/config';
import { estimateMinutes, MAX_PLAYERS, MIN_PLAYERS, PRESETS, presetOf, utcDateKey } from '../../engine';
import type { Difficulty, GameSettings, PresetId } from '../../engine';
import { getDaily, getStreak } from '../../lib/daily';
import { checkNickname, MAX_NICKNAME } from '../../lib/nickname';
import { buildShareText } from '../../lib/share';
import { getServerUrl } from '../../net/config';
import { useRoomStore } from '../../state/roomStore';
import { useSocial } from '../../state/socialStore';
import { useStore } from '../../state/store';
import { AuthDialog } from '../../ui/auth/AuthDialog';
import { Guide } from '../../ui/Guide';
import { useIsMobile } from '../../ui/hooks';
import { LEGAL_TITLES, legalHref } from '../../ui/legal/legalLinks';
import { Hub } from '../../ui/social/Hub';
import type { HubTab } from '../../ui/social/Hub';
import { AcornIcon, BookIcon, GearIcon, HelpIcon, LanternIcon, LanternStringIcon, LeafIcon, SeedlingIcon, SpeakerIcon } from '../components/Icons';
import { StreakString } from '../components/Lantern';
import { Chip, PaperPanel, WoodButton } from '../components/Materials';
import { SheepIcon } from '../components/SheepIcon';
import { Ticket } from '../components/Ticket';
import { useHour, useMotionLevel } from '../hooks/useAmbient';
import { streakDays } from '../model/useTableView';
import { DevLine } from '../table/DevStats';
import { FarmBackdrop } from '../table/FarmBackdrop';
import { PaintedSettings } from './PaintedSettings';

export const PAINTED_TITLE = 'Finish the Word';
const DIFFS: { id: Difficulty; icon: ReactNode }[] = [
  { id: 'easy', icon: <SeedlingIcon /> }, { id: 'medium', icon: <LeafIcon /> }, { id: 'hard', icon: <AcornIcon /> },
];
const COUNTS = Array.from({ length: MAX_PLAYERS - MIN_PLAYERS + 1 }, (_, i) => MIN_PLAYERS + i);
const PRESET_IDS: PresetId[] = ['quick', 'standard', 'long', 'custom'];
const RULES: { key: keyof GameSettings; label: string; values: (number | string | boolean)[]; show?: (v: number | string | boolean) => string }[] = [
  { key: 'rounds', label: 'Rounds', values: [1, 2, 3, 5] },
  { key: 'turnsPerRound', label: 'Turns per round', values: [3, 5, 7] },
  { key: 'turnSeconds', label: 'Seconds per turn', values: [5, 8, 10, 12, 15] },
  { key: 'lives', label: 'Lives', values: [1, 2, 3, 5, 'unlimited'], show: (v) => (v === 'unlimited' ? '∞' : String(v)) },
  { key: 'twists', label: 'Round twists', values: [true, false], show: (v) => (v ? 'On' : 'Off') },
  { key: 'stealWindowSeconds', label: 'Steal window', values: [0, 3, 5], show: (v) => (v === 0 ? 'Off' : `${v} s`) },
];

/**
 * The start screen (plan V3.1 Part 2): the farm diorama behind a title sign, and a two-step panel: choose a table,
 * then set it. Every control calls the store's existing functions; Daily and Practice start at once.
 */
export function PaintedHome() {
  const { settings, setSettings, start, startTour, dictStatus, retryDictionary, muted, toggleMute } = useStore();
  const [step, setStep] = useState<'tables' | 'setup'>('tables');
  const [help, setHelp] = useState(false);
  const [gear, setGear] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [signIn, setSignIn] = useState(false);
  const [hub, setHub] = useState<HubTab | null>(null);
  const [heroYaw, setHeroYaw] = useState(0);
  const [hopKey, setHopKey] = useState(0);
  const coins = useSocial((st) => st.balance);
  const roomNotice = useRoomStore((st) => st.notice);
  const authStatus = useAuth((st) => st.status);
  const hour = useHour();
  const reduced = useMotionLevel() === 'reduced';
  const mobile = useIsMobile();
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
  // Game length (plan V3.3 Part 2.6): a preset sets every rule; touching a rule makes it Custom. Saved with the other settings.
  const rules = settings.game;
  const preset = presetOf(rules);
  const setRule = (patch: Partial<GameSettings>) => setSettings({ game: { ...rules, ...patch } });
  const minutes = estimateMinutes({ ...rules, botCount: settings.playerCount - 1, botDifficulty: settings.difficulty });
  const nextTable = new Date(`${today}T00:00:00Z`);
  nextTable.setUTCDate(nextTable.getUTCDate() + 1);
  // The hero looks toward the pointer: up to 0.3 rad either way across the width of the screen.
  const onPointerMove = (e: PointerEvent) => {
    if (mobile || reduced) return;
    setHeroYaw(((e.clientX / window.innerWidth) * 2 - 1) * 0.3);
  };

  const link = 'min-h-11 content-center text-left text-sm font-bold underline decoration-2 underline-offset-2 disabled:no-underline disabled:opacity-60';
  const tables = (
    <div className={`flex flex-col gap-3 ${mobile ? '' : 'sk-slide-in'}`} key="tables">
      <Ticket icon={<LanternIcon />} tone="cloth" title={ready ? 'Quick Game' : 'Loading words…'} disabled={!ready} line="You and the bots in the barn" onSelect={() => setStep('setup')} />
      {daily ? (
        <Ticket
          icon={<LanternStringIcon />} disabled={daily.status !== 'done'} onSelect={shareDaily}
          title={daily.status === 'done' ? (copied ? 'Copied!' : `Daily done · #${daily.rank} · share`) : 'Daily attempt used'}
          line={`The next table opens at ${nextTable.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
        />
      ) : (
        <Ticket
          icon={<LanternStringIcon />} title="Daily Table" line="One attempt today; the same table for everyone" disabled={!ready}
          onSelect={() => {
            // Signed in: the server runs the Daily Table (so it can be on the leaderboard). Otherwise it is played on this device only.
            if (signedIn && rooms) return useRoomStore.getState().startDaily();
            go('daily');
          }}
        />
      )}
      <Ticket icon={<BookIcon />} title="Practice" line="Easy bots, 25-second turns, no penalties, hints" disabled={!ready} onSelect={() => go('practice')} />
      {dictStatus === 'error' && (
        <PaperPanel role="alert" className="p-3 text-center">
          <p className="text-sm font-bold" style={{ color: 'var(--coral-dark)' }}>The word list did not load. Check your connection, then try again.</p>
          <WoodButton onClick={() => void retryDictionary()} className="mt-2">Retry</WoodButton>
        </PaperPanel>
      )}
      {error && <p role="alert" className="sk-paper px-3 py-1 text-sm font-bold" style={{ color: 'var(--coral-dark)' }}>{error}</p>}
      <div className="sk-paper flex flex-col px-4 py-1">
        <button className={link} disabled={!ready} onClick={() => startTour('menu')}>Tutorial <span className="font-semibold" style={{ color: 'var(--ink-soft)' }}>· A guided first game with the sheepdog</span></button>
        <button className={link} disabled={!rooms} onClick={openRooms}>Play with others <span className="font-semibold" style={{ color: 'var(--ink-soft)' }}>· {rooms ? '4 to 10 people in the big barn' : 'Rooms open when the game server is live'}</span></button>
      </div>
      {(streak > 0 || daily) && (
        <div className="text-center">
          <StreakString days={streakDays()} />
          {streak > 0 && <p className="text-sm font-bold" style={{ color: 'var(--paper)', textShadow: '0 1px 2px var(--ink)' }}>{streak}-day streak</p>}
        </div>
      )}
      {signedIn && rooms && (
        <div className="flex gap-2" role="group" aria-label="Community">
          {([['friends', '👥 Friends'], ['boards', '🏆 Boards'], ['shop', '🛍️ Shop']] as const).map(([t, label]) => (
            <WoodButton key={t} onClick={() => setHub(t)} className="flex-1 text-sm">{label}</WoodButton>
          ))}
          {coins !== null && <span aria-label="Coins" className="sk-chip">{coins} 🪙</span>}
        </div>
      )}
      {roomNotice && !useRoomStore.getState().open && <p role="status" className="sk-paper px-3 py-1 text-center text-sm">{roomNotice}</p>}
      <footer className="flex flex-wrap items-center justify-center gap-x-3 text-xs font-semibold" style={{ color: 'var(--paper)', textShadow: '0 1px 2px var(--ink)' }}>
        <span>v{pkg.version}</span>
        <a className="min-h-11 content-center underline" href="https://github.com/kaichuang581/steal-a-poop/issues/new/choose" target="_blank" rel="noreferrer">Send feedback</a>
        {(['privacy', 'terms', 'child-safety'] as const).map((slug) => (
          <a key={slug} className="min-h-11 content-center underline" href={legalHref(slug)} target="_blank" rel="noopener">{LEGAL_TITLES[slug]}</a>
        ))}
      </footer>
    </div>
  );

  const setup = (
    <PaperPanel className={`space-y-3 p-4 ${mobile ? 'sk-slide-up' : 'sk-slide-in'}`} key="setup" role="dialog" aria-label="Set the table">
      <div className="flex items-center justify-between">
        <h2 className="sk-display text-2xl">Set the table</h2>
        <button className={link} onClick={() => setStep('tables')}>Back</button>
      </div>
      <label className="block">
        <span className="text-sm font-bold" style={{ color: 'var(--ink-soft)' }}>Your name</span>
        <input
          value={settings.name}
          onChange={(e) => { setSettings({ name: e.target.value.slice(0, MAX_NICKNAME) }); setError(''); }}
          onFocus={() => setHopKey((k) => k + 1)}
          maxLength={MAX_NICKNAME} placeholder="You" autoComplete="off" spellCheck={false} autoFocus
          className="mt-1 min-h-12 w-full rounded-xl px-4 text-lg font-bold outline-none"
          style={{ background: 'var(--paper)', boxShadow: 'inset 0 0 0 2px var(--paper-edge)', color: 'var(--ink)' }}
        />
        {error && <span role="alert" className="mt-1 block text-sm font-bold" style={{ color: 'var(--coral-dark)' }}>{error}</span>}
      </label>
      <fieldset>
        <legend className="text-sm font-bold" style={{ color: 'var(--ink-soft)' }}>Game length</legend>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {PRESET_IDS.map((id) => (
            <Chip key={id} aria-pressed={preset === id} className="capitalize" onClick={() => { if (id !== 'custom') setRule(PRESETS[id]); }}>{id}</Chip>
          ))}
        </div>
        <p className="sk-hand mt-1 text-base" style={{ color: 'var(--ink-soft)' }} aria-live="polite">about {minutes} min</p>
      </fieldset>
      <fieldset>
        <legend className="text-sm font-bold" style={{ color: 'var(--ink-soft)' }}>Sheep at the table</legend>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {COUNTS.map((c) => <Chip key={c} onClick={() => setSettings({ playerCount: c })} aria-pressed={settings.playerCount === c}>{c}</Chip>)}
        </div>
        {/* One icon per seat; a seat added walks in from the left. */}
        <div className="mt-1.5 flex items-end gap-0.5" aria-hidden="true">
          {Array.from({ length: settings.playerCount }, (_, i) => (
            <span key={i} className="sk-walk-in" style={{ animationDelay: `${i * 40}ms` }}><SheepIcon size={i === 0 ? 26 : 22} /></span>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="text-sm font-bold" style={{ color: 'var(--ink-soft)' }}>Bot difficulty</legend>
        <div className="mt-1 flex gap-1.5">
          {DIFFS.map((d) => (
            <Chip key={d.id} onClick={() => setSettings({ difficulty: d.id })} aria-pressed={settings.difficulty === d.id} className="capitalize">{d.icon} {d.id}</Chip>
          ))}
        </div>
      </fieldset>
      <details className="rounded-xl px-3 py-1" style={{ background: 'var(--paper-edge)' }} open={preset === 'custom'}>
        <summary className="cursor-pointer text-sm font-bold" style={{ color: 'var(--ink-soft)' }}>Custom rules</summary>
        <div className="space-y-2 py-2">
          {RULES.map((r) => (
            <fieldset key={r.key}>
              <legend className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>{r.label}</legend>
              <div className="mt-1 flex flex-wrap gap-1">
                {r.values.map((v) => (
                  <Chip key={String(v)} aria-pressed={rules[r.key] === v} onClick={() => setRule({ [r.key]: v } as Partial<GameSettings>)}>{r.show ? r.show(v) : String(v)}</Chip>
                ))}
              </div>
            </fieldset>
          ))}
        </div>
      </details>
      <WoodButton onClick={() => go('quick')} disabled={!ready} className="w-full text-lg">Sit down</WoodButton>
    </PaperPanel>
  );

  return (
    <main className="relative h-full overflow-hidden" onPointerMove={onPointerMove}>
      <div className="absolute inset-0"><FarmBackdrop hour={hour} reduced={reduced} sleepy={!!daily} phone={mobile} heroYaw={heroYaw} hopKey={hopKey} /></div>

      {/* The title on a snow-capped wooden sign, upper left over the sky. */}
      <div className={`absolute ${mobile ? 'inset-x-4 top-4' : 'left-10 top-8 w-[30rem]'}`}>
        <svg viewBox="0 0 100 8" preserveAspectRatio="none" className="absolute inset-x-1 -top-1.5 h-3 w-[calc(100%-0.5rem)]" aria-hidden="true">
          <path d="M0 8 L0 4 L10 2 L18 5 L30 1 L42 4 L52 2 L64 5 L76 1 L88 4 L100 2 L100 8 Z" fill="var(--paper)" />
        </svg>
        <div className="rounded-xl px-5 py-3" style={{ background: 'var(--wood-dark)', boxShadow: 'inset 0 4px 0 var(--wood), inset 0 -4px 0 var(--wood-ink), var(--shadow-warm)' }}>
          <h1 className="sk-display leading-none" style={{ color: 'var(--button-text)', fontSize: mobile ? 36 : 52, textShadow: '0 2px 0 var(--wood-ink)' }}>{PAINTED_TITLE}</h1>
          <p className="mt-1 text-base font-semibold" style={{ color: 'var(--glow)' }}>Chain words. Grow your wool. Don’t get stolen from.</p>
        </div>
      </div>

      {/* The panel: a right column on desktop, stacked at the bottom on phones (step 2 as a bottom sheet). */}
      <div className={mobile ? 'absolute inset-x-3 bottom-3 max-h-[62%] overflow-y-auto' : 'absolute right-12 top-1/2 max-h-[92%] w-[380px] -translate-y-1/2 overflow-y-auto'}>
        {step === 'tables' ? tables : setup}
      </div>

      {/* Settings, sound and the rules, over the snow. */}
      <div className={`absolute flex gap-2 ${mobile ? 'right-3 top-3' : 'bottom-4 left-4'}`}>
        <Chip onClick={() => setGear(true)} aria-label="Settings"><GearIcon /></Chip>
        <Chip onClick={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'} aria-pressed={muted}><SpeakerIcon muted={muted} /></Chip>
        <Chip onClick={() => setHelp(true)} aria-label="How to Play"><HelpIcon /></Chip>
      </div>

      {signIn && <AuthDialog onClose={() => setSignIn(false)} />}
      {hub && <Hub initial={hub} onClose={() => setHub(null)} />}
      {help && <Guide onClose={() => setHelp(false)} />}
      {gear && <PaintedSettings onClose={() => setGear(false)} />}
      <DevLine />
    </main>
  );
}
