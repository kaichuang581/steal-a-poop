# Load test results

Run it yourself: `npm run loadtest` (200 clients, 30 s) or `npm run loadtest -- --clients 600 --seconds 20`.
It starts `server/main.ts` as its own process, signs in that many dev users over real WebSockets, puts them in
rooms of ten, starts a game in every room, then has each client ask `rooms` once a second while the games run.
At the end it sends SIGTERM and counts who was told the server is restarting.

## Results (this container, 2026-11-01)

| | 200 clients, 30 s | 600 clients, 20 s |
|---|---|---|
| Connect (hello to welcome) p50 / p95 / max | 5.0 / 28.6 / 30.1 ms | 4.7 / 21.8 / 27.2 ms |
| Round trip p50 / p95 / p99 / max | 3.9 / 10.9 / 13.7 / 15.1 ms | 8.8 / 19.4 / 36.8 / 45.4 ms |
| Requests answered | 6000 of 6000 | 12000 of 12000 |
| Server memory (RSS), peak | 229 MB | 232 MB |
| Server CPU in steady state | 2.5% of one core | 4.4% of one core |
| Traffic to clients | 220 msg/s, 88 KB/s | 660 msg/s, 262 KB/s |
| Clients dropped | 0 | 0 |
| Shutdown: told first / closed with 1001 | 200 / 200 | 600 / 600 |

## What this does not show

- **The 'empty server' memory is about 230 MB**, almost all of it the word list, the Node runtime and the dev toolchain
  (`vite-node`). Adding 600 connections moved RSS by about 2 MB, which is smaller than the measurement noise, and RSS
  *fell* by the end of the run as the garbage collector ran. So this test cannot say what one connection costs. Read it as
  "600 idle-ish connections do not visibly grow the process", nothing finer.
- **The players are idle.** Each game is moved by bots and by timeouts, because the test clients never play. A room of ten
  people typing words and chatting sends more messages than this. The cheapest message (`rooms`) was used for latency.
  Chat, which runs the filter and may hit the database, was not part of this test.
- **Everything runs on one machine over loopback**, with no TLS, no internet latency, no database and no real sign-in.
  The clients compete with the server for the same CPU, which makes the latencies pessimistic for the server and
  optimistic for the network. Real players on phones will see tens to hundreds of milliseconds more.
- **One server process on this container's hardware.** Your host will differ. Re-run it there.
- The server holds all state in memory, so one process is also the ceiling: this test does not cover running two.
- Nothing here tests the per-IP limit (the test raises it so all clients can come from one address).
