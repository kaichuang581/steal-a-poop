/**
 * Chat filter. It only decides whether a message should be held; what happens to the sender is the
 * moderation service's job. Everything is derived from a blocklist passed in, so the evasion
 * handling can be tested with made-up words.
 */

/** Symbols and digits people use for letters. "1" and "|" can mean "i" or "l", so both are tried. */
const LEET: Record<string, string> = {
  '0': 'o', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '9': 'g',
  '@': 'a', $: 's', '!': 'i', '+': 't', '€': 'e', '£': 'l',
};
const AMBIGUOUS = ['1', '|'];
const ZERO_WIDTH = /[\u200b-\u200f\u2060\ufeff\u00ad]/g;
export type Variant = 'i' | 'l';
export const VARIANTS: readonly Variant[] = ['i', 'l'];

/** Lowercase, strip accents and invisible characters, and undo number and symbol swaps. */
export function deLeet(text: string, variant: Variant = 'i'): string {
  const base = text.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(ZERO_WIDTH, '').toLowerCase();
  let out = '';
  for (const ch of base) out += AMBIGUOUS.includes(ch) ? variant : (LEET[ch] ?? ch);
  return out;
}

/** Runs of three or more of the same letter become two, so "sshiiit" and "shit" line up. */
function trimRuns(s: string): string {
  return s.replace(/(.)\1{2,}/g, '$1$1');
}

/** Letters only, no spaces or punctuation. Used to catch spaced-out or dotted-out words. */
export function squash(text: string, variant: Variant = 'i'): string {
  return trimRuns(deLeet(text, variant).replace(/[^a-z]/g, ''));
}

/**
 * Splits a message into word-like tokens. A symbol counts as a letter only inside or at the start
 * of a word ("sh!t", "$hit"): punctuation at the end ("shit!") is dropped, so it cannot hide a word.
 */
export function tokenize(text: string, variant: Variant = 'i'): string[] {
  const tokens: string[] = [];
  for (const chunk of text.split(/\s+/)) {
    const trimmed = chunk.replace(/[^\p{L}\p{N}]+$/u, '').replace(/^[^\p{L}\p{N}$@]+/u, '');
    if (!trimmed) continue;
    for (const part of deLeet(trimmed, variant).split(/[^a-z]+/)) if (part) tokens.push(trimRuns(part));
  }
  return tokens;
}

/** "s h i t" -> "shit": runs of three or more single letters are joined into one token. */
function joinSpelledRuns(tokens: string[]): { text: string; joined: boolean }[] {
  const out: { text: string; joined: boolean }[] = [];
  let run: string[] = [];
  const flush = () => {
    if (run.length >= 3) out.push({ text: run.join(''), joined: true });
    else for (const t of run) out.push({ text: t, joined: false });
    run = [];
  };
  for (const t of tokens) {
    if (t.length === 1) run.push(t);
    else {
      flush();
      out.push({ text: t, joined: false });
    }
  }
  flush();
  return out;
}

/** One letter per run: "fuuuck" -> "fuck". Only used for entries of four or more letters. */
const aggressive = (s: string) => s.replace(/(.)\1+/g, '$1');

export interface FilterOptions {
  blocklist: readonly string[];
  /** True for ordinary dictionary words. A blocked string inside one of these is not flagged. */
  isWord: (w: string) => boolean;
  /** Entries at least this long are also searched for inside longer text. */
  minSubstring?: number;
}

export interface FilterHit {
  term: string;
  kind: 'word' | 'phrase' | 'spaced' | 'embedded';
}

export class ChatFilter {
  private single = new Set<string>();
  private aggressiveSingle = new Set<string>();
  private long: string[] = []; // squashed entries searched as substrings
  private minSubstring: number;

  constructor(private opts: FilterOptions) {
    this.minSubstring = opts.minSubstring ?? 5;
    const longSet = new Set<string>();
    for (const raw of opts.blocklist) {
      const entry = raw.trim().toLowerCase();
      if (!entry) continue;
      const sq = squash(entry);
      if (!sq) continue;
      if (!entry.includes(' ')) {
        this.single.add(trimRuns(deLeet(entry).replace(/[^a-z]/g, '')));
        if (sq.length >= 4) this.aggressiveSingle.add(aggressive(sq));
      }
      if (sq.length >= this.minSubstring) longSet.add(sq);
    }
    this.long = [...longSet];
  }

  /** The first match in one message, or null. Tries both readings of "1" and "|". */
  check(text: string): FilterHit | null {
    for (const variant of VARIANTS) {
      const hit = this.checkVariant(text, variant);
      if (hit) return hit;
    }
    return null;
  }

  private checkVariant(text: string, variant: Variant): FilterHit | null {
    const tokens = tokenize(text, variant);
    for (const { text: t, joined } of joinSpelledRuns(tokens)) {
      const kind = joined ? 'spaced' : 'word';
      if (this.single.has(t)) return { term: t, kind };
      if (t.length >= 4 && this.aggressiveSingle.has(aggressive(t))) return { term: t, kind };
    }
    return this.searchSquashed(tokens);
  }

  /**
   * Looks for blocked strings inside the squashed text. A match inside a single ordinary word
   * ("assassin") is ignored. A match that stretches across tokens ("b a d w o r d") is a hit,
   * because that is how people dodge filters.
   */
  private searchSquashed(tokens: string[]): FilterHit | null {
    if (!tokens.length) return null;
    const joined = tokens.join('');
    const spans: [number, number][] = [];
    let at = 0;
    for (const t of tokens) {
      spans.push([at, at + t.length]);
      at += t.length;
    }
    for (const entry of this.long) {
      let from = 0;
      for (;;) {
        const i = joined.indexOf(entry, from);
        if (i === -1) break;
        const end = i + entry.length;
        const span = spans.find(([a, b]) => i >= a && end <= b);
        if (!span) return { term: entry, kind: tokens.length > 1 ? 'spaced' : 'embedded' };
        const token = joined.slice(span[0], span[1]);
        const isExact = token === entry;
        if (isExact || !this.opts.isWord(token)) return { term: entry, kind: isExact ? 'word' : 'embedded' };
        from = i + 1;
      }
    }
    return null;
  }

  /** For letter-by-letter spelling: the recent squashed text of one user, checked across messages. */
  checkBuffer(buffer: SpellBuffer): FilterHit | null {
    for (const variant of VARIANTS) {
      for (const entry of this.long) if (buffer[variant].includes(entry)) return { term: entry, kind: 'spaced' };
      for (const word of this.single) if (word.length >= 4 && buffer[variant].endsWith(word)) return { term: word, kind: 'spaced' };
    }
    return null;
  }
}

/** The last few characters one user typed, kept per reading of "1" and "|". */
export type SpellBuffer = Record<Variant, string>;
export const emptyBuffer = (): SpellBuffer => ({ i: '', l: '' });
export function pushBuffer(buffer: SpellBuffer, text: string, keep = 24): SpellBuffer {
  return { i: (buffer.i + squash(text, 'i')).slice(-keep), l: (buffer.l + squash(text, 'l')).slice(-keep) };
}

/**
 * Short, concrete grooming signals. Deliberately narrow: ordinary friendly questions must not trip
 * it. A hit is held and escalated to a person. It is a net, not a verdict.
 */
const CHILD_SAFETY: RegExp[] = [
  /\bsend\s+(me\s+)?(a\s+)?(nudes?|nude\s+pics?|naked\s+pics?)\b/,
  /\b(don'?t|do\s+not|dont)\s+tell\s+(your\s+)?(mom|dad|mum|parents?|teacher)\b/,
  /\b(our|a)\s+(little\s+)?secret\b.*\b(parents?|mom|dad|mum)\b/,
  /\b(are\s+you|r\s*u)\s+(home\s+)?alone\b/,
  /\bhow\s+old\s+are\s+you\b.*\b(pic|photo|nude|meet|alone)\b/,
  /\b(meet\s+me|come\s+over)\b.*\b(alone|secret|don'?t\s+tell)\b/,
  /\bwhat('?s|\s+is)\s+your\s+(home\s+)?address\b/,
];

export function childSafetySignal(text: string): boolean {
  const t = deLeet(text).replace(/\s+/g, ' ');
  return CHILD_SAFETY.some((re) => re.test(t));
}
