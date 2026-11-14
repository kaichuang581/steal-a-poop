import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { burlapRustle, fanfare, leverPull, reelClick, reelDing } from '../../audio/sound';
import { CloseIcon } from '../components/Icons';
import { useMotionLevel } from '../hooks/useAmbient';
import { Board, Patch, Peg, Slate } from '../kit';
import { CoinArt, ItemArt, KnobArt, Rays, stallArt } from './art';
import { itemById, KIND_LABEL, KIND_ONE, TICK_VOICE } from './catalog';
import type { Item, Rarity } from './catalog';
import type { SackEntry, Wallet } from './economy';
import { formatCoins } from './format';
import { ItemCard, ItemFrame, ItemTag } from './ItemCard';
import { RARITIES, RARITY_COLOR, RARITY_LABEL } from './rarity';
import { sackComplete, tierFor } from './roll';
import { oddsLine, poolFor, poolOf, SACK, SACK_IDS, SACKS } from './sacks';
import type { SackId } from './sacks';
import { playSample, stopSample } from './sample';
import { CRATE_BOX, DEPTH, frame, LANTERN_BOX, rise, STALL_PITCH, STALLS, valanceBox } from './stallPlan';
import type { StallSize } from './stallPlan';
import { equipItem, holdWalletView, openFeedSack, releaseWalletView } from './store';

const rarityVar = (r: Rarity | undefined) => ({ '--rarity': RARITY_COLOR[r ?? 'common'] }) as CSSProperties;
const byRarity = (a: Item, b: Item) => RARITIES.indexOf(a.rarity ?? 'common') - RARITIES.indexOf(b.rarity ?? 'common');

/**
 * Feed Sacks (docs/PLAN_TRADING_POST_V2.md Part 3, laid out by docs/PLAN_TRADING_POST_REFINE.md Part 4), three of them
 * and never mixed: the Oat Sack holds bomb skins, the Corn Sack bursts, the Barley Sack fuse sounds. They stand in
 * crates on a market stall's counter (Stall); the picked one's crate stands forward under the lantern. Below: what is
 * inside, in one even grid from common to legendary, and the odds chalked on a slate over the one way to spend Wool
 * Coins. Every number here (price, odds, pity, refunds) is read from sacks.ts, the object the roll uses.
 */
export function FeedSacks({ wallet, onNote, onFound, fresh, onView }: { wallet: Wallet; onNote: (s: string) => void; onFound: (id: string) => void; fresh: string; onView: (item: Item) => void }) {
  const [sack, setSack] = useState<SackId>('bomb');
  const [machine, setMachine] = useState<SackId | null>(null);
  const pick = (id: SackId) => { if (id !== sack) burlapRustle(); setSack(id); };
  return (
    <div className="sk-sacks">
      <Stall sack={sack} wallet={wallet} onPick={pick} />
      <Board size="label" tone="wood" className="sk-room-heading"><h3>Inside the {SACKS[sack].name}</h3></Board>
      <div className="sk-sack-main">
        <section className="sk-grid" aria-label={`Inside the ${SACKS[sack].name}`}>
          {[...poolFor(sack)].sort(byRarity).map((i) => <ItemCard key={i.id} item={i} wallet={wallet} onNote={onNote} fresh={fresh === i.id} onView={onView} />)}
        </section>
        <OddsSlate sack={sack} wallet={wallet} onOpen={() => setMachine(sack)} />
      </div>
      {machine && <Machine sack={machine} wallet={wallet} onClose={() => setMachine(null)} onNote={onNote} onFound={onFound} />}
    </div>
  );
}

/** Which stall a window gets (stallPlan.ts STALLS): a phone's, a tablet's, a short window's, or the desktop's. First match wins. */
const STALL_FOR: readonly [StallSize, string][] = [['narrow', '(max-width: 479px)'], ['mid', '(max-width: 760px)'], ['low', '(max-height: 940px)']];
const stallSize = (): StallSize => STALL_FOR.find(([, q]) => typeof window !== 'undefined' && window.matchMedia?.(q).matches)?.[0] ?? 'wide';
function useStallSize(): StallSize {
  const [size, setSize] = useState(stallSize);
  useEffect(() => {
    const lists = STALL_FOR.map(([, q]) => window.matchMedia?.(q)).filter(Boolean) as MediaQueryList[];
    const on = () => setSize(stallSize());
    lists.forEach((l) => l.addEventListener('change', on));
    return () => lists.forEach((l) => l.removeEventListener('change', on));
  }, []);
  return size;
}

/**
 * The market stall (Brian, 2026-11-13: "turn the counter into a market stall"). One baked voxel picture is the stall
 * itself: a red and cream awning with snow on it, two posts, back shelves of stock, a boarded counter, a barrel and
 * crates on the floor (stallModels.ts). Laid over it, each at the place stallPlan.ts gives it: the three sacks in their
 * crates (each a radio button, with its tag), the one lantern, the awning's edge, and the chalk on the sign. Everything
 * is placed in percent of the stall's box, so it all holds together at any width.
 */
function Stall({ sack, wallet, onPick }: { sack: SackId; wallet: Wallet; onPick: (id: SackId) => void }) {
  const size = useStallSize();
  const p = STALLS[size], f = frame(p);
  const wide = (v: number) => `${(v / f.w) * 100}%`, tall = (rows: number) => `${(rows / f.h) * 100}%`, up = (row: number) => tall(row - f.bottom);
  const at = SACK_IDS.indexOf(sack);
  // A crate's picture starts a little under its front foot; its button runs from the picture's top down to the floor, so the tag is in it.
  const foot = rise(p.top, DEPTH.crateRest), boxTop = foot - CRATE_BOX.below + CRATE_BOX.h, rows = boxTop - f.bottom;
  // The nail a tag hangs from: in the rail under the plank, the same height for all three.
  const nail = rise(p.panel - 1, DEPTH.front + 1);
  const edge = valanceBox(p);
  // The lantern's ring is a row under the awning's edge, by the picked sack's shoulder.
  const ring = edge.bottom - 0.8;
  const sign = p.sign;
  return (
    <div className="sk-stall" data-size={size} role="radiogroup" aria-label="Choose a sack" style={{ aspectRatio: `${f.w} / ${f.h}` }}>
      <img className="sk-thumb sk-stall-back" src={stallArt(size)} alt="" draggable={false} />
      {sign && (
        <span className="sk-stall-sign kit-chalk-hand" data-lines={sign.lines} style={{ left: wide(sign.x + 1), bottom: up(rise(sign.y + 1, 2)), width: wide(sign.w - 2), height: tall((sign.h - 2) * Math.cos(STALL_PITCH)) }}>
          <span>Feed Sacks</span><i aria-hidden="true">·</i><span><CoinArt size={15} /> {formatCoins(SACK.price)} each</span>
        </span>
      )}
      {SACK_IDS.map((id, n) => (
        <StallSack key={id} sack={id} wallet={wallet} picked={sack === id} onPick={() => onPick(id)} tilt={n + 1}
          style={{ left: wide(p.crates[n] - CRATE_BOX.w / 2), width: wide(CRATE_BOX.w), bottom: 0, height: tall(rows) }}
          art={`${(CRATE_BOX.h / rows) * 100}%`} tag={`${((boxTop - nail) / rows) * 100}%`} />
      ))}
      <span className="sk-stall-lantern" aria-hidden="true" style={{ left: wide(p.crates[at] + p.lantern[at] * 8 - LANTERN_BOX.w / 2), width: wide(LANTERN_BOX.w), bottom: up(ring + LANTERN_BOX.above - LANTERN_BOX.h), height: tall(LANTERN_BOX.h) }}>
        <span key={sack}><i className="kit-string" /><img className="sk-thumb" src={stallArt('lantern')} alt="" draggable={false} /></span>
      </span>
      {/* The awning's edge, in two halves that hang from the posts' ends: it sags and lifts in the middle. */}
      <span className="sk-stall-valance" aria-hidden="true" style={{ bottom: up(edge.bottom), height: tall(edge.h) }}>
        <i style={{ backgroundImage: `url(${stallArt(`${size}-valance`)})` }} /><i style={{ backgroundImage: `url(${stallArt(`${size}-valance`)})` }} />
      </span>
    </div>
  );
}

/**
 * One sack in its crate on the stall, and its tag: one radio button. The crate and the sack are two pictures (the sack
 * cut off where its crate stands in front of it), so a hover can wobble the sack in the crate. The picked one's crate
 * stands 8 px forward in the lantern's light; the others sit back in less. The tag, with the sack's name, what is in it
 * and how much of that is found, hangs by 12 px of string from a nail in the stall's front, right under the crate.
 */
function StallSack({ sack, wallet, picked, onPick, tilt, style, art, tag }: { sack: SackId; wallet: Wallet; picked: boolean; onPick: () => void; tilt: number; style: CSSProperties; art: string; tag: string }) {
  const pool = [...poolFor(sack)].sort(byRarity);
  const found = pool.filter((i) => wallet.owned.includes(i.id)).length;
  return (
    <button type="button" role="radio" aria-checked={picked} className="sk-stall-sack" style={style} onClick={onPick} aria-label={`${SACKS[sack].name}: ${KIND_LABEL[sack].toLowerCase()}, ${found} of ${pool.length} found`}>
      <span className="sk-stall-art" style={{ height: art }}>
        <img className="sk-thumb" src={stallArt(`crate-${sack}`)} alt="" draggable={false} />
        <img className="sk-thumb sk-stall-burlap" src={stallArt(`sack-${sack}`)} alt="" draggable={false} />
      </span>
      <span className="sk-stall-hang" style={{ top: tag }}>
        <i className="kit-nail" aria-hidden="true" /><i className="kit-string" aria-hidden="true" />
        <span className={`sk-stall-tag kit-paper kit-paper--tilt-${tilt}`} data-seed={tilt}>
          <span className="sk-stall-name">{SACKS[sack].name}</span>
          <span className="sk-stall-found"><span className="sk-stall-kind">{KIND_LABEL[sack]} · </span>{found} of {pool.length} found</span>
          <span className="sk-pips">
            {pool.map((i) => <i key={i.id} title={`${i.name} (${RARITY_LABEL[i.rarity ?? 'common']})${wallet.owned.includes(i.id) ? ', found' : ''}`} style={{ '--pip': RARITY_COLOR[i.rarity ?? 'common'] } as CSSProperties} data-found={wallet.owned.includes(i.id) || undefined} />)}
          </span>
        </span>
      </span>
    </button>
  );
}

function OddsSlate({ sack, wallet, onOpen }: { sack: SackId; wallet: Wallet; onOpen: () => void }) {
  const info = SACKS[sack];
  const complete = sackComplete(sack, wallet.owned);
  const short = wallet.coins < SACK.price;
  const pity = wallet.pity[sack];
  const rareIn = Math.max(1, SACK.pity.rare - pity.sinceRare), legIn = Math.max(1, SACK.pity.legendary - pity.sinceLegendary);
  return (
    <aside className="sk-odds" aria-label="Odds and opening">
      <Slate size="board" className="sk-odds-slate">
        <h4 className="kit-chalk-hand">The odds</h4>
        <div className="sk-odds-bar" role="img" aria-label={oddsLine()}>
          {RARITIES.map((r) => <span key={r} style={{ ...rarityVar(r), flexGrow: SACK.odds[r] }} />)}
        </div>
        <ul className="sk-odds-key">
          {RARITIES.map((r) => <li key={r} style={rarityVar(r)}><i />{RARITY_LABEL[r]}<b>{SACK.odds[r]}%</b></li>)}
        </ul>
        <PityRow label="Rare or better" left={rareIn} of={SACK.pity.rare} rarity="rare" />
        <PityRow label="Legendary" left={legIn} of={SACK.pity.legendary} rarity="legendary" />
      </Slate>
      <button type="button" className={`kit-btn kit-plank kit-plank--barn sk-plankbtn sk-open ${complete || short ? '' : 'kit-pulse'}`} onClick={onOpen} disabled={complete || short} aria-label={complete ? `All found in the ${info.name}` : `Open the ${info.name} for ${SACK.price} Wool Coins`}>
        {complete ? 'All found' : short ? <>Need <CoinArt /> {formatCoins(SACK.price)}</> : <>Open <CoinArt /> {formatCoins(SACK.price)}</>}
      </button>
      <p className="sk-room-hint">
        {complete ? `You have everything in the ${info.name}.` : short ? `You have ${formatCoins(wallet.coins)}. Coins come from playing.` : 'One random item. A repeat pays coins back; rare and legendary never repeat.'}
      </p>
    </aside>
  );
}

/** How near a guaranteed tier is: chalk strokes that fill as sacks go by without one. */
function PityRow({ label, left, of, rarity }: { label: string; left: number; of: number; rarity: Rarity }) {
  const ticks = 10, filled = Math.round(((of - left) / (of - 1)) * ticks);
  return (
    <div className="sk-pity" style={rarityVar(rarity)} role="img" aria-label={`${label} guaranteed within ${left} sack${left === 1 ? '' : 's'}`}>
      <span>{label}</span>
      <b>{left === 1 ? 'next sack' : `within ${left}`}</b>
      <span className="sk-pity-bar">{Array.from({ length: ticks }, (_, i) => <i key={i} data-on={i < filled || undefined} />)}</span>
    </div>
  );
}

// ---------------------------------------------------------------- the fair machine

/** The reel's measurements: `tile` px a tile (matches .sk-reel-tile), `strip` tiles long, landing on `stop`, the first `lead` on show before the pull. */
export const REEL = { tile: 104, strip: 38, stop: 31, lead: 7, rest: 3 } as const;
const SPIN_MS = 3800;
const BULBS = 13;
/**
 * How often a result short of legendary has something rarer planted beside it, with the reel stopping close to it
 * (Brian, 2026-11-12: he asked for the near miss, then for it "less frequent ... make it also go close to other stuff too").
 * The rest of the time the reel stops anywhere in the tile, so it is often near an edge beside whatever happens to be there.
 */
export const NEAR_MISS = 0.15;
const TIER_INDEX: Record<Rarity, number> = { common: 0, uncommon: 1, rare: 2, legendary: 3 };

/** `lean` is where in the result tile the pointer rests, from -0.45 (its left edge) to 0.45 (its right). */
export interface Reel { tiles: Item[]; nearMiss: boolean; lean: number }

const pickFrom = (sack: SackId, tier: Rarity, rand: () => number): Item => {
  const p = poolOf(sack, tier);
  return p[Math.floor(rand() * p.length)] ?? poolFor(sack)[0];
};
/** The tiles on show before the lever is pulled: the sack's items at the sack's odds. */
export const idleTiles = (sack: SackId, rand: () => number = Math.random): Item[] =>
  Array.from({ length: REEL.lead }, () => pickFrom(sack, tierFor(rand()), rand));

/**
 * The reel: the sack's items drawn at the sack's own odds, starting with the tiles already on show (`lead`), with the
 * rolled item at REEL.stop. The result is the real roll, already saved; only the tiles around it and where the pointer
 * rests are for show. Rule (d) of the plan was lifted by Brian on 2026-11-12: NEAR_MISS of the time a rarer item (usually
 * the next rarity up, sometimes higher) is planted on one side and the reel stops leaning toward it. Nothing says so.
 */
export function reelFor(entry: SackEntry, rand: () => number = Math.random, lead: readonly Item[] = []): Reel {
  const tiles = Array.from({ length: REEL.strip }, (_, i) => lead[i] ?? pickFrom(entry.sack, tierFor(rand()), rand));
  tiles[REEL.stop] = itemById(entry.itemId)!;
  let lean = (rand() - 0.5) * 0.84;
  const rank = TIER_INDEX[entry.tier];
  const nearMiss = rank < 3 && rand() < NEAR_MISS;
  if (nearMiss) {
    const side = rand() < 0.5 ? -1 : 1;
    const better = RARITIES.slice(rank + 1);
    tiles[REEL.stop + side] = pickFrom(entry.sack, rand() < 0.7 ? better[0] : better[Math.floor(rand() * better.length)], rand);
    lean = side * (0.34 + rand() * 0.1);
  }
  return { tiles, nearMiss, lean };
}
/** ease-out quint: a long slow crawl at the end. */
const ease = (t: number) => 1 - (1 - t) ** 5;
/** How far the reel has slid when the middle of tile `i` (plus `lean` of a tile) sits under the pointer of a window `view` px wide. */
const slideTo = (i: number, view: number, lean = 0) => i * REEL.tile + REEL.tile / 2 + lean * REEL.tile - view / 2;

type Phase = 'ready' | 'spinning' | 'done';

/**
 * The fair machine, in the shop. It opens ready, with the sack's items on the reel and the odds underneath: nothing is
 * spent until the lever is pulled. The pull rolls and saves the result (store.openFeedSack), then the reel spins down to
 * it; a tap or Esc skips the spin. The prize comes out in the frame of its rarity. Under reduced motion it shows at once.
 */
function Machine({ sack, wallet, onClose, onNote, onFound }: { sack: SackId; wallet: Wallet; onClose: () => void; onNote: (s: string) => void; onFound: (id: string) => void }) {
  const reduced = useMotionLevel() === 'reduced';
  const info = SACKS[sack];
  const idle = useMemo(() => idleTiles(sack), [sack]);
  const [phase, setPhase] = useState<Phase>('ready');
  const [busy, setBusy] = useState(false);
  const [pulled, setPulled] = useState(false);
  const [entry, setEntry] = useState<SackEntry | null>(null);
  const [reel, setReel] = useState<Reel>({ tiles: idle, nearMiss: false, lean: 0 });
  const strip = useRef<HTMLDivElement>(null);
  const windowRef = useRef<HTMLDivElement>(null);
  const pullRef = useRef<HTMLButtonElement>(null);
  const view = () => windowRef.current?.clientWidth ?? 480;
  const place = (x: number) => { if (strip.current) strip.current.style.transform = `translateX(${-x}px)`; };
  const short = wallet.coins < SACK.price;

  useEffect(() => { place(slideTo(REEL.rest, view())); pullRef.current?.focus({ preventScroll: true }); }, []);
  // The balance and the found item show once the reel has stopped, and in any case when the machine goes.
  useEffect(() => { if (phase === 'done') releaseWalletView(); }, [phase]);
  useEffect(() => releaseWalletView, []);

  const pull = async () => {
    if (phase !== 'ready' || busy || short) return;
    setBusy(true);
    setPulled(true);
    leverPull();
    setTimeout(() => setPulled(false), 480);
    // What the sack gave is saved now, but nothing on screen says so until the reel has stopped (see holdWalletView).
    holdWalletView();
    const r = await openFeedSack(sack);
    if (!r.ok) {
      releaseWalletView();
      onNote(r.reason === 'short' ? 'Not enough Wool Coins yet.' : r.reason === 'complete' ? `You have everything in the ${info.name}.` : 'The barn could not be reached. Try again in a moment.');
      onClose();
      return;
    }
    setReel(reelFor(r.entry, Math.random, idle));
    setEntry(r.entry);
    setPhase('spinning');
  };

  // Spin down to the result, a click as each tile passes the pointer.
  useEffect(() => {
    if (phase !== 'spinning') return;
    const w = view();
    const from = slideTo(REEL.rest, w), to = slideTo(REEL.stop, w, reel.lean);
    if (reduced) { place(to); setPhase('done'); return; }
    let raf = 0, start = 0, last = -1;
    const step = (now: number) => {
      if (!start) start = now;
      const t = Math.min(1, (now - start) / SPIN_MS);
      const x = from + (to - from) * ease(t);
      place(x);
      const tile = Math.floor((x + w / 2) / REEL.tile);
      if (tile !== last) { last = tile; reelClick(); }
      if (t < 1) raf = requestAnimationFrame(step);
      else setPhase('done');
    };
    const go = setTimeout(() => { raf = requestAnimationFrame(step); }, 260);
    return () => { clearTimeout(go); cancelAnimationFrame(raf); };
  }, [phase, reduced, reel]);

  // Landed: the bell, a tune for the rare ones, and a fuse sound plays itself.
  useEffect(() => {
    if (phase !== 'done' || !entry) return;
    reelDing(TIER_INDEX[entry.tier]);
    if (!entry.duplicate) onFound(entry.itemId);
    if (entry.tier === 'rare' || entry.tier === 'legendary') fanfare(entry.tier === 'legendary');
    if (entry.sack !== 'tick' || !TICK_VOICE[entry.itemId]) return;
    const t = setTimeout(() => playSample(entry.itemId), entry.tier === 'common' || entry.tier === 'uncommon' ? 500 : 1300);
    return () => { clearTimeout(t); stopSample(); };
  }, [phase, entry]); // eslint-disable-line react-hooks/exhaustive-deps

  const skip = () => {
    if (phase !== 'spinning') return;
    place(slideTo(REEL.stop, view(), reel.lean));
    setPhase('done');
  };
  useEffect(() => {
    const esc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (phase === 'spinning') skip(); else if (!busy || phase === 'done') onClose();
    };
    window.addEventListener('keydown', esc, true);
    return () => window.removeEventListener('keydown', esc, true);
  });

  const item = entry ? itemById(entry.itemId) : undefined;
  const worn = !!item && wallet.equipped[item.kind] === item.id;
  const wear = async () => {
    if (!entry) return;
    await equipItem(entry.itemId);
    onNote(`${item?.name ?? 'It'} is on.`);
    onClose();
  };
  const closable = phase === 'done' || (phase === 'ready' && !busy);
  return (
    <div className="sk-reveal" style={rarityVar(entry?.tier)} data-phase={phase} data-reduced={reduced || undefined} onClick={() => (phase === 'spinning' ? skip() : closable ? onClose() : undefined)}>
      <div role="dialog" aria-modal="true" aria-label={`${info.name}: the fair machine`} className="sk-machine kit-wall" data-tier={phase === 'done' ? entry?.tier : undefined} onClick={(e) => { e.stopPropagation(); skip(); }}>
        <div className="sk-machine-top">
          <Board size="label" tone="wood" hang="nails" className="sk-machine-sign"><h2>{info.name}</h2></Board>
          <Slate size="mini" className="sk-purse"><span aria-label={`${wallet.coins} Wool Coins`}><CoinArt /> {formatCoins(wallet.coins)}</span></Slate>
          <Peg small light className="sk-room-close" onClick={onClose} aria-label="Close" disabled={!closable}><CloseIcon size={18} /></Peg>
        </div>
        <div className="sk-machine-stage">
          <div className="sk-marquee kit-plank kit-plank--barn">
            <span className="sk-bulbs" aria-hidden="true">{Array.from({ length: BULBS }, (_, i) => <i key={i} style={{ '--i': i } as CSSProperties} />)}</span>
            <div className="sk-window" ref={windowRef}>
              <div className="sk-reel" ref={strip}>
                {reel.tiles.map((it, i) => (
                  <span key={i} className="sk-reel-tile" style={{ '--tile': RARITY_COLOR[it.rarity ?? 'common'] } as CSSProperties} data-win={(phase === 'done' && i === REEL.stop) || undefined}>
                    <ItemArt item={it} size={76} />
                  </span>
                ))}
              </div>
              <span className="sk-window-shade" aria-hidden="true" />
              <span className="sk-pointer" aria-hidden="true" />
            </div>
            <span className="sk-bulbs" aria-hidden="true">{Array.from({ length: BULBS }, (_, i) => <i key={i} style={{ '--i': BULBS - i } as CSSProperties} />)}</span>
          </div>
          <button type="button" className="sk-lever" data-pulled={pulled || undefined} data-armed={(phase === 'ready' && !busy && !short) || undefined} onClick={(e) => { e.stopPropagation(); void pull(); }} disabled={phase !== 'ready' || busy || short} aria-label={`Pull the lever: ${SACK.price} Wool Coins`}>
            <span className="sk-lever-arm"><span className="sk-lever-knob"><KnobArt size={32} /></span></span>
            <span className="sk-lever-base" />
          </button>
        </div>

        {phase === 'ready' && (
          <div className="sk-machine-foot">
            <ul className="sk-odds-key sk-odds-key--row" aria-label={oddsLine()}>
              {RARITIES.map((r) => <li key={r} style={rarityVar(r)}><i />{RARITY_LABEL[r]}<b>{SACK.odds[r]}%</b></li>)}
            </ul>
            <button type="button" ref={pullRef} className="kit-btn kit-plank kit-plank--barn sk-plankbtn sk-machine-pull" onClick={(e) => { e.stopPropagation(); void pull(); }} disabled={busy || short}>
              {busy ? 'Here it goes...' : <>Pull the lever <CoinArt /> {formatCoins(SACK.price)}</>}
            </button>
            <p className="sk-room-hint">{short ? `You need ${formatCoins(SACK.price)} Wool Coins.` : 'Nothing is spent until you pull.'}</p>
          </div>
        )}
        {phase === 'spinning' && <p className="sk-room-hint sk-machine-hint">Tap to skip</p>}
        {phase === 'done' && entry && item && (
          <div className="sk-prize kit-paper kit-paper--sheet" onClick={(e) => e.stopPropagation()}>
            {!reduced && <span className="sk-prize-glow" aria-hidden="true"><Rays className="sk-prize-rays" /></span>}
            <span className="sk-prize-art">
              <ItemFrame item={item} size={104} className="sk-prize-pic" />
              {!entry.duplicate && <span className="sk-prize-new" aria-hidden="true">New!</span>}
            </span>
            <div className="sk-prize-text">
              <ItemTag item={item} />
              <h3>{item.name}</h3>
              <p>{KIND_ONE[item.kind]}. {item.blurb}</p>
              <p role="status" className="sk-prize-line">
                {entry.duplicate ? <>You already have it: <CoinArt /> +{formatCoins(entry.refund)} Wool Coins back</> : `${item.name} is yours.`}
              </p>
              <span className="sk-prize-act">
                {!worn && <Patch as="button" tone="green" onClick={() => void wear()}>Wear it</Patch>}
                <Patch as="button" onClick={onClose}>Done</Patch>
              </span>
            </div>
          </div>
        )}
        {phase === 'done' && !reduced && (entry?.tier === 'rare' || entry?.tier === 'legendary') && (
          <span className="sk-confetti" aria-hidden="true">{Array.from({ length: entry.tier === 'legendary' ? 40 : 16 }, (_, i) => <i key={i} style={{ '--i': i, left: `${(i * 37) % 100}%` } as CSSProperties} />)}</span>
        )}
      </div>
    </div>
  );
}
