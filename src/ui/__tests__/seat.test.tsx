import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { humanTurn } from '../../engine/__tests__/helpers';
import { Seat } from '../Seat';

describe('Seat cosmetics', () => {
  const game = humanTurn();
  const render = (cosmetics?: { badge?: string; title?: string; color?: string }) =>
    renderToStaticMarkup(<Seat player={game.players[1]} turn={game.turn} cosmetics={cosmetics} />);

  it('shows a badge and the title on hover, and keeps the seat\'s own color', () => {
    const html = render({ badge: '🔥', title: 'the Thief', color: '#6ee7b7' });
    expect(html).toContain('🔥');
    expect(html).toContain('title="the Thief"');
    expect(html).toContain(`color:${game.players[1].color}`);
    expect(html).not.toContain('#6ee7b7'); // the name color from the shop would make seats hard to tell apart
  });
  it('shows just the name when nothing is worn', () => {
    const html = render();
    expect(html).toContain(game.players[1].name);
    expect(html).not.toContain('aria-hidden="true">🔥');
  });
});
