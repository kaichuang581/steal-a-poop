import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LEGAL_DOCS } from '../legalDocs';
import { countPlaceholders, renderMarkdown } from '../markdown';

const html = (md: string) => renderToStaticMarkup(<>{renderMarkdown(md)}</>);

describe('legal markdown', () => {
  it('renders headings, paragraphs, lists and emphasis', () => {
    const out = html('# Title\n\nSome **bold** and *soft* and `code`.\n\n- one\n- two\n\n1. first\n2. second');
    expect(out).toContain('<h1');
    expect(out).toContain('<strong>bold</strong>');
    expect(out).toContain('<em>soft</em>');
    expect(out).toContain('<code');
    expect(out.match(/<li/g)).toHaveLength(4);
    expect(out).toContain('<ul');
    expect(out).toContain('<ol');
  });

  it('renders tables with a header row', () => {
    const out = html('| A | B |\n|---|---|\n| 1 | 2 |\n| 3 | 4 |');
    expect(out).toContain('<table');
    expect(out.match(/<th[ >]/g)).toHaveLength(2);
    expect(out.match(/<td[ >]/g)).toHaveLength(4);
  });

  it('highlights every [field] still to be filled in, and counts them', () => {
    const md = 'Contact [email] or [phone].';
    expect(countPlaceholders(md)).toBe(2);
    expect(html(md).match(/data-placeholder/g)).toHaveLength(2);
  });

  it('never turns text into HTML', () => {
    const out = html('Hello <script>alert(1)</script> <img src=x onerror=alert(1)>');
    expect(out).not.toContain('<script');
    expect(out).not.toContain('<img');
    expect(out).toContain('&lt;script&gt;');
  });

  it('joins wrapped list lines into the same item', () => {
    const out = html('- a long item\n  that continues\n- next');
    expect(out.match(/<li/g)).toHaveLength(2);
    expect(out).toContain('a long item that continues');
  });
});

describe('the player-facing documents', () => {
  for (const [slug, doc] of Object.entries(LEGAL_DOCS)) {
    it(`${slug} renders, has a title and still marks unfinished fields`, () => {
      const out = html(doc.body);
      expect(out).toContain('<h1');
      expect(out.length).toBeGreaterThan(1500);
      expect(doc.body).toMatch(/DRAFT/i); // a document must not look final while it is not
      expect(countPlaceholders(doc.body)).toBeGreaterThan(0);
    });
  }
  it('the draft documents say what the app actually does about chat', () => {
    const terms = LEGAL_DOCS.terms.body;
    for (const rule of ['No swearing', 'Nothing sexual', 'No racial slurs', 'Nothing unsafe toward children']) expect(terms).toContain(rule);
  });
});
