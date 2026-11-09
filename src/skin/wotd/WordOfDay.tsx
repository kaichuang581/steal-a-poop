import { useEffect, useId, useState } from 'react';
import { useToday } from '../hooks/useToday';
import { Paper } from '../kit';
import { wordOfDay } from './pick';

/**
 * The word of the day: a paper slip pinned by the title board on Home (docs/PLAN_WORD_OF_THE_DAY.md). Folded, it shows
 * the word; a click, a tap or Enter opens it to the meaning and an example, and again folds it. Something to notice,
 * never something owed: no streak, no count, no reward, no "come back tomorrow". It changes at local midnight.
 */
export function WordOfDay({ className = '' }: { className?: string }) {
  const today = useToday();
  const entry = wordOfDay(today);
  const [open, setOpen] = useState(false);
  const id = useId();
  useEffect(() => setOpen(false), [today]);
  return (
    <Paper kind="note" pin="top" seed={4} className={`sk-wotd ${className}`} data-open={open || undefined}>
      <button type="button" className="sk-wotd-toggle" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
        <span className="sk-wotd-label">Word of the day</span>
        <span className="sk-wotd-word" lang="en">{entry.word}</span>
      </button>
      <div id={id} className="sk-wotd-more" hidden={!open}>
        <p className="sk-wotd-meaning">{entry.meaning}</p>
        <p className="sk-wotd-example">{entry.example}</p>
      </div>
    </Paper>
  );
}
