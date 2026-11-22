import { Suspense, lazy, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode, RefObject } from 'react';
import { ApiError, api, useAuth } from '../../auth/authStore';
import { authEnabled } from '../../auth/config';
import { FESTIVE } from '../../config';
import { getLang } from '../../lib/lang';
import { rankOf } from '../../lib/ranked';
import { useSocial } from '../../state/socialStore';
import { useStore } from '../../state/store';
import { AvatarIcon } from '../avatars/AvatarIcon';
import { useAvatar } from '../avatars/store';
import { CloseIcon } from '../components/Icons';
import { useMotionLevel } from '../hooks/useAmbient';
import { usePageHistory } from '../hooks/usePageHistory';
import { SceneBoundary } from '../perf/SceneBoundary';
import type { Board as LevelBoard } from '../profile/Profile';
import { apiToken, useRanked } from '../ranked/rankedStore';
import { levelOf } from '../shop/economy';
import { useWallet } from '../shop/store';
import { Bracket, Icon, InfoGlyph, Padlock, Rosette, Snowflake, TierIcon } from './art';
import type { IconName } from './art';
import '../home/home.css';
import './boards.css';

/** The stage is three.js: it comes after the page, which is up and readable before it. */
const BoardStage = lazy(() => import('./BoardStage'));

export type BoardTab = 'ranked' | 'wins' | 'level';
export type Period = 'day' | 'week' | 'all';

/**
 * One line of a board, whichever board it is: a place, a name, the big figure (`score`: ranked points, wins or XP) and
 * the small one beside it (`extra`: games played, or the level). Formatted only when drawn, in the game's language.
 */
export interface Line { place: number; name: string; score: number; extra: number; you: boolean }
/** A board as the page shows it: its lines, and your own place (and figures) when the server gives one. */
export interface Sheet { lines: Line[]; place: number | null; mine?: { score: number; extra: number } }

interface RankedBoard { top: Array<{ place: number; name: string; rating: number; games: number; wins: number; you: boolean }>; you: { place: number; of: number } | null }
interface WinsBoard { rows: Array<{ rank: number; name: string; value: number; games: number }> }

/** The ranked ladder (GET /api/ranked/top, or /api/ranked/board without a login): points, and the games behind them. */
export function rankedSheet(b: RankedBoard): Sheet {
  return { lines: b.top.map((r) => ({ place: r.place, name: r.name, score: r.rating, extra: r.games, you: r.you })), place: b.you?.place ?? null };
}
/** The level board (GET /api/barn/top, or /api/barn/board without a login): XP, and the level it makes. */
export function levelSheet(b: LevelBoard): Sheet {
  return {
    lines: b.top.map((r) => ({ place: r.place, name: r.name, score: r.xp, extra: r.level, you: r.you })),
    place: b.you?.place ?? null,
    ...(b.you ? { mine: { score: b.you.xp, extra: levelOf(b.you.xp).level } } : {}),
  };
}
/** Online wins (GET /api/leaderboard/:period, public). It carries no ids, so "you" is the row with your own name. */
export function winsSheet(b: WinsBoard, me: string | null): Sheet {
  const lines = b.rows.map((r) => ({ place: r.rank, name: r.name, score: r.value, extra: r.games, you: me !== null && r.name === me }));
  return { lines, place: lines.find((l) => l.you)?.place ?? null };
}

/**
 * Numbers in the game's language, grouped, figures of one width (the stylesheet lines them up). French groups with a
 * narrow no-break space, which the display face draws almost too thin to see: a full no-break space is used instead.
 */
const NUMBER = new Intl.NumberFormat(getLang() === 'fr' ? 'fr-FR' : 'en-US');
export const fmt = (n: number) => NUMBER.format(n).replace(/\u202f/g, '\u00a0');

/**
 * Development only: `?lbDemo` fills every board with made-up players, so the stage and its three can be seen on a copy
 * of the game with no game server (`npm run dev`); with it, Home shows the trophy button too. A production build drops
 * all of it (`import.meta.env.DEV` is false there).
 */
export const BOARDS_DEMO = import.meta.env.DEV && typeof location !== 'undefined' && new URLSearchParams(location.search).has('lbDemo');
const DEMO_NAMES = ['kxln', 'owen2008', 'bigmayafan18', 'realfrog', 'libo', 'its_tansy', 'Pip', 'MapleLeafKid', 'barley_bun', 'thegoatjo', 'lilwool09', 'SnowyHollow'];
function demoSheet(tab: BoardTab): Sheet {
  if (tab === 'wins') return winsSheet({ rows: DEMO_NAMES.map((name, i) => ({ rank: i + 1, name, value: 212 - i * 12, games: 323 - i * 15 })) } as unknown as WinsBoard, null);
  if (tab === 'ranked') return rankedSheet({ top: DEMO_NAMES.map((name, i) => ({ place: i + 1, name, rating: 2240 - i * 97, games: 300 - i * 11, wins: 120 - i * 5, you: false })), you: null } as unknown as RankedBoard);
  return levelSheet({ top: DEMO_NAMES.map((name, i) => ({ place: i + 1, name, xp: 96000 - i * 5300, level: 41 - i * 2, you: false })), players: 2431, you: null } as unknown as LevelBoard);
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
  if (BOARDS_DEMO) return demoSheet(tab);
  if (tab === 'wins') return winsSheet(await api<WinsBoard>('GET', `/api/leaderboard/${period}?metric=wins`, null), me);
  const [mine, open] = tab === 'ranked' ? ['/api/ranked/top', '/api/ranked/board'] : ['/api/barn/top', '/api/barn/board'];
  const token = await apiToken();
  const raw = await (token ? api<unknown>('GET', mine, token).catch(() => api<unknown>('GET', open, null)) : api<unknown>('GET', open, null));
  return tab === 'ranked' ? rankedSheet(raw as RankedBoard) : levelSheet(raw as LevelBoard);
}

/** Each board: its tab, its title on the ribbon, the line under it, the column heads, and how to get a place on it. */
/** A board already in hand when the page opens (the tests draw every tab this way), and the info card open or not. */
export interface Start { tab: BoardTab; sheet?: Sheet; info?: boolean }

const TABS: { id: BoardTab; icon: IconName; label: string; title: string; sub: string; cols: [string, string]; hint: string }[] = [
  { id: 'ranked', icon: 'ranked', label: 'Ranked', title: 'Ranked ladder', sub: 'By ranked points', cols: ['Rank', 'Points'], hint: 'Play a ranked game to get a place.' },
  { id: 'wins', icon: 'wins', label: 'Wins', title: 'Most wins', sub: '', cols: ['Games', 'Wins'], hint: 'Win a game from the queue or in a lobby.' },
  { id: 'level', icon: 'level', label: 'Level', title: 'Highest level', sub: 'By XP from games', cols: ['Level', 'XP'], hint: 'Finish a game to get a place.' },
];
// No Today (Brian, 2026-11-14: "remove the today option from the leaderboards"): the server still answers /day.
const PERIODS: [Period, string][] = [['week', 'This week'], ['all', 'All time']];
const nth = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;

/**
 * The layout: a computer's (the stage on the left, the board on the right) when the part of the stage the board leaves
 * is at least 360 wide, else a phone's (the stage on top, the board as a sheet under it). Every size is the plan's
 * pixels times `u`: Home's scale on a computer, 1 on a phone (as Home's own phone layout has it).
 */
export function screenOf(w: number, h: number): { desk: boolean; u: number } {
  // The rule is read in the plan's own pixels (at --u = 1): a tablet held upright, 768 wide, leaves 328 and is a phone.
  // Read at the 0.8 scale it would leave 416 of 288 and be a computer: crates 80 wide in a tall empty sky.
  const desk = w - Math.min(480, Math.max(400, 0.34 * w)) - 40 >= 360;
  return { desk, u: desk ? Math.min(1.5, Math.max(0.8, Math.min(w / 1280, h / 720))) : 1 };
}
function useScreen() {
  const get = () => (typeof window === 'undefined' ? { desk: true, u: 1 } : screenOf(window.innerWidth, window.innerHeight));
  const [s, set] = useState(get);
  useEffect(() => {
    const on = () => { const n = get(); set((o) => (o.desk === n.desk && o.u === n.u ? o : n)); };
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return s;
}

/** What a line says in its third column: the rank (with its badge), the games, or the level. */
function third(tab: BoardTab, l: { score: number; extra: number }, badge = 24): ReactNode {
  if (tab === 'ranked') return <><TierIcon tier={rankOf(l.score).tier} height={badge} /><span>{rankOf(l.score).label}</span></>;
  if (tab === 'wins') return <span><span className="lb-num">{fmt(l.extra)}</span> {l.extra === 1 ? 'game' : 'games'}</span>;
  return <span>Level <span className="lb-num">{fmt(l.extra)}</span></span>;
}

/**
 * The leaderboards (docs/leaderboards/LEADERBOARDS-PLAN.md, Brian, 2026-11-21, version 2: "nothing may look like a flat,
 * empty, single-coloured card"). Home's slabs and colours over the sky: a night-blue bar across the top with snow on it
 * and the season's lights under it, the three boards' tabs and the way out; the stage, three crates on a snowy island
 * with the first three on them and their names on plates; and a night-blue board on the right (a sheet under the stage
 * on a phone) with the board's ribbon, its list from fourth place, and your own row pinned at its foot.
 */
export function Leaderboards({ onClose, start }: { onClose: () => void; start?: Start }) {
  const [info, setInfo] = useState<'none' | 'hover' | 'pinned'>(start?.info ? 'pinned' : 'none');
  const infoOpen = useRef(false);
  infoOpen.current = info !== 'none';
  usePageHistory('boards', onClose, () => infoOpen.current);
  const { desk, u } = useScreen();
  const reduced = useMotionLevel() === 'reduced';
  const [tab, setTab] = useState<BoardTab>(start?.tab ?? 'ranked');
  const [period, setPeriod] = useState<Period>('week');
  const [sheet, setSheet] = useState<Sheet | 'loading' | 'off' | 'error'>(start?.sheet ?? 'loading');
  // The last board that came in, and which board it was: it stays up (dimmed) while the next one is asked for.
  const [shown, setShown] = useState<{ tab: BoardTab; key: string; sheet: Sheet } | null>(start?.sheet ? { tab: start.tab, key: start.tab === 'wins' ? 'wins:week' : start.tab, sheet: start.sheet } : null);
  const wallet = useWallet();
  const avatar = useAvatar();
  const localName = useStore((s) => s.settings.name);
  const authStatus = useAuth((s) => s.status);
  const profile = useAuth((s) => s.profile);
  const rated = useRanked((s) => s.me);
  const signedIn = authEnabled() && authStatus === 'ready' && !!profile;
  const me = signedIn ? profile.nickname : null;
  const key = tab === 'wins' ? `wins:${period}` : tab;
  const close = useRef<HTMLButtonElement>(null);
  const win = useRef<HTMLDivElement>(null);
  const title = useRef<HTMLSpanElement>(null);
  // The ribbon's title may use the whole line (and the 25 it reaches past the board on a computer), less its own ends.
  const titleRoom = useCallback((el: HTMLElement) => {
    const rib = el.parentElement, head = rib?.parentElement;
    if (!rib || !head) return el.clientWidth;
    const cs = getComputedStyle(rib), icon = rib.querySelector('svg')?.getBoundingClientRect().width ?? 0;
    return head.clientWidth + (desk ? 25 * u : 0) - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - icon - (parseFloat(cs.columnGap) || 0);
  }, [desk, u]);
  useFit(title, 20 * u, 16 * u, tab, titleRoom);
  useEffect(() => { close.current?.focus({ preventScroll: true }); }, []);

  useEffect(() => {
    let live = true;
    const done = (s: Sheet) => { setSheet(s); setShown({ tab, key, sheet: s }); };
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

  // The info card: Escape, a second tap or a tap anywhere else closes it (and Escape then leaves the page alone).
  const infoBox = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (info === 'none') return;
    const key = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); setInfo('none'); } };
    const away = (e: PointerEvent) => { if (!infoBox.current?.contains(e.target as Node)) setInfo('none'); };
    window.addEventListener('keydown', key, true);
    window.addEventListener('pointerdown', away, true);
    return () => { window.removeEventListener('keydown', key, true); window.removeEventListener('pointerdown', away, true); };
  }, [info]);

  const at = TABS.find((t) => t.id === tab)!;
  const arrows = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const next = TABS[(TABS.indexOf(at) + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length].id;
    setTab(next);
    (e.currentTarget.querySelector(`[data-tab="${next}"]`) as HTMLElement | null)?.focus();
  };

  // What is drawn: the board that came in (or the last one, while the next is on its way), as its own board.
  const busy = sheet === 'loading';
  const showTab = shown?.tab ?? tab;
  const sh = typeof sheet === 'object' ? sheet : busy ? shown?.sheet ?? null : null;
  const lines = sh?.lines ?? [];
  const cols = TABS.find((t) => t.id === showTab)!.cols;
  const listed = lines.filter((l) => l.place > 3);
  const failed = sheet === 'off' ? 'This board is not switched on for this server yet.' : sheet === 'error' ? 'The barn could not be reached. Try again in a moment.' : '';

  // The plates on the crates: each holder's name and figure, or "No one yet". None while the first board is on its way.
  const plates = [0, 1, 2].map((i) => {
    if (!sh && !failed) return null;
    const l = lines[i];
    const style = { '--n': l ? Math.max(6, l.name.length) : 10 } as CSSProperties;
    return (
      <div className={`lb-plate hm-slab hm-knit lb-static ${i === 0 ? 'lb-plate--first' : ''}`} data-open={!l || undefined} style={style}>
        {desk && <Rosette place={(i + 1) as 1 | 2 | 3} open={!l} />}
        <span className="lb-plate-text" key={`${shown?.key ?? key}:${l?.name ?? ''}`}>
          {l ? (
            <>
              <b className="lb-plate-name">{l.name}</b>
              <span className="lb-plate-score">
                {showTab === 'ranked' ? <><TierIcon tier={rankOf(l.score).tier} height={16} /><span className="lb-num">{fmt(l.score)}</span></>
                  : showTab === 'wins' ? <><span className="lb-num">{fmt(l.score)}</span> {l.score === 1 ? 'win' : 'wins'}</>
                  : <><span className="lb-num">{fmt(l.score)}</span> XP</>}
              </span>
            </>
          ) : <span className="lb-plate-none">No one yet</span>}
        </span>
      </div>
    );
  });

  // You: your place and figures on this board, from the list or (past it) from the server's word on you.
  const mine = lines.find((l) => l.you);
  const myPlace = mine?.place ?? sh?.place ?? null;
  const myFig = mine ?? (sh?.mine ? { score: sh.mine.score, extra: sh.mine.extra } : showTab === 'ranked' && myPlace && rated ? { score: rated.rating, extra: rated.games } : null);
  const myName = me ?? (localName.trim() || 'Guest');
  const canShow = signedIn && profile.consentStatus === 'not_required';
  const level = levelOf(wallet.xp).level;

  return (
    <div role="dialog" aria-modal="true" aria-label="Leaderboards" className="lb" data-phone={!desk || undefined} data-busy={busy || undefined}
      style={{ '--u': `${u}px` } as CSSProperties}>
      {/* Round the lazy stage: its code failing to load (a tab open across a new version) or its sky failing to draw. */}
      <SceneBoundary scene="the leaderboards' sky">
        <Suspense fallback={null}>
          <BoardStage phone={!desk} u={u} reduced={reduced} windowEl={win} plates={plates}
            seats={[0, 1, 2].map((i) => ({ place: (i + 1) as 1 | 2 | 3, you: !!lines[i]?.you, avatar: lines[i]?.you ? avatar : null, taken: !!lines[i] }))} />
        </Suspense>
      </SceneBoundary>

      <header className="lb-bar">
        <SnowCap />
        {desk && <div className="lb-titletag hm-slab hm-knit lb-static"><Icon name="podium" /><h1>Leaderboards</h1></div>}
        <div role="tablist" aria-label="Boards" className="lb-tabs" onKeyDown={arrows}>
          {TABS.map((t) => (
            <button key={t.id} type="button" role="tab" data-tab={t.id} aria-selected={tab === t.id} tabIndex={tab === t.id ? 0 : -1}
              className={`lb-tab hm-slab hm-knit ${tab === t.id ? 'hm-slab--lantern' : ''}`} onClick={() => setTab(t.id)}>
              <span className="lb-tab-icon"><Icon name={t.icon} /></span>
              <TabLabel text={t.label} u={u} />
            </button>
          ))}
        </div>
        <button ref={close} type="button" className="lb-close hm-slab hm-knit" onClick={onClose} aria-label="Close" title="Close"><CloseIcon size={16} /></button>
        {FESTIVE && <Lights u={u} reduced={reduced} />}
      </header>

      <div className="lb-window" ref={win} />

      <section className="lb-board" aria-label={at.title} data-board={showTab}>
        <SnowCap icicles />
        <i className="lb-frame" aria-hidden="true">
          {(['tl', 'tr', 'bl', 'br'] as const).map((k) => <Bracket key={k} className={`lb-bracket lb-bracket--${k}`} />)}
        </i>
        <div className="lb-head">
          <div className="lb-headline">
            <h2 className="lb-ribbon"><i className="lb-ribbon-face" aria-hidden="true" /><Icon name={at.icon} /><span ref={title}>{at.title}</span></h2>
            <div className="lb-tools">
              {tab === 'wins' && desk && <When period={period} onPick={setPeriod} />}
              <div className="lb-info" ref={infoBox} onPointerLeave={(e) => { if (e.pointerType === 'mouse' && info === 'hover') setInfo('none'); }}>
                <button type="button" className="lb-info-btn hm-slab hm-slab--night" aria-label="Privacy" aria-expanded={info !== 'none'} aria-controls="lb-info-card"
                  onPointerEnter={(e) => { if (e.pointerType === 'mouse' && info === 'none') setInfo('hover'); }}
                  onClick={() => setInfo((s) => (s === 'pinned' ? 'none' : 'pinned'))}><InfoGlyph /></button>
                {info !== 'none' && (
                  <div id="lb-info-card" role="note" className="lb-inkcard">
                    <i className="lb-inkcard-point" aria-hidden="true" />
                    <Padlock />
                    <div className="lb-inkcard-text">
                      <p>Only names are shown here, nothing else about a player.</p>
                      {authEnabled() && !signedIn && <p>Guests are not listed. Log in to climb the boards.</p>}
                      {signedIn && !canShow && <p>Players who needed a parent's permission are never shown on the leaderboards.</p>}
                      {canShow && (
                        <div className="lb-show">
                          <span>Show me on the leaderboards</span>
                          <div role="group" aria-label="Show me on the leaderboards" className="lb-toggle lb-well lb-toggle--small">
                            {([[true, 'Shown'], [false, 'Hidden']] as const).map(([v, label]) => {
                              const on = (profile.leaderboardVisible !== false) === v;
                              return <button key={label} type="button" aria-pressed={on} className={`hm-slab ${on ? 'hm-slab--lantern hm-knit' : 'hm-slab--night'}`} onClick={() => void useSocial.getState().setVisible(v)}>{label}</button>;
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          {at.sub && <p className="lb-sub">{at.sub}</p>}
          {tab === 'wins' && !desk && <When period={period} onPick={setPeriod} wide />}
        </div>
        <div className="lb-divider" aria-hidden="true"><span className="lb-flake"><Snowflake /></span></div>
        <div className="lb-cols lb-well" aria-hidden="true">
          <span>#</span><span>Player</span><span>{cols[0]}</span><span>{cols[1]}</span>
        </div>
        <Rows board={shown?.key ?? key} u={u} tab={showTab} lines={listed} busy={busy && !sh} total={lines.length} failed={failed} reduced={reduced} icon={TABS.find((t) => t.id === showTab)!.icon} />
        <div className="lb-you hm-slab hm-knit lb-static" role="group" aria-label="Where you stand">
          <i className="lb-you-bar" aria-hidden="true" />
          <span className="lb-badge">{myPlace !== null ? fmt(myPlace) : '–'}</span>
          <span className="lb-you-face"><AvatarIcon id={avatar ?? 'sheep'} size={28} /></span>
          <span className="lb-you-text">
            <span className="lb-you-l1"><span className="lb-pennant">You</span><b className="lb-you-name">{myName}</b></span>
            <span className="lb-you-l2">
              {myPlace !== null && myFig ? third(showTab, myFig, 16)
                : showTab === 'level' ? <><span>Level <span className="lb-num">{fmt(level)}</span></span><i className="lb-rule" aria-hidden="true" /><span>{TABS[2].hint}</span></>
                : <span>{TABS.find((t) => t.id === showTab)!.hint}</span>}
            </span>
          </span>
          {myPlace !== null && myFig ? <b className="lb-you-score lb-num">{fmt(myFig.score)}</b>
            : showTab === 'level' ? <b className="lb-you-score lb-num">{fmt(wallet.xp)}</b> : null}
        </div>
      </section>
    </div>
  );
}

/** How wide `text` is in `el`'s typeface at `px` pixels (a canvas measures it; nothing on the page moves). */
let pen: CanvasRenderingContext2D | null = null;
function widthAt(el: HTMLElement, text: string, px: number): number {
  pen ??= document.createElement('canvas').getContext('2d');
  if (!pen) return 0;
  const cs = getComputedStyle(el);
  pen.font = `${cs.fontWeight} ${px}px ${cs.fontFamily}`;
  return pen.measureText(text).width;
}

/**
 * Sets an element's type size to the largest from `max` down to `min` (whole pixels) at which its text fits in `room`
 * (its own width by default), after any translation: French titles are up to 40% longer. Past `min` the text ends in an
 * ellipsis, and `tight` is told so (a tab then drops its icon and is measured again).
 */
function useFit(ref: RefObject<HTMLElement | null>, max: number, min: number, dep: unknown, room?: (el: HTMLElement, tight: boolean) => number, tight?: (t: boolean) => void) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      const text = el.textContent ?? '';
      const size = (avail: number) => {
        let px = Math.floor(max);
        while (px > min && widthAt(el, text, px) > avail) px--;
        return { px, fits: widthAt(el, text, px) <= avail };
      };
      let s = size(room ? room(el, false) : el.clientWidth);
      if (!s.fits && room && tight) { s = size(room(el, true)); tight(true); } else tight?.(false);
      el.style.fontSize = `${s.px}px`;
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el.parentElement ?? el);
    const mo = new MutationObserver(fit);
    mo.observe(el, { characterData: true, childList: true, subtree: true });
    return () => { ro.disconnect(); mo.disconnect(); };
  }, [ref, max, min, dep, room, tight]);
}

/**
 * A tab's label: 17 at most, as small as 12. If it will not fit beside its icon even at 12, the icon steps out (a
 * narrow phone in French); past that it ends in an ellipsis.
 */
function TabLabel({ text, u }: { text: string; u: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const room = useRef((el: HTMLElement, tight: boolean) => {
    const tab = el.closest('button');
    if (!tab) return el.clientWidth;
    const cs = getComputedStyle(tab), icon = tab.querySelector('.lb-tab-icon') as HTMLElement | null;
    const inner = tab.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    // The icon's room, whether or not it is showing now (24 at the plan's scale, and the gap beside it).
    const iconW = icon && icon.offsetWidth ? icon.offsetWidth : 24 * (parseFloat(getComputedStyle(tab).getPropertyValue('--u')) || 1);
    return tight ? inner : inner - iconW - (parseFloat(cs.columnGap) || 0);
  }).current;
  const tight = useRef((t: boolean) => { ref.current?.closest('button')?.toggleAttribute('data-tight', t); }).current;
  useFit(ref, 17 * u, 12 * u, text, room, tight);
  return <span ref={ref} className="lb-tab-label">{text}</span>;
}

/** This week or all time, for the Wins board: two slabs in a sunk well. */
function When({ period, onPick, wide = false }: { period: Period; onPick: (p: Period) => void; wide?: boolean }) {
  return (
    <div role="group" aria-label="When" className={`lb-toggle lb-well ${wide ? 'lb-toggle--wide' : ''}`}>
      {PERIODS.map(([p, label]) => (
        <button key={p} type="button" aria-pressed={period === p} className={`hm-slab ${period === p ? 'hm-slab--lantern hm-knit' : 'hm-slab--night'}`} onClick={() => onPick(p)}>{label}</button>
      ))}
    </div>
  );
}

/**
 * The list from fourth place: a tile a line, rising in one after another when a board comes in. It grows with its lines
 * up to the board's foot and scrolls inside past that, with a scroll bar drawn like the rest (a sunk track, a thumb with
 * a lit and a shaded row). An empty list is one sunk well with the board's icon; a list on its way is six empty tiles.
 */
function Rows({ board, tab, lines, busy, total, failed, reduced, icon, u }: { board: string; u: number; tab: BoardTab; lines: Line[]; busy: boolean; total: number; failed: string; reduced: boolean; icon: IconName }) {
  const box = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLOListElement>(null);
  const thumb = useRef<HTMLElement>(null);
  const [over, setOver] = useState(false);
  // The height follows the lines (eased, so a new board does not jump), and the thumb follows the scroll.
  useLayoutEffect(() => {
    const el = list.current, wrap = box.current;
    if (!el || !wrap) return;
    const sync = () => {
      // As many whole rows as the board has room for (it stops at its foot), so no row is ever cut at the bottom.
      const board = wrap.parentElement;
      // The lines' own height (the list's scrollHeight is never less than the box it is in, so it cannot shrink).
      const last = el.lastElementChild as HTMLElement | null;
      let h = last ? last.offsetTop + last.offsetHeight + parseFloat(getComputedStyle(last).marginBottom) : 0;
      const tile = el.querySelector('.lb-tile') as HTMLElement | null;
      if (board && tile) {
        // The board's tallest: a phone's sheet is as tall as it is; a computer's stops 20 over the screen's foot.
        const cs = getComputedStyle(board), max = board.closest('[data-phone]') ? board.clientHeight : ((board.offsetParent as HTMLElement | null)?.clientHeight ?? 0) - board.offsetTop - 20 * u;
        let others = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) + parseFloat(getComputedStyle(wrap).marginTop);
        for (const k of board.children) {
          if (k === wrap) continue;
          const kc = getComputedStyle(k);
          if (kc.position === 'absolute') continue;
          others += (k as HTMLElement).offsetHeight + parseFloat(kc.marginTop) + parseFloat(kc.marginBottom);
        }
        const pitch = tile.offsetHeight + parseFloat(getComputedStyle(tile).marginBottom);
        if (Number.isFinite(max) && pitch > 0) h = Math.min(h, Math.max(pitch, Math.floor((max - others + 0.5) / pitch) * pitch));
      }
      wrap.style.height = `${h}px`;
      const o = el.scrollHeight > el.clientHeight + 1;
      setOver(o);
      if (o && thumb.current) {
        const track = el.clientHeight, h = Math.max(24, (track * el.clientHeight) / el.scrollHeight);
        thumb.current.style.height = `${h}px`;
        thumb.current.style.transform = `translateY(${((track - h) * el.scrollTop) / Math.max(1, el.scrollHeight - el.clientHeight)}px)`;
      }
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    ro.observe(wrap.parentElement ?? wrap);
    el.addEventListener('scroll', sync, { passive: true });
    return () => { ro.disconnect(); el.removeEventListener('scroll', sync); };
  }, [lines.length, busy, over, u]);
  // Dragging the thumb scrolls the list; a press on the track pages it.
  const drag = (e: ReactPointerEvent<HTMLElement>) => {
    const el = list.current;
    if (!el) return;
    e.preventDefault();
    const y0 = e.clientY, s0 = el.scrollTop, k = el.scrollHeight / el.clientHeight;
    const move = (m: PointerEvent) => { el.scrollTop = s0 + (m.clientY - y0) * k; };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  const page = (e: ReactPointerEvent<HTMLElement>) => {
    const el = list.current;
    if (!el || e.target !== e.currentTarget) return;
    const t = thumb.current?.getBoundingClientRect();
    el.scrollBy({ top: (t && e.clientY < t.top ? -1 : 1) * el.clientHeight * 0.9, behavior: reduced ? 'auto' : 'smooth' });
  };
  const empty = !busy && !lines.length;
  const say = failed || (total === 0 ? 'No one has a place yet.' : `From ${nth(total + 1)} place on, every place is open.`);
  return (
    <div className="lb-rows" ref={box} data-over={over || undefined}>
      <ol ref={list} className="lb-lines" aria-label="From fourth place" aria-busy={busy}>
        {busy && Array.from({ length: 6 }, (_, i) => (
          <li key={i} className="lb-tile lb-tile--loading" aria-hidden="true"><span className="lb-badge" /><i className="lb-ph lb-ph--name" /><i className="lb-ph lb-ph--score" /></li>
        ))}
        {lines.map((l, i) => (
          <li key={`${board}:${l.place}`} className="lb-tile" data-you={l.you || undefined} style={{ '--i': Math.min(i, 16) } as CSSProperties}>
            {l.you && <i className="lb-tile-you" aria-hidden="true" />}
            <span className="lb-badge">{fmt(l.place)}</span>
            {tab === 'ranked' && <span className="lb-tile-tier"><TierIcon tier={rankOf(l.score).tier} /></span>}
            <span className="lb-tile-who">
              <span className="lb-name">{l.name}</span>
              <span className="lb-third">{third(tab, l)}</span>
            </span>
            <b className="lb-score lb-num">{fmt(l.score)}</b>
          </li>
        ))}
        {empty && (
          <li className="lb-empty lb-well">
            <Icon name={icon} px={4} color="var(--hm-night-3)" />
            <span>{say}</span>
          </li>
        )}
      </ol>
      {over && <div className="lb-scroll lb-well" onPointerDown={page} aria-hidden="true"><i ref={thumb} className="lb-thumb" onPointerDown={drag} /></div>}
    </div>
  );
}

/**
 * Snow on an edge (section 9.1): white on its top row, wool under it with a few speckles of frost, a stepped edge with a
 * row of frost under it; on the board, icicles too. One piece an edge, never two. Drawn by the stylesheet.
 */
function SnowCap({ icicles = false }: { icicles?: boolean }) {
  return <i className={`lb-snowcap ${icicles ? 'lb-snowcap--icicles' : ''}`} aria-hidden="true" />;
}

const BULBS = ['#F07A5A', '#9CCB78', '#FFD08A'];
/** `hex` mixed toward the ink by `k` (0 to 1): a bulb's darker side, and a bulb that is off. */
function toInk(hex: string, k: number): string {
  const a = parseInt(hex.slice(1), 16), ink = [0x0e, 0x15, 0x28];
  const ch = [(a >> 16) & 255, (a >> 8) & 255, a & 255].map((v, i) => Math.round(v + (ink[i] - v) * k));
  return `#${ch.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}
const BULB_ART = ['.cc.', '.BB.', 'BhBB', 'BhBB', 'BBBs', 'BBss', '.ss.'];
/** Today's twinkle, bulb by bulb (skin.css, `.sk-garland-wire i`): each on its own time, so the string never pulses. */
const TWINKLE = [[2, 0], [2.9, -0.7], [1.7, -1.9], [3.4, -0.3], [2.3, -2.4]] as const;
const sag = (x: number, L: number) => Math.round((8 * (1 - (2 * x / L - 1) ** 2)) / 2) * 2;

/**
 * The season's lights (section 9.2): hooks every 120 under the bar's bottom edge, a wire two thick hanging between them
 * in two-pixel steps, a bulb every 30, red, green and gold in turn. A bulb that is off is its own colour darkened toward
 * the ink, never a glow. Drawn in the plan's pixels (times `u`) across the bar's whole width.
 */
function Lights({ u, reduced }: { u: number; reduced: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const on = () => setW(el.getBoundingClientRect().width / u);
    on();
    const ro = new ResizeObserver(on);
    ro.observe(el);
    return () => ro.disconnect();
  }, [u]);
  const n = Math.max(1, Math.round(w / 120)), L = w / n;
  const hooks: ReactNode[] = [], wire: ReactNode[] = [], bulbs: ReactNode[] = [];
  if (w > 0) {
    for (let k = 0; k <= n; k++) {
      const x = Math.min(w - 6, Math.max(0, k * L - 3));
      hooks.push(<g key={k}><rect x={x} y={0} width={6} height={6} fill="var(--hm-night-3)" /><rect x={x} y={0} width={6} height={3} fill="var(--hm-frost)" /></g>);
    }
    for (let k = 0; k < n; k++) {
      // The wire, as runs of two-pixel steps at one drop.
      for (let x = 0; x < L; ) {
        const d = sag(x, L);
        let e = x + 2;
        while (e < L && sag(e, L) === d) e += 2;
        wire.push(<rect key={`${k}:${x}`} x={k * L + x} y={4 + d} width={Math.min(e, L) - x} height={2} fill="var(--hm-ink)" />);
        x = e;
      }
      for (let j = 0; j < 4; j++) {
        const i = k * 4 + j, x = ((2 * j + 1) * L) / 8, B = BULBS[i % 3], [dur, delay] = TWINKLE[i % 5];
        const on = { B, h: 'rgba(255,255,255,0.55)', s: toInk(B, 0.3), c: 'var(--hm-night-3)' };
        const off = { B: toInk(B, 0.45), h: toInk(B, 0.45), s: toInk(toInk(B, 0.3), 0.45), c: 'var(--hm-night-3)' };
        const at = `translate(${Math.round(k * L + x - 4)} ${4 + sag(x, L) + 2}) scale(2)`;
        bulbs.push(
          <g key={i} transform={at}>
            <g>{pixel(BULB_ART, off)}</g>
            <g className="lb-bulb-on" style={reduced ? undefined : { animationDuration: `${dur}s`, animationDelay: `${delay}s`, animationDirection: k % 2 ? 'reverse' : 'normal' }}>{pixel(BULB_ART, on)}</g>
          </g>,
        );
      }
    }
  }
  return (
    <div className="lb-lights" ref={ref} aria-hidden="true">
      {w > 0 && (
        <svg viewBox={`0 0 ${w} 32`} preserveAspectRatio="none" shapeRendering="crispEdges">
          {wire}{hooks}{bulbs}
        </svg>
      )}
    </div>
  );
}
/** A pixel grid as rects, for drawing inside another SVG (Pix draws a whole one). */
function pixel(rows: readonly string[], colors: Record<string, string>): ReactNode[] {
  const out: ReactNode[] = [];
  rows.forEach((row, y) => [...row].forEach((ch, x) => { if (colors[ch]) out.push(<rect key={`${x},${y}`} x={x} y={y} width={1} height={1} fill={colors[ch]} />); }));
  return out;
}
