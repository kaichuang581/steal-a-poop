# Database migrations

SQL files, applied in filename order. **Each lane owns a number range**, so parallel work never
produces the same filename:

| Lane | Range | Example |
|---|---|---|
| accounts (includes friends) | 100 to 199 | `100_profiles.sql` |
| trust: moderation | 200 to 299 | `200_review_items.sql` |
| trust: rooms | 300 to 399 | `300_game_logs.sql` |
| infrastructure (accounts) | 400 to 499 | `400_leaderboard.sql` |
| freebuff | none | the freebuff lane does not write migrations |

Rules: never edit a migration that has been merged (add a new one); refer to users by the text
`user_id` with no foreign key to another lane's table; every table that holds personal data gets
row-level security in the same file.

## Applying them

`npm run migrate` applies every file not yet applied, in number order, once each, and records each file's checksum in the
`schema_migrations` table. It refuses to run if an applied file was edited, runs each file in a transaction, and takes a database lock so two
runners cannot clash. `npm run migrate -- --dry-run` lists what is pending. See `docs/DATABASE.md` for the full routine.

`server/db/migrate.test.ts` also fails the build if any table is created without row-level security, if the browser roles (`anon`,
`authenticated`) can reach any table, or if a function leaves its search path open.
