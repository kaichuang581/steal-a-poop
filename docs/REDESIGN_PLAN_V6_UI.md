# Finish the Word v6 for Claude Code: the farm kit, and every screen rebuilt from it

Version 6.0, 7 November 2026. A plan for the user interface only: every chip, card, button, dialog, tag, sign and results screen in the painted skin. The scenes, the animals, the rules and the dream's world stay as v3 to v5.1 left them, except where a sign moves into the world (Part 5). The v1 guardrails apply. Six milestones: **U0** (audit), **U1** (the kit), **U2** (Home, dialogs, settings), **U3** (the table and the practice duel), **U4** (Counting Sheep: HUD, fence signs, the results scene), **U5** (sweep and sign-off).

Written against `main` at commit 4dce7f7 (7 November 2026). File and class names below are that commit's.

---

## 0. For Brian

Save as `docs/REDESIGN_PLAN_V6_UI.md`, add the Part 1 block to `CLAUDE.md`, and paste:

```
Read @docs/REDESIGN_PLAN.md (Parts 1 to 4) and @docs/REDESIGN_PLAN_V6_UI.md in full. Do Milestone U0 exactly as specified: write src/skin/audit/uiAudit.ts and its test, run it, and write docs/skin/UI_AUDIT.md with every surface in the painted skin, what it looks like now, the audit's findings for it, and the Part 4 material it becomes. Take the before contact sheets. Change no component. Stop there.
```

Then U1 to U5, one per session (Part 8), each ending with the audit at the number Part 7 requires and the contact sheets attached.

---

## 1. Guardrail addition (append to CLAUDE.md)

```markdown
- The farm kit (approved by Brian, 2026-11-07): docs/REDESIGN_PLAN_V6_UI.md. Every surface in the painted skin is one of the
  kit's materials (V6 Part 4): plank, paper, tile, slate, burlap, knit, rope, brass, peg, lever, ice, clipboard, panel.
  No surface is a shape: no gradient used as a colour (gradients exist only inside kit materials, as grain, weave or
  chalk), no rounded corner over 4 px except pegs, pins, ice and the slate's inner edge, no blur-only shadow, no emoji
  as an icon, no Tailwind colour, radius or shadow utility in src/skin. The audit in src/skin/audit runs with
  `npm test` against a budget that only goes down; a screen with a non-kit surface is not done. A sign that is read
  every turn (the letter over the table, the dream's fence signs, the sheep's name stakes) is a voxel object anchored
  in the scene (V6 Part 5), never an HTML box floating over it. src/skin/hunt keeps its handheld-console look.
```

---

## 2. What is wrong, in one rule

The game's world is built from things: planks, snow, rope, paper, wool, brass, ice. Much of its interface is built from shapes: a rounded rectangle, a soft gradient, a blurred shadow. The four screenshots from 7 November are the pattern, not exceptions:

| Seen | What it is in the code | What it becomes |
|---|---|---|
| The dream's results screen: a navy page, the farmer small at the bottom-left, a card with buttons | `DreamScreen.tsx` on `phase === 'results'`: the dream meshes hide, `NightFade` paints the sky dark, `.sk-results-backdrop` dims the rest, the bedroom stays at its dream-time size in the corner, and a `.sk-tally` card floats in the middle | the farmer's bedroom fills the frame, walls and window and beam appear, the camera comes down to the bed, and the results hang from the beam on a plank; the count on a chalk slate; the streak as knitted stitches; the Warm Blankets folded at the foot of the bed (Part 6.4) |
| "The Fleece Navidad update · v0.3", a red gradient rectangle over the farm | `.sk-update` in `TitleBoard.tsx`: `linear-gradient(180deg, #C8342E, #9C2A25)`, radius 4 px, rotated 2° | a small barn-red painted plank on two nails with hand lettering and a snow cap, nailed to the title plank's end (Part 6.1) |
| "starts with V", a cream tile floating on the barn wall | `.sk-letter-card` in `BarnTable.tsx`, projected under the carved letter board every frame; the letter is already carved on the voxel board above it, so the card repeats it | the card goes; a small chalk slate with the seconds hangs under the board instead (Part 5.2) |
| "Hazel" with two wool balls and a caret, a cream pill with an orange ring | the speaker's `label` in `PaintedGame.tsx`, an `.sk-chip` (radius 999 px, `--shadow-warm`) hung beside the sheep by drei `Html` | a wooden name stake planted in the hay at the seat, a paper slip pinned to it for the name and the wool, a second slip for what the sheep is typing (Part 5.3) |

The rule for everything that follows: **every surface is an object the farmer could own.** If nobody can say what a thing is made of, it is not finished.

Two things already do this well and are the kit's models: the title board (`.sk-title-plank`, the hanging W·O·R·D tiles on their ropes, `SnowCap`, `.sk-nail`) and the voxel letter board over the pile (`letterBoardGeometry` in `src/skin/voxel/table.ts`). Everything else is brought up to them.

---

## 3. Milestone U0: the audit

### 3.1 The scanner: `src/skin/audit/uiAudit.ts`

A pure function `audit(root = 'src/skin'): Finding[]` that reads every `.css` and `.tsx` under `src/skin` (not `src/skin/hunt`, decision 9.3) and reports, with file and line:

1. **gradient**: any `linear-gradient(`, `radial-gradient(`, `conic-gradient(` or their `repeating-` forms, in a CSS rule whose selector list does not contain `.kit-`, or in a TSX `style=` string or template.
2. **radius**: any `border-radius` whose largest length is over 4 px (`999px`, `50%` and `9999px` count as over), outside `.kit-peg`, `.kit-pin`, `.kit-ice`, `.kit-slate-face` and `.kit-rope`; and any Tailwind `rounded`, `rounded-*` in a `className`.
3. **shadow**: any `box-shadow` or `filter: drop-shadow` whose every non-inset term has zero x and y offset and a blur over 0 (a blur-only shadow), outside `.kit-`; ring terms (`0 0 0 Npx`) are not shadows and pass.
4. **utility**: Tailwind colour and shadow utilities in a `className`: `bg-`, `text-`, `border-`, `from-`, `to-`, `via-` followed by a palette name and a number, and `shadow`, `shadow-*` (layout utilities such as `flex`, `p-2`, `gap-1`, `absolute` are fine and stay).
5. **emoji**: any character matching `\p{Extended_Pictographic}` in JSX text or a string literal in `src/skin`, including the `✓` and `…` used as glyphs in `dream.css` and `Sheep.tsx` (the ellipsis in the thought bubble becomes three wool tufts, Part 5.3).
6. **font**: any `font-family` or `font:` in `src/skin` that is not one of the three tokens, and `system-ui` in `src/skin/share/card.ts`.

Allow-list: `src/skin/audit/allow.json`, an array of `{ file, selectorOrLine, reason }`. The deliberate exceptions are listed in Part 4.12 and nothing else may be added without a reason that names a Part of this plan.

Budget: `src/skin/audit/budget.json`, `{ gradient, radius, shadow, utility, emoji, font }` counts. The test `src/skin/__tests__/uiAudit.test.ts` fails when any count exceeds its budget and prints the findings table; each milestone lowers the budget to its new count and commits it, so a number can only go down. U0 sets the budget to today's counts. U5 sets every count to 0.

A second export, `surfaces(): SurfaceRow[]`, lists every CSS class in `src/skin` whose rule sets a `background`, `border` or `box-shadow`, with its file, so the audit document can be built from it.

### 3.2 The document: `docs/skin/UI_AUDIT.md`

One row per surface in the painted skin: where it is (screen and component), what it looks like now (one line), the scanner's findings for it, the Part 4 material it becomes and the Part 6 section that specifies it. The list below is the starting inventory; U0 confirms it against the code and adds what it missed.

| Surface (class or component) | Where | Now | Becomes |
|---|---|---|---|
| `.sk-paper`, `PaperPanel` | everywhere | flat cream, uneven radius, soft shadow | `Paper` (4.2) or `Clipboard` (4.9) |
| `.sk-chip`, `Chip` | HUD corners, round chip, dream chips, hint words | 999 px cream pill | `Patch` (4.5); icon chips `Peg` (4.8) |
| `.sk-icon-chip` | HUD corner buttons | pill with inset shadow | `Peg` |
| `.sk-btn.sk-wood / .sk-cloth / .sk-coral` | buttons | flat colour, 12 px radius, 3 px drop | `WoodButton` (kept, re-cut: 3 px radius, grain), `ClothButton` (stitched cloth on wood), `CoralButton` retired (4.8) |
| `.sk-tile` | classic letter tile fallback | wood, 16 px radius | `Tile` (4.3) |
| `.sk-update` | title board | red gradient box | `Board label tone=barn` (6.1) |
| `.sk-home .sk-plate` | Home name plate | 999 px cream gradient pill | `Board label` name plate (6.1) |
| `.sk-home .sk-icon-btn` | Home corner buttons | cream radial-gradient discs | `Peg` (the base `.sk-icon-btn` log-end recipe, kept) |
| `.sk-menu-primary` | Play sign | painted green board, framed, snow | kept, as `Board painted tone=green` |
| `.sk-home .sk-menu-board .sk-menu-item[data-active]` | focused menu row | cream felt patch with stitching | `Patch tone=cream` (kept recipe) |
| `.sk-soft-tag`, `MenuTag` | menu badges, streak | 999 px tinted pills | `Paper tag` (4.2) |
| `.sk-menu-badge` | menu badge (non-home) | paper tag with punched hole | kept, becomes `Paper tag` |
| `.sk-key` | key prompts | paper keycaps, 7 px radius | `Tile mini` |
| `.sk-setup`, `.sk-setup-head`, `.sk-setup-back`, `.sk-sit` | table setup, practice setup | paper card, green gradient button | `Clipboard`; `Sit down` and `Start run` as `Board painted tone=green` buttons |
| `.sk-sheet`, `.sk-sheet-head`, `.sk-sheet-body` | rules, chain, chat sheets | paper with wooden header, 18 px radius, candy stripe | `Clipboard` |
| `.sk-guide*`, `PaintedGuide` | How to Play | paper, 18 px radius, tab buttons, tinted rounded rows | `Clipboard` with index tabs; rows as ruled lines |
| `.sk-rule-row`, `.sk-chain-list li`, `.sk-guide-basic`, `.sk-guide-faq`, `.sk-guide-art` | inside sheets | tinted rounded rows | ruled paper rows, art in a pencil frame |
| `.sk-mini-tile` | chain list, rules | small wood tiles, gradient | `Tile mini` |
| `PaintedSettings` rows | settings | `rounded-xl` rows on `--paper-edge`, range input | `Panel` of planks with `Lever` and `RopeSlider` (6.2) |
| `AdminPanel`, `.sk-field` | admin | paper panel, white field | small `Panel` with hasp, paper line field |
| `LegalDialog`, `FeedbackDialog`, `PaintedCredits`, `RulesCard`, leave dialog | dialogs | paper panels | `Clipboard` |
| `.sk-avatar-choice` | avatar picker | translucent white rounded cells | framed portraits (`Board light` frames on nails) |
| `.classic-panel` overrides | rooms, lobby, account | dark gradient frame, 18 px radius | `Panel` |
| `.sk-letter-card*` | over the pile | cream gradient card, 14 px radius | removed; `Slate mini` for the seconds (5.2) |
| speaker `label` chips | beside each sheep | `.sk-chip` pills | name stakes with slips (5.3) |
| `.sk-think` | bot thinking | paper disc bubble with "…" | three pixel wool tufts, no disc |
| `PlayerCard` | scoreboard column | paper cards, 200 px | the barn ledger, a `Slate board` (6.3) |
| `.sk-input-bar`, `.sk-input-letter`, `.sk-type-tile`, `.sk-input-placeholder` | word bar | paper gradient bar, 18 px radius; gradient tiles | wooden trough with `Tile`s (6.3) |
| `.sk-notice*`, `Notice` | boards over the table and the dream | wood boards, snow, nails | kept, recipe moves to `Board heading` |
| `.sk-alarm*`, `Alarm` | alarms | hazard plank | kept, recipe moves to `Board alarm` |
| `TwistSign` | twist | board on a post | kept |
| `.sk-tally*`, `TallyBoard` | round tally, game end, dream results | wood board; `.sk-paper` rows and stat tiles inside | `Board panel` with `Slate board` rows and `Slate plaque` stats (6.3, 6.4) |
| `RunOver` | practice end | paper panel | `Board panel` (6.3) |
| `.sk-steal-banner`, `.sk-steal-call` | unused | gradients | deleted |
| `.dr-fence-tile`, `.dr-fence-tiles` | dream word bar | gradient tiles on a dashed divider | `Tile hung` on a rope (5.4) |
| `.dr-tag` | over a cleared fence | 999 px paper pill | `Paper slip` (5.1) |
| `.dr-night`, `.dr-nights` | streak calendar | circles | `Knit stitches` (4.6) |
| dream HUD `.sk-chip`s | dream | pills | `Patch` and `Slate plaque` (6.4) |
| `signPost`, `signRim`, `signLetters` | dream world | flat slab, proud letters, cream rim | the fence sign (5.1) |
| `src/skin/share/card.ts` | share image | flat fills, system font | the kit's plank and slate, Fraunces (6.4) |
| "Loading the word list…", "Raising the barn…" | loading | `.sk-paper` | `Paper slip` on a nail |

Not surfaces, and kept: the washes (`.sk-wash-left`, `.sk-wash-bottom`), the vignette over the table, `.sk-results-backdrop` (the barn dimming), the aurora, the dream sky, `.sk-garland`, the bomb's flame and `.sk-boom`, the jumpscare, the swoop and barn-door transitions, the word burst's light. These are light and air, and the allow-list names them.

### 3.3 Before contact sheets

`docs/skin/ui-v6/before/`: every screen state at 1920 × 1080 and 390 × 844: Home (tables step, setup step, practice step, each dialog open), the table (your turn, a bot's turn, the steal window, a trap letter, the round tally, the end board, the leave dialog, each sheet), the practice duel (running, run over), Counting Sheep (ready, running with a fence in the type window, a cleared fence, the bump, results), the rooms screen if reachable. Playwright, the painted build, `?pov=0` on Home, a fixed seed.

---

## 4. The farm kit (Milestone U1)

Everything in `src/skin/kit/` (one file per material, `index.ts`), recipes in `src/skin/styles/kit.css` (imported by `skin.css` right after `tokens.css`), shown together on `?preview=kit` (every material in every size and state, on the paper, on wood and on the dream's violet). `Materials.tsx` re-exports the kit's `WoodButton`, `ClothButton`, `Chip` (now a `Patch`) and `PaperPanel` (now `Paper`) under their old names, so call sites can migrate screen by screen. The existing good pieces move into the kit rather than being duplicated: `TitleBoard`, `SnowCap`, `.sk-nail`, `.sk-title-rope`, `.sk-icon-btn`'s log-end recipe, `Notice`, `Alarm`, `PixelIcons`, `Icons`, `SheepIcon`, `Lives`.

### 4.1 Plank: `<Board>`

A sawn plank: cut, not rounded.

- Props: `size: 'title' | 'heading' | 'label' | 'post' | 'panel' | 'alarm'`, `tone: 'wood' | 'light' | 'barn' | 'green'`, `hang: 'nails' | 'ropes' | 'none'`, `snow?: boolean`, `lit?: boolean` (a lantern ring), `swing?: boolean`.
- Face: `--wood-dark` for `wood`, `--tile` for `light` (boards with a lot of writing), `#A6453A` for `barn`, the Play sign's green for `green`; grain `repeating-linear-gradient(94deg, rgba(255,230,190,0.10) 0 1px, transparent 1px 7px, rgba(40,24,10,0.12) 7px 8px, transparent 8px 19px)` over the face colour (on `barn` and `green` the grain shows through the paint at 25%); one knot per board, an inline SVG of two concentric ellipses at 6% opacity, placed from a seed off the board's `id` so no two boards match.
- Edge: `box-shadow: inset 0 3px 0 <light edge>, inset 0 -4px 0 <dark edge>, inset 3px 0 0 <side>, inset -3px 0 0 <far side>`; the outer 6 px at each end two shades darker (end grain, a pseudo-element); `border-radius: 3px`.
- Drop: `0 6px 0 rgba(40,24,10,0.35), 0 10px 18px rgba(40,24,10,0.25)`. A physical object may cast a soft shadow under a hard one; a surface may not have only the soft one.
- Hangers: `nails` puts `.kit-nail` (the existing `.sk-nail` recipe) at the top corners; `ropes` draws two `.kit-rope` lines from the board's top edge to a point `--hang: 40px` above, each with a knot (a 7 px dark ring) at the board; `snow` adds `SnowCap` with icicles; indoors (the bedroom) `snow` is off.
- Text: Fraunces 700 to 800 in `--button-text` with the carved shadow `0 -2px 0 rgba(40,24,10,0.75), 0 1px 0 rgba(255,220,170,0.35)` (the title's); `light` boards write in `--wood-ink` with `0 1px 0 rgba(255,240,210,0.6)`.
- Sizes: `title` (the existing title plank), `heading` (56 px tall, the `Notice` and turn-call boards), `label` (36 px, the update badge, name plates), `post` (a vertical plank on a stake, the twist sign), `panel` (a wide board for the tally and results, with `Paper sheet` pinned on it when there is a paragraph to read), `alarm` (the hazard-striped plank, the existing `.sk-alarm` recipe).
- Motion: a hung board swings in from above (`rotateX(-12deg)` at the hangers, `transform-origin: 50% 0`) over 300 ms `--ease-out` with one 4% overshoot; `swing` adds the title's ±1.5° sway at 0.2 Hz; under reduced motion both are a fade.

### 4.2 Paper: `<Paper>`

Cream paper with a cut edge, pinned or strung.

- Props: `kind: 'slip' | 'note' | 'sheet' | 'ticket' | 'tag'`, `pin: 'top' | 'corner' | 'none'`, `string?: boolean`, `seed?: number`, `tilt?: boolean`.
- Face: `--paper`, with a texture: a data-URI SVG `feTurbulence` (baseFrequency 0.9, 2 octaves) at 6% opacity as `background-image`, never as `filter`; `--ink` text; ruled lines (`repeating-linear-gradient(0deg, transparent 0 27px, rgba(59,48,40,0.12) 27px 28px)`) on `sheet` and `note`.
- Edge: a torn outline from one of four `clip-path` polygons (`--paper-edge-1..4`, 14 to 20 points with ±3 px jitter, generated once in `paperEdges.ts`), chosen by `seed`; no `border-radius` (the `--radius-paper` token is retired at U5).
- Pin: a 12 px brass disc (`.kit-pin`: radial highlight, a 1 px dark rim, a 1 px shadow) at the top centre or the top-left corner; `string` draws a 2 px `.kit-string` up to a `.kit-nail` 24 px above. `tilt` rotates −1.5° to +1.5° by seed.
- Shadow: hard, `2px 3px 0 rgba(59,48,40,0.22)`; no blur.
- Kinds: `slip` (one line, Patrick Hand 16 to 18 px, 6 px 10 px padding), `note` (a few lines, Patrick Hand 16 px), `sheet` (long text, Nunito 15 px, lives on a `Clipboard`), `ticket` (the menu's tickets: a perforated left edge, a stub with the mode's pixel icon, the caption in Patrick Hand), `tag` (a hang tag: the `.sk-menu-badge` shape with its punched hole, tinted by `tone: 'gold' | 'green' | 'gray' | 'flame'` as a paper tint, never a gradient, Nunito 900 11 px uppercase).
- Interactive paper lifts 2 px on hover (shadow 3 px 4 px) and drops 1 px on press.

### 4.3 Tile: `<Tile>`

A carved wooden letter tile, as the title's hanging W·O·R·D.

- Props: `size: 'mini' | 'sm' | 'md' | 'lg'` (20, 34, 46, 64 px), `hung?: boolean`, `lit?: boolean`, `trap?: boolean`, `done?: boolean`, `bad?: boolean`.
- Face: `--tile` with the title tile's grain (`repeating-linear-gradient(92deg, rgba(140,90,46,0.07) 0 2px, transparent 2px 9px)`), a lit top edge and a dark bottom lip (`inset 0 3px 0 rgba(255,240,210,0.6), inset 0 -4px 0 var(--wood)`), `border-radius: 3px`, drop `0 3px 0 rgba(40,24,10,0.35)`.
- Glyph: Fraunces 800 in `--wood-ink`, carved (`text-shadow: 0 2px 0 rgba(255,236,200,0.55), 0 -1px 0 rgba(40,24,10,0.6)`).
- `hung`: the title's rope and iron eye above (`.sk-title-rope`, moved to `.kit-tile-rope`); the tile drops onto the rope with `sk-title-hang`. `lit` (matched, active, the chain letter): the face goes `--glow`, the glyph `#7A3E12`, and a lantern ring `0 0 0 3px var(--amber), 0 0 14px var(--glow)`. `bad`: the face goes `--coral`, the glyph white, no ring. `trap`: the tile is an `Ice` block (4.10) with the glyph frozen inside. `done`: a chalk tick stamped at the top-right (a pixel icon, not a character).

### 4.4 Slate: `<Slate>`

A chalkboard in a wooden frame, for numbers and tallies.

- Props: `size: 'mini' | 'plaque' | 'board'`, `tone?: 'chalk' | 'coral' | 'amber'`.
- Slate `#2F3236` with chalk dust (the paper's turbulence lightened, at 8%); frame 6 px of `--wood-dark` with the plank's edge; square outer corners, `.kit-slate-face` with a 2 px inner radius; a chalk tray (a 4 px lighter plank) under `plaque` and `board`.
- Chalk: `#F3F0E6`, Fraunces 800 for numbers, Patrick Hand for words, `text-shadow: 0 0 1px rgba(243,240,230,0.55)`; `coral` and `amber` tones for the steal window and a best. A changed number gets a chalk underline doodle (an inline SVG stroke with jitter) for 600 ms.
- Sizes: `mini` (28 px tall, the seconds under the letter board), `plaque` (a count or a stat, 64 px), `board` (the tally and the barn ledger: rows of chalk writing, `.kit-slate-row`, with tally strokes `.kit-tally` for wool, a chalk circle `.kit-chalk-ring` round the speaker and a chalk strike `.kit-chalk-strike` through a frozen name).

### 4.5 Burlap patch: `<Patch>`

A stitched feed-sack patch, for chips, badges and the focused menu row.

- Props: `tone: 'burlap' | 'cream' | 'gold' | 'green' | 'gray' | 'flame'`, `icon?: ReactNode`, `pressed?: boolean`, `as?: 'span' | 'button'`.
- Face: `#C9B38A` (`burlap`) or the tone's cloth, with a weave (two crossed 1 px repeating gradients at 45° and −45°, 10% opacity); a stitched border `outline: 2px dashed #7A6A58; outline-offset: -5px`; a frayed edge from `clip-path` (`--burlap-edge-1..2`); `border-radius: 0`; shadow `1px 2px 0 rgba(59,48,40,0.25)`.
- Text: Patrick Hand 16 px `--ink` (`cream`, `burlap`) or Nunito 900 11 px uppercase for the small tones; an optional pixel icon at the left.
- `pressed` darkens the face 8% and turns the stitches `--amber`; `disabled` fades the stitches to 40%. The existing felt-patch recipe for the focused menu row (`.sk-home .sk-menu-board .sk-menu-item[data-active]`) becomes `tone=cream`.

### 4.6 Knit: `<Knit>`

A knitted band, for progress and the streak.

- Props: `a`, `b` (two tones; amber and cream by default; a species' KNIT tones where a species is shown), `height: 14 | 20`, `segments?: number`, `filled?: number`, `stitches?: ('played' | 'missed' | 'blanket' | 'repair' | 'today')[]`, `pom?: boolean`.
- Face: `repeating-linear-gradient(45deg, a 0 6px, b 6px 12px)` over `repeating-linear-gradient(-45deg, a 0 6px, b 6px 12px)` with `background-blend-mode: multiply`; a ribbed hem (1 px stripes) at both ends; `pom` adds a 16 px fuzzy disc (an SVG of 24 short radial strokes) at the end.
- `segments`/`filled`: progress, the empty segments in `--mist` tones at 60%. `stitches`: the seven nights as discrete V stitches 18 px wide: `played` an amber stitch, `missed` a dropped stitch (a gap with a loose loop), `blanket` a stitch with the blanket pixel icon over it, `repair` a stitch in a different cream, `today` ringed with the lantern ring.

### 4.7 Rope and string: `.kit-rope`, `.kit-string`

`repeating-linear-gradient(160deg, #C9A46E 0 2px, #7A5630 2px 4px)` (the title's twine) on a 4 px line (rope) or 2 px (string), `border-radius: 2px`; hangers, dividers, the streak's chain, the slider's track. A rope end gets a knot (a 7 px dark ring) when it meets wood.

### 4.8 Brass plate, wooden button, peg

- **`<Brass>`**: the primary action. `#C9A24A` with a vertical brushed texture (a 1 px repeating gradient at 8%), `inset 0 2px 0 #E9C97A, inset 0 -3px 0 #8F6D22`, four screw heads (`.kit-screw`, 5 px discs with a slot) at the corners, engraved text in `--wood-ink` (Fraunces 800) with a 1 px light highlight under it; `border-radius: 3px`; press: the plate sinks 2 px and darkens 6%. Minimum height 44 px.
- **`<WoodButton>`**: the existing `.sk-btn.sk-wood`, re-cut: grain, 3 px radius, the plank edge, `0 3px 0 var(--wood-ink)`; secondary actions. **`<ClothButton>`**: a patch of green cloth stitched onto a wooden button (the `Patch` stitch rim over `--cloth-dark`); the Play-again actions. **`<CoralButton>`**: retired; a red action is a `Brass` on a `barn` board, or the `Notice steal` board.
- **`<Peg>`**: a 44 px round wooden knob for icon buttons: the base `.sk-icon-btn` recipe (log end: rings, `--wood` to `--wood-dark`, a dark rim), the icon in `--button-text` (`--wood-ink` on the `light` variant); press: 2 px down. `aria-pressed` darkens it 15%. Used for close, settings, mute, help, account, avatar, the admin lock (which glows amber when unlocked, as now), the dream's leave button and the table's corner buttons.
- Focus: every control keeps the lantern ring `0 0 0 3px var(--amber)` on `:focus-visible`.

### 4.9 Clipboard, panel, lever, rope slider

- **`<Clipboard>`**: every dialog. A `Board light` 420 px wide (phones: full width minus 24 px, bottom-anchored) with a brass clip 96 px wide at the top (a `Brass` bar with a hinge line) holding a `Paper sheet`; the title in Fraunces 800 on the paper's first line, the close `Peg` at the top-right of the plank; the paper scrolls inside; optional `tabs` render as paper index tabs sticking out of the right edge (the selected one proud by 6 px, Nunito 800). Replaces `.sk-sheet`, `.sk-guide`, `PaperPanel` dialogs and `.sk-setup`.
- **`<Panel>`**: three to five vertical planks with 2 px gaps and a cross batten at the back, for settings, the admin box and the rooms/account frames. Each row sits on its own plank with a `Paper slip` for the label.
- **`<Lever>`**: a toggle: a 44 × 24 px wooden lever on a brass pivot; on = lever up and an amber lantern dot lit, off = lever down and the dot dark; `role="switch"`, keyboard as today.
- **`<RopeSlider>`**: the volume `input[type=range]` with a `.kit-rope` track and a wooden knob thumb (`appearance: none`, the thumb a 22 px `Peg`).

### 4.10 Ice: `.kit-ice`

Penalties, the trap letter, the steal window's edge and the frozen overlay: `rgba(217,238,248,0.78)` with a diagonal highlight streak, a 1 px white rim, two crack lines (an inline SVG, the existing `IceOverlay` cracks), `border-radius: 6px`, text in `--ink`.

### 4.11 Typography, colour, icons, edges, shadows, motion

- Fraunces for headings, numbers and anything carved or engraved; Patrick Hand for anything the farmer wrote (slips, captions, hints, chalk words); Nunito only for long reading on sheets and for the small uppercase tags. No other family anywhere in `src/skin`, including the share card.
- Colours come from `tokens.css`; the kit adds only its material tones named above, as tokens (`--slate`, `--chalk`, `--burlap`, `--brass`, `--brass-light`, `--brass-dark`, `--barn-paint`). The token comments' contrast ratios hold: ink on paper 11.7:1, button text on wood 5.3:1, chalk on slate 12:1, ink on burlap 7:1, wood-ink on brass 5:1.
- Icons: `PixelIcons`, `Icons`, `SheepIcon`, `Lives` and two new pixel icons, `ShareIcon` and `PinIcon`. No emoji and no typographic glyph used as an icon anywhere in the skin.
- Edges: cut (3 px) for wood, torn for paper, square for slate frames, frayed for burlap, round only for pegs, pins and knots.
- Shadows: wood casts a hard 6 px plus a soft 18 px; paper a hard 2 to 3 px; patches a hard 1 to 2 px; slates sit flush (frame only); nothing has a blur-only shadow or an inner glow, except the lantern ring and the ice highlight.
- Motion: objects hang, swing, lift and drop; nothing fades in from nowhere except under reduced motion. Boards swing in (4.1); papers slide down from their pin; tiles drop onto their rope; pegs press 2 px; chalk numbers get their underline. All within `--t-fast` with `--ease-out`.
- Performance: textures are static `background-image` data URIs; no `filter:` on an element that animates; no `backdrop-filter` in the kit.

### 4.12 The allow-list (the only exceptions)

The washes and the table's vignette; `.sk-results-backdrop`; `.sk-garland*`; the aurora and `.dr-root`'s backdrop colour; the bomb (`.sk-boom`, the fuse spark), the jumpscare and word blast; the swoop and barn-door transitions; the word burst's ring and tufts; the lantern ring and `--glow` rings on focused or matched things; the ice highlight; `SnowCap`'s gradient; the body's sky gradient behind the app; `src/skin/hunt/**` entirely.

### 4.13 `?preview=kit`

A page under `src/skin/kit/KitPreview.tsx`, mounted by `PaintedApp.tsx`'s `PREVIEW` switch beside `sheep`, `lineup` and `strips`: every material in every size, tone and state, laid out in rows on three backgrounds (paper, barn wood, the dream's violet), with each control focusable so the lantern ring is seen; `?motion=0` holds the entry animations at their end.

---

## 5. Signs that belong in the world (voxel, anchored)

Four signs are read every turn. They live in the scene, built on the voxel grids with letters from `paintGlyph` and `GLYPH` (`src/skin/voxel/table.ts`), rendered with the scene's materials, with HTML only for text that can be anything (names, typed words, the seconds).

### 5.1 The dream's fence signs (U4; replaces `signPost`, `signRim`, `signLetters` in `src/skin/dream/world.ts`)

What is wrong now: the board is a flat slab three voxels tall in one tone (`T.beam[0]`), the letters stick out of it one voxel proud in flat `#2A1E14`, the active sign gets a cream picture-frame rim, and nothing joins the board to its post.

The new sign, built by `fenceSign(letters)` returning `{ post, board, letters, lantern }` geometries:

- **Post and crossbar** (0.10 m grid, `T.beam` by `hash3`, light tone on +y and the camera-facing faces): the post 1 × 10 × 1 cells (1.0 m) at the fence's +x side as now (`0.215 + 0.3` m); a crossbar 6 × 1 × 1 cells (0.6 m) across the post's top, centred on it; a snow cap on the crossbar and the post top (`T.snow[0]` with gaps by `hash3`), one icicle (3 cells of `T.ice`) hanging from the crossbar's camera side.
- **Board** (one grid at `signCell(n)`, 0.04 m for one to four letters, 0.035 m for five, so the whole sign scales with its letters as `signWidth` already does): width = `n * GLYPH.w + (n - 1) * 2 + 6` cells, height = `GLYPH.h + 4` = 11 cells, **two cells thick**. Face colour `T.beam` light and mid tones by `hash3` in horizontal grain runs (the `y >> 1` trick of `woodTone` in `bedroom.ts`); a one-cell darker rim (`T.beam[2]`) all round the face; the top edge bevelled by leaving the rim's top-corner cells empty; two brass nail cells (`T.brass[1]`) at the face's top corners, one cell in from the rim; a snow cap one cell thick along the top with gaps by `hash3`.
- **The carved letters**: the glyph cells of the front layer are **left empty** in the board grid (a hole one cell deep), and the `letters` mesh is the glyph cells placed in the back layer's position, coloured by its own `MeshLambertMaterial` (`#2A1E14`), so each letter is a real recess: the board's own voxels are its walls, the ink voxel's front face is its floor. The mesher's baked AO darkens the recess walls for free. Letters are separated by one dark dot cell at row 3, as now. The glyph block is centred on the face with two cells of margin.
- **Hanging**: two rope cells (`T.hay[2]`, 1 × 2 cells each, at the board's grid) from the board's top corners up to the crossbar's underside; the board hangs 0.06 m below the crossbar, its centre at y = 0.78 m, so the letters stay at the height the dream camera was tuned for (`signLetters` centred them at 0.80 m).
- **States**: the active fence's post carries a small lantern on its camera side at y = 0.62 m: 2 × 3 × 2 cells of `T.lantern` (emissive `#FFC24B`, intensity 0.9 through a second material), with one `PointLight` (`#FFC24B`, intensity 0.8, distance 2.5, decay 2) parented to the active sign only, and the letters' material gains `emissive: '#5A3A10'`, so the active sign is the lit one from across the lane. A bounce for the `letters` reason flashes the recess `T.collar[0]` for 320 ms (as now, by `mat.color`). A cleared fence's recess turns `T.pine[0]` and the typed word appears as a kit `Paper slip` (`✓` becomes `CheckIcon`) anchored by drei `Html` 0.14 m above the crossbar, sliding down from a pin over 300 ms (a word can be sixteen letters; the slip's font shrinks from 16 px to 12 px past ten). The bumped fence's board swings 15° on its ropes for 1.2 s while the fence falls. The cream rim is deleted.
- **Wind**: the board swings ±1.5° on its ropes at 0.4 Hz (rotate the board and letters group about the crossbar); off under reduced motion.
- **Readability gate**: at 1920 × 1080 the glyph cap height on the nearest sign in the type window (`TYPE_X`) projects to at least 22 px (16 px at 390 × 844); the dev overlay (`?dev=1`, `DevStats.tsx`) prints the projected height. A screenshot at 400% shows the recess, the rim, the nails, the ropes and the snow.

### 5.2 The letter over the table (U3; `BarnTable.tsx`)

The voxel board (`LetterBoard`, `letterBoardGeometry`) already carves the letter 0.49 m tall and hangs from `BARN.beamY` on two ropes; the ice block already replaces it for a trap letter; the icicle beside it already shows the time. What is wrong is the HTML `.sk-letter-card` projected under it, repeating the letter on a cream gradient card.

- Delete `.sk-letter-card*` and the card's markup. The `clockEl` anchor (`Projection`, `BOARD.bottom - 0.22`) now carries a kit `Slate mini` with the seconds (`secondsLeft`, one decimal under 5 s, else whole), chalk `coral` tone in the steal window, hung from the board's bottom edge by two short `.kit-string`s; the `data-chain-tile`, `data-tour="chain"` and `aria-label` attributes move onto the slate so the tour and the tests still find them. The words "starts with" are dropped from the screen: the word bar's prompt line and the input's `aria-label` already say "a word starting with V".
- The board's two nail heads become brass (`T.brass[1]`), a one-cell darker rim is added round its face, and its bevel matches 5.1; the letter stays proud (carving a 0.49 m letter into a 0.08 m board would leave it 0.04 m thick, and the proud letter reads from every camera). Decision 9.5.
- Phone: the slate shrinks to 24 px and clamps inside the frame as the card does now.

### 5.3 Name stakes (U3; `BarnTable.tsx` seats, `PaintedGame.tsx` labels)

Replaces the `.sk-chip` labels hung by `Html` at `[±0.95, 0.75, 0]` in each `SeatGroup`.

- **The stake** (0.05 m grid, `stakeGeometry()` in `src/skin/voxel/props.ts`, built once and shared): a post 2 × 12 × 2 cells (0.1 × 0.6 m) of `T.beam`, planted in the hay at the seat's local (±0.95, 0, 0) (the side the label hangs on now), a plank 8 × 3 × 1 cells (0.4 × 0.15 × 0.05 m) across it with its centre at y = 0.5 m, its face toward the seat's camera side (the `rotation={[0, -p.yaw, 0]}` the label uses), two brass nail cells at the plank's top corners, a one-cell darker rim, and a snow cap one cell thick on the post top and the plank top with gaps by `hash3`. The admin's photo disc gets the same stake.
- **The slips** are HTML, anchored by drei `Html` (`center`, no `transform`, as now) at the plank's face: a kit `Paper slip` with the name in Fraunces 700 16 px, the wool balls (`Lives`, unchanged) after it, "(you)" in Patrick Hand, the `farm sheep` line in Patrick Hand 12 px under the name for bots, the difficulty's pixel icon after a bot's name. The speaker's slip is pinned (brass pin), scaled 1.15 and gets the lantern ring (coral in the steal window, as the chip does now); the others are strung from the plank's nail and sit at 0.9 opacity; a frozen sheep's slip is under `Ice`.
- **What a sheep is typing** (the bots' `botTyped` and, on your own stake, your typed word) is a second `Paper slip` under the first, Patrick Hand 20 px uppercase with letter spacing, a pencil-tick caret (a 2 px `--ink` line, the existing `.sk-caret` blink), sliding down from the first slip's pin over 200 ms and leaving the same way; a bounced try keeps `.sk-tag-reject` (the shake and the red).
- **The thought bubble** (`.sk-think`): the paper disc goes; the three dots become three small wool tufts (pixel `WoolBall`s at 8, 10 and 12 px) rising from behind the plank, with the same fade.
- Every `data-seat`, `data-seat-name`, `data-seat-word` and `data-tour` attribute that the player card carries today is carried by the slip (name, word) and the ledger row (6.3), so the tour and the tests still find them.

### 5.4 The dream word bar's tiles (U4; `DreamScreen.tsx`)

The fence's letters in the word bar (`.dr-fence-tiles`) become kit `Tile sm hung` elements hanging from a `.kit-rope` strung between two small `.kit-nail`s at the bar's left end; they drop onto the rope (`sk-title-hang`) when a fence enters the type window and are lifted off (reverse) when it is passed; a matched letter is `lit`, a bounce makes them all `bad` for 320 ms with the existing shake; the `✓` after-element becomes the `done` tick. The dashed divider goes; the rope's end knot separates the tiles from the typed word.

---

## 6. Screen by screen

### 6.1 Home (`PaintedHome.tsx`, `TitleBoard.tsx`, `GameMenu.tsx`; Milestone U2)

| Element | Now | Becomes |
|---|---|---|
| Title plank and hanging tiles | plank, tiles on ropes, snow, holly | kept; the recipes move to `Board title` and `Tile lg hung` |
| Update badge (`.sk-update`) | red gradient box, 4 px radius | `Board label tone=barn hang=nails snow`: barn-red paint with the grain through it, the text in Patrick Hand 18 px `--button-text` ("The Fleece Navidad update · v0.3", from `UPDATE_NAME` and `pkg.version` as now), two nails, a small snow cap, rotated 2°, nailed to the title plank's right end at the same offset; compact Home keeps it under the tagline, unrotated |
| Play sign (`.sk-menu-primary`) | painted green board, frame, snow, nails | kept as `Board painted tone=green`; its triangle disc stays |
| Menu rows (`.sk-menu-item`) | type over the wash | kept (type is not a surface) |
| Focused row | cream felt patch | `Patch tone=cream` (the existing recipe, in the kit) |
| Badges (`MenuTag`, `.sk-soft-tag`) | tinted pills | `Paper tag` hang tags with a hole and a 10 px string to the row's text baseline, tinted gold/green/gray/flame; the dream row's seven mini nights become `Knit stitches` 10 px |
| Captions | hand type | kept |
| Key prompts (`.sk-key`) | paper keycaps | `Tile mini` |
| Name plate (`.sk-home .sk-plate`) | cream gradient pill | `Board label hang=nails`: the avatar in a 34 px round wooden frame (a `Peg light` with the portrait) at the left, the name input over the plank in `--button-text` (the `.sk-plate-name` input stays an input; focus = lantern ring), the streak as a `Paper tag tone=flame` hung from the plank's right nail |
| Corner buttons (`.sk-home .sk-icon-btn`) | cream radial-gradient discs | `Peg`s (delete the `.sk-home .sk-icon-btn` override); the admin peg glows amber when unlocked; "Log in" becomes a small `WoodButton` |
| Footer links | type | kept; the version line stays type |
| Setup (`.sk-setup`, table and practice) | paper card, green gradient button | `Clipboard` 420 px: the title on the sheet's first line, Back as a `WoodButton` small on the plank; the name on a ruled paper line; the sheep count as a row of `Tile md` (the chosen one `lit`); difficulty as three `Patch`es with the seedling, leaf and acorn icons (chosen = `pressed`); presets as `Patch tone=burlap`; the length estimate and the practice clock on `Slate plaque`s; "Sit down" and "Start run" as `Board painted tone=green` buttons (the Play sign's little brother, with snow) |
| Errors and room notices (`.sk-paper` lines) | paper | `Paper note` pinned under the menu |
| How to Play, Credits, Legal, Feedback, Admin, the avatar picker | paper panels | `Clipboard`s (6.2) |

### 6.2 Dialogs, settings and the admin panel (U2)

- **`PaintedGuide`**: a `Clipboard` with index tabs (the tabs it has today) sticking out of the right edge; `.sk-guide-basic` rows become ruled paper rows with the art in a pencil-drawn frame (a 1 px `--ink-soft` rectangle with hand-drawn corners, an SVG); `.sk-guide-faq` becomes a ruled row with a pencil triangle for the `summary`.
- **The in-game `Sheet`** (rules, chain history, chat): a `Clipboard`; the chain list's rows are ruled lines with `Tile mini` letters; a steal row gets a red pencil line down the margin; the chat panel keeps its classic component inside a `Panel` frame with the ink card squared to 3 px.
- **`PaintedSettings`**: a `Panel` of planks under a nailed `Board heading` ("Settings"); each setting on its own plank: the label on a `Paper slip` at the left, a `Lever` for Sound, Reduce motion and Larger text, a `RopeSlider` for Volume, a `WoodButton` small for Replay tutorial and Show gameplay tips again (the check and reset icons as now), a `WoodButton` for Credits and licenses; the account panel's ink card is framed in a plank and squared. Close is the `Peg` at the top-right of the heading.
- **`AdminPanel`**: a small `Panel` with a brass hasp (a `Brass` bar with a `LockIcon`) across its top; the password `.sk-field` becomes a paper line (a `Paper slip` with a ruled bottom edge and a pencil caret); unlocked state as now.
- **`LegalDialog`, `FeedbackDialog`, `PaintedCredits`, `RulesCard`, the leave dialog**: `Clipboard`s; buttons `Brass` (confirm) and `WoodButton` (cancel); Leave is a `Brass` on a `barn` board, not coral.
- **Avatar picker**: the choices as six framed portraits (`Board light` 72 px frames on nails in two rows), the chosen one with the lantern ring; the admin photo as now.
- **Loading lines** ("Loading the word list…", "Raising the barn…"): a `Paper slip` on a nail.

### 6.3 The table and the practice duel (`PaintedGame.tsx`, `BarnTable.tsx`, `DuelTable.tsx`; Milestone U3)

| Element | Now | Becomes |
|---|---|---|
| The letter and the seconds | voxel board plus the `.sk-letter-card` | the board alone, with a `Slate mini` for the seconds (5.2) |
| Round chip (`.sk-chip sk-display`) | pill | `Patch tone=burlap` with the round and sheep count; the practice run's words and best on a `Slate plaque` |
| Twist sign | board on a post | kept (`Board post`) |
| Corner buttons (`.sk-icon-chip`) | pills | `Peg`s |
| Speaker label and the other sheep's chips | pills beside the sheep | name stakes with slips (5.3) |
| Scoreboard (`PlayerCard` column) | paper cards | **the barn ledger**: a `Slate board` hung from the right wall's top edge on two ropes (HTML, top-right, 220 px wide), one chalk row per sheep in standings order: the place, the avatar portrait 22 px, the name in chalk hand, the wool as tally strokes (full strokes for wool kept, rubbed-out strokes for wool lost), the last word in small chalk under the name; the speaker's name ringed in chalk; a frozen sheep's row struck through with an ice shard icon; a bot's row says "farm sheep" in small chalk. Phones: a horizontal strip of `Slate mini` rows (portrait, name, strokes). `data-seat`, `data-seat-name`, `data-seat-word`, `data-tour="me"` stay on the rows |
| Bot thought bubble | paper disc | wool tufts (5.3) |
| Word bar (`InputStrip`) | cream gradient bar, 18 px radius, gradient tiles | **a wooden trough**: a `Board light` ledge 76 px tall (64 on phones) with a raised front lip (a 6 px darker plank along the bottom) and end caps; the current letter as a `Tile lg` standing at the left end (`lit` on your turn); the typed word as `Tile md` pieces lying in the trough (the ghost input, the size steps and `data-first` ok/bad stay exactly as they are); the placeholder in Patrick Hand on a `Paper slip` lying in the trough; the caret the amber pencil tick; Pass and Hint as `Peg`s with their icons; Play as `Brass`; Steal as a `Brass` on a `barn` board with the `sk-halo` ring; the steal window turns the lip coral and frosts the slip's edge with `Ice`; `out` fades the trough to 60% as now; the accept flash keeps its gold ring. `data-tour="input"` and `data-tour="steal"` stay |
| Prompt line (`.sk-input-prompt`) | hand type over the scene | kept |
| Hint ideas row | paper card with pill chips | a `Paper note` with the ideas as `Tile mini` words |
| Message slips (`MessageSlip`), notices | paper, boards | `Paper note` pinned to the nearest post; `Notice` kept as `Board heading` |
| Alarm | hazard plank | kept (`Board alarm`) |
| Round tally and end board (`TallyBoard`) | wood board with `.sk-paper` rows and stat tiles | `Board panel hang=ropes snow` swinging in from above: the title carved on the plank; the standings on a `Slate board` set into the plank (rows as in the ledger, the winner's name ringed and the row under a lantern ring); the notes ("Longest word…", "You lasted to…", the best steal, the dream line) on one `Paper sheet` pinned under the slate; the stat tiles (Wool kept, Steals, Longest word) as three `Slate plaque`s in a row; the daily streak as `Knit stitches`; buttons: `Brass` Share, `ClothButton` Same table again, `WoodButton` Back to the farm / Leave room |
| Practice end (`RunOver`) | paper panel | `Board panel` with the score on a `Slate plaque` 96 px, the three stats as `Slate plaque`s, `ClothButton` Play again, `WoodButton` Back to the farm |
| Leave dialog and sheets | paper | `Clipboard` (6.2) |
| Bomb clock | kept | kept; the `MiniBomb` on the ledger row of the sheep on turn |
| Practice duel names (`sk-chip` + VS) | pills | two `Paper slip`s pinned to stakes frozen into the ice at each end (the 5.3 stake with an `Ice` collar at its foot), "VS" kept as carved type |
| Steal banner and call classes | unused | deleted |

### 6.4 Counting Sheep (`DreamScreen.tsx`, `DreamStage.tsx`, `bedroom.ts`, `stage.ts`; Milestone U4)

**HUD**: the night chip ("Tonight's dream · 7 Nov") a `Patch tone=burlap` with the moon pixel icon; the count a `Slate plaque` with the sheep icon, the count in chalk and "best 12" in small chalk; the leave button a `Peg`; the ready board and the Bump board stay `Notice` (now `Board heading`); the word bar a trough as 6.3 with "Jump" as `Brass` and the tiles on their rope (5.4); the caption line stays type; the bounce text stays in the caption (coral). The fence signs are 5.1.

**The results scene** (replaces the dimmed page and the floating card):

1. **The room appears in the dark beat.** `bedroom.ts` gains `bedroomRoom()`: a back wall of horizontal boards (`T.bedwood` tones in grain runs, 0.10 m grid) behind the bed at the bed's −z side, 3.4 m wide and 2.6 m tall, with a window 0.9 × 1.1 m cut in it over the bedside table, a cream curtain (`T.linen`) tied back at one side, and a moon disc (`BED.moon`, 0.10 m voxels, 0.5 m across) 6 m behind the window with four stars; a side wall at the headboard end with a coat hook and a hanging hat (`BED.cap` tones) and a small framed picture (a 6 × 5 voxel sheep in a `T.bedwood` frame); a ceiling beam 0.14 × 0.14 m across the room at y = 2.5 m, 0.4 m toward the camera from the bed's centre line, with a hook; floorboards extended to meet the walls. These meshes mount only when `L.crashAt !== null && since >= WAKE.dark` or `phase === 'results'` (the frame is at its darkest then: `NightFade` reaches 1 at `WAKE.pop + WAKE.popMs` = 1100 ms = `WAKE.dark`), so the walls never block the dream.
2. **Light.** On the same cue the bedroom group gets a warm `PointLight` at the candle (`#FFC24B`, intensity 0.9, distance 3.5, decay 2) and the dream's moon light stays as the cool key, so the quilt and the boards read warm on the candle side and blue on the window side. The frame must not be one colour anywhere: the gate in 7.6 measures it.
3. **The camera comes down to the bed.** `dreamShot` gains `resultsShot(phone)`; at `WAKE.finish` (1500 ms) `DreamCamera` eases from the dream shot to it over 900 ms with `--ease-out`'s curve, and holds. Frame targets at 1920 × 1080 (the tuning method of V4.1, not fixed metres): the headboard's top-left corner at (16%, 30%), the foot of the bed at (74%, 92%), the window centred at (80%, 24%), the farmer's head at (28%, 52%), the beam across the top at 8% from the top edge, and the board (step 5) centred at (50%, 34%) with its bottom edge above the farmer's hands. The dev `?bedcam` shot (position (1.6, 2.0, 7.2), target (−0.4, 0.6, 4.3), fov 30) is the starting point. Phones (390 × 844): the bed fills the lower 55% of the frame, the board hangs in the upper 40%, the window top-right. Under reduced motion the camera cuts at `WAKE.reducedFinish`.
4. **The farmer is awake.** `farmerGeometry` gains `sitting`: the farmer upright against the headboard, the quilt pushed to his waist (a `quiltSat` geometry folded at the fold line), one arm raised with the hand at the eye (a 0.04 m arm of four segments), the nightcap askew; the `awake` head faces the camera. The clock rings once more at the camera's arrival and stops.
5. **The results hang from the beam.** A kit `Board panel tone=wood hang=ropes` (HTML, no snow indoors) 420 px wide (phones: the frame width minus 32 px) positioned each frame by projecting the beam's hook (the `Projection` pattern from `BarnTable.tsx`, a `boardEl` anchor), its two `.kit-rope`s drawn from the board's top corners to the projected hook (two rotated lines whose length and angle come from the projection), swinging in from above at 2100 ms and settling. On it, top to bottom: the title carved on the plank ("The farmer woke up!"; "Practice dream" when practising); a `Slate plaque` 96 px with the count in chalk and "sheep" in chalk hand; a `Paper sheet` pinned under it with "Longest word: 10 letters" and "fence 18 of 30"; the streak as `Knit stitches` for the seven nights (played amber, missed dropped, blanket with its icon, repaired cream, tonight ringed) with "1-night streak · best 1" in Patrick Hand under it; the buttons on the plank's lower rail: `Brass` Share, `WoodButton` Practice, `WoodButton` Back to the farm; "Tonight's dream returns at 12:00 am." on a `Paper slip` pinned to the headboard (`Html`, anchored). The dark `.sk-results-backdrop` is not used here: the room is the backdrop.
6. **The Warm Blankets are in the room.** Each blanket held (0, 1 or 2) is a folded quilt (`foldedQuilt(seed)`, 0.10 m grid, 0.5 × 0.12 × 0.4 m, the four quilt tones in 0.3 m patches with a cream stitch line, a slight overhang on one side) stacked at the foot of the bed; the paper's last line reads "Warm Blankets keep your streak warm when you miss a night. You earn one every 7 nights." in Patrick Hand, and the folded quilts are what the player counts. The Home ticket keeps its two blanket icons as the summary.
7. **Share.** `src/skin/share/card.ts` draws the card in the kit's materials: the plank with grain and nails, the slate with the chalk count, the stitches row, Fraunces and Patrick Hand (loaded through `document.fonts.load` before drawing, falling back to Georgia and cursive), the spoiler-free glyph row from v4 Part 13 under it.
8. **Phone**: the room fills the screen, the board hangs at the top, the buttons stack on the plank's rail, the folded quilts stay visible at the bed's foot above the bottom edge.

### 6.5 The edges (U5)

- **The Hunt** keeps its handheld-console look inside `src/skin/hunt` (decision 9.3); nothing there changes.
- **Rooms, lobby and account** (`.classic-panel` overrides and `AccountPanel`'s ink card): a `Panel` of planks with a `Board heading` title and `Peg` close; tabs as paper index tabs.
- **The classic skin** (`?skin=classic`) is untouched, and the e2e suite still builds with `VITE_SKIN=classic`.

---

## 7. Tests and acceptance

1. **The audit** (3.1) in `npm test`: at U0 the budget equals today's counts; after U1 the kit's own files add zero findings; after each of U2, U3 and U4 the budget is lowered to the new counts and committed; after U5 every count is 0 and the allow-list holds only Part 4.12's entries.
2. **`?preview=kit`** renders every material in every variant and state; screenshots at both sizes are attached to U1.
3. **Contrast**: `src/skin/__tests__/kitContrast.test.ts` computes the WCAG ratio for each text-on-material pair in `kit/contrast.ts` (ink on paper, button text on wood, chalk on slate, ink on burlap, wood-ink on brass, ink on ice, chalk coral on slate) from the tokens and fails under 4.5:1.
4. **Voxel objects**: `src/skin/__tests__/signs.test.ts`: the fence sign's board has an empty front-layer cell and an ink back-layer cell at every glyph cell for A to Z and for one, three and five letters; the board's width equals `signWidth(n)` within one cell; the stake, the sign and the folded quilt pass the v5 connectivity test (every voxel reaches the ground or the hanger through face-adjacent voxels); the bedroom's room meshes are absent while `phase === 'running'` and present on `'results'`.
5. **Readability**: the projected cap height of the nearest sign's letters at `TYPE_X` is at least 22 px at 1920 × 1080 and 16 px at 390 × 844, read from the dev overlay in a Playwright run; a 400% crop of the nearest sign is attached to U4.
6. **The results scene gate**: a Playwright screenshot of the results at both sizes with two folded quilts and a four-night streak; the frame's luminance standard deviation is at least 0.10 and no 10% × 10% cell of the frame is a single flat colour (standard deviation under 0.01) except inside the window's night sky; the board, the slate, the stitches and both quilts are visible; the farmer is sitting up.
7. **Reduced motion**: with the OS setting on, a capture of each screen shows no object moving except the game itself; every swing, drop and slide has its fade.
8. **Phone**: no kit element overlaps another at 390 × 844 in any state listed in 3.3; the trough, its tiles and the board fit above the keyboard (the visual-viewport hook in `DreamScreen.tsx` stays).
9. **Tour and tests**: every `data-tour` and `data-seat*` attribute present at 4dce7f7 is present after U3, on the element that now carries that content; the existing tests are not modified; `npm run build`, the type check and the e2e suite pass.
10. **After contact sheets**: `docs/skin/ui-v6/<milestone>/`, the same list as 3.3, before and after side by side.

---

## 8. Milestones and prompts

| Session | Milestone | Scope | Prompt |
|---|---|---|---|
| 1 | U0 | Part 3 | the Part 0 prompt |
| 2 | U1 | Part 4 entire, `?preview=kit`, the allow-list, `Materials.tsx` re-exports, the contrast test | "Read Parts 4 and 7 of docs/REDESIGN_PLAN_V6_UI.md. Do Milestone U1. Change no screen yet. Attach the kit preview at both sizes and the audit output." |
| 3 | U2 | 6.1, 6.2 | "Read Parts 4, 6.1, 6.2 and 7. Do Milestone U2. Lower the audit budget to the new counts. Attach the contact sheets and the audit output." |
| 4 | U3 | 5.2, 5.3, 6.3 | "Read Parts 4, 5.2, 5.3, 6.3 and 7. Do Milestone U3. Attach the contact sheets, a 400% crop of the letter board with its slate and of one stake with its slips, and the audit output." |
| 5 | U4 | 5.1, 5.4, 6.4 | "Read Parts 4, 5.1, 5.4, 6.4 and 7. Do Milestone U4. Attach the contact sheets, the fence-sign crop, the results scene at both sizes with the gate's numbers, and the audit output." |
| 6 | U5 | 6.5, Part 7 entire, the budget at zero, retiring `--radius-paper` and the dead classes | "Read Parts 6.5 and 7. Do Milestone U5. Attach everything Part 7 lists." |

After each: `npm run build`, the type check, `npm test` (which now includes the audit), the e2e suite in the classic build. A milestone whose audit budget went up is not done.

---

## 9. Decisions (change any before starting)

| # | Decision | Alternative |
|---|---|---|
| 9.1 | The dream's results are the whole bedroom with the board hanging from the beam, the camera moved to the bed | the bedroom stays in its corner and a kit board sits beside it |
| 9.2 | Warm Blankets are folded quilts on the bed, counted in the room | an icon row on the board only |
| 9.3 | The Hunt keeps its console look inside its own screen | restyle the Hunt in the kit (it would lose its deliberate retro look) |
| 9.4 | Names and typed words are HTML slips anchored to voxel stakes | voxel letters for names (impossible for free text) |
| 9.5 | The letter over the table stays proud on its board; the HTML card goes and a slate carries the seconds | carve the letter into the board (it would be 0.04 m thick at 0.49 m tall and vanish at a glance) |
| 9.6 | The scoreboard is a chalk ledger on a slate, not cards | keep paper cards, cut from the kit's paper |
| 9.7 | The fence sign's letters are recessed (a hole in the board's front layer over an ink voxel) | letters proud of the face, as now |
| 9.8 | The active fence is marked by a lantern and lit letters; the cream rim goes | keep a rim, in the kit's rope |
| 9.9 | The results board is HTML positioned by projecting the beam's hook, with CSS ropes to it | a drei `Html transform` plane on a voxel backing board |
| 9.10 | Primary actions are brass plates; Play, Sit down and Start run stay painted green boards | brass everywhere, including Play |
| 9.11 | The audit is a budget that ratchets down and reaches zero at U5 | a hard zero from U1 (it would block every intermediate commit) |
| 9.12 | No emoji or typographic glyph as an icon anywhere in the skin | keep `✓` and `…` |

---

## 10. In one paragraph

Every piece of interface becomes something the farmer could own: plank boards with grain, nails, ropes and snow caps for headings and announcements; torn paper slips, tags and sheets pinned or strung for anything written; carved wooden tiles for letters; chalk slates for numbers and the tally; stitched burlap patches for chips; knitted bands for progress and the streak; brass plates for the main action and wooden pegs for the small ones; clipboards for dialogs and plank panels with levers for settings. The signs read every turn move into the world as voxel objects: a proper fence sign in the dream with its letters carved into the board and a lantern on the active post, name stakes with paper slips at every seat, and the carved letter over the table with a chalk slate for the seconds instead of a cream card. The dream's end is the farmer's whole bedroom with the results hanging from the beam and the Warm Blankets folded at the foot of the bed. An audit runs with the tests and forbids any surface that is only a shape.
