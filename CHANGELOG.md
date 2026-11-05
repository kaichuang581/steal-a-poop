# Changelog

All user-visible changes, newest first.

## Unreleased

### Painted barn (shipped)

- The painted barn is now the default look; `?skin=classic` keeps the old screens
- Avatar picker with 15 characters; your choice appears on your own player card only, and other players cannot see it yet
- Pixel icons replace emoji and text on buttons and menu controls
- "Start now" goes straight into an easy game with hints
- A steal jolts the table, flashes the screen edge red and names who stole from whom; results show the best steal
- Share a finished game or Counting Sheep run as a picture card
- A swoop moves from the home screen into the barn when a game starts

### Accounts and community (not live until the server is deployed and sign-in is configured)

- Accounts: email, Google and Meta sign-in, date of birth and country at sign-up, parental permission for young children, log out everywhere, delete account
- Friends by private code, invitations to rooms, leaderboards (Daily Table, today, week, all time), personal stats
- Coins earned by playing, and a cosmetic shop (name colors, titles, badges, table themes); no real money
- Room chat is checked before anyone sees it; report, block, mute and kick; appeals and a moderator screen
- Privacy policy, terms and child-safety pages (drafts)
- Accessibility fixes: higher contrast buttons, keyboard access to scrolling areas

## 0.2.0

- Typo suggestions with a confirm step; invalid words are free and only a timeout costs −5
- Failed steals halve the banked score
- Settings: volume, reduce motion, larger text, credits
- Dictionary retry, in-page leave confirmation, feedback link
- Favicon, social preview image, page metadata; tests run before every deploy

## 0.1.0 (earlier commits)

- 2026-10-31 `94f05c5` Add typo suggestions and the failed-steal score halving
- 2026-10-31 `018f2a7` Make steals unlimited: remove steal tokens
- 2026-10-31 `eac5984` Require a typed word before STEAL
- 2026-10-31 `740c4cb` Open the tutorial automatically on first launch
- 2026-10-31 `8ca2056` Add interactive tutorial, practice mode, guide, tips, and scoring cheat sheet
- 2026-10-31 `346b1d3` Replace scaffold with Steal a Poop game (step 1, solo vs bots)
- 2026-10-31 `85e4550` Scaffold Vite + React + TS app with GitHub Pages deploy workflow
