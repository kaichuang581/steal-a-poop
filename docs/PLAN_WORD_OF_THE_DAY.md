# Word of the day on the start screen (plan for Claude Code)

Skin only, painted Home. No engine change, no server, no new dependency.

## What it is
A small paper slip pinned under the title board on Home: one challenging but learnable word a day, the same for everyone, changing at local midnight. Like Minecraft's splash text: something to notice, never something owed.

## Hard rules
- No streak, counter, reward, badge, notification or "come back tomorrow" text. Ever.
- No content from Merriam-Webster or any other dictionary site; every meaning and example is written for this game.
- Every word must exist in `public/words.txt`, so it can be played.
- Works offline and with the server down.

## Files
1. `src/skin/wotd/words.ts`: `WOTD: { word: string; level: 1 | 2 | 3; meaning: string; example: string }[]`, 365 entries.
   - Level: 1 = uncommon but familiar (*hibernate*), 2 = Merriam-Webster level (*ephemeral*, *gregarious*, *rime*), 3 = hardest still learnable (*somnolent*, *ebullient*). Roughly 105 / 155 / 105.
   - Meaning: plain words, at most 90 characters, understandable by a 12-year-old.
   - Example: one sentence, set on the winter farm where possible ("The somnolent farmer missed his alarm again.").
   - Lean toward winter, farm, weather, animals, feelings and words. Nothing a parent would object to; no obscure words (test: could a 12-year-old use it in a sentence after reading the meaning?).
   - Draft the list, then stop for Brian to review it before wiring anything.
2. `src/skin/wotd/pick.ts`: `wordOfDay(dateKey: string)`, pure and deterministic. Monday and Tuesday use level 1, Wednesday to Friday level 2, Saturday and Sunday level 3; within the level, index = the number of earlier days since 2026-01-01 that used the same level, mod that level's count (not plain days mod count, which would reach only a seventh of each list because weekdays repeat every 7 days). Use `localDateKey` (`src/skin/hooks/useToday.ts`).
3. `src/skin/wotd/WordOfDay.tsx`: the slip. Collapsed: "Word of the day" in small hand type, the word large in Fraunces. Click, tap or Enter expands it to show the meaning and the example; click again to collapse. A button with `aria-expanded`. Re-renders at midnight through `useToday`.
4. `PaintedHome.tsx`: mount it under the title board (under the update badge on compact Home). It must not cover the menu or the Play sign at 1920 × 1080 or 390 × 844.

## Look
Paper slip with a brass pin, slight tilt (−1.5°), hard 2 px shadow, torn edge if the V6 kit exists (otherwise the current paper tokens). No gradient fill, no pill shape. Under reduced motion, no tilt animation on expand.

## Tests (`src/skin/wotd/__tests__/wotd.test.ts`)
- 365 entries, no duplicate words, every field non-empty, meanings ≤ 90 characters.
- Every word is in `public/words.txt`.
- The same date gives the same word; consecutive dates differ; the weekday picks the right level.
- Across a full year of dates, no word repeats within 30 days, and every word in the list appears at least once.

## Done when
Build, type check and `npm test` pass; screenshots of Home at both sizes, collapsed and expanded, are attached; the classic skin is untouched.
