import { Px } from '../../skin/components/PixelIcons';
import { useEffect } from 'react';
import { useSocial } from '../../state/socialStore';
import type { ShopItem } from '../../state/socialStore';

const SLOTS: [ShopItem['slot'], string][] = [['color', 'Name colors'], ['title', 'Titles'], ['badge', 'Badges'], ['theme', 'Table themes']];

function preview(i: ShopItem) {
  if (i.slot === 'color') return <b style={{ color: i.value }}>Name</b>;
  if (i.slot === 'badge') return <span aria-hidden="true">{i.value}</span>;
  if (i.slot === 'theme') return <span aria-hidden="true" className="inline-block size-5 rounded border border-white/30" style={{ background: i.value }} />;
  return <i className="text-xs">{i.value}</i>;
}

export function ShopTab() {
  const { shop, balance, error, notice, loadShop, buy, equip } = useSocial();
  useEffect(() => {
    void loadShop();
  }, [loadShop]);
  const btn = 'min-h-11 rounded-lg px-3 text-sm font-bold';
  return (
    <div className="space-y-4">
      <p className="text-sm text-white/70">Coins come from playing. Everything here only changes how you look: it never changes scores or turns, and it cannot be bought with money.</p>
      {error && <p role="alert" className="rounded-lg border border-red-400 bg-red-900/40 p-2 text-sm">{error}</p>}
      {notice && <p role="status" className="rounded-lg border border-sky-300/50 bg-sky-900/40 p-2 text-sm">{notice}</p>}
      <p className="text-lg font-black">You have <span data-balance className="text-amber-300">{balance ?? '…'}</span> <Px e="🪙" /></p>
      {SLOTS.map(([slot, title]) => (
        <section key={slot} aria-label={title}>
          <h3 className="text-sm font-black uppercase tracking-wider text-white/60">{title}</h3>
          <ul className="mt-1 space-y-1">
            {shop?.filter((i) => i.slot === slot).map((i) => (
              <li key={i.id} className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-1">
                <span className="w-16 shrink-0">{preview(i)}</span>
                <span className="min-w-0 flex-1 truncate">{i.name}</span>
                {!i.owned ? (
                  <button className={`${btn} bg-amber-400 text-amber-950 disabled:opacity-40`} disabled={balance !== null && balance < i.price} aria-label={`Buy ${i.name} for ${i.price} coins`} onClick={() => void buy(i.id)}>{i.price} <Px e="🪙" /></button>
                ) : i.equipped ? (
                  <button className={`${btn} bg-white/15`} aria-label={`Take off ${i.name}`} onClick={() => void equip(i.slot, null)}>Wearing <Px e="✓" /></button>
                ) : (
                  <button className={`${btn} bg-emerald-500 text-emerald-950`} aria-label={`Wear ${i.name}`} onClick={() => void equip(i.slot, i.id)}>Wear</button>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
