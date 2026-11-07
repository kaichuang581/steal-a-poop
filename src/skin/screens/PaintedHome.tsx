import { useEffect, useState } from 'react';
import type { PointerEvent, ReactNode } from 'react';
import pkg from '../../../package.json';
import { useAuth } from '../../auth/authStore';
import { authEnabled } from '../../auth/config';
import { estimateMinutes, MAX_PLAYERS, MIN_PLAYERS, PRESETS, presetOf } from '../../engine';
import type { Difficulty, GameSettings, PresetId } from '../../engine';
import { getHuntBest } from '../../hunt/record';
import { useHuntUi } from '../hunt/huntStore';
import { dreamShareText } from '../../dream/dream';
import { dreamStreakDays, getDream, getDreamStreak, loadStreak, repairAvailable, takeCoverNotice } from '../../dream/daily';
import { useDreamUi } from '../dream/dreamStore';
import { useToday } from '../hooks/useToday';
import { checkNickname, MAX_NICKNAME } from '../../lib/nickname';
import { getServerUrl } from '../../net/config';
import { useRoomStore } from '../../state/roomStore';
import { useSocial } from '../../state/socialStore';
import { useStore } from '../../state/store';
import { AuthDialog } from '../../ui/auth/AuthDialog';
import { useIsMobile } from '../../ui/hooks';
import { LEGAL_TITLES, legalHref } from '../../ui/legal/legalLinks';
import { Hub } from '../../ui/social/Hub';
import type { HubTab } from '../../ui/social/Hub';
import { AcornIcon, ArrowDownIcon, ArrowUpIcon, BagIcon, BlanketIcon, CoinIcon, FlameIcon, FriendsIcon, GearIcon, HelpIcon, LeafIcon, LockIcon, SeedlingIcon, SpeakerIcon, TrophyIcon } from '../components/Icons';
import { AdminPanel } from '../components/AdminPanel';
import { useAdmin } from '../../lib/admin';
import { AvatarIcon } from '../avatars/AvatarIcon';
import { AvatarPicker } from '../avatars/AvatarPicker';
import { useAvatar } from '../avatars/store';
import { AvatarButtonIcon } from '../components/PixelIcons';
import { PaintedGuide } from '../components/PaintedGuide';
import { MenuTag } from '../components/MenuTag';
import { GameMenu } from '../components/GameMenu';
import type { MenuItem } from '../components/GameMenu';
import { TitleBoard } from '../components/TitleBoard';
import { Chip, ClothButton, PaperPanel, WoodButton } from '../components/Materials';
import { SheepIcon } from '../components/SheepIcon';
import { useHour, useMotionLevel } from '../hooks/useAmbient';
import { DevLine } from '../table/DevStats';
import { FarmBackdrop } from '../table/FarmBackdrop';
import { BarnDoors } from '../components/BarnDoors';
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
  'When a timer turns red, type a word first to steal one of their wool balls.',
  'Run out of time and you lose a wool ball. Lose them all and you freeze solid.',
  'End a word on X, Z, Q or J: if the next sheep runs out of time, you get a wool ball.',
  'A bad word just bounces, so try another before your timer runs out.',
  'Turns get faster every round: 16, 12, 9, 7, then 5 seconds. The alarm calls each change.',
  'Last sheep standing wins.',
];

const RULES: { key: keyof GameSettings; label: string; values: (number | string | boolean)[]; show?: (v: number | string | boolean) => string }[] = [
  { key: 'turnsPerRound', label: 'Turns per round', values: [2, 3, 5] },
  { key: 'lives', label: 'Wool balls', values: [1, 2, 3, 5] },
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
  const [pickAvatar, setPickAvatar] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const admin = useAdmin((s) => s.admin);
  const [swooping, setSwooping] = useState(false);
  const avatar = useAvatar();
  const [gear, setGear] = useState(false);
  const [error, setError] = useState('');
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
  const today = useToday();
  const huntBest = getHuntBest();
  const dream = getDream(today);
  const streak = getDreamStreak(today);
  const blankets = loadStreak().blankets;
  const repair = repairAvailable(today);
  // The day a Warm Blanket covered a missed night, the ticket says so once.
  const [covered] = useState(() => takeCoverNotice());
  const nights = (
    <span className="mt-1 flex items-center gap-2">
      <span className="dr-nights" data-mini aria-label="The last seven nights">{dreamStreakDays(today).map((st, i) => <span key={i} className="dr-night" data-status={st} />)}</span>
      {blankets > 0 && <span className="dr-blankets" aria-label={`${blankets} Warm Blanket${blankets === 1 ? '' : 's'}`}>{Array.from({ length: blankets }, (_, i) => <BlanketIcon key={i} size={12} />)}</span>}
    </span>
  );
  const ready = dictStatus === 'ready';
  const rooms = !!getServerUrl();
  const signedIn = authEnabled() && authStatus === 'ready';

  const go = (mode: 'quick' | 'practice') => {
    const nick = checkNickname(settings.name);
    if (!nick.ok) return setError(nick.message);
    setError('');
    const begin = () => start(mode, mode === 'quick' ? settings.game : undefined);
    // Through the doors: barn doors swing open on warm light and the view pushes through, then the game opens from the glow.
    if (reduced || swooping) return begin();
    setSwooping(true);
    setTimeout(begin, 950);
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
  // The next dream arrives at local midnight (a date-time with no zone parses as local time).
  const nextTable = new Date(`${today}T00:00:00`);
  nextTable.setDate(nextTable.getDate() + 1);
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

  const timeOfNext = nextTable.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const items: MenuItem[] = [
    { id: 'start', label: ready ? 'Start now' : 'Loading…', caption: 'Straight into a game with easy bots and hints. No setup.', disabled: !ready, onSelect: () => go('practice') },
    { id: 'play', label: ready ? 'Play' : 'Loading…', caption: 'You and the bots in the barn. Set the table, then sit down.', disabled: !ready, onSelect: () => setStep('setup') },
    // Admin plays tonight's dream as often as it likes; everyone else gets the one attempt, then the share.
    admin
      ? {
        id: 'dream', label: 'Counting Sheep', badge: <MenuTag tone="gold">admin</MenuTag>, disabled: !ready,
        caption: `Tonight's dream, as often as you like${dream?.status === 'done' ? ` (last run: ${dream.count ?? 0} sheep)` : ''}.`,
        onSelect: () => useDreamUi.getState().openDream(false),
      }
      : dream
      ? {
        id: 'dream', label: dream.status === 'done' ? (copiedDream ? 'Copied!' : 'Share dream') : 'Counting Sheep',
        badge: dream.status === 'done' ? <MenuTag tone="gold">{dream.count ?? 0} sheep</MenuTag> : <MenuTag tone="gray">used</MenuTag>,
        disabled: dream.status !== 'done', onSelect: shareDream,
        caption: <>The farmer is up for the day. Tonight's dream starts at {timeOfNext}.{nights}</>,
      }
      : {
        id: 'dream', label: 'Counting Sheep', badge: streak > 0 ? <MenuTag tone="flame" label={`${streak}-night streak`}><FlameIcon size={11} />{streak} night{streak === 1 ? '' : 's'}</MenuTag> : <MenuTag tone="gold">daily</MenuTag>, disabled: !ready,
        caption: <>{covered ? `A Warm Blanket kept your streak warm · ${streak} nights. ` : ''}Keep the farmer asleep: type words with each fence's letters so the sheep clears it. One dream a night.{nights}</>,
        onSelect: () => useDreamUi.getState().openDream(false),
      },
    ...(repair && !admin ? [{
      id: 'repair', label: 'Dream last night\'s dream', badge: <MenuTag tone="gold">keeps your streak</MenuTag>, disabled: !ready,
      caption: `Last night's dream, dreamt today: until ${new Date(new Date().setHours(23, 59, 0, 0)).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase()}.`,
      onSelect: () => useDreamUi.getState().openDream(false, repair),
    } satisfies MenuItem] : []),
    {
      id: 'hunt', label: 'Hunt', badge: huntBest ? <MenuTag tone="green">best {huntBest.defeated}</MenuTag> : <MenuTag tone="green">new</MenuTag>, disabled: !ready,
      caption: 'Fight off predator after predator with words. Hunt as often as you like.',
      onSelect: () => useHuntUi.getState().openHunt(),
    },
    { id: 'practice', label: 'Practice', caption: 'Easy bots, hints, and no penalties.', disabled: !ready, onSelect: () => go('practice') },
    { id: 'tutorial', label: 'Tutorial', caption: 'A guided first game with the sheepdog.', disabled: !ready, onSelect: () => startTour('menu') },
    {
      id: 'rooms', label: 'Play with friends', badge: rooms ? undefined : <MenuTag tone="gray">soon</MenuTag>, disabled: !rooms, onSelect: openRooms,
      caption: rooms ? '4 to 10 people in the big barn.' : 'Rooms open when the game server is live.',
    },
  ];
  const tables = (
    <div className="flex flex-col gap-3" key="tables">
      <GameMenu items={items} label="Main menu" compact={mobile} autoFocus={!mobile && step === 'tables'} keys={step === 'tables'} />
      {dictStatus === 'error' && (
        <PaperPanel role="alert" className="p-3 text-center">
          <p className="text-sm font-bold" style={{ color: 'var(--coral-dark)' }}>The word list did not load. Check your connection, then try again.</p>
          <WoodButton onClick={() => void retryDictionary()} className="mt-2">Retry</WoodButton>
        </PaperPanel>
      )}
      {error && <p role="alert" className="sk-paper px-3 py-1 text-sm font-bold" style={{ color: 'var(--coral-dark)' }}>{error}</p>}
      {signedIn && rooms && (
        <div className="flex gap-2" role="group" aria-label="Community">
          {([['friends', <><FriendsIcon size={16} /> Friends</>], ['boards', <><TrophyIcon size={16} /> Boards</>], ['shop', <><BagIcon size={16} /> Shop</>]] as const).map(([t, label]) => (
            <WoodButton key={t} onClick={() => setHub(t)} className="inline-flex flex-1 items-center justify-center gap-1.5 text-sm">{label}</WoodButton>
          ))}
        </div>
      )}
      {roomNotice && !useRoomStore.getState().open && <p role="status" className="sk-paper px-3 py-1 text-center text-sm">{roomNotice}</p>}
    </div>
  );

  const setup = (
    <PaperPanel className={`sk-setup space-y-3 p-4 pt-0 ${mobile ? 'sk-slide-up' : 'sk-slide-in'}`} key="setup" role="dialog" aria-label="Set the table">
      <div className="sk-setup-head">
        <h2>Set the table</h2>
        <button className="sk-setup-back" onClick={() => setStep('tables')}>← Back</button>
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
            <Chip key={d.id} onClick={() => setSettings({ difficulty: d.id })} aria-pressed={settings.difficulty === d.id} className="capitalize">{d.id}</Chip>
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
      <ClothButton onClick={() => go('quick')} disabled={!ready} className="sk-sit w-full">Sit down</ClothButton>
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
    <main className={`sk-home relative h-full overflow-hidden`} onPointerMove={onPointerMove} onKeyDown={onKey}>
      <div className="absolute inset-0"><FarmBackdrop hour={hour} reduced={reduced} sleepy={!!dream} phone={mobile} heroYaw={heroYaw} hopKey={hopKey} /></div>
      <div className={`pointer-events-none absolute inset-0 ${mobile ? 'sk-wash-bottom' : 'sk-wash-left'}`} />

      {/* Top bar: who is playing on the left (desktop) and the system buttons on the right. */}
      <div className="absolute inset-x-0 top-0 flex items-start justify-end gap-2 p-3 sm:p-4">
        {!mobile && (
          <div className="sk-plate mr-auto" aria-label="Player">
            <span className="sk-plate-avatar" aria-hidden="true">{avatar ? <AvatarIcon id={avatar} size={24} /> : <SheepIcon size={24} />}</span>
            <span className="max-w-[12rem] truncate">{name}</span>
            {streak > 0 && <MenuTag tone="flame" label={`${streak}-night streak`}><FlameIcon size={11} />{streak}</MenuTag>}
            {signedIn && coins !== null && <span aria-label={`${coins} coins`} className="flex items-center gap-1 text-sm">{coins} <CoinIcon size={14} /></span>}
          </div>
        )}
        <button className="sk-icon-btn" onClick={() => setPickAvatar(true)} aria-label="Avatar" title="Avatar"><AvatarButtonIcon /></button>
        <button className="sk-icon-btn" onClick={() => setAdminOpen(true)} aria-label={admin ? 'Admin (unlocked)' : 'Admin access'} title={admin ? 'Admin: unlocked' : 'Admin access'} aria-pressed={admin} data-admin={admin || undefined}><LockIcon size={20} /></button>
        <button className="sk-icon-btn" onClick={() => setGear(true)} aria-label="Settings" title="Settings"><GearIcon /></button>
        <button className="sk-icon-btn" onClick={toggleMute} aria-label={muted ? 'Unmute' : 'Mute'} title={muted ? 'Unmute' : 'Sound'} aria-pressed={muted}><SpeakerIcon muted={muted} /></button>
        <button className="sk-icon-btn" onClick={() => setHelp(true)} aria-label="How to Play" title="How to play"><HelpIcon /></button>
      </div>

      {mobile ? (
        <>
          <div className="absolute inset-x-0 top-16 flex justify-center">
            <TitleBoard title={PAINTED_TITLE} tagline="Chain words, keep your wool, outlast the flock." compact />
          </div>
          <div className="absolute inset-x-3 bottom-2 max-h-[64%] overflow-y-auto">
            {step === 'tables' ? (
              <>
                {tables}
                <div className="mt-1 flex justify-center">{footer}</div>
              </>
            ) : setup}
          </div>
        </>
      ) : (
        <>
          {/* Left column: the title board, then the menu, like a console title screen. */}
          <div className="absolute bottom-16 left-10 top-16 flex w-[27rem] flex-col justify-center gap-4">
            <TitleBoard title={PAINTED_TITLE} tagline="Chain words, keep your wool, and be the last sheep standing." />
            {step === 'tables' ? tables : <div className="pointer-events-none opacity-40" inert>{tables}</div>}
          </div>
          {step === 'setup' && (
            <div className="absolute right-12 top-1/2 max-h-[86%] w-[380px] -translate-y-1/2 overflow-y-auto">{setup}</div>
          )}
          {/* Bottom bar: button prompts, a rotating tip, the streak and the small print. */}
          <div className="absolute inset-x-0 bottom-0 flex items-end gap-6 px-10 pb-3 text-sm font-bold" style={{ color: 'var(--button-text)', textShadow: '0 1px 2px rgba(30, 18, 8, 0.8)' }}>
            <div className="flex shrink-0 items-center gap-4">
              <span className="sk-prompt"><span className="sk-key"><ArrowUpIcon size={12} /></span><span className="sk-key"><ArrowDownIcon size={12} /></span> Choose</span>
              <span className="sk-prompt"><span className="sk-key">Enter</span> Select</span>
              {step === 'setup' && <span className="sk-prompt"><span className="sk-key">Esc</span> Back</span>}
            </div>
            <p key={tip} className="sk-tip sk-hand flex min-w-0 flex-1 items-center justify-center gap-2 text-lg" style={{ color: 'var(--glow)' }} aria-live="off"><span className="truncate">{TIPS[tip]}</span></p>
            <div className="flex shrink-0 flex-col items-end gap-1">
              {footer}
            </div>
          </div>
        </>
      )}

      {swooping && <BarnDoors />}
      {signIn && <AuthDialog onClose={() => setSignIn(false)} />}
      {hub && <Hub initial={hub} onClose={() => setHub(null)} />}
      {help && <PaintedGuide onClose={() => setHelp(false)} />}
      {gear && <PaintedSettings onClose={() => setGear(false)} />}
      {pickAvatar && <AvatarPicker onClose={() => setPickAvatar(false)} />}
      {adminOpen && <AdminPanel onClose={() => setAdminOpen(false)} />}
      <DevLine />
    </main>
  );
}
