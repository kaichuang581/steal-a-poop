import type { Item } from '../../../shop/catalog';
import { KIND_ONE } from '../../../shop/catalog';
import { ACHIEVEMENTS, BELLS, MISSIONS } from '../../../shop/economy';
import type { Wallet } from '../../../shop/economy';
import { formatCoins } from '../../../shop/format';
import { BEAM, PLAQUES, RAIL } from '../MarketWorld';
import { At, Icon } from '../pieces';
import { KIND_TONE, Lantern, Meter, Moons, Ribbon, Snow } from '../signs';

/**
 * Stop 3, Missions. The prizes stand in the case (the scene); under each hangs its plaque: the name, what earns it, a
 * moon for every night (a meter when there are too many to count), the count. The milestones are a rail of lanterns
 * on the snow in front: each lights when its target is passed, and the next one fills from the bottom as it nears.
 */
export function MissionsStop({ wallet, items }: { wallet: Wallet; items: Item[] }) {
  const done = (id: string) => wallet.owned.includes(id);
  // Milestones in the rail's order, in groups that count the same thing (the words, then the rare letters).
  const groups: { label: string; have: number; of: typeof ACHIEVEMENTS }[] = [];
  for (const a of ACHIEVEMENTS) {
    const label = a.label.replace(/^[\d,]+ /, ''), g = groups[groups.length - 1];
    if (g && g.label === label) g.of.push(a); else groups.push({ label, have: a.have(wallet), of: [a] });
  }
  return (
    <>
      <At p={[BEAM.x, BEAM.y, BEAM.z]} className="mk-beam"><p>Missions are earned by playing, never found in a sack. Each one is yours for good.</p></At>
      {MISSIONS.map((m, i) => {
        const item = items[i], q = PLAQUES[i], have = Math.min(m.have(wallet), m.need), d = done(m.itemId);
        return (
          <At key={m.id} box={[q.x0, q.y0, q.x1, q.y1, q.z]} className="mk-plaque mk-board mk-board--cream" data-done={d || undefined}>
            <Ribbon tone={KIND_TONE[item.kind]} seal={item.kind} className="mk-plaque-kind">{KIND_ONE[item.kind]}</Ribbon>
            <span className="mk-plaque-head"><b>{item.name}</b>{d ? <Ribbon tone="green" seal="yes" className="mk-plaque-done">Yours</Ribbon> : <span className="mk-plaque-count"><b>{formatCoins(have)}</b>{` / ${formatCoins(m.need)}`}</span>}</span>
            <span className="mk-plaque-goal">{m.label}</span>
            {m.need <= 7 ? <Moons have={have} need={m.need} label={`${have} of ${m.need}`} /> : <Meter pale marks={10} value={have / m.need} label={`${have} of ${m.need}`} />}
          </At>
        );
      })}
      <At box={[RAIL.x0, RAIL.y0, RAIL.x1, RAIL.y1, RAIL.z]} className={`mk-rail mk-board mk-board--night`}>
        <Snow />
        <div className="mk-rail-title"><h3>Milestones</h3><p>Each pays once,<br />with <Icon name="bell" /><b>{`+${BELLS.achievement}`}</b></p></div>
        {groups.map((g) => {
          const next = g.of.findIndex((a) => !wallet.achieved.includes(a.id) && g.have < a.need);
          return (
            <div key={g.label} className="mk-rail-group">
              <p className="mk-rail-what"><b>{formatCoins(g.have)}</b>{g.label}</p>
              <ul>
                {g.of.map((a, k) => {
                  const paid = wallet.achieved.includes(a.id) || g.have >= a.need, from = k ? g.of[k - 1].need : 0;
                  return (
                    <li key={a.id} data-paid={paid || undefined}>
                      <Lantern fill={paid ? 1 : k === next ? Math.max(0, (g.have - from) / (a.need - from)) : 0} />
                      <span className="mk-rail-node"><b>{formatCoins(a.need)}</b><span className="mk-rail-pay"><Icon name="coin" />{`+${a.coins}`}</span></span>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </At>
    </>
  );
}

/** Phones: this stop's part of the board under the stalls. */
export function MissionsRoll({ wallet, items }: { wallet: Wallet; items: Item[] }) {
  return (
    <div className="tp-roll">
      {MISSIONS.map((m, k) => {
        const it = items[k], have = Math.min(m.have(wallet), m.need), d = wallet.owned.includes(m.itemId);
        return (
          <div key={m.id} className="tp-roll-slip" data-done={d || undefined}>
            <span><b>{it.name}</b>{d ? <Ribbon tone="green" seal="yes">Yours</Ribbon> : <Ribbon tone={KIND_TONE[it.kind]} seal={it.kind}>{KIND_ONE[it.kind]}</Ribbon>}</span>
            <span>{m.label}</span>
            <span className="tp-roll-prog">{m.need <= 7 ? <Moons have={have} need={m.need} label={`${have} of ${m.need}`} /> : <Meter pale marks={10} value={have / m.need} label={`${have} of ${m.need}`} />}{!d && <b>{`${formatCoins(have)} / ${formatCoins(m.need)}`}</b>}</span>
          </div>
        );
      })}
      <h3>Milestones<small>{`Each pays once, with +${BELLS.achievement} Bells`}</small></h3>
      <ul className="tp-roll-ms">
        {ACHIEVEMENTS.map((a) => {
          const paid = wallet.achieved.includes(a.id), have = Math.min(a.have(wallet), a.need);
          return (
            <li key={a.id} data-paid={paid || undefined}>
              <Lantern fill={paid ? 1 : have / a.need} />
              <span><span>{a.label}</span>{!paid && <Meter pale value={have / a.need} label={`${have} of ${a.need}`} />}</span>
              <b>{paid ? 'Paid' : `+${a.coins}`}</b>
            </li>
          );
        })}
      </ul>
      <p className="tp-roll-note">Missions are earned by playing, never found in a sack. Each one is yours for good.</p>
    </div>
  );
}
