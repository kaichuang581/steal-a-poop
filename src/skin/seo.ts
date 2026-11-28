import { PAINTED_GAME_TITLE } from '../config';

/**
 * What a search engine reads first. The browser tab and Google's result use the page title; the game's name stays
 * PAINTED_GAME_TITLE everywhere a player reads it (the title board, the share text). index.html says the same words,
 * so the page that arrives and the page the game sets are one title (src/skin/__tests__/gameName.test.ts checks it).
 * The site's one address: fleeced.io. The /steal-a-poop/ copy points its canonical link here too.
 */
export const PAGE_TITLE = `${PAINTED_GAME_TITLE} | Free Multiplayer Word Chain Game`;
export const SITE_URL = 'https://fleeced.io/';
