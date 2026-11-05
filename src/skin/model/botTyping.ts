/**
 * How a bot "types" its word into its name tag, so it reads like a person at a keyboard rather than a progress bar:
 * a think before the first key, the word in bursts of a few letters with uneven gaps, short stops between bursts,
 * now and then a slip of the finger (a neighbouring key) that it notices a letter or two later and backspaces, and
 * the odd false start. The word is sent the moment its last letter is down: there is no pause at the end.
 *
 * A bot that answers late in its turn is panicking: it hammers out words that are not words, the table bounces them
 * (the tag shakes red), and the real word goes in at the last moment in a hurry, typos and all. A bot that is going
 * to run out of time spams those junk words faster and more frantically and never finds the real one.
 *
 * Display only: the engine decides the word and when it lands. The script is fitted into the time the bot really
 * takes, and it is seeded, so it never flickers.
 */

export interface Keystroke {
  /** Milliseconds after the turn's typing starts. */
  at: number;
  /** The tag's text after this keystroke. */
  text: string;
  /** 'reject': the bot sent what it had and the table bounced it (not a word). The tag flashes red. */
  kind?: 'reject';
}

/** Keys next to each key on a QWERTY keyboard: where a slipped finger lands. */
const NEIGHBOURS: Record<string, string> = {
  q: 'wa', w: 'qeas', e: 'wrds', r: 'etdf', t: 'ryfg', y: 'tugh', u: 'yihj', i: 'uojk', o: 'ipkl', p: 'ol',
  a: 'qwsz', s: 'awedxz', d: 'serfcx', f: 'drtgvc', g: 'ftyhbv', h: 'gyujnb', j: 'huikmn', k: 'jiolm', l: 'kop',
  z: 'asx', x: 'zsdc', c: 'xdfv', v: 'cfgb', b: 'vghn', n: 'bhjm', m: 'njk',
};
const CONSONANTS = 'bcdfghklmnprst';
const VOWELS = 'aeiou';
/** The word lands this long after its last letter: the time it takes to press Enter. */
const SEND_MS = 40;

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

/** A word that is not one: the chain letter, then letters that sound like a word. What a panicking sheep sends. */
function junk(first: string, len: number, r: () => number): string {
  let s = first || CONSONANTS[Math.floor(r() * CONSONANTS.length)];
  let vowel = !VOWELS.includes(s);
  while (s.length < len) {
    const pool = vowel ? VOWELS : CONSONANTS;
    s += pool[Math.floor(r() * pool.length)];
    vowel = !vowel;
  }
  return s;
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

type Op = 'add' | 'del' | 'reject' | 'clear';
type Step = { gap: number; op: Op | 'pause'; ch?: string };

/** One key: most quick, the odd one hesitant. `speed` under 1 is a hurried typist. */
const keyGap = (r: () => number, speed: number) => (70 + r() * 110 + (r() < 0.12 ? 160 : 0)) * speed;

/** The raw steps for typing `word` (gaps in ms before each key), before they are fitted to the time available. */
function wordSteps(word: string, r: () => number, sloppy: number, speed: number): Step[] {
  const s: Step[] = [];
  const key = () => keyGap(r, speed);
  // The odd false start: the first couple of letters, wiped, then a proper go.
  if (word.length > 4 && r() < Math.min(0.5, 0.12 * sloppy)) {
    const k = 2 + Math.floor(r() * 2);
    for (let i = 0; i < k; i++) s.push({ gap: key(), op: 'add', ch: word[i] });
    s.push({ gap: (260 + r() * 300) * speed, op: 'del' });
    for (let i = 1; i < k; i++) s.push({ gap: 55 + r() * 30, op: 'del' });
    s.push({ gap: (200 + r() * 250) * speed, op: 'pause' });
  }
  const typoAt = word.length >= 4 && r() < Math.min(0.8, 0.35 * sloppy) ? 1 + Math.floor(r() * (word.length - 2)) : -1;
  let typed = 0;
  bursts(word, r).forEach((b, bi) => {
    // Pauses between bursts: mostly short, sometimes a real stop to think.
    if (bi > 0) s.push({ gap: (r() < 0.25 ? 450 + r() * 500 : 120 + r() * 220) * speed, op: 'pause' });
    for (const ch of b) {
      if (typed === typoAt) {
        // A slip: the wrong key, maybe one or two right letters after it, a beat, then backspace back to the slip.
        const wrong = (NEIGHBOURS[ch] ?? 'e')[Math.floor(r() * (NEIGHBOURS[ch]?.length ?? 1))];
        s.push({ gap: key(), op: 'add', ch: wrong });
        const carry = Math.min(word.length - typed - 1, Math.floor(r() * 3));
        for (let i = 1; i <= carry; i++) s.push({ gap: key(), op: 'add', ch: word[typed + i] });
        s.push({ gap: (220 + r() * 260) * speed, op: 'del' });
        for (let i = 0; i < carry; i++) s.push({ gap: 60 + r() * 35, op: 'del' });
        s.push({ gap: (120 + r() * 120) * speed, op: 'add', ch });
      } else {
        s.push({ gap: key(), op: 'add', ch });
      }
      typed++;
    }
  });
  return s;
}

/** A panicked try: a word that is not one, sent, bounced, wiped, and a moment of staring before the next thing. */
function junkSteps(first: string, r: () => number, speed: number): Step[] {
  const w = junk(first, 3 + Math.floor(r() * 2) + (r() < 0.3 ? 1 : 0), r);
  const s: Step[] = [];
  for (const ch of w) s.push({ gap: keyGap(r, speed), op: 'add', ch });
  s.push({ gap: (180 + r() * 320) * speed, op: 'reject' }); // a glance at it, Enter: bounced
  s.push({ gap: 80 + r() * 60, op: 'clear' }); // the tag empties
  s.push({ gap: (260 + r() * 440) * speed, op: 'pause' }); // a stare
  return s;
}

/** Folds each pause into the gap of the key after it (a trailing pause is dropped). */
function fold(steps: Step[]): Step[] {
  const out: Step[] = [];
  let carry = 0;
  for (const st of steps) {
    if (st.op === 'pause') { carry += st.gap; continue; }
    out.push(carry ? { ...st, gap: st.gap + carry } : st);
    carry = 0;
  }
  return out;
}

/** The fastest a finger goes, per kind of key. */
const MIN_GAP: Record<Op, number> = { add: 35, del: 30, reject: 60, clear: 30 };

/** Plays the steps from `t0`, each gap scaled by `k` but never faster than a finger can go, clamped inside `endMs`. */
function play(steps: Step[], t0: number, k: number, endMs: number): Keystroke[] {
  let t = t0;
  let text = '';
  const out: Keystroke[] = [];
  for (const st of steps) {
    if (st.op === 'pause') continue;
    t += Math.max(MIN_GAP[st.op], st.gap * k);
    const at = Math.min(t, endMs - 1);
    if (st.op === 'add') { text += st.ch; out.push({ at, text }); }
    else if (st.op === 'del') { text = text.slice(0, -1); out.push({ at, text }); }
    else if (st.op === 'reject') out.push({ at, text, kind: 'reject' });
    else { text = ''; out.push({ at, text }); }
  }
  return out;
}

/** A bot that is going to run out of time: tries that are not words, bounced, faster and more frantic as the clock runs down. */
function runOutScript(first: string, durationMs: number, r: () => number): Keystroke[] {
  const endMs = Math.max(1, durationMs - 120);
  const out: Keystroke[] = [];
  const think = durationMs * (0.1 + r() * 0.12);
  // Tries fill the whole turn, about one every two seconds, bunching up toward the end as the panic sets in.
  const tries = Math.max(2, Math.min(7, Math.round((endMs - think) / 2000)));
  let t = think;
  for (let i = 0; i < tries && t < endMs; i++) {
    const frantic = i / Math.max(1, tries - 1); // 0 on the first try, 1 on the last
    const speed = 1 - 0.5 * frantic;
    const slot = think + (endMs - think) * (1 - Math.pow(1 - i / tries, 1.5));
    const keys = play(fold(junkSteps(first, r, speed)), Math.max(t, slot), 1, endMs);
    out.push(...keys);
    t = (keys.at(-1)?.at ?? t) + 150;
  }
  const kept = out.filter((k) => k.at < endMs);
  if (!kept.length || kept.at(-1)!.text !== '') kept.push({ at: Math.min(endMs, durationMs - 1), text: '' });
  return kept;
}

/**
 * The keystrokes for a bot typing `word` between 0 and `durationMs` (when its word lands). With `word` null the bot
 * is going to run out of time and spams tries that start with `letter`, never finishing. `turnMs` is the whole turn:
 * a bot that lands late in it panics first. `seed` keeps the script the same on every frame of the turn.
 */
export function typingScript(word: string | null, durationMs: number, seed: number, letter = '', turnMs?: number): Keystroke[] {
  const r = rng(seed);
  const first = (word?.[0] ?? letter ?? '').toLowerCase();
  if (!word) return runOutScript(first, durationMs, r);
  // How late in its turn the bot answers decides how calm it is: before 55% of the turn, calm; by 95%, full panic.
  const panic = turnMs ? Math.max(0, Math.min(1, (durationMs / turnMs - 0.55) / 0.4)) : 0;
  const speed = 1 - 0.45 * panic;
  const sloppy = (word.length >= 8 ? 1.4 : 1) * (1 + panic);
  // A think first (a fifth to a third of the time; a panicking bot starts flailing sooner), then the typing, squeezed
  // to a finger's limit if the bot is quick. Spare time goes before the first key (a longer think) and, in a panic,
  // into the stares between bounced tries, so the word always lands the moment it is finished: no pause at the end.
  const think = durationMs * (0.18 + r() * 0.15) * (1 - 0.6 * panic);
  const room = Math.max(0, durationMs - SEND_MS - think);
  const wordOnly = wordSteps(word, r, sloppy, speed);
  const wordTyping = wordOnly.reduce((sum, st) => sum + st.gap, 0);
  // In a panic the spare time fills with bounced tries, about one every 1.6 s, so the stares between them stay short.
  const tries = panic > 0.3 ? Math.max(1, Math.min(5, Math.round((room - wordTyping) / 1600))) : 0;
  const steps = fold([...Array.from({ length: tries }, () => junkSteps(first, r, speed)).flat(), ...wordOnly]);
  const typing = steps.reduce((sum, st) => sum + st.gap, 0);
  const k = typing > room ? room / typing : 1;
  let spare = Math.max(0, room - typing);
  if (tries > 0 && spare > 0) {
    const front = spare * 0.25;
    const share = (spare - front) / tries;
    for (let i = 0; i < steps.length - 1; i++) if (steps[i].op === 'clear') steps[i + 1].gap += share;
    spare = front;
  }
  return play(steps, think + spare, k, durationMs);
}

/** The tag's text `elapsedMs` into the script. */
export function typedAt(script: readonly Keystroke[], elapsedMs: number): string {
  return keystrokeAt(script, elapsedMs)?.text ?? '';
}

/** The latest keystroke at `elapsedMs`, or null before the first. */
export function keystrokeAt(script: readonly Keystroke[], elapsedMs: number): Keystroke | null {
  let last: Keystroke | null = null;
  for (const k of script) {
    if (k.at > elapsedMs) break;
    last = k;
  }
  return last;
}

/** The most recent bounced try at `elapsedMs`, or null: for the red shake, which outlives the wipe that follows it. */
export function lastRejectAt(script: readonly Keystroke[], elapsedMs: number): Keystroke | null {
  let last: Keystroke | null = null;
  for (const k of script) {
    if (k.at > elapsedMs) break;
    if (k.kind === 'reject') last = k;
  }
  return last;
}
