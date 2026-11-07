import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { LEGAL_REVIEWED } from '../../config';
import { LEGAL_TITLES } from '../../ui/legal/legalLinks';
import type { LegalSlug } from '../../ui/legal/legalLinks';

const SLUGS = Object.keys(LEGAL_TITLES) as LegalSlug[];

/** The privacy policy, terms and child safety page as a window over the game. The documents load only when it opens. */
export function LegalDialog({ initial, onClose }: { initial: LegalSlug; onClose: () => void }) {
  const [slug, setSlug] = useState<LegalSlug>(initial);
  const [body, setBody] = useState<ReactNode>(null);
  const [draftFields, setDraftFields] = useState(0);
  useEffect(() => {
    let live = true;
    void Promise.all([import('../../ui/legal/legalDocs'), import('../../ui/legal/markdown')]).then(([docs, md]) => {
      if (!live) return;
      const text = docs.LEGAL_DOCS[slug].body;
      setBody(md.renderMarkdown(text));
      setDraftFields(md.countPlaceholders(text));
    });
    return () => { live = false; };
  }, [slug]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const tab = (on: boolean) => `min-h-11 rounded-lg border-2 px-3 text-sm font-bold ${on ? 'border-[#c0792b] bg-white' : 'border-transparent bg-white/60'}`;
  return (
    <div role="dialog" aria-modal="true" aria-label={LEGAL_TITLES[slug]} className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-3" onClick={onClose}>
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col rounded-xl bg-[var(--paper,#f6efe0)] p-4 text-[#2b221d]" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Legal pages">
            {SLUGS.map((s) => <button key={s} role="tab" aria-selected={s === slug} className={tab(s === slug)} onClick={() => setSlug(s)}>{LEGAL_TITLES[s]}</button>)}
          </div>
          <button className="min-h-11 min-w-11 rounded-lg px-3 font-bold" onClick={onClose} aria-label="Close" title="Close" autoFocus>Close</button>
        </div>
        {!LEGAL_REVIEWED && (
          <div role="note" className="mb-3 rounded-lg border-2 border-red-400 bg-red-100 p-2 text-sm font-bold text-red-900">
            DRAFT. This text has not been reviewed by a lawyer and is not final.{draftFields > 0 && ` ${draftFields} highlighted field${draftFields === 1 ? ' is' : 's are'} still to be filled in.`}
          </div>
        )}
        <article aria-label={LEGAL_TITLES[slug]} className="sk-legal min-h-0 flex-1 overflow-y-auto pr-1 text-sm leading-relaxed [&_a]:underline [&_h1]:mb-2 [&_h1]:text-xl [&_h1]:font-black [&_h1]:text-[#7a4a12] [&_h2]:mb-1 [&_h2]:mt-4 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-[#7a4a12] [&_h3]:font-bold [&_h3]:text-[#7a4a12] [&_mark]:bg-amber-200 [&_mark]:text-[#7a2a00] [&_code]:bg-black/10 [&_code]:text-[#2b221d] [&_li]:ml-5 [&_li]:list-disc [&_p]:mb-2 [&_table]:my-2 [&_td]:border [&_td]:border-[#c9b896] [&_td]:p-1 [&_th]:border [&_th]:border-[#c9b896] [&_th]:p-1">
          {body ?? <p>Loading…</p>}
        </article>
      </div>
    </div>
  );
}
