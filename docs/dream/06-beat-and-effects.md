# 06. The beat and the effects

Today a correct word gives a small paper tag and a faint number, and the world looks the same at fence 1 and at fence 30. This file makes the world answer the player.

Timings are in `data/timings.json`. All of this is drawn only. None of it reads or changes the game's timing.

## 1. The beat (`src/skin/dream/beat.ts`, new, pure)

```ts
export const BPM = { 1: 96, 2: 112, 3: 128 } as const;
// beats: a running count that grows by BPM[stage] / 60 each second, so a stage change never makes it jump.
export const phase = (beats: number) => beats - Math.floor(beats);                   // 0 to 1 within a beat
export const pulse = (beats: number) => Math.max(0, 1 - phase(beats) / 0.35) ** 2;   // a sharp hit, gone in 35% of a beat
```

- It runs on the dream's own clock and pauses when the game pauses.
- Every movement "on the beat" is `pulse × its amount`.
- **Each stage has its own things that move to the beat** (files 03, 04 and 05, each in its own section). No stage borrows another's.
- These never pulse, in any stage, because they are for reading: the tray, the sign's letters, the fence meter, the counters, the cards.
- The current pip of the night track blinks on the beat in every stage.

## 2. A word is taken

Times in ms from the moment the game takes the word (today: when the "✓ WORD" tag appears).

| Time | What |
|---|---|
| 0 | **The tiles fly to the sign.** Each typed tile leaves the tray for the sign's word plank, one after another, 30 apart. Each takes 320, along an arc that rises 120 px above the straight line, and shrinks from 40 px to 16 px. The locked tiles stay behind and fade with the tray |
| At the first landing | The sign's board flashes `--lantern-hi` at 40%, gone in 160. A pixel check pops on its top-right corner |
| At the first landing | **Both lanterns on that obstacle switch from dim to lit** |
| At the first landing | One ring spreads from the sign: a 2 px line of `--lantern-hi`, from nothing to 240 px across in 400, fading from 50% to nothing |
| At the first landing | The dream window swells to 1.012 and back in 140, about the sign |
| 0 | In the bed, the farmer lets out one larger "z" |

## 3. The jump

| When | What |
|---|---|
| Take-off | Five puffs fan out behind the hooves (in stage 3, feathers). **The roll starts** |
| In the air | **The roll** (open choice): the sheep tucks its legs 60° and turns once, head first, about its body's centre, like a ball of wool. The turn takes exactly the time in the air. If that is under 300 ms, it only tucks. The rules box does not turn. The sheep keeps its full coat |
| The sheep is counted | **The number pops** at the sheep's upper right: Fraunces 800, 44 (30 on phones), `--wool`, with a hard `--ink` shadow 3 px down. It grows from 0.6 to 1.15 to 1 in 220, then rises 24 px and fades over 600. The night track's pip fills with a pop. The counter's number pops |
| Landing | Six puffs. The dream window drops 3 px for 80. In stage 1, hoofprints; in stage 3, the quilt dips |
| 100 after landing | **The word rises into the sky** (section 5) |

## 4. Other moments

| Moment | What |
|---|---|
| A wrong word | The tray's tiles shake 5 px each way, three times, in 240. Their faces turn `--ember` for 300. The message shows for 1.6 s (file 02). A "?" shows over the farmer's head. **The screen does not shake** |
| The fence is close (the meter at 3 segments or less) | The meter turns `--ember`. The sign's outline blinks between `--ink` and `--ember`, twice a second. The farmer stirs (file 01) |
| A bump | The dream window shakes 6 px each way, four times, in 240. An `--ember` glow round the window's inside edge appears at 20% and fades over 400, once. Three bump stars circle the sheep's head for 600. The card "Bump!" shows. The farmer jolts (file 01) |

## 5. Your words become stars

After each jump, the word you used rises into the sky and stays for the rest of the night, spelled in dots. By the last fence the sky holds the whole night's words. This is the same in every stage: it is the mode's signature, and the game is about words.

| Part | Value |
|---|---|
| Letters | The dot letters of `data/dotfont.json`: 5 dots tall. Most are 3 wide; M and W are 5 wide and N is 4 wide. One empty column between letters. See `reference/dotfont.png` |
| Dots | Each dot is 2 x 2 px. Dots are 4 px apart on desktop and 3 px apart on phones |
| Other characters | Accents are dropped (É is drawn as E). Anything else is skipped, leaving a gap two columns wide |
| Colour | `--frost` at 85% (measured: 6.0 to 1 or better on every sky band of every stage). The newest word is `--lantern-hi` for 2 s, then fades to frost. On each beat, one dot in six dims to 60% |
| The rise | The word leaves the sign's plank and takes 700 ms to reach its place, easing out, its tiles turning into dots on the way |
| Places | 30 places on a grid of 6 across and 5 down over the sky: from 8% to 92% across, and from 64 px below the window's top down to 130 px above the lane. Each place is moved up to 20 px by hash. Skip any place under the moon, the counters or a button star. Words fill the places in an order shuffled by the night's date |
| Long words | At most 12 letters are drawn; a longer word shows 11 and three dots |
| Phones | Only the newest 10 words show. Older ones fade out over 1 s |
| Practice | The same, with the newest 30 |
| At a gate | The words stay where they are. Only the sky behind them changes |

## 6. Gates

The two gates are set pieces, and each is different. The first is in file 04 ("Lift-off"), the second in file 05 ("Tucked in"). Both end with the stage's card.

## 7. Safety and reduced motion (binding)

The game is for children, so nothing may flash.

1. **Nothing fills the window with a flash.** The only glow over the picture is the bump's edge glow, at 20%, once per bump.
2. **No more than three pulses a second** anywhere (128 beats a minute is 2.1).
3. **From one frame to the next, the window's average brightness changes by at most 8%.** The gates blend colours over 600 ms for this reason.
4. **With `prefers-reduced-motion` or `:root.reduce-motion`:**
   - no beat and no pulses;
   - no shake, no swell, no rings;
   - no speed streaks, no roll, no flying tiles (the word simply appears on the plank, then in the sky);
   - snow, feathers and button stars stand still;
   - a gate is a 200 ms cross-fade;
   - the game's own movement stays: the sheep, the fences, the lane scrolling, and the farmer's breathing.

## 8. Sound

None in this plan. Brian is redesigning how the game plays later, and sound that follows the beat belongs there (open choice in file 08).
