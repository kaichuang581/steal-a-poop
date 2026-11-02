# Lane: accounts

Status: taken over by Kai's Claude session (the lane was unstarted). Setup steps are in `docs/AUTH_SETUP.md`.

## Done
- Sign-in design and server: token checks (`server/auth/tokens.ts`), profiles, age and country rules (`server/auth/policy.ts`),
  parental consent by email link, log out (one session or all), banned-identity check, account deletion (`server/auth/service.ts`,
  `server/routes/accounts.ts`), CAPTCHA check (`server/auth/captcha.ts`), connection expiry and token refresh (`server/index.ts`).
- Migration `100_accounts.sql`. Applied, with the trust migrations, to the Supabase project `steal-a-poop`.
- App: sign-in, sign-up, reset and profile dialog, parent consent page, account section in Settings (`src/ui/auth`, `src/auth`).
- Tests: `server/auth/*.test.ts`, `server/routes/accounts.test.ts`, socket tests in `server/server.test.ts`, `src/auth/__tests__`, `e2e/auth.spec.ts`.

- Friends and invites, leaderboards, stored game results, server-run Daily Table with its gate, coins and a cosmetic shop (`docs/COMMUNITY.md`).

## Not done
- Real Google, Meta and Turnstile configuration, and a real mail sender (parental-consent email is refused in production until one exists).
- Per-country age table. Seasons or resets for leaderboards. Cosmetics on in-game seat labels.
- Moderator sign-in on `#/mod` still takes a pasted token; it should use the real login.

## Not verified
- Nothing has run against the real Supabase Auth, Google, Meta or Turnstile.

## Environment variables
See `docs/AUTH_SETUP.md`.

## Needs from other lanes
- Trust lane: nothing outstanding.
