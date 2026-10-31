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
- **State is in memory.** Suspensions, bans, the review queue and evidence reset on restart.
- **Country rules are not applied.** The age-by-country sign-up check is not built.
- The reviewer was tested against a mocked API only. It has not been run against the live API.

## Before launch

1. Persist suspensions, bans, items and evidence in the database with restricted access.
2. Register for NCMEC reporting and connect it to `ChildSafetySink`. Get legal review.
3. Name the people who work the human queue and give them a tool.
4. Build the chat warning screen and the in-game report and appeal buttons.
5. Decide the suspension length and whether the filter list needs a mild/severe split.
