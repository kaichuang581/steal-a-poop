import { describe, expect, it } from 'vitest';
import { detectDevice } from '../device';

const desktop = 'Mozilla/5.0 (X11; Linux x86_64) Chrome/120';
const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148';

describe('device', () => {
  it('a phone user agent is a phone, whatever the width', () => {
    expect(detectDevice({ coarse: false, width: 1200, userAgent: iphone })).toBe('phone');
  });
  it('a narrow touch screen is a phone; a desktop with a mouse is a computer', () => {
    expect(detectDevice({ coarse: true, width: 390, userAgent: desktop })).toBe('phone');
    expect(detectDevice({ coarse: false, width: 390, userAgent: desktop })).toBe('computer');
    expect(detectDevice({ coarse: false, width: 1440, userAgent: desktop })).toBe('computer');
  });
  it('a touch tablet in landscape counts as a computer', () => {
    expect(detectDevice({ coarse: true, width: 1024, userAgent: desktop })).toBe('computer');
  });
});
