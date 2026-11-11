import { useEffect, useRef, useState } from 'react';
import { previewTick } from '../../audio/sound';
import { Board, Brass, Knit, Paper, Patch, WoodButton } from '../kit';
import { CoinIcon } from '../components/Icons';
import { localDateKey } from '../hooks/useToday';
import { CATALOG, KIND_LABEL, KINDS, TICK_VOICE } from './catalog';
import type { Item, Kind } from './catalog';
import { ACHIEVEMENTS, DAILY_CAP, levelOf, titleFor } from './economy';
import type { Wallet } from './economy';
import { buyItem, equipItem, useWallet, useWalletIsAccount } from './store';

type Section = 'progress' | Kind | 'milestones';
const SHORT: Record<string, string> = {
  short: 'Not enough Wool Coins yet.', owned: 'You already have that.', not_for_sale: 'That one is earned, not bought.', unknown: 'That item is gone.',
  offline: 'The barn could not be reached. Try again in a moment.',
};
const BLURB: Record<Kind, string> = {
  bomb: 'How the ice bomb looks when it lands at your hooves.',
  blast: 'What flies when the bomb goes off.',
  tick: 'The sound of the fuse counting down.',
};
const SECTIONS: { id: Section; label: string }[] = [
  { id: 'progress', label: 'Your barn' },
  ...KINDS.map((k) => ({ id: k as Section, label: KIND_LABEL[k] })),
  { id: 'milestones', label: 'Milestones' },
];

/**
 * The Trading Post, a page of its own (opened from the main menu, in the same tab): your level and coins at the top,
 * then every item under its heading in one long scroll, and the milestones at the foot. A bar of section tabs stays
 * at the top and jumps down the page. Prices are fixed and shown, nothing is random, nothing is sold for money, and
 * nothing here changes how a game plays. The browser's Back button and Esc both go back to the farm.
 */
export function Bazaar({ onClose }: { onClose: () => void }) {
  const wallet = useWallet();
  const account = useWalletIsAccount();
  const [note, setNote] = useState('');
  const [at, setAt] = useState<Section>('progress');
  const scroller = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;

  // A page in the same tab: it takes a history entry, so the browser's Back closes it instead of leaving the game.
  useEffect(() => {
    let popped = false;
    try { history.pushState({ ...(history.state ?? {}), bazaar: true }, ''); } catch { /* sandboxed frame */ }
    const pop = () => { popped = true; close.current(); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); close.current(); } };
    window.addEventListener('popstate', pop);
    window.addEventListener('keydown', esc);
    return () => {
      window.removeEventListener('popstate', pop);
      window.removeEventListener('keydown', esc);
      if (!popped && history.state?.bazaar) { try { history.back(); } catch { /* ignore */ } }
    };
  }, []);

  // The tab for whichever section is at the top of the scroll.
  useEffect(() => {
    const root = scroller.current;
    if (!root || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((entries) => {
      const top = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (top) setAt(top.target.getAttribute('data-section') as Section);
    }, { root, rootMargin: '0px 0px -70% 0px' });
    root.querySelectorAll('[data-section]').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (!note) return;
    const t = setTimeout(() => setNote(''), 3500);
    return () => clearTimeout(t);
  }, [note]);

  const jump = (id: Section) => {
    setAt(id);
    scroller.current?.querySelector(`[data-section="${id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const lv = levelOf(wallet.xp);
  return (
    <div className="sk-shop" role="dialog" aria-modal="true" aria-label="The Trading Post">
      <header className="sk-shop-top kit-plank kit-plank--barn">
        <WoodButton onClick={onClose} className="sk-shop-back" aria-label="Back to the farm">← Farm</WoodButton>
        <h1 className="sk-shop-title sk-display">The Trading Post</h1>
        <span className="sk-shop-purse" aria-label={`${wallet.coins} Wool Coins, level ${lv.level}`}>
          <span className="sk-shop-coins"><CoinIcon size={20} /> {wallet.coins.toLocaleString()}</span>
          <span className="sk-shop-level">Lv {lv.level}</span>
        </span>
      </header>
      <nav className="sk-shop-tabs" aria-label="Trading Post sections">
        {SECTIONS.map((s) => (
          <Patch key={s.id} as="button" small pressed={at === s.id} tone={at === s.id ? 'gold' : 'burlap'} onClick={() => jump(s.id)}>{s.label}</Patch>
        ))}
      </nav>
      <div className="sk-shop-scroll" ref={scroller}>
        <div className="sk-shop-page">
          <section data-section="progress" className="sk-shop-section">
            <YourBarn wallet={wallet} account={account} />
          </section>
          {KINDS.map((k) => (
            <section key={k} data-section={k} className="sk-shop-section" aria-labelledby={`shop-${k}`}>
              <Board size="heading" tone="wood" hang="nails" className="sk-shop-heading"><h2 id={`shop-${k}`}>{KIND_LABEL[k]}</h2></Board>
              <p className="sk-hand sk-shop-sub">{BLURB[k]}</p>
              <div className="sk-shop-grid">
                {CATALOG.filter((i) => i.kind === k).map((i) => <ItemCard key={i.id} item={i} wallet={wallet} onNote={setNote} />)}
              </div>
            </section>
          ))}
          <section data-section="milestones" className="sk-shop-section" aria-labelledby="shop-milestones">
            <Board size="heading" tone="wood" hang="nails" className="sk-shop-heading"><h2 id="shop-milestones">Milestones</h2></Board>
            <p className="sk-hand sk-shop-sub">Different words played at the table. Each one pays once, on top of the daily limit.</p>
            <Paper kind="sheet" className="sk-shop-milestones">
              <ul className="sk-bazaar-list">
                {ACHIEVEMENTS.map((a) => (
                  <li key={a.id} data-done={wallet.achieved.includes(a.id) || undefined}>
                    <span>{a.label}</span><span>{wallet.achieved.includes(a.id) ? 'Done' : <>+{a.coins} <CoinIcon size={12} /></>}</span>
                  </li>
                ))}
              </ul>
            </Paper>
          </section>
          <p className="sk-hand sk-shop-foot">Only for show: nothing in the Trading Post changes how a game plays. Wool Coins are earned by playing, never bought.</p>
        </div>
      </div>
      {note && <p role="status" className="sk-shop-note kit-paper kit-paper--slip">{note}</p>}
    </div>
  );
}

function YourBarn({ wallet, account }: { wallet: Wallet; account: boolean }) {
  const lv = levelOf(wallet.xp);
  const segs = 10;
  // The account's daily limit runs on the server's day (UTC); this browser's on the local day.
  const day = account ? new Date().toISOString().slice(0, 10) : localDateKey(new Date());
  const today = wallet.day === day ? Math.min(wallet.earnedToday, DAILY_CAP) : 0;
  return (
    <Paper kind="sheet" className="sk-shop-barn">
      <div className="sk-shop-barn-row">
        <div>
          <p className="sk-display sk-shop-barn-level">Level {lv.level}</p>
          <p className="sk-hand">{titleFor(lv.level)} · {lv.need - lv.into} XP to level {lv.level + 1}</p>
        </div>
        <p className="sk-shop-barn-coins"><CoinIcon size={22} /> {wallet.coins.toLocaleString()} <span className="sk-hand">Wool Coins</span></p>
      </div>
      <Knit segments={segs} filled={Math.floor((lv.into / lv.need) * segs)} />
      <p className="sk-hand">Coins from games today: {today} of {DAILY_CAP}. Levels and milestones pay on top. {wallet.words.length.toLocaleString()} different words played.</p>
      <p className="sk-hand sk-shop-saved">{account ? 'Saved to your account, on every device you sign in on.' : 'Saved in this browser. Sign in to keep it on every device, or use the save code in Settings.'}</p>
    </Paper>
  );
}

function ItemCard({ item, wallet, onNote }: { item: Item; wallet: Wallet; onNote: (s: string) => void }) {
  const [busy, setBusy] = useState(false);
  const owned = wallet.owned.includes(item.id);
  const worn = wallet.equipped[item.kind] === item.id;
  const price = item.price ?? 0;
  const status = worn ? 'Wearing' : owned ? 'Owned' : item.source === 'coins' ? null : `Earned: ${item.streak}-night dream streak`;
  const buy = async () => {
    setBusy(true);
    const r = await buyItem(item.id);
    if (r.ok) { await equipItem(item.id); onNote(`${item.name} is yours, and on.`); } else onNote(SHORT[r.reason]);
    setBusy(false);
  };
  const wear = async () => {
    setBusy(true);
    await equipItem(item.id);
    onNote(`${item.name} is on.`);
    setBusy(false);
  };
  return (
    <article className="sk-shop-card kit-paper kit-paper--note" data-worn={worn || undefined} data-locked={(!owned && item.source !== 'coins') || undefined}>
      <div className="sk-shop-art" aria-hidden="true"><ItemArt item={item} /></div>
      <h3 className="sk-display sk-shop-name">{item.name}</h3>
      <p className="sk-hand sk-shop-blurb">{item.blurb}</p>
      {status && <span className="sk-bazaar-status">{status}</span>}
      <span className="sk-bazaar-actions">
        {item.kind === 'tick' && <Patch as="button" small onClick={() => previewTick(TICK_VOICE[item.id])}>Listen</Patch>}
        {owned && !worn && <Patch as="button" small tone="green" disabled={busy} onClick={() => void wear()}>Wear</Patch>}
        {!owned && item.source === 'coins' && (
          <Brass onClick={() => void buy()} disabled={busy || wallet.coins < price} aria-label={`Buy ${item.name} for ${price} Wool Coins`} className="sk-shop-buy">
            <CoinIcon size={14} /> {price}
          </Brass>
        )}
      </span>
    </article>
  );
}

/** A small pixel picture of the item in its own colours: a bomb, a burst, or a speaker with sound bars. */
function ItemArt({ item }: { item: Item }) {
  const [a, b = a, c = b] = item.swatch;
  if (item.kind === 'bomb') return (
    <svg viewBox="0 0 16 16" width="72" height="72" shapeRendering="crispEdges">
      <rect x="9" y="1" width="1" height="3" fill="#8a6a3a" /><rect x="10" y="0" width="2" height="1" fill={c} />
      <rect x="6" y="4" width="4" height="1" fill={b} />
      <rect x="4" y="5" width="8" height="1" fill={a} /><rect x="3" y="6" width="10" height="6" fill={a} /><rect x="4" y="12" width="8" height="1" fill={a} />
      <rect x="6" y="13" width="4" height="1" fill={b} />
      <rect x="5" y="7" width="2" height="2" fill={c} /><rect x="4" y="9" width="1" height="1" fill={c} />
      <rect x="11" y="9" width="1" height="2" fill={b} />
    </svg>
  );
  if (item.kind === 'blast') return (
    <svg viewBox="0 0 16 16" width="72" height="72" shapeRendering="crispEdges">
      <rect x="7" y="7" width="2" height="2" fill={c} />
      <rect x="7" y="1" width="2" height="4" fill={a} /><rect x="7" y="11" width="2" height="4" fill={a} />
      <rect x="1" y="7" width="4" height="2" fill={a} /><rect x="11" y="7" width="4" height="2" fill={a} />
      <rect x="3" y="3" width="2" height="2" fill={b} /><rect x="11" y="3" width="2" height="2" fill={b} />
      <rect x="3" y="11" width="2" height="2" fill={b} /><rect x="11" y="11" width="2" height="2" fill={b} />
      <rect x="5" y="5" width="1" height="1" fill={c} /><rect x="10" y="5" width="1" height="1" fill={c} />
      <rect x="5" y="10" width="1" height="1" fill={c} /><rect x="10" y="10" width="1" height="1" fill={c} />
    </svg>
  );
  return (
    <svg viewBox="0 0 16 16" width="72" height="72" shapeRendering="crispEdges">
      <rect x="1" y="6" width="3" height="4" fill={a} /><rect x="4" y="4" width="2" height="8" fill={a} /><rect x="6" y="2" width="1" height="12" fill={a} />
      <rect x="9" y="6" width="1" height="4" fill={b} /><rect x="11" y="4" width="1" height="8" fill={b} /><rect x="13" y="2" width="1" height="12" fill={c} />
    </svg>
  );
}
