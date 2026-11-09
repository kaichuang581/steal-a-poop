import { useStore } from '../../state/store';

export type EndPreview = 'won' | 'lost' | 'run';

/**
 * Admin only (Brian, 2026-11-08: "a screen where u can autowin so i can see what post game looks like"): deals a fresh
 * game and jumps straight to its end, a Quick Game won or lost, or a practice run over. The finished game is set
 * directly, never played through the reducer, so nothing is recorded: no win, best, streak or practice score is saved.
 * The results show made-up numbers, with "new best" on a win so that state can be seen too.
 */
export function previewEnd(kind: EndPreview): boolean {
  const store = useStore.getState();
  if (!store.start(kind === 'run' ? 'practice' : 'quick')) return false;
  const g = structuredClone(useStore.getState().game!);
  g.phase = 'gameOver';
  g.turn = null;
  g.round = 4;
  const me = g.players[0];
  me.wordsPlayed = 17;
  me.longestWord = kind === 'won' ? 'snowflakes' : 'barnyard';
  if (kind === 'run') {
    me.lives = 0; me.frozen = true; me.frozenAt = 1;
    g.winners = [1];
    useStore.setState({ game: g, practiceResult: { score: 17, best: 17, isNew: true } });
    return true;
  }
  // Everyone but the winner froze, one after another; a loss leaves you third.
  const winner = kind === 'won' ? 0 : 1;
  g.winners = [winner];
  g.players.forEach((p, i) => {
    if (i === winner) { p.lives = kind === 'won' ? 2 : 1; p.frozen = false; p.frozenAt = null; return; }
    p.lives = 0; p.frozen = true; p.frozenAt = (i === 0 ? g.players.length - 1.5 : i) * 1000;
    if (i > 0) { p.wordsPlayed = 4 + i * 2; p.longestWord = ['tractor', 'meadow', 'hay', 'fleece', 'woolly', 'clover'][i - 1] ?? 'baa'; }
  });
  useStore.setState({
    game: g,
    gameResult: { bests: { wool: me.lives, longest: me.longestWord }, beat: { wool: kind === 'won', longest: kind === 'won' } },
  });
  return true;
}
