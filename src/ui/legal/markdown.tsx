import type { ReactNode } from 'react';

/**
 * A tiny Markdown renderer for the legal documents: headings, paragraphs, lists, tables, bold, italic,
 * code. It builds React elements (never raw HTML), so a document cannot inject markup.
 * Text in [square brackets] is a field still to be filled in; it is highlighted so it cannot be missed.
 */

const PLACEHOLDER = /\[[^\]\n]+\]/g;

/** How many unfilled [fields] a document still has. */
export function countPlaceholders(md: string): number {
  return (md.match(PLACEHOLDER) ?? []).length;
}

function inline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  // order matters: code, bold, italic, placeholder
  const re = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*\n]+\*)|(\[[^\]\n]+\])/g;
  let last = 0;
  let i = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    const k = `${key}-${i++}`;
    if (m[1]) out.push(<code key={k} className="rounded bg-white/10 px-1">{tok.slice(1, -1)}</code>);
    else if (m[2]) out.push(<strong key={k}>{inline(tok.slice(2, -2), k)}</strong>);
    else if (m[3]) out.push(<em key={k}>{inline(tok.slice(1, -1), k)}</em>);
    else out.push(<mark key={k} data-placeholder className="rounded bg-amber-300/30 px-1 text-amber-100">{tok}</mark>);
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const splitRow = (line: string) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());

export function renderMarkdown(md: string): ReactNode[] {
  const lines = md.replace(/\r/g, '').split('\n');
  const out: ReactNode[] = [];
  let n = 0;
  for (let i = 0; i < lines.length; ) {
    const line = lines[i];
    const key = `b${n++}`;
    if (!line.trim()) { i++; continue; }

    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      const level = h[1].length;
      const cls = level === 1 ? 'mt-2 text-3xl font-black text-amber-300' : level === 2 ? 'mt-6 text-xl font-black text-amber-200' : 'mt-4 text-lg font-bold';
      const Tag = (`h${level}`) as 'h1' | 'h2' | 'h3';
      out.push(<Tag key={key} className={cls}>{inline(h[2], key)}</Tag>);
      i++;
      continue;
    }

    if (line.trim().startsWith('|') && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1] ?? '')) {
      const head = splitRow(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) rows.push(splitRow(lines[i++]));
      out.push(
        <div key={key} className="mt-3 overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead><tr>{head.map((c, j) => <th key={j} className="border border-white/20 bg-white/10 p-2">{inline(c, `${key}h${j}`)}</th>)}</tr></thead>
            <tbody>{rows.map((r, ri) => <tr key={ri}>{r.map((c, j) => <td key={j} className="border border-white/20 p-2 align-top">{inline(c, `${key}r${ri}c${j}`)}</td>)}</tr>)}</tbody>
          </table>
        </div>,
      );
      continue;
    }

    const bullet = /^\s*[-*]\s+/.test(line);
    const numbered = /^\s*\d+\.\s+/.test(line);
    if (bullet || numbered) {
      const items: string[] = [];
      const re = bullet ? /^\s*[-*]\s+(.*)$/ : /^\s*\d+\.\s+(.*)$/;
      while (i < lines.length) {
        const m = re.exec(lines[i]);
        if (m) { items.push(m[1]); i++; }
        else if (/^\s{2,}\S/.test(lines[i]) && items.length) { items[items.length - 1] += ` ${lines[i].trim()}`; i++; }
        else break;
      }
      const lis = items.map((t, j) => <li key={j} className="mt-1">{inline(t, `${key}i${j}`)}</li>);
      out.push(bullet
        ? <ul key={key} className="mt-2 list-disc pl-6">{lis}</ul>
        : <ol key={key} className="mt-2 list-decimal pl-6">{lis}</ol>);
      continue;
    }

    // paragraph: consecutive plain lines
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,3}\s|\s*[-*]\s|\s*\d+\.\s|\s*\|)/.test(lines[i])) para.push(lines[i++].trim());
    out.push(<p key={key} className="mt-2 leading-relaxed">{inline(para.join(' '), key)}</p>);
  }
  return out;
}
