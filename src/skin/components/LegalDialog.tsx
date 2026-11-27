import { BookIcon } from './Icons';
import { Dialog, InkCard, Scrim } from '../kit/modern';
import './hud-guide.css';
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

  return (
    <Scrim onClose={onClose}>
      <Dialog title={LEGAL_TITLES[slug]} icon={<BookIcon size={20} />} label={LEGAL_TITLES[slug]} onClose={onClose} wide className="hg hg-legal" onClick={(e) => e.stopPropagation()}>
        <div className="hg-tabs" role="tablist" aria-label="Legal pages">
          {SLUGS.map((s) => <button key={s} type="button" role="tab" aria-selected={s === slug} className={`hg-tab hm-slab hm-knit ${s === slug ? 'hm-slab--lantern' : ''}`} onClick={() => setSlug(s)}><span>{LEGAL_TITLES[s]}</span></button>)}
        </div>
        {!LEGAL_REVIEWED && (
          <InkCard tone="barn" size="sm" role="note" title="Draft" sub={`This text has not been reviewed by a lawyer and is not final.${draftFields > 0 ? ` ${draftFields} highlighted field${draftFields === 1 ? ' is' : 's are'} still to be filled in.` : ''}`} />
        )}
        <article aria-label={LEGAL_TITLES[slug]} className="sk-legal hg-legal-text rc-well">
          {body ?? <p>Loading…</p>}
        </article>
      </Dialog>
    </Scrim>
  );
}
