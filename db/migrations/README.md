# Database migrations

SQL files, applied in filename order. **Each lane owns a number range**, so parallel work never
produces the same filename:

| Lane | Range | Example |
|---|---|---|
| accounts | 100 to 199 | `100_profiles.sql` |
| moderation | 200 to 299 | `200_review_items.sql` |
| rooms | 300 to 399 | `300_friends.sql` |
| infrastructure (accounts lane) | 400 to 499 | `400_leaderboard.sql` |

Rules: never edit a migration that has been merged (add a new one); refer to users by the text
`user_id` with no foreign key to another lane's table; every table that holds personal data gets
row-level security in the same file.
