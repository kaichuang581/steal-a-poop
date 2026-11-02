import { describe, expect, it, vi } from 'vitest';
import { DevCaptcha, TurnstileVerifier } from './captcha';

const reply = (body: unknown, ok = true) => vi.fn(async () => ({ ok, json: async () => body }) as unknown as Response);

describe('TurnstileVerifier', () => {
  it('sends the secret, the token and the address, and accepts success', async () => {
    const f = reply({ success: true });
    const v = new TurnstileVerifier({ secret: 'S', fetchImpl: f as unknown as typeof fetch });
    expect(await v.verify('tok', '1.2.3.4')).toBe(true);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://challenges.cloudflare.com/turnstile/v0/siteverify');
    expect(String(init.body)).toBe('secret=S&response=tok&remoteip=1.2.3.4');
  });
  it('refuses failure, a missing or huge token, an HTTP error, and a network error', async () => {
    const make = (f: unknown) => new TurnstileVerifier({ secret: 'S', fetchImpl: f as typeof fetch });
    expect(await make(reply({ success: false })).verify('tok', 'ip')).toBe(false);
    expect(await make(reply({ success: true })).verify(undefined, 'ip')).toBe(false);
    expect(await make(reply({ success: true })).verify('x'.repeat(5000), 'ip')).toBe(false);
    expect(await make(reply({ success: true }, false)).verify('tok', 'ip')).toBe(false);
    expect(await make(vi.fn(async () => { throw new Error('offline'); })).verify('tok', 'ip')).toBe(false);
  });
  it('gives up on a check that never answers', async () => {
    const f = vi.fn((_u: string, init: RequestInit) => new Promise<Response>((_r, rej) => init.signal!.addEventListener('abort', () => rej(new Error('aborted')))));
    const v = new TurnstileVerifier({ secret: 'S', fetchImpl: f as unknown as typeof fetch, timeoutMs: 20 });
    expect(await v.verify('tok', 'ip')).toBe(false);
  });
});

describe('DevCaptcha', () => {
  it('accepts only the development token', async () => {
    const c = new DevCaptcha();
    expect([await c.verify('dev-ok'), await c.verify('other'), await c.verify(undefined)]).toEqual([true, false, false]);
  });
});
