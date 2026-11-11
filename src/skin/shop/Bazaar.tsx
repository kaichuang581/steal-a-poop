import { useEffect, useState } from 'react';
import { previewTick } from '../../audio/sound';
import { Brass, Clipboard, Knit, Patch } from '../kit';
import { CoinIcon } from '../components/Icons';
import { localDateKey } from '../hooks/useToday';
import { CATALOG, KIND_LABEL, KINDS, TICK_VOICE } from './catalog';
import type { Item, Kind } from './catalog';
import { ACHIEVEMENTS, DAILY_CAP, levelOf, titleFor } from './economy';
import type { Wallet } from './economy';
import { buyItem, equipItem, useWallet } from './store';

type Tab = Kind | 'progress';
const SHORT: Record<string, string> = {
  short: 'Not enough Wool Coins yet.', owned: 'You already have that.', not_for_sale: 'That one is earned, not bought.', unknown: 'That item is gone.',
};

/**
 * The Barn Bazaar: bomb skins, bursts and fuse sounds for Wool Coins, and a page for levels and milestones. Prices are
 * fixed and shown, nothing is random, nothing is sold for money, and nothing here changes how a game plays.
 */
export function Bazaar({ onClose }: { onClose: () => void }) {
  const wallet = useWallet();
  const [tab, setTab] = useState<Tab>('bomb');
  const [note, setNote] = useState('');
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);
  useEffect(() => setNote(''), [tab]);

  const lv = levelOf(wallet.xp);
  const tabs = [...KINDS.map((k) => ({ id: k, label: KIND_LABEL[k] })), { id: 'progress', label: 'Progress' }];
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center" style={{ background: 'color-mix(in srgb, var(--ink) 50%, transparent)' }} onClick={onClose}>
      <Clipboard aria-label="The Barn Bazaar" title="The Barn Bazaar" onClose={onClose} tabs={tabs} tab={tab} onTab={(id) => setTab(id as Tab)} className="sk-bazaar" onClick={(e) => e.stopPropagation()}>
        <div className="sk-bazaar-head">
          <span className="sk-bazaar-coins" aria-label={`${wallet.coins} Wool Coins`}><CoinIcon size={18} /> {wallet.coins.toLocaleString()} Wool Coins</span>
          <span className="sk-hand">Level {lv.level} · {titleFor(lv.level)}</span>
        </div>
        {tab === 'progress' ? <Progress wallet={wallet} /> : (
          <>
            <p className="sk-hand sk-bazaar-note">Only for show: nothing here changes how a game plays. Earn Wool Coins by playing.</p>
            <div className="sk-bazaar-grid">
              {CATALOG.filter((i) => i.kind === tab).map((i) => <ItemCard key={i.id} item={i} wallet={wallet} onNote={setNote} />)}
            </div>
            {note && <p role="status" className="sk-hand sk-bazaar-note">{note}</p>}
          </>
        )}
      </Clipboard>
    </div>
  );
}

function ItemCard({ item, wallet, onNote }: { item: Item; wallet: Wallet; onNote: (s: string) => void }) {
  const owned = wallet.owned.includes(item.id);
  const worn = wallet.equipped[item.kind] === item.id;
  const status = worn ? 'Wearing' : owned ? 'Owned' : item.source === 'coins' ? `${item.price} coins` : `${item.streak}-night dream streak`;
  const buy = () => {
    const r = buyItem(item.id);
    if (r.ok) { equipItem(item.id); onNote(`${item.name} is yours, and on.`); } else onNote(SHORT[r.reason]);
  };
  return (
    <div className="sk-avatar-choice sk-bazaar-item" data-worn={worn || undefined}>
      <span className="sk-bazaar-swatch" aria-hidden="true">{item.swatch.map((c) => <i key={c} style={{ background: c }} />)}</span>
      <b className="sk-display block text-base">{item.name}</b>
      <span className="sk-hand block text-sm leading-tight">{item.blurb}</span>
      <span className="sk-bazaar-status">{status}</span>
      <span className="sk-bazaar-actions">
        {item.kind === 'tick' && <Patch as="button" small onClick={() => previewTick(TICK_VOICE[item.id])}>Listen</Patch>}
        {owned && !worn && <Patch as="button" small tone="green" onClick={() => { equipItem(item.id); onNote(`${item.name} is on.`); }}>Wear</Patch>}
        {!owned && item.source === 'coins' && (
          <Brass onClick={buy} disabled={wallet.coins < (item.price ?? 0)} aria-label={`Buy ${item.name} for ${item.price} Wool Coins`}>Buy</Brass>
        )}
      </span>
    </div>
  );
}

function Progress({ wallet }: { wallet: Wallet }) {
  const lv = levelOf(wallet.xp);
  const segs = 10;
  const today = wallet.day === localDateKey(new Date()) ? wallet.earnedToday : 0;
  return (
    <div className="sk-bazaar-progress">
      <p><b>Level {lv.level}</b>, {titleFor(lv.level)}. {lv.need - lv.into} XP to level {lv.level + 1}.</p>
      <Knit segments={segs} filled={Math.floor((lv.into / lv.need) * segs)} />
      <p className="sk-hand">Wool Coins earned today from games: {Math.min(today, DAILY_CAP)} of {DAILY_CAP}. Levels and milestones pay on top.</p>
      <p><b>{wallet.words.length.toLocaleString()}</b> different words played at the table.</p>
      <ul className="sk-bazaar-list">
        {ACHIEVEMENTS.map((a) => (
          <li key={a.id} data-done={wallet.achieved.includes(a.id) || undefined}>
            <span>{a.label}</span><span>{wallet.achieved.includes(a.id) ? 'Done' : `+${a.coins}`}</span>
          </li>
        ))}
      </ul>
      <p className="sk-hand">Everything here is saved in this browser. The save code in Settings carries it to another one.</p>
    </div>
  );
}
