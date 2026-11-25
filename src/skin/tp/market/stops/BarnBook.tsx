import type { Item, Kind } from '../../../shop/catalog';
import { CATALOG, KIND_LABEL, KINDS } from '../../../shop/catalog';
import { SACKS } from '../../../shop/sacks';
import type { Wallet } from '../../../shop/economy';
import { MARKET } from '../../market.gen';
import { STOP_X } from '../world';
import { At, Icon, Rarity, rarityOf, sourceLine } from '../pieces';

/** Where a not-found item comes from, in a word or two: the short line of a short window (the close view has the whole line). */
const shortSource = (i: Item): string => (i.source === 'sack' ? SACKS[i.kind].name.replace(/^The /, '') : i.source === 'bells' ? 'Bell Shelf' : i.source === 'mission' ? 'Mission' : 'Starter');

/** Stop 4, the Barn Book (T6 section 3). */
export function BookStop({ wallet, kind, items, setFocus, turn, phone, page, flip, short = false }: { wallet: Wallet; kind: Kind; items: Item[]; setFocus: (i: Item) => void; turn: (k: Kind) => void; phone: boolean; page: number; flip?: () => void; short?: boolean }) {
  const n: 8 | 10 = items.length > 8 ? 10 : 8;
  const found = items.filter((i) => wallet.owned.includes(i.id)).length, all = CATALOG.filter((i) => wallet.owned.includes(i.id)).length;
  // The three bookmarks. On a phone the camera frames one page, so they sit in a row under the tabs instead.
  const marks = (
    <span className="tp-marks" role="tablist" aria-label="Barn Book pages">
      {KINDS.map((k) => <button key={k} type="button" role="tab" aria-selected={k === kind} className="tp-tag tp-tag--mark" data-on={k === kind || undefined} onClick={() => turn(k)}>{KIND_LABEL[k]}</button>)}
    </span>
  );
  return (
    <>
      {phone && <button type="button" className="tp-tag tp-tag--small tp-page-turn" onClick={flip}>{page ? 'Back a page' : 'Turn the page'}</button>}
      {phone ? <div className="tp-marks-phone">{marks}</div> : <At p={[STOP_X.book, 3.0, -0.2]} className="tp-hang tp-hang--free">{marks}</At>}
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
              {/* A short window (under 820 px) has room for two lines between a card and the one below it on the 8-item
                  pages, where the 11 px floor stops the text shrinking with the book: the rarity's square leads the
                  second line there, and the rarity's word is in the close view. */}
              {!(short && n === 8) && <Rarity item={item} />}
              {(() => {
                const sq = short && n === 8 ? <i className="tp-rarity-sq" style={{ background: rarityOf(item).colour }} aria-label={rarityOf(item).word} /> : null;
                return worn ? <span className="tp-green">{sq}<Icon name="tick" size={12} />Wearing</span> : owned ? <span className="tp-green">{sq}<Icon name="tick" size={12} />{n === 10 || short ? 'Wear it' : 'Found. Wear it'}</span> : <span className="tp-from">{sq}<Icon name="lock" size={11} />{sq ? shortSource(item) : sourceLine(item)}</span>;
              })()}
            </At>
          </span>
        );
      })}
    </>
  );
}
