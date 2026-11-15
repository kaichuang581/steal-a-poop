import { parseFrequencyRanks, validateWord } from '../../engine';
import type { Dictionary, GameState } from '../../engine';

/**
 * The words the tutorial's hint book offers. The engine's own picker (`suggestWords`) calls a word common when the
 * frequency list says so, and guesses from its letters when the list has never heard of it, so a word too rare to be
 * on the list at all counts as common: a first-time player was offered BEVOR, BRINERS and JOSHER. Here an idea has to
 * be on the list, and near the top of it: an everyday word, short, that fits the letter and the round.
 */
let ranks: Map<string, number> | null = null;
let loading: Promise<void> | null = null;

/** Fetches the frequency list (the browser already has or will have it: the engine reads the same file). */
export function loadIdeaRanks(url = `${import.meta.env.BASE_URL}word-frequency.txt`): Promise<void> {
  if (ranks) return Promise.resolve();
  loading ??= (async () => {
    try {
      const res = await fetch(url);
      if (res.ok) ranks = parseFrequencyRanks(await res.text());
      else loading = null;
    } catch {
      loading = null; // the book falls back to the engine's ideas, and the next tutorial tries again
    }
  })();
  return loading;
}

/** For tests: put a list in place, or take it away. */
export function setIdeaRanks(next: Map<string, number> | null) {
  ranks = next;
  loading = null;
}

/** How far down the frequency list a word may be and still be offered: about the first 8,000 words of English. */
export const EVERYDAY_RANK = 8000;
/** Ideas are drawn from this many of the commonest fits, so the book does not offer the same three every time. */
const SHORTLIST = 40;

/**
 * Up to `count` everyday words that would be accepted right now: 4 to 7 letters, starting with the chain's letter,
 * not used yet, obeying the round's twist. Null when the list is not in yet or too few words fit, and the caller
 * falls back to the engine's picker.
 */
export function everydayIdeas(dict: Dictionary, game: Pick<GameState, 'chainLetter' | 'used' | 'modifier'>, count: number, random: () => number = Math.random): string[] | null {
  const list = ranks;
  if (!list) return null;
  const rank = (w: string) => list.get(w) ?? Infinity;
  const fits = dict.startingWith(game.chainLetter)
    .filter((w) => w.length >= 4 && w.length <= 7 && rank(w) <= EVERYDAY_RANK)
    .filter((w) => validateWord(w, { dict, chainLetter: game.chainLetter, used: game.used, modifier: game.modifier }).ok)
    .sort((a, b) => rank(a) - rank(b))
    .slice(0, SHORTLIST);
  if (fits.length < count) return null;
  const out: string[] = [];
  while (out.length < count) out.push(fits.splice(Math.floor(random() * fits.length), 1)[0]);
  return out;
}
