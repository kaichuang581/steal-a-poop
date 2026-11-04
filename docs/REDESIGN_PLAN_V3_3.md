# Finish the Word v3.3 for Claude Code: cuter sheep, game length settings, speaker camera

Version 3.3, 3 November 2026. Addendum to v3, v3.1 and v3.2. The v1 guardrails still apply with one more approved engine change: the game settings in Part 2. Three milestones: **S** (sheep), **G** (settings, engine + start screen), **C** (speaker camera).

---

## 0. For Brian
Save as `docs/REDESIGN_PLAN_V3_3.md` and add the Part 1 block to `CLAUDE.md`. Run G first (one engine commit, review the diff), then S, then C.
```
Read @docs/REDESIGN_PLAN.md (Parts 1 to 4), @docs/REDESIGN_PLAN_V3.md (Parts 4, 5, 8), @docs/REDESIGN_PLAN_V3_2.md (Part 2) and @docs/REDESIGN_PLAN_V3_3.md. Do Milestone G exactly as specified: the settings object, defaults, presets, tests and the Set-the-table form. Report file by file.
```

---

## 1. Guardrail addition (append to CLAUDE.md)
```markdown
- v3.3 Part 2 (game settings) is an approved engine change: one commit, the files DISCOVERY.md names plus the
  constants file and a new test file. Default settings must reproduce today's behaviour exactly.
```

---

## 2. Milestone G: game length settings (engine + start screen)

### 2.1 Why
A standard game is 3 rounds × 5 turns × up to 10 sheep × 10 seconds, about 25 minutes. Players should pick the length, as Krillion lets them.

### 2.2 The settings object
```ts
export interface GameSettings {
  rounds: 1 | 2 | 3 | 5;              // default 3
  turnsPerRound: 3 | 5 | 7;           // default 5
  turnSeconds: 5 | 8 | 10 | 15;       // default 10; the existing shrink rule (−1 s per 10 pile points, floor 5 s) still applies; floor stays 5 s
  lives: 1 | 2 | 3 | 5 | 'unlimited'; // default 3 (v3 Part 2); 'unlimited' never freezes anyone
  twists: boolean;                    // default true; false means no round twist
  stealWindowSeconds: 0 | 3 | 5;      // default 3; 0 disables stealing
  botCount: number;                   // existing control, 3..7 (or whatever the engine supports today)
  botDifficulty: 'easy' | 'medium' | 'hard'; // existing
}
```
All scoring, penalties, traps, the chain rule and the word list are untouched. Every setting is read from this object where a constant is read today; nothing else changes. `DEFAULT_SETTINGS` equals today's rules, so an unchanged engine test suite must pass with it.

### 2.3 Presets (shown as the first choice; "Custom" opens the full list)
| Preset | rounds × turns | turn | lives | twists | steal | Approximate length with 4 bots |
|---|---|---|---|---|---|---|
| Quick | 1 × 5 | 8 s | 2 | on | 3 s | 3 to 4 minutes |
| Standard (default) | 3 × 5 | 10 s | 3 | on | 3 s | 10 to 12 minutes |
| Long | 5 × 7 | 12 s* | 5 | on | 5 s | 30 minutes and up |
| Custom | any | any | any | any | any | computed |
\* 12 is not in the list above; add it: `turnSeconds: 5 | 8 | 10 | 12 | 15`.

Length estimate shown live in the form: `rounds × turnsPerRound × (botCount + 1) × (turnSeconds × 0.7 + 2) seconds`, rounded to the nearest minute, labelled "about N min".

### 2.4 Where each mode gets its settings
| Mode | Settings |
|---|---|
| Quick Game | chosen in Set the table (Part 2.6); remembered in localStorage as the last choice |
| Daily Table | fixed by the daily seed (today: Standard), the same for everyone; the form is not shown |
| Practice | its own fixed settings as today (25 s, no penalties, no lives, easy bots) |
| Tutorial | scripted, unchanged |
| Rooms (later) | the host picks a preset; shown to everyone in the lobby |

### 2.5 Tests
1. `DEFAULT_SETTINGS` reproduces the current behaviour: the full existing suite passes with it and no test is edited.
2. `rounds: 1` ends the game after one round; `turnsPerRound: 3` gives three turns per player per round.
3. `turnSeconds: 15` with a 0 pile gives a 15-second turn; with a 60 pile gives 9 seconds; the floor stays 5.
4. `lives: 'unlimited'`: 10 time-outs never freeze a player; `lives: 1`: one time-out freezes.
5. `twists: false`: no twist is drawn in any round. `stealWindowSeconds: 0`: a steal attempt is rejected; `5`: the window opens at 5 s.
6. Daily Table ignores the form and uses the daily settings; Practice is unaffected by the form.
7. The length estimate function returns 3 to 4 minutes for Quick with 4 bots and 10 to 12 for Standard.

### 2.6 Set the table (the v3.1 step 2 form, extended)
Order on the card: your name; a preset row (Quick, Standard, Long, Custom) as wooden toggle chips; "about N min" under it; sheep count and bot difficulty as before; a "Custom" accordion with the six settings as chips (rounds, turns per round, seconds per turn, lives, twists on/off, steal window); the Sit down button. Choosing a preset sets all chips; changing any chip switches the preset to Custom. The last choice is restored next visit.

---

## 3. Milestone S: the sheep, redesigned to be cute

### 3.1 Why the current sheep reads as ugly
- The face is a flat black box with the eyes set in the middle and no cheeks, so there is no expression; dark on dark hides the mouth and nose.
- The wool is one lumpy ball of high-frequency noise, so it reads as static rather than fleece.
- Head and body are the same size and there is no neck or shoulders; nothing has a silhouette.
- Nothing moves except a bob; cute characters are mostly animation.

### 3.2 The cute formula (apply exactly)
- Proportions: head sphere 0.52 m across; body 0.62 m wide × 0.52 m tall × 0.74 m long; legs 0.14 m; head-to-body ratio about 1 : 1.2 (chibi). Total height 1.05 m.
- Face: a warm light grey (#B9B0AC light, #A79E9A mid, #8E8582 dark), not black, so features read; a darker muzzle patch (#6F6764) 0.22 m wide; eyes are 0.16 m tall ovals set at 58% of head height and 0.14 m apart (wide and low), white with a large dark iris (#2B2522) and a 2-voxel catchlight at the upper left; eyelids as a soft 1-voxel curve; brows as short bars that tilt for emotions; a 0.05 m pink nose (#E79C94) with two nostrils; a small 5-voxel mouth; round pink cheeks (#F2B6B0) 0.10 m across; ears 0.18 m long with pink inner faces, sticking out sideways and drooping 20°.
- Wool: large, smooth lobes rather than noise. Body: 7 lobes (ellipsoids 0.30 to 0.38 m), noise 0.04; a wool hood of 5 lobes around the face leaving the face clear, plus a small top tuft of 3 lobes; a 2-lobe tail. Two cream tones only (#FAF6EC, #EFE8D7) placed by lobe, with the third tone (#DDD3BE) only in the creases between lobes; no per-voxel noise.
- Legs and hooves short and stubby (0.12 m square), dark warm grey with lighter hooves; feet splayed slightly.
- Collar: a thin red band with a brass bell; one of the customisation slots.
- Silhouette test: at 64 px tall the sheep must still read as head + cloud + four stubs. If the head merges with the body, enlarge the head and shrink the body.

### 3.3 Animation (what makes it cute)
| Behaviour | Spec |
|---|---|
| Idle | breathing in the body lobes ±2.5%, head sway 0.05 rad, blink every 3.5 to 5 s (random), ear twitch every 7 s, a chew every 12 s (mouth 4 frames) |
| Attention | all sheep turn their heads toward the current speaker (yaw up to 0.6 rad); the speaker looks at the camera |
| Speaker idle | the speaker stands 0.35 m forward, chest up, tail wags |
| Happy (bank) | hop ×2, eyes closed in an arc, mouth smile, bell ring |
| Proud (8+ letters) | chin up, chest puff +6%, one slow blink |
| Startled (stolen) | jump, eyes wide, brows up, ears back, mouth small "o" |
| Cold (sheared, time-out) | hunch, shiver, brows worried, breath puffs |
| Thinking (bot turn) | head tilt 0.15 rad, one ear up, a wool-ball thought bubble (HTML, "…") |
| Sleeping | eyes closed, slow breathing |

All blends are 150 to 250 ms with `--ease-out`; no state is a cut.

### 3.4 Acceptance
- A side-by-side screenshot of old and new at 400 px; new passes the 64 px silhouette test.
- Faces are lighter than the muzzle, eyes are the largest feature, cheeks visible.
- Wool lobes count 7 + 5 + 3 + 2; no per-voxel noise on wool.
- All nine behaviours run from one `useFrame`; the attention turn follows the speaker in every mode.

---

## 4. Milestone C: the speaker camera

### 4.1 Behaviour
- At every turn start the camera moves to frame the current speaker, then holds. Positions are on a circle of radius 7.6 m around the pile at height 3.4 m, fov 36. For a speaker at ring angle θ (from v3.2), the camera sits at angle θ + 180° − 35° (so the sheep is seen three-quarter front, the pile at its left) and looks at a point 35% of the way from the speaker's head (0.95 m) toward the top of the pile. The letter board and the pile stay in frame at every seat.
- When it is your turn the camera goes to the home view of v3.2 (behind the pile, your sheep facing you).
- Transitions: 650 ms, ease in-out on a shallow arc (the camera does not cut through sheep; interpolate the angle, not the straight line). No camera motion starts during a steal window; a transition that would overlap it starts after the window closes. Reduced motion: a cut with a 150 ms fade.
- During the speaker's turn the camera drifts 0.05 m on a slow ellipse (off under reduced motion). On `stole` the camera returns to home for the wolf run; on `frozen` it stays on the frozen sheep for the full freeze sequence.
- Name tags: only the speaker's tag is shown large (name, flames, the word they are typing when it is a bot); other tags shrink to the name only. The "(you)" suffix appears once, in the card, not on the tag.

### 4.2 Acceptance
- Ten consecutive turns recorded: every transition is one smooth 650 ms move, the speaker is never cropped, the letter board and pile are always in frame, no move starts in a steal window.
- Home view returns on your turn; the wolf run is always seen from home.
