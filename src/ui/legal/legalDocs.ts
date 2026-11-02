import childSafety from '../../../docs/legal/child-safety-policy.md?raw';
import privacy from '../../../docs/legal/privacy-policy.md?raw';
import terms from '../../../docs/legal/terms-of-service.md?raw';
import { LEGAL_TITLES } from './legalLinks';
import type { LegalSlug } from './legalLinks';

export { LEGAL_TITLES, isLegalSlug, legalHref } from './legalLinks';
export type { LegalSlug } from './legalLinks';

/** The documents shown to players. Internal ones (retention, processors, lawyer brief) stay in docs/legal only. */
export const LEGAL_DOCS: Record<LegalSlug, { title: string; body: string }> = {
  privacy: { title: LEGAL_TITLES.privacy, body: privacy },
  terms: { title: LEGAL_TITLES.terms, body: terms },
  'child-safety': { title: LEGAL_TITLES['child-safety'], body: childSafety },
};
