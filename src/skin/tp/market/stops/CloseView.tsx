import type { Item } from '../../../shop/catalog';
import { KIND_ONE } from '../../../shop/catalog';
import type { Wallet } from '../../../shop/economy';
import type { MarketWorld } from '../MarketWorld';
import type { StopId } from '../world';
import { At, lineOf, ListenTile, Rarity, sourceLine } from '../pieces';
import { Btn, KIND_TONE, LOCK, Pointer, Ribbon, Sprite } from '../signs';

/** Looking closely at one item (T6 section 4). */
export function CloseView({ item, wallet, world, stop, phone, onWear, onListen, onClose }: { item: Item; wallet: Wallet; world: React.MutableRefObject<MarketWorld | null>; stop: StopId; phone: boolean; onWear: (i: Item) => void; onListen: (i: Item) => void; onClose: () => void }) {
  const at = world.current?.whereIs(item.id, stop);
  const owned = wallet.owned.includes(item.id), worn = wallet.equipped[item.kind] === item.id;
  if (!at) return null;
  // The card: a point on its side toward the thing, the thing's kind on a ribbon over its top edge, its gem, and a
  // button for each thing that can be done with it, each with a picture of what it does.
  const card = (
    <span className="tp-tag tp-tag--close" onClick={(e) => e.stopPropagation()}>
      {!phone && <Pointer />}
      <Ribbon tone={KIND_TONE[item.kind]} seal={item.kind} className="tp-close-ribbon">{KIND_ONE[item.kind]}</Ribbon>
      <b className="tp-close-name">{item.name}</b>
      <Rarity item={item} />
      <span className="tp-close-line">{lineOf(item)}</span>
      {!owned && <span className="tp-from"><Sprite g={LOCK} />{sourceLine(item)}</span>}
      <span className="tp-tiles">
        {worn ? <Ribbon tone="green" seal="yes" className="tp-wearing">Wearing</Ribbon> : owned && <Btn seal={item.kind} onClick={() => onWear(item)}>Wear it</Btn>}
        {item.kind === 'blast' && <Btn seal="play" tone="cream" onClick={() => world.current?.tryBurst(item, performance.now())}>Try it</Btn>}
        {item.kind === 'tick' && <ListenTile item={item} onListen={onListen} />}
        {item.kind === 'bomb' && <Btn seal="flame" tone="cream" onClick={() => world.current?.seeLit(item, performance.now())}>See it lit</Btn>}
        <Btn seal="back" tone="cream" onClick={onClose}>Step back</Btn>
      </span>
    </span>
  );
  if (phone) return <div className="tp-close-phone">{card}</div>;
  return <At p={[at.x + 0.38, at.y + at.h, at.z]} className="tp-closeat">{card}</At>;
}
