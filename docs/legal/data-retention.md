# Data retention: DRAFT

*Every row marked [decide] needs the lawyer's answer. Until then the safe default is: keep it.*

| Data | Where it lives | Proposed retention | Why | Deleted when the player deletes their account? |
|---|---|---|---|---|
| Account (email, nickname, date of birth, country) | Accounts database (to be built) | While the account exists, then [30 days] | Run the account | Yes, after the grace period |
| Parent's email and consent record (under-13) | Accounts database | As long as the child account exists, then [decide: consent records may need to be kept as proof] | Proof of consent | [decide] |
| Game results | Accounts database | While the account exists | Stats, leaderboards, Daily Table | Anonymised: the player's name is removed, scores may remain in aggregate [decide] |
| Live room, chat history (last 50 messages per room) | Server memory only | Until the room is removed (finished rooms: 10 minutes after the end) or the server restarts | Delivering chat | Not stored beyond that |
| Held messages, reports, appeals (`moderation_items`) | Database | [decide, proposed 12 months after the case is decided] | Review, appeals, accuracy checks | **No**: kept under legal basis of safety and legal obligation |
| Evidence snapshots (`moderation_evidence`) | Database, append-only | [decide: as long as the law requires, then delete] | Legal and child-safety obligations | **No** |
| Child-safety reports (`child_safety_reports`) | Database, never deleted by the application | [decide: set by the reporting authority's rules and the lawyer] | Legal hold | **No** |
| Moderation audit log (`moderation_audit`) | Database, append-only | [decide, proposed 24 months] | Accountability; contains ids and reasons, not message text | No (ids only; personal details removed if the account is deleted) [decide] |
| Stored games (`games`, `game_players`) | Database | Kept; a person's id and name are removed from them when they delete their account | Stats and leaderboards; the other players played in them too | Anonymised, games stay |
| Daily Table attempts (`daily_attempts`) | Database | While the account exists | One attempt per day | Yes |
| Coins, items, what is worn (`wallets`, `inventory`, `equipped`) | Database | While the account exists | The shop | Yes |
| Coin ledger (`wallet_ledger`) | Database, append-only | [decide] (ids and amounts only, no real money) | Shows where coins came from; stops a game paying twice | Kept as ids and amounts [decide] |
| Friend codes and friendships (`friend_codes`, `friendships`) | Database | While the account exists | Friends | Yes, all links removed |
| Temporary email holds (`restricted_identities`) | Database | Only a one-way hash of the email, kept until a suspension would have ended, or 7 days for an open case, or until a person clears the case; then deleted | So deleting an account does not erase a suspension | Not deleted on request while the hold lasts; never kept longer than the suspension or case [decide: confirm this basis] |
| Blocks (`user_blocks`) | Database | While the account exists | Your block list | Yes, the player's own blocks are deleted. Blocks of that player by others may stay (no personal data) |
| Standings (suspension, ban) (`moderation_standings`) | Database | While a suspension or ban applies, then [decide: keep a record of past bans] | Enforcement | Bans are kept so a banned person cannot simply return [decide] |
| Technical logs (IP address, errors) | Host logs | [30 days] | Security and debugging | No |
| Backups | Database provider | [per provider, typically 7 to 30 days] | Recovery | Deleted data is overwritten as backups expire |

## Open questions for the lawyer

1. How long must evidence be preserved after a child-safety report in each launch country? (Some regimes set a minimum period and allow longer on request.)
2. Does a player's deletion request override our need to keep moderation records? On what basis may we keep them?
3. May we keep a record that a person was banned, to stop them returning, after they ask for deletion?
4. Is the 24-month audit log period defensible, given it contains only ids and reasons?
5. Is a row in `moderation_standings` personal data, and for how long may we keep a lifted ban?

## Build tasks that follow from this table

- A scheduled job that deletes or anonymises rows after their period. Evidence and reports are excluded until the lawyer decides.
- A function `anonymizeUser(userId)` that removes personal data but leaves evidence in place. (Not built.)
