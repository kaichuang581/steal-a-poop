import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { NoToneMapping, SRGBColorSpace } from 'three';
import type { PerspectiveCamera } from 'three';
import { bellChime, burlapRustle, coinClink, pageTurn, reelDing } from '../../audio/sound';
import { setMusicOverlay } from '../../audio/scene';
import { useStore } from '../../state/store';
import { useMotionLevel } from '../hooks/useAmbient';
import { localDateKey } from '../hooks/useToday';
import { usePageHistory } from '../hooks/usePageHistory';
import { CATALOG } from './catalog';
import type { Item, Kind } from './catalog';
import { BELLS, DAILY_CAP, levelOf, MISSIONS, titleFor } from './economy';
import { formatCoins } from './format';
import { RARITIES } from './rarity';
import { poolFor, SACKS } from './sacks';
import type { SackId } from './sacks';
import { SOUND_OFF_NOTE } from './sample';
import { buyItem, equipItem, holdWalletView, openFeedSack, releaseWalletView, useAdminPurse, useWallet, useWalletIsAccount } from './store';
import { placeShiftCamera } from '../tp/camera';
import type { ShiftView } from '../tp/camera';
import { listen as listenTo, stopListening } from '../tp/listen';
import { MarketWorld } from '../tp/market/MarketWorld';
import { STOP_X, STOPS } from '../tp/market/world';
import type { StopId } from '../tp/market/world';
import { Anchors, EASE, Icon, Knit, TP_COLOURS, useCountTo } from '../tp/market/pieces';
import type { Tick } from '../tp/market/pieces';
import { FeedSacksRoll, OpenButton, RevealTag, SacksStop } from '../tp/market/stops/FeedSacks';
import type { Reveal } from '../tp/market/stops/FeedSacks';
import { BellShelfRoll, BellsStop } from '../tp/market/stops/BellShelf';
import { MissionsRoll, MissionsStop } from '../tp/market/stops/Missions';
import { BookStop } from '../tp/market/stops/BarnBook';
import { CloseView } from '../tp/market/stops/CloseView';
import { TIMINGS } from '../tp/models.gen';
import { MARKET } from '../tp/market.gen';
import { getLang } from '../../lib/lang';
import '../tp/market/market.css';

/**
 * The Trading Post (docs/trading-post-practice, T1 to T7): a market row on the farm at dusk, four stops side by side,
 * walked along by a level camera. The scene is three.js (tp/market/MarketWorld.ts); every word is HTML laid over it at
 * a projected point: paper tags on yarn, chalk on the odds board, lantern and wool tiles. Every rule, price and number
 * is read from the shop's own modules (sacks.ts, economy.ts, store.ts), as before. Code names stay `Bazaar`.
 */
const TABS: { id: StopId; label: string; icon: string }[] = [
  { id: 'sacks', label: 'Feed Sacks', icon: 'sack' },
  { id: 'bells', label: 'Bell Shelf', icon: 'bell' },
  { id: 'missions', label: 'Missions', icon: 'pin' },
  { id: 'book', label: 'Barn Book', icon: 'book' },
];
const SHORT: Record<string, string> = {
  short: 'Not enough Golden Bells yet.', owned: 'You already have that.', not_for_sale: 'That one is not for sale.', unknown: 'That item is gone.',
  offline: 'The barn could not be reached. Try again in a moment.',
};
/** Opening the Trading Post lands on the stop last visited this session (X2 choice 4). */
let lastStop: StopId = 'sacks';
/** Missions seen done this session: the tab's dot shows until a finished mission is looked at (no new saved key). */
let seenDone: string[] = [];

// ---------------------------------------------------------------- the screen


export function Bazaar({ onClose }: { onClose: () => void }) {
  const wallet = useWallet();
  const account = useWalletIsAccount();
  const admin = useAdminPurse();
  const reduced = useMotionLevel() === 'reduced';
  const [size, setSize] = useState({ W: innerWidth, H: innerHeight });
  useEffect(() => { const on = () => setSize({ W: innerWidth, H: innerHeight }); addEventListener('resize', on); return () => removeEventListener('resize', on); }, []);
  // Phones, and any window taller than wide (a tablet held upright): the band at the top and the paper roll under it (T1
  // section 7). The computer layout scales the row by min(W / 1440, H / 900), which left a portrait tablet a thin strip
  // under an empty sky.
  const { W, H } = size, phone = W < 600 || W < H;
  const [stop, setStop] = useState<StopId>(lastStop);
  const [sack, setSack] = useState<SackId>('bomb');
  const [bookKind, setBookKind] = useState<Kind>('bomb');
  const [bookPage, setBookPage] = useState(0);
  const [focus, setFocus] = useState<Item | null>(null);
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const revealRef = useRef(reveal);
  revealRef.current = reveal;
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [swing, setSwing] = useState(0);
  const [seen, setSeen] = useState<string[]>(seenDone);
  const now = () => performance.now();

  const world = useRef<MarketWorld | null>(null);
  const ticks = useMemo(() => new Set<Tick>(), []);
  const view = useRef<ShiftView>(baseView(stop, W, H, phone, bookPage));
  usePageHistory('bazaar', onClose, () => { if (reveal) { if (reveal.done) finishReveal(); return true; } if (focus) { setFocus(null); return true; } return false; });
  useEffect(() => { setMusicOverlay('shop'); return () => { setMusicOverlay(null); stopListening(); }; }, []);
  useEffect(() => { lastStop = stop; stopListening(); setFocus(null); }, [stop]);
  useEffect(() => { if (!note) return; const t = setTimeout(() => setNote(''), 3500); return () => clearTimeout(t); }, [note]);

  // What the scene shows.
  const pool = useMemo(() => [...poolFor(sack)].sort((a, b) => RARITIES.indexOf(a.rarity ?? 'common') - RARITIES.indexOf(b.rarity ?? 'common')), [sack]);
  const shelfItems = useMemo(() => CATALOG.filter((i) => i.source === 'bells'), []);
  const missionItems = useMemo(() => MISSIONS.map((m) => CATALOG.find((i) => i.id === m.itemId)!), []);
  const bookItems = useMemo(() => CATALOG.filter((i) => i.kind === bookKind), [bookKind]);
  const ownedKey = wallet.owned.join();
  const onScene = (w: MarketWorld) => {
    world.current = w;
    if (import.meta.env.DEV) (window as unknown as { __tpWorld: MarketWorld }).__tpWorld = w;
    w.setPicked(sack, now()); w.setBench(pool, now()); w.setShelf(shelfItems); w.setMissions(missionItems);
    w.setBook(bookKind, bookItems.map((item) => ({ item, found: wallet.owned.includes(item.id) })), now());
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const worldObj = useMemo(() => new MarketWorld(), []);
  // The world the canvas draws is the one the page drives: React may build the memo twice in development, and filling
  // the ref inside it pointed the page at a copy nobody saw (the Barn Book kept its first page's models).
  if (world.current !== worldObj) onScene(worldObj);
  useEffect(() => { world.current?.setPicked(sack, now()); world.current?.setBench(pool, now()); }, [sack, pool]);
  useEffect(() => { world.current?.setBook(bookKind, bookItems.map((item) => ({ item, found: wallet.owned.includes(item.id) })), now()); }, [bookKind, bookItems, ownedKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (world.current) world.current.focus = focus ? { id: focus.id, at: now() } : null; if (!focus) world.current?.stopShow(); }, [focus]);

  // Where the camera goes: the stop; pushed in on the counter in a reveal, on an item in the close view.
  const target = useMemo(() => {
    const v = baseView(stop, W, H, phone, bookPage);
    let ms: number = Math.abs(STOPS.indexOf(stop) - STOPS.indexOf(stopAtX(view.current.cx))) > 1 ? TIMINGS.trading_post.walk_between_stops.further_ms : TIMINGS.trading_post.walk_between_stops.next_door_ms;
    if (reveal) {
      const A = v.A * 1.6;
      return { v: { ...v, A, cx: 0.25, line: (phone ? 0.38 : 0.55) + (A * 1.3) / H }, ms: 250 };
    }
    const at = focus && world.current?.whereIs(focus.id, stop);
    if (at) {
      const A = v.A * 2.2;
      ms = 300;
      return { v: { ...v, A, cx: at.x + (phone ? 0 : 0.35 * (W / A) * 0.25), line: (phone ? 0.24 : 0.5) + (A * (at.y + at.h / 2)) / H }, ms };
    }
    return { v, ms };
  }, [stop, W, H, phone, bookPage, reveal, focus]);

  const go = (s: StopId) => { if (s === stop) return; if (s === 'book') pageTurn(); setStop(s); setSwing((n) => n + 1); if (s === 'missions') markSeen(); };
  const step = (d: number) => go(STOPS[(STOPS.indexOf(stop) + d + STOPS.length) % STOPS.length]);
  // On a phone the Barn Book shows one page: a swipe turns to the other page before it walks on (T6 section 5).
  const swiped = (d: number) => { if (stop === 'book' && (d > 0 ? bookPage === 0 : bookPage === 1)) { pageTurn(); setBookPage(d > 0 ? 1 : 0); } else step(d); };
  const markSeen = () => { const done = MISSIONS.filter((m) => wallet.owned.includes(m.itemId)).map((m) => m.id); setSeen(done); seenDone = done; };
  const missionDot = MISSIONS.some((m) => wallet.owned.includes(m.itemId) && !seen.includes(m.id));
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (reveal || focus) return;
      const el = e.target as HTMLElement;
      if (el.tagName === 'INPUT') return;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); step(e.key === 'ArrowRight' ? 1 : -1); }
    };
    addEventListener('keydown', key);
    return () => removeEventListener('keydown', key);
  });
  const swipe = useRef<number | null>(null);

  // ---- Feed Sacks: picking and opening.
  const pick = (s: SackId) => { if (s !== sack) { burlapRustle(); setSack(s); } };
  const open = async () => {
    if (busy || reveal) return;
    setBusy(true);
    holdWalletView();
    const r = await openFeedSack(sack);
    setBusy(false);
    if (!r.ok) {
      releaseWalletView();
      setNote(r.reason === 'short' ? 'Not enough Wool Coins yet.' : r.reason === 'complete' ? `You have everything in the ${SACKS[sack].name}.` : SHORT.offline);
      return;
    }
    coinClink();
    const item = CATALOG.find((i) => i.id === r.entry.itemId)!;
    const at = now();
    world.current?.startReveal({ sack, item, tier: r.entry.tier, duplicate: r.entry.duplicate, at: reduced ? at - 1600 : at });
    setReveal({ entry: r.entry, item, at, done: reduced });
  };
  // The reveal lands at 1,600 ms; any tap or key skips to the end.
  useEffect(() => {
    if (!reveal || reveal.done) return;
    const t = setTimeout(() => land(), Math.max(0, 1600 - (now() - reveal.at)));
    return () => clearTimeout(t);
  }, [reveal]); // eslint-disable-line react-hooks/exhaustive-deps
  const land = () => {
    const r = revealRef.current;
    if (!r || r.done) return;
    world.current?.startReveal({ sack, item: r.item, tier: r.entry.tier, duplicate: r.entry.duplicate, at: now() - 1600 });
    releaseWalletView();
    // One sound for every rarity: the light's colour already says how rare it is (T5 section 5).
    reelDing(0);
    if (r.item.kind === 'tick') setTimeout(() => listenTo(r.item.id), 400);
    setReveal({ ...r, done: true });
  };
  const finishReveal = () => { world.current?.endReveal(); stopListening(); setReveal(null); };
  const wearRevealed = async () => { if (!reveal) return; await equipItem(reveal.item.id); setNote(`${reveal.item.name} is on.`); finishReveal(); };

  // ---- Bell Shelf.
  const buy = async (item: Item) => {
    setBusy(true);
    const r = await buyItem(item.id);
    setBusy(false);
    if (r.ok) { bellChime(); world.current?.swingBell(now(), item.id); setNote(`${item.name} is yours.`); } else setNote(SHORT[r.reason]);
  };
  const wear = async (item: Item) => { await equipItem(item.id); setNote(`${item.name} is on.`); };
  const listen = (item: Item) => { if (useStore.getState().muted) { setNote(SOUND_OFF_NOTE); return; } listenTo(item.id, world.current?.modelOf(item.id)); };

  const lv = levelOf(wallet.xp);
  const day = account ? new Date().toISOString().slice(0, 10) : localDateKey(new Date());
  const today = wallet.day === day ? Math.min(wallet.earnedToday, DAILY_CAP) : 0;
  const coins = useCountTo(wallet.coins), bells = useCountTo(wallet.bells);
  const u = phone ? 0.86 : Math.max(0.62, Math.min(1.4, Math.min(W / 1440, H / 900)));
  const anchors = useMemo(() => ({ add: (t: Tick) => { ticks.add(t); return () => { ticks.delete(t); }; }, view: () => view.current }), [ticks]);

  return (
    <div role="dialog" aria-modal="true" aria-label="The Trading Post" className="tp" data-phone={phone || undefined} data-reduced={reduced || undefined} data-focus={focus ? "" : undefined} data-lang={getLang()} style={{ ...TP_COLOURS, '--u': u } as CSSProperties}
      onPointerDown={(e) => { if (phone) swipe.current = e.clientX; }}
      onPointerUp={(e) => { if (phone && swipe.current !== null && !reveal && !focus && Math.abs(e.clientX - swipe.current) > 60 && (e.clientY < H * 0.45 || stop === 'book')) swiped(e.clientX < swipe.current ? 1 : -1); swipe.current = null; }}>
      <div className="tp-sky" aria-hidden="true" />
      <Canvas className="tp-canvas" camera={{ manual: true, near: 0.5, far: 300 }} dpr={[1, 1.5]} gl={{ alpha: false, antialias: true, outputColorSpace: SRGBColorSpace, toneMapping: NoToneMapping }} style={{ position: 'absolute', inset: 0 }}>
        <Driver world={worldObj} view={view} target={target} ticks={ticks} reduced={reduced} />
      </Canvas>
      <Anchors.Provider value={anchors}>
        <div className="tp-layer" onClick={() => { if (reveal && !reveal.done) land(); }}>
          {stop === 'sacks' && <SacksStop {...{ wallet, sack, pool, pick, focus, setFocus, reveal, phone, listen }} />}
          {stop === 'bells' && <BellsStop {...{ wallet, items: shelfItems, buy, wear, busy, setFocus, phone }} />}
          {stop === 'missions' && !phone && <MissionsStop wallet={wallet} items={missionItems} />}
          {stop === 'book' && <BookStop {...{ wallet, kind: bookKind, items: bookItems, setFocus, phone, page: bookPage }} flip={() => { pageTurn(); setBookPage(bookPage ? 0 : 1); }} turn={(k) => { if (k !== bookKind) { pageTurn(); setBookKind(k); setBookPage(0); } }} />}
          {focus && <CloseView item={focus} wallet={wallet} world={world} stop={stop} phone={phone} onWear={wear} onListen={listen} onClose={() => setFocus(null)} />}
          {reveal && <RevealTag reveal={reveal} wallet={wallet} onWear={() => void wearRevealed()} onDone={finishReveal} phone={phone} />}
        </div>
      </Anchors.Provider>
      {focus && <button type="button" className="tp-dim" aria-label="Step back" onClick={() => setFocus(null)} />}

      <header className="tp-top">
        {!phone && <h2 className="tp-title">The Trading Post</h2>}
        <div className="tp-yarn" role="tablist" aria-label="The Trading Post" key={swing} data-swing={swing > 0 || undefined}>
          {TABS.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={stop === t.id} tabIndex={stop === t.id ? 0 : -1} className="tp-tab" data-on={stop === t.id || undefined} onClick={() => go(t.id)}
              onKeyDown={(e) => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); step(e.key === 'ArrowRight' ? 1 : -1); } }}>
              <i className="tp-peg" aria-hidden="true" />
              <Icon name={t.icon} size={phone ? 18 : 16} /><span>{t.label}</span>
              {t.id === 'missions' && missionDot && <b className="tp-dot" aria-label="A mission is done" />}
            </button>
          ))}
        </div>
        <div className="tp-wallet">
          <span className="tp-wool" aria-label={`${wallet.coins} Wool Coins`} title="Wool Coins"><Icon name="coin" size={20} />{formatCoins(coins)}</span>
          <span className="tp-wool" aria-label={`${wallet.bells} Golden Bells`} title="Golden Bells"><Icon name="bell" size={20} />{formatCoins(bells)}</span>
          {admin && <span className="tp-wool tp-admin" title="Unlimited Wool Coins and Golden Bells in this browser">Admin</span>}
          <button type="button" className="tp-wool tp-close" onClick={onClose} aria-label="Close"><Icon name="cross" size={16} /></button>
          {phone && <span className="tp-today-phone">{`${today} / ${DAILY_CAP} today`}</span>}
        </div>
      </header>

      {!reveal && !focus && !phone && stop === 'sacks' && <OpenButton wallet={wallet} sack={sack} busy={busy} onOpen={() => void open()} />}
      {!reveal && !focus && !phone && stop === 'bells' && <p className="tp-note tp-note--wide"><Icon name="bell" size={18} /><span>{`Golden Bells: +${BELLS.level} every level, +${BELLS.achievement} every milestone, +${BELLS.streak7} every 7 dream nights.`}<br />Bells buy only what is on this shelf.</span></p>}
      {!reveal && !focus && !phone && stop === 'missions' && <p className="tp-note"><Icon name="pin" size={16} /><span>Missions are earned by playing, never found in a sack. Each one is yours for good.</span></p>}
      {phone && !reveal && !focus && stop !== 'book' && (
        <div className="tp-roll-wrap">
          {stop === 'sacks' && <FeedSacksRoll {...{ wallet, sack, pool, listen }} />}
          {stop === 'bells' && <BellShelfRoll {...{ wallet, items: shelfItems, buy, wear, busy }} />}
          {stop === 'missions' && <MissionsRoll wallet={wallet} items={missionItems} />}
          {stop === 'sacks' && <OpenButton wallet={wallet} sack={sack} busy={busy} onOpen={() => void open()} />}
        </div>
      )}

      <footer className="tp-foot">
        <div className="tp-strip">
          <span className="tp-level">{`Level ${lv.level}: ${titleFor(lv.level)}`}</span>
          <Icon name="yarn" size={18} />
          <Knit value={lv.into / lv.need} label={`${lv.need - lv.into} XP to level ${lv.level + 1}`} />
          {!phone && <span className="tp-xp">{`${formatCoins(lv.need - lv.into)} XP to level ${lv.level + 1}`}</span>}
          {!phone && <span className="tp-today"><Icon name="coin" size={16} />{`${today} / ${DAILY_CAP} from games today`}</span>}
        </div>
        {!phone && <p className="tp-fine">Only for show: nothing here changes how a game plays. Wool Coins and Golden Bells are earned by playing, never bought.</p>}
      </footer>
      {note && <p role="status" className="tp-toast">{note}</p>}
    </div>
  );
}

const stopAtX = (x: number): StopId => STOPS.reduce((best, s) => (Math.abs(STOP_X[s] - x) < Math.abs(STOP_X[best] - x) ? s : best), 'sacks' as StopId);

/** A stop's camera (T1 section 2; phones, section 7; the Barn Book on a phone frames one page). */
function baseView(stop: StopId, W: number, H: number, phone: boolean, page: number): ShiftView {
  const c = MARKET.cameras[stop], k = Math.min(W / 1440, H / 900);
  const v: ShiftView = { A: c.A * k, W, H, eye: MARKET.eye_height_m, cam: MARKET.camera_distance_m, line: c.lane, cx: c.cx };
  if (!phone) return v;
  if (stop === 'book') {
    // One page (1.85 m wide) fills the space between the bookmarks' row (under the tabs) and the level strip: from the
    // page head (2.95 m) to the table's foot (0.25 m), as wide as the window allows (T6 section 5).
    const top = 205, bottom = H - 64, A = Math.min((W * 0.94) / 1.9, (bottom - top) / 2.7);
    return { ...v, A, cx: STOP_X.book + (page ? 0.95 : -0.95), line: (top + A * 2.95) / H };
  }
  // 0.22 x W on a phone (86 at 390); a tablet held upright is capped by its height, or the stall rises under the tabs.
  return { ...v, A: Math.min(0.22 * W, 0.105 * H), line: 0.47 };
}


function Driver({ world, view, target, ticks, reduced }: { world: MarketWorld; view: React.MutableRefObject<ShiftView>; target: { v: ShiftView; ms: number }; ticks: Set<Tick>; reduced: boolean }) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const scene = useThree((s) => s.scene);
  useEffect(() => { scene.fog = world.fog; scene.background = world.sky; }, [scene, world]);
  const tw = useRef({ from: view.current, to: target.v, t0: 0, ms: 0 });
  useEffect(() => { tw.current = { from: { ...view.current }, to: target.v, t0: performance.now(), ms: reduced ? 0 : target.ms }; }, [target, reduced, view]);
  useFrame(() => {
    const now = performance.now(), t = tw.current, k = t.ms ? EASE(Math.min(1, (now - t.t0) / t.ms)) : 1;
    const f = t.from, g = t.to;
    view.current = { ...g, A: f.A + (g.A - f.A) * k, cx: f.cx + (g.cx - f.cx) * k, line: f.line + (g.line - f.line) * k };
    placeShiftCamera(camera, view.current);
    if (import.meta.env.DEV) (window as unknown as { __tpCam: unknown }).__tpCam = camera;
    world.update(now, view.current, reduced);
    for (const tick of ticks) tick(view.current);
  });
  return <primitive object={world.root} />;
}
