# Performance audit (10 players)

Measured in headless Chromium against the production build (`vite preview`), 12 to 15 seconds of
play per run, after the round intro. Scripts were throwaway; rerun by driving a Quick Game at the
listed seat count and sampling `requestAnimationFrame` deltas.

| Setup | Time to playable | Avg frame | p95 frame | Frames over 50ms | DOM nodes | JS heap |
|---|---|---|---|---|---|---|
| Desktop, 4 seats | 532 ms | 17.0 ms | 16.7 ms | 4 of 703 (over 33ms) | 134 | 23 MB |
| Desktop, 10 seats | 313 ms | 16.7 ms | 16.8 ms | 1 of 718 (over 33ms) | 228 | 21 MB |
| Phone viewport, 10 seats | 341 ms | 16.7 ms | 16.8 ms | 1 of 718 (over 33ms) | 171 | 21 MB |
| Phone, 10 seats, CPU 4x slower | 925 ms | 16.9 ms (59 fps) | 17 ms | 2 of 886 | n/a | n/a |
| Phone, 10 seats, CPU 6x slower | 1,569 ms | 17.3 ms (58 fps) | 17 ms | 2 of 867 | n/a | n/a |

Payload: JavaScript 455 KB (141 KB over the wire gzipped), CSS 38 KB (8 KB gzipped), word list 1.7 MB
(444 KB gzipped).

## Findings

- Frame rate holds about 60 fps at 10 seats, including under 6x CPU throttling. The per-frame state
  copy in `advance` only happens when something is due, so it does not show up.
- The 10-seat game does about 70% more DOM than the 4-seat game (228 vs 134 nodes). That is not a
  concern at this size.
- The biggest cost to the player is the 444 KB word list, which gates "Quick Game" until it loads.
  On a slow connection that is the wait to worry about, not rendering.

## Changes made

None. Nothing measured was slow enough to justify a change.

## Limits of this audit

- A fast machine with simulated throttling, not a real phone. CPU throttling does not model slow
  memory or thermal limits.
- Network time is localhost. On a real 3G connection the word list dominates.
- Bot-only tables. Real-time multiplayer will add network and snapshot costs that are not measured here.

## If it ever matters

Load the word list in a worker or stream it, and cache it with a service worker so repeat visits
skip the download.
