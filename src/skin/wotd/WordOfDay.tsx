import { useToday } from '../hooks/useToday';
import { wordOfDay } from './pick';

const POS = { n: 'noun', v: 'verb', adj: 'adjective' } as const;

/**
 * The word of the day on Home (docs/PLAN_WORD_OF_THE_DAY.md), set like a dictionary's: the word, how to say it and what
 * kind of word it is, then the gist. On a computer it is a clean card in the slab's night blue (home/home.css, Brian,
 * 2026-11-20: "that should also look better and cleaner"); on a phone, a line under the title. Something to notice,
 * never something owed: no streak, no count, no reward. It changes at local midnight. It never takes clicks.
 */
export function WordOfDay({ className = '' }: { className?: string }) {
  const e = wordOfDay(useToday());
  return (
    <section className={`sk-wotd ${className}`} aria-label={`Word of the day: ${e.word}, ${POS[e.pos]}, said ${e.say}: ${e.short}`}>
      <span className="sk-wotd-label" aria-hidden="true">Word of the day</span>
      <span className="sk-wotd-word" lang="en" aria-hidden="true">{e.word}</span>
      <span className="sk-wotd-say" aria-hidden="true">
        <span className="sk-wotd-ipa">/{e.say}/</span>
        <span className="sk-wotd-pos">{POS[e.pos]}</span>
      </span>
      <span className="sk-wotd-short" aria-hidden="true">{e.short}</span>
    </section>
  );
}
