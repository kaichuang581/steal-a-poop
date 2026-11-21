import type { CSSProperties, ReactNode } from 'react';
import queue from '../assets/menu/queue.png';
import lobby from '../assets/menu/lobby.png';
import join from '../assets/menu/join.png';
import dream from '../assets/menu/dream.png';
import practice from '../assets/menu/practice.png';
import tutorial from '../assets/menu/tutorial.png';
import './home.css';

/** Brian's menu icons (2026-11-20), by menu item. */
export const MENU_ICONS: Record<string, string> = { queue, lobby, join, dream, repair: dream, practice, tutorial };
export const MenuIcon = ({ id }: { id: string }) => (MENU_ICONS[id] ? <img src={MENU_ICONS[id]} alt="" draggable={false} /> : null);

/**
 * The words that slide across Home's panel: word chains, each word starting with the last letter of the one before, and
 * each row coming round to its start. Every word is in public/words.txt (a test checks both).
 */
export const WORD_CHAINS: readonly string[][] = [
  ['LAMB', 'BARN', 'NIGHT', 'TINSEL', 'LANTERN', 'NOEL'],
  ['GIFT', 'TREE', 'EWE', 'EMBER', 'RAM', 'MITTEN', 'NUTMEG'],
  ['FROST', 'TRACTOR', 'ROOSTER', 'RAKE', 'ELF'],
  ['SLED', 'DREAM', 'MOON', 'NEST', 'TWIG', 'GRASS'],
  ['HAY', 'YARN', 'NAP', 'PIE', 'EGG', 'GOOSE', 'EARTH'],
  ['CABIN', 'NUTMEG', 'GARLIC'],
];
const ROWS = 36;

/** The night-blue panel with the words sliding across all of it, and its edge. Decoration only. */
export function HomeSlab() {
  return (
    <div className="hm-panel" aria-hidden="true">
      <div className="hm-panel-fill">
        <div className="hm-rows">
          {Array.from({ length: ROWS }, (_, r) => {
            const words = WORD_CHAINS[(r * 5) % WORD_CHAINS.length];
            const text = [...words, ...words].join(' ');
            // The text twice: the row slides half its length and comes round seamlessly.
            return <div key={r} className="hm-row" style={{ '--t': `${[60, 75, 90][r % 3]}s` } as CSSProperties}><span>{text}{' '}{text}{' '}</span></div>;
          })}
        </div>
      </div>
      <div className="hm-panel-edge" />
    </div>
  );
}

/** What each letter is worth on a word game's tile: the corner number on the title's blocks. */
const LETTER_POINTS: Record<string, number> = { A: 1, B: 3, C: 3, D: 2, E: 1, F: 4, G: 2, H: 4, I: 1, J: 8, K: 5, L: 1, M: 3, N: 1, O: 1, P: 3, Q: 10, R: 1, S: 1, T: 1, U: 1, V: 4, W: 4, X: 8, Y: 4, Z: 10 };

/**
 * The game's name as wool letter tiles, one letter each: knitted faces with a stitched border and the letter's worth in
 * the corner, as on a word game's tiles (Brian, 2026-11-20: the plain blocks round each letter should look intentional).
 * The last one has been fleeced.
 */
export function HomeTitle({ title, tagline }: { title: string; tagline?: ReactNode }) {
  const letters = [...title.toUpperCase()];
  return (
    <div className="hm-title">
      <h1 className="hm-blocks" aria-label={title}>
        {letters.map((c, i) => (
          <span key={i} className={`hm-block-l${i === letters.length - 1 ? ' hm-fleeced' : ''}`} style={{ '--i': i } as CSSProperties} aria-hidden="true">
            <span>{c}</span>
            {LETTER_POINTS[c] && <b className="hm-pts">{LETTER_POINTS[c]}</b>}
            {i === letters.length - 1 && <><i className="hm-tuft" /><i className="hm-tuft" /><i className="hm-tuft" /></>}
          </span>
        ))}
      </h1>
      {tagline && <p className="hm-tagline">{tagline}</p>}
    </div>
  );
}
