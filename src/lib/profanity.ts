/**
 * Swears, slurs and sexual words: none of them may be played, shown or used as a name anywhere in the game. The word
 * list (public/words.txt) has them removed, and `createDictionary` drops any that come back, so a table, a room, the
 * dream and the bots all refuse them. The name check (nickname.ts) uses the same list.
 *
 * Two kinds of entry: ROOTS are refused anywhere inside a word ("motherfucker"), so they are only roots that no clean
 * word contains; WORDS are refused as a whole word with its usual endings ("dick", "dicks", but not "dickens"), for
 * roots that clean words do contain ("cocktail", "assume", "raccoon"). This is for a family word game: when in doubt a
 * word goes, even if it has a clean meaning too (a hoe, a tit, an ass). Words that only sound alike go too (niggle).
 */
const ROOTS = [
  'fuck', 'fuk', 'shit', 'nigg', 'cunt', 'faggot', 'whore', 'slut', 'bitch', 'dildo', 'jizz', 'cumshot', 'blowjob',
  'handjob', 'motherf', 'pussy', 'porn', 'masturbat', 'molest', 'paedophil', 'pedophil', 'bastard', 'asshole', 'arsehole',
  'dickhead', 'cocksuck', 'goddam', 'bollock', 'clitor', 'orgasm', 'nympho', 'wetback', 'towelhead', 'raghead', 'shemale',
  'tranny', 'trannie', 'skank', 'boner', 'titty', 'tittie', 'boob', 'smegma', 'fellat', 'cunnil', 'buttplug', 'bukkake',
  'hentai', 'scrotum', 'testicle', 'ejaculat', 'hitler', 'retard', 'spunk', 'jackass', 'dumbass', 'fatass',
  'badass', 'smartass', 'kinky', 'sodomi', 'sodomy', 'sodomite', 'bestiality', 'incest', 'genital', 'penis',
  'vagina', 'vulva', 'phallic', 'phallus', 'prostitut', 'sexy', 'xxx', 'damnit', 'dammit', 'pissed', 'pisser', 'pissing',
];
/** Refused only as these exact words (each form listed, because "spic" + "y" is "spicy" and "butt" + "er" is "butter"). */
const WORDS = [
  'ass', 'asses', 'arse', 'arses', 'dick', 'dicks', 'cock', 'cocks', 'prick', 'pricks', 'piss', 'pisses', 'crap', 'craps',
  'crapped', 'crapping', 'crappy', 'crapper', 'damn', 'damns', 'damned', 'damning', 'tit', 'tits', 'cum', 'cums', 'sex',
  'sexed', 'sexes', 'anal', 'anus', 'anuses', 'rape', 'raped', 'rapes', 'raping', 'homo', 'homos', 'dyke', 'dykes', 'fag',
  'fags', 'faggy', 'chink', 'chinks', 'spic', 'spics', 'spick', 'spicks', 'kike', 'kikes', 'gook', 'gooks', 'coon', 'coons',
  'jap', 'japs', 'wop', 'wops', 'dago', 'dagos', 'dagoes', 'kraut', 'krauts', 'honky', 'honkies', 'honkie', 'negro',
  'negroes', 'paki', 'pakis', 'gyp', 'gyps', 'gypped', 'gypping', 'hoe', 'hoes', 'thot', 'slag', 'slags', 'bugger',
  'buggers', 'buggered', 'buggery', 'wank', 'wanks', 'wanked', 'wanker', 'wankers', 'wanking', 'semen', 'horny', 'hornier',
  'horniest', 'nude', 'nudes', 'nudity', 'turd', 'turds', 'shag', 'shags', 'shagged', 'shagging', 'schlong', 'schlongs',
  'feck', 'frig', 'frigging', 'spaz', 'spastic', 'spastics', 'mong', 'mongs', 'midget', 'midgets', 'hussy', 'hussies',
  'harlot', 'harlots', 'floozy', 'floozie', 'floozies', 'bimbo', 'bimbos', 'strumpet', 'strumpets', 'trollop', 'trollops',
  'smut', 'smutty', 'lewd', 'lewder', 'lewdest', 'lewdness', 'pimp', 'pimps', 'pimped', 'pimping',
  'nipple', 'nipples', 'crotch', 'crotches', 'boobie', 'boobies', 'booby', 'knockers', 'erotic',
  'erotica', 'erotically', 'scumbag', 'scumbags', 'douche', 'douchebag', 'twat', 'twats', 'rapist', 'rapists', 'nazi', 'nazis',
  'nazify', 'nazified', 'nazifies', 'nazifying', 'nazification', 'nazifications', 'denazify', 'denazified', 'denazifies',
  'denazifying', 'denazification', 'denazifications',
];
/** Clean words that happen to contain a root (a "mishit" in cricket, a "haboob" is a sandstorm). */
const CLEAN = /^(mishit\w*|shittah\w*|shittim\w*|haboobs?|booboos?|booboisies?|(de|jaw)boners?|(non|pre|uro|urino)?congenital\w*|e?invaginat\w*|evaginat\w*)$/;

const ROOT_RE = new RegExp(ROOTS.join('|'));
const WORD_SET = new Set(WORDS);

/** True if the word (one word, any case) is a swear, a slur or sexual. */
export function isProfaneWord(word: string): boolean {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  return !!w && (WORD_SET.has(w) || (ROOT_RE.test(w) && !CLEAN.test(w)));
}
