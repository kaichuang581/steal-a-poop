import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { api, ApiError, useAuth } from '../../auth/authStore';
import { authEnabled } from '../../auth/config';
import { getDreamBest, getDreamStreak, loadStreak } from '../../dream/daily';
import { checkNickname, MAX_NICKNAME } from '../../lib/nickname';
import { getPracticeBestOverall } from '../../lib/practice';
import { getRecord } from '../../lib/record';
import { useStore } from '../../state/store';
import type { Stats } from '../../state/socialStore';
import { AuthDialog } from '../../ui/auth/AuthDialog';
import { AvatarIcon } from '../avatars/AvatarIcon';
import { AvatarPicker } from '../avatars/AvatarPicker';
import { useAvatar } from '../avatars/store';
import { SheepIcon } from '../components/SheepIcon';
import { usePageHistory } from '../hooks/usePageHistory';
import { useToday } from '../hooks/useToday';
import { Knit } from '../kit';
import { Chip, ClothButton, WoodButton } from '../components/Materials';
import { CloseIcon } from '../components/Icons';
import { SnowCap } from '../components/SnowCap';
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

/**
 * The profile: a page of its own over Home, like the Trading Post. Who you are (name, avatar, level, account), where you
 * stand among signed-in players, and your numbers from this device (and, signed in, from online rooms). Changing your
 * name happens here: a guest's name is kept in this browser; a signed-in player's is the account's nickname.
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

  // Online numbers and the board need the game server and a signed-in player. Read once, when the page opens.
  const [board, setBoard] = useState<Board | 'loading' | 'error'>('loading');
  const [onlineStats, setOnlineStats] = useState<Stats | null>(null);
  useEffect(() => {
    if (!account) return;
    let live = true;
    const token = useAuth.getState().session?.access_token ?? null;
    api<Board>('GET', '/api/barn/top', token).then((b) => live && setBoard(b), () => live && setBoard('error'));
    api<Stats>('GET', '/api/me/stats', token).then((s) => live && setOnlineStats(s), () => undefined);
    return () => { live = false; };
  }, [account]);

  const stats: { label: string; value: ReactNode; note?: string; long?: boolean }[] = [
    { label: 'Different words', value: wallet.words.length.toLocaleString(), note: 'played at the table' },
    { label: 'Wins', value: record.wins.toLocaleString(), note: 'Quick Games won' },
    { label: 'Longest word', long: record.bests.longest.length > 6, value: record.bests.longest ? record.bests.longest.toUpperCase() : '–', note: record.bests.longest ? `${record.bests.longest.length} letters` : 'play a game' },
    { label: 'Practice best', value: getPracticeBestOverall().toLocaleString(), note: 'words in one run' },
    { label: 'Counting Sheep best', value: getDreamBest().toLocaleString(), note: 'sheep in one night' },
    { label: 'Night streak', value: streak.toLocaleString(), note: `best ${bestStreak}` },
    ...(onlineStats ? [
      { label: 'Online wins', value: onlineStats.wins.toLocaleString(), note: `of ${onlineStats.gamesPlayed.toLocaleString()} room game${onlineStats.gamesPlayed === 1 ? '' : 's'}` },
    ] : []),
  ];

  return (
    <>
    <div className="sk-post-scrim" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Your profile" className="sk-guide sk-post sk-prof" onClick={(e) => e.stopPropagation()}>
        <div className="sk-guide-head">
          <SnowCap className="sk-guide-snow" />
          <h2>Your profile</h2>
          <Chip className="sk-icon-chip" onClick={onClose} aria-label="Close"><CloseIcon size={16} /></Chip>
        </div>
        <div className="sk-guide-body">
          <div className="sk-prof-top">
            <div className="sk-prof-card">
              <div className="sk-prof-who">
                <button type="button" className="sk-prof-avatar kit-peg kit-peg--light" onClick={() => setPicker(true)} aria-label="Change avatar" title="Change avatar">
                  {avatar ? <AvatarIcon id={avatar} size={56} /> : <SheepIcon size={56} />}
                </button>
                <div className="sk-prof-id">
                  <NameEditor signedIn={signedIn} accountName={profile?.nickname ?? ''} localName={settings.name} setLocalName={(name) => setSettings({ name })} />
                  <p className="sk-post-sub"><b className="sk-post-h">Level {lv.level}</b> {titleFor(lv.level)}</p>
                </div>
              </div>
              <Knit segments={10} filled={Math.floor((lv.into / lv.need) * 10)} />
              <p className="sk-post-sub">{lv.need - lv.into} XP to level {lv.level + 1} · {wallet.xp.toLocaleString()} XP in all</p>
              <div className="sk-post-row">
                <ClothButton className="sk-post-btn" onClick={() => setPicker(true)}>Change avatar</ClothButton>
                {authEnabled() && !signedIn && <WoodButton className="sk-post-btn" onClick={() => setSignIn(true)}>Sign in</WoodButton>}
                {signedIn && <Chip onClick={() => setSignIn(true)}>Account</Chip>}
              </div>
            </div>
            <div className="sk-prof-card sk-prof-rank" aria-live="polite">
              <p className="sk-post-sub">Your standing</p>
              <RankBox signedIn={signedIn} account={account} board={board} onSignIn={() => setSignIn(true)} />
            </div>
          </div>
          <h3 className="sk-post-h sk-post-sect" id="prof-stats">Your numbers</h3>
          <p className="sk-post-sub">{account ? 'Words, level and XP follow your account. Games and bests are from this device.' : 'Kept in this browser.'}</p>
          <div className="sk-prof-grid" aria-labelledby="prof-stats">
            {stats.map((s) => (
              <article key={s.label} className="sk-prof-stat" data-wide={(s.long !== undefined && stats.length % 2 === 1) || undefined}>
                <span className="sk-prof-stat-label">{s.label}</span>
                <span className="sk-prof-stat-value" data-long={s.long || undefined} style={s.long ? ({ '--n': String(s.value).length } as CSSProperties) : undefined}>{s.value}</span>
                {s.note && <span className="sk-prof-stat-note">{s.note}</span>}
              </article>
            ))}
          </div>
          {account && typeof board === 'object' && board.top.length > 0 && <TopBoard board={board} />}
        </div>
      </div>
    </div>
    {/* Beside the page, not inside its scrim: a click that closed the picker used to carry on and close the profile too. */}
    {picker && <AvatarPicker onClose={() => setPicker(false)} />}
    {signIn && <AuthDialog onClose={() => setSignIn(false)} />}
    </>
  );
}

/** The top 100 players by XP: place, name, level, XP. Your own line is marked. */
function TopBoard({ board }: { board: Board }) {
  return (
    <section className="sk-prof-board" aria-labelledby="prof-board">
      <h3 className="sk-post-h sk-post-sect" id="prof-board">Top {Math.min(BOARD_TOP, board.top.length)} players</h3>
      <p className="sk-post-sub">By XP, among {board.players.toLocaleString()} signed-in player{board.players === 1 ? '' : 's'}.</p>
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
    </section>
  );
}

function RankBox({ signedIn, account, board, onSignIn }: { signedIn: boolean; account: boolean; board: Board | 'loading' | 'error'; onSignIn: () => void }) {
  if (!signedIn || !account) {
    return (
      <>
        <p className="sk-prof-rank-big">Unranked</p>
        <p className="sk-post-sub">{authEnabled() ? 'Sign in to be ranked against everyone else by XP.' : 'Ranks need the game server, which is not set up here.'}</p>
        {authEnabled() && !signedIn && <WoodButton className="sk-post-btn" onClick={onSignIn}>Sign in</WoodButton>}
      </>
    );
  }
  if (board === 'loading') return <p className="sk-prof-rank-big">...</p>;
  if (board === 'error') return <><p className="sk-prof-rank-big">Unranked</p><p className="sk-post-sub">The barn could not be reached. Try again in a moment.</p></>;
  if (!board.you) return <><p className="sk-prof-rank-big">Unranked</p><p className="sk-post-sub">Finish a game to get your first XP and a place.</p></>;
  // On the board: your place. Below it: the share of players you are in, however small.
  const listed = board.you.place <= BOARD_TOP;
  return (
    <>
      <p className="sk-prof-rank-big">{standingLine(board.you, board.players)}</p>
      <p className="sk-post-sub">
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
      <label className="sk-post-sub" htmlFor="prof-name">{signedIn ? 'Your username' : 'Your name'}</label>
      <span className="sk-prof-name-row">
        <input
          id="prof-name" ref={input} className="sk-prof-name-input" value={draft} placeholder="Your name"
          maxLength={MAX_NICKNAME} autoComplete="off" spellCheck={false}
          onChange={(e) => { setDraft(e.target.value.slice(0, MAX_NICKNAME)); setMsg(null); }}
          onKeyDown={(e) => { if (e.key === 'Escape' && changed) { e.preventDefault(); e.stopPropagation(); setDraft(current); } }}
        />
        <ClothButton type="submit" className="sk-post-btn" disabled={busy || !changed}>{busy ? 'Saving...' : 'Save'}</ClothButton>
      </span>
      {msg && <span role={msg.bad ? 'alert' : 'status'} className="sk-prof-msg" data-bad={msg.bad || undefined}>{msg.text}</span>}
    </form>
  );
}
