import { describe, expect, it } from 'vitest';
import { localDateKey } from '../hooks/useToday';

describe('localDateKey', () => {
  it('rolls the day over at local midnight, whatever the time zone', () => {
    // Both constructed in local time, so this holds on any machine's clock.
    expect(localDateKey(new Date(2026, 10, 4, 23, 59, 59))).toBe('2026-11-04');
    expect(localDateKey(new Date(2026, 10, 5, 0, 0, 0))).toBe('2026-11-05');
  });

  it('zero-pads the month and day', () => {
    expect(localDateKey(new Date(2026, 0, 3, 12))).toBe('2026-01-03');
  });

  it('differs from the UTC key late in the evening west of Greenwich', () => {
    // 11pm local on the 4th is already the 5th in UTC anywhere behind it; the key must stay on the 4th.
    const late = new Date(2026, 10, 4, 23, 30);
    expect(localDateKey(late)).toBe('2026-11-04');
    if (late.getTimezoneOffset() > 0) expect(late.toISOString().slice(0, 10)).toBe('2026-11-05');
  });
});
