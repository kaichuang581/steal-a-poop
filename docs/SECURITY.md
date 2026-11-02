# Security review

A review of the code written for accounts, community and the server, done by the same assistant that wrote it. **It is not an independent
security test.** Before real players, get a person who did not write the code (or a paid penetration test) to try to break it.

## What was checked, and how

| Area | Result |
|---|---|
| **Dependencies** | `npm audit`: 0 known vulnerabilities. A high-severity set in the mail library (`nodemailer`) was found and fixed by upgrading to 10.x. CI now runs `npm audit --audit-level=high` on every branch, so a new serious advisory fails the branch check (it does not block a deploy from main). |
| **SQL injection** | Every query takes its values as parameters. The only built SQL text uses fixed column names chosen from a list in the code (`updateProfile`, the leaderboard metric), never player input. Searched: no other string-built queries. |
| **Cross-site scripting** | No `dangerouslySetInnerHTML`, `innerHTML` or `eval` anywhere. The legal pages render Markdown through React elements, tested to turn `<script>` into text. The built site carries a Content-Security-Policy (see below). |
| **Content-Security-Policy** | `default-src 'self'`; scripts only from the site and (when configured) Cloudflare's bot check; connections only to the site, the game server and Supabase; no frames, objects or base changes. Tested: a page-injected `fetch` to a foreign server and a foreign `<script>` are both blocked, and nothing the app legitimately does is. Limits: it is a `<meta>` tag (GitHub Pages cannot send headers), so `frame-ancestors` (clickjacking) is not covered; styles allow inline because the interface uses inline style attributes. |
| **Login tokens** | Checked on the server: signature (algorithms pinned, "none" refused), issuer, audience, expiry; logged-out sessions and tokens older than "log out everywhere" are refused; connections are closed when the token expires unrefreshed. Tested with locally signed tokens, not against real Supabase. |
| **Authorisation** | Every route declares its login level in one place (`auth: none | session | user | moderator`). All 31 routes were listed and reviewed: public ones are the leaderboards, the Daily board and the parent's consent links (token-based, rate limited); everything else needs a login, and moderator routes need the moderator flag, which can only be set with SQL. Routes act on the logged-in player's id from the token, never an id from the request body. |
| **CSRF** | Not applicable: the API uses a bearer token in a header, not cookies, so another site cannot make a browser send it. |
| **Cross-origin** | The API refuses any `Origin` not in `ALLOWED_ORIGINS`; the game connection checks the same list before upgrading; the server refuses to start in production without it. Tested. |
| **Rate limits** | Every message type on the game connection; sign-up, parent-mail, consent, friend requests, wrong friend codes, purchases and settings on the API; failed-guess limit on friend codes (32^8 codes, 10 wrong guesses an hour). In memory, so they reset when the server restarts and apply per process. |
| **Secrets** | None in the repository (checked by search). Only the publishable Supabase key and the Turnstile site key reach the browser. The service role key, JWT secret, database URL, Turnstile secret, SMTP URL and API key are server settings. Logs carry ids and timings, never message text, addresses or tokens. The development mailer prints consent links, and only runs outside production. |
| **Production safety** | In production the server refuses to start without real sign-in, a database, the bot check, the service key and allowed origins, and the development sign-in cannot be switched on. `scripts/smoke.mjs` confirms this against a running server. |
| **Data exposure** | Every table has row-level security with no policies and no access for the browser roles; a test fails the build if a new table lacks it. Verified on the live Supabase project. The leaderboards expose nicknames only; players who needed a parent's permission are never listed. |
| **Abuse of the economy** | Coins can only come from a finished game, once per game (ledger key), capped per account per day; balances cannot go negative (database rule); purchases are atomic (tested with a race on real Postgres). No transfer between players exists. |
| **Mail** | Plain text only; recipients and subject cannot be extended by header injection (tested). The parent's address is rate limited (3 requests a day per address). |

## Known weaknesses (not fixed)

1. **One server process holds everything in memory.** Rate-limit counters, rooms and chat history vanish on restart, and a restart ends every game. This is also the reason the server must run as one machine.
2. **Several accounts can farm coins from each other.** The daily cap and the bot check slow it; they do not stop it.
3. **Suspension evasion is limited, not eliminated.** Deleting an account while suspended (or with a case open) holds the email, by hash, until the suspension would have ended (open case: 7 days, or until a person clears it). A person with a second email address, or who *waits out* the hold, is not stopped. Someone suspended who has not deleted anything can still make a second account with a different email while suspended; only the deleted-and-recreated route is closed.
4. **Ban evasion with a new email is not detected.** There is no device or address matching, on purpose (privacy).
5. **A recently-signed-in check for deleting an account** uses the time the person last typed a password (Supabase's `amr` timestamp). A stolen *refresh token* does not extend it, but a stolen *session with a fresh sign-in* can delete the account.
6. **Email-link parental consent is weak** and may not satisfy the law in some countries (see `docs/legal/`).
7. **The chat filter is a net, not a guarantee.** It is tested against disguises of its own word list only, not against words missing from the list, other languages or images.
8. **The Claude reviewer's resistance to prompt injection is untested against the real model.** The server's handling is tested with a mock.
9. **No independent testing**, no bug bounty, no security contact published yet. Add a `security.txt` or a contact in the privacy policy.
10. **`npm audit` runs in branch CI only**, not in the deploy from main, so a new advisory never blocks an urgent release; read the branch check.
11. **Clickjacking** (the site inside someone else's frame) is not prevented, because GitHub Pages cannot set `X-Frame-Options`. Serve the site from a host that can set headers if this matters to you.

## Before launch

- Independent review or a penetration test of the sign-in, account deletion, parent consent and moderator routes.
- Turn on Supabase's own protections (CAPTCHA, rate limits, email confirmation) as in `docs/AUTH_SETUP.md`, and test a real sign-up end to end.
- Decide who receives security reports and say so publicly.
