# Game server

`server/` is a WebSocket server that runs rooms, the game (using the same `src/engine` as the
browser), and chat. It is **not deployed anywhere**. The web app can talk to it, but only when built
with a server URL, so the public site does not show multiplayer yet.

```bash
npm run dev:online                                        # both of the next two lines in one command
npm run dev:fly                                           # the site only, pointed at the deployed server (FLY_SERVER_URL, or wss://<app in fly.toml>.fly.dev)
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
- A room holds up to 10 people. **The host starts the game by hand**, with at least 2 people in; it never starts itself.
  Farm sheep (bots) take the empty seats up to 4.
- **Quick start** (`quick`) puts a player in the fullest open public room, or opens a new public one.
- A **party** is a private room: its 5-character code, or the `?join=CODE` link, lets friends in. The host can open it
  to quick-start players, and sets the game length (`options`: turns per round, wool balls, twists, visibility).
- Nobody can join a game that has started.
- Leaving mid-game puts a **bot in the seat** with the same score. If the host leaves, the player who
  joined next becomes host. An empty room is closed.
- A dropped connection keeps its seat for 15 seconds, so a brief drop does not hand it to a bot.

## Protocol (JSON text frames)

Client to server: `hello {token}` (first), `rooms`, `create {visibility, roomName?, turnsPerRound?, lives?, twists?}`, `join {code}`, `quick`,
`options {turnsPerRound?, lives?, twists?, visibility?}`, `leave`, `start`, `daily`, `act {action: {type:'play', word} | {type:'pass'} | {type:'bank'}}`, `chat {text}`,
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
- **Spectating, replays, friends, leaderboards.**

## Finished games and the server-run Daily Table

- When a game ends, `startServer` calls the optional `onGameFinished(result)` once with a `GameResult`
  (`server/contracts.ts`). Bots, including one that replaced a player who left, have `userId: null`.
- `{ t: 'daily' }` starts today's Daily Table: one human against bots whose lineup, letter and
  modifiers come from the UTC date, so everyone gets the same table. It needs a `dailyGate`; without one
  the answer is `daily_unavailable`. A spent attempt answers `daily_used`. Leaving ends the session and
  the attempt stays spent.


## Connection limits and resilience

All of this is in `server/index.ts` (`ConnectionLimits`) and configured by environment variables in `server/main.ts`.

| Protection | Default | Setting |
|---|---|---|
| Only listed sites may open a game socket (checked before the upgrade; a request with no `Origin` is refused when a list is set) | no check when `ALLOWED_ORIGINS` is empty; **the server refuses to start in production without it** | `ALLOWED_ORIGINS` |
| Open sockets per address | 20 | `MAX_CONNECTIONS_PER_IP` |
| Open sockets in total | 2000 (then HTTP 503) | `MAX_CONNECTIONS` |
| Heartbeat: ping every socket, drop one that missed a whole interval (its seat is held for the reconnect grace period) | 25 s | `HEARTBEAT_MS` |
| Address taken from `Fly-Client-IP` / `X-Forwarded-For` instead of the socket | off | `TRUST_PROXY=1` (only behind a proxy you control, or anyone can fake an address) |
| Per-message-type budgets per player, plus an overall one; a client that keeps flooding is disconnected (code 4008) | see `DEFAULT_MESSAGE_LIMITS` | `limits.messageLimits` |
| Finished games removed from memory | 10 minutes | `FINISHED_ROOM_TTL_MS` |
| Shutdown (SIGTERM): clients get `{ t: "shutdown", reconnectInMs }`, then close code 1001 after 1 s; new connections get 503 | 1 s | `limits.shutdownGraceMs` |

Details worth knowing:

- Leaving a room that no longer exists answers `left` instead of an error, so a player on the end screen of a cleaned-up game can still press Leave.
- After a reconnect, if the browser thought it was in a room but the server (restarted) has none, the app ends that game and says so.
- The per-address limit counts the address the server sees. Behind a proxy without `TRUST_PROXY=1` that is the proxy itself, so everyone shares one limit. Behind a proxy with it on, the header must be set by the proxy and not by the client.
- Rate-limit and spelling-buffer entries for idle players are pruned every 30 seconds so memory does not grow with every player ever seen.
- Load test results and their limits: `docs/LOADTEST.md`.


