import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { api, ApiError, useAuth } from '../../auth/authStore';
import { apiBase, authEnabled } from '../../auth/config';
import { getDreamBest, getDreamStreak, loadStreak } from '../../dream/daily';
import type { Difficulty } from '../../engine';
import { checkNickname, MAX_NICKNAME } from '../../lib/nickname';
import { getPracticeSheet, PRACTICE_WEIGHT } from '../../lib/practice';
import type { PracticeSheet } from '../../lib/practice';
import { getRecord } from '../../lib/record';
import { useStore } from '../../state/store';
import type { Stats } from '../../state/socialStore';
import { AuthDialog } from '../../ui/auth/AuthDialog';
import { AvatarIcon } from '../avatars/AvatarIcon';
import { AvatarPicker } from '../avatars/AvatarPicker';
import { useAvatar } from '../avatars/store';
import { AcornIcon, CloseIcon, LeafIcon, SeedlingIcon } from '../components/Icons';
import { SheepIcon } from '../components/SheepIcon';
import { usePageHistory } from '../hooks/usePageHistory';
import { useToday } from '../hooks/useToday';
import { Board as Sign, Knit, Paper, Patch, Peg, Slate } from '../kit';
import { ProfileRank } from '../ranked/ProfileRank';
import { FriendsSection } from './FriendsSection';
import { levelOf, titleFor } from '../shop/economy';
import { online, useWallet } from '../shop/store';

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

/** A number on the profile: what it is, the number, and a line under it. `long` is a word that may need smaller letters. */
interface Stat { label: string; value: ReactNode; note: string; long?: boolean; none?: boolean }

/**
 * The profile: a page of its own over Home, in the same room as the Trading Post (a plank wall, a hung sign, paper,
 * slate). Who you are, on a card (name, avatar, level, account); where you stand among signed-in
 * players, chalked on a slate; your numbers from this device (and, signed in, from online rooms), six slips of paper;
 * your practice bests set out by bot and starting clock; and, signed in, the top 100. Changing your name happens here: a
 * guest's name is kept in this browser; a signed-in player's is the account's nickname.
 */
export function Profile({ onClose }: { onClose: () => void }) {
  const [picker, setPicker] = useState(false);
  const [signIn, setSignIn] = useState(false);
  usePageHistory('profile', onClose, () => picker || signIn);

  const wallet = useWallet();
  const avatar = useAvatar();
  const today = useToday();
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

  const longest = record.bests.longest;
  // Room wins are kept on the account: without one the slip is there, and says how to fill it.
  const rooms: Stat = !account
    ? { label: 'Online wins', value: '–', none: true, note: authEnabled() ? 'sign in to count room games' : 'needs the game server' }
    : typeof onlineStats === 'object'
      ? { label: 'Online wins', value: onlineStats.wins.toLocaleString(), note: `of ${onlineStats.gamesPlayed.toLocaleString()} room game${onlineStats.gamesPlayed === 1 ? '' : 's'}` }
      : { label: 'Online wins', value: onlineStats === 'loading' ? '...' : '–', none: true, note: onlineStats === 'loading' ? 'asking the barn' : 'the barn could not be reached' };
  // Always six, so the slips fill their rows: three across on a desktop, two on a phone.
  const stats: Stat[] = [
    { label: 'Different words', value: wallet.words.length.toLocaleString(), note: 'played at the table' },
    { label: 'Wins', value: record.wins.toLocaleString(), note: 'Quick Games won' },
    { label: 'Longest word', long: longest.length > 6, value: longest ? longest.toUpperCase() : '–', none: !longest, note: longest ? `${longest.length} letters` : 'play a game' },
    { label: 'Counting Sheep best', value: getDreamBest().toLocaleString(), note: 'sheep in one night' },
    { label: 'Night streak', value: streak.toLocaleString(), note: `nights in a row · best ${bestStreak}` },
    rooms,
  ];

  return (
    <>
    <div className="sk-post-scrim" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Your profile" className="sk-room kit-wall sk-prof" onClick={(e) => e.stopPropagation()}>
        <div className="sk-room-beam" aria-hidden="true" />
        <span className="sk-room-lights" aria-hidden="true">{Array.from({ length: 22 }, (_, i) => <i key={i} style={{ '--i': i } as CSSProperties} />)}</span>
        <div className="sk-room-top">
          <Sign size="heading" tone="wood" hang="ropes" snow className="sk-room-sign"><h2>Your profile</h2></Sign>
          <Peg ref={close} small light className="sk-room-close" onClick={onClose} aria-label="Close"><CloseIcon size={18} /></Peg>
        </div>
        <div className="sk-room-bodywrap">
          <div className="sk-room-body">
            <div className="sk-room-content sk-prof-content">
              <div className="sk-prof-top">
                {/* The card: who you are. */}
                <Paper kind="note" className="sk-prof-card">
                  <div className="sk-prof-who">
                    <button type="button" className="sk-prof-avatar kit-peg kit-peg--light" onClick={() => setPicker(true)} aria-label="Change avatar" title="Change avatar">
                      {avatar ? <AvatarIcon id={avatar} size={60} /> : <SheepIcon size={60} />}
                    </button>
                    <div className="sk-prof-id">
                      <NameEditor signedIn={signedIn} accountName={profile?.nickname ?? ''} localName={settings.name} setLocalName={(name) => setSettings({ name })} />
                    </div>
                  </div>
                  <div className="sk-prof-level">
                    <span className="kit-plank kit-plank--light sk-level-badge">Level {lv.level} · {titleFor(lv.level)}</span>
                    <span className="sk-prof-xp">{(lv.need - lv.into).toLocaleString()} XP to level {lv.level + 1}</span>
                  </div>
                  <span role="img" aria-label={`${lv.into} of ${lv.need} XP into level ${lv.level}`} className="sk-prof-band"><Knit segments={10} filled={Math.floor((lv.into / lv.need) * 10)} /></span>
                  <div className="sk-prof-acts">
                    <span className="sk-prof-xp">{wallet.xp.toLocaleString()} XP in all</span>
                    <Patch as="button" onClick={() => setPicker(true)}>Change avatar</Patch>
                    {authEnabled() && !signedIn && <Patch as="button" tone="green" onClick={() => setSignIn(true)}>Sign in</Patch>}
                    {signedIn && <Patch as="button" onClick={() => setSignIn(true)}>Account</Patch>}
                  </div>
                </Paper>
                {/* The slate: where you stand. */}
                <Slate size="board" className="sk-prof-rank" aria-live="polite">
                  <p className="kit-chalk-hand sk-prof-rank-label">Your standing</p>
                  <RankBox signedIn={signedIn} account={account} board={board} onSignIn={() => setSignIn(true)} />
                </Slate>
              </div>

              <section aria-labelledby="prof-stats">
                <div className="sk-prof-head">
                  <Sign size="label" tone="wood" className="sk-room-heading"><h3 id="prof-stats">Your numbers</h3></Sign>
                  <p className="sk-room-hint">{account ? 'Words, level and XP follow your account. Games and bests are from this device.' : 'Kept in this browser.'}</p>
                </div>
                <div className="sk-prof-grid">
                  {stats.map((s) => (
                    <Paper key={s.label} kind="note" className="sk-prof-stat">
                      <span className="sk-prof-stat-label">{s.label}</span>
                      <span className="sk-prof-stat-value" data-long={s.long || undefined} data-none={s.none || undefined} style={s.long ? ({ '--n': String(s.value).length } as CSSProperties) : undefined}>{s.value}</span>
                      <span className="sk-prof-stat-note">{s.note}</span>
                    </Paper>
                  ))}
                </div>
              </section>

              {/* The friend code is here, on the profile, not on a tab of its own. Needs the game server to swap requests. */}
              {apiBase() && (!authEnabled() || authStatus !== 'loading') && <FriendsSection account={account} guestName={settings.name} />}

              <ProfileRank />

              <PracticeBests sheet={getPracticeSheet()} />
              {account && typeof board === 'object' && board.top.length > 0 && <TopBoard board={board} />}
            </div>
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

const BOT: Record<Difficulty, { name: string; icon: ReactNode }> = {
  easy: { name: 'Easy', icon: <SeedlingIcon size={18} /> },
  medium: { name: 'Medium', icon: <LeafIcon size={18} /> },
  hard: { name: 'Hard', icon: <AcornIcon size={18} /> },
};
/** "x1.5", "x2": how much a setting multiplies a run's rating. Nothing for x1. */
const times = (w: number) => (w === 1 ? '' : `×${w}`);
/** "12 words against the hard bot, from a 10 s clock". */
export function runLine(cell: { words: number; difficulty: Difficulty; clock: number }): string {
  return `${cell.words} word${cell.words === 1 ? '' : 's'} · ${BOT[cell.difficulty].name} bot · ${cell.clock} s clock`;
}

/**
 * Practice, by how hard it was set (Brian, 2026-11-13: "practice best could mean easy mode, medium, or hard mode, so its
 * less rewarding to those who do well in hard mode. take in account the time as well"). One "practice best" was the most
 * words at any setting, so 31 easy words hid 12 hard ones. Now every setting has its own best, chalked on a slate: a row
 * a bot, a column a starting clock. Each best is rated (lib/practice.ts: words, times more for a harder bot and for a
 * shorter clock), and the best-rated run of them all is the practice rating on the card beside it, ringed on the slate.
 */
export function PracticeBests({ sheet }: { sheet: PracticeSheet }) {
  const { top } = sheet;
  return (
    <section aria-labelledby="prof-drill">
      <div className="sk-prof-head">
        <Sign size="label" tone="wood" className="sk-room-heading"><h3 id="prof-drill">Practice bests</h3></Sign>
        <p className="sk-room-hint">Most words in one run, for each bot and starting clock. A harder bot or a shorter clock counts for more.</p>
      </div>
      <div className="sk-prof-drill">
        <Paper kind="note" className="sk-prof-rating">
          <span className="sk-prof-stat-label">Practice rating</span>
          <span className="sk-prof-rating-value" data-none={!top || undefined}>{top ? top.rating.toLocaleString() : '–'}</span>
          <span className="sk-prof-rating-run">{top ? runLine(top) : 'No practice runs yet.'}</span>
          <span className="sk-prof-stat-note">Your best-rated run. A run is rated by its words, times 1.5 for the medium bot or a 10 s clock, times 2 for the hard bot or a 5 s clock.</span>
        </Paper>
        <Slate size="board" className="sk-prof-sheet">
          <table>
            <caption className="sr-only">Your best practice run at each bot and starting clock: the words, and what the run is rated.</caption>
            <thead>
              <tr>
                <th scope="col"><span className="sr-only">Bot</span></th>
                {sheet.rows[0].cells.map((c) => <th key={c.clock} scope="col">{c.clock} s<i>{times(PRACTICE_WEIGHT.clock[c.clock] ?? 1)}</i></th>)}
              </tr>
            </thead>
            <tbody>
              {sheet.rows.map((row) => (
                <tr key={row.difficulty}>
                  <th scope="row"><span className="sk-prof-bot">{BOT[row.difficulty].icon}<span>{BOT[row.difficulty].name}<i>{times(PRACTICE_WEIGHT.bot[row.difficulty])}</i></span></span></th>
                  {row.cells.map((c) => {
                    const best = top !== null && c.clock === top.clock && c.difficulty === top.difficulty;
                    return (
                      <td key={c.clock} data-none={c.words === 0 || undefined} data-top={best || undefined} aria-label={c.words ? `${runLine(c)}: rated ${c.rating}${best ? ', your best-rated run' : ''}` : `${BOT[c.difficulty].name} bot, ${c.clock} s clock: not played`}>
                        {c.words ? <span className={best ? 'kit-chalk-ring' : undefined}><b>{c.words}</b><small>rated {c.rating}</small></span> : <b>–</b>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </Slate>
      </div>
    </section>
  );
}

/** The top 100 players by XP, on a ruled sheet: place, name, level, XP. Your own line is marked. */
function TopBoard({ board }: { board: Board }) {
  return (
    <section className="sk-prof-board" aria-labelledby="prof-board">
      <div className="sk-prof-head">
        <Sign size="label" tone="wood" className="sk-room-heading"><h3 id="prof-board">Top {Math.min(BOARD_TOP, board.top.length)} players</h3></Sign>
        <p className="sk-room-hint">By XP, among {board.players.toLocaleString()} signed-in player{board.players === 1 ? '' : 's'}.</p>
      </div>
      <Paper kind="note" className="sk-prof-board-sheet">
        <ol className="sk-prof-board-list">
          {board.top.map((r) => (
            <li key={r.place} className="sk-prof-board-row" data-you={r.you || undefined} aria-current={r.you ? 'true' : undefined}>
              <span className="sk-prof-board-place">{r.place}</span>
              <span className="sk-prof-board-name">{r.name}{r.you && <span className="kit-tag kit-tag--green">You</span>}</span>
              <span className="sk-prof-board-level">Level {r.level}</span>
              <span className="sk-prof-board-xp">{r.xp.toLocaleString()} XP</span>
            </li>
          ))}
        </ol>
      </Paper>
    </section>
  );
}

function RankBox({ signedIn, account, board, onSignIn }: { signedIn: boolean; account: boolean; board: Board | 'loading' | 'error'; onSignIn: () => void }) {
  if (!signedIn || !account) {
    return (
      <>
        <p className="sk-prof-rank-big" data-none>Unranked</p>
        <p className="kit-chalk-hand">{authEnabled() ? 'Sign in to be ranked against everyone else by XP.' : 'Ranks need the game server, which is not set up here.'}</p>
        {authEnabled() && !signedIn && <Patch as="button" tone="green" onClick={onSignIn}>Sign in</Patch>}
      </>
    );
  }
  if (board === 'loading') return <p className="sk-prof-rank-big" data-none>...</p>;
  if (board === 'error') return <><p className="sk-prof-rank-big" data-none>Unranked</p><p className="kit-chalk-hand">The barn could not be reached. Try again in a moment.</p></>;
  if (!board.you) return <><p className="sk-prof-rank-big" data-none>Unranked</p><p className="kit-chalk-hand">Finish a game to get your first XP and a place.</p></>;
  // On the board: your place. Below it: the share of players you are in, however small.
  const listed = board.you.place <= BOARD_TOP;
  return (
    <>
      <p className="sk-prof-rank-big">{standingLine(board.you, board.players)}</p>
      <p className="kit-chalk-hand">
        {listed ? `of ${board.players.toLocaleString()} player${board.players === 1 ? '' : 's'}, by XP` : `You are in the top ${topPercent(board.you.place, board.players)}% of ${board.players.toLocaleString()} players, by XP`}
      </p>
    </>
  );
}

/** The name, edited in place. Guests change the name kept in this browser; signed-in players change their account nickname. */
function NameEditor({ signedIn, accountName, localName, setLocalName }: { signedIn: boolean; accountName: string; localName: string; setLocalName: (n: string) => void }) {
  const current = signedIn ? accountName : localName;
  const [draft, setDraft] = useState(current);
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => setDraft(current), [current]);

  const save = async () => {
    const nick = checkNickname(draft);
    if (!nick.ok) return setMsg({ text: nick.message, bad: true });
    if (nick.name === current) return setMsg(null);
    if (!signedIn) {
      setLocalName(nick.name);
      return setMsg({ text: nick.name ? 'Saved.' : 'Name cleared.' });
    }
    setBusy(true);
    try {
      await useAuth.getState().rename(nick.name);
      setMsg({ text: 'Saved. Rooms you join from now on show the new name.' });
    } catch (e) {
      setMsg({ text: RENAME_ERR[e instanceof ApiError ? e.code : ''] ?? 'Cannot reach the game server. Try again in a moment.', bad: true });
    } finally {
      setBusy(false);
    }
  };
  const changed = draft.trim() !== current;
  return (
    <form className="sk-prof-name" onSubmit={(e) => { e.preventDefault(); void save(); }}>
      <label className="sk-prof-stat-label" htmlFor="prof-name">{signedIn ? 'Your username' : 'Your name'}</label>
      <span className="sk-prof-name-row">
        <input
          id="prof-name" ref={input} className="sk-prof-name-input" value={draft} placeholder="Your name"
          maxLength={MAX_NICKNAME} autoComplete="off" spellCheck={false}
          onChange={(e) => { setDraft(e.target.value.slice(0, MAX_NICKNAME)); setMsg(null); }}
          onKeyDown={(e) => { if (e.key === 'Escape' && changed) { e.preventDefault(); e.stopPropagation(); setDraft(current); } }}
        />
        <Patch as="button" type="submit" tone="green" disabled={busy || !changed}>{busy ? 'Saving...' : 'Save'}</Patch>
      </span>
      {msg && <span role={msg.bad ? 'alert' : 'status'} className="sk-prof-msg" data-bad={msg.bad || undefined}>{msg.text}</span>}
    </form>
  );
}
