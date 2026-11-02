/** Titles and links only, so the start screen does not pull the full documents into the main bundle. */
export const LEGAL_TITLES = { privacy: 'Privacy policy', terms: 'Terms of service', 'child-safety': 'Child safety' } as const;
export type LegalSlug = keyof typeof LEGAL_TITLES;
export const isLegalSlug = (s: string): s is LegalSlug => s in LEGAL_TITLES;

/** Links that open in a new tab, so a game in progress is not lost. */
export const legalHref = (slug: LegalSlug) => `${import.meta.env.BASE_URL}#/legal/${slug}`;
