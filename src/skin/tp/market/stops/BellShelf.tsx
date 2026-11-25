import type { Item } from '../../../shop/catalog';
import { KIND_ONE } from '../../../shop/catalog';
import { BELLS } from '../../../shop/economy';
import type { Wallet } from '../../../shop/economy';
import { formatCoins } from '../../../shop/format';
import { partRect, STOP_X } from '../world';
import { At, Icon } from '../pieces';

const BELL_SIGN = partRect('bellStand', 'sign');

/** Stop 2, the Bell Shelf (T6 section 1). */
export function BellsStop({ wallet, items, buy, wear, busy, setFocus, phone }: { wallet: Wallet; items: Item[]; buy: (i: Item) => void; wear: (i: Item) => void; busy: boolean; setFocus: (i: Item) => void; phone: boolean }) {
  return (
    <>
      <At box={[STOP_X.bells + BELL_SIGN.x0, BELL_SIGN.y0, STOP_X.bells + BELL_SIGN.x1, BELL_SIGN.y1, BELL_SIGN.z - 0.1]} className="tp-sign"><span>Bell Shelf</span></At>
      {items.map((item, i) => {
        const x = STOP_X.bells + (i - (Math.min(items.length, 4) - 1) / 2) * 1.3;
        return (
          <span key={item.id}>
            <At as="button" box={[x - 0.35, 0.95, x + 0.35, 1.75, -0.05]} className="tp-hit" aria-label={`Look at ${item.name}`} onClick={() => setFocus(item)} />
            {!phone && <At p={[x, 0.95, 0.55]} className="tp-hang tp-hang--shelf"><ShelfTags item={item} wallet={wallet} buy={buy} wear={wear} busy={busy} /></At>}
          </span>
        );
      })}
      {!phone && <At p={[STOP_X.bells, 1.7, -0.55]} className="tp-hang tp-hang--free"><span className="tp-tag tp-tag--small">More on the way</span></At>}
    </>
  );
}
export function ShelfTags({ item, wallet, buy, wear, busy }: { item: Item; wallet: Wallet; buy: (i: Item) => void; wear: (i: Item) => void; busy: boolean }) {
  const owned = wallet.owned.includes(item.id), worn = wallet.equipped[item.kind] === item.id, need = (item.price ?? 0) - wallet.bells;
  return (
    <span className="tp-shelf-tags">
      {!owned && <span className="tp-price"><Icon name="bell" size={16} />{formatCoins(item.price ?? 0)}</span>}
      <span className="tp-tag tp-tag--shelf"><b>{item.name}</b><small>{KIND_ONE[item.kind]}</small></span>
      {worn ? <span className="tp-wearing"><Icon name="tick" size={14} />Wearing</span>
        : owned ? <button type="button" className="tp-btn tp-btn--lantern tp-btn--tile" onClick={() => wear(item)}>Wear it</button>
        : need > 0 ? <button type="button" className="tp-btn tp-btn--tile" data-pale disabled>{`${need} more Bells`}</button>
        : <button type="button" className="tp-btn tp-btn--lantern tp-btn--tile" disabled={busy} onClick={() => buy(item)} aria-label={`Buy ${item.name} for ${item.price} Golden Bells`}>Buy</button>}
    </span>
  );
}

/** Phones: this stop's part of the paper roll under the band (T5 section 6, T6 section 5). */
export function BellShelfRoll({ wallet, items, buy, wear, busy }: { wallet: Wallet; items: Item[]; buy: (i: Item) => void; wear: (i: Item) => void; busy: boolean }) {
  return (
    <div className="tp-roll">
        
          <>
            {items.map((i) => <div key={i.id} className="tp-roll-shelf"><ShelfTags item={i} wallet={wallet} buy={buy} wear={wear} busy={busy} /></div>)}
            <p className="tp-roll-note"><Icon name="bell" size={14} />{`Golden Bells: +${BELLS.level} every level, +${BELLS.achievement} every milestone, +${BELLS.streak7} every 7 dream nights. Bells buy only what is on this shelf.`}</p>
          </>
    </div>
  );
}
