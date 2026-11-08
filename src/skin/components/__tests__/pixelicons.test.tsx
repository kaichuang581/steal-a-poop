import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Px } from '../PixelIcons';

// Read the map's own keys so a newly added icon is covered without maintaining a second list in the test.
const source = readFileSync(new URL('../PixelIcons.tsx', import.meta.url), 'utf8');
const mapStart = source.indexOf('const MAP:');
const mapEnd = source.indexOf('\n};', mapStart);
const mapSource = source.slice(mapStart, mapEnd);
const iconKeys = [...mapSource.matchAll(/'([^']+)'\s*:/g)].map((match) => match[1]);

describe('Px', () => {
  it('finds the icon map and every key in it', () => {
    expect(mapStart).toBeGreaterThan(-1);
    expect(mapEnd).toBeGreaterThan(mapStart);
    expect(iconKeys.length).toBeGreaterThan(0);
    expect(new Set(iconKeys).size).toBe(iconKeys.length);
  });

  it.each(iconKeys)('renders an svg for %s', (key) => {
    const html = renderToStaticMarkup(<Px e={key} size={20} />);
    expect(html).toContain('<svg');
    expect(html).toContain('data-icon=');
  });

  it('renders nothing for an unknown key', () => {
    expect(renderToStaticMarkup(<Px e="🦄" />)).toBe('');
  });
});
