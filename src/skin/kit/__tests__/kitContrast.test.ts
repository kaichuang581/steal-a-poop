import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { contrast } from '../contrast';

const tokens = readFileSync('src/skin/styles/tokens.css', 'utf8');
const t = (name: string) => tokens.match(new RegExp(`--${name}: *(#[0-9A-Fa-f]{6})`))![1];

describe('the farm kit keeps its text readable (V6 Part 4.11)', () => {
  // Ice is rgba(217,238,248,0.78) over whatever is behind it; over the darkest wood it is no lighter than #B5C0BE.
  it('ink on ice is at least 4.5:1, even over dark wood', () => expect(contrast(t('ink'), '#B5C0BE')).toBeGreaterThanOrEqual(4.5));
  it('coral chalk on slate is at least 4.5:1', () => expect(contrast('#FFB6A8', t('slate'))).toBeGreaterThanOrEqual(4.5));
  it.each([
    ['ink', 'paper', 11],
    ['button-text', 'wood-dark', 4.5],
    ['chalk', 'slate', 12],
    ['ink', 'burlap', 6.5],
    ['wood-ink', 'brass', 5],
    ['button-text', 'barn-paint', 4.5],
    ['wood-ink', 'tile', 4.5],
  ])('%s on %s is at least %s:1', (fg, bg, min) => {
    expect(contrast(t(fg), t(bg))).toBeGreaterThanOrEqual(min);
  });
});
