import { describe, expect, it } from 'vitest';
import { legalSlugOf } from '../LegalPopupHost';

describe('legalSlugOf', () => {
  it('finds the page in a legal link, with or without a path before the hash', () => {
    expect(legalSlugOf('/steal-a-poop/#/legal/privacy')).toBe('privacy');
    expect(legalSlugOf('#/legal/child-safety')).toBe('child-safety');
    expect(legalSlugOf('https://x.test/#/legal/terms')).toBe('terms');
  });
  it('ignores every other link', () => {
    expect(legalSlugOf('https://github.com/x/y/issues')).toBeNull();
    expect(legalSlugOf('#/legal/nope')).toBeNull();
    expect(legalSlugOf(null)).toBeNull();
  });
});
