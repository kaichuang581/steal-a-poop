import type { CSSProperties } from 'react';
import type { Item } from '../../../shop/catalog';
import { KIND_ONE } from '../../../shop/catalog';
import { BELLS } from '../../../shop/economy';
import type { Wallet } from '../../../shop/economy';
import { formatCoins } from '../../../shop/format';
import { partRect, STOP_X } from '../world';
import { At, Icon } from '../pieces';
import { BellToken, Btn, Crest, KIND_TONE, Meter, Ribbon, Snow, StallPainted } from '../signs';

const BELL_SIGN = partRect('bellStand', 'sign');

/** Stop 2, the Bell Shelf (T6 section 1). */
export function BellsStop({ wallet, items, buy, wear, busy, setFocus, phone }: { wallet: Wallet; items: Item[]; buy: (i: Item) => void; wear: (i: Item) => void; busy: boolean; setFocus: (i: Item) => void; phone: boolean }) {
  return (
    <>
      <At box={[STOP_X.bells + BELL_SIGN.x0, BELL_SIGN.y0, STOP_X.bells + BELL_SIGN.x1, BELL_SIGN.y1, BELL_SIGN.z - 0.1]} className="tp-sign" style={{ '--vox': 5 / (BELL_SIGN.x1 - BELL_SIGN.x0) } as CSSProperties}><StallPainted stop="bells" /><span>Bell Shelf</span><StallPainted stop="bells" /></At>
      {items.map((item, i) => {
        const x = STOP_X.bells + (i - (Math.min(items.length, 4) - 1) / 2) * 1.3;
        return (
          <span key={item.id}>
            <At as="button" box={[x - 0.35, 0.95, x + 0.35, 1.75, -0.05]} className="tp-hit" aria-label={`Look at ${item.name}`} onClick={() => setFocus(item)} />
            {!phone && <At p={[x, 0.95, 0.55]} className="tp-hang tp-hang--shelf"><ShelfTags item={item} wallet={wallet} buy={buy} wear={wear} busy={busy} /></At>}
          </span>
        );
      })}
    </>
  );
}
/**
 * A thing on the shelf: its tag (the price on a pill on its top edge, or its bell once it is yours; its name; what kind
 * it is on a ribbon; how far the bells have come when there are too few) and the one thing to do with it.
 */
export function ShelfTags({ item, wallet, buy, wear, busy }: { item: Item; wallet: Wallet; buy: (i: Item) => void; wear: (i: Item) => void; busy: boolean }) {
  const owned = wallet.owned.includes(item.id), worn = wallet.equipped[item.kind] === item.id, need = (item.price ?? 0) - wallet.bells;
  return (
    <span className="tp-shelf-tags">
      <span className="tp-tag tp-tag--shelf">
        {owned ? <Crest of="bells" /> : <span className="mk-pill tp-price" aria-label={`${item.price} Golden Bells`}><Icon name="bell" /><b>{formatCoins(item.price ?? 0)}</b></span>}
        <b>{item.name}</b>
        <Ribbon tone={KIND_TONE[item.kind]} seal={item.kind}>{KIND_ONE[item.kind]}</Ribbon>
        {!owned && need > 0 && <Meter pale value={wallet.bells / (item.price ?? 1)} label={`${wallet.bells} of ${item.price} Golden Bells`} />}
      </span>
      {worn ? <Ribbon tone="green" seal="yes" className="tp-wearing">Wearing</Ribbon>
        : owned ? <Btn seal={item.kind} onClick={() => wear(item)}>Wear it</Btn>
        : need > 0 ? <Btn seal="lock" data-pale disabled>{`${need} more Bells`}</Btn>
        : <Btn seal="bell" disabled={busy} onClick={() => buy(item)} aria-label={`Buy ${item.name} for ${item.price} Golden Bells`}>Buy</Btn>}
    </span>
  );
}

/** How Golden Bells are earned: a bell for each way, what it pays and when. */
export function BellWays({ snow }: { snow?: boolean }) {
  return (
    <div className="tp-note mk-ways">
      {snow && <Snow />}
      <div className="mk-ways-title"><h3>Golden Bells</h3><p>Bells buy only what is on this shelf.</p></div>
      <ul>
        {([[BELLS.level, 'every level'], [BELLS.achievement, 'every milestone'], [BELLS.streak7, 'every 7 dream nights']] as const).map(([n, when]) => (
          <li key={when}><BellToken /><span><b>{`+${n}`}</b><small>{when}</small></span></li>
        ))}
      </ul>
    </div>
  );
}

/** Phones: this stop's part of the paper roll under the band (T5 section 6, T6 section 5). */
export function BellShelfRoll({ wallet, items, buy, wear, busy }: { wallet: Wallet; items: Item[]; buy: (i: Item) => void; wear: (i: Item) => void; busy: boolean }) {
  return (
    <div className="tp-roll">
        
          <>
            {items.map((i) => <div key={i.id} className="tp-roll-shelf"><ShelfTags item={i} wallet={wallet} buy={buy} wear={wear} busy={busy} /></div>)}
            <BellWays />
          </>
    </div>
  );
}
