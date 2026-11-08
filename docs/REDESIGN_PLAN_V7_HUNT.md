# Finish the Word v7 for Claude Code: the Hunt, rebuilt without a treadmill

Version 7.0, 7 November 2026. A plan for the Hunt only: its pure logic (`src/hunt`), its screen (`src/skin/hunt`), one new shared library (`src/lib/savecode.ts`) and the few lines on Home and in Settings that reach them. It follows the five-voice debate of 7 November (`HUNT_DEBATE.md`): teach before punishing, share by code instead of calendar, label instead of restrict, persist records and cosmetics only, keep everything working with the server down. The v1 guardrails apply; the Hunt keeps its handheld-console look (V6 decision 9.3). Seven milestones: **H0** (the run log and the rule), **H1** (the pure layer), **H2** (teaching), **H3** (pack codes, the lobby, the results card), **H4** (the save code and the bestiary), **H5** (the clean stop and the sweep), **H6** (the drowsy fox: not approved, specified for later).

Written against `main` at commit 4dce7f7. File, function and class names below are that commit's.

---

## 0. For Brian

Save as `docs/REDESIGN_PLAN_V7_HUNT.md`, add the Part 1 block to `CLAUDE.md`, and paste:

```
Read @docs/REDESIGN_PLAN.md (Parts 1 to 4) and @docs/REDESIGN_PLAN_V7_HUNT.md in full. Do Milestone H0 exactly as specified: the run log, its export, its tests, the dev summary, and the CLAUDE.md rule. Change nothing a player can see except the export button. Stop there.
```

Then H1 to H5, one per session (Part 8). H6 waits for a month of H0's data and a separate yes from you.

---

## 1. Guardrail addition (append to CLAUDE.md)

```markdown
- The Hunt v7 (approved by Brian, 2026-11-07): docs/REDESIGN_PLAN_V7_HUNT.md. Rules that bind every change to the Hunt:
  (a) No persistent power. Nothing kept between runs may change health, damage, items, time or rules. What persists is
      records, the bestiary, the run log and cosmetics. Items reset every run.
  (b) Announced adjustments only. Nothing in the Hunt is tuned behind the player's back; anything that changes a run's
      difficulty says so on screen and is marked in the share text. (The hidden `softGame` in Quick Games is outside this
      plan and is listed as a decision for Brian.)
  (c) Same code, same pack. A pack code must give every player the same predators, rules, reserves and hint words for a
      given word-list version; the code carries the version and the game says so when it differs.
  (d) Nothing on a calendar, nothing on a server. No weekly schedule, leaderboard, account or moderation is added by this
      plan. Every feature keeps working with the server down.
  (e) Local-storage keys are promises: add fields with defaults, never migrate, never rename. New keys: sap:hunt-log,
      sap:hunt-packs, sap:hunt-bestiary. sap:hunt-best keeps its shape and gains optional fields.
  (f) The Hunt's look stays the handheld console (src/skin/hunt, .gb-*); new screens are drawn in that style.
```

---

## 2. What the debate decided, and what this plan builds

| Debate item | Score | This plan |
|---|---|---|
| B. Rule cards that teach | 25 of 25 | Part 4.2 and 5.2: every rule carries a word that obeys it and a word that breaks it, computed from the word list; a face-down "?" card for the reserve rule; the typed word is checked against the rules as it is typed |
| A. Pack codes | 25 | Part 4.1 and 5.4: five-character codes, the code is the seed, `?pack=` opens it, the code is on every results card and in every share |
| 5. No persistent power | 24 | Part 1 rule (a); nothing to build |
| C. Last words | 22 | Part 5.3: the death screen names what got you and shows a word that would have worked, with equal buttons |
| D. Save code | 21 | Part 6: export and import of every record in one pasted blob, before the bestiary exists |
| 3. Retry the same pack | 20 | Part 5.3 and 5.4: "Fight this pack again" is the code again; the attempt is counted and marked |
| L. Word-list version in the code | 19 | Part 4.1: the fifth character |
| E. Two ledgers | 18 | Part 4.4: the player's cards count every run; the share carries the attempt number |
| J. The results screen as the picture | 18 | Part 5.5 |
| 2. The bestiary | 16 | Part 4.5 and 5.6, after the save code |
| G. A clean stop | 16 | Part 5.7: a lobby instead of an auto-start; "Walk home" after a boss |
| H. Local run log | 15 | Part 3, first, so the data starts now |
| K. Pass the sheep | 13 | not in this plan (decision 9.8) |
| 1. Drowsy fox, re-levered | 10 | Part 7, H6, not approved |
| I. Rule book | 8 | not built; the cards carry the lesson |
| 4. Pack of the week | 7 | not built; a date-derived code is one line later if codes prove sharing (decision 9.7) |
| F. Difficulty setting | 2 | vetoed; not built |

Three facts from the code that shape the plan: the first fox has 36 × 0.9 = 32 HP and bites for 7 or 8 (`predatorAt`), so a player typing legal words cannot lose to it and early deaths are time-outs (1.5 × attack) and broken rules; the whole pack, its reserve rules and the Hint Bell's words are a pure function of the seed string and the word list (`predatorAt`, `hintWord`), so a code is free; and the screen mints each run's seed as `hunt:${Date.now()}:${random}` (`HuntScreen.tsx` line 87), which is the one line that becomes a code.

---

## 3. Milestone H0: the run log and the rule

Before anything a player can see changes, start measuring, and write down the rule.

### 3.1 `src/hunt/log.ts`

```ts
export interface RunLog {
  code: string;            // the pack code (H1); 'legacy' before H1
  attempt: number;         // 1 for the first run of this code on this device
  date: string;            // localDateKey
  defeated: number; damage: number; words: number; level: number;
  reached: PredatorKind;   // the predator on screen when the run ended
  cause: 'timeout' | 'broke' | 'hits' | 'walk' | 'left';
  brokeRule?: string;      // rule id when cause is 'broke'
  turnsAtDeath: number;    // marks on the last predator
  itemsLeft: { milk: number; bell: number; pepper: number };
  seconds: number;         // wall-clock seconds of the run, rounded
  wordsVersion: number;
}
export const LOG_KEY = 'sap:hunt-log';
export const LOG_MAX = 50;
export function appendLog(entry: RunLog): void;          // ring buffer of LOG_MAX
export function readLog(): RunLog[];
export function logSummary(log: RunLog[]): { byPredator: Record<number, { timeout: number; broke: number; hits: number; walk: number }>; firstFoxDeaths: number; medianDefeated: number };
export function exportLog(): string;                       // JSON, pretty, with { exported: date, version: 1 }
```

`cause` is derived in the screen from the last outcome: `timeout` when the last mark is `-`, `broke` when `x`, `hits` when the killing strike followed a valid word or an item, `walk` for Part 5.7, `left` when the player closes the Hunt mid-run (the existing `close`). The log is written once per run, where `recordHuntBest` is called today (`HuntScreen.tsx` line 164).

### 3.2 Where it shows

- The dev overlay (`?dev=1`, `DevLine` from `src/skin/table/DevStats.tsx`) gains one line on the Hunt screen: `log: 23 runs · fox deaths 9 (timeout 6, broke 3) · median beaten 2`.
- The admin panel (`src/skin/components/AdminPanel.tsx`, unlocked state) gains a `Copy hunt log` button that copies `exportLog()` to the clipboard. Nothing leaves the device unless Brian pastes it somewhere.

### 3.3 Tests (`src/hunt/__tests__/log.test.ts`)

The ring buffer keeps the last 50; `logSummary` counts causes per predator index; `exportLog` is valid JSON that parses back to the same entries; a malformed stored value is ignored and the log starts fresh.

### 3.4 The rule

Append Part 1 to `CLAUDE.md`. No other change in H0.

---

## 4. The pure layer (`src/hunt`), Milestone H1

Everything in this part is pure, seeded and tested. The screen is not touched until H2.

### 4.1 Pack codes: `src/hunt/codes.ts`

- **Alphabet**: Crockford's base 32 without the ambiguous letters: `0123456789ABCDEFGHJKMNPQRSTVWXYZ` (32 symbols). Codes are read aloud across a lunch table, so no I, L, O or U, and the parser upper-cases and maps `I`→`1`, `L`→`1`, `O`→`0`, `U`→`V` before validating.
- **Shape**: five characters. The first four are the pack (32⁴ = 1,048,576 packs); the fifth is the **word-list version digit** (`WORDS_VERSION % 32`). Example: `K7QX2` is pack `K7QX` under word list 2.
- **`WORDS_VERSION`**: a constant in `src/config.ts`, starting at 1. A test (`src/hunt/__tests__/words-version.test.ts`) hashes `public/words.txt` (FNV-1a over its bytes) and compares it with `WORDS_HASH` next to the constant; when the list changes, the test fails until both are updated, so the version can never lag the list. Guardrail (c).
- **API**:

```ts
export function newCode(random = Math.random): string;            // four random symbols + version digit
export function parseCode(input: string): { code: string; version: number; stale: boolean } | null;  // null when malformed
export function seedOf(code: string): string;                      // `pack:${code}` — the seed string the pure layer uses
export function isLegacySeed(seed: string): boolean;               // seeds from before H1 ('hunt:...')
```

`startRun(dict, seedOf(code))` is the only way a run begins from H3 on. `dailySeed` stays exported for the classic server's Daily Table and is otherwise unused.

- **Stale codes**: a code whose version digit differs from `WORDS_VERSION` still opens (`predatorAt` regenerates against the current list, so the pack may differ). The lobby says so before the fight: "This code is from an older word list. The pack may not match your friend's." The run's share text and log carry `old list`. Decision 9.3.
- **Attempts**: `src/hunt/packs.ts`, key `sap:hunt-packs`: a ring buffer of the last 100 codes played on this device with `{ code, attempts, best: { defeated, damage } }`. `attemptOf(code)` returns the next attempt number; `recordAttempt(code, result)` increments. The attempt number is the only thing that separates a first try from a rerun; nothing is locked (guardrail: label, don't restrict).

### 4.2 Rules that teach: additions to `src/hunt/rules.ts` and `hunt.ts`

- `Rule` gains `how: string`: one plain sentence a child can act on, written per rule: `minLength`: "Count the letters: five or more."; `maxLength`: "Short words only."; `minConsonants`: "Consonants are every letter except A, E, I, O, U."; `minVowels`: "Vowels are A, E, I, O and U."; `banLetter`: "No X anywhere in the word."; `mustContain`: "An X somewhere in the word."; `CHAIN`: "Your last word ended in X, so start with X."; `LONGER`: "Your last word had N letters; use N or more."; `NO_REPEAT`: "Every letter different: FARM, not SHEEP."; `DOUBLE`: "Two of the same letter in a row: SHEEP, WOOL."; `ENDS_VOWEL`, `ENDS_CONSONANT`, `STARTS_VOWEL`, `NO_FIRST_AGAIN` likewise. The chain rules' sentences are filled in by the screen with the previous word.
- **Examples**: `exampleWords(dict, rule, seed): { yes: string; no: string }` in `hunt.ts`: deterministic from the seed's rng; `yes` is a friendly word (5 to 8 letters, not rare, as `hintWord` defines) that obeys the rule; `no` is a friendly word that breaks it. For a predator, `yes` is chosen to obey **all** of that predator's main rules at once when one exists within the first 400 candidates, else the rule alone, so the card's "yes" word is a word the player could actually type. Chain rules use `prev` when there is one, else a fixed illustration (`CHAIN`: "APPLE then EAGLE"). `Predator` gains `examples: Record<ruleId, { yes: string; no: string }>` filled in `predatorAt` for the main rules and the reserve, from the same rng stream, after the rules are drawn (so existing packs' rules do not change: the examples are drawn after the loop that picks rules, from a second rng `rng(`${seed}:${index}:ex`)`).
- **Live check**: `checkTyped(run, dict, typed): { broken: Rule | null; tooShort: boolean; used: boolean; known: boolean | null }` in `hunt.ts`: the rule the typed text would break under `activeRules`, whether it is under three letters or already used, and whether it is in the word list once it is three letters or more (`null` while shorter). Pure, cheap (a few `test` calls and one `dict.has`). The screen shows it as the player types (Part 5.2). The `broke` outcome and its strike stay for a word submitted anyway. Decision 9.1.

### 4.3 The cause of death and the word that would have worked: `hunt.ts`

- `Run` gains `lastTurn: { run: Run; outcome: Outcome } | null` is **not** added (it would nest runs). Instead the screen keeps the pre-strike run in a ref (it already has `run` before `resolve`), and `hunt.ts` gains two pure helpers:
  - `causeOf(outcome: Outcome): 'timeout' | 'broke' | 'hits'` (an `item` or `hit` outcome that ends the run is `hits`).
  - `lastWords(before: Run, dict: Dictionary): { word: string | null; itemHelp: 'milk' | null }`: `hintWord(before, dict)` for the turn that killed the sheep, and `milk` when the sheep died to a strike with a Warm Milk unused and `before.hp + MILK_HEAL > counter`. The screen phrases it (Part 5.3). Deterministic per turn, as `hintWord` is.
- `walkHome(run): Run`: `{ ...run, over: true, walkedHome: true }`; `Run` gains `walkedHome?: boolean` (default absent). Allowed only when `run.predator.boss && run.predator.hp === 0` in the step between a boss fainting and the next predator (Part 5.7). `defeated` is unchanged, so stopping never adds to a record.

### 4.4 Records and the share text: `record.ts`

- `HuntBest` gains optional `code?: string`, `attempt?: number`, `date?: string`, `walked?: boolean`. `recordHuntBest` writes them; old stored values without them still load (guardrail (e)).
- `huntShareText` gains `code`, `attempt`, `stale` and `walked`:

```
Finish the Word · Hunt
Pack K7QX2 · 1st try
3 predators beaten · 412 damage
oo*xo-o+oo
o*oo
Walked home after the Shadow Wolf      (only when walked)
New personal best                      (only when a record)
Made with an older word list           (only when stale)
Fight this pack: finishtheword.app/?pack=K7QX2
```

The marks row stays spoiler-free. The attempt reads `1st try`, `2nd try`, `5th try`. The URL line uses the site's own origin (`location.origin`) when available and is omitted in tests.

- **Two ledgers**: the bestiary and the per-code bests count every run, attempt one or ten; the share text and the results card always carry the attempt number. Nothing is hidden; nothing is locked.

### 4.5 The bestiary: `src/hunt/bestiary.ts`

```ts
export interface DexEntry { met: boolean; beaten: number; highestLevel: number; bestWord: { word: string; damage: number } | null; firstMet?: string }
export type Bestiary = Record<PredatorKind, DexEntry>;
export const DEX_KEY = 'sap:hunt-bestiary';
export function readBestiary(): Bestiary;                              // defaults for every kind
export function meet(kind: PredatorKind, date: string): void;           // on appearance
export function beat(kind: PredatorKind, level: number, word: { word: string; damage: number } | null): void;  // on faint
export function dexProgress(b: Bestiary): { met: number; beaten: number; of: 6 };
```

`beaten` is a tally on the card and never in the share text (the room's compromise). `highestLevel` is the predator's shown level (`level + START_LEVEL - 1`). `bestWord` is the biggest hit landed on that kind. The Shadow Wolf's `met` flips only when a player reaches a boss, which is the one silhouette that lasts.

### 4.6 `startRun` and the drowsy parameter (dormant)

`startRun(dict, seed, opts?: { drowsy?: boolean })`: the option exists from H1 so the signature never changes again, and does nothing until H6 is approved. `attack`, `timeOut`, `nextPredator`, `applyItem`, `hintWord`, `activeRules`, `predatorAt`'s rule drawing and every constant keep their behaviour; the existing tests in `src/hunt/__tests__/hunt.test.ts` must pass unchanged.

### 4.7 Tests for H1 (`src/hunt/__tests__/codes.test.ts`, `examples.test.ts`, `bestiary.test.ts`, `record.test.ts` additions)

1. `newCode` produces five symbols from the alphabet with the version digit last; `parseCode` accepts lower case and maps I, L, O, U; rejects four or six characters and symbols outside the alphabet; flags `stale` when the digit differs.
2. The same code gives the same pack: `predatorAt(dict, seedOf(code), i)` for i in 0..9 deep-equals across two calls and two `Dictionary` instances built from the same list.
3. Two different codes differ in at least one predator within the first three.
4. For every rule in `rulePool(0..6)` and five seeds, `exampleWords.yes` passes the rule and is friendly, `no` fails it; for twenty packs, each main rule's `yes` passes all of the predator's main rules together.
5. `checkTyped` reports the first broken rule as `brokenRule` does, `tooShort` under three letters, `used` for a used word, `known: null` under three letters.
6. `causeOf` maps the three outcome kinds; `lastWords` returns a word that obeys the rules in force on the killing turn and `milk` only when a milk would have survived the strike.
7. `walkHome` ends the run with `defeated` unchanged and `walkedHome: true`; `recordHuntBest` does not count a walk as more than the predators beaten.
8. `huntShareText` with code and attempt matches the layout above; without a code (legacy) it matches today's text exactly (the existing test keeps passing).
9. The bestiary: `meet` sets `met` once with the date, `beat` raises `beaten`, keeps the higher `highestLevel` and the bigger `bestWord`; a stored value missing a kind gets the default.
10. `WORDS_VERSION` and `WORDS_HASH` match `public/words.txt`.

---

## 5. The screen (`src/skin/hunt`), Milestones H2, H3 and H5

The 256 × 192 screen, its scale, fonts and colours stay. New panels follow `.gb-panel` (white with a lavender frame) and `.gb-text` (navy with a gold frame) exactly; nothing new in the Hunt is rounded past 4 px or gradient-filled beyond the sky and the snowfield that exist today. New class families: `.gb-lobby`, `.gb-card`, `.gb-death`, `.gb-polaroid`, `.gb-dex`, `.gb-code`.

### 5.1 The lobby (H3; replaces the auto-start at `HuntScreen.tsx` line 84)

Opening the Hunt shows a screen in the frame, not a fight:

- The sheep from behind at the left, the snowfield, and a `.gb-text` box: "The pack is out there." A `.gb-panel` menu like the battle menu, four items: **NEW PACK**, **ENTER CODE**, **BESTIARY**, **FARM**. Arrow keys, Enter and Esc as the battle menu; pointer works.
- Under the menu, one line in the frame's small type: the device's best (`best 4 beaten · 560`) and, when the last run's code is known, `last pack K7QX2 · 2nd try`.
- **NEW PACK**: `newCode()`, `startRun(dict, seedOf(code))`, the existing `appearSteps`.
- **ENTER CODE**: a `.gb-code` panel with five boxes and the ghost input (the same focus trick as FIGHT); typing fills the boxes, upper-cased and mapped; Enter with a valid code starts it; an invalid code shakes the boxes (`gb-quake`) and says "That's not a pack code." A stale code shows the notice of Part 4.1 with **FIGHT ANYWAY** and **BACK**.
- **`?pack=K7QX2`** (`PaintedApp.tsx`, next to `PREVIEW`): opens the Hunt straight into that code's announcement, with the stale notice first when it applies; the parameter is removed from the URL with `history.replaceState` once read, so a reload does not restart it. `useHuntUi` gains `openHunt(code?: string)` and `code: string | null`.
- The Hunt row on Home (`PaintedHome.tsx`, `id: 'hunt'`) keeps its caption; its badge becomes `best 4` or `new` as now, and `dexProgress` adds `· 3/6 met` once the bestiary exists.

### 5.2 Teaching in the fight (H2)

- **The announcement** (`mode.m === 'announce'`, `.gb-sign`): each sign shows the rule's `label`, then its `how` line, then `YES FARM · NO SHEEP` in the small type (`examples` from the predator), with the yes word in the text box's green and the no word in its red; the sign's slam animation stays; the beat count per rule rises from 3 to 4 so the examples can be read (`BEAT * (2 + rules.length * 4)`). Under reduced motion the signs appear at once and stay for the same time.
- **The "?" card**: from the second predator on, a face-down sign (`.gb-sign` with a `?` and "wakes up when it's hurt") stands at the end of the row during the announcement and in `.gb-tags` as a `?` tag, so the reserve rule is never a cheap shot; when the predator is hurt to half, the existing `announce` with `enraged` flips the card: "NEW RULE!" as now, with its examples.
- **The RULES menu item**: instead of a sentence in the text box, a `.gb-card` panel over the stage, one card per rule in force: label, `how`, YES and NO words; relaxed chain rules show "asleep this turn" (the current "let slide" wording goes); the `?` card for an unmet reserve; Esc or BACK returns without spending the turn, as now (`resume: true`). The clock keeps running: reading the rules costs time, not a turn, which is the honest price.
- **Live check in FIGHT**: `.gb-note` under the typed word shows `checkTyped`'s result as the player types: nothing while the word is under three letters; `breaks: No E` in red when a rule would be broken; `not a word` in red when `known` is false; `already used`; otherwise the rules' labels as today. Enter on a word that breaks a rule still submits it and the predator still strikes (`broke`); the note only tells the truth before the player commits. The `START` row in `.gb-info` stays.
- **The tags** (`.gb-tags`): each tag gains a title with its `how` line, and a tag whose rule the typed word currently breaks turns the tag red while it does.

### 5.3 The death screen (H2; before the results)

When `next.over` and the cause is not a walk, the step queue ends in a `.gb-death` panel instead of jumping to results:

- Title: **WHAT GOT YOU**. One line by cause: `timeout`: "The clock. 12 seconds wasn't enough for the EAGLE's rules."; `broke`: "A broken rule: Has a K. You typed STORM."; `hits`: "The LYNX's claws. It hit for 15 and you had 12."
- Second line: `lastWords`: "KIND would have done." or, for `hits` with a milk unused, "A Warm Milk was still in the bag."; when neither applies, the line is omitted. No "so close", no "almost", no exclamation marks: the room's near-miss rule.
- Buttons, equal size and order fixed: **FIGHT THIS PACK AGAIN** (`startRun(dict, seedOf(code))`, attempt + 1), **NEW PACK**, **RESULTS**. Nothing auto-starts and nothing is focused by default except the panel itself; Enter does nothing until a button is chosen with the arrows or the pointer.
- RESULTS leads to the results card (5.5); the death screen is reachable again from the card with BACK.

### 5.4 Codes everywhere (H3)

- The code is printed in the top-right of the stage during a fight in the frame's small type (`PACK K7QX2 · 1st try`), under the predator's box, so a screenshot mid-fight carries it too.
- The results card (5.5) prints it large; the share text (4.4) carries it with the URL line; the death screen's FIGHT THIS PACK AGAIN increments the attempt.
- The Home ticket's caption gains one sentence: "Got a friend's pack code? Enter it in the Hunt."

### 5.5 The results card as the picture (H3; replaces `Results`)

The results become one composed 256 × 192 picture inside the frame, laid out to be screenshotted and recognised in a group chat:

- A `.gb-polaroid`: a white card with a thick bottom margin, slightly rotated (−2°), filling the frame with 12 px of the snowfield visible around it. On the card: the sheep (`SheepBackSprite` turned to face the camera is not available, so the back sprite stands at the left, frozen when the run ended in ice) beside the predator reached (`PredatorSprite`, fainted pose when it was beaten, upright when it got you); between them the result line in the text box's navy: `3 BEATEN · 412 DMG`; under the sprites the biggest word stamped in the word-burst style of the stage (`.gb-word`'s letter-spaced white on navy): `BLIZZARD 48`; the pack code large in the card's margin, hand-written style (the frame's font at 14 px): `K7QX2 · 1st try`; `WALKED HOME` as a stamp when it applies; `NEW BEST` as a gold stamp when it applies; the marks row in 6 px under the code.
- Buttons under the card, equal: **FIGHT AGAIN** (same code, attempt + 1), **NEW PACK**, **SHARE** (copies the text of 4.4), **FARM**. No button focused by default; the card is read first.
- The classic `dl` of stats goes; LEVEL and WORDS move to the bestiary and the log.

### 5.6 The bestiary screen (H4)

`.gb-dex`, opened from the lobby: six cards in a 3 × 2 grid, each a `.gb-panel` 72 × 80 px: the sprite (a black silhouette with `filter: brightness(0)` on the pixelated PNG until `met`), the name (or `???`), `BEATEN 12`, `BEST LV 9`, the best word with its damage in small type; the Shadow Wolf's card last, its silhouette with red eyes showing through (the sprite's eyes drawn over the silhouette) once a player has reached a boss at least once. A footer: `3 OF 6 MET · 2 BEATEN`. Esc or FARM returns to the lobby. Arrow keys move a cursor between cards; Enter flips a met card to its back: the dates first met and the predator's signature move.

### 5.7 The clean stop (H5)

- The lobby already removes the auto-start; after a run nothing starts until a button is chosen.
- **Walk home**: after a boss faints and before `nextPredator`, the step queue pauses on a `.gb-text` question: "The SHADOW WOLF is down. Walk home with the flock, or hunt on?" with two equal buttons **WALK HOME** and **HUNT ON**; the clock does not run here. WALK HOME calls `walkHome`, logs `cause: 'walk'`, and goes to the results card with the WALKED HOME stamp. HUNT ON continues as today.
- Leaving mid-run (the `gb-quit` button or Esc from the menu) asks once in the text box, "Leave the hunt? This run ends." with **LEAVE** and **STAY**; a left run is logged as `left` and recorded as any other run (it is, today, silently discarded).
- No notification, reminder, countdown or streak is added to the Hunt, now or later (guardrail (d) and the debate's one unanimous "never").

### 5.8 Sound and motion

The existing sounds stay (`play`, `fail`, `bank`, `roundEnd`, `steal`, ticks). The polaroid slides in from the bottom (`gb-slide-in` reused); the dex cards flip with a 2-frame `steps()` animation; the death panel slams like a sign. Under reduced motion the existing `:root.reduce-motion .gb-root *` rule already shortens everything to 1 ms.

---

## 6. The save code (`src/lib/savecode.ts`), Milestone H4, before the bestiary screen

A copy-and-paste text that carries a player's records to another browser, because school Chromebooks wipe profiles and Safari evicts script storage after a week away.

- **Format**: `FTW1.` followed by base64url of a JSON object `{ v: 1, at: date, data: { [key]: value } }`, followed by `.` and an 8-hex-character FNV-1a checksum of the base64 part. Keys exported, from a registry in `savecode.ts`: `sap:hunt-best`, `sap:hunt-bestiary`, `sap:hunt-packs`, `sap:hunt-log`, `sap:dream`, `sap:dream-streak`, `sap:dream-best`, `sap:dream-covered`, `sap:dream-repaired`, `sap:practice-best`, `sap:record`, `sap:avatar`, `sap:settings` (the name and table settings; never `sap:admin`, `sap:guest`, `sap:server`, `sap:muted`, `sap:volume`). Decision 9.5.
- **Import** validates the prefix, the checksum and the JSON shape; every value is checked against a per-key validator (shape and types) before it is written; anything unknown or malformed is skipped and reported ("12 of 13 records restored; the hunt log was unreadable"). Import **merges**, never overwrites blindly: bests take the maximum; the bestiary takes per-field maxima and the earlier `firstMet`; the dream streak takes the record with the later `last` and the higher `best`, and `blankets` the maximum; the hunt packs and log concatenate and trim; the avatar and settings take the imported value only when the local one is at its default. A dry run shows what would change before the player confirms.
- **UI**: in `PaintedSettings`, a row **Save code**: **Copy** (copies the code, shows its length in characters) and **Paste** (a text field, then the dry-run summary and **Restore**). The classic settings screen is untouched.
- **Tests** (`src/lib/__tests__/savecode.test.ts`): round trip of a populated store; a flipped character fails the checksum; a JSON payload with an extra unknown key is skipped; a bestiary value with a string where a number should be is rejected for that key only; merge takes maxima and never lowers a best; a 100 KB code is refused (`MAX_CODE_LENGTH`), which bounds the log at export.

---

## 7. Milestone H6: the drowsy fox (not approved; do not build without Brian's yes)

Specified so that, if H0's log shows that first-fox deaths remain common after H2's teaching, the change is one session:

- Trigger: the last three logged runs on this device ended at predator index 0 or 1 (`defeated < 2`), none of them a walk or a left run, and the next run is a **NEW PACK** (never an entered code, never a retry, never a stale code).
- Lever: `startRun(dict, seed, { drowsy: true })` gives the first predator only **25 seconds a turn instead of 20** (`turnSeconds` gains the option) and forgives the **first** broken rule (the strike is skipped once; the text box says "The fox is too sleepy to notice."). Health and attack are untouched: the room found the fox's health is not what kills anyone.
- Announcement: the appearance step says "The RED FOX is half asleep tonight." and the stage shows `Z`s over it; the code line reads `K7QX2 · drowsy`; the share text carries `drowsy fox` on its own line; the bestiary counts the win (the player's own ledger), the per-code best does not (`sap:hunt-packs` stores `drowsy: true` and the lobby's "last pack" line says so).
- Tests: the trigger reads only the log; an entered code or a retry never gets it; the forgiven strike happens once; the share text carries the mark.

Build this only after a month of H0 data and a separate decision.

---

## 8. Milestones and prompts

| Session | Milestone | Scope | Prompt |
|---|---|---|---|
| 1 | H0 | Part 3 | the Part 0 prompt |
| 2 | H1 | Part 4 entire, tests 4.7, `WORDS_VERSION` | "Read Parts 4 and 10 of docs/REDESIGN_PLAN_V7_HUNT.md. Do Milestone H1: the pure layer only, no screen change. All existing tests pass unchanged. Report the new tests' names and results." |
| 3 | H2 | 5.2, 5.3, 5.8 | "Read Parts 5.2, 5.3, 5.8 and 10. Do Milestone H2. Attach screenshots of an announcement with examples, the RULES cards, the live check in FIGHT showing a broken rule, and the death screen for each of the three causes, at 3x and at phone size." |
| 4 | H3 | 5.1, 5.4, 5.5, `?pack=` | "Read Parts 4.1, 5.1, 5.4, 5.5 and 10. Do Milestone H3. Attach screenshots of the lobby, the code entry with a stale code, the results card with a best word and a NEW BEST stamp, and the share text; show `?pack=` opening a code." |
| 5 | H4 | Part 6, then 4.5 and 5.6 | "Read Parts 4.5, 5.6, 6 and 10. Do Milestone H4: the save code first, then the bestiary. Attach the Settings row, a dry-run summary, and the bestiary with three predators met and the Shadow Wolf's silhouette." |
| 6 | H5 | 5.7, Part 10 entire | "Read Parts 5.7 and 10. Do Milestone H5. Attach the walk-home prompt, the leave prompt, and everything Part 10 lists." |
| later | H6 | Part 7 | only after Brian's separate yes |

After each: `npm run build`, the type check, `npm test`, the e2e suite in the classic build (the classic look has no Hunt and must be untouched).

---

## 9. Decisions (change any before starting)

| # | Decision | Alternative |
|---|---|---|
| 9.1 | The typed word is checked against the rules as it is typed; a word submitted anyway still breaks the rule and takes the strike | no live check; the rule is learned only from the cards and the strike |
| 9.2 | Codes are five characters: four for the pack, one for the word-list version | six characters with a check digit; or four with no version (stale codes then differ silently) |
| 9.3 | A stale code plays after a notice and is marked `old list` | a stale code is refused |
| 9.4 | Attempts are counted and labelled, never limited; the bestiary counts every run | the first attempt only counts anywhere |
| 9.5 | The save code carries every record (Hunt, dream, practice, game records, avatar, table settings) | the Hunt best, the bestiary and the dream streak only |
| 9.6 | The lobby replaces the auto-start; NEW PACK is one press away | keep the auto-start and put ENTER CODE and BESTIARY on the results card |
| 9.7 | No weekly pack; if codes prove sharing, a date-derived code can be added later as one more code with no board or countdown | build the weekly now |
| 9.8 | Pass the sheep (two players on one device) is not built | build it as a lobby item: two names, one code, marks side by side |
| 9.9 | `beaten` tallies show on the bestiary card and never in the share text | drop the tally entirely |
| 9.10 | The death screen names the cause and one word that would have worked, with equal buttons and no near-miss copy | the results card only |
| 9.11 | H6 (the drowsy fox) waits for a month of log data and a separate yes | build it now with the re-levered design |
| 9.12 | Outside this plan, for Brian: the hidden `softGame` in Quick Games fails the "announced adjustments only" test the room applied to the Hunt; make it speak (a line on the start screen or the table) or remove it | leave it hidden |

---

## 10. Tests and acceptance

1. All tests in `src/hunt/__tests__/hunt.test.ts` pass unchanged through every milestone.
2. H1's ten tests (4.7) pass; `WORDS_VERSION` guards the word list.
3. H0: the log test; the admin export copies valid JSON; the dev line shows the summary.
4. H2: screenshots show examples on every announcement sign, the `?` card from the second predator, the live check turning a tag red, and the three death screens; a Playwright script plays a seeded pack (`?pack=` with a fixed code and a mocked clock) and asserts the death screen's cause text for a timeout and for a broken rule.
5. H3: `parseCode` round trips through the lobby's boxes; `?pack=` opens the code and strips the parameter; two browsers (two Playwright contexts) opening the same code see the same first three predators and rules; the results card screenshot at 3x contains the code, the sprites and the marks; the share text matches Part 4.4.
6. H4: the save code round trips between two Playwright contexts (export in one, import in the other, bestiary and dream streak equal afterwards); a tampered code is refused with the reason; the bestiary shows silhouettes until met.
7. H5: the walk-home prompt appears only after a boss; a walk never raises `defeated`; the leave prompt logs `left`; no auto-start anywhere; no timer runs on the lobby, the death screen, the results card or the walk prompt.
8. Honesty audit: a grep of `src/hunt` and `src/skin/hunt` finds no persisted field that feeds `attack`, `timeOut`, `turnSeconds`, `startRun` or `ITEMS` except through the explicit, announced `drowsy` option of H6; the share text carries every mark (attempt, old list, walked, drowsy) the run had.
9. Phone (390 × 844): the lobby, the code boxes, the death screen and the results card fit the frame at scale 1.5 with no overlap; the ghost input keeps the keyboard behaviour FIGHT has today.
10. Reduced motion: every new animation is covered by the existing `:root.reduce-motion .gb-root *` rule; the announcement with examples is readable for the same total time.
11. The classic build (`VITE_SKIN=classic`) is unchanged and the e2e suite passes.

---

## 11. In one paragraph

The Hunt keeps its handheld-console battle and loses its treadmill. Every rule card now teaches: a plain sentence, a word that obeys it and a word that breaks it, a face-down card for the rule a hurt predator will bring, and a live check under the word being typed, so nobody loses to a card they could not read. Every run has a five-character pack code that is its seed and carries the word-list version; the code is on the stage, on a results card composed to be screenshotted, and in the share text with a link, so a friend fights the same pack today with no calendar, server or leaderboard, and "fight this pack again" is the same code with the attempt counted and labelled. A death screen names what got you and the word that would have worked, with equal buttons and no sting. A lobby replaces the auto-start; after a boss the player may walk home on a win. A save code carries every record to another browser before a bestiary of six cards, silhouettes until met, is added. A local run log, started first, is the only telemetry, and the drowsy fox waits on its data.
