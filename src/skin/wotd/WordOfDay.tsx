import { useToday } from '../hooks/useToday';
import { useEffect, useState } from 'react';
import { getLang } from '../../lib/lang';
import { pickFrom, wordOfDay } from './pick';
import type { WotdEntry } from './words';

const POS_EN = { n: 'noun', v: 'verb', adj: 'adjective' } as const;
const POS_FR = { n: 'nom', v: 'verbe', adj: 'adjectif' } as const;

type ByLevel = Record<1 | 2 | 3, WotdEntry[]>;
let frList: Promise<ByLevel | null> | null = null;
/** The French words of the day, public/wotd-fr.json, fetched once and only in French. */
function loadFrench(): Promise<ByLevel | null> {
  frList ??= fetch(`${import.meta.env.BASE_URL}wotd-fr.json`)
    .then((r) => (r.ok ? r.json() : null))
    .then((all: WotdEntry[] | null) => (all ? { 1: all.filter((w) => w.level === 1), 2: all.filter((w) => w.level === 2), 3: all.filter((w) => w.level === 3) } : null))
    .catch(() => null);
  return frList;
}

/**
 * The word of the day on Home (docs/PLAN_WORD_OF_THE_DAY.md), set like a dictionary's: the word, how to say it and what
 * kind of word it is, then the gist. On a computer it is text over the scenery under the top-right buttons, tilted a
 * little (home/home.css, Brian, 2026-11-20); on a phone, one line above the footer. In French, the French word list. Something to notice,
 * never something owed: no streak, no count, no reward. It changes at local midnight. It never takes clicks.
 */
export function WordOfDay({ className = '' }: { className?: string }) {
  const today = useToday();
  const fr = getLang() === 'fr';
  const [french, setFrench] = useState<ByLevel | null>(null);
  useEffect(() => { if (fr) void loadFrench().then(setFrench); }, [fr]);
  if (fr && !french) return null;
  const e = fr && french ? pickFrom(french, today) : wordOfDay(today);
  const POS = fr ? POS_FR : POS_EN;
  return (
    <section className={`sk-wotd ${className}`} aria-label={`Word of the day: ${e.word}, ${POS[e.pos]}, said ${e.say}: ${e.short}`}>
      <span className="sk-wotd-label" aria-hidden="true">Word of the day</span>
      <span className="sk-wotd-word" lang={fr ? 'fr' : 'en'} data-i18n-skip aria-hidden="true">{e.word}</span>
      <span className="sk-wotd-say" aria-hidden="true">
        <span className="sk-wotd-ipa">/{e.say}/</span>
        <span className="sk-wotd-pos">{POS[e.pos]}</span>
      </span>
      <span className="sk-wotd-short" data-i18n-skip aria-hidden="true">{e.short}</span>
    </section>
  );
}
