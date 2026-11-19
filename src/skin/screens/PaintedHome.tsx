import { useEffect, useRef, useState } from 'react';
import type { PointerEvent, ReactNode } from 'react';
import pkg from '../../../package.json';
import { useAuth } from '../../auth/authStore';
import { authEnabled } from '../../auth/config';
import { useDevice, usePhoneLayout } from '../device';
import { estimateMinutes, MAX_PLAYERS, MIN_PLAYERS, PRACTICE_CLOCKS, PRESETS, presetOf } from '../../engine';
import type { Difficulty, GameSettings, PresetId } from '../../engine';
import { dreamSeed, dreamShareText } from '../../dream/dream';
import { streakRow } from '../dream/streakRow';
import { dreamStreakDays, getDream, getDreamStreak, loadStreak, repairAvailable, takeCoverNotice } from '../../dream/daily';
import { dreamLink, useDreamUi } from '../dream/dreamStore';
import { useToday } from '../hooks/useToday';
import { checkNickname } from '../../lib/nickname';
import { getPracticeBest } from '../../lib/practice';
import { PAINTED_GAME_TITLE, UPDATE_NAME } from '../../config';
import { SEASON_TIPS } from '../season';
import { farmSheepLine } from '../../lib/record';
import { getServerUrl } from '../../net/config';
import { useRoomStore } from '../../state/roomStore';
import type { Intent } from '../../state/roomStore';
import { PlayChooser } from '../ranked/PlayChooser';
import { enterOnline, hasAccount } from '../rooms/enterOnline';
import { levelOf } from '../shop/economy';
import '../rooms/rooms.css';
import { useSocial } from '../../state/socialStore';
import { useStore, tableFor } from '../../state/store';
import { AuthDialog } from '../../ui/auth/AuthDialog';
import { openSignInForm } from '../onboarding/Onboarding';
import { LEGAL_TITLES } from '../../ui/legal/legalLinks';
import type { LegalSlug } from '../../ui/legal/legalLinks';
import { LegalDialog } from '../components/LegalDialog';
import { AcornIcon, ArrowDownIcon, ArrowUpIcon, BagIcon, BlanketIcon, FlameIcon, GearIcon, HelpIcon, LeafIcon, LockIcon, SeedlingIcon } from '../components/Icons';
import { AdminPanel } from '../components/AdminPanel';
import { useAdmin } from '../../lib/admin';
import { AvatarIcon } from '../avatars/AvatarIcon';
import { FeedbackDialog } from '../components/FeedbackDialog';
import { Bazaar } from '../shop/Bazaar';
import { Profile } from '../profile/Profile';
import { Leaderboards } from '../boards/Leaderboards';
import { useWallet } from '../shop/store';
import { CoinArt } from '../shop/art';
import { formatCoins } from '../shop/format';
import { AvatarPicker } from '../avatars/AvatarPicker';
import { useAvatar } from '../avatars/store';
import { AvatarButtonIcon } from '../components/PixelIcons';
import { PaintedGuide } from '../components/PaintedGuide';
import { MenuTag } from '../components/MenuTag';
import { GameMenu } from '../components/GameMenu';
import type { MenuItem } from '../components/GameMenu';
import { TitleBoard } from '../components/TitleBoard';
import { WordOfDay } from '../wotd/WordOfDay';
import { Chip, PaperPanel, WoodButton } from '../components/Materials';
import { SheepIcon } from '../components/SheepIcon';
import { useHour, useMotionLevel } from '../hooks/useAmbient';
import { DevLine } from '../table/DevStats';
import { FarmBackdrop } from '../table/FarmBackdrop';
import { useHomeFps } from '../perf/governor';
import { PaintedSettings } from './PaintedSettings';
import { SoundMenu } from '../components/SoundMenu';

export const PAINTED_TITLE = PAINTED_GAME_TITLE;
/** The game's version, as the footer shows it: the device report (perf/report.ts) reads it from here. */
export const APP_VERSION: string = pkg.version;
/** What each bot level means in a practice run, where it can't beat you: only the letters it leaves you differ. */
const DRILL_BOTS: Record<Difficulty, string> = {
  easy: 'Plays short, common words.',
  medium: 'Sometimes leaves you a hard letter.',
  hard: 'Keeps leaving you hard letters.',
};
const DIFFS: { id: Difficulty; icon: ReactNode }[] = [
  { id: 'easy', icon: <SeedlingIcon /> }, { id: 'medium', icon: <LeafIcon /> }, { id: 'hard', icon: <AcornIcon /> },
];
const COUNTS = Array.from({ length: MAX_PLAYERS - MIN_PLAYERS + 1 }, (_, i) => MIN_PLAYERS + i);
const PRESET_IDS: PresetId[] = ['quick', 'standard', 'long', 'custom'];
/** Rotating along the bottom bar, one every few seconds: short, true, and useful in the next game. */
/** What Queue says in a copy of the game that has no server to reach. */
const NO_SERVER = 'Real people need the game server, and this copy of the game has none. Custom game plays the farm sheep.';

const TIPS = [
  'Every word must start with the last letter of the one before it.',
  'Run out of time and you lose a wool ball. Lose them all and you freeze solid.',
  'A bad word just bounces, so try another before your timer runs out.',
  'Turns get faster every round: 16, 12, 9, 7, then 5 seconds. The alarm calls each change.',
  'Last sheep standing wins.',
  ...SEASON_TIPS,
];

const RULES: { key: keyof GameSettings; label: string; values: (number | string | boolean)[]; show?: (v: number | string | boolean) => string }[] = [
  { key: 'turnsPerRound', label: 'Turns per round', values: [2, 3, 5] },
  { key: 'lives', label: 'Wool balls', values: [1, 2, 3, 5] },
  { key: 'twists', label: 'Round twists', values: [true, false], show: (v) => (v ? 'On' : 'Off') },
];

/**
 * The start screen (plan V3.1 Part 2): the farm diorama behind a title sign, and a two-step panel: choose a table,
 * then set it. Every control calls the store's existing functions; Practice has its own small panel for its difficulty.
 */
export function PaintedHome() {
  const { settings, setSettings, start, startTour, dictStatus, retryDictionary } = useStore();
  const [step, setStep] = useState<'tables' | 'setup' | 'practice' | 'join'>('tables');
  const [partyCode, setPartyCode] = useState('');
  const entering = useRoomStore((st) => st.entering);
  const [help, setHelp] = useState(false);
  const [pickAvatar, setPickAvatar] = useState(false);
  const [bazaar, setBazaar] = useState(false);
  const [profile, setProfile] = useState(false);
  const wallet = useWallet();
  const wool = wallet.coins;
  const device = useDevice();
  const [feedback, setFeedback] = useState(false);
  const [legal, setLegal] = useState<LegalSlug | null>(null);
  const [adminOpen, setAdminOpen] = useState(false);
  const admin = useAdmin((s) => s.admin);
  const avatar = useAvatar();
  const [gear, setGear] = useState(false);
  const [error, setError] = useState('');
  // Queue opens two cards, Casual and Ranked, over the menu.
  const [chooser, setChooser] = useState(false);
  const [copiedDream, setCopiedDream] = useState(false);
  const [signIn, setSignIn] = useState(false);
  const [boards, setBoards] = useState(false);
  // Where the hero looks. A ref, not state (plan file 17, change 11): the sheep reads it as it is drawn, so moving the
  // pointer over Home renders nothing.
  const heroYaw = useRef(0);
  const [hopKey, setHopKey] = useState(0);
  const [tip, setTip] = useState(() => Math.floor(Math.random() * TIPS.length));
  const coins = useSocial((st) => st.balance);
  const roomNotice = useRoomStore((st) => st.notice);
  const authStatus = useAuth((st) => st.status);
  const accountName = useAuth((st) => st.profile?.nickname ?? '');
  const hour = useHour();
  const reduced = useMotionLevel() === 'reduced';
  const mobile = usePhoneLayout();
  const today = useToday();
  const dream = getDream(today);
  const streak = getDreamStreak(today);
  const blankets = loadStreak().blankets;
  const repair = repairAvailable(today);
  // The day a Warm Blanket covered a missed night, the ticket says so once.
  const [covered] = useState(() => takeCoverNotice());
  const nights = (
    <span className="mt-1 flex items-center gap-2">
      <span className="dr-nights" data-mini aria-label={`${streak}-night streak`}>{streakRow(dreamStreakDays(today), streak).map((st, i) => <span key={i} className="dr-night" data-status={st} />)}</span>
      {blankets > 0 && <span className="dr-blankets" aria-label={`${blankets} Warm Blanket${blankets === 1 ? '' : 's'}`}>{Array.from({ length: blankets }, (_, i) => <BlanketIcon key={i} size={12} />)}</span>}
    </span>
  );
  const ready = dictStatus === 'ready';
  const table = tableFor(settings);
  const rooms = !!getServerUrl();
  const signedIn = authEnabled() && authStatus === 'ready';

  const go = (mode: 'quick' | 'practice') => {
    const nick = checkNickname(settings.name);
    if (!nick.ok) return setError(nick.message);
    setError('');
    // The game opens behind the barn doors (PaintedApp): they shut first, and open once its scene has drawn.
    start(mode, mode === 'quick' ? table.game : undefined);
  };
  const shareDream = async () => {
    if (dream?.status !== 'done') return;
    const text = dreamShareText({
      date: today, count: dream.count ?? 0, longest: dream.longest ?? 0, streak, title: PAINTED_TITLE, url: dreamLink(), seed: dreamSeed(today),
      bumped: !dream.asleep, fences: dream.reached, bumps: dream.bumps,
    });
    try { await navigator.clipboard.writeText(text); } catch { window.prompt('Copy your result:', text); }
    setCopiedDream(true);
    setTimeout(() => setCopiedDream(false), 2000);
  };
  // Real people are the default once a game server is configured: Queue searches for a game (Casual or Ranked), Create lobby
  // makes one of your own, and a party code joins a friend's. Signed in, the account's name is used; signed out, a guest plays
  // under the name on the plate (no account needed; progress stays in this browser).
  const online = (intent: Intent) => setError(enterOnline(intent) ?? '');
  // Game length (plan V3.3 Part 2.6): a preset sets every rule; touching a rule makes it Custom. Saved with the other settings.
  const rules = table.game;
  const preset = presetOf(rules);
  // Touching a rule or the bots makes it the player's own table, and the easy first games stop applying.
  const setRule = (patch: Partial<GameSettings>) => setSettings({ game: { ...rules, ...patch }, difficulty: table.difficulty, tableChosen: true });
  const minutes = estimateMinutes({ ...rules, botCount: settings.playerCount - 1, botDifficulty: table.difficulty });
  const drill = settings.practice;
  const setDrill = (patch: Partial<typeof drill>) => setSettings({ practice: { ...drill, ...patch } });
  const drillBest = getPracticeBest(drill.clock, drill.difficulty);
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
    if (e.key === 'Escape' && step !== 'tables') { e.preventDefault(); setStep('tables'); }
  };
  // The hero looks toward the pointer: up to 0.3 rad either way across the width of the screen.
  const onPointerMove = (e: PointerEvent) => {
    if (mobile || reduced) return;
    heroYaw.current = ((e.clientX / window.innerWidth) * 2 - 1) * 0.3;
  };

  const timeOfNext = nextTable.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  // Queue and Create lobby are the two ways into a game with people (Brian, 2026-11-14: "remove quickplay ... make the green
  // button 'Queue' ... queue is what brings you into searching for a lobby ... create lobby is creating a lobby yourself").
  // Queue is matchmaking: it opens Casual or Ranked and the server finds the game. Create lobby makes a room of your own.
  // The queue is for real people, always (Brian, 2026-11-13: "quick play and play should not bring you into bot lobbies").
  // A copy of the game with no server to reach (local development without one) still shows Queue: it says why it cannot be used.
  const items: MenuItem[] = [
    { id: 'queue', label: 'Queue', caption: rooms ? 'Search for a game with real people: casual or ranked.' : NO_SERVER, disabled: entering, onSelect: () => (rooms ? (setError(''), setChooser(true)) : online({ t: 'quick' })) },
    // One lobby for every table you set yourself (Brian, 2026-11-14: "make custom game and create lobby the same thing ...
    // only with bots, only players, or bots and players"): inside it the host adds farm sheep, invites friends, or both.
    // It opens with the farm sheep the host had last time. With no server there is no lobby to open, so the same item
    // sets a table of farm sheep on this device.
    rooms
      ? { id: 'lobby', label: 'Create lobby', caption: 'Make your own barn and invite friends with the party code.', disabled: entering, onSelect: () => online({ t: 'create', visibility: 'private' }) }
      : { id: 'lobby', label: ready ? 'Create lobby' : 'Loading…', caption: 'Set a table of farm sheep (bots), then sit down.', disabled: !ready, onSelect: () => setStep('setup') },
    ...(rooms ? [
      { id: 'join', label: 'Join party', caption: 'Got a party code from a friend? Type it in.', onSelect: () => { setPartyCode(''); setStep('join'); } },
    ] satisfies MenuItem[] : []),
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
        caption: <>{covered ? `A Warm Blanket kept your streak warm: ${streak} nights. ` : ''}Keep the farmer asleep: type words with each fence's letters so the sheep clears it. One dream a night.{nights}</>,
        onSelect: () => useDreamUi.getState().openDream(false),
      },
    ...(repair && !admin ? [{
      id: 'repair', label: 'Dream last night\'s dream', badge: <MenuTag tone="gold">keeps your streak</MenuTag>, disabled: !ready,
      caption: `Last night's dream, dreamt today: until ${new Date(new Date().setHours(23, 59, 0, 0)).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase()}.`,
      onSelect: () => useDreamUi.getState().openDream(false, repair),
    } satisfies MenuItem] : []),
    {
      id: 'practice', label: 'Practice', badge: drillBest > 0 ? <MenuTag tone="green">best {drillBest}</MenuTag> : undefined, disabled: !ready,
      caption: 'You against one bot, on one life. Chain as many words as you can.', onSelect: () => setStep('practice'),
    },
    { id: 'tutorial', label: 'Tutorial', caption: 'A guided first game with the sheepdog.', disabled: !ready, onSelect: () => startTour('menu') },
    {
      id: 'bazaar', label: 'Trading Post', badge: <MenuTag tone="gold" label={`${formatCoins(wool)} Wool Coins`}><CoinArt size={13} />{formatCoins(wool, true)}</MenuTag>,
      caption: 'Feed Sacks of bomb skins, bursts and fuse sounds, missions, and your collection.', onSelect: () => setBazaar(true),
    },
    // The leaderboards sit under the Trading Post in the menu (Brian, 2026-11-14: "keep the full page but put it below the
    // trading post button ... in the same area though so the font and everything should match"). It was a trophy button
    // in the top bar. They need the game server, like the queue.
    ...(rooms ? [{ id: 'boards', label: 'Leaderboards', caption: 'The best players: Ranked, Wins and Level, and where you stand.', onSelect: () => setBoards(true) }] satisfies MenuItem[] : []),
  ];
  // The name plate opens the profile, where the name, the avatar and the stats live.
  const shownName = (signedIn ? accountName : settings.name) || '';
  // The box with your name IS the profile (Brian, 2026-11-14: "make the profile thing not a button below the quickplay
  // but that box in the top left, just embed it in there"): the whole box is one button, and it says so under the name.
  // No board behind it: the avatar's peg, like the round buttons across the bar, and the name floating beside it.
  const profilePlate = (avatarSize: number, className: string, extra?: ReactNode) => (
    <button
      type="button" className={`sk-plate sk-plate-open ${className}`} onClick={() => setProfile(true)} onPointerEnter={() => setHopKey((k) => k + 1)}
      aria-label={`Your profile${shownName ? `: ${shownName}` : ''}, level ${levelOf(wallet.xp).level}`} title="Your profile: stats, rank, name and avatar" data-profile
    >
      <span className="sk-plate-avatar kit-peg kit-peg--light" aria-hidden="true">{avatar ? <AvatarIcon id={avatar} size={avatarSize} /> : <SheepIcon size={avatarSize} />}</span>
      <span className="sk-plate-id">
        <span className="sk-plate-name">{shownName || <span style={{ opacity: 0.75 }}>Your name</span>}</span>
        <span className="sk-plate-sub"><span>Level {levelOf(wallet.xp).level}</span><span>Profile</span></span>
      </span>
      {extra}
    </button>
  );
  // What went wrong never moves the menu (Brian: nothing shifts when a button is pressed). It is laid out of the
  // flow: under the caption on a computer, just above the menu's panel on a phone, in the caption's own type.
  const notes = dictStatus === 'error' || error || (roomNotice && step !== 'join') ? (
    <>
      {dictStatus === 'error' && (
        <PaperPanel role="alert" className="p-3 text-center">
          <p className="text-sm font-bold" style={{ color: 'var(--coral-dark)' }}>The word list did not load. Check your connection, then try again.</p>
          <WoodButton onClick={() => void retryDictionary()} className="mt-2">Retry</WoodButton>
        </PaperPanel>
      )}
      {error && <p role="alert" className="sk-home-note">{error}</p>}
      {roomNotice && step !== 'join' && <p role="status" className="sk-home-note">{roomNotice}</p>}
    </>
  ) : null;
  const tables = (
    <div className="relative flex flex-col gap-3" key="tables">
      {mobile && profilePlate(26, 'self-start')}
      <GameMenu items={items} label="Main menu" compact={mobile} autoFocus={!mobile && step === 'tables'} keys={step === 'tables'} />
      {!mobile && notes && <div className="absolute inset-x-0 top-full mt-2 flex flex-col gap-2">{notes}</div>}
    </div>
  );

  const setup = (
    <PaperPanel className={`sk-setup space-y-3 p-4 pt-0 ${mobile ? 'sk-slide-up' : 'sk-slide-in'}`} key="setup" role="dialog" aria-label="Set the table">
      <div className="sk-setup-head">
        <h2>{rooms ? 'Custom game' : 'Set the table'}</h2>
        <button className="sk-setup-back" onClick={() => setStep('tables')}>← Back</button>
      </div>
      {rooms && <p className="sk-hand text-lg" style={{ color: 'var(--ink-soft)' }}>A table of your own against the farm sheep (bots).</p>}
      {table.first && <p className="sk-display text-base">Easy table for your first games</p>}
      {error && <p role="alert" className="text-sm font-bold" style={{ color: 'var(--coral-dark)' }}>{error}</p>}
      <fieldset>
        <legend className="text-sm font-bold" style={{ color: 'var(--ink-soft)' }}>Game length</legend>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {PRESET_IDS.map((id) => (
            <Chip key={id} aria-pressed={preset === id} className="capitalize" onClick={() => { if (id !== 'custom') setRule(PRESETS[id]); }}>{id}</Chip>
          ))}
        </div>
        <p className="mt-1.5" aria-live="polite"><span className="kit-slate kit-slate--mini"><span className="kit-slate-face kit-chalk-hand">about {minutes} min</span></span></p>
      </fieldset>
      <fieldset>
        <legend className="text-sm font-bold" style={{ color: 'var(--ink-soft)' }}>Sheep at the table</legend>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {COUNTS.map((c) => <button key={c} type="button" className={`kit-tile kit-tile--sm ${settings.playerCount === c ? 'kit-tile--lit' : ''}`} onClick={() => setSettings({ playerCount: c })} aria-pressed={settings.playerCount === c}>{c}</button>)}
        </div>
        {/* One icon per seat; a seat added walks in from the left. */}
        <div className="mt-1.5 flex items-end gap-0.5" aria-hidden="true">
          {Array.from({ length: settings.playerCount }, (_, i) => (
            <span key={i} className="sk-walk-in" style={{ animationDelay: `${i * 40}ms` }}><SheepIcon size={i === 0 ? 26 : 22} /></span>
          ))}
        </div>
        <p className="sk-hand mt-1 text-base" style={{ color: 'var(--ink-soft)' }} aria-live="polite">{farmSheepLine(settings.playerCount - 1)}</p>
      </fieldset>
      <fieldset>
        <legend className="text-sm font-bold" style={{ color: 'var(--ink-soft)' }}>Bot difficulty</legend>
        <div className="mt-1 flex gap-1.5">
          {DIFFS.map((d) => (
            <Chip key={d.id} onClick={() => setSettings({ difficulty: d.id, game: rules, tableChosen: true })} aria-pressed={table.difficulty === d.id} className="capitalize">{d.icon}{d.id}</Chip>
          ))}
        </div>
      </fieldset>
      <details className="px-1 py-1" style={{ borderTop: '1px dashed var(--ink-soft)', borderBottom: '1px dashed var(--ink-soft)' }} open={preset === 'custom'}>
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
      <button onClick={() => go('quick')} disabled={!ready} className="sk-btn sk-sit kit-sign w-full"><span className="sk-nail sk-nail-tl" /><span className="sk-nail sk-nail-tr" />Sit down</button>
    </PaperPanel>
  );

  const drillSetup = (
    <PaperPanel className={`sk-setup space-y-3 p-4 pt-0 ${mobile ? 'sk-slide-up' : 'sk-slide-in'}`} key="practice" role="dialog" aria-label="Practice run">
      <div className="sk-setup-head">
        <h2>Practice</h2>
        <button className="sk-setup-back" onClick={() => setStep('tables')}>← Back</button>
      </div>
      <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>You and one bot, on one life. Every word you play scores a point, the clock loses a second every 5 words, and your run ends the first time it runs out.</p>
      <fieldset>
        <legend className="text-sm font-bold" style={{ color: 'var(--ink-soft)' }}>Starting clock</legend>
        <div className="mt-1 flex gap-1.5">
          {PRACTICE_CLOCKS.map((c) => <Chip key={c} onClick={() => setDrill({ clock: c })} aria-pressed={drill.clock === c}>{c} s</Chip>)}
        </div>
      </fieldset>
      <fieldset>
        <legend className="text-sm font-bold" style={{ color: 'var(--ink-soft)' }}>Bot</legend>
        <div className="mt-1 flex gap-1.5">
          {DIFFS.map((d) => (
            <Chip key={d.id} onClick={() => setDrill({ difficulty: d.id })} aria-pressed={drill.difficulty === d.id} className="capitalize">{d.icon}{d.id}</Chip>
          ))}
        </div>
        <p className="sk-hand mt-1 text-base" style={{ color: 'var(--ink-soft)' }} aria-live="polite">{DRILL_BOTS[drill.difficulty]}</p>
      </fieldset>
      <p className="kit-slate kit-slate--mini kit-slate--amber" aria-live="polite"><span className="kit-slate-face kit-chalk-hand">{drillBest > 0 ? `Best here: ${drillBest} word${drillBest === 1 ? '' : 's'}` : 'No run here yet'}</span></p>
      {error && <p role="alert" className="text-sm font-bold" style={{ color: 'var(--coral-dark)' }}>{error}</p>}
      <button autoFocus onClick={() => go('practice')} disabled={!ready} className="sk-btn sk-sit kit-sign w-full"><span className="sk-nail sk-nail-tl" /><span className="sk-nail sk-nail-tr" />Start run</button>
    </PaperPanel>
  );
  const joinParty = (
    <PaperPanel className={`sk-setup space-y-3 p-4 pt-0 ${mobile ? 'sk-slide-up' : 'sk-slide-in'}`} key="join" role="dialog" aria-label="Join a party">
      <div className="sk-setup-head">
        <h2>Join party</h2>
        <button className="sk-setup-back" onClick={() => setStep('tables')}>← Back</button>
      </div>
      <p className="sk-hand text-lg" style={{ color: 'var(--ink-soft)' }}>Type the five-letter code your friend sent.</p>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (partyCode.length === 5) online({ t: 'join', code: partyCode }); }}>
        <label className="sk-code">
          <span className="sr-only">Party code</span>
          <input
            id="sk-party-code" autoFocus value={partyCode} onChange={(e) => setPartyCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5))}
            autoCapitalize="characters" autoComplete="off" spellCheck={false} inputMode="text" maxLength={5} className="sk-code-input"
          />
          {Array.from({ length: 5 }, (_, i) => (
            <span key={i} aria-hidden="true" className={`kit-tile kit-tile--md ${partyCode[i] ? '' : 'sk-code-empty'} ${i === Math.min(partyCode.length, 4) ? 'sk-code-next' : ''}`}>{partyCode[i] ?? ''}</span>
          ))}
        </label>
        {(error || roomNotice) && <p role="alert" className="text-sm font-bold" style={{ color: 'var(--coral-dark)' }}>{error || roomNotice}</p>}
        <button type="submit" disabled={partyCode.length < 5 || entering} className="sk-btn sk-sit kit-sign w-full" data-join-party><span className="sk-nail sk-nail-tl" /><span className="sk-nail sk-nail-tr" />Join party</button>
      </form>
    </PaperPanel>
  );
  const panel = step === 'practice' ? drillSetup : step === 'join' ? joinParty : setup;

  const footer = (
    <footer className="sk-small flex flex-wrap items-center gap-x-4">
      <span>{mobile ? '' : `${UPDATE_NAME} `}v{pkg.version}</span>
      <button className="min-h-8 content-center" onClick={() => setFeedback(true)}>Feedback</button>
      <span data-device-label>{device === 'phone' ? 'Phone layout' : 'Computer layout'}</span>
      {(['privacy', 'terms', 'child-safety'] as const).map((slug) => (
        <button key={slug} className="min-h-8 content-center" onClick={() => setLegal(slug)}>{LEGAL_TITLES[slug]}</button>
      ))}
    </footer>
  );
  // The farm rests (fewer pictures a second, the same motion) behind an open dialog and when Home is left alone.
  const farmFps = useHomeFps(chooser || signIn || help || gear || legal !== null || feedback || profile || pickAvatar || adminOpen);

  return (
    // data-covered: a full page lies over Home, so its title and word of the day hold still (skin.css).
    <main className={`sk-home relative h-full overflow-hidden`} data-covered={bazaar || boards || profile || undefined} onPointerMove={onPointerMove} onKeyDown={onKey}>
      <div className="absolute inset-0"><FarmBackdrop hour={hour} reduced={reduced} sleepy={!!dream} phone={mobile} heroYaw={heroYaw} hopKey={hopKey} paused={bazaar || boards} fps={farmFps} /></div>
      <div className={`pointer-events-none absolute inset-0 ${mobile ? 'sk-wash-bottom' : 'sk-wash-left'}`} />

      {/* Top bar: who is playing on the left (desktop) and the system buttons on the right. */}
      {/* Clear of a notch (plan file 14, change 5): every inset is 0 on a computer, so nothing moves there. */}
      {/* A computer keeps one 40 px frame: the plate, the title, the menu and the small print share its left edge, the
          round buttons, the word of the day and the small print its right. */}
      <div className={`pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-end gap-2 [&>*]:pointer-events-auto ${mobile
        ? 'p-3 pt-[max(12px,env(safe-area-inset-top))] pr-[max(12px,env(safe-area-inset-right))] pl-[max(12px,env(safe-area-inset-left))]'
        : 'pb-4 pt-[max(20px,env(safe-area-inset-top))] pr-[max(40px,env(safe-area-inset-right))] pl-[max(40px,env(safe-area-inset-left))]'}`}>
        {!mobile && profilePlate(26, 'mr-auto', (
          <>
            {streak > 0 && <MenuTag tone="flame" label={`${streak}-night streak`}><FlameIcon size={11} />{streak}</MenuTag>}
            {signedIn && coins !== null && <span aria-label={`${coins} coins`} className="flex items-center gap-1 text-sm">{coins} <CoinArt size={14} /></span>}
          </>
        ))}
        {authEnabled() && (authStatus === 'ready' ? (
          <button className="sk-icon-btn" onClick={() => setSignIn(true)} aria-label="Account" title="Account" style={{ width: 'auto', padding: '0 12px', whiteSpace: 'nowrap' }}>Account</button>
        ) : (
          <button className="sk-icon-btn" onClick={openSignInForm} aria-label="Log in" title="Log in to save your progress" style={{ width: 'auto', padding: '0 12px', whiteSpace: 'nowrap' }}>Log in</button>
        ))}
        {/* The leaderboards (they are read from the game server, so there is no button without one). */}
        <button className="sk-icon-btn sk-bazaar-btn" onClick={() => setBazaar(true)} aria-label={`The Trading Post, ${formatCoins(wool)} Wool Coins`} title="The Trading Post"><BagIcon size={20} /><span>{formatCoins(wool, true)}</span></button>
        <button className="sk-icon-btn" onClick={() => setPickAvatar(true)} aria-label="Avatar" title="Avatar"><AvatarButtonIcon /></button>
        <button className="sk-icon-btn" onClick={() => setAdminOpen(true)} aria-label={admin ? 'Admin (unlocked)' : 'Admin access'} title={admin ? 'Admin: unlocked' : 'Admin access'} aria-pressed={admin} data-admin={admin || undefined}><LockIcon size={20} /></button>
        <button className="sk-icon-btn" onClick={() => setGear(true)} aria-label="Settings" title="Settings"><GearIcon /></button>
        <SoundMenu />
        <button className="sk-icon-btn" onClick={() => setHelp(true)} aria-label="How to Play" title="How to play"><HelpIcon /></button>
      </div>

      {mobile ? (
        // One column under the top bar: the title block, then the menu's panel at the foot. The panel takes the height
        // the title leaves and scrolls inside itself, so on a small or sideways phone the two never lie over each
        // other. Its old cap (64% of the screen: this box is 72 px shorter than the screen) still holds on a tall one.
        // The column starts under the top bar and keeps off a notch at the sides (plan file 14, change 5).
        <div className="pointer-events-none absolute inset-x-0 bottom-2 top-[max(4rem,calc(env(safe-area-inset-top)+52px))] flex flex-col pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] [&>*]:pointer-events-auto">
          <div className="flex flex-none flex-col items-center">
            <TitleBoard title={PAINTED_TITLE} tagline="Chain words, keep your wool, outlast the flock." compact />
            <WordOfDay className="sk-wotd--compact" />
          </div>
          <div className="relative mt-auto flex min-h-0 flex-col" style={{ maxHeight: 'calc(64% + 46px)' }}>
            {notes && step === 'tables' && <div className="absolute inset-x-4 bottom-full mb-2 flex flex-col gap-2">{notes}</div>}
            <div className="min-h-0 overflow-y-auto px-4">
              {step === 'tables' ? (
                <>
                  {tables}
                  <div className="mt-1">{footer}</div>
                </>
              ) : panel}
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* The title and the menu on the left, like a console title screen; the word of the day on the right, its top
              level with the title's. "safe": on a short window they start under the name plate instead of riding up
              over it. */}
          <div className="pointer-events-none absolute bottom-14 left-10 right-10 top-20 flex flex-col" style={{ justifyContent: 'safe center' }}>
            <div className="flex items-start justify-between gap-10">
              <div className="pointer-events-auto flex w-[27rem] flex-none flex-col gap-4">
                <TitleBoard title={PAINTED_TITLE} tagline="Chain words, keep your wool, and be the last sheep standing." />
                {/* One wrapper always, so a panel dims the menu without remounting it (and replaying its entry). */}
                <div className={step === 'tables' ? undefined : 'pointer-events-none opacity-40'} inert={step !== 'tables'}>{tables}</div>
              </div>
              {step === 'tables' && <WordOfDay className="sk-wotd--side" />}
            </div>
          </div>
          {/* A panel opening on the right takes the word of the day's place. */}
          {step !== 'tables' && <div className="absolute right-10 top-1/2 max-h-[86%] w-[380px] -translate-y-1/2 overflow-y-auto">{panel}</div>}
          {/* Bottom bar: what the keys do, a rotating tip, and the small print. */}
          <div className="absolute inset-x-0 bottom-0 flex items-end gap-6 px-10 pb-3">
            <div className="sk-small flex min-h-8 shrink-0 items-center gap-4">
              <span className="sk-prompt"><b><ArrowUpIcon size={12} /><ArrowDownIcon size={12} /></b> Choose</span>
              <span className="sk-prompt"><b>Enter</b> Select</span>
              {step !== 'tables' && <span className="sk-prompt"><b>Esc</b> Back</span>}
            </div>
            <p key={tip} className="sk-tip flex min-w-0 flex-1 items-center justify-center" aria-live="off"><span className="line-clamp-2 text-center">{TIPS[tip]}</span></p>
            {/* Under 1280 px the small print wraps to two lines at the right, so the tip keeps room for its two lines. */}
            <div className="flex shrink-0 flex-col items-end gap-1 max-xl:max-w-[320px] max-xl:[&>footer]:justify-end">
              {footer}
            </div>
          </div>
        </>
      )}

      {chooser && (
        <PlayChooser
          rank={hasAccount() ? 'play' : 'signin'} busy={entering} error={error || roomNotice || undefined}
          onClose={() => setChooser(false)}
          onCasual={() => online({ t: 'quick' })}
          onRanked={() => online({ t: 'ranked' })}
          onSignIn={() => { setChooser(false); setSignIn(true); }}
        />
      )}
      {signIn && <AuthDialog onClose={() => setSignIn(false)} />}
      {boards && <Leaderboards onClose={() => setBoards(false)} />}
      {help && <PaintedGuide onClose={() => setHelp(false)} />}
      {gear && <PaintedSettings onClose={() => setGear(false)} />}
      {legal && <LegalDialog initial={legal} onClose={() => setLegal(null)} />}
      {feedback && <FeedbackDialog onClose={() => setFeedback(false)} />}
      {bazaar && <Bazaar onClose={() => setBazaar(false)} />}
      {profile && <Profile onClose={() => setProfile(false)} />}
      {pickAvatar && <AvatarPicker onClose={() => setPickAvatar(false)} />}
      {adminOpen && <AdminPanel onClose={() => setAdminOpen(false)} />}
      <DevLine />
    </main>
  );
}
