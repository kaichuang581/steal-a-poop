import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
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
import { AcornIcon, ArrowDownIcon, ArrowUpIcon, BarnIcon, BlanketIcon, ClockIcon, CrescentIcon, FlameIcon, GearIcon, HelpIcon, KeyIcon, LeafIcon, PawIcon, PlayIcon, SeedlingIcon, TrophyIcon } from '../components/Icons';
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
import { useAvatar } from '../avatars/store';
import { PaintedGuide } from '../components/PaintedGuide';
import { MenuTag } from '../components/MenuTag';
import { GameMenu } from '../components/GameMenu';
import type { MenuItem } from '../components/GameMenu';
import { HomeCard, HomeSlab, HomeTitle } from '../home/HomeParts';
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
/** What the button on Home's card says for each item (the Queue's card has Casual and Ranked instead). */
const CARD_ACTION: Record<string, (rooms: boolean, dreamt: boolean) => string> = {
  lobby: (rooms) => (rooms ? 'Open my barn' : 'Set the table'),
  join: () => 'Enter a code',
  dream: (_, dreamt) => (dreamt ? 'Copy my result' : 'Dream tonight'),
  repair: () => 'Dream it now',
  practice: () => 'Set up a run',
  tutorial: () => 'Start the tutorial',
};
/** The legal pages' names as the small print says them (each button's label is the full title). */
const SHORT_LEGAL: Record<LegalSlug, string> = { privacy: 'Privacy', terms: 'Terms', 'child-safety': 'Child safety' };
const NO_SERVER = 'Real people need the game server, and this copy of the game has none. Create lobby plays the farm sheep.';

const TIPS = [
  'Every word must start with the last letter of the one before it.',
  'Run out of time and you lose a wool ball. Lose them all and you freeze solid.',
  'A bad word just bounces, so try another before your timer runs out.',
  'Turns get faster every round: 15, 10, then 5 seconds. The alarm calls each change.',
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
  // The menu item chosen (lit), whose card shows on the right.
  const [chosen, setChosen] = useState('queue');
  // Where the hero looks. A ref, not state (plan file 17, change 11): the sheep reads it as it is drawn, so moving the
  // pointer over Home renders nothing.
  const heroYaw = useRef(0);
  const heroGaze = useRef<[number, number] | null>(null);
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
    heroGaze.current = [(e.clientX / window.innerWidth) * 2 - 1, 1 - (e.clientY / window.innerHeight) * 2];
  };

  const timeOfNext = nextTable.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  // Queue and Create lobby are the two ways into a game with people (Brian, 2026-11-14: "remove quickplay ... make the green
  // button 'Queue' ... queue is what brings you into searching for a lobby ... create lobby is creating a lobby yourself").
  // Queue is matchmaking: it opens Casual or Ranked and the server finds the game. Create lobby makes a room of your own.
  // The queue is for real people, always (Brian, 2026-11-13: "quick play and play should not bring you into bot lobbies").
  // A copy of the game with no server to reach (local development without one) still shows Queue: it says why it cannot be used.
  const items: MenuItem[] = [
    { id: 'queue', label: 'Queue', icon: <PlayIcon />, sub: 'Real people, casual or ranked', caption: rooms ? 'We find you a table of real people. Casual for fun, Ranked to climb from Wood to Zenith.' : NO_SERVER, disabled: entering, onSelect: () => (rooms ? (setError(''), setChooser(true)) : undefined) }, // with no server its caption already says why
    // One lobby for every table you set yourself (Brian, 2026-11-14: "make custom game and create lobby the same thing ...
    // only with bots, only players, or bots and players"): inside it the host adds farm sheep, invites friends, or both.
    // It opens with the farm sheep the host had last time. With no server there is no lobby to open, so the same item
    // sets a table of farm sheep on this device.
    rooms
      ? { id: 'lobby', label: 'Create lobby', icon: <BarnIcon />, badge: <MenuTag tone="gray">your barn</MenuTag>, caption: 'Make your own barn and invite friends with the party code.', disabled: entering, onSelect: () => online({ t: 'create', visibility: 'private' }) }
      : { id: 'lobby', label: ready ? 'Create lobby' : 'Loading…', icon: <BarnIcon />, badge: <MenuTag tone="gray">farm sheep</MenuTag>, caption: 'Set a table of farm sheep (bots), then sit down.', disabled: !ready, onSelect: () => setStep('setup') },
    ...(rooms ? [
      { id: 'join', label: 'Join party', icon: <KeyIcon />, badge: <MenuTag tone="gray">got a code?</MenuTag>, caption: 'Got a party code from a friend? Type it in and you are at their table.', onSelect: () => { setPartyCode(''); setStep('join'); } },
    ] satisfies MenuItem[] : []),
    // Admin plays tonight's dream as often as it likes; everyone else gets the one attempt, then the share.
    admin
      ? {
        id: 'dream', label: 'Counting Sheep', icon: <CrescentIcon />, badge: <MenuTag tone="gold">admin</MenuTag>, disabled: !ready,
        caption: `Tonight's dream, as often as you like${dream?.status === 'done' ? ` (last run: ${dream.count ?? 0} sheep)` : ''}.`,
        onSelect: () => useDreamUi.getState().openDream(false),
      }
      : dream
      ? {
        id: 'dream', label: dream.status === 'done' ? (copiedDream ? 'Copied!' : 'Share dream') : 'Counting Sheep', icon: <CrescentIcon />,
        badge: dream.status === 'done' ? <MenuTag tone="gold">{dream.count ?? 0} sheep</MenuTag> : <MenuTag tone="gray">used</MenuTag>,
        disabled: dream.status !== 'done', onSelect: shareDream,
        caption: <>The farmer is up for the day. Tonight's dream starts at {timeOfNext}.</>, more: nights,
      }
      : {
        id: 'dream', label: 'Counting Sheep', icon: <CrescentIcon />, badge: streak > 0 ? <MenuTag tone="flame" label={`${streak}-night streak`}><FlameIcon size={11} />{streak} night{streak === 1 ? '' : 's'}</MenuTag> : <MenuTag tone="gold">daily</MenuTag>, disabled: !ready,
        caption: <>{covered ? `A Warm Blanket kept your streak warm: ${streak} nights. ` : ''}Keep the farmer asleep: type words with each fence's letters so the sheep clears it. One dream a night.</>, more: nights,
        onSelect: () => useDreamUi.getState().openDream(false),
      },
    ...(repair && !admin ? [{
      id: 'repair', label: 'Dream last night\'s dream', icon: <CrescentIcon />, badge: <MenuTag tone="gold">keeps your streak</MenuTag>, disabled: !ready,
      caption: `Last night's dream, dreamt today: until ${new Date(new Date().setHours(23, 59, 0, 0)).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase()}.`,
      onSelect: () => useDreamUi.getState().openDream(false, repair),
    } satisfies MenuItem] : []),
    {
      id: 'practice', label: 'Practice', icon: <ClockIcon />, badge: drillBest > 0 ? <MenuTag tone="green">best {drillBest}</MenuTag> : undefined, disabled: !ready,
      caption: 'You against one bot, on one life. Chain as many words as you can.', onSelect: () => setStep('practice'),
    },
    { id: 'tutorial', label: 'Tutorial', icon: <PawIcon />, caption: 'A guided first game with the sheepdog, who shows you every rule as it comes up.', disabled: !ready, onSelect: () => startTour('menu') },
    // The Trading Post and the leaderboards are in the top bar (the wallet and the trophy) since the "Word chain" Home
    // (Brian, 2026-11-20, picked from the mock-ups): before, they were the menu's last two items (2026-11-14).
  ];
  // The name plate opens the profile, where the name, the avatar and the stats live.
  const shownName = (signedIn ? accountName : settings.name) || '';
  const lvl = levelOf(wallet.xp);
  // The box with your name IS the profile (Brian, 2026-11-14: "make the profile thing not a button below the quickplay
  // but that box in the top left, just embed it in there"): one board, the avatar on a peg at its end, the name, the
  // level and how far to the next.
  const profilePlate = (
    <button
      type="button" className={`hm-me hm-board`} onClick={() => setProfile(true)} onPointerEnter={() => setHopKey((k) => k + 1)}
      aria-label={`Your profile${shownName ? `: ${shownName}` : ''}, level ${lvl.level}`} title="Your profile: stats, rank, name and avatar" data-profile
    >
      <span className="hm-me-peg kit-peg kit-peg--light" aria-hidden="true">{avatar ? <AvatarIcon id={avatar} size={mobile ? 24 : 30} /> : <SheepIcon size={mobile ? 24 : 30} />}</span>
      <span className="hm-me-id">
        <span className="hm-me-name">{shownName || <span style={{ opacity: 0.75 }}>Your name</span>}</span>
        <span className="hm-me-lvl">LV {lvl.level}<span className="hm-xp" aria-hidden="true"><i style={{ width: `${Math.round((100 * lvl.into) / Math.max(1, lvl.need))}%` }} /></span></span>
      </span>
      {!mobile && streak > 0 && <MenuTag tone="flame" label={`${streak}-night streak`}><FlameIcon size={11} />{streak}</MenuTag>}
    </button>
  );
  // What went wrong never moves the menu (Brian: nothing shifts when a button is pressed). It is laid out of the
  // flow: under the menu on a computer, just above it on a phone.
  const notes = dictStatus === 'error' || error || (roomNotice && step !== 'join') ? (
    <>
      {dictStatus === 'error' && (
        <PaperPanel role="alert" className="p-3 text-center">
          <p className="text-sm font-bold" style={{ color: 'var(--coral-dark)' }}>The word list did not load. Check your connection, then try again.</p>
          <WoodButton onClick={() => void retryDictionary()} className="mt-2">Retry</WoodButton>
        </PaperPanel>
      )}
      {error && <p role="alert">{error}</p>}
      {roomNotice && step !== 'join' && <p role="status">{roomNotice}</p>}
    </>
  ) : null;
  const tables = (
    <div className="relative" key="tables">
      <GameMenu items={items} label="Main menu" compact={mobile} autoFocus={!mobile && step === 'tables'} keys={step === 'tables'} onActive={setChosen} />
      {!mobile && notes && <div className="hm-note">{notes}</div>}
    </div>
  );

  const setup = (
    <div className={`hm-sheet hm-board space-y-3 ${mobile ? 'sk-slide-up' : 'sk-slide-in'}`} key="setup" role="dialog" aria-label="Set the table">
      <div className="sk-setup-head">
        <h2>{rooms ? 'Custom game' : 'Set the table'}</h2>
        <button className="sk-setup-back" onClick={() => setStep('tables')}>← Back</button>
      </div>
      {rooms && <p className="sk-hand text-lg">A table of your own against the farm sheep (bots).</p>}
      {table.first && <p className="sk-display text-base">Easy table for your first games</p>}
      {error && <p role="alert" className="text-sm font-bold">{error}</p>}
      <fieldset>
        <legend className="text-sm font-bold">Game length</legend>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {PRESET_IDS.map((id) => (
            <Chip key={id} aria-pressed={preset === id} className="capitalize" onClick={() => { if (id !== 'custom') setRule(PRESETS[id]); }}>{id}</Chip>
          ))}
        </div>
        <p className="mt-1.5" aria-live="polite"><span className="kit-slate kit-slate--mini"><span className="kit-slate-face kit-chalk-hand">about {minutes} min</span></span></p>
      </fieldset>
      <fieldset>
        <legend className="text-sm font-bold">Sheep at the table</legend>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {COUNTS.map((c) => <button key={c} type="button" className={`kit-tile kit-tile--sm ${settings.playerCount === c ? 'kit-tile--lit' : ''}`} onClick={() => setSettings({ playerCount: c })} aria-pressed={settings.playerCount === c}>{c}</button>)}
        </div>
        {/* One icon per seat; a seat added walks in from the left. */}
        <div className="mt-1.5 flex items-end gap-0.5" aria-hidden="true">
          {Array.from({ length: settings.playerCount }, (_, i) => (
            <span key={i} className="sk-walk-in" style={{ animationDelay: `${i * 40}ms` }}><SheepIcon size={i === 0 ? 26 : 22} /></span>
          ))}
        </div>
        <p className="sk-hand mt-1 text-base" aria-live="polite">{farmSheepLine(settings.playerCount - 1)}</p>
      </fieldset>
      <fieldset>
        <legend className="text-sm font-bold">Bot difficulty</legend>
        <div className="mt-1 flex gap-1.5">
          {DIFFS.map((d) => (
            <Chip key={d.id} onClick={() => setSettings({ difficulty: d.id, game: rules, tableChosen: true })} aria-pressed={table.difficulty === d.id} className="capitalize">{d.icon}{d.id}</Chip>
          ))}
        </div>
      </fieldset>
      <details className="hm-rules px-1 py-1" open={preset === 'custom'}>
        <summary className="cursor-pointer text-sm font-bold">Custom rules</summary>
        <div className="space-y-2 py-2">
          {RULES.map((r) => (
            <fieldset key={r.key}>
              <legend className="text-xs font-bold uppercase tracking-wide">{r.label}</legend>
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
    </div>
  );

  const drillSetup = (
    <div className={`hm-sheet hm-board space-y-3 ${mobile ? 'sk-slide-up' : 'sk-slide-in'}`} key="practice" role="dialog" aria-label="Practice run">
      <div className="sk-setup-head">
        <h2>Practice</h2>
        <button className="sk-setup-back" onClick={() => setStep('tables')}>← Back</button>
      </div>
      <p className="text-sm">You and one bot, on one life. Every word you play scores a point, the clock loses a second every 5 words, and your run ends the first time it runs out.</p>
      <fieldset>
        <legend className="text-sm font-bold">Starting clock</legend>
        <div className="mt-1 flex gap-1.5">
          {PRACTICE_CLOCKS.map((c) => <Chip key={c} onClick={() => setDrill({ clock: c })} aria-pressed={drill.clock === c}>{c} s</Chip>)}
        </div>
      </fieldset>
      <fieldset>
        <legend className="text-sm font-bold">Bot</legend>
        <div className="mt-1 flex gap-1.5">
          {DIFFS.map((d) => (
            <Chip key={d.id} onClick={() => setDrill({ difficulty: d.id })} aria-pressed={drill.difficulty === d.id} className="capitalize">{d.icon}{d.id}</Chip>
          ))}
        </div>
        <p className="sk-hand mt-1 text-base" aria-live="polite">{DRILL_BOTS[drill.difficulty]}</p>
      </fieldset>
      <p className="kit-slate kit-slate--mini kit-slate--amber" aria-live="polite"><span className="kit-slate-face kit-chalk-hand">{drillBest > 0 ? `Best here: ${drillBest} word${drillBest === 1 ? '' : 's'}` : 'No run here yet'}</span></p>
      {error && <p role="alert" className="text-sm font-bold">{error}</p>}
      <button autoFocus onClick={() => go('practice')} disabled={!ready} className="sk-btn sk-sit kit-sign w-full"><span className="sk-nail sk-nail-tl" /><span className="sk-nail sk-nail-tr" />Start run</button>
    </div>
  );
  const joinParty = (
    <div className={`hm-sheet hm-board space-y-3 ${mobile ? 'sk-slide-up' : 'sk-slide-in'}`} key="join" role="dialog" aria-label="Join a party">
      <div className="sk-setup-head">
        <h2>Join party</h2>
        <button className="sk-setup-back" onClick={() => setStep('tables')}>← Back</button>
      </div>
      <p className="sk-hand text-lg">Type the five-letter code your friend sent.</p>
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
        {(error || roomNotice) && <p role="alert" className="text-sm font-bold">{error || roomNotice}</p>}
        <button type="submit" disabled={partyCode.length < 5 || entering} className="sk-btn sk-sit kit-sign w-full" data-join-party><span className="sk-nail sk-nail-tl" /><span className="sk-nail sk-nail-tr" />Join party</button>
      </form>
    </div>
  );
  const panel = step === 'practice' ? drillSetup : step === 'join' ? joinParty : setup;

  // The small print: on a computer at the right of the bottom bar, on a phone under the menu.
  const smallPrint = (
    <nav className="hm-small" aria-label="About the game">
      <span>{!mobile && <span className="hm-update">{UPDATE_NAME}&nbsp;</span>}v{pkg.version}</span>
      <button onClick={() => setFeedback(true)}>Feedback</button>
      {(['privacy', 'terms', 'child-safety'] as const).map((slug) => (
        <button key={slug} onClick={() => setLegal(slug)} aria-label={LEGAL_TITLES[slug]}>{SHORT_LEGAL[slug]}</button>
      ))}
      <button onClick={() => setAdminOpen(true)} aria-label={admin ? 'Admin (unlocked)' : 'Admin access'} title={admin ? 'Admin: unlocked' : 'Admin access'} aria-pressed={admin} data-admin={admin || undefined}>{admin ? 'Admin on' : 'Admin'}</button>
      <span data-device-label>{device === 'phone' ? 'Phone layout' : 'Computer layout'}</span>
    </nav>
  );
  // The farm rests (fewer pictures a second, the same motion) behind an open dialog and when Home is left alone.
  const farmFps = useHomeFps(chooser || signIn || help || gear || legal !== null || feedback || profile || adminOpen);
  const pick = items.find((it) => it.id === chosen) ?? items[0];
  const helpButton = <button className="sk-icon-btn" onClick={() => setHelp(true)} aria-label="How to Play" title="How to play"><HelpIcon /></button>;
  const trophy = rooms && <button className="sk-icon-btn" onClick={() => setBoards(true)} aria-label="Leaderboards" title="Leaderboards"><TrophyIcon size={22} /></button>;

  return (
    // data-covered: a full page lies over Home, so its slab, title and word of the day hold still (home.css).
    <main className={`sk-home hm relative h-full overflow-hidden`} data-covered={bazaar || boards || profile || undefined} data-phone={mobile || undefined} onPointerMove={onPointerMove} onKeyDown={onKey}>
      <div className="absolute inset-0"><FarmBackdrop hour={hour} reduced={reduced} sleepy={!!dream} phone={mobile} heroYaw={heroYaw} heroGaze={heroGaze} hopKey={hopKey} paused={bazaar || boards} fps={farmFps} /></div>
      <HomeSlab rows={mobile ? 5 : 9} />

      {/* Top bar: who is playing on the left; the leaderboards, the money (into the Trading Post) and the system buttons
          on the right. Clear of a notch (plan file 14, change 5). */}
      <header className="hm-top">
        {profilePlate}
        <div className="hm-right">
          {!mobile && trophy}
          {authEnabled() && (authStatus === 'ready' ? (
            <button className="hm-pill hm-board" onClick={() => setSignIn(true)} aria-label="Account" title="Account">Account</button>
          ) : (
            <button className="hm-pill hm-board" onClick={openSignInForm} aria-label="Log in" title="Log in to save your progress">Log in</button>
          ))}
          <button className="hm-wallet hm-board" onClick={() => setBazaar(true)} aria-label={`The Trading Post, ${formatCoins(wool)} Wool Coins${signedIn && coins !== null ? `, ${coins} coins` : ''}`} title="The Trading Post">
            <span className="hm-money"><CoinArt size={16} />{formatCoins(wool, true)}</span>
            {signedIn && coins !== null && <span className="hm-money">{coins}</span>}
            <span className="hm-plus" aria-hidden="true">+</span>
          </button>
          <button className="sk-icon-btn" onClick={() => setGear(true)} aria-label="Settings" title="Settings"><GearIcon /></button>
          {!mobile && <SoundMenu />}
          {!mobile && helpButton}
        </div>
      </header>

      {mobile ? (
        // A phone: the title and the word of the day in the slab's band, the round buttons down the right, and the menu
        // at the foot, scrolling in its own box so a short or sideways phone never runs it into the band.
        <>
          <div className="hm-head">
            <HomeTitle title={PAINTED_TITLE} />
            <WordOfDay className="sk-wotd--compact" />
          </div>
          <div className="hm-side">{trophy}<SoundMenu />{helpButton}</div>
          <div className="hm-bottom">
            {notes && step === 'tables' && <div className="hm-note">{notes}</div>}
            <div className="hm-scroll">{step === 'tables' ? <>{tables}{smallPrint}</> : <div className="hm-panel">{panel}</div>}</div>
          </div>
        </>
      ) : (
        <>
          <div className="hm-left">
            <HomeTitle title={PAINTED_TITLE} tagline="Chain words. Keep your wool. Outlast the flock." />
            {/* One wrapper always, so a panel dims the menu without remounting it (and replaying its entry). */}
            <div className={step === 'tables' ? undefined : 'pointer-events-none opacity-40'} inert={step !== 'tables'}>{tables}</div>
          </div>
          {step === 'tables' ? (
            <>
              <WordOfDay />
              <HomeCard id={pick.id} title={pick.label} text={pick.caption} badge={pick.id === 'queue' ? undefined : pick.badge}>
                {/* Every card ends in one row of the same height, so the card never changes size as the choice moves. */}
                <div className="hm-modes">
                  {pick.id === 'queue' ? (rooms && (
                    <>
                      <button className="hm-mode" disabled={entering} onClick={() => online({ t: 'quick' })}>Casual</button>
                      <button className="hm-mode" disabled={entering} onClick={() => (hasAccount() ? online({ t: 'ranked' }) : setSignIn(true))}>Ranked</button>
                    </>
                  )) : (
                    <>
                      {pick.more}
                      <button className="hm-mode hm-mode--go" disabled={pick.disabled} onClick={pick.onSelect}>{CARD_ACTION[pick.id]?.(rooms, dream?.status === 'done') ?? 'Go'}</button>
                    </>
                  )}
                </div>
              </HomeCard>
            </>
          ) : <div className="hm-panel">{panel}</div>}
          {/* Bottom bar: what the keys do, a rotating tip, and the small print. */}
          <footer className="hm-foot">
            <div className="hm-keys">
              <span><kbd><ArrowUpIcon size={11} /></kbd><kbd><ArrowDownIcon size={11} /></kbd>Choose</span>
              <span><kbd>Enter</kbd>Select</span>
              <span style={{ visibility: step === 'tables' ? 'hidden' : undefined } as CSSProperties}><kbd>Esc</kbd>Back</span>
            </div>
            <p className="hm-tip" aria-live="off"><span className="hm-tip-tag">Tip</span><span key={tip} className="hm-tip-text">{TIPS[tip]}</span></p>
            {smallPrint}
          </footer>
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
      {adminOpen && <AdminPanel onClose={() => setAdminOpen(false)} />}
      <DevLine />
    </main>
  );
}
