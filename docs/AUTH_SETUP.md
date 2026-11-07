# Sign-in setup

What the code does, and the steps that only the account owner can do in a dashboard. Menu names in
Supabase, Google and Meta change now and then; where a name below is missing, look for the closest one.

## The Supabase project

- Project: `steal-a-poop`, ref `hmcwncqgafwijjlwezgf`, `https://hmcwncqgafwijjlwezgf.supabase.co`, region **us-east-1**.
- A project's region cannot be changed later. If the player data should be held in Canada (`ca-central-1`),
  make a new project there **before** real players sign up and move the migrations over.
- This is the only project so far, so treat it as **staging**. Make a second one for production when you launch.
- Migrations applied: `100_accounts`, `200_moderation`, `201_moderation_audit`, `202_child_safety_reports`,
  `203_user_blocks`, `204_harden_trigger_functions`, `101_game_results`, `102_economy`, `103_friends`.
  Order matters only for 100 before 101 (101 adds a column to `profiles`). All tables have row security on and no policies, so only the
  server (with the service key) can read them. Supabase's security advisor reports only that intended "no policy" notice.

## What you do in the Supabase dashboard

1. **Authentication, Providers, Email**: on. Turn **Confirm email** on. Set the minimum password length to 8 or more.
2. **Authentication, URL Configuration**: Site URL = your website (for example `https://kaichuang581.github.io/steal-a-poop/`).
   Add the same address and `http://localhost:5173/steal-a-poop/` to **Redirect URLs**.
3. **Authentication, Attack Protection**: turn on CAPTCHA protection, choose **Cloudflare Turnstile**, paste the Turnstile
   **secret** (see below). This protects Supabase's own sign-up, sign-in and password-reset calls. Our server separately
   checks the same CAPTCHA when a profile is created.
4. **Authentication, Rate Limits**: keep the defaults or lower them. These limit sign-ups and emails per hour.
5. **Authentication, Emails / SMTP**: Supabase's built-in sender is for testing only and is heavily limited. Connect a real
   email service before launch, and edit the email templates (plain language, mention the game's name).
6. **Authentication, Sessions**: the default access-token life is one hour. A shorter life ends a stolen token sooner
   (the game server asks the app for a fresh token before expiry, so players are not interrupted).
7. **Project Settings, JWT Keys** (or API): note whether the project signs tokens with **asymmetric keys** (then nothing to
   configure: the server fetches the public keys) or the older **shared JWT secret** (then set `SUPABASE_JWT_SECRET` on the server).

### Google sign-in
1. Google Cloud Console, create or choose a project, **OAuth consent screen**: app name, support email, your privacy policy
   and terms URLs (`#/legal/privacy`, `#/legal/terms` on the live site), authorised domain.
2. **Credentials, Create OAuth client ID, Web application**. Authorised redirect URI:
   `https://hmcwncqgafwijjlwezgf.supabase.co/auth/v1/callback`.
3. Copy the client ID and secret into **Supabase, Authentication, Providers, Google**.
4. The game needs only the basic profile and email scopes.

### Meta (Facebook) sign-in
1. developers.facebook.com, **Create app** (type: Consumer), add the **Facebook Login** product.
2. Valid OAuth redirect URI: the same Supabase callback address as above.
3. Copy the app ID and secret into **Supabase, Authentication, Providers, Facebook**.
4. **App review is required before the public can use it**: switch the app to Live, which needs a privacy policy URL, a
   data-deletion method (point it at the in-game "Delete my account" and `docs/legal/data-requests.md`), an app icon and a
   category. Ask for the `email` permission; the game cannot finish sign-up without an email address (it is how a banned
   person is recognised), so a Meta account that hides its email gets a message to use email sign-up instead.
5. Meta can take days to weeks to review. Start now.

### Cloudflare Turnstile (the bot check)
1. Cloudflare dashboard, **Turnstile**, add a site for your website's domain. You get a **site key** (public) and a **secret**.
2. Site key goes in the website build (`VITE_TURNSTILE_SITE_KEY`). The secret goes in Supabase (step 3 above) **and** in the
   game server (`TURNSTILE_SECRET`).

## Settings the code reads

**Website build** (public values only; these go in the GitHub Actions build, not in secrets):

| Variable | Value |
|---|---|
| `VITE_SERVER_URL` | the game server, for example `wss://your-app.fly.dev` |
| `VITE_SUPABASE_URL` | `https://hmcwncqgafwijjlwezgf.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | the project's **publishable** key (`sb_publishable_...`), safe to publish |
| `VITE_TURNSTILE_SITE_KEY` | the Turnstile site key |

**Game server** (secrets: put them in the host's secret store, never in the repository or in chat):

| Variable | What |
|---|---|
| `SUPABASE_URL` | `https://hmcwncqgafwijjlwezgf.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | the service role key. **Secret.** Lets the server delete a login when an account is deleted |
| `SUPABASE_JWT_SECRET` | only for a legacy project that signs with a shared secret. **Secret** |
| `DATABASE_URL` | the project's Postgres connection string. **Secret** |
| `TURNSTILE_SECRET` | **Secret** |
| `APP_URL` | the website address, used in the parent's email link |
| `ALLOWED_ORIGINS` | the website origin(s) |
| `AGE_OF_CONSENT_BY_COUNTRY` | JSON such as `{"DE":16}`; **fill from your lawyer**. Default is 13 everywhere |
| `ALLOWED_COUNTRIES`, `BLOCKED_COUNTRIES` | optional, comma-separated ISO codes |

With `NODE_ENV=production` the server refuses to start unless real sign-in, `DATABASE_URL`, the CAPTCHA secret, `APP_URL` and
the service key are set. Development sign-in (`dev:name`) cannot be switched on in production.

## How sign-in works

1. The browser signs up or in with Supabase (email and password, Google or Meta). Supabase sends the verification and reset
   emails and checks the CAPTCHA.
2. After verification the app asks for a profile: nickname, date of birth, country. The game server saves it
   (`POST /api/account/profile`) after its own CAPTCHA check and the rules in `server/auth/policy.ts`.
3. A child below the age of consent (13 unless `AGE_OF_CONSENT_BY_COUNTRY` says otherwise) must give a parent's email. The server
   emails the parent a link (`#/consent/<token>`). Until the parent agrees the child can play but cannot chat and results are not stored.
4. Every game connection and API call carries the Supabase token. The server checks the signature with the project's public keys,
   the issuer, audience and expiry, whether that session was logged out, and whether the token predates "log out everywhere".
5. The server asks the app for a fresh token before the old one expires, and closes the connection if it does not get one.
6. **Log out** ends this session at once on the server; **Log out on all devices** ends every session and every refresh token.
7. **Delete account** needs a sign-in from the last 10 minutes and the word DELETE. It deletes the login at Supabase, the player's
   blocks and personal profile fields. Moderation records, child-safety reports, the audit log and parental-consent records are kept.

## Decisions made, and the reasoning

- **Can a banned person make a new account? No.** When a moderator bans an account, a hash of its (normalised) email is stored, and
  sign-up with that email, however it is typed (dots, `+tags`, `googlemail`), is refused with a neutral message. This stops casual
  return, not a determined person with a new email address. Ban evasion found later is handled by banning again.
- **Can a suspended person delete their account to start over? No, not on the same email.** If an account is deleted while suspended, a one-way hash of its normalised email is held until the suspension would have ended; if a moderation case is still open, for 7 days (`openCaseHoldMs`) or until a person clears it, whichever applies; the longer of the two wins. During the hold, signing up with that email fails with the same neutral message as a ban. The hold is removed early if a person clears the case, and purged when it expires. An account in good standing is not held at all. Table: `restricted_identities`.
- **Date of birth is stored** (to apply the age rule and to know when a child reaches the age). It is removed when the account is deleted.
- **Email address is not copied into our tables**; only its hash is, for the ban check. Supabase holds the address.
- **The parent's email is kept** in the consent record as proof of consent, even after the child's account is deleted. Whether to keep it is a question for your lawyer.
- **Email-link consent is the weakest form of "verifiable parental consent".** Many laws expect more (a small card payment, a signed form,
  a video call). Do not rely on it for children in countries that require more until a lawyer approves it.

## Not verified

None of the Supabase, Google, Meta or Turnstile steps above have been run against the real services from here. The server code was
tested with locally signed tokens and the screens with the Supabase and server calls faked in the browser. First real test:
sign up with a new email on a staging build and watch the whole path.

## Simple sign-up (November 2026)

Accounts exist only to save progress. There are three ways in:

1. **Email and password**, then a username.
2. **Google**, then a username.
3. **Guest**: no account at all. A username is kept in this browser (`localStorage`, key `sap:guest`) and everything saves on that one device.

**You must turn off email confirmation in Supabase, or people will still be sent a confirmation email:** Supabase dashboard, Authentication, Sign In / Providers, Email, switch **Confirm email** off, then save. This cannot be changed from the game's code. The game's own server sends no email for these sign-ups. (Password-reset emails are still sent, but only when a player asks for one.)

Usernames are 2 to 12 characters. Rude, sexual and hateful names are refused in the browser and again on the server (`isInappropriateName` in `src/lib/nickname.ts`); the same list is used in both places.

**What a username-only account can and cannot do.** No date of birth, country or parent email is asked, so the account is stored with consent status `unconfirmed`. It keeps its progress (results, coins, stats) but cannot chat, use friends or appear on public boards, because those depend on knowing the player's age. The older sign-up with a date of birth and a parent's permission (`POST /api/account/profile`) is still in the server for accounts that used it. **Ask the lawyer** whether collecting an email address from players without asking their age is acceptable in the countries you launch in.
