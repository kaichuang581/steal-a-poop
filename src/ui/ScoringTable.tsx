import {
  FAIL_PENALTY, FIRST_ROUND_TURN_MS, LAST_ROUND_TURN_MS, LETTER_BONUS, MIN_TURN_MS, RARITY_MULTIPLIER, STEAL_BONUS,
  STEAL_WINDOW_MS, TRAP_PAYOUT, basePoints, letterBonus, rarityOf,
} from '../engine';
import type { Rarity } from '../engine';
import { MODIFIER_INFO } from '../lib/modifiers';

const SAMPLE = [
  'cat', 'house', 'table', 'mother', 'jazz', 'quiz', 'xylophone', 'rhythm', 'myth', 'zephyr',
  'kayak', 'buzzword', 'whizzing', 'vodka', 'jukebox', 'glossy', 'pizza', 'banjo', 'yacht', 'fjord',
];
const TIERS: Rarity[] = ['common', 'uncommon', 'rare'];
const EXAMPLE = 'jazz';

const examples = (tier: Rarity) => SAMPLE.filter((w) => rarityOf(w) === tier).slice(0, 4);

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-5">
      <h3 className="mb-2 text-sm font-black uppercase tracking-wider text-amber-300">{title}</h3>
      {children}
    </section>
  );
}

/** Every number here comes from the engine constants and functions, so it cannot drift. */
export function ScoringTable() {
  const rarity = rarityOf(EXAMPLE);
  const bonus = letterBonus(EXAMPLE);
  const lengthPoints = Math.round(EXAMPLE.length * RARITY_MULTIPLIER[rarity]);
  const bonusLetters = (value: number) =>
    Object.entries(LETTER_BONUS).filter(([, v]) => v === value).map(([k]) => k.toUpperCase()).join(' ');
  return (
    <div className="text-sm text-white/85">
      <Section title="Word points">
        <p className="mb-2">
          <b>length × rarity multiplier</b> (rounded), <b>plus letter bonuses</b>.
        </p>
        <p className="rounded-lg bg-white/5 p-2">
          <b className="uppercase">{EXAMPLE}</b>: {EXAMPLE.length} letters × {RARITY_MULTIPLIER[rarity].toFixed(1)} ({rarity}) = {lengthPoints},
          + {bonus} bonus = <b>{basePoints(EXAMPLE)} points</b>
        </p>
      </Section>

      <Section title="Rarity tiers">
        <table className="w-full text-left">
          <thead className="text-xs uppercase text-white/50">
            <tr><th className="py-1 pr-3">Tier</th><th className="pr-3">×</th><th>Examples</th></tr>
          </thead>
          <tbody>
            {TIERS.map((t) => (
              <tr key={t} className="border-t border-white/10">
                <td className="py-1 pr-3 font-bold capitalize">{t}</td>
                <td className="pr-3">{RARITY_MULTIPLIER[t].toFixed(1)}</td>
                <td className="uppercase tracking-wide text-white/70">{examples(t).join(', ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-white/55">
          Rarity is an estimate from how common a word’s letters are, not from real word usage. Words made of
          unusual letters, and very long words, rank higher.
        </p>
      </Section>

      <Section title="Letter bonuses">
        <ul className="grid grid-cols-2 gap-2">
          <li className="rounded-lg bg-white/5 p-2"><b className="text-amber-300">+{LETTER_BONUS.x}</b> each: {bonusLetters(LETTER_BONUS.x)}</li>
          <li className="rounded-lg bg-white/5 p-2"><b className="text-amber-300">+{LETTER_BONUS.y}</b> each: {bonusLetters(LETTER_BONUS.y)}</li>
        </ul>
        <p className="mt-2 text-xs text-white/55">Bonuses count every occurrence. X, Z, Q and J are also the trap letters.</p>
      </Section>

      <Section title="Round modifiers (one per round)">
        <ul className="space-y-1">
          {Object.values(MODIFIER_INFO).map((m) => (
            <li key={m.label} className="flex gap-2 rounded-lg bg-white/5 p-2">
              <span aria-hidden="true">{m.emoji}</span>
              <span><b>{m.label}.</b> {m.detail}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Timer">
        <p>
          Turns get faster every round: {FIRST_ROUND_TURN_MS / 1000}s in the first round, down to {LAST_ROUND_TURN_MS / 1000}s in the last
          (16s, 11s, 5s in a three-round game). The pile takes off 1s for every 10 points, never below {MIN_TURN_MS / 1000}s.
          Under “Double points, −2s” turns are 2s shorter still. Longer piles mean less thinking time.
        </p>
      </Section>

      <Section title="Other numbers">
        <ul className="space-y-1">
          <li className="rounded-lg bg-white/5 p-2"><b>Steal:</b> take the whole pile (including your word) and +{STEAL_BONUS}, during the last {STEAL_WINDOW_MS / 1000}s of someone else’s turn. Unlimited.</li>
          <li className="rounded-lg bg-white/5 p-2"><b>Trap:</b> end on X, Z, Q or J. If the next player fails, you get +{TRAP_PAYOUT}.</li>
          <li className="rounded-lg bg-white/5 p-2"><b>Timeout</b> (no word submitted): −{FAIL_PENALTY}. An invalid word costs nothing. You just retype it.</li>
          <li className="rounded-lg bg-white/5 p-2"><b>Failed steal:</b> your whole banked score is halved, rounded down (33 → 16; −22 → −33). A clear typo gets a suggested fix instead.</li>
          <li className="rounded-lg bg-white/5 p-2"><b>Burn:</b> any pile still unbanked at the end of a round is lost.</li>
        </ul>
      </Section>
    </div>
  );
}
