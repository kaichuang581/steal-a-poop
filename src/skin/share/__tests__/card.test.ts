import { describe, expect, it } from 'vitest';
import { wrapText } from '../card';

describe('wrapText', () => {
  it('keeps short text on one line', () => expect(wrapText('You win', 24)).toEqual(['You win']));
  it('wraps at word boundaries', () => expect(wrapText('Last sheep standing out of eight', 14)).toEqual(['Last sheep', 'standing out', 'of eight']));
});
