import { isProfaneWord } from './profanity';

export const MAX_NICKNAME = 12;

/**
 * Names are checked two ways on every reading of the name (`readings`: look-alikes, masks and sound-alikes undone, see
 * below). SUBSTRINGS may not appear anywhere in a name; WHOLE
 * words may not appear as a word of their own, which keeps short words from catching innocent names (a "class" is fine).
 */
const BLOCKED = [
  // insults, slurs and hateful words
  'nigg', 'faggot', 'retard', 'tranny', 'shemale', 'chink', 'wetback', 'beaner', 'towelhead', 'sandnigg', 'raghead', 'redskin',
  'whitepower', 'whitepride', 'hitler', 'nazi', 'heil', 'holocaust', 'genocide', 'jihad', 'terrorist', 'alqaeda', 'incel',
  'bastard', 'bitch', 'cunt', 'twat', 'wank', 'whore', 'slut',
  // sexual words
  'fuck', 'shit', 'dick', 'cock', 'pussy', 'asshole', 'penis', 'vagina', 'porn', 'sexy', 'sexual', 'cumshot', 'jizz', 'blowjob', 'handjob',
  'boner', 'dildo', 'orgasm', 'nude', 'naked', 'titty', 'boob', 'horny', 'milf', 'hentai', 'onlyfans', 'masturbat', 'pedophile', 'paedophile',
  'molest', 'rapist', 'childporn', 'fck', 'btch', 'biatch', 'beotch', 'nggr',
  // violence and self-harm
  'killyourself', 'suicide', 'schoolshooter',
];
const WHOLE_WORDS = [
  'ass', 'kike', 'spic', 'spick', 'gook', 'coon', 'fag', 'fags', 'cum', 'sex', 'xxx', 'tit', 'tits', 'hoe', 'thot', 'anal', 'anus', 'kys',
  'pedo', 'paedo', 'cp', 'nig', 'pron', 'dyke', 'homo', 'rape', 'nsfw', 'paki', 'isis',
];
/** Look-alike digits and symbols. Some could stand for two letters ("1" is i or l), so each name is read every way. */
const LEET: Record<string, string[]> = {
  '0': ['o'], '1': ['i', 'l'], '2': ['z'], '3': ['e'], '4': ['a'], '5': ['s'], '6': ['g', 'b'], '7': ['t'], '8': ['b'],
  '9': ['g'], '@': ['a'], $: ['s'], '!': ['i'], '+': ['t'], '(': ['c'], '[': ['c'], '{': ['c'], '<': ['c'], '€': ['c', 'e'],
  '£': ['l'], '¢': ['c'], '|': ['i', 'l'], '¡': ['i'],
};
/** Greek and Cyrillic letters drawn like Latin ones ("fυck" with a Greek upsilon). Accents and wide letters go by NFKD. */
const CONFUSABLE: Record<string, string> = {
  а: 'a', в: 'b', е: 'e', ё: 'e', к: 'k', м: 'm', н: 'h', о: 'o', р: 'p', с: 'c', т: 't', у: 'y', х: 'x', і: 'i', ї: 'i',
  ј: 'j', ѕ: 's', ԁ: 'd', ɡ: 'g', ո: 'n', α: 'a', β: 'b', ε: 'e', η: 'n', ι: 'i', κ: 'k', ν: 'v', ο: 'o', ρ: 'p', τ: 't',
  υ: 'u', χ: 'x', ω: 'w', ς: 'c', ß: 'ss', æ: 'ae', œ: 'oe', ø: 'o', ł: 'l', đ: 'd', ı: 'i', ƒ: 'f',
};
/** Symbols used to blank out a letter ("sh*t"): each is tried as every letter, at most two per name. */
const MASKS = new Set(['*', '#', '?', '%', '^', '~']);
const ALPHABET = [...'abcdefghijklmnopqrstuvwxyz'];
const MAX_MASKS = 2;
const MAX_READINGS = 4096;

/**
 * Every way to read a name as plain letters: lower case, accents and wide letters flattened, look-alike letters, digits
 * and symbols turned back into letters, masks filled in, everything else dropped, and the sound-alikes "ph" for "f" and
 * "v" for "u" ("phuck", "fvck"). Repeats are kept: they are matched on purpose below.
 */
export function readings(s: string): string[] {
  const t = s.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/\|</g, 'k');
  let out = [''];
  let masks = 0;
  for (const ch of t) {
    let opts: string[];
    if (ch >= 'a' && ch <= 'z') opts = [ch];
    else if (CONFUSABLE[ch]) opts = [CONFUSABLE[ch]];
    else if (Object.hasOwn(LEET, ch)) opts = LEET[ch];
    else if (MASKS.has(ch) && masks < MAX_MASKS) { masks++; opts = ALPHABET; }
    else continue;
    if (out.length * opts.length > MAX_READINGS) opts = opts.slice(0, 1);
    out = out.flatMap((p) => opts.map((o) => p + o));
  }
  const more = out.flatMap((r) => [r.replace(/ph/g, 'f'), r.replace(/v/g, 'u')]);
  return [...new Set([...out, ...more])].filter(Boolean);
}

/** A word as a pattern that lets every letter be stretched ("niggg"), but still needs each letter, so "night" is not "nigg". */
const stretched = (word: string) => [...word].map((c) => `${c}+`).join('');

const BLOCKED_RE = new RegExp(BLOCKED.map(stretched).join('|'));
const WHOLE_RE = new RegExp(`^(?:${WHOLE_WORDS.map(stretched).join('|')})$`);
/** Number codes and letter runs the clean-up would blur. */
const HATE_PATTERNS = /1488|\b88\b|k\W*k\W*k/i;

/** True if the name has something rude, hateful or sexual in it. */
export function isInappropriateName(name: string): boolean {
  if (HATE_PATTERNS.test(name.normalize('NFKD'))) return true;
  // The whole name run together, read every way: the blocked list, and the game's own list of swears and slurs.
  if (readings(name).some((r) => BLOCKED_RE.test(r) || isProfaneWord(r))) return true;
  // Spaces, dots, dashes and underscores split words; camelCase also splits ("BigAss" is "Big" and "Ass").
  const spaced = name.replace(/([a-z])([A-Z])/g, '$1 $2');
  return spaced.split(/[\s._\-,/\\]+/).some((w) => readings(w).some((r) => WHOLE_RE.test(r) || isProfaneWord(r)));
}

export type NicknameResult = { ok: true; name: string } | { ok: false; message: string };

export function checkNickname(raw: string): NicknameResult {
  // eslint-disable-next-line no-control-regex
  const name = raw.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, MAX_NICKNAME);
  if (!name) return { ok: true, name: '' };
  if (isInappropriateName(name)) {
    return { ok: false, message: 'Please pick a friendlier nickname.' };
  }
  return { ok: true, name };
}
