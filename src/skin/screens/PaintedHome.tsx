import { useEffect, useRef, useState } from 'react';
import type { PointerEvent, ReactNode } from 'react';
import pkg from '../../../package.json';
import { useAuth } from '../../auth/authStore';
import { authEnabled } from '../../auth/config';
import { useDevice, usePhoneLayout } from '../device';
import { estimateMinutes, MAX_PLAYERS, MIN_PLAYERS, PRACTICE_CLOCKS, PRESETS, presetOf } from '../../engine';
import type { Difficulty, GameSettings, PresetId } from '../../engine';
import { dreamSeed, dreamShareText } from '../../dream/dream';
import { getDream, getDreamStreak, repairAvailable, takeCoverNotice } from '../../dream/daily';
import { dreamLink, useDreamUi } from '../dream/dreamStore';
import { useToday } from '../hooks/useToday';
import { checkNickname } from '../../lib/nickname';
import { getPracticeBest } from '../../lib/practice';
import { PAINTED_GAME_TITLE } from '../../config';
import { SEASON_TIPS } from '../season';
import { farmSheepLine } from '../../lib/record';
import { getServerUrl } from '../../net/config';
import { useRoomStore } from '../../state/roomStore';
import type { Intent } from '../../state/roomStore';
import { PlayChooser } from '../ranked/PlayChooser';
import { enterOnline, hasAccount } from '../rooms/enterOnline';
import { levelOf } from '../shop/economy';
import '../rooms/rooms.css';
import { useStore, tableFor } from '../../state/store';
import { AuthDialog } from '../../ui/auth/AuthDialog';
import { openSignInForm } from '../onboarding/Onboarding';
import { LEGAL_TITLES } from '../../ui/legal/legalLinks';
import type { LegalSlug } from '../../ui/legal/legalLinks';
import { LegalDialog } from '../components/LegalDialog';
import { AcornIcon, ChainIcon, ClockIcon, FlameIcon, GearIcon, GustIcon, HelpIcon, LeafIcon, SeedlingIcon, TrophyIcon } from '../components/Icons';
import { AdminPanel } from '../components/AdminPanel';
import { whenDoorsOpen } from '../components/BarnDoors';
import { useAdmin } from '../../lib/admin';
import { AvatarIcon, SheepHead } from '../avatars/AvatarIcon';
import { FeedbackDialog } from '../components/FeedbackDialog';
import { Bazaar } from '../shop/Bazaar';
import { Profile } from '../profile/Profile';
import { BOARDS_DEMO, Leaderboards } from '../boards/Leaderboards';
import { useWallet } from '../shop/store';
import { formatCoins } from '../shop/format';
import { useAvatar } from '../avatars/store';
import { PaintedGuide } from '../components/PaintedGuide';
import { MenuTag } from '../components/MenuTag';
import { GameMenu } from '../components/GameMenu';
import type { MenuItem } from '../components/GameMenu';
import { HomeSlab, HomeTitle, MenuIcon } from '../home/HomeParts';
import { HourglassIcon, SetupChoice, SetupGo, SetupRow, SetupSheet, WoolBallIcon } from '../home/SetupSheet';
import { WordOfDay } from '../wotd/WordOfDay';
import { useHour, useMotionLevel } from '../hooks/useAmbient';
import { DevLine } from '../table/DevStats';
import { FarmBackdrop } from '../table/FarmBackdrop';
import { useHomeFps } from '../perf/governor';
import { PaintedSettings } from './PaintedSettings';
import { SoundMenu } from '../components/SoundMenu';
import { getLang, setLang } from '../../lib/lang';

export const PAINTED_TITLE = PAINTED_GAME_TITLE;
/** Whether Home has already played its entrance this visit. */
let homeEntered = false;
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

/** How each custom rule shows as a row of the setup sheet: a short name, its icon, and what it means. */
const RULE_LOOK: Record<string, { name: string; icon: ReactNode; foot: string }> = {
  turnsPerRound: { name: 'Turns', icon: <ChainIcon size={22} />, foot: 'How many turns each sheep takes in a round.' },
  lives: { name: 'Wool', icon: <WoolBallIcon />, foot: 'Wool balls each sheep starts with.' },
  twists: { name: 'Twists', icon: <GustIcon size={22} />, foot: 'A new twist every round after the first.' },
};
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
  const [showRules, setShowRules] = useState(false);
  const [partyCode, setPartyCode] = useState('');
  const entering = useRoomStore((st) => st.entering);
  const [help, setHelp] = useState(false);
  const [bazaar, setBazaar] = useState(false);
  const [profile, setProfile] = useState(false);
  const wallet = useWallet();
  const wool = wallet.coins;
  useDevice(); // sets data-device on the page, which the skin's styles read
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
  const [more, setMore] = useState(false);
  // The entrance plays on the first Home of a visit only, not each time a game ends.
  const [entrance] = useState(() => { const first = !homeEntered; homeEntered = true; return first; });
  // It waits behind the loading screen and plays as that lifts (Brian, 2026-11-22: "the game pops outta nowhere"):
  // started at mount it was over before anyone could see it.
  const [lifted, setLifted] = useState(false);
  useEffect(() => (entrance ? whenDoorsOpen(() => setLifted(true)) : undefined), [entrance]);
  // Where the hero looks. A ref, not state (plan file 17, change 11): the sheep reads it as it is drawn, so moving the
  // pointer over Home renders nothing.
  const heroYaw = useRef(0);
  const heroGaze = useRef<[number, number] | null>(null);
  const [hopKey, setHopKey] = useState(0);
  const [tip, setTip] = useState(() => Math.floor(Math.random() * TIPS.length));
  const roomNotice = useRoomStore((st) => st.notice);
  const authStatus = useAuth((st) => st.status);
  const accountName = useAuth((st) => st.profile?.nickname ?? '');
  const hour = useHour();
  const reduced = useMotionLevel() === 'reduced';
  const mobile = usePhoneLayout();
  const today = useToday();
  const dream = getDream(today);
  const streak = getDreamStreak(today);
  const repair = repairAvailable(today);
  // The day a Warm Blanket covered a missed night, the ticket says so once.
  const [covered] = useState(() => takeCoverNotice());
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
    { id: 'queue', label: 'Queue', icon: <MenuIcon id="queue" />, busy: entering, sub: 'Real people, casual or ranked', caption: rooms ? 'We find you a table of real people. Casual for fun, Ranked to climb from Wood to Zenith.' : NO_SERVER, disabled: entering, onSelect: () => (rooms ? (setError(''), setChooser(true)) : undefined) }, // with no server its caption already says why
    // One lobby for every table you set yourself (Brian, 2026-11-14: "make custom game and create lobby the same thing ...
    // only with bots, only players, or bots and players"): inside it the host adds farm sheep, invites friends, or both.
    // It opens with the farm sheep the host had last time. With no server there is no lobby to open, so the same item
    // sets a table of farm sheep on this device.
    rooms
      ? { id: 'lobby', label: 'Create lobby', icon: <MenuIcon id="lobby" />, badge: <MenuTag tone="gray">Your barn</MenuTag>, caption: 'Make your own barn and invite friends with the party code.', disabled: entering, onSelect: () => online({ t: 'create', visibility: 'private' }) }
      : { id: 'lobby', label: ready ? 'Create lobby' : 'Loading…', icon: <MenuIcon id="lobby" />, badge: <MenuTag tone="gray">Farm sheep</MenuTag>, caption: 'Set a table of farm sheep (bots), then sit down.', disabled: !ready, onSelect: () => setStep('setup') },
    ...(rooms ? [
      { id: 'join', label: 'Join party', icon: <MenuIcon id="join" />, badge: <MenuTag tone="gray">Got a code?</MenuTag>, caption: 'Got a party code from a friend? Type it in and you are at their table.', onSelect: () => { setPartyCode(''); setStep('join'); } },
    ] satisfies MenuItem[] : []),
    // Admin plays tonight's dream as often as it likes; everyone else gets the one attempt, then the share.
    admin
      ? {
        id: 'dream', label: 'Counting Sheep', icon: <MenuIcon id="dream" />, badge: <MenuTag tone="gold">Admin</MenuTag>, disabled: !ready,
        caption: `Tonight's dream, as often as you like${dream?.status === 'done' ? ` (last run: ${dream.count ?? 0} sheep)` : ''}.`,
        onSelect: () => useDreamUi.getState().openDream(false),
      }
      : dream
      ? {
        id: 'dream', label: dream.status === 'done' ? (copiedDream ? 'Copied!' : 'Share dream') : 'Counting Sheep', icon: <MenuIcon id="dream" />,
        badge: dream.status === 'done' ? <MenuTag tone="gold">{dream.count ?? 0} sheep</MenuTag> : <MenuTag tone="gray">Used</MenuTag>,
        disabled: dream.status !== 'done', onSelect: shareDream,
        caption: <>The farmer is up for the day. Tonight's dream starts at {timeOfNext}.</>,
      }
      : {
        id: 'dream', label: 'Counting Sheep', icon: <MenuIcon id="dream" />, badge: streak > 0 ? <MenuTag tone="flame" label={`${streak}-night streak`}><FlameIcon size={11} />{streak} night{streak === 1 ? '' : 's'}</MenuTag> : <MenuTag tone="gold">Daily</MenuTag>, disabled: !ready,
        caption: <>{covered ? `A Warm Blanket kept your streak warm: ${streak} nights. ` : ''}Keep the farmer asleep: type words with each fence's letters so the sheep clears it. One dream a night.</>,
        onSelect: () => useDreamUi.getState().openDream(false),
      },
    ...(repair && !admin ? [{
      id: 'repair', label: 'Dream last night\'s dream', icon: <MenuIcon id="repair" />, badge: <MenuTag tone="gold">Keeps your streak</MenuTag>, disabled: !ready,
      caption: `Last night's dream, dreamt today: until ${new Date(new Date().setHours(23, 59, 0, 0)).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase()}.`,
      onSelect: () => useDreamUi.getState().openDream(false, repair),
    } satisfies MenuItem] : []),
    {
      id: 'practice', label: 'Practice', icon: <MenuIcon id="practice" />, badge: drillBest > 0 ? <MenuTag tone="green">Best {drillBest}</MenuTag> : undefined, disabled: !ready,
      caption: 'You against one bot, on one life. Chain as many words as you can.', onSelect: () => setStep('practice'),
    },
    { id: 'tutorial', label: 'Tutorial', icon: <MenuIcon id="tutorial" />, caption: 'A guided first game with the sheepdog, who shows you every rule as it comes up.', disabled: !ready, onSelect: () => startTour('menu') },
    // The Trading Post and the leaderboards are in the top bar (the wallet and the trophy) since the "Word chain" Home
    // (Brian, 2026-11-20, picked from the mock-ups): before, they were the menu's last two items (2026-11-14).
  ];
  // The name plate opens the profile, where the name, the avatar and the stats live.
  const shownName = (signedIn ? accountName : settings.name) || '';
  const lvl = levelOf(wallet.xp);
  // The box with your name IS the profile (Brian, 2026-11-14: "make the profile thing not a button below the quickplay
  // but that box in the top left, just embed it in there"): one night-blue block with the avatar, the name, the level in
  // ten segments, and the night streak.
  const filled = Math.round((10 * lvl.into) / Math.max(1, lvl.need));
  const profilePlate = (
    <button
      type="button" className={`hm-me hm-slab hm-slab--night`} onClick={() => setProfile(true)} onPointerEnter={() => setHopKey((k) => k + 1)}
      aria-label={`Your profile${shownName ? `: ${shownName}` : ''}, level ${lvl.level}`} title="Your profile: stats, rank, name and avatar" data-profile
    >
      <span className="hm-me-face" aria-hidden="true">{avatar ? <AvatarIcon id={avatar} size={26} /> : <SheepHead size={26} />}</span>
      <span className="hm-me-id">
        <span className="hm-me-name">{shownName || 'Your name'}</span>
        <span className="hm-me-lvl">LV {lvl.level}<span className="hm-xp" aria-hidden="true">{Array.from({ length: 10 }, (_, i) => <i key={i} data-on={i < filled || undefined} />)}</span></span>
      </span>
      {streak > 0 && <span className="hm-tag hm-tag--ink" aria-label={`${streak}-night streak`}><FlameIcon size={11} />{streak}</span>}
    </button>
  );
  // What went wrong never moves the menu (Brian: nothing shifts when a button is pressed). It is laid out of the
  // flow: under the menu on a computer, just above it on a phone.
  const notes = dictStatus === 'error' || error || (roomNotice && step !== 'join') ? (
    <>
      {dictStatus === 'error' && (
        <p role="alert">
          The word list did not load. Check your connection, then try again.
          <button className="hm-slab hm-slab--wool hm-slab--sm hm-retry" onClick={() => void retryDictionary()}>Retry</button>
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      {roomNotice && step !== 'join' && <p role="status">{roomNotice}</p>}
    </>
  ) : null;
  const tables = (
    <div className="relative" key="tables">
      <GameMenu items={items} label="Main menu" compact={mobile} autoFocus={!mobile && step === 'tables'} keys={step === 'tables'} />
      {!mobile && notes && <div className="hm-note">{notes}</div>}
    </div>
  );

  // The setup sheets (home/SetupSheet.tsx): they come out of the panel, every choice a leaning block. Custom shows the
  // three rules as rows of their own; picking a length puts them away again.
  const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1);
  const rulesShown = showRules || preset === 'custom';
  const heldPreset = (id: PresetId) => (id === 'custom' ? rulesShown : preset === id && !rulesShown);
  const tableNote = [rooms && 'A table of your own against the farm sheep (bots).', table.first && 'An easy table for your first games.'].filter(Boolean).join(' ');
  const setup = (
    <SetupSheet key="setup" label="Set the table" kicker={rooms ? 'Farm sheep' : 'Your own table'} title={rooms ? 'Custom game' : 'Set the table'} onClose={() => setStep('tables')}
      action={<SetupGo icon={<MenuIcon id="lobby" />} label="Sit down" onClick={() => go('quick')} disabled={!ready} sub={`${cap(preset)}, ${settings.playerCount} sheep, ${table.difficulty} bots`} />}
      note={tableNote || error ? <>{tableNote}{error && <b role="alert"> {error}</b>}</> : undefined}>
      <SetupRow icon={<HourglassIcon />} name="Length" label="Game length" foot={`About ${minutes} min`}>
        {PRESET_IDS.map((id) => (
          <SetupChoice key={id} on={heldPreset(id)} onClick={() => { if (id === 'custom') setShowRules(true); else { setShowRules(false); setRule(PRESETS[id]); } }}>{cap(id)}</SetupChoice>
        ))}
      </SetupRow>
      <SetupRow icon={<SheepHead size={22} />} name="Sheep" label="Sheep at the table"
        foot={<><span className="hm-setup-flock">{Array.from({ length: settings.playerCount }, (_, i) => <span key={i} className="sk-walk-in" style={{ animationDelay: `${i * 40}ms` }}><SheepHead size={16} /></span>)}</span>{farmSheepLine(settings.playerCount - 1)}</>}>
        {COUNTS.map((c) => <SetupChoice key={c} big on={settings.playerCount === c} onClick={() => setSettings({ playerCount: c })}>{c}</SetupChoice>)}
      </SetupRow>
      <SetupRow icon={DIFFS.find((d) => d.id === table.difficulty)?.icon} name="Bots" label="Bot difficulty">
        {DIFFS.map((d) => (
          <SetupChoice key={d.id} on={table.difficulty === d.id} onClick={() => setSettings({ difficulty: d.id, game: rules, tableChosen: true })}>{d.icon}{cap(d.id)}</SetupChoice>
        ))}
      </SetupRow>
      {rulesShown && RULES.map((r) => (
        <SetupRow key={r.key} icon={RULE_LOOK[r.key].icon} name={RULE_LOOK[r.key].name} label={r.label} foot={RULE_LOOK[r.key].foot}>
          {r.values.map((v) => (
            <SetupChoice key={String(v)} big={typeof v === 'number'} on={rules[r.key] === v} onClick={() => setRule({ [r.key]: v } as Partial<GameSettings>)}>{r.show ? r.show(v) : String(v)}</SetupChoice>
          ))}
        </SetupRow>
      ))}
    </SetupSheet>
  );

  const drillSetup = (
    <SetupSheet key="practice" label="Practice run" kicker="Speed run" title="Practice" onClose={() => setStep('tables')}
      action={<SetupGo icon={<MenuIcon id="practice" />} label="Start run" onClick={() => go('practice')} disabled={!ready} autoFocus sub={drillBest > 0 ? `Best here: ${drillBest} word${drillBest === 1 ? '' : 's'}` : 'No run here yet'} />}
      note={<>You and one bot, on one life. Every word you play scores a point, and your run ends the first time your clock runs out.{error && <b role="alert"> {error}</b>}</>}>
      <SetupRow icon={<ClockIcon size={22} />} name="Clock" label="Starting clock" foot="It loses a second every 5 words.">
        {PRACTICE_CLOCKS.map((c) => <SetupChoice key={c} big on={drill.clock === c} onClick={() => setDrill({ clock: c })}>{c} s</SetupChoice>)}
      </SetupRow>
      <SetupRow icon={DIFFS.find((d) => d.id === drill.difficulty)?.icon} name="Bot" label="Bot" foot={DRILL_BOTS[drill.difficulty]}>
        {DIFFS.map((d) => <SetupChoice key={d.id} on={drill.difficulty === d.id} onClick={() => setDrill({ difficulty: d.id })}>{d.icon}{cap(d.id)}</SetupChoice>)}
      </SetupRow>
    </SetupSheet>
  );
  const joinGo = () => { if (partyCode.length === 5 && !entering) online({ t: 'join', code: partyCode }); };
  const joinParty = (
    <SetupSheet key="join" label="Join a party" kicker="With friends" title="Join party" onClose={() => setStep('tables')}
      action={<SetupGo icon={<MenuIcon id="join" />} label="Join party" onClick={joinGo} disabled={partyCode.length < 5 || entering}
        sub={partyCode.length === 5 ? `To party ${partyCode}` : `${5 - partyCode.length} more to type`} />}
      note={<>Your friend's party code is on their lobby screen. Type it here and you are at their table.{(error || roomNotice) && <b role="alert"> {error || roomNotice}</b>}</>}>
      <SetupRow icon={<MenuIcon id="join" />} name="Code" label="Party code" foot="Five letters or numbers.">
        <form className="sk-code-form" onSubmit={(e) => { e.preventDefault(); joinGo(); }}>
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
        </form>
      </SetupRow>
    </SetupSheet>
  );
  const panel = step === 'practice' ? drillSetup : step === 'join' ? joinParty : setup;

  // The small print: on a computer at the right of the footer; on a phone behind "More".
  const smallPrint = (
    <>
      <span className="hm-version">v{pkg.version}</span>
      <button onClick={() => setFeedback(true)}>Feedback</button>
      {(['privacy', 'terms', 'child-safety'] as const).map((slug) => (
        <button key={slug} onClick={() => setLegal(slug)} aria-label={LEGAL_TITLES[slug]}>{SHORT_LEGAL[slug]}</button>
      ))}
      <button onClick={() => setAdminOpen(true)} aria-label={admin ? 'Admin (unlocked)' : 'Admin access'} title={admin ? 'Admin: unlocked' : 'Admin access'} aria-pressed={admin} data-admin={admin || undefined}>{admin ? 'Admin on' : 'Admin'}</button>
    </>
  );
  // The farm rests (fewer pictures a second, the same motion) behind an open dialog and when Home is left alone.
  const farmFps = useHomeFps(chooser || signIn || help || gear || legal !== null || feedback || profile || adminOpen);
  const square = 'hm-slab hm-slab--wool hm-slab--sm hm-square';
  const helpButton = <button className={square} onClick={() => setHelp(true)} aria-label="How to Play" title="How to play"><HelpIcon /></button>;
  const trophy = (rooms || BOARDS_DEMO) && <button className={square} onClick={() => setBoards(true)} aria-label="Leaderboards" title="Leaderboards"><TrophyIcon size={20} /></button>;
  const purse = (
    <span className="hm-purse">
      <button className="hm-slab hm-slab--ink hm-slab--sm hm-coins" onClick={() => setBazaar(true)} aria-label={`The Trading Post, ${formatCoins(wool)} Wool Coins`} title="The Trading Post">
        <i className="hm-coin" aria-hidden="true" />{formatCoins(wool, true)}
      </button>
      <button className="hm-slab hm-slab--lantern hm-slab--sm hm-square hm-plus" onClick={() => setBazaar(true)} aria-label="Get more Wool Coins" title="The Trading Post"><i aria-hidden="true" /></button>
    </span>
  );
  const account = authEnabled() && (authStatus === 'ready'
    ? <button className="hm-slab hm-slab--wool hm-slab--sm hm-pill" onClick={() => setSignIn(true)} aria-label="Account" title="Account">Account</button>
    : <button className="hm-slab hm-slab--wool hm-slab--sm hm-pill" onClick={openSignInForm} aria-label="Log in" title="Log in to save your progress">Log in</button>);
  // The language switch (Kai, pull request 56): the whole game, word list included, in French or in English. A square
  // like the others, naming the language it switches to (HOME-UI-PLAN section 8).
  const lang = (
    <button className={`${square} hm-lang`} data-lang-switch data-i18n-skip onClick={() => setLang(getLang() === 'fr' ? 'en' : 'fr')}
      aria-label={getLang() === 'fr' ? 'English' : 'Français'} title={getLang() === 'fr' ? 'Play in English' : 'Jouer en français'}>
      {getLang() === 'fr' ? 'EN' : 'FR'}
    </button>
  );
  const tipLine = <p className="hm-tip" aria-live="off"><span className="hm-tag hm-tag--lantern">Tip</span><span key={tip} className="hm-tip-text">{TIPS[tip]}</span></p>;

  return (
    // data-covered: a full page lies over Home, so its panel and title hold still (home.css). data-enter: the first Home
    // of this visit, which plays the entrance.
    <main className={`sk-home hm relative h-full overflow-hidden`} data-covered={bazaar || boards || profile || undefined} data-phone={mobile || undefined} data-enter={entrance ? (lifted ? 'play' : 'wait') : undefined} data-rows={items.length} onPointerMove={onPointerMove} onKeyDown={onKey}>
      <div className="absolute inset-0"><FarmBackdrop hour={hour} reduced={reduced} sleepy={!!dream} phone={mobile} heroYaw={heroYaw} heroGaze={heroGaze} hopKey={hopKey} paused={bazaar || boards} fps={farmFps} /></div>
      <HomeSlab />

      {mobile ? (
        // A phone: the chip and the purse at the top, the square buttons under the purse, and a sheet at the foot with
        // the title and the menu (scrolling in itself), the word of the day as one line, and the footer.
        <>
          <div className="hm-chip">{profilePlate}</div>
          <div className="hm-corner">{purse}<div className="hm-squares">{trophy}{lang}{account}<button className={square} onClick={() => setGear(true)} aria-label="Settings" title="Settings"><GearIcon /></button><SoundMenu />{helpButton}</div></div>
          <div className="hm-sheet-col">
            {notes && step === 'tables' && <div className="hm-note">{notes}</div>}
            <div className="hm-scroll">
              {step === 'tables' ? <><HomeTitle title={PAINTED_TITLE} />{tables}</> : <div className="hm-panel-slot">{panel}</div>}
            </div>
            <WordOfDay className="sk-wotd--compact" />
          </div>
          <footer className="hm-foot">
            {tipLine}
            <button className="hm-more" aria-expanded={more} onClick={() => setMore((m) => !m)}>More</button>
            {more && <nav className="hm-small hm-more-list" aria-label="About the game">{smallPrint}</nav>}
          </footer>
        </>
      ) : (
        <>
          {/* Inside the panel: the chip, then the title, tagline and menu as one block, then the word of the day. */}
          <div className="hm-col">
            {profilePlate}
            <div className="hm-block">
              <HomeTitle title={PAINTED_TITLE} tagline="Chain words. Keep your wool. Outlast the flock." />
              {/* One wrapper always, so a panel dims the menu without remounting it (and replaying its entry). */}
              <div className={step === 'tables' ? undefined : step === 'join' ? 'pointer-events-none opacity-40' : 'pointer-events-none hm-menu-held'} data-held={step === 'setup' ? 'lobby' : step === 'practice' ? 'practice' : undefined} inert={step !== 'tables'}>{tables}</div>
            </div>
          </div>
          <div className="hm-corner">
            {purse}{trophy}{lang}{account}
            <button className={square} onClick={() => setGear(true)} aria-label="Settings" title="Settings"><GearIcon /></button>
            <SoundMenu />
            {helpButton}
          </div>
          {/* The word of the day floats over the scenery under the top-right buttons (Brian, 2026-11-20: "i like it being
              over the scenery, however i dont like the card ... just the text very slightly tilted"). A panel takes its place. */}
          {step === 'tables' ? <WordOfDay className="hm-wotd" /> : <div className={"hm-panel-slot hm-panel-slot--lean"}>{panel}</div>}
          <footer className="hm-foot">
            {tipLine}
            <nav className="hm-small" aria-label="About the game">{smallPrint}</nav>
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
