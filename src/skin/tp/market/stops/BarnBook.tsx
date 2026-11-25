import type { Item, Kind } from '../../../shop/catalog';
import { CATALOG, KIND_LABEL, KINDS } from '../../../shop/catalog';
import type { Wallet } from '../../../shop/economy';
import { MARKET } from '../../market.gen';
import { STOP_X } from '../world';
import { At, Icon, Rarity, sourceLine } from '../pieces';

/** Stop 4, the Barn Book (T6 section 3). */
export function BookStop({ wallet, kind, items, setFocus, turn, phone, page }: { wallet: Wallet; kind: Kind; items: Item[]; setFocus: (i: Item) => void; turn: (k: Kind) => void; phone: boolean; page: number }) {
  const n: 8 | 10 = items.length > 8 ? 10 : 8;
  const found = items.filter((i) => wallet.owned.includes(i.id)).length, all = CATALOG.filter((i) => wallet.owned.includes(i.id)).length;
  void page;
  return (
    <>
      <At p={[STOP_X.book, 3.0, -0.2]} className="tp-hang tp-hang--free">
        <span className="tp-marks" role="tablist" aria-label="Barn Book pages">
          {KINDS.map((k) => <button key={k} type="button" role="tab" aria-selected={k === kind} className="tp-tag tp-tag--mark" data-on={k === kind || undefined} onClick={() => turn(k)}>{KIND_LABEL[k]}</button>)}
        </span>
      </At>
      <At p={[STOP_X.book - 1.75, 2.78, -0.1]} className="tp-book-head"><b>{KIND_LABEL[kind]}</b><small>{`${found} of ${items.length} found`}</small></At>
      <At p={[STOP_X.book + 1.75, 2.78, -0.1]} className="tp-book-head tp-book-head--right"><b>{`${all} of ${CATALOG.length} found`}</b></At>
      {items.map((item, i) => {
        const [cx, cy] = MARKET.book_pockets_cells[String(n) as '8' | '10'][i], x = STOP_X.book + cx * 0.05, y = cy * 0.05 + 0.05;
        const owned = wallet.owned.includes(item.id), worn = wallet.equipped[item.kind] === item.id;
        return (
          <span key={item.id}>
            <At as="button" box={[x - 0.3, y, x + 0.3, y + 0.62, 0]} className="tp-hit" aria-label={`Look at ${item.name}`} onClick={() => setFocus(item)} />
            <At p={[x, y, 0]} className={n === 10 ? "tp-ledge tp-ledge--tight" : "tp-ledge"}>
              <b>{item.name}</b>
              <Rarity item={item} />
              {worn ? <span className="tp-green"><Icon name="tick" size={12} />Wearing</span> : owned ? <span className="tp-green"><Icon name="tick" size={12} />Found. Wear it</span> : <span className="tp-from"><Icon name="lock" size={11} />{sourceLine(item)}</span>}
            </At>
          </span>
        );
      })}
      {phone && null}
    </>
  );
}
