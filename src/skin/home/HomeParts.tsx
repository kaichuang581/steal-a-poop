import type { CSSProperties, ReactNode } from 'react';
import { HomeArt } from './HomeArt';
import type { ArtId } from './HomeArt';
import './home.css';

/**
 * Word chains for the slab behind Home's menu: every word starts with the last letter of the one before, and each row
 * comes round to its start, so the scroll never breaks the rule at its seam. Every word is in public/words.txt (a test
 * checks both).
 */
export const WORD_CHAINS: readonly string[][] = [
  ['LAMB', 'BARN', 'NIGHT', 'TINSEL', 'LANTERN', 'NOEL'],
  ['GIFT', 'TREE', 'EWE', 'EMBER', 'RAM', 'MITTEN', 'NUTMEG'],
  ['FROST', 'TRACTOR', 'ROOSTER', 'RAKE', 'ELF'],
  ['SLED', 'DREAM', 'MOON', 'NEST', 'TWIG', 'GRASS'],
  ['HAY', 'YARN', 'NAP', 'PIE', 'EGG', 'GOOSE', 'EARTH'],
  ['CABIN', 'NUTMEG', 'GARLIC'],
];

/** The night-blue slab with the chains drifting across it, and its lit edge. Decoration only. */
export function HomeSlab({ rows }: { rows: number }) {
  const chain = (words: readonly string[], k: number) => words.map((w, i) => <i key={`${k}-${i}`}>{w.slice(0, -1)}<b>{w.at(-1)}</b></i>);
  return (
    <>
      <div className="hm-slab" aria-hidden="true">
        <div className="hm-chains">
          {Array.from({ length: rows }, (_, r) => {
            const words = WORD_CHAINS[r % WORD_CHAINS.length];
            // Four copies: the row drifts half its length, so the second half takes the first one's place.
            return <div key={r} className="hm-chain" style={{ '--t': `${80 + (r % 3) * 22}s` } as CSSProperties}><span>{[0, 1, 2, 3].map((k) => chain(words, k))}</span></div>;
          })}
        </div>
      </div>
      <div className="hm-edge" aria-hidden="true" />
    </>
  );
}

/** The game's name in its own letter tiles, standing in a rack, the tagline under it. */
export function HomeTitle({ title, tagline }: { title: string; tagline?: ReactNode }) {
  const letters = [...title.toUpperCase()];
  return (
    <div className="hm-title" style={{ '--count': letters.length } as CSSProperties}>
      <h1 className="hm-tiles" aria-label={title}>
        {letters.map((c, i) => <span key={i} className="hm-tile" style={{ '--i': i } as CSSProperties} aria-hidden="true">{c}</span>)}
      </h1>
      <div className="hm-rack hm-board" aria-hidden="true" />
      {tagline && <p className="hm-tagline">{tagline}</p>}
    </div>
  );
}

/** The menu items' pictures: Counting Sheep's repair is the same dream. */
const ART: Record<string, ArtId> = { queue: 'queue', lobby: 'lobby', join: 'join', dream: 'dream', repair: 'dream', practice: 'practice', tutorial: 'tutorial' };

/** The card on the right for the chosen menu item: its picture, its name, what it is, and anything it offers. */
export function HomeCard({ id, title, text, badge, children }: { id: string; title: ReactNode; text: ReactNode; badge?: ReactNode; children?: ReactNode }) {
  const art = ART[id];
  return (
    <aside className="hm-card hm-board" aria-live="polite">
      <div className="hm-card-art">{art && <HomeArt key={art} id={art} />}</div>
      <div className="hm-card-body">
        <div className="hm-card-title"><h2>{title}</h2>{badge}</div>
        <div className="hm-card-text">{text}</div>
        {children}
      </div>
    </aside>
  );
}
