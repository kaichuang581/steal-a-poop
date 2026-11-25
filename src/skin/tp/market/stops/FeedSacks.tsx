import { useMemo } from 'react';
import type { Item } from '../../../shop/catalog';
import { KIND_LABEL, KINDS } from '../../../shop/catalog';
import type { SackEntry, Wallet } from '../../../shop/economy';
import { formatCoins } from '../../../shop/format';
import { RARITIES, RARITY_COLOR, RARITY_LABEL } from '../../../shop/rarity';
import { liveGuarantees, sackComplete } from '../../../shop/roll';
import { poolFor, SACK, SACKS } from '../../../shop/sacks';
import type { SackId } from '../../../shop/sacks';
import { MARKET } from '../../market.gen';
import { REVEAL_STAND, BENCH } from '../MarketWorld';
import { itemWidth, partRect } from '../world';
import { At, Icon, ListenTile, Rarity, rarityOf } from '../pieces';

/** Stop 1, Feed Sacks (T5): the sack tags, the bench's tags and buttons, the odds board, the main button, the reveal's tag. */
export type Reveal = { entry: SackEntry; item: Item; at: number; done: boolean };

const SIGN = partRect('feedStall', 'sign');
const ODDS = partRect('oddsBoard', 'face');
const ODDS_AT = MARKET.items.find((i) => i.model === 'oddsBoard')!;

export function SacksStop({ wallet, sack, pool, pick, setFocus, reveal, phone, listen }: { wallet: Wallet; sack: SackId; pool: Item[]; pick: (s: SackId) => void; focus: Item | null; setFocus: (i: Item | null) => void; reveal: Reveal | null; phone: boolean; listen: (i: Item) => void }) {
  const places = useMemo(() => { const xs = pool.length <= 5 ? 0.72 : 3.6 / (pool.length - 1); return pool.map((item, i) => ({ item, x: (i - (pool.length - 1) / 2) * xs })); }, [pool]);
  return (
    <>
      <At box={[SIGN.x0, SIGN.y0, SIGN.x1, SIGN.y1, SIGN.z - 0.1]} className="tp-sign"><span>Feed Sacks</span></At>
      <div role="radiogroup" aria-label="Choose a sack">
        {(KINDS as SackId[]).map((s) => {
          const x = MARKET.sacks[({ bomb: 'oat', blast: 'corn', tick: 'barley' } as const)[s]].x;
          const items = poolFor(s), found = items.filter((i) => wallet.owned.includes(i.id)).length, all = found === items.length;
          return (
            <span key={s}>
              <At as="button" box={[x - 0.36, 1.05, x + 0.36, 2.2, 0.1]} className="tp-hit tp-hit--sack" role="radio" aria-checked={sack === s} aria-label={`${SACKS[s].name}: ${KIND_LABEL[s].toLowerCase()}, ${found} of ${items.length} found`} onClick={() => pick(s)} tabIndex={-1} />
              {/* The sack's name is a label on its own crate's front, not a card hung over the stall's sign. */}
              {!reveal && <At p={[x, 1.225, 0.02]} className="tp-hang tp-hang--plaque">
                <button type="button" className="tp-tag tp-tag--sack" data-on={sack === s || undefined} onClick={() => pick(s)} aria-pressed={sack === s}>
                  <b>{SACKS[s].name}</b>
                  {!phone && <small data-all={all || undefined}>{all ? <>{`All ${items.length}`} <Icon name="tick" size={12} /></> : `${found} of ${items.length}`}</small>}
                </button>
              </At>}
            </span>
          );
        })}
      </div>
      {!reveal && places.map(({ item, x }) => {
        const found = wallet.owned.includes(item.id), w = itemWidth(item);
        return (
          <span key={item.id}>
            <At as="button" box={[x - w / 2, BENCH.y, x + w / 2, BENCH.y + 0.8, BENCH.z + 0.25]} className="tp-hit" aria-label={`Look at ${item.name}`} onClick={() => setFocus(item)} />
            {!phone && (
              <At p={[x, BENCH.y, 0.9]} className="tp-hang tp-hang--bench">
                <span className={`tp-tag tp-tag--item${places.length > 5 ? ' tp-tag--tight' : ''}`}>
                  <b>{item.name}</b>
                  <Rarity item={item} tick={found} />
                  {item.kind === 'tick' && <ListenTile item={item} onListen={listen} small />}
                </span>
              </At>
            )}
          </span>
        );
      })}
      {!phone && !reveal && <OddsBoard wallet={wallet} sack={sack} />}
    </>
  );
}

function OddsBoard({ wallet, sack }: { wallet: Wallet; sack: SackId }) {
  const pity = wallet.pity[sack], live = liveGuarantees(sack, wallet.owned);
  const rareIn = Math.max(1, SACK.pity.rare - pity.sinceRare), legIn = Math.max(1, SACK.pity.legendary - pity.sinceLegendary);
  return (
    <At box={[ODDS_AT.x + ODDS.x0, ODDS_AT.y + ODDS.y0, ODDS_AT.x + ODDS.x1, ODDS_AT.y + ODDS.y1, ODDS_AT.z + ODDS.z]} className="tp-chalk">
      <h4>{SACKS[sack].name}</h4>
      <p className="tp-chalk-sub">The odds, every time</p>
      <ul>{RARITIES.map((r) => <li key={r}><i style={{ background: RARITY_COLOR[r] }} />{RARITY_LABEL[r]}<b>{SACK.odds[r]}%</b></li>)}</ul>
      <hr />
      <p>Rare or better<br /><b>{live.rare ? `within ${rareIn} sack${rareIn === 1 ? '' : 's'}` : 'every rare found'}</b></p>
      <p>Legendary<br /><b>{live.legendary ? `within ${legIn} sack${legIn === 1 ? '' : 's'}` : 'every legendary found'}</b></p>
    </At>
  );
}

export function OpenButton({ wallet, sack, busy, onOpen }: { wallet: Wallet; sack: SackId; busy: boolean; onOpen: () => void }) {
  const complete = sackComplete(sack, wallet.owned), short = wallet.coins < SACK.price, name = SACKS[sack].name;
  const off = complete || short || busy;
  return (
    <button type="button" className="tp-btn tp-btn--main" data-pale={complete || short || undefined} disabled={off} onClick={onOpen} aria-label={complete ? `All found in the ${name}` : short ? `Need ${SACK.price} Wool Coins` : `Open ${/^[AEIOU]/.test(name) ? 'an' : 'a'} ${name} for ${SACK.price} Wool Coins`}>
      {complete ? <><b>All found</b><small>Nothing left to find in this sack.</small></>
        : short ? <><b>{`Need ${formatCoins(SACK.price)} Wool Coins`}</b><small>{`You have ${formatCoins(wallet.coins)}.`}</small></>
        : <><b><Icon name="coin" size={20} />{`Open ${/^[AEIOU]/.test(name) ? 'an' : 'a'} ${name}`}</b><small>{`${formatCoins(SACK.price)} Wool Coins. One at a time.`}</small></>}
    </button>
  );
}

export function RevealTag({ reveal, wallet, onWear, onDone, phone }: { reveal: Reveal; wallet: Wallet; onWear: () => void; onDone: () => void; phone: boolean }) {
  if (!reveal.done) return <p className="tp-skip">Tap to skip</p>;
  const { item, entry } = reveal, worn = wallet.equipped[item.kind] === item.id;
  return (
    <At p={[REVEAL_STAND.x, REVEAL_STAND.y, 0.3]} className="tp-hang tp-hang--reveal">
      <span className="tp-tag tp-tag--reveal" onClick={(e) => e.stopPropagation()}>
        <b>{item.name}</b>
        <span className="tp-reveal-line"><Rarity item={item} />{entry.duplicate ? <em>You have this one</em> : <em className="tp-new">New!</em>}</span>
        {entry.duplicate && <span className="tp-refund"><Icon name="coin" size={14} />{`+${formatCoins(entry.refund)}`}</span>}
        <span className="tp-tiles">
          {!entry.duplicate && !worn && <button type="button" className="tp-btn tp-btn--lantern" onClick={onWear} autoFocus>Wear it</button>}
          <button type="button" className="tp-btn tp-btn--pale-ok" onClick={onDone} autoFocus={entry.duplicate || worn}>Done</button>
        </span>
      </span>
      {phone && null}
    </At>
  );
}


/** Phones: this stop's part of the paper roll under the band (T5 section 6, T6 section 5). */
export function FeedSacksRoll({ wallet, sack, pool, listen }: { wallet: Wallet; sack: SackId; pool: Item[]; listen: (i: Item) => void }) {
  return (
    <div className="tp-roll">
        {(() => { const pity = wallet.pity[sack]; return (
        
          <>
            <h3>{`Inside the ${SACKS[sack].name}`}<small>{`${pool.filter((i) => wallet.owned.includes(i.id)).length} of ${pool.length} found`}</small></h3>
            <ul className="tp-roll-rows">
              {pool.map((i) => <li key={i.id}><i style={{ background: rarityOf(i).colour }} /><b>{i.name}</b><small>{rarityOf(i).word}</small>{wallet.owned.includes(i.id) && <span className="tp-green"><Icon name="tick" size={12} />Found</span>}{i.kind === 'tick' && <ListenTile item={i} onListen={listen} small />}</li>)}
            </ul>
            <p className="tp-roll-odds"><small>The odds, every time</small><br />{RARITIES.map((r) => `${RARITY_LABEL[r]} ${SACK.odds[r]}%`).join('   ')}<br />{`Rare or better within ${Math.max(1, SACK.pity.rare - pity.sinceRare)} sacks. Legendary within ${Math.max(1, SACK.pity.legendary - pity.sinceLegendary)}.`}</p>
          </>
        ); })()}
    </div>
  );
}
