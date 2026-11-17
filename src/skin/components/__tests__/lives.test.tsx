import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Lives } from '../Lives';

describe('wool balls', () => {
  it('every ball has its own gradient and clip, so hiding one name plate cannot empty the others', () => {
    const html = renderToStaticMarkup(<><Lives lives={2} max={3} /><Lives lives={1} max={3} /></>);
    const ids = [...html.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
    expect(ids).toHaveLength(6); // three full balls, a gradient and a clip each
    expect(new Set(ids).size).toBe(ids.length);
    // Each ball paints with its own definitions.
    for (const ref of html.matchAll(/url\(#([^)]+)\)/g)) expect(ids).toContain(ref[1]);
  });

  it('no drawing in the skin gives a definition a fixed id (two of them on a page would share it)', () => {
    const root = fileURLToPath(new URL('../..', import.meta.url));
    const fixed = (readdirSync(root, { recursive: true }) as string[])
      .filter((f) => f.endsWith('.tsx') && !f.includes('__tests__'))
      .filter((f) => (readFileSync(join(root, f), 'utf8').match(/<defs>[\s\S]*?<\/defs>/g) ?? []).some((defs) => /\bid="/.test(defs)));
    expect(fixed).toEqual([]);
  });
});
