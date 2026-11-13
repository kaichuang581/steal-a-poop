import { useEffect, useRef, useState } from 'react';
import { useGuestSocial } from '../../state/guestSocial';
import { useSocial } from '../../state/socialStore';
import { BoardTab } from './BoardTab';
import { FriendsTab } from './FriendsTab';
import { ShopTab } from './ShopTab';

export type HubTab = 'friends' | 'boards' | 'shop';
const TABS: [HubTab, string][] = [['friends', 'Friends'], ['boards', 'Boards'], ['shop', 'Shop']];

/**
 * Friends, leaderboards and the shop in one window, with the coin balance always in view.
 * `tabs` picks which sections show. `guest` is for someone playing without an account: friends are kept in this browser
 * (the name on the name plate is what friends see), the boards are read-only, and there are no coins or shop.
 */
export function Hub({ initial, onClose, tabs, guest = false, guestName = '' }: { initial: HubTab; onClose: () => void; tabs?: readonly HubTab[]; guest?: boolean; guestName?: string }) {
  const shown = TABS.filter(([t]) => !tabs || tabs.includes(t));
  const [tab, setTab] = useState<HubTab>(shown.some(([t]) => t === initial) ? initial : (shown[0]?.[0] ?? 'friends'));
  const balance = useSocial((s) => s.balance);
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    close.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  useEffect(() => {
    if (guest) useGuestSocial.getState().setName(guestName);
    else void useSocial.getState().refreshBalance();
  }, [guest, guestName]);

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/75 p-3" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={shown.length === TABS.length ? 'Friends, boards and shop' : shown.map(([, l]) => l.toLowerCase()).join(' and ')} className="classic-panel flex max-h-[92vh] w-full max-w-md flex-col rounded-3xl border-2 border-wood-light bg-[#1a1145] p-4 text-white" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="classic-panel-title text-xl font-black text-amber-300">Community</h2>
          {!guest && <span aria-label="Coins" className="rounded-full bg-black/40 px-3 py-1 font-black">{balance ?? '…'} coins</span>}
          <button ref={close} onClick={onClose} className="min-h-11 min-w-11 rounded-lg bg-white/10 text-lg" aria-label="Close">Close</button>
        </div>
        <div className="mb-3 flex gap-1" role="tablist" aria-label="Sections">
          {shown.map(([t, label]) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`min-h-11 flex-1 rounded-lg px-2 text-sm font-bold ${tab === t ? 'bg-amber-400 text-amber-950' : 'bg-white/10'}`}>{label}</button>
          ))}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          {tab === 'friends' && (guest ? <FriendsTab useStore={useGuestSocial} guest /> : <FriendsTab />)}
          {tab === 'boards' && <BoardTab guest={guest} />}
          {tab === 'shop' && <ShopTab />}
        </div>
      </div>
    </div>
  );
}
