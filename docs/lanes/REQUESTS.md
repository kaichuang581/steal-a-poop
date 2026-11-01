# Requests between lanes

Append only. Format:

```
## <date> from <lane> to <lane>: <short title>
What you need and why. (The owning lane replies underneath and marks it done.)
```

## 2026-11-01 from trust to accounts: how to receive finished games and gate the Daily Table
Done on the trust side (task 1). `startServer` in `server/index.ts` now accepts two optional options, both
typed in `server/contracts.ts`:

```ts
startServer({
  // ...existing options...
  onGameFinished: (result: GameResult) => saveResult(result),   // called once per finished game
  dailyGate: { reserve: (userId, dailyDate) => reserveAttempt(userId, dailyDate) }, // true = attempt granted
});
```

- `GameResult.mode` is `"room"` or `"daily"`. Bots, including a bot that took over from someone who left, have
  `userId: null`. `winners` lists human userIds only.
- A throwing or rejecting `onGameFinished` is swallowed so it can never break a game; do your own logging.
- Without a `dailyGate`, the server-run Daily Table answers `daily_unavailable`. If `reserve` throws it also answers
  `daily_unavailable` (it never lets anyone play unlimited). `false` answers `daily_used`.
- The date is the server's UTC date. The client sends `{ t: "daily" }`; leaving the session ends it and the attempt
  stays spent.
- Wire both in `server/main.ts` (your file). Status: open.
