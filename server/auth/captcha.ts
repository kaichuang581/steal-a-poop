/** Bot protection for our own sign-up endpoints. (Supabase's own sign-up and password-reset pages have their own CAPTCHA setting.) */
export interface CaptchaVerifier {
  verify(token: string | undefined, ip: string): Promise<boolean>;
}

/**
 * Cloudflare Turnstile. The browser widget produces a one-time token; we ask Cloudflare to confirm it.
 * Endpoint and fields are Turnstile's documented "siteverify" call.
 */
export class TurnstileVerifier implements CaptchaVerifier {
  constructor(private opts: { secret: string; fetchImpl?: typeof fetch; endpoint?: string; timeoutMs?: number }) {}
  async verify(token: string | undefined, ip: string): Promise<boolean> {
    if (!token || token.length > 4096) return false;
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), this.opts.timeoutMs ?? 5000);
    try {
      const res = await (this.opts.fetchImpl ?? fetch)(this.opts.endpoint ?? 'https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ secret: this.opts.secret, response: token, remoteip: ip }).toString(),
        signal: ctl.signal,
      });
      if (!res.ok) return false;
      return ((await res.json()) as { success?: boolean }).success === true;
    } catch {
      return false; // fail closed: if we cannot check, the person is not let through
    } finally {
      clearTimeout(timer);
    }
  }
}

/** Local development only: accepts the token "dev-ok". Never used in production. */
export class DevCaptcha implements CaptchaVerifier {
  async verify(token: string | undefined) {
    return token === 'dev-ok';
  }
}
