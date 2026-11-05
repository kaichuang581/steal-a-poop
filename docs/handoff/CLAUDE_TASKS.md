# TASKS FOR CLAUDE (half 2 of 2)

Freebuff's half is in `FREEBUFF_TASKS.md`. Claude does not do anything listed there.

These need judgment, Brian's approval, the server or the database, or access to the live site.

1. **Show avatars to other players.** The server must carry the avatar id (client and server share `src/avatars/ids.ts`; use the existing cosmetics channel in `src/net/protocol.ts` and `server/economy/`). It is outside `src/skin/`, so ask Brian first (`CLAUDE.md`). Free, no coins.
2. **Steal victim in the history.** The results line "Best steal" cannot name who was robbed because the engine does not record it. Needs an approved engine change plus tests.
3. **The failing end-to-end test** "practice: a steal needs a typed word, then takes the turn": it fails on `main` and probably predates today's work. Find the cause (likely the new 16 s to 5 s turns or the steal window).
4. **Avatar skills as visual effects** (streak, hop, confetti and so on), cosmetic only, never affecting play.
5. **Invite links** that put a friend in a room without an account, and a link on the share card.
6. **Steal sound and feel pass** (needs listening on a real device).
7. **Game name decision** and updating every place the name appears.

## Not for either of us (Kai owns these, see `docs/LAUNCH.md`)
Lawyer review, monitoring dashboards, hosting and domain, NCMEC registration, and anything involving real accounts, keys or money.
