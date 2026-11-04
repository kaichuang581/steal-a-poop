import { useEffect, useState } from 'react';
import type { PointerEvent, ReactNode } from 'react';
import pkg from '../../../package.json';
import { useAuth } from '../../auth/authStore';
import { authEnabled } from '../../auth/config';
import { estimateMinutes, MAX_PLAYERS, MIN_PLAYERS, PRESETS, presetOf, utcDateKey } from '../../engine';
import type { Difficulty, GameSettings, PresetId } from '../../engine';
import { getHunt, getHuntStreak, huntShareText } from '../../hunt/daily';
import { useHuntUi } from '../hunt/huntStore';
import { dreamShareText } from '../../dream/dream';
import { dreamStreakDays, getDream, getDreamStreak } from '../../dream/daily';
import { useDreamUi } from '../dream/dreamStore';
import { checkNickname, MAX_NICKNAME } from '../../lib/nickname';
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
import { AcornIcon, GearIcon, HelpIcon, LeafIcon, SeedlingIcon, SpeakerIcon } from '../components/Icons';
import { GameMenu } from '../components/GameMenu';
import type { MenuItem } from '../components/GameMenu';
import { TitleBoard } from '../components/TitleBoard';
import { StreakString } from '../components/Lantern';
import { Chip, PaperPanel, WoodButton } from '../components/Materials';
import { SheepIcon } from '../components/SheepIcon';
import { useHour, useMotionLevel } from '../hooks/useAmbient';
import { DevLine } from '../table/DevStats';
import { FarmBackdrop } from '../table/FarmBackdrop';
import { PaintedSettings } from './PaintedSettings';

export const PAINTED_TITLE = 'Finish the Word';
const DIFFS: { id: Difficulty; icon: ReactNode }[] = [
  { id: 'easy', icon: <SeedlingIcon /> }, { id: 'medium', icon: <LeafIcon /> }, { id: 'hard', icon: <AcornIcon /> },
];
const COUNTS = Array.from({ length: MAX_PLAYERS - MIN_PLAYERS + 1 }, (_, i) => MIN_PLAYERS + i);
const PRESET_IDS: PresetId[] = ['quick', 'standard', 'long', 'custom'];
/** Rotating along the bottom bar, one every few seconds: short, true, and useful in the next game. */
const TIPS = [
  'Every word must start with the last letter of the one before it.',
  'Bank the pile before someone steals it: banked wool is safe.',
  'Words ending in X, Z, Q or J set a trap for the next sheep.',
  'In the last seconds of a turn anyone can steal the pile with a word.',
  'Turns get faster every round, from 16 seconds down to 5.',
  'Run out of time with no lives left and you freeze in a block of ice.',
  'Long and rare words are worth more wool.',
];

const RULES: { key: keyof GameSettings; label: string; values: (number | string | boolean)[]; show?: (v: number | string | boolean) => string }[] = [
  { key: 'rounds', label: 'Rounds', values: [1, 2, 3, 5] },
  { key: 'turnsPerRound', label: 'Turns per round', values: [3, 5, 7] },
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
  const [copiedDream, setCopiedDream] = useState(false);
  const [signIn, setSignIn] = useState(false);
  const [hub, setHub] = useState<HubTab | null>(null);
  const [heroYaw, setHeroYaw] = useState(0);
  const [hopKey, setHopKey] = useState(0);
  const [tip, setTip] = useState(() => Math.floor(Math.random() * TIPS.length));
  const coins = useSocial((st) => st.balance);
  const roomNotice = useRoomStore((st) => st.notice);
  const authStatus = useAuth((st) => st.status);
  const hour = useHour();
  const reduced = useMotionLevel() === 'reduced';
  const mobile = useIsMobile();
  const today = utcDateKey(new Date());
  const hunt = getHunt(today);
  const huntStreak = getHuntStreak(today);
  const dream = getDream(today);
  const streak = getDreamStreak(today);
  const ready = dictStatus === 'ready';
  const rooms = !!getServerUrl();
  const signedIn = authEnabled() && authStatus === 'ready';

  const go = (mode: 'quick' | 'practice') => {
    const nick = checkNickname(settings.name);
    if (!nick.ok) return setError(nick.message);
    setError('');
    start(mode, mode === 'quick' ? settings.game : undefined);
  };
  const shareHunt = async () => {
    if (hunt?.status !== 'done') return;
    const text = huntShareText({ date: today, defeated: hunt.defeated ?? 0, damage: hunt.damage ?? 0, marks: hunt.marks ?? [], streak: huntStreak });
    try { await navigator.clipboard.writeText(text); } catch { window.prompt('Copy your result:', text); }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const shareDream = async () => {
    if (dream?.status !== 'done') return;
    const text = dreamShareText({ date: today, count: dream.count ?? 0, longest: dream.longest ?? 0, streak });
    try { await navigator.clipboard.writeText(text); } catch { window.prompt('Copy your result:', text); }
    setCopiedDream(true);
    setTimeout(() => setCopiedDream(false), 2000);
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
  // A new tip every 7 seconds (not under reduced motion, where the first one stays).
  useEffect(() => {
    if (reduced) return;
    const id = setInterval(() => setTip((t) => (t + 1) % TIPS.length), 7000);
    return () => clearInterval(id);
  }, [reduced]);
  // Esc backs out of the table setup, like any game menu.
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && step === 'setup') { e.preventDefault(); setStep('tables'); }
  };
  // The hero looks toward the pointer: up to 0.3 rad either way across the width of the screen.
  const onPointerMove = (e: PointerEvent) => {
    if (mobile || reduced) return;
    setHeroYaw(((e.clientX / window.innerWidth) * 2 - 1) * 0.3);
  };

  const link = 'min-h-11 content-center text-left text-sm font-bold underline decoration-2 underline-offset-2 disabled:no-underline disabled:opacity-60';
  const timeOfNext = nextTable.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const items: MenuItem[] = [
    { id: 'play', label: ready ? 'Play' : 'Loading…', caption: 'You and the bots in the barn. Set the table, then sit down.', disabled: !ready, onSelect: () => setStep('setup') },
    dream
      ? {
        id: 'dream', label: dream.status === 'done' ? (copiedDream ? 'Copied!' : 'Share dream') : 'Counting Sheep',
        badge: dream.status === 'done' ? `${dream.count ?? 0} sheep` : 'used',
        disabled: dream.status !== 'done', onSelect: shareDream,
        caption: `The farmer is up for the day. Tonight's dream starts at ${timeOfNext}.`,
      }
      : {
        id: 'dream', label: 'Counting Sheep', badge: streak > 0 ? `${streak}-night streak` : 'daily', disabled: !ready,
        caption: 'Keep the farmer asleep: type words with each fence\'s letters so the sheep clears it. One dream a night.',
        onSelect: () => useDreamUi.getState().openDream(false),
      },
    hunt
      ? {
        id: 'hunt', label: hunt.status === 'done' ? (copied ? 'Copied!' : 'Share hunt') : 'Daily Hunt',
        badge: hunt.status === 'done' ? `${hunt.defeated ?? 0} beaten` : 'used',
        disabled: hunt.status !== 'done', onSelect: shareHunt,
        caption: `Today's hunt is over. The next pack arrives at ${timeOfNext}.`,
      }
      : {
        id: 'hunt', label: 'Daily Hunt', badge: huntStreak > 0 ? `${huntStreak}-day streak` : 'new', disabled: !ready,
        caption: 'Fight off the predators with words. One hunt a day, the same pack for everyone.',
        onSelect: () => useHuntUi.getState().openHunt(false),
      },
    { id: 'practice', label: 'Practice', caption: 'Easy bots, 25-second turns, hints, and no penalties.', disabled: !ready, onSelect: () => go('practice') },
    { id: 'tutorial', label: 'Tutorial', caption: 'A guided first game with the sheepdog.', disabled: !ready, onSelect: () => startTour('menu') },
    {
      id: 'rooms', label: 'Play with friends', badge: rooms ? undefined : 'soon', disabled: !rooms, onSelect: openRooms,
      caption: rooms ? '4 to 10 people in the big barn.' : 'Rooms open when the game server is live.',
    },
  ];
  const tables = (
    <div className="flex flex-col gap-3" key="tables">
      <GameMenu items={items} label="Main menu" compact={mobile} autoFocus={!mobile && step === 'tables'} />
      {dictStatus === 'error' && (
        <PaperPanel role="alert" className="p-3 text-center">
          <p className="text-sm font-bold" style={{ color: 'var(--coral-dark)' }}>The word list did not load. Check your connection, then try again.</p>
          <WoodButton onClick={() => void retryDictionary()} className="mt-2">Retry</WoodButton>
        </PaperPanel>
      )}
      {error && <p role="alert" className="sk-paper px-3 py-1 text-sm font-bold" style={{ color: 'var(--coral-dark)' }}>{error}</p>}
      {signedIn && rooms && (
        <div className="flex gap-2" role="group" aria-label="Community">
          {([['friends', '👥 Friends'], ['boards', '🏆 Boards'], ['shop', '🛍️ Shop']] as const).map(([t, label]) => (
            <WoodButton key={t} onClick={() => setHub(t)} className="flex-1 text-sm">{label}</WoodButton>
          ))}
        </div>
      )}
      {roomNotice && !useRoomStore.getState().open && <p role="status" className="sk-paper px-3 py-1 text-center text-sm">{roomNotice}</p>}
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

  const name = settings.name.trim() && checkNickname(settings.name).ok ? settings.name.trim() : 'New shepherd';
  const footer = (
    <footer className="flex flex-wrap items-center gap-x-3 text-[11px] font-semibold" style={{ color: 'rgba(255, 244, 220, 0.75)' }}>
      <span>v{pkg.version}</span>
      <a className="min-h-8 content-center underline" href="https://github.com/kaichuang581/steal-a-poop/issues/new/choose" target="_blank" rel="noreferrer">Feedback</a>
      {(['privacy', 'terms', 'child-safety'] as const).map((slug) => (
        <a key={slug} className="min-h-8 content-center underline" href={legalHref(slug)} target="_blank" rel="noopener">{LEGAL_TITLES[slug]}</a>
      ))}
    </footer>
  );

  return (
    <main className="relative h-full overflow-hidden" onPointerMove={onPointerMove} onKeyDown={onKey}>
      <div className="absolute inset-0"><FarmBackdrop hour={hour} reduced={reduced} sleepy={!!dream} phone={mobile} heroYaw={heroYaw} hopKey={hopKey} /></div>
      <div className={`pointer-events-none absolute inset-0 ${mobile ? 'sk-wash-bottom' : 'sk-wash-left'}`} />

      {/* Top bar: who is playing on the left (desktop) and the system buttons on the right. */}
      <div className="absolute inset-x-0 top-0 flex items-start justify-end gap-2 p-3 sm:p-4">
        {!mobile && (
          <div className="sk-plate mr-auto" aria-label="Player">
            <SheepIcon size={26} />
            <span className="max-w-[12rem] truncate">{name}</span>
            {streak > 0 && <span className="text-sm" style={{ color: 'var(--glow)' }}>🔥 {streak}</span>}
            {signedIn && coins !== null && <span aria-label="Coins" className="text-sm">{coins} 🪙</span>}
          </div>
        )}
        <button className="sk-icon-btn" onClick={() => setGear(true)} aria-label="Settings"><GearIcon /></button>
        <button className="sk-icon-btn" onClick={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'} aria-pressed={muted}><SpeakerIcon muted={muted} /></button>
        <button className="sk-icon-btn" onClick={() => setHelp(true)} aria-label="How to Play"><HelpIcon /></button>
      </div>

      {mobile ? (
        <>
          <div className="absolute inset-x-0 top-16 flex justify-center">
            <TitleBoard title={PAINTED_TITLE} tagline="Chain words. Grow your wool." compact />
          </div>
          <div className="absolute inset-x-3 bottom-2 max-h-[64%] overflow-y-auto">
            {step === 'tables' ? (
              <>
                {tables}
                {(streak > 0 || dream) && <div className="mt-1 flex justify-center"><StreakString days={dreamStreakDays(today)} /></div>}
                <div className="mt-1 flex justify-center">{footer}</div>
              </>
            ) : setup}
          </div>
        </>
      ) : (
        <>
          {/* Left column: the title board, then the menu, like a console title screen. */}
          <div className="absolute bottom-20 left-10 top-20 flex w-[27rem] flex-col justify-center gap-8">
            <TitleBoard title={PAINTED_TITLE} tagline="Chain words. Grow your wool. Don’t get stolen from." />
            {step === 'tables' ? tables : <div className="pointer-events-none opacity-40" inert>{tables}</div>}
          </div>
          {step === 'setup' && (
            <div className="absolute right-12 top-1/2 max-h-[86%] w-[380px] -translate-y-1/2 overflow-y-auto">{setup}</div>
          )}
          {/* Bottom bar: button prompts, a rotating tip, the streak and the small print. */}
          <div className="absolute inset-x-0 bottom-0 flex items-end gap-6 px-10 pb-3 text-sm font-bold" style={{ color: 'var(--button-text)', textShadow: '0 1px 2px rgba(30, 18, 8, 0.8)' }}>
            <div className="flex shrink-0 items-center gap-4">
              <span className="sk-prompt"><span className="sk-key">↑</span><span className="sk-key">↓</span> Choose</span>
              <span className="sk-prompt"><span className="sk-key">Enter</span> Select</span>
              {step === 'setup' && <span className="sk-prompt"><span className="sk-key">Esc</span> Back</span>}
            </div>
            <p key={tip} className="sk-tip sk-hand min-w-0 flex-1 truncate text-center text-lg" style={{ color: 'var(--glow)' }} aria-live="off">Tip: {TIPS[tip]}</p>
            <div className="flex shrink-0 flex-col items-end gap-1">
              {(streak > 0 || dream) && <StreakString days={dreamStreakDays(today)} />}
              {footer}
            </div>
          </div>
        </>
      )}

      {signIn && <AuthDialog onClose={() => setSignIn(false)} />}
      {hub && <Hub initial={hub} onClose={() => setHub(null)} />}
      {help && <Guide onClose={() => setHelp(false)} />}
      {gear && <PaintedSettings onClose={() => setGear(false)} />}
      <DevLine />
    </main>
  );
}
