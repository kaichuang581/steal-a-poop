import { isProfaneWord } from './profanity';

export const MAX_NICKNAME = 12;

/**
 * Names are checked two ways after the same clean-up (lower case, look-alike digits and symbols turned back into
 * letters, everything else dropped, repeated letters collapsed). SUBSTRINGS may not appear anywhere in a name; WHOLE
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
  'molest', 'rapist', 'childporn',
  // violence and self-harm
  'killyourself', 'suicide', 'schoolshooter',
];
const WHOLE_WORDS = [
  'ass', 'kike', 'spic', 'spick', 'gook', 'coon', 'fag', 'fags', 'cum', 'sex', 'xxx', 'tit', 'tits', 'hoe', 'thot', 'anal', 'anus', 'kys',
  'pedo', 'paedo', 'cp', 'nig', 'pron', 'dyke', 'homo', 'rape', 'nsfw', 'paki', 'isis',
];
const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', $: 's', '!': 'i' };

/** Lower case, look-alikes back to letters, everything else dropped. Repeats are kept: they are matched on purpose below. */
function letters(s: string): string {
  return [...s.toLowerCase()].map((c) => LEET[c] ?? c).join('').replace(/[^a-z]/g, '');
}

/** A word as a pattern that lets every letter be stretched ("niggg"), but still needs each letter, so "night" is not "nigg". */
const stretched = (word: string) => [...letters(word)].map((c) => `${c}+`).join('');

const BLOCKED_RE = new RegExp(BLOCKED.map(stretched).join('|'));
const WHOLE_RE = new RegExp(`^(?:${WHOLE_WORDS.map(stretched).join('|')})$`);
/** Number codes and letter runs the clean-up would blur. */
const HATE_PATTERNS = /1488|\b88\b|k\W*k\W*k/i;

/** True if the name has something rude, hateful or sexual in it. */
export function isInappropriateName(name: string): boolean {
  if (HATE_PATTERNS.test(name)) return true;
  if (BLOCKED_RE.test(letters(name))) return true;
  // The game's own list of swears and slurs: as the whole name run together, and as each word in it.
  if (isProfaneWord(letters(name))) return true;
  // Spaces, dots, dashes and underscores split words; camelCase also splits ("BigAss" is "Big" and "Ass").
  const spaced = name.replace(/([a-z])([A-Z])/g, '$1 $2');
  return spaced.split(/[^A-Za-z0-9@$!]+/).some((w) => w && (WHOLE_RE.test(letters(w)) || isProfaneWord(letters(w))));
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
