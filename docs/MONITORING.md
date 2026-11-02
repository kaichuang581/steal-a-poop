# Monitoring and alerts

What watches the running server, and what to do when it speaks. Set `ALERT_WEBHOOK_URL` (a Slack or Discord incoming webhook) on the server;
without it the server prints a warning at start and **nobody is told about problems**.

## What is checked (every minute)

| Alert | When | What to do |
|---|---|---|
| **URGENT: child-safety item waiting** | a held child-safety item has waited over 30 minutes for a person (`ALERT_CHILD_SAFETY_MINUTES`) | Open `#/mod` now. Follow the reporting steps in `docs/MODERATION.md`. |
| Moderation queue stuck | any item waiting over 2 hours (`ALERT_QUEUE_MINUTES`) | Someone needs to work the queue (`#/mod`). The automatic reviewer may be off or capped. |
| Database not answering | `select 1` fails | Check Supabase status and the project. While it is down, suspensions and bans are kept only in memory and **would be lost if the server restarts**: do not deploy. |
| Moderation writes failed | the count of failed saves grew | Same as above; the memory copy is ahead of the database. |
| Reviewer hit its daily limit | the automatic reviewer stopped for the day | Held messages wait for a person until midnight UTC. Raise the limit only if you meant to. |
| Reviewer failing | 5 or more failed calls in a minute | The AI service is down or the key is wrong. Held messages are going to a person, which is safe. |
| Connections high | 80% of `MAX_CONNECTIONS` | Is it a surge, or an attack from many addresses? Look at `GET /api/ops/status`. |
| Memory high | over 420 MB (`ALERT_MEMORY_MB`) on a 512 MB machine | Restart at a quiet time; look for a leak if it climbs again. |

When a problem goes away the monitor posts "Cleared: ...". A problem that persists is repeated every 30 minutes, not every minute.
Messages contain counts and ages only: never names, ids, or message text.

## Looking for yourself

A moderator can open `GET /api/ops/status` (with their login) for the same numbers: connections, rooms, players, memory, database, the
oldest waiting items, write failures and the reviewer's counters and estimated spend. `npm run mod:stats` (with `DATABASE_URL`) gives moderation
statistics: false positives, time to a person's decision, volume.

## What is NOT watched

- Whether the server process is running at all. If it crashes, it cannot tell you: use an outside uptime monitor on `/healthz` (many free ones
  exist) and Fly.io's own health checks and restart.
- Whether emails are being delivered (check the sender's dashboard).
- Disk or database size on Supabase, and Supabase's own outages: turn on Supabase's notifications.
- Errors in players' browsers.
- A webhook that stops working: the server keeps a failure count in memory but cannot alert about its own alerts. Test the webhook after setting it up.
