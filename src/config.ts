/** Rename the game here. Everything user-facing reads from this file. */
export const GAME_TITLE = 'Steal a Poop';
export const GAME_TAGLINE = 'Chain words. Keep your wool. Be the last sheep standing.';
/** This version's name, shown beside its number. */
export const UPDATE_NAME = 'Fleece Navidad';

/**
 * Set to true only after a lawyer has reviewed docs/legal/privacy-policy.md, terms-of-service.md and
 * child-safety-policy.md and every [bracketed field] is filled in. While false, the legal pages show a red
 * "DRAFT" banner so nobody mistakes them for final text.
 */
export const LEGAL_REVIEWED = false;

/**
 * The word list's version (plan v7 Part 4.1). A Hunt pack code carries it as its fifth character, so the game can say
 * when a friend's code was made with a different list. Bump both lines whenever public/words.txt changes: a test hashes
 * the file (FNV-1a over its bytes) and fails until WORDS_HASH matches, so the version can never lag the list.
 */
export const WORDS_VERSION = 1;
export const WORDS_HASH = '0367e64a';
