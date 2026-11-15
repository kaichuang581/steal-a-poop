import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { ApiError, api, useAuth } from '../../auth/authStore';
import { authEnabled } from '../../auth/config';
import { rankOf } from '../../lib/ranked';
import { useSocial } from '../../state/socialStore';
import { AvatarIcon } from '../avatars/AvatarIcon';
import { useAvatar } from '../avatars/store';
import { Garland } from '../components/Garland';
import { ArrowUpIcon, CloseIcon, TrophyIcon } from '../components/Icons';
import { usePageHistory } from '../hooks/usePageHistory';
import { Peg, Slate, Switch, Tag } from '../kit';
import { standingLine } from '../profile/Profile';
import type { Board as LevelBoard } from '../profile/Profile';
import { RankBadge, TierBadge } from '../ranked/RankBadge';
import { apiToken } from '../ranked/rankedStore';
import { levelOf } from '../shop/economy';
import { useWallet } from '../shop/store';
import '../rooms/rooms.css';
import '../ranked/ranked.css';
import './boards.css';

/** The stage is three.js: it comes after the page, which is up and readable before it. */
const BoardStage = lazy(() => import('./BoardStage'));

export type BoardTab = 'ranked' | 'wins' | 'level';
export type Period = 'day' | 'week' | 'all';

/** One line of a board, whichever board it is: a place, a name, the score in big letters and a small note beside it. */
export interface Line { place: number; name: string; score: string; note: string; rating?: number; you: boolean }
/** A board as the page shows it. `standing` is where the asker is ("#12 of 240"), or null when they have no place. */
export interface Sheet { lines: Line[]; standing: string | null }

interface RankedBoard { top: Array<{ place: number; name: string; rating: number; games: number; wins: number; you: boolean }>; you: { place: number; of: number } | null }
interface WinsBoard { rows: Array<{ rank: number; name: string; value: number; games: number }> }
interface Stats { gamesPlayed: number; wins: number }

const many = (n: number, one: string) => `${n.toLocaleString()} ${one}${n === 1 ? '' : 's'}`;

/** The ranked ladder (GET /api/ranked/top, or /api/ranked/board without a login): rating, and the rank it earns. */
export function rankedSheet(b: RankedBoard): Sheet {
  return {
    lines: b.top.map((r) => ({ place: r.place, name: r.name, score: r.rating.toLocaleString(), note: rankOf(r.rating).label, rating: r.rating, you: r.you })),
    standing: b.you ? `#${b.you.place.toLocaleString()} of ${b.you.of.toLocaleString()}` : null,
  };
}
/** The level board (GET /api/barn/top, or /api/barn/board without a login): the level, and the XP behind it. */
export function levelSheet(b: LevelBoard): Sheet {
  return {
    lines: b.top.map((r) => ({ place: r.place, name: r.name, score: `Level ${r.level}`, note: `${r.xp.toLocaleString()} XP`, you: r.you })),
    standing: b.you ? standingLine(b.you, b.players) : null,
  };
}
/** Online wins (GET /api/leaderboard/:period, public). It carries no ids, so "you" is the row with your own name. */
export function winsSheet(b: WinsBoard, me: string | null): Sheet {
  const lines = b.rows.map((r) => ({ place: r.rank, name: r.name, score: r.value.toLocaleString(), note: `in ${many(r.games, 'game')}`, you: me !== null && r.name === me }));
  const mine = lines.find((l) => l.you);
  return { lines, standing: mine ? `#${mine.place}` : null };
}

/** A board read less than this long ago is shown again without asking (the server keeps its own copy as long). */
const FRESH_MS = 30_000;
const kept = new Map<string, { at: number; sheet: Sheet }>();

/**
 * Reads one board. Signed in, the ranked and level boards come with your own place; signed out (or with a login the
 * server will not place, such as an account still waiting for a parent), the same lists come from their public
 * addresses, with nobody marked.
 */
async function read(tab: BoardTab, period: Period, me: string | null): Promise<Sheet> {
  if (tab === 'wins') return winsSheet(await api<WinsBoard>('GET', `/api/leaderboard/${period}?metric=wins`, null), me);
  const [mine, open] = tab === 'ranked' ? ['/api/ranked/top', '/api/ranked/board'] : ['/api/barn/top', '/api/barn/board'];
  const token = await apiToken();
  const raw = await (token ? api<unknown>('GET', mine, token).catch(() => api<unknown>('GET', open, null)) : api<unknown>('GET', open, null));
  return tab === 'ranked' ? rankedSheet(raw as RankedBoard) : levelSheet(raw as LevelBoard);
}

/** `cols` heads the list's last two columns; `unit` says what the big figure counts. */
const TABS: { id: BoardTab; label: string; title: string; hint: string; first: string; cols: [string, string]; unit: string }[] = [
  { id: 'ranked', label: 'Ranked', title: 'Ranked ladder', hint: 'by ranked points', first: 'Win a ranked game to be first.', cols: ['Rank', 'Points'], unit: 'points' },
  { id: 'wins', label: 'Wins', title: 'Most wins', hint: 'online games won', first: 'Win an online game to be first.', cols: ['Games', 'Wins'], unit: 'wins' },
  { id: 'level', label: 'Level', title: 'Highest level', hint: 'by XP from games', first: 'Finish a game to be first.', cols: ['Level', 'XP'], unit: 'XP' },
];
// No Today (Brian, 2026-11-14: "remove the today option from the leaderboards"): the server still answers /day.
const PERIODS: [Period, string][] = [['week', 'This week'], ['all', 'All time']];
const MEDAL = [['gold', '1st'], ['gray', '2nd'], ['flame', '3rd']] as const;
/** With fewer lines than this, the rest of the wool says the places after them are open (it has room on any screen). */
const ROOM = 20;
const nth = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;

const digits = (s: string) => Number(s.replace(/\D/g, '')) || 0;
/**
 * What a line shows on a board: its big figure, the small one beside it, and the figure as a number (to say how far
 * apart two players are). Level leads with the XP and Wins with the wins; the sheets themselves are left as they are.
 */
/** A line's figure said in full, with its unit, and the small fact beside it: on the pedestals and on your own plate. */
function said(tab: BoardTab, l: Line): { big: string; small: string } {
  if (tab === 'ranked') return { big: l.score, small: l.note };
  if (tab === 'wins') return { big: `${l.score} ${l.score === '1' ? 'win' : 'wins'}`, small: l.note };
  return { big: l.note, small: l.score };
}
function view(tab: BoardTab, l: Line): { fig: string; sub: ReactNode; n: number } {
  if (tab === 'ranked') return { fig: l.score, sub: <><RankBadge rating={l.rating ?? 0} size={20} /><span className="sk-lb-rank">{l.note}</span></>, n: l.rating ?? digits(l.score) };
  if (tab === 'wins') return { fig: l.score, sub: <span className="sk-lb-small">{many(digits(l.note), 'game')}</span>, n: digits(l.score) };
  return { fig: l.note.replace(' XP', ''), sub: <span className="sk-lb-small">{l.score}</span>, n: digits(l.note) };
}

/**
 * The leaderboards (Brian, 2026-11-14, in three rounds: "refine the leaderboards"; "more glorified and unique ... 'wow
 * i wanna be up there someday, those guys are so cool'"; then "dont make the scenery for this one a barn, maybe place
 * them up on pedastals on the sky with nonchalant poses ... formatting issues is empty space, generic white cardboard
 * looking like pieces, etc, find them all and redo"). A place, as the lobby is: the sky is the whole screen
 * (BoardStage.tsx), a strapped beam across the top carries the three boards' tabs, the page's name and the way out,
 * and one plank board with dark stitched wool stands on the right from the beam to the foot. The first three lounge
 * on their pedestals with their names hung under them; the list runs on from fourth (from first on a narrow screen),
 * and your own standing is pinned at the board's foot. No paper anywhere, and no box changes size or place when a
 * tab is pressed.
 */
export function Leaderboards({ onClose }: { onClose: () => void }) {
  usePageHistory('boards', onClose);
  const [tab, setTab] = useState<BoardTab>('ranked');
  const [period, setPeriod] = useState<Period>('week');
  const [sheet, setSheet] = useState<Sheet | 'loading' | 'off' | 'error'>('loading');
  // The last board that came in, and which board it was: it stays up (dimmed) while the next one is asked for.
  const [shown, setShown] = useState<{ tab: BoardTab; sheet: Sheet } | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const wallet = useWallet();
  const avatar = useAvatar();
  const authStatus = useAuth((s) => s.status);
  const profile = useAuth((s) => s.profile);
  const signedIn = authEnabled() && authStatus === 'ready' && !!profile;
  const me = signedIn ? profile.nickname : null;
  const key = tab === 'wins' ? `wins:${period}` : tab;
  const close = useRef<HTMLButtonElement>(null);
  const win = useRef<HTMLDivElement>(null);
  useEffect(() => { close.current?.focus({ preventScroll: true }); }, []);

  useEffect(() => {
    let live = true;
    const done = (s: Sheet) => { setSheet(s); setShown({ tab, sheet: s }); };
    const hit = kept.get(`${key}|${me ?? ''}`);
    if (hit && Date.now() - hit.at < FRESH_MS) return done(hit.sheet);
    setSheet('loading');
    read(tab, period, me).then(
      (s) => { kept.set(`${key}|${me ?? ''}`, { at: Date.now(), sheet: s }); if (live) done(s); },
      // A game server from before this page has no such address (ranked play, or a board read without a login):
      // say the board is not on yet, do not call it an error.
      (e) => { if (live) { setSheet(e instanceof ApiError && e.status === 404 ? 'off' : 'error'); setShown(null); } },
    );
    return () => { live = false; };
  }, [key, me]); // eslint-disable-line react-hooks/exhaustive-deps
  // Your own online wins, for the Wins board: asked once, and only with a login the server knows.
  useEffect(() => {
    let live = true;
    void apiToken().then((t) => (t ? api<Stats>('GET', '/api/me/stats', t) : null)).then((s) => { if (live && s) setStats(s); }, () => undefined);
    return () => { live = false; };
  }, [me]);

  const at = TABS.find((t) => t.id === tab)!;
  const arrows = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const next = TABS[(TABS.indexOf(at) + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length].id;
    setTab(next);
    (e.currentTarget.querySelector(`[data-tab="${next}"]`) as HTMLElement | null)?.focus();
  };
  // What is drawn: the board that came in (or the last one, while the next is on its way), formatted as its own board.
  const busy = sheet === 'loading';
  const showTab = shown?.tab ?? tab;
  const sh = typeof sheet === 'object' ? sheet : busy ? shown?.sheet ?? null : null;
  const lines = sh?.lines ?? [];
  const cols = TABS.find((t) => t.id === showTab)!.cols;
  const mine = lines.find((l) => l.you);
  const n = (l?: Line) => (l ? view(showTab, l).n : 0);

  // Said once, on a wool plate at the foot of the sky: an empty board (the pedestals wait), or no board at all.
  const none = sheet === 'off' ? 'This board is not switched on for this server yet.' : sheet === 'error' ? 'The barn could not be reached. Try again in a moment.' : '';
  const say: ReactNode = none || (sh && !lines.length ? <>Nobody is up here yet. <b>{at.first}</b></> : null);

  // On the pedestals: each of the three, with their name and (on a wide screen) their figure; an open place says so.
  const plaques = MEDAL.map((_, i) => {
    const l = lines[i];
    // A place nobody holds hangs the same tag and plate a holder's does, saying it is open.
    if (!l) return sh || none ? (
      <span className="sk-lb-plaque" data-open="">
        <span className="sk-plate"><span className="sk-plate-who">Open</span></span>
        <Slate size="mini" className="sk-lb-figure"><span className="sk-lb-could">Could be you</span></Slate>
      </span>
    ) : null;
    const f = said(showTab, l);
    const tag = <span className="sk-plate"><span className="sk-plate-who">{l.name}</span>{l.you && <span className="sk-plate-you">you</span>}</span>;
    return (
      <span className="sk-lb-plaque" data-place={i + 1} data-long={l.name.length >= 10 || undefined}>
        {i === 0 ? <span className="sk-head" data-speaker="">{tag}</span> : tag}
        <Slate size="mini" tone={i === 0 ? 'amber' : 'chalk'} className="sk-lb-figure">
          <b>{f.big}</b>
          {showTab === 'ranked' && <RankBadge rating={l.rating ?? 0} size={20} />}
          <span>{f.small}</span>
        </Slate>
      </span>
    );
  });

  // Where you stand on this board: the big line, how far you are from the next ones, and whether you are shown.
  const third = lines[2], above = mine ? lines[mine.place - 2] : undefined;
  const unit = TABS.find((t) => t.id === showTab)!.unit;
  const big = mine ? (sh?.standing && showTab !== 'wins' ? sh.standing : `#${mine.place}`)
    : tab === 'ranked' ? 'No rank yet'
    : tab === 'wins' ? (stats ? many(stats.wins, 'win') : 'No wins yet')
    : sh?.standing ?? `Level ${levelOf(wallet.xp).level}`;
  const gap = mine
    ? mine.place === 1 ? 'You hold first place.'
      : mine.place <= 3 ? `You are on the podium, ${(n(lines[0]) - n(mine)).toLocaleString()} ${unit} behind first.`
      : `${Math.max(0, n(third) - n(mine)).toLocaleString()} ${unit} to the podium, ${Math.max(0, n(above) - n(mine)).toLocaleString()} behind ${above?.name}.`
    : sheet === 'off' ? 'This board opens here once the server has it.' : sheet === 'error' ? 'Try again in a moment.'
    : tab === 'ranked' ? (signedIn || !authEnabled() ? 'Choose Ranked under Play to get a place.' : 'Log in, then choose Ranked under Play.')
    : tab === 'wins' ? (authEnabled() && !signedIn ? 'Online wins count on an account. Log in to keep yours.' : stats ? `In ${many(stats.gamesPlayed, 'online game')}, all time.` : 'Win a game from the queue or in a lobby.')
    : authEnabled() && !signedIn ? `${wallet.xp.toLocaleString()} XP in this browser. Log in to get a place.` : `${wallet.xp.toLocaleString()} XP. Finish a game to get a place.`;
  const canShow = signedIn && profile.consentStatus === 'not_required';
  const fine = signedIn ? "Players who needed a parent's permission are never shown on the leaderboards."
    : authEnabled() ? 'Guests are not listed. Log in to climb the boards.' : 'Only names are shown here, nothing else about a player.';

  // Under the last line, the rest of the wool says what is open, once, under a cup (or that the board is on its way).
  // On a narrow screen the sky's sentence would lie over the pedestals' tags, so there the wool says it instead.
  const rest: ReactNode = !sh ? (busy ? 'Asking the barn...' : none ? <><span data-at="wide">Nothing to list yet.</span><span data-at="narrow">{say}</span></> : '')
    : !lines.length ? <><span data-at="wide">Every place is open.</span><span data-at="narrow">{say}</span></> : `From ${nth(lines.length + 1)} place on, every place is open.`;
  // The list scrolls in whole lines: its height is cut to a whole number of them, the rest is the wool's own padding.
  const listRef = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const ol = listRef.current, face = ol?.parentElement;
    if (!ol || !face) return;
    const fit = () => {
      // Measured at the lines' own height, then each line is stretched a little so a whole number of them fills the wool.
      ol.style.removeProperty('--lb-row');
      ol.style.maxHeight = '';
      const row = [...ol.children].find((c) => (c as HTMLElement).offsetHeight > 0) as HTMLElement | undefined;
      if (!row) return;
      const cs = getComputedStyle(face), head = face.querySelector('.sk-lb-cols') as HTMLElement | null;
      const room = face.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - (head?.offsetHeight ?? 0);
      const k = Math.max(1, Math.floor(room / row.offsetHeight));
      // (A line's height includes its rule: the page sizes boxes border to border.)
      if (ol.children.length >= k) ol.style.setProperty('--lb-row', `${Math.floor(room / k)}px`);
      ol.style.maxHeight = `${k * Math.max(row.offsetHeight, Math.floor(room / k))}px`;
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(face);
    return () => ro.disconnect();
  }, [lines.length, showTab]);

  return (
    <div role="dialog" aria-modal="true" aria-label="Leaderboards" className="rm-screen sk-lb" data-busy={busy || undefined}>
      <Suspense fallback={null}>
        <BoardStage seats={MEDAL.map((_, i) => ({ place: (i + 1) as 1 | 2 | 3, you: !!lines[i]?.you, avatar: lines[i]?.you ? avatar : null, taken: !!lines[i] }))} plaques={plaques} windowEl={win} />
      </Suspense>
      <div className="sk-lb-body">
        <header className="sk-lb-bar kit-beam kit-drift">
          <i className="kit-beam-strap" />
          <i className="kit-beam-strap" />
          <div role="tablist" aria-label="Boards" className="sk-lb-tabs" onKeyDown={arrows}>
            {TABS.map((t) => (
              <button key={t.id} type="button" role="tab" data-tab={t.id} aria-selected={tab === t.id} tabIndex={tab === t.id ? 0 : -1} className={`rm-tab ${tab === t.id ? 'kit-lit' : ''}`} onClick={() => setTab(t.id)}>
                {t.id === 'ranked' ? <TierBadge tier={7} size={20} /> : t.id === 'wins' ? <TrophyIcon size={18} /> : <ArrowUpIcon size={18} />}
                <span>{t.label}</span>
              </button>
            ))}
          </div>
          <div className="sk-lb-end">
            <h1 className="rm-name">Leaderboards</h1>
            <Peg ref={close} light className="sk-lb-close" onClick={onClose} aria-label="Close"><CloseIcon size={18} /></Peg>
          </div>
          <Garland swags={7} />
        </header>
        <div className="sk-lb-window" ref={win}>
          {say && <Slate size="mini" className="sk-lb-say"><p>{say}</p></Slate>}
        </div>
        <section className="rm-panel kit-wall kit-drift sk-lb-board" aria-label={at.title}>
          <div className="rm-head">
            <span className="kit-plank kit-plank--label sk-room-heading"><h2>{at.title}</h2></span>
            {tab === 'wins' ? (
              <div role="group" aria-label="When" className="rm-seg sk-lb-when">
                {PERIODS.map(([p, label]) => <button key={p} type="button" aria-pressed={period === p} className={`rm-tab ${period === p ? 'kit-lit' : ''}`} onClick={() => setPeriod(p)}>{label}</button>)}
              </div>
            ) : <p className="rm-hint">{at.hint}</p>}
          </div>
          <Slate size="board" className="rm-wool sk-lb-list" data-board={showTab}>
            <div className="sk-lb-cols" aria-hidden="true"><span>#</span><span>Player</span><span>{cols[0]}</span><span>{cols[1]}</span></div>
            <ol ref={listRef} className="sk-lb-lines" aria-label={`${at.title}, from first place`} aria-busy={busy}>
              {lines.map((l) => {
                const v = view(showTab, l);
                return (
                  <li key={l.place} className="sk-lb-line" data-top={l.place <= 3 ? l.place : undefined} data-you={l.you || undefined}>
                    <span className="sk-lb-place">{l.place <= 3 ? <Tag tone={MEDAL[l.place - 1][0]}>{MEDAL[l.place - 1][1]}</Tag> : l.place}</span>
                    <span className="sk-lb-name"><span>{l.name}</span>{l.you && <Tag tone="green">You</Tag>}</span>
                    <span className="sk-lb-sub">{v.sub}</span>
                    <b className="sk-lb-fig">{v.fig}</b>
                  </li>
                );
              })}
            </ol>
            {lines.length < ROOM && rest && (
              <div className="sk-lb-rest">
                <span className="sk-lb-rest-cup" aria-hidden="true"><TrophyIcon size={34} /></span>
                <p>{rest}{sh && lines.length > 0 && <b> Play to take one.</b>}</p>
              </div>
            )}
          </Slate>
          <Slate size="board" className="sk-lb-you sk-ledger-turn" aria-label="Where you stand">
            <span className="sk-lb-you-top">
              <AvatarIcon id={avatar ?? 'sheep'} size={30} />
              <b className="sk-lb-you-big">{big}</b>
              {mine && <span className="sk-lb-you-fig">{showTab === 'ranked' && <RankBadge rating={mine.rating ?? 0} size={20} />}<span>{said(showTab, mine).small}</span><b>{said(showTab, mine).big}</b></span>}
            </span>
            <span className="sk-lb-you-gap">{gap}</span>
            {canShow ? (
              <label className="sk-lb-show"><Switch checked={profile?.leaderboardVisible !== false} onChange={(v) => void useSocial.getState().setVisible(v)} label="Show me on the leaderboards" /><span>Show me on the leaderboards</span></label>
            ) : <span className="sk-lb-show">{fine}</span>}
          </Slate>
        </section>
      </div>
    </div>
  );
}
