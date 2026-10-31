# Game server

`server/` is a WebSocket server that runs rooms, the game (using the same `src/engine` as the
browser), and chat. It is **not deployed anywhere** and the web app does not talk to it yet.

```bash
ALLOW_DEV_AUTH=1 npm run server        # ws://localhost:8787, dev sign-in only
npm test                                # includes the server tests
```

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
`leave`, `start`, `act {action: {type:'play'|'steal', word} | {type:'bank'}}`, `chat {text}`,
`report {messageId}`, `appeal {note}`.

Server to client: `welcome`, `rooms {list}`, `room {view, you}`, `left`, `result {accepted, reason,
suggestion}`, `chat {message}`, `chatBlocked {reason, until}`, `reportResult`, `appealResult`,
`error {error}`.

## NOT built

- **Real sign-in.** `VerifyToken` in `server/index.ts` is where Supabase JWT verification goes. Only
  a dev stub exists, so there are no accounts, no email, Google or Meta login, and no age or
  country checks.
- **Persistence.** Rooms, suspensions, bans and review items are in memory and vanish on restart.
- **The web app screens.** There is no lobby, room, or chat UI, no chat warning, and no networked
  `GameClient`. The browser still plays solo against bots.
- **Deployment, TLS, scaling.** One process, one machine.
- **Steal fairness under latency.** Arrival order at the server is the only rule; a player on a
  slow connection loses close races. See the note in the item list.
- **Spectating, replays, friends, leaderboards.**
