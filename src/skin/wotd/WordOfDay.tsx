import { useToday } from '../hooks/useToday';
import { wordOfDay } from './pick';

const POS = { n: 'noun', v: 'verb', adj: 'adjective' } as const;

/**
 * The word of the day on Home (docs/PLAN_WORD_OF_THE_DAY.md), set like a dictionary's: the word, how to say it and what
 * kind of word it is, a strand of yarn, then the gist. No paper: the words float in the scene, white over a dark
 * outline and glow so they read over snow, sky or barn, tilted and swaying a little like the title's hanging tiles.
 * Something to notice, never something owed: no streak, no count, no reward. It changes at local midnight. It never
 * takes clicks, so it can sit over the scene without getting in the way.
 */
export function WordOfDay({ className = '' }: { className?: string }) {
  const e = wordOfDay(useToday());
  return (
    <section className={`sk-wotd ${className}`} aria-label={`Word of the day: ${e.word}, ${POS[e.pos]}, said ${e.say}: ${e.short}`}>
      <span className="sk-wotd-label" aria-hidden="true">Word of the day!</span>
      <span className="sk-wotd-word" lang="en" aria-hidden="true">{e.word}</span>
      <span className="sk-wotd-say" aria-hidden="true">
        <span className="sk-wotd-ipa">/{e.say}/</span>
        <span className="sk-wotd-pos">{POS[e.pos]}</span>
      </span>
      <span className="sk-wotd-yarn" aria-hidden="true" />
      <span className="sk-wotd-short" aria-hidden="true">{e.short}</span>
    </section>
  );
}
