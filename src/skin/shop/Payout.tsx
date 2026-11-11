import { useState } from 'react';
import { CoinIcon } from '../components/Icons';
import type { GameReward, Payout } from './economy';
import { itemById } from './catalog';
import { grantStreak, payFinishedGame } from './store';

/** Payouts already worked out this session, by game id, so a re-render (or React's double render) shows the same lines. */
const shown = new Map<string, Payout>();

/**
 * Pays a finished game into the Barn Bazaar wallet once and returns what was paid. `id` is null for a game that must not
 * pay (rooms, the tutorial, the admin's end previews, whose seeds start `preview:`).
 */
export function usePayout(id: string | null, reward: GameReward | null): Payout | null {
  const [payout] = useState(() => {
    if (!id || !reward || id.includes('preview:')) return null;
    const hit = shown.get(id);
    if (hit) return hit;
    const p = payFinishedGame(id, reward);
    shown.set(id, p);
    return p;
  });
  return payout && payout.lines.length ? payout : null;
}

/** What a game paid, for a results board. */
export function PayoutLines({ payout, className = '' }: { payout: Payout; className?: string }) {
  return (
    <div className={`sk-payout ${className}`} aria-label={`You earned ${payout.coins} Wool Coins`}>
      <p className="sk-payout-total"><CoinIcon size={18} /> +{payout.coins} Wool Coins</p>
      <ul className="sk-payout-lines">
        {payout.lines.map((l) => <li key={l.label}><span>{l.label}</span><span>{l.coins >= 0 ? `+${l.coins}` : l.coins}</span></li>)}
      </ul>
      {payout.levelUp && <p className="sk-payout-level">Level {payout.levelUp.to}!{payout.levelUp.title ? ` You are now a ${payout.levelUp.title}.` : ''}</p>}
    </div>
  );
}

/** The dream's results: its Wool Coins, and any streak item the best streak has now earned (kept for good). */
export function DreamPayout({ id, sheep, slept, bestStreak }: { id: string; sheep: number; slept: boolean; bestStreak: number }) {
  const payout = usePayout(id, { mode: 'dream', sheep, slept });
  const [granted] = useState(() => grantStreak(bestStreak).map((i) => itemById(i)?.name ?? i));
  if (!payout && !granted.length) return null;
  return (
    <div className="dr-results-payout">
      {payout && <PayoutLines payout={payout} />}
      {granted.length > 0 && <p className="sk-payout-level">New in the Barn Bazaar: {granted.join(', ')}, yours for your dream streak.</p>}
    </div>
  );
}
