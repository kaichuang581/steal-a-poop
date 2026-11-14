import { existsSync, readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

// The card only needs the wallet's actions to exist; nothing here presses a button.
vi.mock('../store', () => ({ equipItem: vi.fn() }));

import { contrast } from '../../kit/contrast';
import { BLAST_PALETTE, BOMB_TINT, BURST_SHAPE, CATALOG, TICK_VOICE } from '../catalog';
import { BOMB_SHELL } from '../shells';
import { freshWallet } from '../economy';
import { formatCoins } from '../format';
import { cardState, ItemCard, sourceLine } from '../ItemCard';
import { frameOf, RARITIES } from '../rarity';

/** docs/PLAN_TRADING_POST_REFINE.md Part 8: the refinement's own tests. */
describe('formatCoins', () => {
  it('writes a balance one way: commas, never decimals or negatives', () => {
    expect(formatCoins(0)).toBe('0');
    expect(formatCoins(1250)).toBe('1,250');
    expect(formatCoins(999999)).toBe('999,999');
    expect(formatCoins(1250.9)).toBe('1,250');
    expect(formatCoins(-5)).toBe('0');
    expect(formatCoins(Number.NaN)).toBe('0');
  });
  it('shortens only above 99,999, for small pegs and badges', () => {
    expect(formatCoins(5000, true)).toBe('5,000');
    expect(formatCoins(99_999, true)).toBe('99,999');
    expect(formatCoins(100_000, true)).toBe('100k');
    expect(formatCoins(999_999, true)).toBe('999k');
    expect(formatCoins(1_250_000, true)).toBe('1.2M');
    expect(formatCoins(2_000_000, true)).toBe('2M');
  });
});

describe('the item card', () => {
  const render = (id: string, owned: boolean, worn: boolean) => {
    const item = CATALOG.find((i) => i.id === id)!;
    const w = freshWallet();
    if (owned && !w.owned.includes(id)) w.owned.push(id);
    if (!owned) w.owned = w.owned.filter((x) => x !== id);
    // Found but not worn: something else of its kind is on.
    const other = CATALOG.find((i) => i.kind === item.kind && i.id !== id)!;
    if (!w.owned.includes(other.id)) w.owned.push(other.id);
    w.equipped[item.kind] = worn ? id : other.id;
    return { item, html: renderToStaticMarkup(<ItemCard item={item} wallet={w} onNote={() => undefined} />), state: cardState(item, w) };
  };
  it('has three states for every item, and never hides the art', () => {
    for (const item of CATALOG) {
      const locked = render(item.id, false, false), owned = render(item.id, true, false), wearing = render(item.id, true, true);
      expect([locked.state, owned.state, wearing.state], item.id).toEqual(['locked', 'owned', 'wearing']);
      for (const r of [locked, owned, wearing]) {
        expect(r.html, item.id).toContain(`shop/${item.id}.webp`);
        expect(r.html, item.id).toContain(`kit-pic--${frameOf(item)}`);
      }
      expect(locked.html, item.id).toContain('data-locked');
      expect(locked.html, item.id).toContain('kit-pic-lock');
      expect(locked.html, item.id).toContain(sourceLine(item).replace(/&/g, '&amp;'));
      expect(owned.html, item.id).toMatch(/>Wear<\/button>/);
      expect(owned.html, item.id).not.toContain('kit-pic-lock');
      expect(wearing.html, item.id).toContain('kit-pic--lit');
      expect(wearing.html, item.id).toMatch(/>Wearing<\/span>/);
      expect(wearing.html, item.id).not.toMatch(/>Wear<\/button>/);
    }
  });
  it('gives every rarity a frame of its own, and says the rarity in words', () => {
    for (const r of RARITIES) {
      const item = CATALOG.find((i) => i.rarity === r)!;
      const { html } = render(item.id, true, false);
      expect(html).toContain(`kit-pic--${r}`);
      expect(html.toLowerCase()).toContain(`>${r}<`);
    }
    expect(new Set(CATALOG.map(frameOf)).size).toBe(7);
  });
  it('says exactly where an item not found yet comes from', () => {
    const line = (id: string) => sourceLine(CATALOG.find((i) => i.id === id)!);
    expect(line('bomb-gold')).toBe('In the Oat Sack');
    expect(line('blast-solstice')).toBe('In the Corn Sack');
    expect(line('tick-owl')).toBe('In the Barley Sack');
    expect(line('bomb-brass')).toBe('30 Bells on the Bell Shelf');
    expect(line('bomb-aurora')).toBe('Mission: count sheep 7 nights in a row');
  });
});

describe('the pictures and the type', () => {
  it('has a baked thumbnail for every catalogue item (node tools/renderThumbs.mjs)', () => {
    for (const id of CATALOG.map((i) => i.id)) expect(existsSync(`public/shop/${id}.webp`), id).toBe(true);
  });
  it('keeps text readable: chalk on slate, ink on paper, cream and lantern gold on the wall', () => {
    const wall = '#3A2618';
    expect(contrast('#F3F0E6', '#26292D')).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#3B3028', '#FBF4E4')).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#7A6A58', '#FBF4E4')).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#FFF4DC', wall)).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#FFD98A', wall)).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#FFF4DC', '#A6453A')).toBeGreaterThanOrEqual(4.5);
  });
});

describe('every item is its own thing, and is used by the game', () => {
  const of = (kind: string) => CATALOG.filter((i) => i.kind === kind);
  it('a bomb skin has its own shell colours and glow, and no two shells are the same', () => {
    for (const i of of('bomb')) { expect(BOMB_SHELL[i.id], i.id).toBeTruthy(); expect(BOMB_TINT[i.id], i.id).toBeTruthy(); }
    expect(new Set(of('bomb').map((i) => JSON.stringify(BOMB_SHELL[i.id]))).size).toBe(of('bomb').length);
  });
  it('a burst has its own palette and its own way of moving: no two are reskins', () => {
    for (const i of of('blast')) { expect(BLAST_PALETTE[i.id], i.id).toBeTruthy(); expect(BURST_SHAPE[i.id], i.id).toBeTruthy(); }
    expect(new Set(of('blast').map((i) => BURST_SHAPE[i.id])).size).toBe(of('blast').length);
  });
  it('a fuse sound has its own voice', () => {
    for (const i of of('tick')) expect(TICK_VOICE[i.id], i.id).toBeTruthy();
    expect(new Set(of('tick').map((i) => TICK_VOICE[i.id])).size).toBe(of('tick').length);
  });
  it('the table draws what is worn: the shell, its chunks, the burst\'s palette and shape, and the fuse voice', () => {
    const bomb = readFileSync('src/skin/table/Bomb.tsx', 'utf8'), app = readFileSync('src/skin/PaintedApp.tsx', 'utf8');
    expect(bomb).toMatch(/bombLook\(equipped\.bomb/);
    expect(bomb).toMatch(/chunk=\{look\.chunk\}/);
    expect(bomb).toMatch(/<BombAura id=\{equipped\.bomb\}/);
    expect(bomb).toMatch(/BLAST_PALETTE\[equipped\.blast\]/);
    expect(bomb).toMatch(/BURST_SHAPE\[equipped\.blast\]/);
    expect(app).toMatch(/setTickVoice\(TICK_VOICE\[tick\]/);
  });
});
