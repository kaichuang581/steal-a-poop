# Trading Post refinement for Claude Code: layout, consistency and look

Version 2, 12 November 2026. Polishes the Trading Post as built (Feed Sacks, Bell Shelf, Missions, Collection): how it is laid out, how consistent it is, and how it looks. No change to prices, odds, pity, rewards or rules; the guardrails of `docs/PLAN_TRADING_POST_V2.md` still apply (cosmetic only, odds shown, no near-miss, Bells never open sacks, nothing bought with money). The materials come from the farm kit in `docs/REDESIGN_PLAN_V6_UI.md` (plank, paper, slate, burlap, brass, rope); where that kit is not built yet, build the pieces this plan needs into it.

Save as `docs/PLAN_TRADING_POST_REFINE.md` and paste:

```
Read @docs/PLAN_TRADING_POST_V2.md, @docs/REDESIGN_PLAN_V6_UI.md Part 4 and @docs/PLAN_TRADING_POST_REFINE.md. Do Milestone R1 only. Attach screenshots of all four tabs at 1920 x 1080 and 390 x 844, before and after. Stop there.
```

Milestones: **R1** the room and the layout, **R2** one visual language, **R3** Feed Sacks, **R4** Bell Shelf and Missions, **R5** Collection, **R6** item art, motion and sound, **R7** the reveal, phone, keyboard and tests.

---

## 1. What the screenshots show

### 1.1 Layout and consistency

| # | Where | Problem |
|---|---|---|
| 1 | All tabs | Content is cut off at the bottom with no sign that it scrolls (the odds note, the third row inside the Oat Sack, the Collection's second row, the 250-words milestone). |
| 2 | Header and Home | The same balance is written `999,999` in the panel and `999999` on the Home coin peg and menu badge. |
| 3 | Tabs | Four flat beige boxes; the selected one is only slightly lighter. |
| 4 | Text | Three typefaces in body text (Patrick Hand, Nunito and a plain sans in Missions and the tabs). |
| 5 | Feed Sacks | Coloured squares under each sack with no legend. |
| 6 | Sack vs Collection | An unfound item is full colour in the sack (Gold) but a grey "?" in the Collection. |
| 7 | Inside the sack | Three card sizes in one grid: 3 cards, 2 centred cards, then tiny cut-off thumbnails. |
| 8 | Bell Shelf | Two items, both WEARING, no prices; most of the tab is empty. |
| 9 | Bell Shelf and Missions | The level bar and the "how you earn" information appear twice. |
| 10 | Collection | Wear, WEARING and "Not found yet" look different from the same states elsewhere. |
| 11 | Missing | The daily shelf (25% off four items) is not visible. |
| 12 | Admin | A full-width yellow banner on every tab. |

### 1.2 Look

| # | Problem | Why it hurts |
|---|---|---|
| A | **It is a web dialog, not a place.** A cream rectangle with a festive border floats over a dimmed Home screen. The earlier version (a dark plank wall, wooden sign headings, torn paper cards) felt like a shop on a farm; this one feels like a settings window. | This is the "low effort" look players described: a generic panel instead of something built for this world. |
| B | **Everything is the same beige.** Background, tabs, cards, odds panel and progress bars are all cream on knitted cream, so nothing stands out and the eye has nowhere to go. | No hierarchy: the Open button and the item art compete with the texture. |
| C | **The knit texture is busy behind text.** At small sizes it looks like noise. | Lower readability, a cheaper feel. |
| D | **Black boxes behind the item art.** Every item sits in a near-black square, which reads like a missing image, and the pixel bombs float small inside it. | The art, the thing being collected, looks unimportant. |
| E | **Pixel art next to a voxel world.** The bombs, bursts and sacks are flat 2D pixel art, while the game itself is 3D voxels. | Two art styles side by side signals pieces made separately. |
| F | **Empty outline progress bars.** Thin brown outlines with nothing inside look unfinished. | Progress, the reason to come back, looks like a placeholder. |
| G | **Rarity is only a thin coloured stripe.** A legendary card looks almost the same as a common one. | Rare items should feel special at a glance. |
| H | **The red Open button is a flat bright block** unlike any other button in the game. | It looks pasted on. |
| I | **Tiny currency icons** (a few pixels) beside large numbers. | The two currencies are hard to tell apart. |
| J | **A plain title.** "Trading Post" in dark text on cream, with no sign or character. | The shop has no identity. |

---

## 2. R1: the room and the layout

### 2.1 Make it a place
- **Background:** the panel becomes the inside of the Trading Post: a dark plank wall (`--wood-dark` boards with grain, vertical, 2 px gaps), as in the earlier version, filling the panel. The festive stripe stays as a garland along the top beam.
- **Sign:** "The Trading Post" carved into a hanging plank sign (V6 `Board title`, snow cap, two ropes), centred at the top. The close button is a wooden peg at the top-right.
- **Counter:** the balances sit on a small chalk slate on the right of the sign: "999,999" with a large coin and "999,999" with a large bell, chalk text.
- **Content on paper and shelves:** each tab's content sits on things in the room: item cards are paper price tags or framed pictures on the wall, the odds are a chalk slate, the sacks sit on a wooden counter, the Bell Shelf is a real shelf. Only text that needs reading sits on paper; nothing else is cream.
- **Behind the panel:** keep the dim, but blur nothing; the room is opaque, so the Home screen does not show through.

### 2.2 Layout and scrolling
- **Fixed top, scrolling body.** Sign, balances and tabs stay fixed; only the tab body scrolls. The panel is at most 88% of the window's height.
- **Show that it scrolls:** a 24 px fade into the wall colour at the bottom while more is below, and at the top once scrolled.
- **Nothing cut in half:** 16 px of space after the last row.
- **Sticky odds slate** on Feed Sacks (desktop).
- **Admin:** a small brass `ADMIN` tag beside the balances instead of the banner.

## 3. R2: one visual language

- **Colour hierarchy:** dark wood for structure (walls, shelves, frames), cream paper only for reading, chalk slate for numbers, and exactly one accent per action (red plank for Open and Buy, green patch for Wear). Remove the knit texture from behind text; keep it only as a thin knitted trim on the tabs.
- **Numbers:** one `formatCoins(n)` everywhere: `1,250`; on small pegs and badges above 99,999 it shows `99.9k`, `999k`.
- **Currency icons:** a 20 px pixel coin (wool ball stamped on gold) and a 20 px brass bell, drawn on the same pixel grid, used at the same size everywhere a price appears.
- **Typefaces:** Fraunces for the sign, titles, item names and numbers; Patrick Hand for descriptions, hints and progress text; Nunito only for small uppercase tags. No plain sans.
- **Tabs:** paper index tabs pinned to the top beam with brass tacks, each with a pixel icon (sack, bell, scroll, book). The selected tab hangs 6 px lower and joins the content; the others are a darker paper with a hard 2 px shadow.
- **Buttons:** the red Open/Buy button becomes a painted plank (barn red with grain showing, a dark bottom edge, engraved cream text, presses down 2 px); Wear is a green cloth patch with stitching; nothing else is a button.
- **Progress bars:** a knitted band (V6 `Knit`) that fills with amber stitches; the empty part is pale stitches, never an empty outline.
- **Rarity tokens** from one table (`rarity.ts`), each with a frame, not just a stripe:
  - common: plain plank frame;
  - uncommon: plank frame with a green painted edge;
  - rare: frame bound with blue-dyed rope at the corners;
  - legendary: gilded frame with a soft gold glint that sweeps across every few seconds (still under reduced motion).
  The text tags (COMMON, RARE) stay for players who cannot tell colours apart.
- **Item card:** one component everywhere, three states only:
  - *not found:* the art dimmed to 35% with a small padlock and where it comes from ("In the Oat Sack", "Mission: 7 nights", "200 Bells");
  - *owned:* full colour, a `Wear` patch;
  - *wearing:* full colour, the frame lit with the lantern ring, a `WEARING` tag in place of the button.
  Fixed height; one-line descriptions, full text on hover or tap.
- **Item art is never hidden:** unfound items show their dimmed art, never a "?", in the sack and the Collection.

## 4. R3: Feed Sacks

- **The counter:** the three sacks stand on a wooden counter, larger (about 1.5x), with their grain names stencilled on them; the selected sack sits forward and its tag swings. Under each: "4 of 5 found" and five small rarity pips (filled when found), with the item named on hover.
- **Today's shelf** above the counter: a small shelf with four items on price tags, the normal price struck through and the shelf price beside it, "Today's shelf · changes at midnight". No timer.
- **Inside the sack:** one even grid of framed item cards (4 columns desktop, 2 phone), sorted common to legendary.
- **The odds slate:** the odds bar, four percentages and the two pity bars in chalk on a slate; the red plank `Open · 250` under it; then "Or buy any of these directly in the Collection." If all are found: a disabled "All found". If short of coins: "Need 250 · you have 120", disabled.

## 5. R4: Bell Shelf and Missions

- **Shared strip** under the tabs on every tab: a small wooden level badge ("1 · Lamb"), the knitted XP band, "8 / 300 coins from games today". Remove the duplicated level panels.
- **Bell Shelf:** a real two-tier wooden shelf on brackets. Items stand on it, each with a brass price tag hanging from the shelf edge (`200`), then `Wear`, then `WEARING`. At least six spots: unfilled spots are empty pegs with a small paper note "More soon". One line under the shelf: "+5 every level · +10 every milestone · +20 every 7 dream nights".
- **Missions:** a notice board with pinned paper slips, one per mission: the reward art in a small frame, the reward name and type, the goal, the knitted progress band and `0 / 7`. Finished missions get a red "DONE" stamp and move to the bottom.
- **Milestones:** a ledger page under the board: ruled lines, the goal, the band, and the rewards as two small chips (coin, bell).

## 6. R5: Collection (the Barn Book)

- An open book on the counter: the left page shows "15 / 26" in large numbers with the knitted band; the right page lists the filters.
- **Filters:** All · Bomb skins · Bursts · Fuse sounds; Found · Not found. Remembered in local storage.
- **Sections** per type with "6 of 8", each a grid of framed item cards like photographs pinned into the book.
- Every not-found card says exactly how to get it ("In the Oat Sack · or buy for 800", "Mission: count sheep 7 nights", "200 Bells on the Bell Shelf").
- Starter items show `Wear` or `WEARING` like any other.

## 7. R6: item art, motion and sound

- **Voxel thumbnails instead of flat pixel art (decision 1).** Render each bomb skin as the actual voxel bomb from the game, lit by the scene's warm key light, at a three-quarter angle, into a 128 x 128 transparent PNG at build time (`tools/renderThumbs.ts`, the same three.js scene used in `?preview=`). Bursts: a still frame of the burst at its peak. Fuse sounds: a voxel speaker horn tinted in the sound's colour. Sacks: voxel burlap sacks with stencilled grain names. Players then collect the thing they will actually see in the game.
- **Frames, not black boxes:** the thumbnail sits on a warm paper or plank background inside its rarity frame, filling 80% of the frame.
- **Motion:** sacks wobble slightly on hover; item cards lift 2 px; a newly bought or found item drops into its frame; the legendary glint; the selected tab swings in. All under 300 ms, all off under reduced motion.
- **Sound:** a coin clink when buying, a soft burlap rustle when a sack is selected, a bell for Bells, a page turn when switching to the Barn Book. Respect the mute setting.

## 8. R7: the reveal, phone, keyboard and tests

- **Reveal check:** the reveal follows V2 Part 3.5: rarity colour from the first frame, no near-miss, no "Open another", the duplicate refund in words. Restyle it in the room: the sack sits on the counter, wobbles, its string glows, and the item pops out into a frame of its rarity.
- **Phone (390 x 844):** the panel is full screen; the sign shrinks; tabs become a 4-icon bar with labels; the odds slate moves under the grid; cards 2 per row; the shelf scrolls sideways.
- **Keyboard:** Left/Right switch tabs, Tab moves through cards, Enter wears or buys, Esc closes; the lantern focus ring on every control.
- **Tests:**
  1. `formatCoins` cases.
  2. Every card state renders for found, not found, owned and wearing items of each rarity.
  3. The odds shown equal the odds used by the roll (the same object).
  4. No element in any tab is clipped at 1920 x 1080 or 390 x 844 after scrolling to the end (Playwright).
  5. Text contrast is at least 4.5:1 for chalk on slate, ink on paper and cream on wood.
  6. A thumbnail exists for every catalogue item.

## 9. Decisions

| # | Decision | Alternative |
|---|---|---|
| 1 | Item and sack art becomes pre-rendered voxel thumbnails | keep the pixel art, framed better |
| 2 | The panel becomes the inside of the shop (plank wall, counter, shelf, notice board, book) | keep the cream panel and only fix layout and consistency |
| 3 | Unfound items show dimmed art everywhere, never "?" | "?" silhouettes everywhere |
| 4 | Rarity shown by frame material as well as colour | colour stripe only |
| 5 | Today's shelf lives above the sack counter | its own fifth tab |
| 6 | Large balances shown as `99.9k` on small pegs | always full numbers |
