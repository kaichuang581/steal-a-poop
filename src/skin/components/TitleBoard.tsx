import pkg from '../../../package.json';
import { UPDATE_NAME } from '../../config';
import { SnowCap } from './SnowCap';

/**
 * The game's title as its own letter board: "FINISH THE" carved on a snowy plank, and "WORD" hanging beneath it on
 * ropes as four wooden letter tiles, each swinging on its own. The last tile glows like the chain letter in a game,
 * the letter the next word has to start with. Pure HTML and CSS (skin.css, .sk-title-*), so it stays crisp at any size.
 */
export function TitleBoard({ title, tagline, compact = false }: { title: string; tagline: string; compact?: boolean }) {
  const words = title.trim().split(/\s+/);
  const last = words.pop() ?? '';
  const lead = words.join(' ');
  const letters = [...last.toUpperCase()];
  return (
    <div className={`sk-title ${compact ? 'sk-title-compact' : ''}`}>
      <h1 className="sr-only">{title}</h1>
      {/* The plank and the hanging tiles form one sign, the plank centred over the tiles. */}
      <div className="sk-title-sign">
      <div className="sk-title-plank" aria-hidden="true">
        <SnowCap className="sk-title-snow" />
        <Holly />
        <span className="sk-nail sk-nail-l" />
        <span className="sk-nail sk-nail-r" />
        <span className="sk-title-lead">{lead.toUpperCase()}</span>
      </div>
      <div className="sk-title-tiles" aria-hidden="true">
        {letters.map((ch, i) => (
          <span
            key={i}
            className={`sk-title-tile ${i === letters.length - 1 ? 'sk-title-tile-next' : ''}`}
            style={{ animationDelay: `${120 + i * 90}ms, ${i * -1.3}s` }}
          >
            <span className="sk-title-rope" />
            <SnowCap className="sk-title-cap" variant="small" />
            {ch}
          </span>
        ))}
      </div>
      </div>
      {/* The tagline, hand-lettered under the tiles, its phrases strung on a line of yarn. */}
      <p className="sk-title-tagline" aria-label={tagline}>
        {tagline.split(/(?<=\.)\s+/).map((part, i, all) => (
          <span key={i} className="sk-title-tag-part" aria-hidden="true">
            {part.replace(/\.$/, '')}
            {i < all.length - 1 && <span className="sk-title-tag-dot" />}
          </span>
        ))}
      </p>
      <p className="sk-update">The {UPDATE_NAME} update · v{pkg.version.split('.').slice(0, 2).join('.')}</p>
    </div>
  );
}

/** A sprig of holly pinned to the plank's corner: two leaves and three berries, drawn in pixels like the game's icons. */
function Holly() {
  return (
    <svg className="sk-title-holly" viewBox="0 0 16 11" aria-hidden="true" shapeRendering="crispEdges">
      <path d="M0 3h2v-1h2v1h2v1h1v2h-1v1h-2v1h-2v-1h-1v-1h1v-1h-2z" fill="#2F6B43" />
      <path d="M16 3h-2v-1h-2v1h-2v1h-1v2h1v1h2v1h2v-1h1v-1h-1v-1h2z" fill="#3A7E50" />
      <path d="M6 5h2v2h-2zM8 5h2v2h-2zM7 7h2v2h-2z" fill="#C8342E" />
    </svg>
  );
}
