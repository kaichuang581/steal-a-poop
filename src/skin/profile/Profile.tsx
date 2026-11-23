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
import { PEN_ART, PenIcon, SheepHead } from '../rooms/penArt';
import { ProfileRank } from '../ranked/ProfileRank';
import { FriendsSection } from './FriendsSection';
import { BarsArt, LengthArt, LetterArt, MoonArt, PencilArt, PineArt, ShieldArt } from './art';
import { IconTile, Section } from './parts';
import type { TileTone } from './parts';
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

/** One number Tile on the profile: its icon, the number (or word), and the label line under it (one line). */
export interface Stat { id: 'words' | 'wins' | 'sheep' | 'longest' | 'streak'; label: string; value: string; none?: boolean }

/** The five numbers this device keeps. */
export interface LocalNumbers { words: number; wins: number; longest: string; dreamBest: number; streak: number; bestStreak: number }

/** Whether nothing has been played on this device yet. */
export const nothingPlayed = (n: LocalNumbers): boolean => !n.words && !n.wins && !n.longest && !n.dreamBest && !n.streak;

/**
 * The five number Tiles (the profile plan v2, section 6), in grid order: Words, Wins, Sheep, then Longest word (two
 * columns, spelled in letter tiles) and Night streak. Every label is one line. A Tile with nothing behind it shows 0 (the
 * longest word: empty tiles). `onlineWins`, when the account's room wins are known, joins the one Wins Tile.
 */
export function numberSlips(n: LocalNumbers, onlineWins: number | null = null): Stat[] {
  return [
    { id: 'words', value: n.words.toLocaleString(), label: 'words played' },
    onlineWins === null
      ? { id: 'wins', value: n.wins.toLocaleString(), label: 'Quick Game wins' }
      : { id: 'wins', value: (n.wins + onlineWins).toLocaleString(), label: `Quick ${n.wins.toLocaleString()} · online ${onlineWins.toLocaleString()}` },
    { id: 'sheep', value: n.dreamBest.toLocaleString(), label: 'sheep in a night' },
    n.longest
      ? { id: 'longest', value: n.longest.toUpperCase(), label: `longest word · ${n.longest.length} letters` }
      : { id: 'longest', value: '', none: true, label: 'longest word' },
    { id: 'streak', value: n.streak.toLocaleString(), label: `night streak · best ${n.bestStreak.toLocaleString()}` },
  ];
}

const STAT_LOOK: Record<Stat['id'], { tone: TileTone; icon: () => ReactNode }> = {
  words: { tone: 'dusk', icon: () => <LetterArt /> },
  wins: { tone: 'lantern', icon: () => <Icon name="wins" color="var(--hm-wool)" /> },
  sheep: { tone: 'pasture', icon: () => <SheepHead px={3} /> },
  longest: { tone: 'barn', icon: () => <LengthArt /> },
  streak: { tone: 'night', icon: () => <MoonArt /> },
};

/** The longest word as the game's letter blocks: a slab a letter, smaller from 14 letters, "…" when it still will not fit. */
export function LetterTiles({ word, room = 18 }: { word: string; room?: number }) {
  if (!word) return <span className="pf-letters" aria-label="No longest word yet">{[0, 1, 2].map((i) => <i key={i} className="pf-letter" data-empty="" />)}</span>;
  const small = word.length >= 14;
  const max = small ? Math.round(room * 1.2) : room;
  const more = word.length > max;
  const shown = more ? word.slice(0, max - 1).split('') : word.split('');
  return (
    <span className="pf-letters" data-small={small || undefined} aria-label={word}>
      {shown.map((c, i) => <i key={i} className="pf-letter" aria-hidden="true">{c}</i>)}
      {more && <i className="pf-letter" data-more="" aria-hidden="true" />}
    </span>
  );
}

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
 * The profile (Brian, 2026-11-23: "ultra refine this, needs a ton of work, dont be generic", then of the result: bland,
 * poorly placed, crammed; his profile plans v1 and v2). One Board over Home: the ribbon and the close square in a fixed
 * header with the lights hanging over the content's top; two columns of section cards, each with its title inside it,
 * ending level (the last card of the shorter column stretches); one note at the foot. Identity is a small hero (the name
 * as a title over a night band), the numbers are coloured tiles, the longest word is spelled in letter blocks, the ranks
 * climb a staircase. Saving the name, the avatar, the numbers, the friend code and the ranks work as before.
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
  const title = useRef<HTMLHeadingElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const u = useUnit(card);
  // Focus goes to the title, not the close button, so no focus ring shows when the card opens (v2, F7).
  useEffect(() => { title.current?.focus({ preventScroll: true }); }, []);

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
          <h2 id="pf-title" ref={title} tabIndex={-1} className="pf-ribbon"><i className="pf-ribbon-face" aria-hidden="true" /><SheepHead px={3} /><span>Your profile</span></h2>
          <button type="button" className="pf-close hm-slab hm-knit" onClick={onClose} aria-label="Close" title="Close"><Pix rows={CROSS} colors={{ X: 'var(--hm-ink)' }} /></button>
          {FESTIVE && <Lights u={u} reduced={reduced} oneInSix />}
        </header>
        <div className="pf-body" onScroll={(e) => e.currentTarget.toggleAttribute('data-scrolled', e.currentTarget.scrollTop > 0)}>
          <div className="pf-col">
            <Identity avatar={avatar} onAvatar={() => setPicker(true)} lv={lv} xp={wallet.xp} signedIn={signedIn} onSignIn={() => setSignIn(true)}
              name={<NameEditor signedIn={signedIn} accountName={profile?.nickname ?? ''} localName={settings.name} setLocalName={(name) => setSettings({ name })} />} />
            <Section id="pf-numbers" className="pf-sec--numbers" tone="dusk" icon={<BarsArt />} title="Your numbers">
              <div className="pf-tiles">
                {stats.map((s) => (
                  <div key={s.id} className="pf-tile" data-stat={s.id}>
                    <IconTile tone={STAT_LOOK[s.id].tone} size={32}>{STAT_LOOK[s.id].icon()}</IconTile>
                    <span className="pf-tile-text">
                      {s.id === 'longest'
                        ? <LetterTiles word={s.value} room={12} />
                        : <b className="pf-tile-value">{s.value}</b>}
                      <span className="pf-tile-label">{s.label}</span>
                    </span>
                  </div>
                ))}
              </div>
            </Section>
            <PracticeBests sheet={getPracticeSheet()} />
          </div>
          <div className="pf-col">
            <ProfileRank />
            {friends && <FriendsSection account={account} guestName={settings.name} />}
            {account && typeof board === 'object' && board.top.length > 0 && <TopBoard board={board} />}
          </div>
          <footer className="pf-foot"><ShieldArt quiet /><span>Your numbers and friends are saved in this browser. Clearing its data resets them.</span></footer>
        </div>
      </div>
    </div>
    {/* Beside the page, not inside its scrim: a click that closed the picker used to carry on and close the profile too. */}
    {picker && <AvatarPicker onClose={() => setPicker(false)} />}
    {signIn && <AuthDialog onClose={() => setSignIn(false)} />}
    </>
  );
}

/** Where the night band's pines stand (% of the card's width) and how tall each is (v2, 5.1). */
const PINES: [number, 'tall' | 'mid' | 'small'][] = [[52, 'small'], [56, 'tall'], [60, 'mid'], [80, 'mid'], [84, 'tall'], [88, 'small']];
const STARS: [number, number][] = [[64, 18], [73, 30], [86, 12], [94, 34]];

/** Who you are, as a small hero: the avatar with its pencil, your name as a title, the level and its XP bar, over a night band. */
function Identity({ avatar, onAvatar, lv, xp, name, signedIn, onSignIn }: {
  avatar: string | null; onAvatar: () => void; lv: { level: number; into: number; need: number }; xp: number; name: ReactNode; signedIn: boolean; onSignIn: () => void;
}) {
  const share = lv.need > 0 ? lv.into / lv.need : 0;
  return (
    <section className="pf-card pf-id" aria-label="You">
      <span className="pf-night" aria-hidden="true">
        {STARS.map(([x, y]) => <i key={x} className="pf-star" style={{ left: `${x}%`, top: `${y}%` }} />)}
        {PINES.map(([x, size]) => <span key={x} className="pf-pine" style={{ left: `${x}%` }}><PineArt size={size} /></span>)}
      </span>
      <div className="pf-avatar">
        <span className="pf-avatar-tile">{avatar ? <AvatarIcon id={avatar} size={64} /> : <SheepHead px={6} />}</span>
        <button type="button" className="pf-pencil hm-slab" onClick={onAvatar} aria-label="Change avatar" title="Change avatar"><PencilArt /></button>
      </div>
      <div className="pf-id-main">
        {name}
        <div className="pf-level">
          <span className="pf-tag pf-tag--lantern">{`Lv ${lv.level}`}</span>
          <b className="pf-level-name">{titleFor(lv.level)}</b>
          <span className="pf-level-xp"><b>{xp.toLocaleString()}</b>{' XP · '}<b>{(lv.need - lv.into).toLocaleString()}</b>{` to Lv ${lv.level + 1}`}</span>
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
const TIMES = String.fromCharCode(0xD7);
const BOT: Record<Difficulty, { name: string }> = { easy: { name: 'Easy' }, medium: { name: 'Medium' }, hard: { name: 'Hard' } };
/** "×1.5": what a setting multiplies a run's rating by. */
const times = (w: number) => `${TIMES}${w}`;
/** "12 words · Hard · 10 s": a run, in the profile's short form. */
export function runLine(cell: { words: number; difficulty: Difficulty; clock: number }): string {
  return `${cell.words} word${cell.words === 1 ? '' : 's'} · ${BOT[cell.difficulty].name} · ${cell.clock} s`;
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
  return `${c.words} word${c.words === 1 ? '' : 's'} · ${BOT[c.difficulty].name} bot · ${c.clock} s clock: ${sum}${product === rating ? '' : `, rounded to ${rating.toLocaleString()}`}`;
}

/**
 * Practice (the profile plan v2, section 8): a summary strip on top (the best rating, its run, and the sum written out
 * as a small table, each caption under its own number), a groove, then every setting's best in a grid, each head on one
 * line with its multiplier, the played cells raised tiles and the best one lantern with the crown. Ratings come from
 * lib/practice.ts, unchanged.
 */
export function PracticeBests({ sheet }: { sheet: PracticeSheet }) {
  const { top } = sheet;
  const sum = top ? ratingSum(top) : null;
  return (
    <Section id="pf-practice" className="pf-sec--practice" tone="lantern" icon={<span className="pf-wool-icon"><StopwatchIcon /></span>} title="Practice">
      <div className="pf-drill-top">
        <b className="pf-rating-value" data-none={!top || undefined}>{top ? top.rating.toLocaleString() : '–'}</b>
        <span className="pf-rating-text">
          <span className="pf-label">Best rating</span>
          <span className="pf-rating-run">{top ? runLine(top) : 'Finish a practice run to get a rating.'}</span>
        </span>
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
      <i className="pf-groove" aria-hidden="true" />
      <div className="pf-grid" role="table" aria-label="Your best practice run at each bot and starting clock">
        <span role="row" className="pf-grid-row">
          <span role="columnheader" className="pf-grid-corner"><span className="sr-only">Bot</span></span>
          {sheet.rows[0].cells.map((c) => (
            <span role="columnheader" key={c.clock} className="pf-grid-col"><b>{`${c.clock} s`}</b><span className="pf-mult">{times(PRACTICE_WEIGHT.clock[c.clock] ?? 1)}</span></span>
          ))}
        </span>
        {sheet.rows.map((row) => (
          <span role="row" key={row.difficulty} className="pf-grid-row">
            <span role="rowheader" className="pf-grid-bot">
              <span className="pf-tree"><TreeIcon level={row.difficulty} /></span><b>{BOT[row.difficulty].name}</b><span className="pf-mult">{times(PRACTICE_WEIGHT.bot[row.difficulty])}</span>
            </span>
            {row.cells.map((c) => {
              const best = top !== null && c.clock === top.clock && c.difficulty === top.difficulty;
              return c.words ? (
                <span role="cell" key={c.clock} tabIndex={0} className="pf-cell" data-top={best || undefined} aria-label={`${cellTip(c)}${best ? '. Your best-rated run' : ''}`}>
                  {best && <span className="pf-crown"><PenIcon name="crown" color="var(--hm-ink)" /></span>}
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
    </Section>
  );
}

/** Signed in: the top players by XP, and where you stand among them. */
function TopBoard({ board }: { board: Board }) {
  return (
    <Section id="pf-board" className="pf-sec--board" tone="dusk" icon={<Icon name="level" color="var(--hm-wool)" />} title={`Top ${Math.min(BOARD_TOP, board.top.length)} by XP`}
      tools={board.you && <span className="pf-quiet">{board.you.place <= BOARD_TOP ? `You are ${standingLine(board.you, board.players)}` : `You are in the top ${topPercent(board.you.place, board.players)}%`}</span>}>
      <ol className="pf-board">
        {board.top.map((r) => (
          <li key={r.place} className="pf-board-row" data-you={r.you || undefined} aria-current={r.you ? 'true' : undefined}>
            <span className="pf-board-place">{r.place}</span>
            <span className="pf-board-name">{r.name}</span>
            <span className="pf-tag">{`Lv ${r.level}`}</span>
            <span className="pf-board-xp">{`${r.xp.toLocaleString()} XP`}</span>
          </li>
        ))}
      </ol>
    </Section>
  );
}

/**
 * The name: shown as a title with "Rename" beside it (v2, section 5); Rename or a click on the name swaps in the text field
 * holding it, selected, with Save and Cancel. Enter saves, Escape cancels. The save is today's: a guest's name in this
 * browser, a signed-in player's account nickname. After a save the name shows again, with "Saved" for 2 s.
 */
function NameEditor({ signedIn, accountName, localName, setLocalName }: { signedIn: boolean; accountName: string; localName: string; setLocalName: (n: string) => void }) {
  const current = signedIn ? accountName : localName;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(current);
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const renameBtn = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (!editing) setDraft(current); }, [current, editing]);
  useEffect(() => { if (!saved) return; const t = setTimeout(() => setSaved(false), 2000); return () => clearTimeout(t); }, [saved]);
  useEffect(() => { if (editing) { input.current?.focus(); input.current?.select(); } }, [editing]);

  const stop = (focusBack = true) => { setEditing(false); setDraft(current); if (focusBack) setTimeout(() => renameBtn.current?.focus(), 0); };
  const save = async () => {
    const nick = checkNickname(draft);
    if (!nick.ok) return setMsg({ text: nick.message, bad: true });
    if (nick.name === current) { setMsg(null); return stop(); }
    if (!signedIn) {
      setLocalName(nick.name);
      setMsg(null); setSaved(true); setEditing(false);
      return;
    }
    setBusy(true);
    try {
      await useAuth.getState().rename(nick.name);
      setMsg({ text: 'Rooms you join from now on show the new name.' });
      setSaved(true); setEditing(false);
    } catch (e) {
      setMsg({ text: RENAME_ERR[e instanceof ApiError ? e.code : ''] ?? 'Your name could not be saved. Try again in a moment.', bad: true });
    } finally {
      setBusy(false);
    }
  };
  const changed = draft.trim() !== current;
  if (!editing) {
    return (
      <div className="pf-name">
        <span className="pf-name-row">
          <button type="button" className="pf-name-show" onClick={() => setEditing(true)} title="Rename">{current || 'Your name'}</button>
          {saved
            ? <span className="pf-saved" role="status"><Pix rows={PEN_ART.check} colors={{ X: 'currentColor' }} />Saved</span>
            : <button ref={renameBtn} type="button" className="pf-slab pf-slab--24 hm-slab hm-knit" onClick={() => setEditing(true)}>Rename</button>}
        </span>
        {msg && !msg.bad && <span role="status" className="pf-msg">{msg.text}</span>}
      </div>
    );
  }
  return (
    <form className="pf-name" onSubmit={(e) => { e.preventDefault(); void save(); }}>
      <label className="sr-only" htmlFor="prof-name">{signedIn ? 'Your username' : 'Your name'}</label>
      <span className="pf-name-row">
        <input
          id="prof-name" ref={input} className="pf-input pf-input--name" value={draft} placeholder="Your name"
          maxLength={MAX_NICKNAME} autoComplete="off" spellCheck={false}
          onChange={(e) => { setDraft(e.target.value.slice(0, MAX_NICKNAME)); setMsg(null); }}
          onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setMsg(null); stop(); } }}
        />
        <button type="submit" className={`pf-slab pf-slab--40 hm-slab hm-knit ${changed ? 'hm-slab--lantern' : ''}`} disabled={busy || !changed}>{busy ? 'Saving…' : 'Save'}</button>
        <button type="button" className="pf-slab pf-slab--40 hm-slab hm-knit" onClick={() => { setMsg(null); stop(); }}>Cancel</button>
      </span>
      {msg && <span role={msg.bad ? 'alert' : 'status'} className="pf-msg" data-bad={msg.bad || undefined}>{msg.text}</span>}
    </form>
  );
}
