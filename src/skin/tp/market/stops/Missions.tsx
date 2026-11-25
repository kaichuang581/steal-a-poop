import type { Item } from '../../../shop/catalog';
import { KIND_ONE } from '../../../shop/catalog';
import { ACHIEVEMENTS, BELLS, MISSIONS } from '../../../shop/economy';
import type { Wallet } from '../../../shop/economy';
import { formatCoins } from '../../../shop/format';
import { SHEET, SLIPS } from '../MarketWorld';
import { At, Icon, Knit } from '../pieces';

/** Stop 3, Missions (T6 section 2). */
export function MissionsStop({ wallet, items }: { wallet: Wallet; items: Item[] }) {
  const done = (id: string) => wallet.owned.includes(id);
  return (
    <>
      {MISSIONS.map((m, i) => {
        const item = items[i], slip = SLIPS[i], have = Math.min(m.have(wallet), m.need), d = done(m.itemId);
        return (
          <At key={m.id} box={[slip.x0, slip.y0, slip.x1, slip.y1, slip.z]} className="tp-slip" data-done={d || undefined}>
            <span className="tp-slip-head"><b>{item.name}</b><small>{KIND_ONE[item.kind]}</small></span>
            <span className="tp-slip-goal">{m.label}</span>
            <span className="tp-slip-prog"><Knit value={have / m.need} label={`${have} of ${m.need}`} /><span className="tp-slip-count">{`${formatCoins(have)} / ${formatCoins(m.need)}`}</span></span>
            {d && <span className="tp-stamp" aria-label="Done">Done</span>}
          </At>
        );
      })}
      <At box={[SHEET.x0, SHEET.y0, SHEET.x1, SHEET.y1, SHEET.z]} className="tp-sheet">
        <h3>Milestones <small>Different words played at the table. Each pays once.</small></h3>
        <ul>
          {ACHIEVEMENTS.map((a) => {
            const paid = wallet.achieved.includes(a.id), have = Math.min(a.have(wallet), a.need);
            return (
              <li key={a.id} data-paid={paid || undefined}>
                <span className="tp-ms-goal">{a.label}</span>
                <span className="tp-ms-bar">{paid ? <Icon name="tick" size={14} /> : <Knit value={have / a.need} label={`${have} of ${a.need}`} />}</span>
                <span className="tp-ms-count">{`${formatCoins(have)} / ${formatCoins(a.need)}`}</span>
                <span className="tp-ms-pay"><Icon name="coin" size={14} />{`+${a.coins}`}</span>
                <span className="tp-ms-pay tp-ms-bells"><Icon name="bell" size={14} />{`+${BELLS.achievement}`}</span>
              </li>
            );
          })}
        </ul>
      </At>
    </>
  );
}

/** Phones: this stop's part of the paper roll under the band (T5 section 6, T6 section 5). */
export function MissionsRoll({ wallet, items }: { wallet: Wallet; items: Item[] }) {
  return (
    <div className="tp-roll">
        
          <>
            {MISSIONS.map((m, k) => {
              const it = items[k], have = Math.min(m.have(wallet), m.need), d = wallet.owned.includes(m.itemId);
              return (
                <div key={m.id} className="tp-roll-slip" data-done={d || undefined}>
                  <b>{it.name}</b> <small>{KIND_ONE[it.kind]}</small>
                  <span>{m.label}</span>
                  {m.need <= 7 ? <span className="tp-stamps">{Array.from({ length: m.need }, (_, j) => <i key={j} data-on={j < have || undefined}>{j < have && <Icon name="tick" size={10} />}</i>)}</span> : <Knit value={have / m.need} label={`${have} of ${m.need}`} />}
                  <span className="tp-slip-count">{`${formatCoins(have)} / ${formatCoins(m.need)}`}</span>
                  {d && <span className="tp-stamp">Done</span>}
                </div>
              );
            })}
            <h3>Milestones</h3>
            <ul className="tp-roll-ms">
              {ACHIEVEMENTS.map((a) => {
                const paid = wallet.achieved.includes(a.id), have = Math.min(a.have(wallet), a.need);
                return <li key={a.id} data-paid={paid || undefined}><span>{a.label}</span><span className="tp-roll-ms-row">{paid ? <Icon name="tick" size={12} /> : <Knit value={have / a.need} label={`${have} of ${a.need}`} />}<b>{`${formatCoins(have)} / ${formatCoins(a.need)}`}</b><Icon name="coin" size={12} />{`+${a.coins}`}<Icon name="bell" size={12} />{`+${BELLS.achievement}`}</span></li>;
              })}
            </ul>
            <p className="tp-roll-note">Missions are earned by playing, never found in a sack. Each one is yours for good.</p>
          </>
    </div>
  );
}
