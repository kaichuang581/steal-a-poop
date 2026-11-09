import { useToday } from '../hooks/useToday';
import { wordOfDay } from './pick';

/**
 * The word of the day on Home (docs/PLAN_WORD_OF_THE_DAY.md): no paper, just the words floating in the scene like the
 * table's letters, a dark outline and glow under them so they read over snow, sky or barn. A label, the word, and the
 * gist in a few words. Something to notice, never something owed: no streak, no count, no reward. It changes at local
 * midnight. It never takes clicks, so it can sit over the scene without getting in the way.
 */
export function WordOfDay({ className = '' }: { className?: string }) {
  const entry = wordOfDay(useToday());
  return (
    <section className={`sk-wotd ${className}`} aria-label={`Word of the day: ${entry.word}, ${entry.short}`}>
      <span className="sk-wotd-label" aria-hidden="true">Word of the day</span>
      <span className="sk-wotd-word" lang="en" aria-hidden="true">{entry.word}</span>
      <span className="sk-wotd-short" aria-hidden="true">{entry.short}</span>
    </section>
  );
}
