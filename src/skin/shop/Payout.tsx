import { useEffect, useState } from 'react';
import { CoinIcon } from '../components/Icons';
import type { GameReward, Payout } from './economy';
import { itemById } from './catalog';
import { grantStreak, payFinishedGame } from './store';

/** Payouts already worked out (or on their way) this session, by game id, so a re-render shows the same lines. */
const shown = new Map<string, Promise<Payout | null>>();

/**
 * Pays a finished game into the Trading Post wallet once and returns what was paid (null until it is known). `id` is
 * null for a game that must not pay (rooms, the tutorial, the admin's end previews, whose seeds start `preview:`).
 * Signed in, the payment goes to the account's wallet on the server, so it arrives a moment after the board.
 */
export function usePayout(id: string | null, reward: GameReward | null): Payout | null {
  const [payout, setPayout] = useState<Payout | null>(null);
  useEffect(() => {
    if (!id || !reward || id.includes('preview:')) return;
    let live = true;
    let p = shown.get(id);
    if (!p) { p = payFinishedGame(id, reward); shown.set(id, p); }
    void p.then((r) => { if (r === null) shown.delete(id); if (live) setPayout(r); });
    return () => { live = false; };
    // The reward is fixed once the game is over; the id says which game it is.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
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
  const [granted, setGranted] = useState<string[]>([]);
  useEffect(() => {
    let live = true;
    void grantStreak(bestStreak).then((ids) => { if (live) setGranted(ids.map((i) => itemById(i)?.name ?? i)); });
    return () => { live = false; };
  }, [bestStreak]);
  if (!payout && !granted.length) return null;
  return (
    <div className="dr-results-payout">
      {payout && <PayoutLines payout={payout} />}
      {granted.length > 0 && <p className="sk-payout-level">New in the Trading Post: {granted.join(', ')}, yours for your dream streak.</p>}
    </div>
  );
}
