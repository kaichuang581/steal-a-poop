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
      <div className="sk-title-plank" aria-hidden="true">
        <SnowCap className="sk-title-snow" />
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
      <p className="sk-title-tagline">{tagline}</p>
    </div>
  );
}
