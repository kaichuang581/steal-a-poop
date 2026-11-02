import { useEffect } from 'react';
import { LEGAL_REVIEWED } from '../../config';
import { LEGAL_DOCS, isLegalSlug, legalHref } from './legalDocs';
import type { LegalSlug } from './legalDocs';
import { countPlaceholders, renderMarkdown } from './markdown';

/** The player-facing legal pages at #/legal/privacy, #/legal/terms and #/legal/child-safety. */
export default function LegalScreen({ slug }: { slug: string }) {
  const known = isLegalSlug(slug);
  const doc = known ? LEGAL_DOCS[slug] : null;
  useEffect(() => {
    document.title = doc ? `${doc.title} · Steal a Poop` : 'Steal a Poop';
  }, [doc]);

  const missing = doc ? countPlaceholders(doc.body) : 0;
  return (
    <main className="mx-auto max-w-3xl overflow-y-auto px-4 py-6 text-white" style={{ height: '100%' }}>
      <nav className="flex flex-wrap items-center gap-3 text-sm" aria-label="Legal pages">
        <a className="min-h-11 content-center underline" href={import.meta.env.BASE_URL}>← Back to the game</a>
        {(Object.keys(LEGAL_DOCS) as LegalSlug[]).map((s) => (
          <a key={s} className="min-h-11 content-center underline" href={legalHref(s)} aria-current={s === slug ? 'page' : undefined}>
            {LEGAL_DOCS[s].title}
          </a>
        ))}
      </nav>
      {!LEGAL_REVIEWED && (
        <div role="note" className="mt-3 rounded-xl border-2 border-red-400 bg-red-900/40 p-3 text-sm font-bold">
          DRAFT. This text has not been reviewed by a lawyer and is not final.
          {missing > 0 && ` ${missing} highlighted field${missing === 1 ? ' is' : 's are'} still to be filled in.`}
        </div>
      )}
      {doc ? (
        <article aria-label={doc.title}>{renderMarkdown(doc.body)}</article>
      ) : (
        <p className="mt-6">That page does not exist.</p>
      )}
    </main>
  );
}
