import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent } from 'react';
import { bellChime, coinClink, pageTurn } from '../../audio/sound';
import { CloseIcon } from '../components/Icons';
import { localDateKey } from '../hooks/useToday';
import { usePageHistory } from '../hooks/usePageHistory';
import { Board, Knit, Paper, Patch, Peg, Slate } from '../kit';
import { load, save } from '../../lib/storage';
import { BellArt, CoinArt, ItemArt, TabIcon } from './art';
import { CATALOG, KIND_LABEL, KIND_ONE, KINDS } from './catalog';
import type { Item, Kind } from './catalog';
import { ACHIEVEMENTS, BELLS, DAILY_CAP, levelOf, MISSIONS, titleFor } from './economy';
import type { Wallet } from './economy';
import { setMusicOverlay } from '../../audio/scene';
import { FeedSacks } from './FeedSacks';
import { stopSample } from './sample';
import { formatCoins } from './format';
import { ItemCard, ItemFrame } from './ItemCard';
import { Preview } from './Preview';
import { buyItem, equipItem, useAdminPurse, useWallet, useWalletIsAccount } from './store';

type Tab = 'sacks' | 'bells' | 'missions' | 'collection';
const TABS: { id: Tab; label: string }[] = [
  { id: 'sacks', label: 'Feed Sacks' },
  { id: 'bells', label: 'Bell Shelf' },
  { id: 'missions', label: 'Missions' },
  { id: 'collection', label: 'Barn Book' },
];
const SHORT: Record<string, string> = {
  short: 'Not enough Golden Bells yet.', owned: 'You already have that.', not_for_sale: 'That one is not for sale.', unknown: 'That item is gone.',
  offline: 'The barn could not be reached. Try again in a moment.',
};
/** A knitted progress band: amber stitches for what is done, pale ones for what is left. */
const Band = ({ value, label }: { value: number; label: string }) => (
  <span role="img" aria-label={label} className="sk-band"><Knit segments={10} filled={Math.max(0, Math.min(10, Math.round(value * 10)))} /></span>
);

/**
 * The Trading Post: the inside of the shop (docs/PLAN_TRADING_POST_REFINE.md). A dark plank wall with the shop's sign
 * hanging from the top beam, the two balances chalked on a slate, paper index tabs, and under them one strip with your
 * level. Only the tab's body scrolls, and it fades into the wall where there is more. Four tabs: Feed Sacks on the
 * counter (Wool Coins), the Bell Shelf (Golden Bells), Missions on the notice board, and the Barn Book (every item, found
 * or not, and where you wear them). Nothing is sold for money or changes how a game plays. Left and Right change tab;
 * Back, Esc and the peg go back to the farm.
 */
export function Bazaar({ onClose }: { onClose: () => void }) {
  const wallet = useWallet();
  const account = useWalletIsAccount();
  const admin = useAdminPurse();
  const [note, setNote] = useState('');
  const [tab, setTab] = useState<Tab>('sacks');
  /** The item just found or bought: its card drops into its frame once. */
  const [fresh, setFresh] = useState('');
  /** The item being looked at closely. */
  const [preview, setPreview] = useState<Item | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState({ up: false, down: false });
  usePageHistory('bazaar', onClose);
  useEffect(() => { closeRef.current?.focus({ preventScroll: true }); }, []);
  // The Trading Post has a song of its own while it is open.
  useEffect(() => { setMusicOverlay('shop'); return () => setMusicOverlay(null); }, []);
  // A fuse sound being sampled stops when its tab is left or the Trading Post is shut.
  useEffect(() => () => stopSample(), [tab]);
  useEffect(() => {
    if (!note) return;
    const t = setTimeout(() => setNote(''), 3500);
    return () => clearTimeout(t);
  }, [note]);
  useEffect(() => {
    if (!fresh) return;
    const t = setTimeout(() => setFresh(''), 1200);
    return () => clearTimeout(t);
  }, [fresh]);

  // Show that the body scrolls: a fade into the wall at whichever end has more.
  const measure = () => {
    const el = body.current;
    if (!el) return;
    const up = el.scrollTop > 4, down = el.scrollTop + el.clientHeight < el.scrollHeight - 4;
    setMore((m) => (m.up === up && m.down === down ? m : { up, down }));
  };
  useLayoutEffect(() => {
    body.current?.scrollTo({ top: 0 });
    measure();
    const el = body.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => ro.disconnect();
  }, [tab]);

  const go = (t: Tab) => {
    if (t === tab) return;
    if (t === 'collection') pageTurn();
    setTab(t);
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const el = e.target as HTMLElement;
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.closest('.sk-reveal, .sk-preview')) return;
    e.preventDefault();
    const i = TABS.findIndex((t) => t.id === tab);
    go(TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length].id);
  };

  const lv = levelOf(wallet.xp);
  const day = account ? new Date().toISOString().slice(0, 10) : localDateKey(new Date());
  const today = wallet.day === day ? Math.min(wallet.earnedToday, DAILY_CAP) : 0;
  return (
    <div className="sk-post-scrim" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="The Trading Post" className="sk-room kit-wall" onClick={(e) => e.stopPropagation()} onKeyDown={onKey}>
        <div className="sk-room-beam" aria-hidden="true" />
        <span className="sk-room-lights" aria-hidden="true">{Array.from({ length: 26 }, (_, i) => <i key={i} style={{ '--i': i } as CSSProperties} />)}</span>
        <div className="sk-room-top">
          <Board size="heading" tone="wood" hang="ropes" snow className="sk-room-sign"><h2>The Trading Post</h2></Board>
          <Slate size="mini" className="sk-purse">
            <span aria-label={`${wallet.coins} Wool Coins`} title="Wool Coins"><CoinArt /> {formatCoins(wallet.coins)}</span>
            <span aria-label={`${wallet.bells} Golden Bells`} title="Golden Bells"><BellArt /> {formatCoins(wallet.bells)}</span>
            {admin && <span className="kit-brass sk-admin-tag" title="Unlimited Wool Coins and Golden Bells in this browser">Admin</span>}
          </Slate>
          <Peg ref={closeRef} small light className="sk-room-close" onClick={onClose} aria-label="Close"><CloseIcon size={18} /></Peg>
        </div>
        <div role="tablist" aria-label="Trading Post" className="sk-room-tabs">
          {TABS.map((t) => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} tabIndex={tab === t.id ? 0 : -1} className={`sk-room-tab ${tab === t.id ? 'kit-lit' : ''}`} onClick={() => go(t.id)}>
              <TabIcon tab={t.id} />
              <span>{t.label}</span>
            </button>
          ))}
        </div>
        {/* One strip for every tab: who you are in the shop, and today's coins. */}
        <div className="sk-room-strip">
          <span className="kit-plank kit-plank--light sk-level-badge">{lv.level} · {titleFor(lv.level)}</span>
          <Band value={lv.into / lv.need} label={`${lv.need - lv.into} XP to level ${lv.level + 1}`} />
          <span className="sk-strip-xp">{formatCoins(lv.need - lv.into)} XP to level {lv.level + 1}</span>
          <span className="sk-strip-today"><CoinArt size={16} /> {today} / {DAILY_CAP} from games today</span>
        </div>
        <div className="sk-room-bodywrap">
          <div role="tabpanel" tabIndex={-1} className="sk-room-body" ref={body} onScroll={measure}>
            <div className="sk-room-content" key={tab}>
              {tab === 'sacks' && <FeedSacks wallet={wallet} onNote={setNote} onFound={setFresh} fresh={fresh} onView={setPreview} />}
              {tab === 'bells' && <BellShelf wallet={wallet} onNote={setNote} onFound={setFresh} />}
              {tab === 'missions' && <Missions wallet={wallet} />}
              {tab === 'collection' && <BarnBook wallet={wallet} onNote={setNote} fresh={fresh} onView={setPreview} />}
              <p className="sk-room-fine">Only for show: nothing here changes how a game plays. Wool Coins and Golden Bells are earned by playing, never bought.</p>
            </div>
          </div>
          <span className="kit-fade kit-fade--top" data-on={more.up || undefined} aria-hidden="true" />
          <span className="kit-fade kit-fade--bottom" data-on={more.down || undefined} aria-hidden="true" />
        </div>
        {note && <p role="status" className="sk-room-toast kit-paper kit-paper--slip">{note}</p>}
        {preview && <Preview item={preview} wallet={wallet} onClose={() => setPreview(null)} onNote={setNote} />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Bell Shelf

const SHELF_SPOTS = 6;

/**
 * A real shelf, two tiers on brackets. An item stands on it with a brass price tag hanging from the shelf's edge; once
 * bought the tag is gone and its Wear patch is there, then WEARING. Spots with nothing yet are an empty peg and a note.
 */
function BellShelf({ wallet, onNote, onFound }: { wallet: Wallet; onNote: (s: string) => void; onFound: (id: string) => void }) {
  const [busy, setBusy] = useState('');
  const items = CATALOG.filter((i) => i.source === 'bells');
  const spots: (Item | null)[] = [...items, ...Array<null>(Math.max(0, SHELF_SPOTS - items.length)).fill(null)];
  const tiers = [spots.slice(0, SHELF_SPOTS / 2), spots.slice(SHELF_SPOTS / 2)];
  const buy = async (item: Item) => {
    setBusy(item.id);
    const r = await buyItem(item.id);
    if (r.ok) { bellChime(); coinClink(); await equipItem(item.id); onFound(item.id); onNote(`${item.name} is yours, and on.`); } else onNote(SHORT[r.reason]);
    setBusy('');
  };
  return (
    <div className="sk-bells">
      <div className="sk-shelves">
        {tiers.map((tier, t) => (
          <div key={t} className="sk-tier">
            <div className="sk-tier-row">
              {tier.map((i, n) => (i
                ? <span key={i.id} className="sk-tier-item" data-owned={wallet.owned.includes(i.id) || undefined}><ItemArt item={i} size={132} /></span>
                : <span key={n} className="sk-tier-item sk-tier-empty" aria-hidden="true"><i className="kit-peg kit-peg--sm sk-tier-peg" /></span>))}
            </div>
            <span className="kit-shelf" aria-hidden="true" />
            <div className="sk-tier-row sk-tier-labels">
              {tier.map((i, n) => {
                if (!i) return <span key={n} className="sk-tier-label"><Paper kind="slip" as="span" className="sk-tier-soon">More soon</Paper></span>;
                const owned = wallet.owned.includes(i.id), worn = wallet.equipped[i.kind] === i.id, need = (i.price ?? 0) - wallet.bells;
                return (
                  <span key={i.id} className="sk-tier-label">
                    {!owned && <span className="kit-brass sk-pricetag" aria-label={`${i.price} Golden Bells`}><BellArt size={16} /> {formatCoins(i.price ?? 0)}</span>}
                    <b>{i.name}</b>
                    <span className="sk-tier-kind" title={i.blurb}>{KIND_ONE[i.kind]}</span>
                    {worn ? <span className="kit-tag kit-tag--green">Wearing</span>
                      : owned ? <Patch as="button" small tone="green" onClick={() => void equipItem(i.id).then(() => onNote(`${i.name} is on.`))}>Wear</Patch>
                      : <button type="button" className="kit-btn kit-plank kit-plank--barn sk-plankbtn sk-buy" disabled={busy === i.id || need > 0} onClick={() => void buy(i)} aria-label={`Buy ${i.name} for ${i.price} Golden Bells`}>{need > 0 ? `${need} more` : 'Buy'}</button>}
                  </span>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <p className="sk-room-hint sk-bells-earn">
        <BellArt size={16} /> +{BELLS.level} every level · +{BELLS.achievement} every milestone · +{BELLS.streak7} every 7 dream nights. Bells buy only what is on this shelf.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------- Missions

/** A notice board of pinned slips, one a mission, and under it the ledger of word milestones. */
function Missions({ wallet }: { wallet: Wallet }) {
  const missions = MISSIONS.map((m) => ({ m, item: CATALOG.find((i) => i.id === m.itemId)!, done: wallet.owned.includes(m.itemId) }))
    .sort((a, b) => Number(a.done) - Number(b.done));
  return (
    <div className="sk-missions">
      <div className="kit-cork sk-noticeboard">
        <Board size="label" tone="wood" className="sk-room-heading"><h3>Missions</h3></Board>
        <p className="sk-room-hint">Earned by playing, never in a sack. Each one is yours for good.</p>
        <div className="sk-noticeboard-slips">
          {missions.map(({ m, item, done }, n) => {
            const have = Math.min(m.have(wallet), m.need);
            return (
              <Paper key={m.id} kind="note" pin="top" seed={n + 1} tilt className="sk-mslip" data-done={done || undefined}>
                <ItemFrame item={item} size={72} className="sk-mslip-pic" />
                <b className="sk-mslip-name">{item.name}</b>
                <span className="sk-mslip-kind">{KIND_ONE[item.kind]}</span>
                <p>{m.label}</p>
                <Band value={have / m.need} label={`${have} of ${m.need}`} />
                <span className="sk-mslip-count">{have} / {m.need}</span>
                {done && <span className="sk-stamp" aria-label="Done">Done</span>}
              </Paper>
            );
          })}
        </div>
      </div>
      <Paper kind="sheet" className="kit-ruled sk-miles">
        <h3>Milestones</h3>
        <p className="sk-miles-sub">Different words played at the table. Each pays once.</p>
        <ul>
          {ACHIEVEMENTS.map((a) => {
            const done = wallet.achieved.includes(a.id), have = Math.min(a.have(wallet), a.need);
            return (
              <li key={a.id} data-done={done || undefined}>
                <span className="sk-miles-goal">{a.label}</span>
                <Band value={done ? 1 : have / a.need} label={`${have} of ${a.need}`} />
                <span className="sk-miles-count">{done ? 'Done' : `${formatCoins(have)} / ${formatCoins(a.need)}`}</span>
                <span className="sk-miles-pay"><span className="sk-pay"><CoinArt size={16} /> +{a.coins}</span><span className="sk-pay"><BellArt size={16} /> +{BELLS.achievement}</span></span>
              </li>
            );
          })}
        </ul>
      </Paper>
    </div>
  );
}

// ---------------------------------------------------------------- the Barn Book

type KindFilter = 'all' | Kind;
type FoundFilter = 'all' | 'found' | 'missing';
const FILTER_KEY = 'sap:book-filter';
const KIND_FILTERS: [KindFilter, string][] = [['all', 'All'], ...KINDS.map((k): [KindFilter, string] => [k, KIND_LABEL[k]])];
const FOUND_FILTERS: [FoundFilter, string][] = [['all', 'Everything'], ['found', 'Found'], ['missing', 'Not found']];
function readFilter(): { kind: KindFilter; found: FoundFilter } {
  const f = load<{ kind?: string; found?: string }>(FILTER_KEY, {});
  return {
    kind: KIND_FILTERS.some(([k]) => k === f.kind) ? (f.kind as KindFilter) : 'all',
    found: FOUND_FILTERS.some(([k]) => k === f.found) ? (f.found as FoundFilter) : 'all',
  };
}

/** An open book: the count on the left page, the filters on the right, then a page for each kind with its items pinned in like photographs. */
function BarnBook({ wallet, onNote, fresh, onView }: { wallet: Wallet; onNote: (s: string) => void; fresh: string; onView: (item: Item) => void }) {
  const [filter, setFilter] = useState(readFilter);
  const set = (patch: Partial<typeof filter>) => setFilter((f) => { const next = { ...f, ...patch }; save(FILTER_KEY, next); return next; });
  const found = CATALOG.filter((i) => wallet.owned.includes(i.id)).length;
  const shown = (i: Item) => (filter.found === 'all' || (filter.found === 'found') === wallet.owned.includes(i.id));
  const kinds = KINDS.filter((k) => filter.kind === 'all' || filter.kind === k);
  const any = kinds.some((k) => CATALOG.some((i) => i.kind === k && shown(i)));
  return (
    <div className="sk-book">
      <div className="kit-book sk-book-open">
        <div className="kit-book-page sk-book-count">
          <span className="sk-book-big">{found}<span> / {CATALOG.length}</span></span>
          <span className="sk-book-found">found in the Barn Book</span>
          <Band value={found / CATALOG.length} label={`${found} of ${CATALOG.length} found`} />
        </div>
        <div className="kit-book-page sk-book-filters">
          <div role="group" aria-label="Show which kind">
            {KIND_FILTERS.map(([k, label]) => <Patch key={k} as="button" small pressed={filter.kind === k} tone={filter.kind === k ? 'gold' : 'cream'} onClick={() => set({ kind: k })}>{label}</Patch>)}
          </div>
          <div role="group" aria-label="Show found or not found">
            {FOUND_FILTERS.map(([k, label]) => <Patch key={k} as="button" small pressed={filter.found === k} tone={filter.found === k ? 'gold' : 'cream'} onClick={() => set({ found: k })}>{label}</Patch>)}
          </div>
        </div>
      </div>
      {kinds.map((k) => {
        const all = CATALOG.filter((i) => i.kind === k), items = all.filter(shown);
        if (!items.length) return null;
        return (
          <Paper key={k} kind="sheet" className="sk-book-sheet" aria-label={KIND_LABEL[k]}>
            <h3>{KIND_LABEL[k]} <span>{all.filter((i) => wallet.owned.includes(i.id)).length} of {all.length}</span></h3>
            <div className="sk-grid sk-grid--page">
              {items.map((i) => <ItemCard key={i.id} item={i} wallet={wallet} onNote={onNote} fresh={fresh === i.id} onView={onView} />)}
            </div>
          </Paper>
        );
      })}
      {!any && <Paper kind="sheet" className="sk-book-sheet"><p className="sk-book-none">Nothing to show with these filters.</p></Paper>}
    </div>
  );
}
