import type { Item, Kind } from '../../../shop/catalog';
import { CATALOG, KIND_LABEL, KINDS } from '../../../shop/catalog';
import { SACKS } from '../../../shop/sacks';
import type { Wallet } from '../../../shop/economy';
import { MARKET } from '../../market.gen';
import { STOP_X } from '../world';
import { frameOf } from '../../../shop/rarity';
import { At, rarityOf } from '../pieces';
import { Btn, Gem, KindIcon, LOCK, Sprite, TICK } from '../signs';

/** Where a not-found item comes from, in a word or two: the short line of a short window (the close view has the whole line). */
const shortSource = (i: Item): string => (i.source === 'sack' ? SACKS[i.kind].name.replace(/^The /, '') : i.source === 'bells' ? 'Bell Shelf' : i.source === 'mission' ? 'Mission' : 'Starter');

/** Stop 4, the Barn Book (T6 section 3). */
export function BookStop({ wallet, kind, items, setFocus, turn, phone, page, flip }: { wallet: Wallet; kind: Kind; items: Item[]; setFocus: (i: Item) => void; turn: (k: Kind) => void; phone: boolean; page: number; flip?: () => void }) {
  const n: 8 | 10 = items.length > 8 ? 10 : 8;
  const found = items.filter((i) => wallet.owned.includes(i.id)).length, all = CATALOG.filter((i) => wallet.owned.includes(i.id)).length;
  // The three bookmarks: tabs standing on the book's top edge, each with its kind's picture, the open one lit and taller.
  // On a phone the camera frames one page, so they sit in a row under the stalls' tabs instead.
  const marks = (
    <span className="tp-marks" role="tablist" aria-label="Barn Book pages">
      {KINDS.map((k) => <button key={k} type="button" role="tab" aria-selected={k === kind} className="mk-booktab" data-on={k === kind || undefined} onClick={() => turn(k)}><KindIcon kind={k} />{KIND_LABEL[k]}</button>)}
    </span>
  );
  return (
    <>
      {phone && <Btn seal={page ? 'back' : 'next'} tone="cream" className="tp-page-turn" onClick={flip}>{page ? 'Back a page' : 'Turn the page'}</Btn>}
      {phone ? <div className="tp-marks-phone">{marks}</div> : <At p={[STOP_X.book, 2.94, -0.2]} className="tp-hang tp-hang--free">{marks}</At>}
      <At p={[STOP_X.book - 1.75, 2.78, -0.1]} className="tp-book-head"><b>{KIND_LABEL[kind]}</b><small>{`${found} of ${items.length} found`}</small></At>
      <At p={[STOP_X.book + 1.75, 2.78, -0.1]} className="tp-book-head tp-book-head--right"><b>{`${all} of ${CATALOG.length} found`}</b></At>
      {items.map((item, i) => {
        const [cx, cy] = MARKET.book_pockets_cells[String(n) as '8' | '10'][i], x = STOP_X.book + cx * 0.05, y = cy * 0.05 + 0.05;
        const owned = wallet.owned.includes(item.id), worn = wallet.equipped[item.kind] === item.id;
        return (
          <span key={item.id}>
            <At as="button" box={[x - 0.3, y, x + 0.3, y + 0.62, 0]} className="tp-hit" aria-label={`Look at ${item.name}`} onClick={() => setFocus(item)} />
            <At p={[x, y, 0]} className={n === 10 ? "tp-ledge tp-ledge--tight" : "tp-ledge"}>
              {/* Two lines, so a card's words never reach the card below: the rarity is the gem before the name, an
                  empty socket until it is found (its word is in the close view), then whether it is yours or where
                  it comes from. */}
              <b><span role="img" aria-label={rarityOf(item).word}><Gem of={frameOf(item)} off={!owned} /></span>{item.name}</b>
              {worn ? <span className="tp-green"><Sprite g={TICK} />Wearing</span> : owned ? <span className="tp-green"><Sprite g={TICK} />Wear it</span> : <span className="tp-from"><Sprite g={LOCK} />{shortSource(item)}</span>}
            </At>
          </span>
        );
      })}
    </>
  );
}
