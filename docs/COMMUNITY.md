# Leaderboards, coins and the shop

How these work, why they are built this way, and what to tune. Code: `server/game`, `server/economy`, `server/social`,
`server/routes/{leaderboard,shop,barn,ranked}.ts`, screens in `src/skin/boards` (the painted game) and `src/ui/social` (the old look),
tables in migrations `101`, `102`, `105` and `106`. (The friends list was removed on 2026-11-14: see "Friends" below.)

## Results

Every finished room game and Daily Table is stored (`games`, `game_players`) and feeds the boards. Bots are stored without a
user id. **A player whose account may not chat yet (a child waiting for a parent's consent) is stored as an anonymous row**: the game
stays complete for the others, but nothing links it to that child, and they earn and rank nothing. Deleting an account removes the
person's name and id from every stored game and clears their Daily Table attempts; the games stay.

## Leaderboards

- Periods: Daily Table (today, UTC), today, this week (last 7 days), all time. Metrics: wins, points banked, steals.
- Public, nickname only. **Hidden automatically:** players who needed a parent's consent (they cannot turn it on), players who chose
  to hide (Community, Boards, "Show me on the leaderboards"), anyone with a chat ban, deleted accounts.
- Every listing shows the player's *current* nickname, so a renamed or deleted account does not leave an old name behind.
- Personal stats (`/api/me/stats`) are private.
- Weakness: points and wins reward whoever plays most. There is no minimum-games rule and no season reset yet.
- **The painted game's leaderboards page** (`src/skin/boards/Leaderboards.tsx`, the trophy button on the start screen) shows three boards:
  **Ranked** (the 100 best ratings, `server/ranked`), **Wins** (online games won: today, this week, all time; the `wins` metric above) and
  **Level** (the 100 players with the most XP, `server/barn`). It has no Daily Table board and no points board: the painted game has no
  Daily Table and no points. The old look's window keeps them.
- The ranked and level boards are read without a login at `GET /api/ranked/board` and `GET /api/barn/board` (limited per address; a name
  and a score for each player the other boards would name, no ids, nobody's own place). Signed in, the page reads `/api/ranked/top` and
  `/api/barn/top` instead, which also say where the asker stands.

## Friends (removed)

The friends list, friend codes, requests, the online dots and room invites were removed on 2026-11-14 (Brian: "remove friend feature"),
for accounts and for guests, in the game and on the server. A room is reached by its code or its `?join=CODE` link, which the host hands
out themselves. What is left on purpose:

- The two tables from migration `103` (`friend_codes`, `friendships`) are still in the database with whatever players stored before.
  Nothing reads them. Deleting an account still removes that person's rows (`server/social/friendRows.ts`). Dropping the tables is a
  separate decision: it deletes those lists for good.
- A signed-in player's browser still keeps a connection to the game server open in the background (it used to carry invites). It makes
  going into a room quick and carries what a game paid; it could be closed when idle now.
- An older browser may still hold `sap:guest-friends` in local storage. It is harmless and is not cleaned up.

## Coins (the currency)

Rules, in `server/economy/rules.ts`:

| Earned for | Coins |
|---|---|
| Finishing a room game | 10 |
| Winning it | +25 |
| Each steal (up to 5 steals counted) | +2 |
| Finishing the Daily Table | 15 |
| Winning the Daily Table | +10 |
| **Daily limit per account** | **200** |

**Spent only on cosmetic items** (`server/economy/catalog.ts`): name colors, titles, badges and table themes. Nothing sold changes how
a player scores, how long they get, or who wins. Players see colors, badges and titles beside each other's names in rooms and on the old
look's boards. Items are chosen from a fixed list, never typed, so they need no chat filtering.

Design rules that were chosen deliberately:

- **No real money.** Coins cannot be bought, sold, sent to another player or exchanged for anything outside the game. This avoids
  payments, refunds, chargebacks and the extra law about selling to children.
- **No pay to win.** Earlier you decided steals must be unlimited and unrestricted to keep the game competitive. The shop respects that.
- **No gambling-like mechanics.** No random boxes, no "chance" purchases, no spending to retry. Every price is fixed and shown.
- **A ledger, not a counter.** Every change is a line in `wallet_ledger` (append-only). A reward is keyed by the game id, so a game can pay
  a player only once, even if the result is recorded twice. The wallet cannot go below zero (a database rule), and two purchases made at
  the same moment cannot spend the same coins (tested on a real Postgres).
- **Farming limits.** The daily cap stops one account from grinding without end. Multiple accounts playing each other are still possible;
  they are limited by the same per-account cap and by the sign-up CAPTCHA and ban-by-email rules, not eliminated.

Tuning: change `DEFAULT_RULES` and the prices. At the current numbers a player who plays a few games can buy a name color in a day and a
title or crown in about a week.

## Server-run Daily Table

Signed-in players start the Daily Table from the server (`{t:"daily"}`), once per UTC day (`daily_attempts`). That is what puts it on the
Daily board. Players who are not signed in still play the old on-device Daily Table, which is not ranked.

## What is not built

- Seasons, resets, or a minimum number of games for the boards.
- Team leaderboards.
- Gifting coins or items (on purpose), selling coins (on purpose), trading.
- Cosmetics on the seat labels during the game (they show in the lobby, chat and boards).
- A friends list (built once, then removed: see above).
- An admin tool to grant or remove coins (the ledger has an `adjustment` reason for it; use SQL for now).
