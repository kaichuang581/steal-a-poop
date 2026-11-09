import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { audit } from '../uiAudit';

/** A throwaway skin folder with one stylesheet and one component, audited on its own. */
function scan(css: string, tsx = 'export const X = () => null;\n') {
  const dir = mkdtempSync(join(tmpdir(), 'kit-audit-'));
  mkdirSync(join(dir, 'parts'));
  writeFileSync(join(dir, 'parts', 'a.css'), css);
  writeFileSync(join(dir, 'parts', 'B.tsx'), tsx);
  return audit(dir).map((f) => `${f.kind}:${f.line}`);
}

describe('the audit rules', () => {
  it('flags a gradient used as a colour, but not inside a kit material', () => {
    expect(scan('.a { background: linear-gradient(red, blue); }\n.kit-plank { background: repeating-linear-gradient(94deg, red 0 1px, blue 1px 2px); }')).toEqual(['gradient:1']);
  });
  it('flags corners over 4 px and percentages, but not a peg', () => {
    expect(scan('.a { border-radius: 4px; }\n.b { border-radius: 5px; }\n.c { border-radius: 50%; }\n.kit-peg { border-radius: 50%; }')).toEqual(['radius:2', 'radius:3']);
  });
  it('flags a blur-only shadow, but not a ring or a shadow with an offset', () => {
    expect(scan('.a { box-shadow: 0 0 8px red; }\n.b { box-shadow: 0 0 0 3px red; }\n.c { box-shadow: 0 6px 0 red, 0 0 12px red; }\n.d { filter: drop-shadow(0 0 4px red); }')).toEqual(['shadow:1', 'shadow:4']);
  });
  it('flags fonts that are not the three tokens, !important or not', () => {
    expect(scan('.a { font-family: var(--skin-font-hand) !important; }\n.b { font-family: Arial; }\n.c { font: inherit; }')).toEqual(['font:2']);
  });
  it('flags Tailwind colour, shadow and rounded utilities, and an emoji or a lone glyph used as an icon', () => {
    const tsx = 'export const B = () => (\n  <div className="flex bg-red-500 rounded-lg p-2 shadow">\n    <span>🔥</span><span>…</span><span>Loading…</span>\n  </div>\n);\n';
    expect(scan('', tsx).sort()).toEqual(['emoji:3', 'emoji:3', 'radius:2', 'utility:2', 'utility:2']);
  });
  it('flags a glyph used as CSS content', () => {
    expect(scan(".a::after { content: '✓'; }\n.b::after { content: ''; }")).toEqual(['emoji:1']);
  });
});
