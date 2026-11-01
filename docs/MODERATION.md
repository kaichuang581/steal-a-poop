# Chat moderation

What is built (all in `server/`, covered by tests) and what is not.

## Policy as built

- Nothing sexual, no swearing, no racial slurs or hate, nothing predatory toward children.
- Misspelled, number-swapped (`sh1t`), symbol-swapped (`sh!t`, `$hit`), spaced-out (`s h i t`,
  `s.h.i.t`), stretched (`shiiit`) and letter-by-letter (five messages of one letter each, within
  30 seconds) versions count the same as the word.
- A message is checked **before anyone sees it**. A violating message is never delivered.
- The sender is **suspended immediately**. Every violation goes to a reviewer.
- **Claude reviews** every held message and every player report (`server/review.ts`), and answers
  `clear` (false alarm, suspension lifted), `suspend`, `ban`, or `escalate` (a person decides).
- A banned or suspended player can **appeal**; appeals always go to a person.
- If Claude fails, is unreachable, or gives an answer that cannot be read, the item goes to a person.
  **A reviewer failure never bans anyone.**
- Players can report a message from the last 50 in a room.
- Chat is rate limited to 5 messages per 10 seconds per player, reports to 5 per minute.

## Child safety

- A short set of concrete grooming phrases (`server/filter.ts`, `childSafetySignal`) is held,
  suspends the sender, is recorded through the `ChildSafetySink` hook, and **always ends with a
  person**, even if Claude says `clear`.
- **Reporting to NCMEC (or a country's equivalent) is NOT implemented.** The hook records the item;
  nothing is submitted anywhere. Making reports requires registering with NCMEC's CyberTipline as a
  provider and a lawyer's sign-off. Until that exists, do not put chat in front of children.
- Flagged content must be **kept**, not deleted, for the report. Today evidence lives only in
  memory (`ChatService`), so it is lost when the server restarts. Persisting it to a restricted
  database table is required before launch.

## Known limits

- **False positives.** The word list (`server/data/blocklist-en.txt`, CC BY 4.0) has 403 entries and
  about 145 of the single words are ordinary dictionary words (for example "butt", "escort",
  "domination", "eunuch"). Innocent chat will sometimes be held and the sender suspended until
  Claude clears it. Words inside a longer ordinary word ("assume", "classic") are not flagged.
- **English only.** Other languages are not covered.
- **No category for a slur versus profanity.** The list is flat, so every match is treated the same.
- **The grooming net is narrow on purpose.** It will miss most real grooming, which happens over
  many messages. It is not a substitute for human moderation and reports.
- **Suspension length is my assumption.** Default 24 hours (`DEFAULT_SUSPEND_MS`). You did not
  specify one.
- **No humans yet.** Escalations and appeals go to a queue (`ChatService.queue('human')`), but there
  is no tool for a person to work it and nobody is assigned.
- **Persistence needs a database.** With `DATABASE_URL` set, suspensions, bans, the review queue and evidence survive restarts. Without it they are in memory and reset. Chat history itself is not stored beyond the 20 messages kept as context with a held message.
- **Country rules are not applied.** The age-by-country sign-up check is not built.
- The reviewer was tested against a mocked API only. It has not been run against the live API.

## Before launch

Status of each item as of the trust lane's task 8. "Built" means code and tests exist, not that it has been used for real.

1. ~~Persist suspensions, bans, items and evidence in the database with restricted access.~~ Built (see Persistence below). Still needs: a real database with migrations 200, 201 and 202 applied, and your lawyer's retention periods.
2. **Child-safety reporting: adapter built, nothing connected.** Reports are stored with a dry-run reporter; the NCMEC reporter refuses to run. Needs your registration, their documentation and credentials, and legal review. The list is in `docs/lanes/trust.md`.
3. **A person to work the queue: tool built, nobody named.** The moderator screen is at `#/mod`. Name the people, give them moderator accounts, and decide how fast items must be answered (`npm run mod:stats` shows the actual wait).
4. ~~Build the chat warning screen and the in-game report and appeal buttons.~~ Done.
5. ~~Decide the suspension length and whether the filter list needs a mild/severe split.~~ Built as options (`server/moderation/config.ts`), defaults unchanged (24 hours, every match the same). Turning on tiers or repeat multipliers is your decision.
6. **Reviewer on the live API: hardened, never run live.** Timeouts, retries, caps and strict parsing are tested against a mock only. Run it on real held messages with a person double-checking before relying on it.
7. **Appeals: built.** Players see their case and the decision. Nobody is paged when an item gets old.
8. **Audit log and lawyer export: built.** `moderation_audit` is append-only; `npm run mod:export` makes a checksummed case file.
9. **Block, mute, kick** (task 9) and **abuse limits** (task 10) are separate items in the trust lane.
10. **Not started anywhere:** the age and country rules at sign-up (accounts lane), a privacy policy and terms, an opt-in for storing chat, and a policy for what happens to a player's records when they delete their account (evidence must stay).

## Audit log, statistics and the lawyer export

- `moderation_audit` (migration `201_moderation_audit.sql`): one row per event (message held, reported, appeal filed, reviewer verdict, a person's decision, standing restored, child-safety report confirmed, case exported). It holds ids, verdicts and moderator-written reasons, never message text. The database refuses UPDATE, DELETE and TRUNCATE.
- `DATABASE_URL=... npm run mod:stats`: volume, the filter's false-positive rate (held messages that ended cleared, split by person and reviewer), time from hold to a person's decision (median, p90, max), what is open and how old the oldest is, and how often the reviewer agreed with the person. Items still undecided are not in the false-positive rate, so early numbers flatter the filter.
- `DATABASE_URL=... npm run mod:export -- --user <id> --by <your moderator id> [--out file.json]`: everything held about one player (items, evidence snapshots, reports, audit) with a SHA-256 checksum (`verifyExport` recomputes it). Writing the export is logged. Treat the file as sensitive: it contains the held messages. It is written with owner-only permissions when `--out` is used.

## Persistence and retention

Set `DATABASE_URL` and apply `db/migrations/200_moderation.sql` (`psql "$DATABASE_URL" -f db/migrations/200_moderation.sql`; it can be run again safely).

| Table | Holds | Kept |
|---|---|---|
| `moderation_standings` | who is banned or suspended, and until when | updated in place |
| `moderation_items` | the review queue: held messages, reports, appeals, and what was decided | updated in place; never deleted by the application |
| `moderation_evidence` | a snapshot of each held message or report (text, who, room, category, the 20 messages before it), with a SHA-256 of the snapshot | **append-only: the database refuses UPDATE, DELETE and TRUNCATE; the application never removes it** |

- **Writes are in the background.** The chat path is never slowed or broken by the database. If a write fails it is counted (`ChatService.persistFailures`) and reported, and the in-memory state still applies. While the database is down, a restart would lose what was not yet saved.
- **Access.** Row-level security is on for all three tables with no policies, so ordinary database roles see nothing. Only the table owner and roles that bypass RLS (Supabase's service role) can read or write. The browser must never be given a key that can reach them. A database superuser can still disable the triggers, so keep that access to the fewest people possible.
- **One server.** Item numbers come from the server's memory, so run one server process against this database. Running two would reuse ids.
- **Retention periods are not decided.** The application keeps evidence forever. How long the law requires, and when it must be deleted, is a question for your lawyer (see the lawyer brief). Account deletion must leave evidence in place.
- **Verified against** PostgreSQL 16 with `TEST_DATABASE_URL` set (including the append-only triggers and RLS). The 10 database tests are skipped when that variable is not set, so the normal CI run does not exercise them until a Postgres service is added to the workflow.
