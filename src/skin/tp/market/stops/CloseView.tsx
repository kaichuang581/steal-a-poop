import type { Item } from '../../../shop/catalog';
import { KIND_ONE } from '../../../shop/catalog';
import type { Wallet } from '../../../shop/economy';
import type { MarketWorld } from '../MarketWorld';
import type { StopId } from '../world';
import { At, Icon, lineOf, ListenTile, Rarity, sourceLine } from '../pieces';

/** Looking closely at one item (T6 section 4). */
export function CloseView({ item, wallet, world, stop, phone, onWear, onListen, onClose }: { item: Item; wallet: Wallet; world: React.MutableRefObject<MarketWorld | null>; stop: StopId; phone: boolean; onWear: (i: Item) => void; onListen: (i: Item) => void; onClose: () => void }) {
  const at = world.current?.whereIs(item.id, stop);
  const owned = wallet.owned.includes(item.id), worn = wallet.equipped[item.kind] === item.id;
  if (!at) return null;
  const card = (
    <span className="tp-tag tp-tag--close" onClick={(e) => e.stopPropagation()}>
      <b className="tp-close-name">{item.name}</b>
      <span className="tp-close-kind">{KIND_ONE[item.kind]}<Rarity item={item} /></span>
      <span className="tp-close-line">{lineOf(item)}</span>
      {!owned && <span className="tp-from"><Icon name="lock" size={11} />{sourceLine(item)}</span>}
      <span className="tp-tiles">
        {worn ? <span className="tp-wearing"><Icon name="tick" size={14} />Wearing</span> : owned && <button type="button" className="tp-btn tp-btn--lantern tp-btn--tile" onClick={() => onWear(item)}>Wear it</button>}
        {item.kind === 'blast' && <button type="button" className="tp-btn tp-btn--wool tp-btn--tile" onClick={() => world.current?.tryBurst(item, performance.now())}><Icon name="play" size={12} />Try it</button>}
        {item.kind === 'tick' && <ListenTile item={item} onListen={onListen} />}
        {item.kind === 'bomb' && <button type="button" className="tp-btn tp-btn--wool tp-btn--tile" onClick={() => world.current?.seeLit(item, performance.now())}>See it lit</button>}
      </span>
      <button type="button" className="tp-back" onClick={onClose}>Step back</button>
    </span>
  );
  if (phone) return <div className="tp-close-phone">{card}</div>;
  return <At p={[at.x + 0.38, at.y + at.h, at.z]} className="tp-closeat">{card}</At>;
}
