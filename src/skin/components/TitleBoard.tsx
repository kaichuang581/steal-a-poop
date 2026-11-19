import { UPDATE_NAME } from '../../config';

/** Development only: `?title=b` and `?title=c` show the two alternate titles on the real screen, to choose between. */
const TRIAL = import.meta.env.DEV && typeof location !== 'undefined' ? new URLSearchParams(location.search).get('title') : null;

/**
 * The game's title as one wordmark (Brian, 2026-11-19: "'fleeced' in all those letter blocks things doesnt fit well cuz
 * its way too long"): the update's name over it, the tagline under it, all three floating in the scene like the word
 * of the day on the other side. No tiles, boards or trim; the look is skin.css's `.sk-title-*`.
 */
export function TitleBoard({ title, tagline, compact = false }: { title: string; tagline: string; compact?: boolean }) {
  const look = TRIAL === 'b' || TRIAL === 'c' ? TRIAL : 'a';
  return (
    <div className={`sk-title ${compact ? 'sk-title-compact' : ''}`} data-title={look}>
      <p className="sk-title-kicker">The {UPDATE_NAME} update</p>
      <h1 className={`sk-title-word ${look === 'c' ? 'kit-plank' : ''}`}>{title}</h1>
      <p className="sk-title-tagline">{tagline}</p>
    </div>
  );
}
