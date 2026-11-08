import { useEffect, useMemo, useState } from 'react';
import { summarize } from '../../engine';
import type { ChainEntry } from '../../engine';
import { lookupDefinition } from '../../lib/define';
import type { DefinitionResult } from '../../lib/define';
import { useStore } from '../../state/store';

const WIKTIONARY = 'https://en.wiktionary.org/wiki/';
const LICENSE_URL = 'https://creativecommons.org/licenses/by-sa/3.0';

type LookupView = { status: 'loading' } | DefinitionResult;

/** Words that actually made it onto the chain, best word first and each word once. */
function playedWords(history: readonly ChainEntry[]): string[] {
  const seen = new Set<string>();
  for (const entry of history) {
    if ((entry.kind === 'play' || entry.kind === 'steal') && entry.word) {
      seen.add(entry.word.toLowerCase());
    }
  }
  return [...seen];
}

function safeSourceUrl(definition: DefinitionResult & { status: 'ok' }): string {
  const source = definition.definition.sourceUrl;
  return source && /^https?:\/\//i.test(source)
    ? source
    : `${WIKTIONARY}${encodeURIComponent(definition.definition.word)}`;
}

/**
 * Inline definitions panel for the end screen. It reads the finished game, lists the best word
 * and every word that landed on the chain, and looks up one word at a time on demand.
 *
 * Add one line inside the end-screen dialog: <WordDefinitions />.
 */
export function WordDefinitions() {
  const game = useStore((s) => s.game);
  const [selected, setSelected] = useState<string | null>(null);
  const [lookup, setLookup] = useState<{ word: string; result: LookupView } | null>(null);

  const { words, best } = useMemo(() => {
    if (!game) return { words: [] as string[], best: null as string | null };
    const bestWord = summarize(game.players).bestWord?.word.toLowerCase() ?? null;
    const history = playedWords(game.history);
    return {
      best: bestWord,
      words: bestWord ? [bestWord, ...history.filter((word) => word !== bestWord)] : history,
    };
  }, [game]);

  useEffect(() => {
    if (!selected) {
      setLookup(null);
      return;
    }
    let live = true;
    setLookup({ word: selected, result: { status: 'loading' } });
    void lookupDefinition(selected)
      .then((result) => {
        if (live) setLookup({ word: selected, result });
      })
      .catch(() => {
        if (live) setLookup({ word: selected, result: { status: 'unavailable', reason: 'failed' } });
      });
    return () => {
      live = false;
    };
  }, [selected]);

  if (!game || game.phase !== 'gameOver' || words.length === 0) return null;

  const view: LookupView | null = selected
    ? lookup?.word === selected
      ? lookup.result
      : { status: 'loading' }
    : null;

  return (
    <section className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3" aria-label="Word meanings">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-black uppercase tracking-wider text-amber-300">Word meanings</h3>
        <span className="text-[11px] text-white/45">Tap a word</span>
      </div>
      <div className="mt-2 flex max-h-28 flex-wrap gap-1.5 overflow-y-auto pr-1">
        {words.map((word) => (
          <button
            key={word}
            type="button"
            onClick={() => setSelected((current) => (current === word ? null : word))}
            aria-pressed={selected === word}
            aria-label={`${word === best ? 'Best word: ' : ''}Show definition for ${word}`}
            title={word === best ? 'Best word' : undefined}
            className={`min-h-11 rounded-lg px-3 py-1.5 text-xs font-black tracking-wide transition-colors ${
              selected === word
                ? 'bg-amber-300 text-[#1a1145]'
                : 'bg-white/10 text-white/85 hover:bg-white/15'
            } ${word === best ? 'ring-1 ring-amber-300/70' : ''}`}
          >
            {word === best ? '★ ' : ''}
            {word.toUpperCase()}
          </button>
        ))}
      </div>

      {selected && view && (
        <div className="mt-2 rounded-xl bg-black/20 p-2.5 text-sm" role="status" aria-live="polite">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              {view.status === 'loading' && <p className="text-white/60">Looking up…</p>}
              {view.status === 'unavailable' && <p className="text-white/70">Definition not available</p>}
              {view.status === 'ok' && (
                <>
                  <p className="text-xs font-black uppercase tracking-wide text-amber-200">
                    {view.definition.word}
                  </p>
                  {view.definition.partOfSpeech && (
                    <p className="text-[11px] uppercase tracking-wide text-white/40">
                      {view.definition.partOfSpeech}
                    </p>
                  )}
                  <p className="mt-1 leading-snug text-white/85">{view.definition.definition}</p>
                  <p className="mt-1.5 text-[11px] leading-snug text-white/40">
                    Definitions from{' '}
                    <a
                      className="underline hover:text-white/70"
                      href={safeSourceUrl(view)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Wiktionary
                    </a>{' '}
                    via Free Dictionary API,{' '}
                    <a
                      className="underline hover:text-white/70"
                      href={LICENSE_URL}
                      target="_blank"
                      rel="noreferrer"
                    >
                      CC BY-SA 3.0
                    </a>
                    .
                  </p>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="min-h-9 min-w-9 rounded-lg bg-white/10 text-sm text-white/70 hover:bg-white/15"
              aria-label="Close definition"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
