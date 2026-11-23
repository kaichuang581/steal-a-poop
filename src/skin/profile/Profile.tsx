import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { api, ApiError, useAuth } from '../../auth/authStore';
import { apiBase, authEnabled } from '../../auth/config';
import { FESTIVE } from '../../config';
import { getDreamBest, getDreamStreak, loadStreak } from '../../dream/daily';
import type { Difficulty } from '../../engine';
import { checkNickname, MAX_NICKNAME } from '../../lib/nickname';
import { getPracticeSheet, PRACTICE_WEIGHT } from '../../lib/practice';
import type { PracticeCell, PracticeSheet } from '../../lib/practice';
import { getRecord } from '../../lib/record';
import { useStore } from '../../state/store';
import type { Stats } from '../../state/socialStore';
import { AuthDialog } from '../../ui/auth/AuthDialog';
import { AvatarIcon } from '../avatars/AvatarIcon';
import { AvatarPicker } from '../avatars/AvatarPicker';
import { useAvatar } from '../avatars/store';
import { Icon } from '../boards/art';
import { StopwatchIcon, TreeIcon } from '../home/SetupSheet';
import { useMotionLevel } from '../hooks/useAmbient';
import { usePageHistory } from '../hooks/usePageHistory';
import { useToday } from '../hooks/useToday';
import { BoardFrame, Lights, Pix, SnowCap } from '../kit/surfaces';
import { PEN_ART, SheepHead } from '../rooms/penArt';
import { ProfileRank } from '../ranked/ProfileRank';
import { FriendsSection } from './FriendsSection';
import { LengthArt, LetterArt, MoonArt, PencilArt, ShieldArt } from './art';
import { SectionHead } from './parts';
import { levelOf, titleFor } from '../shop/economy';
import { online, useWallet } from '../shop/store';
import './profile.css';

/**
 * The board (GET /api/barn/top): the 100 players with the most XP, how many players there are, and where you stand.
 * No account ids: a name, a level and an XP count for each.
 */
export interface BoardRow { place: number; name: string; xp: number; level: number; you: boolean }
export interface Board { top: BoardRow[]; players: number; you: { place: number; xp: number } | null }
/** How many players the board lists: on it you are shown your place, below it your share of all players. */
export const BOARD_TOP = 100;

/**
 * "0.5" for place 101 of 20,000: the share of players at or above you, in percent. Rounded up, so it never reads 0 and
 * never flatters; two figures when it is under one percent ("0.0051"), one decimal under ten, whole above.
 */
export function topPercent(place: number, players: number): string {
  const p = (100 * Math.max(1, place)) / Math.max(1, players, place);
  if (p >= 10) return String(Math.min(100, Math.ceil(p)));
  const places = p >= 1 ? 1 : Math.ceil(-Math.log10(p)) + 1;
  return (Math.ceil(p * 10 ** places - 1e-9) / 10 ** places).toFixed(places).replace(/\.?0+$/, '');
}
/** What the standing box says in big letters: your place on the board, or your share below it. */
export function standingLine(you: { place: number }, players: number): string {
  return you.place <= BOARD_TOP ? `#${you.place.toLocaleString()}` : `Top ${topPercent(you.place, players)}%`;
}

const RENAME_ERR: Record<string, string> = {
  bad_nickname: 'Choose a different name: 2 to 12 letters, numbers, spaces, dots, dashes or underscores, and nothing rude.',
  nickname_taken: 'That name is taken. Try another.',
  rate_limited: 'You have changed your name a few times today. Try again tomorrow.',
};

/** One number Tile on the profile: its icon, the number (or word), and the label line under it. */
export interface Stat { id: 'words' | 'wins' | 'sheep' | 'longest' | 'streak'; label: string; value: string; none?: boolean }

/** The five numbers this device keeps. */
export interface LocalNumbers { words: number; wins: number; longest: string; dreamBest: number; streak: number; bestStreak: number }

/** Whether nothing has been played on this device yet. */
export const nothingPlayed = (n: LocalNumbers): boolean => !n.words && !n.wins && !n.longest && !n.dreamBest && !n.streak;

/**
 * The five number Tiles (the profile plan, section 4), in their grid order: Words, Wins, Sheep, then Longest word (two
 * columns wide) and Night streak. A Tile with nothing behind it shows 0 (the longest word: a dash) and keeps its label.
 * `onlineWins`, when the account's room wins are known, joins the Wins Tile: the value is the total.
 */
export function numberSlips(n: LocalNumbers, onlineWins: number | null = null): Stat[] {
  return [
    { id: 'words', value: n.words.toLocaleString(), label: 'different words played' },
    onlineWins === null
      ? { id: 'wins', value: n.wins.toLocaleString(), label: 'Quick Game wins' }
      : { id: 'wins', value: (n.wins + onlineWins).toLocaleString(), label: `Quick Games ${n.wins.toLocaleString()}, online ${onlineWins.toLocaleString()}` },
    { id: 'sheep', value: n.dreamBest.toLocaleString(), label: 'sheep in one night' },
    n.longest
      ? { id: 'longest', value: n.longest.toUpperCase(), label: `longest word, ${n.longest.length} letters` }
      : { id: 'longest', value: '–', none: true, label: 'longest word' },
    { id: 'streak', value: n.streak.toLocaleString(), label: `nights in a row, best ${n.bestStreak.toLocaleString()}` },
  ];
}

const STAT_ICON: Record<Stat['id'], () => ReactNode> = {
  words: () => <LetterArt />,
  wins: () => <Icon name="wins" color="var(--hm-lantern)" />,
  sheep: () => <SheepHead px={3} />,
  longest: () => <LengthArt />,
  streak: () => <MoonArt />,
};

/** The pixel cross (the cards plan, 5.1), for the close square. */
export const CROSS = ['XX....XX', 'XXX..XXX', '.XXXXXX.', '..XXXX..', '..XXXX..', '.XXXXXX.', 'XXX..XXX', 'XX....XX'];

/** The screen's unit (--u) in px, read from the element: the festive lights are laid out in it. */
export function useUnit(ref: React.RefObject<HTMLElement | null>): number {
  const [u, setU] = useState(1);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => setU(parseFloat(getComputedStyle(el).getPropertyValue('--u')) || 1);
    read();
    window.addEventListener('resize', read);
    return () => window.removeEventListener('resize', read);
  }, [ref]);
  return u;
}

/**
 * The profile (Brian, 2026-11-23: "ultra refine this, needs a ton of work, dont be generic"; his profile plan): one Board
 * over Home in the game's current look, the leaderboard's and the pen's recipes only. A ribbon and a close square in a
 * fixed header; under it two columns on a computer (who you are, your numbers and your friends; your rank and your
 * practice), one on a narrow screen, and a single note at the foot saying where the numbers are kept. Nothing is drawn
 * under the header, and at 1280 x 800 nothing scrolls. Saving the name, the avatar, the numbers, the friend code and the
 * ranks all work as before; only the look and some words changed.
 */
export function Profile({ onClose }: { onClose: () => void }) {
  const [picker, setPicker] = useState(false);
  const [signIn, setSignIn] = useState(false);
  usePageHistory('profile', onClose, () => picker || signIn);

  const wallet = useWallet();
  const avatar = useAvatar();
  const today = useToday();
  const reduced = useMotionLevel() === 'reduced';
  const { settings, setSettings } = useStore();
  const authStatus = useAuth((s) => s.status);
  const profile = useAuth((s) => s.profile);
  const signedIn = authEnabled() && authStatus === 'ready' && !!profile;
  const account = signedIn && online();

  const record = getRecord();
  const lv = levelOf(wallet.xp);
  const streak = getDreamStreak(today);
  const bestStreak = Math.max(loadStreak().best, streak);
  const close = useRef<HTMLButtonElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const u = useUnit(card);
  useEffect(() => { close.current?.focus({ preventScroll: true }); }, []);

  // Online numbers and the board need the game server and a signed-in player. Read once, when the page opens.
  const [board, setBoard] = useState<Board | 'loading' | 'error'>('loading');
  const [onlineStats, setOnlineStats] = useState<Stats | 'loading' | 'error'>('loading');
  useEffect(() => {
    if (!account) return;
    let live = true;
    const token = useAuth.getState().session?.access_token ?? null;
    api<Board>('GET', '/api/barn/top', token).then((b) => live && setBoard(b), () => live && setBoard('error'));
    api<Stats>('GET', '/api/me/stats', token).then((s) => live && setOnlineStats(s), () => live && setOnlineStats('error'));
    return () => { live = false; };
  }, [account]);

  const mine: LocalNumbers = { words: wallet.words.length, wins: record.wins, longest: record.bests.longest, dreamBest: getDreamBest(), streak, bestStreak };
  const stats = numberSlips(mine, account && typeof onlineStats === 'object' ? onlineStats.wins : null);
  const friends = !!apiBase() && (!authEnabled() || authStatus !== 'loading');

  return (
    <>
    <div className="pf-scrim" onClick={onClose}>
      <div ref={card} role="dialog" aria-modal="true" aria-labelledby="pf-title" className="pf hm rc" onClick={(e) => e.stopPropagation()}>
        <i className="pf-face" aria-hidden="true" />
        <BoardFrame />
        <SnowCap icicles />
        <header className="pf-head">
          <h2 id="pf-title" className="pf-ribbon"><i className="pf-ribbon-face" aria-hidden="true" /><SheepHead px={3} /><span>Your profile</span></h2>
          <button ref={close} type="button" className="pf-close hm-slab hm-knit" onClick={onClose} aria-label="Close" title="Close"><Pix rows={CROSS} colors={{ X: 'var(--hm-ink)' }} /></button>
          {FESTIVE && <Lights u={u} reduced={reduced} />}
        </header>
        <div className="pf-body" onScroll={(e) => e.currentTarget.toggleAttribute('data-scrolled', e.currentTarget.scrollTop > 0)}>
          <div className="pf-col">
            <Identity avatar={avatar} onAvatar={() => setPicker(true)} lv={lv} xp={wallet.xp} signedIn={signedIn} onSignIn={() => setSignIn(true)}
              name={<NameEditor signedIn={signedIn} accountName={profile?.nickname ?? ''} localName={settings.name} setLocalName={(name) => setSettings({ name })} />} />
            <section className="pf-sec pf-sec--numbers" aria-labelledby="pf-numbers">
              <SectionHead id="pf-numbers" icon={<LetterArt />} title="Your numbers" />
              <div className="pf-tiles">
                {stats.map((s) => (
                  <div key={s.id} className="pf-tile" data-stat={s.id}>
                    <span className="pf-tile-icon">{STAT_ICON[s.id]()}</span>
                    <span className="pf-tile-text">
                      <b className="pf-tile-value" data-none={s.none || undefined} data-long={s.id === 'longest' && !s.none ? (s.value.length > 12 ? 'xl' : s.value.length > 9 ? 'l' : undefined) : undefined}>{s.value}</b>
                      <span className="pf-tile-label">{s.label}</span>
                    </span>
                  </div>
                ))}
              </div>
            </section>
            {/* Practice sits under the numbers and Friends under Ranked (the plan had them the other way): that way both
                columns fit at 1280 x 800 with three friends, the plan's own goal. One column keeps the plan's order. */}
            <PracticeBests sheet={getPracticeSheet()} />
            <footer className="pf-foot"><ShieldArt quiet /><span>Your numbers and friends are saved in this browser. Clearing its data resets them.</span></footer>
          </div>
          <div className="pf-col">
            <ProfileRank />
            {friends && <FriendsSection account={account} guestName={settings.name} />}
            {account && typeof board === 'object' && board.top.length > 0 && <TopBoard board={board} />}
          </div>
        </div>
      </div>
    </div>
    {/* Beside the page, not inside its scrim: a click that closed the picker used to carry on and close the profile too. */}
    {picker && <AvatarPicker onClose={() => setPicker(false)} />}
    {signIn && <AuthDialog onClose={() => setSignIn(false)} />}
    </>
  );
}

/** Who you are: the avatar with its pencil, the name, and the level with its XP bar. */
function Identity({ avatar, onAvatar, lv, xp, name, signedIn, onSignIn }: {
  avatar: string | null; onAvatar: () => void; lv: { level: number; into: number; need: number }; xp: number; name: ReactNode; signedIn: boolean; onSignIn: () => void;
}) {
  const share = lv.need > 0 ? lv.into / lv.need : 0;
  return (
    <section className="pf-card pf-id" aria-label="You">
      <div className="pf-avatar">
        <span className="pf-avatar-tile">{avatar ? <AvatarIcon id={avatar} size={64} /> : <SheepHead px={6} />}</span>
        <button type="button" className="pf-pencil hm-slab" onClick={onAvatar} aria-label="Change avatar" title="Change avatar"><PencilArt /></button>
      </div>
      <div className="pf-id-main">
        {name}
        <div className="pf-level">
          <span className="pf-tag pf-tag--lantern">{`Lv ${lv.level}`}</span>
          <b className="pf-level-name">{titleFor(lv.level)}</b>
          <span className="pf-level-xp"><b>{xp.toLocaleString()}</b>{' XP, '}<b>{(lv.need - lv.into).toLocaleString()}</b>{` to Lv ${lv.level + 1}`}</span>
        </div>
        <span className="pf-xp" role="img" aria-label={`${lv.into} of ${lv.need} XP into level ${lv.level}`}>
          {Array.from({ length: 10 }, (_, i) => <i key={i} style={{ '--fill': `${Math.max(0, Math.min(1, share * 10 - i)) * 100}%` } as CSSProperties} />)}
        </span>
        {authEnabled() && (
          <button type="button" className="pf-slab pf-account hm-slab hm-knit" onClick={onSignIn}>{signedIn ? 'Account' : 'Sign in'}</button>
        )}
      </div>
    </section>
  );
}

/** The multiplication sign of the written-out sums (arithmetic, not an icon). */
const TIMES = '\u00D7';
const BOT: Record<Difficulty, { name: string }> = { easy: { name: 'Easy' }, medium: { name: 'Medium' }, hard: { name: 'Hard' } };
/** "×1.5": what a setting multiplies a run's rating by. */
const times = (w: number) => `${TIMES}${w}`;
/** "12 words, Hard, 10 s": a run, in the profile's short form (commas: no middle dots, Brian 2026-11-14). */
export function runLine(cell: { words: number; difficulty: Difficulty; clock: number }): string {
  return `${cell.words} word${cell.words === 1 ? '' : 's'}, ${BOT[cell.difficulty].name}, ${cell.clock} s`;
}
/** The rating's sum, written out: "6 × 1.5 × 1.5 = 13.5, rounded to 14", or "24 × 2 × 2 = 96". */
export function ratingSum(c: PracticeCell): { parts: [number, number, number]; product: number; rating: number } {
  const bot = PRACTICE_WEIGHT.bot[c.difficulty], clock = PRACTICE_WEIGHT.clock[c.clock] ?? 1;
  return { parts: [c.words, bot, clock], product: c.words * bot * clock, rating: c.rating };
}
const num = (n: number) => (Number.isInteger(n) ? n.toLocaleString() : n.toLocaleString(undefined, { maximumFractionDigits: 2 }));
/** The tooltip of a filled cell. */
export function cellTip(c: PracticeCell): string {
  const { parts, product, rating } = ratingSum(c);
  const sum = `${parts.map(num).join(` ${TIMES} `)} = ${num(product)}`;
  return `${c.words} word${c.words === 1 ? '' : 's'}, ${BOT[c.difficulty].name} bot, ${c.clock} s clock: ${sum}${product === rating ? '' : `, rounded to ${rating.toLocaleString()}`}`;
}

/**
 * Practice (the profile plan, section 7): the best-rated run with its sum written out (words × bot × clock), and every
 * setting's best in a grid of sunk wells, a row a bot and a column a starting clock, each head with its multiplier. The
 * best cell is a raised lantern tile. Ratings come from lib/practice.ts, unchanged.
 */
export function PracticeBests({ sheet }: { sheet: PracticeSheet }) {
  const { top } = sheet;
  const sum = top ? ratingSum(top) : null;
  return (
    <section className="pf-sec pf-sec--practice" aria-labelledby="pf-practice">
      <SectionHead id="pf-practice" icon={<span style={{ color: 'var(--hm-wool)', display: 'contents' }}><StopwatchIcon /></span>} title="Practice" />
      <div className="pf-card pf-drill">
        <div className="pf-rating">
          <span className="pf-label">Best rating</span>
          <b className="pf-rating-value" data-none={!top || undefined}>{top ? top.rating.toLocaleString() : '–'}</b>
          <span className="pf-rating-run">{top ? runLine(top) : 'Finish a practice run to get a rating.'}</span>
          {sum && (
            <span className="pf-sum" role="img" aria-label={`${sum.parts.map(num).join(' times ')} equals ${num(sum.product)}${sum.product === sum.rating ? '' : `, rounded to ${sum.rating}`}`}>
              {sum.parts.map((p, i) => <span key={i} className="pf-sum-n" style={{ gridColumn: 2 * i + 1 }}>{num(p)}</span>)}
              <span className="pf-sum-op" style={{ gridColumn: 2 }}>{TIMES}</span>
              <span className="pf-sum-op" style={{ gridColumn: 4 }}>{TIMES}</span>
              <span className="pf-sum-op" style={{ gridColumn: 6 }}>=</span>
              <b className="pf-sum-n" style={{ gridColumn: 7 }}>{sum.rating.toLocaleString()}</b>
              {['words', 'bot', 'clock'].map((w, i) => <small key={w} style={{ gridColumn: 2 * i + 1 }}>{w}</small>)}
            </span>
          )}
        </div>
        <div className="pf-grid" role="table" aria-label="Your best practice run at each bot and starting clock">
          <span role="row" className="pf-grid-row">
            <span role="columnheader" className="pf-grid-corner"><span className="sr-only">Bot</span></span>
            {sheet.rows[0].cells.map((c) => (
              <span role="columnheader" key={c.clock} className="pf-grid-col"><b>{c.clock}{' '}s</b><span className="pf-mult">{times(PRACTICE_WEIGHT.clock[c.clock] ?? 1)}</span></span>
            ))}
          </span>
          {sheet.rows.map((row) => (
            <span role="row" key={row.difficulty} className="pf-grid-row">
              <span role="rowheader" className="pf-grid-bot">
                <span className="pf-grid-bot-name"><TreeIcon level={row.difficulty} /><b>{BOT[row.difficulty].name}</b></span>
                <span className="pf-mult">{times(PRACTICE_WEIGHT.bot[row.difficulty])}</span>
              </span>
              {row.cells.map((c) => {
                const best = top !== null && c.clock === top.clock && c.difficulty === top.difficulty;
                return c.words ? (
                  <span role="cell" key={c.clock} tabIndex={0} className="pf-cell" data-top={best || undefined} aria-label={`${cellTip(c)}${best ? '. Your best-rated run' : ''}`}>
                    <b>{c.words}</b><small>{`rated ${c.rating.toLocaleString()}`}</small>
                    <span className="pf-tip" aria-hidden="true">{cellTip(c)}</span>
                  </span>
                ) : (
                  <span role="cell" key={c.clock} className="pf-cell" data-none aria-label={`${BOT[c.difficulty].name} bot, ${c.clock} s clock: not played`}><i /></span>
                );
              })}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Signed in: the top players by XP, and where you stand among them (once "Your standing"). */
function TopBoard({ board }: { board: Board }) {
  return (
    <section className="pf-sec pf-sec--board" aria-labelledby="pf-board">
      <SectionHead id="pf-board" icon={<Icon name="level" color="var(--hm-wool)" />} title={`Top ${Math.min(BOARD_TOP, board.top.length)} by XP`}>
        {board.you && <span className="pf-quiet">{board.you.place <= BOARD_TOP ? `You are ${standingLine(board.you, board.players)}` : `You are in the top ${topPercent(board.you.place, board.players)}%`}</span>}
      </SectionHead>
      <ol className="pf-card pf-board">
        {board.top.map((r) => (
          <li key={r.place} className="pf-board-row" data-you={r.you || undefined} aria-current={r.you ? 'true' : undefined}>
            <span className="pf-board-place">{r.place}</span>
            <span className="pf-board-name">{r.name}</span>
            <span className="pf-tag">{`Lv ${r.level}`}</span>
            <span className="pf-board-xp">{r.xp.toLocaleString()} XP</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** The name, edited in place. Guests change the name kept in this browser; signed-in players change their account nickname. */
function NameEditor({ signedIn, accountName, localName, setLocalName }: { signedIn: boolean; accountName: string; localName: string; setLocalName: (n: string) => void }) {
  const current = signedIn ? accountName : localName;
  const [draft, setDraft] = useState(current);
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  useEffect(() => setDraft(current), [current]);
  useEffect(() => { if (!saved) return; const t = setTimeout(() => setSaved(false), 2000); return () => clearTimeout(t); }, [saved]);

  const save = async () => {
    const nick = checkNickname(draft);
    if (!nick.ok) return setMsg({ text: nick.message, bad: true });
    if (nick.name === current) return setMsg(null);
    if (!signedIn) {
      setLocalName(nick.name);
      setMsg(null);
      return setSaved(true);
    }
    setBusy(true);
    try {
      await useAuth.getState().rename(nick.name);
      setMsg({ text: 'Rooms you join from now on show the new name.' });
      setSaved(true);
    } catch (e) {
      setMsg({ text: RENAME_ERR[e instanceof ApiError ? e.code : ''] ?? 'Your name could not be saved. Try again in a moment.', bad: true });
    } finally {
      setBusy(false);
    }
  };
  const changed = draft.trim() !== current;
  return (
    <form className="pf-name" onSubmit={(e) => { e.preventDefault(); void save(); }}>
      <label className="pf-label" htmlFor="prof-name">{signedIn ? 'Your username' : 'Your name'}</label>
      <span className="pf-name-row">
        <input
          id="prof-name" className="pf-input pf-input--name" value={draft} placeholder="Your name"
          maxLength={MAX_NICKNAME} autoComplete="off" spellCheck={false}
          onChange={(e) => { setDraft(e.target.value.slice(0, MAX_NICKNAME)); setMsg(null); setSaved(false); }}
          onKeyDown={(e) => { if (e.key === 'Escape' && changed) { e.preventDefault(); e.stopPropagation(); setDraft(current); } }}
        />
        <button type="submit" className={`pf-slab pf-slab--40 hm-slab hm-knit ${changed ? 'hm-slab--lantern' : ''}`} disabled={busy || (!changed && !saved)} data-saved={saved && !changed || undefined}>
          {saved && !changed ? <><Pix rows={PEN_ART.check} colors={{ X: 'currentColor' }} />Saved</> : busy ? 'Saving…' : 'Save'}
        </button>
      </span>
      {msg && <span role={msg.bad ? 'alert' : 'status'} className="pf-msg" data-bad={msg.bad || undefined}>{msg.text}</span>}
    </form>
  );
}
