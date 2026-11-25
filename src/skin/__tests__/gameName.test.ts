import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PAINTED_GAME_TITLE } from '../../config';
import { PAGE_TITLE } from '../seo';

// The painted game's name lives in src/config.ts. Every place a player can see it reads that value, so a rename is one
// edit; this test fails if a page title, a link preview or a stray copy of the old name is left behind.
const OLD_NAME = /finish the word/i;

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) sourceFiles(path, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\./.test(name) && !path.includes('__tests__')) out.push(path);
  }
  return out;
}

describe('the game has one name', () => {
  const html = readFileSync('index.html', 'utf8');
  const title = (re: RegExp) => html.match(re)?.[1];

  it('the page title and the link previews say the painted name', () => {
    // The tab and search results read PAGE_TITLE (the name, then what the game is); the game sets the same one.
    expect(title(/<title>([^<]*)<\/title>/)).toBe(PAGE_TITLE);
    expect(PAGE_TITLE.startsWith(`${PAINTED_GAME_TITLE} `)).toBe(true);
    expect(title(/property="og:title" content="([^"]*)"/)).toBe(PAINTED_GAME_TITLE);
    expect(title(/name="twitter:title" content="([^"]*)"/)).toBe(PAINTED_GAME_TITLE);
  });

  it('no game code still carries the old name', () => {
    const offenders = sourceFiles('src').filter((f) => OLD_NAME.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
