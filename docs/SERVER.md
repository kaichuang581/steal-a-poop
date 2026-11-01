# Game server

`server/` is a WebSocket server that runs rooms, the game (using the same `src/engine` as the
browser), and chat. It is **not deployed anywhere**. The web app can talk to it, but only when built
with a server URL, so the public site does not show multiplayer yet.

```bash
ALLOW_DEV_AUTH=1 npm run server                          # ws://localhost:8787, dev sign-in only
VITE_SERVER_URL=ws://localhost:8787 npm run dev          # the app, with "Play with others" turned on
npm test                                                  # includes the server tests
npm run e2e                                               # four browsers playing through a room
```

Without `VITE_SERVER_URL` (the GitHub Pages build) the "Play with others" button is hidden.

## What exists

| File | Does |
|---|---|
| `server/rooms.ts` | Rooms: create, join by code, leave, host transfer, manual start (4 to 10), bot replacement, public list |
| `server/codes.ts` | 5-character room codes, no 0/O/1/I, collision-checked |
| `server/index.ts` | WebSocket layer, reconnect grace period, rate limits, tick loop |
| `server/chat.ts`, `filter.ts`, `review.ts`, `ratelimit.ts` | Chat moderation (see `docs/MODERATION.md`) |
| `server/main.ts` | Entry point |

## Rules as built

- Anyone can create a **public** or **private** room. Only open public rooms are listed.
- A room holds 4 to 10 players. **The host starts the game by hand**; it never starts itself.
- Nobody can join a game that has started.
- Leaving mid-game puts a **bot in the seat** with the same score. If the host leaves, the player who
  joined next becomes host. An empty room is closed.
- A dropped connection keeps its seat for 15 seconds, so a brief drop does not hand it to a bot.
- Steal races are settled by arrival order at the server: the engine handles one action at a time.

## Protocol (JSON text frames)

Client to server: `hello {token}` (first), `rooms`, `create {visibility, roomName?}`, `join {code}`,
`leave`, `start`, `daily`, `act {action: {type:'play'|'steal', word} | {type:'bank'}}`, `chat {text}`,
`report {messageId}`, `appeal {note}`.

Server to client: `welcome`, `rooms {list}`, `room {view, you}`, `left`, `result {accepted, reason,
suggestion}`, `chat {message}`, `chatBlocked {reason, until}`, `reportResult`, `appealResult`,
`error {error}`.

## The web app side

| File | Does |
|---|---|
| `src/net/client.ts` | WebSocket that signs in and reconnects within the grace period |
| `src/state/roomStore.ts` | Room, lobby and chat state; feeds each server snapshot into the game store |
| `src/state/bridge.ts` | Lets the game store send moves and leave without importing the room store |
| `src/ui/Lobby.tsx`, `RoomScreen.tsx` | Browse public rooms, create, join by code; waiting room with the host's Start button |
| `src/ui/ChatPanel.tsx`, `ChatRules.tsx` | Chat, the always-visible rules banner, the first-time rules screen, report and appeal buttons |

In a room, your own seat is always at the bottom of the table, and the browser keeps a clock in
the server's time (the server sends its clock with every update).

## NOT built

- **Real sign-in.** `VerifyToken` in `server/index.ts` is where Supabase JWT verification goes. Only
  a dev stub exists (the app signs in as `dev:<nickname>`, which a real server refuses), so there
  are no accounts, no email, Google or Meta login, and no age or country checks. Anyone can pick any
  nickname.
- **Persistence.** Rooms, suspensions, bans and review items are in memory and vanish on restart.
- **A public server URL.** Nothing is deployed, so there is nothing for the live site to connect to.
- **Deployment, TLS, scaling.** One process, one machine.
- **Steal fairness under latency.** Arrival order at the server is the only rule; a player on a
  slow connection loses close races. See the note in the item list.
- **Spectating, replays, friends, leaderboards.**

## Finished games and the server-run Daily Table

- When a game ends, `startServer` calls the optional `onGameFinished(result)` once with a `GameResult`
  (`server/contracts.ts`). Bots, including one that replaced a player who left, have `userId: null`.
- `{ t: 'daily' }` starts today's Daily Table: one human against bots whose lineup, letter and
  modifiers come from the UTC date, so everyone gets the same table. It needs a `dailyGate`; without one
  the answer is `daily_unavailable`. A spent attempt answers `daily_used`. Leaving ends the session and
  the attempt stays spent.
