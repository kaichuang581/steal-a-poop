# Changelog

All user-visible changes, newest first.

## Unreleased (not live until the server is deployed and sign-in is configured)

- Accounts: email, Google and Meta sign-in, date of birth and country at sign-up, parental permission for young children, log out everywhere, delete account
- Friends by private code, invitations to rooms, leaderboards (Daily Table, today, week, all time), personal stats
- Coins earned by playing, and a cosmetic shop (name colors, titles, badges, table themes); no real money
- Room chat is checked before anyone sees it; report, block, mute and kick; appeals and a moderator screen
- Privacy policy, terms and child-safety pages (drafts)
- Accessibility fixes: higher contrast buttons, keyboard access to scrolling areas

## 0.2.2

- Counting Sheep's dream is rebuilt: a bright snow lane on a cloud raft, floating islands, hills and mountains, a crescent moon, and the farmer asleep in his own cloud bubble
- Counting Sheep is easier and fairer: fences ask for three letters at most, every fence has plenty of common words that fit, signs read R…N, and a fence offers a word if you stop to think
- The sheep leaps properly: fences, walls, logs and hay bales now cross the lane, and a word typed in time can no longer end in a bump
- Counting Sheep has its own night-time look, and every dialog on the farm is paper in a snowy wooden frame
- Counting Sheep has an ending: clear 30 fences and the farmer drifts off; three bumps wake him, and two bumps no longer end the night
- Practice stays endless: how far can you run?
- Fences start further apart and the sheep keeps speeding up, like the offline dinosaur game
- Hay bales turn up later in the run, close behind the fences, for a quick second word
- The result screen shows your night first, then your streak, Share, when the next dream arrives, and Practice
- Shared results show each bump where it happened and link to the game

## 0.2.1

- The start screen is a real farm now: a finished barn, silo, chicken coop, tractor, paddock with animals, orchard and field
- The start screen's camera tours the farm, a few seconds a scene, moving between your avatar and the rest of the place

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
