# Deploying the game server

The website deploys by itself from `main` (GitHub Pages). The **game server** is separate and is deployed by hand. Nothing in the
multiplayer, sign-in, friends, boards or shop works for players until this is done.

Everything below is written but **has not been run** (no Fly.io account or Docker was available when it was written). Expect to fix small
things on the first real deploy, and write them down here.

## What is in the box

- `npm run build:server` makes `dist-server/main.mjs` (one file). `npm start` runs it. Tested: it starts, answers `/healthz`, and a player can connect and make a room.
- `Dockerfile`: a two-stage image with production packages only. Checked by repeating its steps by hand; the image itself has not been built.
- `fly.toml`: one machine, always on, health check on `/healthz`, `TRUST_PROXY=1`.
- `.github/workflows/deploy-server.yml`: manual deploy that applies database migrations and then deploys to Fly.io.

**One machine only.** Rooms, games and chat history are in memory, and item numbers come from memory. Two machines would split players into
separate worlds. Do not raise `min_machines_running` above 1 or add machines.

## First deploy

1. Create a Fly.io account and install `flyctl`. Log in: `fly auth login`.
2. Edit `fly.toml`: a unique `app` name and a `primary_region` near most players.
3. Create the app without deploying: `fly launch --no-deploy --copy-config`.
4. Set the secrets (values from `docs/AUTH_SETUP.md`; never paste them into chat or commit them):

```bash
fly secrets set \
  SUPABASE_URL=https://hmcwncqgafwijjlwezgf.supabase.co \
  SUPABASE_SERVICE_ROLE_KEY=... \
  DATABASE_URL=... \
  TURNSTILE_SECRET=... \
  APP_URL=https://your-site-address/ \
  ALLOWED_ORIGINS=https://your-site-origin \
  ANTHROPIC_API_KEY=... REVIEW_MODEL=... \
  SMTP_URL=... MAIL_FROM=... \
  ALERT_WEBHOOK_URL=...
```

   Leave out `SUPABASE_JWT_SECRET` unless the project signs with a shared secret. Leave out `ANTHROPIC_API_KEY` to have every held message wait for a person.
5. Add the same secrets to GitHub (Settings, Secrets, Actions): `DATABASE_URL` and `FLY_API_TOKEN` (`fly tokens create deploy`). In Settings, Environments, make a `production` environment with a required reviewer.
6. Run the **Deploy server** workflow (Actions tab). It shows pending migrations, applies them, and deploys.
7. Check: `curl https://<app>.fly.dev/healthz` answers `{"ok":true}`. Look at `fly logs`: you should see "game server on ..." and **no** "No ALLOWED_ORIGINS" or "No DATABASE_URL" warning.
8. Point the website at it: add `VITE_SERVER_URL=wss://<app>.fly.dev`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_TURNSTILE_SITE_KEY` to the website build (GitHub Pages workflow environment) and redeploy the site. Until you do, multiplayer stays hidden on the public site.
9. Add the website address to Supabase Authentication, URL Configuration (Site URL and Redirect URLs).
10. Run the safety check against the live server (read-only, creates nothing):

```bash
node scripts/smoke.mjs https://<app>.fly.dev https://your-site-origin
```

    It confirms: the health check answers; account, shop, friends, wallet and moderator routes refuse strangers; the leaderboard is public and
    sane; a foreign website is refused by both the API and the game connection; and the development sign-in does not work. All lines must say `ok`.
    (It was run against the production build with a real, freshly migrated Postgres and passed all 13 checks; it has not been run against Fly.io.)
11. Smoke test on a real phone and a real laptop: sign up, verify the email, finish the profile, make a room, play a game, check the coins arrive.

The server refuses to start in production unless real sign-in, the database, the bot check, `APP_URL`, the service key and `ALLOWED_ORIGINS` are all set, and says which is missing.

## Every deploy

- A deploy restarts the server. **Every game in progress ends** and players reconnect to an empty server (the app tells them). Deploy when few people are playing, and say so first if you have players.
- Migrations are applied before the code (see `docs/DATABASE.md`); write them so the old code still works against the new schema.

## Rolling back

```bash
fly releases
fly deploy --image <the previous image reference from fly releases>
```

Database changes are not rolled back (forward-only); undo them with a new migration.

## Watching it

- `fly logs` for the live log. The server logs ids and timings, never message text or addresses.
- `GET /healthz` for "is it up".
- Moderators can open `GET /api/ops/status` (see `docs/MONITORING.md`) for connections, rooms, the oldest waiting moderation item and the reviewer's spend.
- Set `ALERT_WEBHOOK_URL` to a Slack or Discord webhook to be told about a stuck moderation queue, database write failures, and the reviewer hitting its limit.

## Costs and limits

I have not priced this; check Fly.io's current pricing for one shared machine with 512 MB. The load test (`docs/LOADTEST.md`) ran 600 mostly idle players on one process without trouble, but on a different machine and with no database, so treat it as a floor.
