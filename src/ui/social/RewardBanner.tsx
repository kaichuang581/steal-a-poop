import { useRoomStore } from '../../state/roomStore';

/** On the end screen of a server game: what the game paid. */
export function RewardBanner() {
  const reward = useRoomStore((s) => s.lastReward);
  if (!reward) return null;
  return (
    <section aria-label="Coins earned" className="mt-3 rounded-xl border border-amber-300/50 bg-amber-500/10 p-3 text-sm">
      <p className="font-black text-amber-200">You earned {reward.coins} 🪙 <span className="font-normal text-white/60">(you have {reward.balance})</span></p>
      <ul className="mt-1 text-white/80">
        {reward.parts.map((p) => <li key={p.label}>{p.label}: {p.coins >= 0 ? '+' : ''}{p.coins}</li>)}
      </ul>
    </section>
  );
}
