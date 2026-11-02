# Friends, leaderboards, coins and the shop

How these work, why they are built this way, and what to tune. Code: `server/game`, `server/economy`, `server/social`,
`server/routes/{friends,leaderboard,shop}.ts`, screens in `src/ui/social`, tables in migrations `101` to `103`.

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

## Friends and invites

- A player has a private 8-character **friend code** and shares it themselves. **There is no name search**, on purpose, so strangers
  cannot look children up. The code can be changed at any time (the old one stops working).
- A request needs the other player to accept. Asking someone who already asked you makes you friends. Up to 100 friends.
- **Only players who may chat can use friends** (a child waiting for a parent's consent cannot, and cannot be found by code).
- Blocks apply: you cannot ask someone you blocked; if someone blocked you, your request looks as if it worked and never reaches them;
  blocking someone hides their pending request.
- Invites (`{t:"invite"}` over the game connection): friends only, only from a room still in the lobby, to a friend who is online and
  not in a room, not blocked either way, not repeated within 30 seconds. The room code is sent only to a friend.
- Signed-in players stay connected in the background so friends see them online and invites reach them anywhere in the app.

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
a player scores, how long they get, or who wins. Players see colors, badges and titles beside each other's names in rooms, on boards and in
the friends list. Items are chosen from a fixed list, never typed, so they need no chat filtering.

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
- Team or friends-only leaderboards, and "friends' scores" on the Daily board.
- Gifting coins or items (on purpose), selling coins (on purpose), trading.
- Cosmetics on the seat labels during the game (they show in the lobby, chat, boards and friends list).
- A way to see a friend's room to join it directly; friends must invite you.
- An admin tool to grant or remove coins (the ledger has an `adjustment` reason for it; use SQL for now).
