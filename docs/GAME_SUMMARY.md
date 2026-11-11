# Steal a Poop: game summary (for AI assistants)

Version 0.5.0 ("Fleece Navidad" update, Christmas winter theme). Last updated 2026-11-11. This describes the game as it stands on `main`. Numbers come from `src/engine/constants.ts` and `src/engine/settings.ts` and may have changed since; check the code before quoting a number. When this file and the code disagree, the code wins.

## What it is
A free browser word game. Players take turns saying a word that starts with the letter the table is given. Each player has wool balls (lives). Running out of time costs a wool ball; losing them all freezes the sheep out of the game. The last sheep standing wins. The game plays on a voxel-art farm (a barn with a table), with a storybook/painted look as the default and a plain "classic" look available with `?skin=classic`. Built for kids and teenagers as well as adults, so the rules and tone are kept friendly.

Live site: https://kaichuang581.github.io/steal-a-poop/ (GitHub Pages, deployed from `main` after tests pass).

## Game modes
- **Quick Game (default).** Players against bots (3 to 7 bots). Rounds, twists, lives, timers, and the time-carry setting. The first three quick games use easy bots and the Quick preset. "Start now" on the home screen starts a quick game with easy bots and hints.
- **Practice.** A 1v1 speed run against one bot on one life. Each word scores a point. The run ends on your first timeout. The clock starts at 15, 10 or 5 seconds and loses a second every few words, down to a floor of 5 seconds. Best scores are kept per clock setting and bot level, in this browser only.
- **Tutorial.** A real game with scripted bots that guides a first game and explains the rules. Reachable from the home screen and Settings.
- **Counting Sheep.** A nightly dream mode in the painted look: an endless runner where the sheep jumps fences by typing words that match each fence's letters. One dream per night for everyone (same fences). Dreams reset at local midnight. Has streaks, a results board and a share card.
- **Word of the day.** A dictionary-style word on the home screen, with pronunciation, part of speech and a short meaning. Written for the game. Changes at midnight.
- **Rooms and friends (server features).** Groups of 4 to 10 players with chat, invites and leaderboards. These need the game server and a Supabase project. They are built but not switched on for the public site until the server is deployed (see `docs/LAUNCH.md`).
- **Hunt.** Removed in 0.5.0.

## Core rules (quick and room games)
- Each turn you type a word that starts with the table's current letter. It must be a real word from the word list (`public/words.txt`, 172,823 words). Your word becomes the next letter, so the chain goes on.
- Typos get a suggested correction. Invalid words never cost wool or the turn; you can retype while the timer runs.
- Each turn has a timer. A turn that runs out is a timeout: you lose a wool ball. A player with no wool balls left is frozen and out of the game.
- Turns get shorter every round: 15 s in round 1, then 10 s, then 5 s from round 3 on. The start (round 1) is the longest.
- A round is each sheep taking a set number of turns (2 by default, up to 7 with other presets).
- A **trap** can be set by a word ending in a trap letter (x, z, q, j). It pays a wool ball to the trapper if the next player is caught out.
- A **pass** (painted look): once per round a player can hand the bomb to the next sheep without playing a word. The next sheep gets the fuse that was left, at least 4 seconds.
- **Round twists** (after round 1, shuffled): no E, six or more letters, double letter, no A, no S, five letters max, ends on a vowel, must contain O, vowel double, and double points on a fast timer. The twist applies to the whole round.
- **Time carry** (on for quick games and rooms): a good word stretches or squeezes the next player's turn. The opening turn is 10 s. Turns stay between 5 and 20 seconds.
- **Stealing was removed in 0.3.3.** There is no steal action, no red steal window and no steal turns.
- The winner is the last sheep with wool. Ties are broken by the longest word.

## The bomb (painted look)
Each turn the timer is an ice bomb that sits on the floor beside the sheep whose turn it is. Its seconds show on its face. It beeps every whole second and gets louder and higher as the fuse burns down. When a turn runs out, it bursts in ice and the words of the chain fly out and explode. A timeout costs a wool ball.

## Bots
- Three difficulties: easy, medium, hard. Each bot has a personality (cautious, greedy or random) that changes how it picks words.
- Bots carry farm-animal names and a visible "farm sheep" tag, so players know they are not people.
- Bots fumble more as turns get shorter.
- In practice, the bot can't end a run; a fumble just gives the player a fresh letter.

## Avatars and customisation
- Players can pick an animal avatar (sheep, pig, cow, goat, horse, chicken) on the home screen. It is cosmetic only and shows on the player's card.
- Other players in a room can see the avatar you picked, through the server.
- A special admin-only avatar exists. It is not in the public picker.
- Customisation shop and currency are planned but not built. See `docs/plans/SHOP.md`. The plan is coins earned from play, spent on cosmetics. No loot boxes, no random paid rewards, no paid gameplay advantages. Real-money items for kids need parental approval and lawyer review first.

## Accounts and safety
- Sign-in is optional for solo play. Guests choose a username and play on one device; their progress is kept in that browser only.
- Accounts (email and password, or Google) need Supabase and the game server. Not live on the public site yet.
- A username-only account never gives its age, so it can't chat, use friends or appear on public boards.
- Players under the age of digital consent need a parent's permission for chat and saved results. Consent emails link to a parent page.
- Names are checked against a filter (rude, sexual and hateful words, including look-alike spellings). Chat is filtered and reviewed. Players can report messages. Moderators have a review queue.
- Legal pages (privacy, terms, child safety) are drafts marked "not reviewed by a lawyer" until a lawyer finishes them.

## Technology
- Vite, React, TypeScript, Tailwind, Zustand, Framer Motion, three.js for the 3D scenes. Web Audio for sound (no audio files; music is made live in the browser).
- The game engine (`src/engine/`) is pure TypeScript with no React. It is deterministic: the same seed and the same actions replay exactly. The UI only passes timestamps.
- The UI reads the store; the store talks to the engine through a client interface that a server can replace.
- The server (`server/`) is a Node WebSocket and HTTP server with Postgres (Supabase) for accounts, results, friends and moderation.
- Tests: Vitest for unit tests, Playwright for browser tests (run on the classic look), an accessibility scan with axe, a bundle size check, and a bot-vs-bot balance simulator (`npm run simulate`).

## Where things are
- `src/config.ts`: title, tagline and version name.
- `src/engine/`: rules, constants, bots, timers, scoring, word validation.
- `src/state/`: the store and settings.
- `src/ui/`: classic screens.
- `src/skin/`: the painted look (home, game, table, dream, avatars, word of the day, loading doors).
- `server/`: the multiplayer server (not deployed yet).
- `docs/`: plans, runbooks and legal drafts. `docs/LAUNCH.md` says what is left before real players.
- `CHANGELOG.md`: every visible change, newest first.

## Known open items (as of 0.5.0)
- Bundle size on the public site is over its budget; the check for it fails on open pull requests.
- Some pull requests conflict with `main` and need resolving.
- Accounts, rooms and the coin shop need the game server and Supabase set up.
- Legal documents are drafts and need a lawyer's review.
- The Hunt was removed; old saved Hunt data is ignored.

## What not to suggest
- Loot boxes, gacha, spin wheels or any random paid reward.
- Paid gameplay advantages (extra time, wool or hints for money).
- Streaks or daily punishments that make kids feel bad for missing a day.
- Ads aimed at children.
- Showing real people's photos as avatars or in the game.
