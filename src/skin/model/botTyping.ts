/**
 * How a bot "types" its word into its name tag, so it reads like a person at a keyboard rather than a progress bar:
 * a think before the first key, the word in bursts of a few letters with uneven gaps, short stops between bursts,
 * now and then a slip of the finger (a neighbouring key) that it notices a letter or two later and backspaces, the
 * odd false start, and a last look before it sends. The whole script is fitted into the time the bot really takes
 * (it is display only; the engine decides the word and when it lands), and it is seeded, so it never flickers.
 */

export interface Keystroke {
  /** Milliseconds after the turn's typing starts. */
  at: number;
  /** The tag's text after this keystroke. */
  text: string;
}

/** Keys next to each key on a QWERTY keyboard: where a slipped finger lands. */
const NEIGHBOURS: Record<string, string> = {
  q: 'wa', w: 'qeas', e: 'wrds', r: 'etdf', t: 'ryfg', y: 'tugh', u: 'yihj', i: 'uojk', o: 'ipkl', p: 'ol',
  a: 'qwsz', s: 'awedxz', d: 'serfcx', f: 'drtgvc', g: 'ftyhbv', h: 'gyujnb', j: 'huikmn', k: 'jiolm', l: 'kop',
  z: 'asx', x: 'zsdc', c: 'xdfv', v: 'cfgb', b: 'vghn', n: 'bhjm', m: 'njk',
};

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seedOf(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Splits a word into the bursts a typist would type it in: 1 to 4 letters, mostly 2 or 3. */
function bursts(word: string, r: () => number): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < word.length) {
    const n = Math.min(word.length - i, 1 + Math.floor(r() * 3) + (r() < 0.2 ? 1 : 0));
    out.push(word.slice(i, i + n));
    i += n;
  }
  return out;
}

type Step = { gap: number; op: 'add' | 'del'; ch?: string; fixed?: boolean };

/** The raw steps (gaps in ms before each key), before they are fitted to the time available. */
function steps(word: string, r: () => number, sloppy: number): Step[] {
  const s: Step[] = [];
  const key = () => 70 + r() * 110 + (r() < 0.12 ? 160 : 0); // most keys quick, the odd one hesitant
  // The odd false start: the first couple of letters, wiped, then a proper go.
  if (word.length > 4 && r() < 0.12 * sloppy) {
    const k = 2 + Math.floor(r() * 2);
    for (let i = 0; i < k; i++) s.push({ gap: key(), op: 'add', ch: word[i] });
    s.push({ gap: 260 + r() * 300, op: 'del', fixed: true });
    for (let i = 1; i < k; i++) s.push({ gap: 55 + r() * 30, op: 'del', fixed: true });
    s[s.length - 1].gap += 200 + r() * 250;
  }
  const typoAt = word.length >= 4 && r() < 0.35 * sloppy ? 1 + Math.floor(r() * (word.length - 2)) : -1;
  let typed = 0;
  bursts(word, r).forEach((b, bi) => {
    if (bi > 0) s.push({ gap: 0, op: 'add' }); // placeholder, replaced by a pause below
    for (const ch of b) {
      if (typed === typoAt) {
        // A slip: the wrong key, maybe one or two right letters after it, a beat, then backspace back to the slip.
        const wrong = (NEIGHBOURS[ch] ?? 'e')[Math.floor(r() * (NEIGHBOURS[ch]?.length ?? 1))];
        s.push({ gap: key(), op: 'add', ch: wrong });
        const carry = Math.min(word.length - typed - 1, Math.floor(r() * 3));
        for (let i = 1; i <= carry; i++) s.push({ gap: key(), op: 'add', ch: word[typed + i] });
        s.push({ gap: 220 + r() * 260, op: 'del', fixed: true });
        for (let i = 0; i < carry; i++) s.push({ gap: 60 + r() * 35, op: 'del', fixed: true });
        s.push({ gap: 120 + r() * 120, op: 'add', ch });
      } else {
        s.push({ gap: key(), op: 'add', ch });
      }
      typed++;
    }
  });
  // Pauses between bursts: mostly short, sometimes a real stop to think.
  for (let i = 0; i < s.length; i++) {
    if (s[i].op === 'add' && s[i].ch === undefined) {
      const next = s[i + 1];
      s.splice(i, 1);
      if (next) next.gap += r() < 0.25 ? 450 + r() * 500 : 120 + r() * 220;
    }
  }
  return s;
}

/**
 * The keystrokes for a bot typing `word` between 0 and `durationMs` (when its word lands). With `word` null the bot
 * is going to run out of time: it types a hopeful start of `letter`, stalls, deletes it, and tries again, never
 * finishing. `seed` keeps the script the same on every frame of the turn.
 */
export function typingScript(word: string | null, durationMs: number, seed: number, letter = ''): Keystroke[] {
  const r = rng(seed);
  if (!word) {
    // Hesitation: a couple of tries that go nowhere.
    const out: Keystroke[] = [];
    const tries = ['ab', 'ou', 're', 'ea', 'in', 'ar'];
    let t = durationMs * (0.15 + r() * 0.15);
    for (let attempt = 0; attempt < 2 && t < durationMs * 0.8; attempt++) {
      let text = '';
      const start = letter + tries[Math.floor(r() * tries.length)].slice(0, 1 + Math.floor(r() * 2));
      for (const ch of start) { t += 90 + r() * 140; text += ch; out.push({ at: t, text }); }
      t += 500 + r() * 700;
      while (text.length) { t += 60 + r() * 40; text = text.slice(0, -1); out.push({ at: t, text }); }
      t += 400 + r() * 600;
    }
    return out.filter((k) => k.at < durationMs);
  }
  const sloppy = word.length >= 8 ? 1.4 : 1;
  const raw = steps(word, r, sloppy);
  const typing = raw.reduce((sum, st) => sum + st.gap, 0);
  // Fit it in: a think first (a fifth to a third of the time), a last look before sending, the typing in between,
  // squeezed to at most 35 ms a key if the bot is quick, never stretched past its natural pace (the rest is thinking).
  const think = durationMs * (0.18 + r() * 0.15);
  const review = Math.min(400, durationMs * 0.08);
  const room = Math.max(0, durationMs - think - review);
  const k = typing > room ? room / typing : 1;
  let t = think + (typing < room ? (room - typing) * (0.3 + r() * 0.4) : 0);
  let text = '';
  const out: Keystroke[] = [];
  for (const st of raw) {
    t += Math.max(st.op === 'del' ? 30 : 35, st.gap * k);
    text = st.op === 'add' ? text + st.ch : text.slice(0, -1);
    out.push({ at: Math.min(t, durationMs - 1), text });
  }
  return out;
}

/** The tag's text `elapsedMs` into the script. */
export function typedAt(script: readonly Keystroke[], elapsedMs: number): string {
  let text = '';
  for (const k of script) {
    if (k.at > elapsedMs) break;
    text = k.text;
  }
  return text;
}
