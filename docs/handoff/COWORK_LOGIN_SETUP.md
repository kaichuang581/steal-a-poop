# Handoff: switch on login and sign-up (for Cowork)

Paste this whole file into Cowork, or tell it: "Read docs/handoff/COWORK_LOGIN_SETUP.md and do it step by step, stopping where you need me."

## Goal
Sign-up and login work on the live site: Google, email and password (then a username), or guest (no account). Logging out returns to the landing page. Nothing else changes.

## What is already done (do not redo)
- The landing page, the account dialog, the username step, the username filter (client and server) and logout routing are built and deployed.
- The website build reads four public settings from GitHub Actions variables (`.github/workflows/deploy.yml`). Empty values keep sign-in off, which is how the live site runs today.
- The game server (`server/`) has the account routes (`/api/account/username`, `/api/account/me`, `/api/account/logout`, and others). It is not deployed yet.
- Database migrations are in `db/migrations/`. Run with `npm run migrate`.

## Rules
- **Never paste a secret into chat, a commit, a file or an issue.** Secrets go into Fly secrets or GitHub secrets only. The four `VITE_` values in step 4 are public and go into GitHub *variables*.
- Do not change `src/engine` or any existing test. Do not add dependencies.
- Work on a branch `login-setup`. Do not push to `main` until steps 1 to 6 pass. Pushing to `main` deploys the live site.
- Before any push run `npm run build`, `npx tsc --noEmit` and `npx vitest run`. If one fails, stop and report it; do not work around it.
- Ask me before anything that costs money beyond the free tiers, or deletes data.

## Step 1: check what exists
1. Look for an existing Fly.io app and an existing Supabase project. The Supabase project in use is `hmcwncqgafwijjlwezgf` (from `docs/AUTH_SETUP.md`).
2. Tell me what you found: a Fly app name, a Postgres database (on Fly or elsewhere), and whether the Supabase project is live.

## Step 2: Supabase settings (dashboard, by me or you)
1. Authentication, Sign In / Providers, Email: switch **Confirm email** off, then save. (Without this, players are sent a confirmation email.)
2. Authentication, Sign In / Providers, Google: enable it and paste the Google OAuth client ID and secret from Google Cloud Console. The redirect URL to register with Google is the one Supabase shows on that page.
3. Authentication, URL Configuration: set the site URL to `https://kaichuang581.github.io/steal-a-poop/`, and add the same address to the redirect allow-list.
4. Settings, API: copy the **project URL** and the **publishable key** (starts `sb_publishable_`). Copy the **service-role key** too, for the server.

## Step 3: Cloudflare Turnstile (bot check for sign-up)
1. Create a Turnstile widget. Hostnames: `kaichuang581.github.io` and `localhost`.
2. Copy the **site key** (public) and the **secret key** (secret).

## Step 4: GitHub variables (public, not secrets)
Repo, Settings, Secrets and variables, Actions, **Variables** tab. Add:
- `VITE_SUPABASE_URL` = the project URL from step 2.4
- `VITE_SUPABASE_ANON_KEY` = the publishable key from step 2.4
- `VITE_TURNSTILE_SITE_KEY` = the site key from step 3
- `VITE_SERVER_URL` = `wss://<fly-app>.fly.dev` (fill in after step 5)

## Step 5: deploy the game server
Follow `docs/DEPLOY.md` (Fly section). Summary:
1. `fly launch --no-deploy --copy-config`, with a unique app name.
2. Set secrets: `fly secrets set DATABASE_URL=... SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... TURNSTILE_SECRET=... APP_URL=https://kaichuang581.github.io/steal-a-poop/ ALLOWED_ORIGINS=https://kaichuang581.github.io TRUST_PROXY=1`. Add the other values `docs/DEPLOY.md` lists.
3. Run migrations against the database: `DATABASE_URL=... npm run migrate`.
4. `fly deploy`, then `curl https://<app>.fly.dev/healthz` must answer `{"ok":true}`.
5. `fly logs` must show no warnings about missing `ALLOWED_ORIGINS`, `DATABASE_URL`, `TURNSTILE_SECRET` or `SUPABASE_URL`.
6. Put `wss://<app>.fly.dev` into the `VITE_SERVER_URL` variable from step 4.

## Step 6: deploy the website and test
1. Run the GitHub Deploy workflow (or push to `main` once steps 1 to 5 pass).
2. Open the live site in a private window. Check each path:
   - **Email sign-up:** create an account, choose a username, land on the menu. Log out: landing page appears.
   - **Email login:** sign in again: menu appears directly, no landing page.
   - **Google:** the button goes to Google, returns, and asks for a username.
   - **Guest:** play as guest, username saved; top-right shows a Log in button.
   - **Rude name:** "fuck" is refused with "Please pick a friendlier username."
3. Run `node scripts/smoke.mjs https://<app>.fly.dev https://kaichuang581.github.io` and report the result.

## Report back
For each step: done, or blocked and why. For step 6, a yes/no for each check. Include the Fly app name and the Supabase project name. Do not include any secret value.

## Known gaps to tell me about, not fix silently
- Username-only accounts (email, Google and guest sign-ups) never give an age. They keep progress but cannot chat, use friends or appear on public boards. A lawyer should review that before launch.
- The sample round is the tutorial script, not a full game.
