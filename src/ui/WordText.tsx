import { TRAP_LETTERS } from '../engine';

/** Renders a word; X/Z/Q/J flash gold. */
export function WordText({ word, flash = true }: { word: string; flash?: boolean }) {
  return (
    <>
      {[...word].map((ch, i) =>
        TRAP_LETTERS.has(ch.toLowerCase()) ? (
          <span key={i} className={`inline-block text-amber-300 ${flash ? 'gold-flash' : ''}`}>{ch}</span>
        ) : (
          <span key={i}>{ch}</span>
        ),
      )}
    </>
  );
}
