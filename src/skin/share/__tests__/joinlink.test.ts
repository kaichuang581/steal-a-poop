import { describe, expect, it } from 'vitest';
import { codeFromSearch } from '../JoinLink';

describe('codeFromSearch', () => {
  it('reads and upper-cases a room code', () => expect(codeFromSearch('?join=ab12')).toBe('AB12'));
  it('ignores a missing or odd code', () => {
    expect(codeFromSearch('')).toBeNull();
    expect(codeFromSearch('?join=')).toBeNull();
    expect(codeFromSearch('?join=<script>')).toBeNull();
    expect(codeFromSearch('?join=waytoolongcode')).toBeNull();
  });
});
