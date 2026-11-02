# Launch checklist

The single list of what stands between this project and real players. Each line says who must do it, and where the instructions are.
Status: **built and tested in this repository**, but **nothing has run against the real Supabase Auth, Google, Meta, Cloudflare, an email service,
Fly.io, the real Claude API, a real phone, or a real child's parent.** The public website still shows only single-player modes.

## 1. Must be done before anyone outside the team signs up

| # | What | Who | Instructions |
|---|---|---|---|
| 1 | A lawyer reviews the privacy policy, terms and child-safety policy, fills the `[brackets]`, and answers the 15 questions. Then set `LEGAL_REVIEWED` to `true` in `src/config.ts`. | You + lawyer | `docs/legal/lawyer-brief.md` |
| 2 | Decide where player data lives. The Supabase project is in `us-east-1`; if it should be Canada, create the production project in `ca-central-1` **before** anyone signs up. | You | `docs/DATABASE.md` |
| 3 | Create the production Supabase project; paid plan with backups and point-in-time recovery; run the restore drill once. | You | `docs/DATABASE.md` |
| 4 | Supabase dashboard settings: email confirmation, CAPTCHA, redirect URLs, a real email sender (SMTP). | You | `docs/AUTH_SETUP.md` |
| 5 | Google OAuth client; Meta app **and Meta's app review** (days to weeks: start first). | You | `docs/AUTH_SETUP.md` |
| 6 | Cloudflare Turnstile site (public key + secret). | You | `docs/AUTH_SETUP.md` |
| 7 | An SMTP account for the parent's consent email (`SMTP_URL`, `MAIL_FROM`). Without it, children under 13 cannot sign up. | You | `docs/DEPLOY.md` |
| 8 | Pick a host and deploy the game server (one machine), set the secrets, run the migrations, run `scripts/smoke.mjs`. | You | `docs/DEPLOY.md` |
| 9 | Build the website with the public settings (server address, Supabase address and publishable key, Turnstile site key). | You | `docs/DEPLOY.md` step 8 |
| 10 | Name the people who work the moderation queue, set how fast they must answer, give them moderator access (a `profiles.is_moderator` flag, set with SQL), and set `ALERT_WEBHOOK_URL` so a stuck queue reaches a human. | You | `docs/MODERATION.md`, `docs/MONITORING.md` |
| 11 | Child-safety reporting: register with NCMEC (or the equivalent in each country), give the documentation to a developer so the sender can be written, decide who confirms reports and how quickly. **Until then, reports are stored but sent nowhere.** | You + lawyer | `docs/lanes/trust.md` |
| 12 | A parental-consent method your lawyer accepts for each country (an email link alone may not be enough), and the per-country age-of-consent list (`AGE_OF_CONSENT_BY_COUNTRY`). | You + lawyer | `docs/legal/`, `docs/AUTH_SETUP.md` |
| 13 | Try the Claude reviewer on real held messages with a person checking every answer, before relying on it (`ANTHROPIC_API_KEY`, `REVIEW_MODEL`). Or leave it off: every held message then waits for a person. | You | `docs/MODERATION.md` |

## 2. Should be done before launch

| # | What | Who |
|---|---|---|
| 14 | An independent security review or penetration test; a security contact; read `docs/SECURITY.md` known weaknesses. | You / a tester |
| 15 | Test on real phones (iOS Safari and Android Chrome): sign-up, the on-screen keyboard, reconnecting after the phone sleeps, a full game. The automated checks used an emulated 360-pixel-wide screen only. | You |
| 16 | A real screen-reader and keyboard-only pass. Automated checks cover roughly a third of accessibility problems. | You / a tester |
| 17 | Re-run `npm run loadtest` on the real host and read `docs/LOADTEST.md` honestly: the existing figures are from idle players on one test machine. | You |
| 18 | A closed beta with a small group (adults first), with someone watching the queue and the alerts. | You |
| 19 | Rehearse the incident plans: the database is down; a child-safety report arrives; a moderator is unreachable; the server must be stopped. Write down who does what. | You |
| 20 | Tell your lawyer the retention periods and ask them to fill the table in `docs/legal/data-retention.md`; then the deletion jobs can be built. | You + lawyer |
| 21 | Put an external uptime monitor on `/healthz` (the server cannot report its own crash). | You |
| 22 | Decide the open policy questions: leaderboard default for teenagers; suspension tiers and repeat-offence lengths; whether to remember suspended (not just banned) accounts. | You |

## 3. Can wait until after launch

- Leaderboard seasons or resets; "friends only" boards.
- Chat in more languages (`LANGUAGE_PACKS` is the place).
- More shop items; a way to see friends' rooms.
- Retention jobs (after #20).
- Two server machines (needs shared state: rooms, rate limits and chat in a shared store).

## 4. The rehearsal (do this on staging before going live)

1. Sign up an adult with a brand-new email: confirmation email arrives, link works, profile step accepts nickname, birth date, country.
2. Sign up a child under 13 with a parent's address you own: the parent's email arrives; "I agree" works; the child can then chat; "Withdraw" works from the confirmation email.
3. Sign in with Google and with Meta.
4. Two phones in one room with a third and fourth browser: play a whole game; chat; send a message that breaks the rules and see the hold, the moderator screen, the appeal, the decision.
5. Friend codes both ways; an invite to a room; a block; a kick.
6. Finish a game: coins arrive, the leaderboard shows the player, the shop sells an item and it shows beside the name.
7. Log out on all devices and see the second device lose its connection. Delete the account and check what is gone and what stays (`docs/legal/data-retention.md`).
8. Stop the database for a minute: the alert fires. Restart the server during a game: players see the "restarting" message and reconnect.
9. `node scripts/smoke.mjs <server> <site>` passes.
10. Restore a backup into a new project and check the data.

## What is in place

- Game, practice, Daily Table, tour; rooms of 4 to 10; chat with pre-moderation, reports, blocks, mutes, kicks, appeals, a moderator screen and coin support tool.
- Accounts: email, Google, Meta; date of birth and country; parental permission flow; log out everywhere; delete account.
- Stored results, leaderboards, friends and invites, coins and a cosmetic shop.
- Database schema with row-level security everywhere, an audited migration runner, and CI that runs 540+ tests against a real Postgres and 32 browser tests.
- A production build of the server, Dockerfile, Fly settings, a manual deploy workflow, alerts, and a smoke test.
- Drafts of every legal document, shown in the app marked DRAFT.
