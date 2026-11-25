# 01. Endless, with a best score

## 1. The rule in one line

**A night has no end of its own. It ends at a bump. The number to beat is your best.**

*An example.* Yesterday you counted 32 sheep. Tonight the counter shows your count, and a small tab under it reads "Best 32". At your 33rd sheep the tab turns orange and reads "New best".

## 2. What the game already does, and keeps

The build already runs past 30 (the branch `dream/endless-ramp`): at 30 the farmer is out cold, the night goes on a little faster at each fence, and a bump ends it. **No rule changes in this file.** These stay exactly as they are:

- when a bump ends the night, and the two endings ("The farmer woke up!" before 30, "The farmer drifted off" from 30 on);
- the coins, and the bonus for reaching 30;
- the speed at every fence;
- when the letters go from one to two to three;
- the card "Zzz… / He's out cold" at 30, and his deeper sleeping pose from then on.

Thirty stays in the game as one milestone among others. It is no longer shown as the goal.

## 3. What is removed

| Removed | Why |
|---|---|
| The meter at the top (30 pips, the "1 2 3" tags) | Brian: it shows when the background changes, and it promises an end |
| " of 30" in the counter | The same |
| The card "Nearly out cold / Five fences to go" | It counts down to an end |
| The finale as a one-time event at fences 26 to 30 | It becomes the moon show, every 10 sheep (file 07, section 5) |
| "Fence 4 of 30" on the results board | The same |

Search the code and both languages' strings for "of 30", "/30" and "Five fences". None may remain on a screen.

## 4. The counter and the best score

The counter's look is in file 08, section 3. Its behaviour:

| Part | Rule |
|---|---|
| The count | The number of sheep counted this night. It pops to 1.25 times its size and back in 180 ms at each sheep, as today |
| **The best** | `bestSheep`: the highest count this player has reached on any counted night. Practice has its own, `bestPractice` |
| Where it is kept | Beside the streak, wherever the streak is kept today (find it). If the streak goes to the server, `bestSheep` goes with it in the same message as the night's result. `bestPractice` is kept on the device only |
| Its first value | If past nights' counts are stored, the highest of them. Otherwise 0 |
| The tab under the counter | Hidden while the best is 0. Otherwise "Best 32" |
| Beating it | At the first sheep that makes the count greater than the best (and the best is above 0): the tab changes to "New best" on orange, over 160 ms, and that sheep's count pops up in gold. The tab then stays "New best" for the rest of the night |
| Saving | Once, with the night's result. Never during the night |
| Practice | The same tab, with `bestPractice` |

## 5. Which world, when

Nothing on screen announces it; the worlds simply come. The rule:

- While the sign shows **one letter**, the dream is world 1 (his own farm).
- While it shows **two letters**, world 2 (the farm lifts off).
- From the first fence with **three letters** (call it `F3`; today it is fence 17), world 3 (under the quilt) for 15 fences. Then the worlds go round, 15 fences each, for as long as the night lasts: world 1, world 2, world 3, world 1, and so on.

```ts
// src/skin/dream/worlds.ts
export const WORLD_LENGTH = 15;
/** letters: how many letters fence f's sign shows, read from the game. F3: the first fence with three letters. */
export function worldAt(f: number, letters: 1 | 2 | 3, F3: number): 1 | 2 | 3 {
  if (letters < 3) return letters;
  return ([3, 1, 2] as const)[Math.floor((f - F3) / WORLD_LENGTH) % 3];
}
/** 1 for the first time round; 2 from the first return to world 1; and so on. */
export function lapAt(f: number, F3: number): number {
  return f < F3 + WORLD_LENGTH ? 1 : 2 + Math.floor((f - F3 - WORLD_LENGTH) / (3 * WORLD_LENGTH));
}
```

*With today's numbers (two letters from fence 6, three from fence 17):*

| Fences | World | Lap | The gate before it |
|---|---|---|---|
| 1 to 5 | 1: his own farm | 1 | (the opening) |
| 6 to 16 | 2: the farm lifts off | 1 | Gate 1, the farm gate |
| 17 to 31 | 3: under the quilt | 1 | Gate 2, the foot of his bed |
| 32 to 46 | 1 | 2 | Gate 3, the head of his bed |
| 47 to 61 | 2 | 2 | Gate 1 |
| 62 to 76 | 3 | 2 | Gate 2 |
| 77 to 91 | 1 | 3 | Gate 3 |

Do not hard-code 6 or 17: read the letter count from the game.

**What a new lap changes.** The same world should not look like a replay. From lap 2 on, each world's strip starts `32 m × (lap − 1)` further along (so on lap 2 the sheep meets the farmhouse where it met the barn before), and the bulbs' chase runs the other way on even laps. Colours never change by lap.

**Gates** are in file 07. A gate stands 3.0 m before the first fence of the world it opens.

## 6. Milestones

| When | What happens |
|---|---|
| Every 10 sheep (10, 20, 30, …) | **The moon show** (file 07, section 5): the moon swells and the last ten sheep you counted hop across it. That sheep's count pops up in gold at 1.6 times its size |
| 30 | Also the card "Zzz… / He's out cold" and his deeper pose, as today |
| The first sheep past your best | "New best" (section 4) |

There is no card for the moon show: the moon is the message.

## 7. Wording

Add French for each new line, matching in meaning, and list them in the pull request for Brian to check.

| Before | After |
|---|---|
| "4 of 30" (counter) | "4", with the tab "Best 32" or "New best" under it |
| "Nearly out cold" / "Five fences to go" | Removed |
| "Fence 4 of 30" (results) | Removed. The count on the pocket says it |
| "Asleep after 30 fences" (results, drifted off) | "Fast asleep from sheep 30" |
| "best 1" (results, streak row) | "Longest: 1" |
| Gate cards after the first lap | "Dreaming…" / "The farm lifts off"; "Deep dream" / "Under the quilt"; "He turns over" / "Back to the farm" |

On the first lap the gate cards keep their second lines "Two letters now" and "Three letters now", because the rule really changes there.

**New text:** "Best", "New best", "Longest:", "Fast asleep from sheep 30", "The farm lifts off", "Under the quilt", "He turns over", "Back to the farm".

If the shared text of a night says "of 30" or "Fence", change it to the count alone ("32 sheep") and, when it is a new best, add "a new best".

## 8. Checks for this file

1. Unit tests for `worldAt` and `lapAt` with the table of section 5, and with other letter boundaries (for example two letters from fence 4, three from fence 9).
2. A test of the best score: hidden at 0; "Best N" otherwise; "New best" exactly at the first count above it; saved once, at the end; a practice run never changes `bestSheep`.
3. A search of the built strings: no "of 30", "/30", "Five fences" or "Fence" followed by a number.
4. The recorded night of version 2's check 2 still gives the same record to the millisecond: this file changes what is shown, never what happens.
5. Screenshots at 1440 x 900 and 390 x 844: the top bar at count 0 (no tab), at 8 with "Best 32", and at 33 with "New best".
