# Fleeced: Home screen interface refinement

Written 20 November 2026 from a screenshot of the working tree (v0.8.3, not pushed). Give Claude Code this file and both pictures. One pull request. Two target pictures come with this file: `target-1280x720.png` and `target-1255x1155.png`. They are a static mock: match their layout, shapes and colours; the scenery in them is only a placeholder.

**This is Brian's own request and replaces earlier Home decisions.** Record it in `CLAUDE.md`. The idea stays: a slanted night-blue panel with words sliding across it, in the style of a rhythm game's menu. Only the execution changes.

## 1. Scope

| In | Out |
|---|---|
| Home: the panel, the sliding words, the title, every button, the word of the day, the footer | What any button does, any route, any text, any rule of the game |
| Panels and cards opened from Home (Queue's Casual and Ranked, Practice, Join party, Set the table) | Every other screen (the table, settings, shop, rooms) |
| A small reusable button kit, used here first | The 3D scene's models and light |

Before changing anything, list every element on Home and in its panels that can be clicked. Put the list in the pull request, with each one marked done. In the pushed code Home is `src/skin/screens/PaintedHome.tsx`, with styles in `src/skin/styles/skin.css` and `kit.css`, tokens in `tokens.css`, and kit pieces in `src/skin/kit/index.tsx`; the working tree may differ.

## 2. What is wrong today

| # | Problem | Measured on the screenshot |
|---|---|---|
| 1 | The panel hides the scenery | It covers 57% of the width at the top and 40% at the bottom |
| 2 | The panel's top and bottom are empty | The words run in five large rows through the middle only |
| 3 | The buttons are stock wooden planks | Wood grain, soft glow, soft shadows |
| 4 | Text is too large for the space | Queue's label is about 44 px, the others 34 px |
| 5 | The title is wooden letter tiles on a shelf | It is 42% of the screen's width |
| 6 | The word of the day covers the scenery's corner | A 28% by 22% card over the picture |

## 3. Tokens

Add to `tokens.css`. Use no other colour on Home.

| Token | Value | Use |
|---|---|---|
| `--night` | `#1B2742` | Panel |
| `--night-2` / `--night-3` | `#26365C` / `#34497A` | Raised pieces on the panel / their top highlight |
| `--ink` | `#0E1528` | Every outline, hard shadows, the footer |
| `--wool` / `--wool-hi` / `--wool-lip` | `#FFF4DC` / `#FFFDF4` / `#D8C49A` | Button face / top highlight / side |
| `--lantern` / `--lantern-hi` / `--lantern-lip` | `#F2A444` / `#FFD98A` / `#B96F1E` | The main button, the edge stripe, accents |
| `--barn`, `--dusk`, `--pasture` | `#B8473A`, `#5B5FC7`, `#3F8A55` | Icon tiles |
| `--frost` | `#B9C8E6` | Small text on blue |

Fonts stay: Fraunces 800 for labels and the title, Nunito 800 for small text, Patrick Hand for the tagline. No new font files. Labels are in sentence case ("Farm sheep", "Best 24", "Word of the day"), not capitals.

**One scale for everything:** `--u: clamp(0.8, min(100vw / 1280, 100vh / 720), 1.5)`. Every size below is in px at `--u` = 1 and is multiplied by `--u`.

## 4. Layout: the panel moves left

| Thing | Value |
|---|---|
| Footer height | 36 |
| Panel height `--ph` | `100vh` minus the footer |
| Panel width at mid-height `--mid` | `clamp(380, 36vw, 560)` |
| Lean each way `--lean` | `min(var(--ph) × 0.097, 8vw)` (an 11° slant; the top is the wide end, as today) |
| Panel shape | `clip-path: polygon(0 0, (mid + lean) 0, (mid − lean) 100%, 0 100%)` |
| Edge stripe | 9 of `--lantern`, then 4 of `--ink`, both following the slant; no blur, no gradient |
| Result at 1280 x 720 | The panel covers 42% of the width at the top and 32% at the bottom |

Inside the panel, a column 24 from the left: the profile chip 16 from the top; the title, tagline and menu as one block centred in the space that remains; the word of the day 14 above the footer. Gaps inside the block are 14. If the window is shorter than 640, hide the tagline first, then the word's definition line.

**Scenery.** The 3D picture must be centred in the uncovered part, whose middle is at `(mid + 100vw) / 2`. Find how the scene is shifted for the panel today (a view offset on the camera, or a shifted canvas) and drive it from the same `--mid` number, so the subject of each tour shot sits in the middle third of the uncovered area. Do not change any tour shot itself. On the paddock shot the wendigo must still be on screen, clear of the panel and of the top-right buttons; every wendigo rule in `CLAUDE.md` still holds, and `npx vite-node tools/scenes/check.ts -- --only wendigo` must pass.

## 5. The sliding words

- Rows cover the **whole** panel, top to bottom. One container, rotated −6°, oversized (left −20%, top −10%, width 160%, height 130%), clipped by the panel.
- Each row: Fraunces 800, 30, capitals, letter-spacing 0.06em, 0.55em between words, row gap 10. About 21 rows at 720 high; at most 36.
- Colour: `#222F53` on the panel (deliberately faint, 1.1 to 1). Every third row `rgba(242, 164, 68, 0.12)`.
- Words: the list Home uses today, in the game's language.
- Motion: each row holds its text twice and slides `translateX(0)` to `translateX(−50%)`, linear, forever. Durations 60 s, 75 s and 90 s by row; even rows run the other way. CSS only, transforms only, `aria-hidden`, no pointer events.
- Nothing in a row may be brighter than this. Labels in front must stay easy to read.

## 6. The title

Seven separate blocks, one letter each, built with the slab of section 7 in `wool`. No wood, no shelf.

| Thing | Value |
|---|---|
| Block | 52 wide, 58 high plus a 6 side; 5 apart; letter Fraunces 800, 38, colour `--night` |
| Tilt per block | −5°, 3°, −2°, 4°, −4°, 2°, −3° |
| Lift per block | 0, −5, 2, −4, 1, −5, 0 |
| The last block ("D") | Its top right corner is cut away in three pixel steps, and three loose wool squares (9, 6 and 5 wide, 2 `--ink` outline) drift up and right of it: the letter has been fleeced |
| Tagline | Patrick Hand 17, `--frost`, 12 under the blocks, one line |
| Left edge | 80 from the screen's left |

## 7. The slab: one recipe for every button

A flat block with a thick outline and a visible side, like a block from the farm. Three stacked layers inside one `<button>`:

```css
/* one pixel-corner step and the outline width */
:root { --s: calc(3px * var(--u)); }
.px { clip-path: polygon(0 calc(2*var(--s)), var(--s) calc(2*var(--s)), var(--s) var(--s), calc(2*var(--s)) var(--s), calc(2*var(--s)) 0,
  calc(100% - 2*var(--s)) 0, calc(100% - 2*var(--s)) var(--s), calc(100% - var(--s)) var(--s), calc(100% - var(--s)) calc(2*var(--s)), 100% calc(2*var(--s)),
  100% calc(100% - 2*var(--s)), calc(100% - var(--s)) calc(100% - 2*var(--s)), calc(100% - var(--s)) calc(100% - var(--s)), calc(100% - 2*var(--s)) calc(100% - var(--s)), calc(100% - 2*var(--s)) 100%,
  calc(2*var(--s)) 100%, calc(2*var(--s)) calc(100% - var(--s)), var(--s) calc(100% - var(--s)), var(--s) calc(100% - 2*var(--s)), 0 calc(100% - 2*var(--s))); }

.slab { --h: calc(52px * var(--u)); --depth: calc(6px * var(--u)); position: relative; height: calc(var(--h) + var(--depth)); border: 0; background: none; }
.slab > .e { position: absolute; inset: 0; background: var(--ink); }                                   /* outline */
.slab > .l { position: absolute; inset: var(--s); background: var(--lip); }                            /* the side */
.slab > .f { position: absolute; inset: var(--s) var(--s) auto; height: calc(var(--h) - 2*var(--s));   /* the face */
  background-color: var(--face); box-shadow: inset 0 var(--s) 0 var(--hi); display: flex; align-items: center; }
/* .e, .l and .f all carry .px */
```

| Variant | Face | Highlight | Side | Text |
|---|---|---|---|---|
| `wool` | `--wool` | `--wool-hi` | `--wool-lip` | `--ink` (16.6 to 1) |
| `lantern` | `--lantern` | `--lantern-hi` | `--lantern-lip` | `--ink` (8.8 to 1) |
| `night` | `--night-2` | `--night-3` | `#141D36` | `--wool` (10.9 to 1) |
| `ink` | `--ink` | `#1D2947` | `#05080F` | `--wool` |

**Texture (the "slightly pixelated" part).** `wool` and `lantern` faces carry a knitted stitch drawn in pixels: a 16 x 12 tile holding one "V" made of 2 px squares at 7% black, repeated. Draw it as an inline SVG with `shape-rendering: crispEdges`:

```css
background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='12' shape-rendering='crispEdges'%3E%3Cg fill='%23000' fill-opacity='.07'%3E%3Crect x='2' y='2' width='2' height='2'/%3E%3Crect x='4' y='4' width='2' height='2'/%3E%3Crect x='6' y='6' width='4' height='2'/%3E%3Crect x='10' y='4' width='2' height='2'/%3E%3Crect x='12' y='2' width='2' height='2'/%3E%3C/g%3E%3C/svg%3E");
background-size: calc(16px * var(--u)) calc(12px * var(--u));
```

**Banned on Home:** wood grain, planks, ropes, nails, parchment, any gradient, any blurred shadow or glow, any rounded corner. Do not use the kit's `Board`, `WoodButton`, `Peg`, `Brass`, `Nails` or `Ropes` here. Slabs over the scenery get one hard shadow: `filter: drop-shadow(0 4px 0 rgba(14, 21, 40, 0.38))` on the button (a filter on the button, because `clip-path` would cut a `box-shadow`).

**States, the same for every slab:**

| State | What changes |
|---|---|
| Rest | As drawn |
| Pointer over (small buttons) | The face rises 2 |
| Selected (a menu item under the pointer or holding keyboard focus) | The item slides 16 to the right; a pixel arrow in `--lantern` (18 x 22, stepped) appears 30 to its left; its icon tile hops 2 every 0.6 s |
| Keyboard focus (any slab) | `outline: 3px solid var(--lantern); outline-offset: 3px` |
| Pressed | The face drops 4 onto its side, in 60 ms |
| Busy | The label is replaced by three pixel dots that light in turn; not clickable |
| Disabled | Face `#3A4664`, text `--frost`, side only 2 deep, no reaction |

Selection must not re-render the 3D canvas: keep it in CSS (`:hover`, `:focus-visible`) or in state that lives below the canvas in the tree. Selection changes use `transform` only, so nothing else moves.

## 8. Every button

| Element | Slab | Size | Details |
|---|---|---|---|
| Profile chip | `night` | 250 x 46 | Avatar in a 32 square with pixel corners (not a circle); name Fraunces 800, 16; "LV 2" Nunito 800, 10.5, `--lantern-hi`; progress as ten 9 x 7 segments 2 apart (`--lantern` filled, `#141D36` empty); streak in an `--ink` tag at the right |
| Queue | `lantern`, knit | (mid − 72) x 70 | Icon tile 52, `--ink`; label 31; second line Nunito 800, 12.5. Selected when Home opens |
| Create lobby | `wool`, knit | (mid − 96) x 52 | Icon tile 36, `--barn`; label 21; tag "Farm sheep" |
| Counting Sheep | `wool`, knit | same | Icon tile `--dusk`; tag "Daily", or "Admin" where it shows today |
| Practice | `wool`, knit | same | Icon tile `--pasture`; tag "Best 24" |
| Tutorial | `wool`, knit | same | Icon tile `--night` |
| Any other menu item (Join party) | `wool`, knit | same | Icon tile `--lantern-lip` |
| Tags inside menu items | none | 22 high | `--night` with `--wool` text on wool slabs; `--ink` with `--lantern-hi` text elsewhere; Nunito 800, 11.5; pixel corners; pushed to the right end |
| Coin purse | `ink` | 108 x 44 | Coin as an 18 square in `--lantern` with a light and a dark edge; amount Fraunces 800, 17, figures of equal width |
| Add coins | `lantern` | 44 x 44 | Joined to the purse (overlapping by 3); plus sign |
| Leaderboards, settings, sound, help, language | `wool` | 44 x 44 each, 10 apart | 20 from the right, 16 from the top; hard shadow. The language switch on `main` (pull request 56) becomes one of these, showing "EN" or "FR" in Nunito 800, 14 |
| Word of the day | `night` | 300 x 112, or narrower to stay 56 inside the edge | **Moves into the panel**, bottom left. A 3 band of `--lantern` on top. Lines: "Word of the day" (Nunito 800, 11.5, `--lantern-hi`); the word (Fraunces 800, 23, `--wool`); pronunciation and word class as two small `#141D36` tags; the meaning (Nunito 700, 13.5, `--frost`, two lines at most) |
| Footer | bar | 36 high | `--ink` with a 3 line of `--lantern` on top. "Tip" in a `--lantern` tag with `--ink` text; tip text `--frost`, 12.5, may wrap to two lines. Right: version in `--frost`; links in `--wool`, Nunito 800, 18 apart, each at least 24 high to click. "Admin on" stays a link |
| Panels and cards opened from Home | `night`, not skewed | as needed | Body with a 3 `--lantern` top band. Main action `lantern`, 48 high. Other actions `wool`. Close: a 36 `wool` square with a pixel cross. Text fields: `--ink` face, 3 outline in `--night-3`, pixel corners. Code tiles for joining: the title's blocks at 40 x 44 |

**The menu's slant.** Each menu item is skewed with `transform: skewX(-11deg)` from its bottom left corner, and its contents are skewed back by 11° so text stays upright. Items are 6 apart. The bottom left corners of all items lie on one line that leans 11°: each item sits `64 × 0.194` (12.4) to the right of the one below it. Their ends then form two straight lines parallel to the panel's edge. Queue's right end reaches the edge when selected.

**Icons.** 16 x 16 pixel art, shown only at whole multiples: 32 on a 36 tile, 48 on Queue's 52 tile, `image-rendering: pixelated`. Light shapes (`--wool`) with at most two accent colours and no outline, because the tile is the outline. This replaces the earlier brief (dark outline on a tan tile). Until Brian's art arrives, draw single-colour stand-ins as pixel shapes in code. Files: `queue.png`, `lobby.png`, `join.png`, `dream.png`, `practice.png`, `tutorial.png` in `src/skin/assets/menu/`.

## 9. Motion

| When | What | Time |
|---|---|---|
| Home opens (once per visit to the site) | The panel slides in from the left; the title's blocks drop in one after another; the menu items slide in from the left | 280 ms; 45 ms apart; 40 ms apart; under 900 ms in all |
| Always | The word rows slide; the selected item's icon tile hops | Section 5; 0.6 s |
| Selection moves | Slide right 16; the previous item returns | 120 ms; 160 ms |
| A menu item is chosen | Its face flashes to `--wool-hi` three times | 240 ms. The action starts at once; the flash never delays it |

Nothing else moves by itself. With `prefers-reduced-motion`: no entrance, rows stand still, no slide, no flash; the arrow alone marks the selection.

**Keys.** Up and Down (and W and S) move between menu items, Enter or Space chooses. Tab order: chip, menu from the top, word of the day, the top-right buttons from the left, footer links. Do not take keys while a text field has focus.

## 10. Phones (narrower than 700)

The panel becomes a sheet at the bottom whose top edge slants 6°, with the same stripe. It covers at most 56% of the screen's height. The title's blocks are 40 x 44. The tagline is hidden. Menu items are full width less 16 each side, skewed −6°, 44 high (Queue 60), with no stagger. The chip sits top left and the purse top right; the square buttons go in a row under the purse. The word of the day is one line above the footer: the word and its meaning. Footer links other than the tip fold behind one "More" link. If Home on phones is already a bottom sheet, keep its structure and apply the same pieces.

## 11. Checks, and what done means

1. Type check, all tests and the build pass. Tests pinned to the old Home are updated to the new design; no test outside Home's is changed.
2. Screenshots in the pull request at 390 x 844, 768 x 1024, 1280 x 720, 1255 x 1155 and 1920 x 1080, in English and in French, next to the two target pictures. Nothing clipped, no sideways scroll. French labels are up to 40% longer: a label may shrink to 18 before it wraps, and never clips.
3. At 1280 x 720 the panel covers no more than 42% of the width at the top and 32% at the bottom, and the subject of the tour's first shot sits in the middle third of the uncovered area.
4. No wood, gradient, glow, blur or rounded corner is left on Home or its panels.
5. Every item of the list from section 1 is a slab with all seven states.
6. Text contrast is at least 4.5 to 1 everywhere, checked with `src/skin/kit/contrast.ts`. Menu items and top buttons are at least 44 high.
7. Moving the pointer across the menu does not re-render the 3D canvas, and Home's frame time is no worse than before.
8. No new font or picture file except Brian's icons. If the bundle limit must rise, say by how many bytes.

**Changes Brian did not ask for, to confirm in the pull request:** the word of the day moves into the panel; labels are in sentence case; avatars and round buttons become squares with pixel corners.
