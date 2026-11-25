# T5. Stop 1: Feed Sacks

`reference/trading-post-1-feed-sacks.png` (computer), `trading-post-phone-feed-sacks.png` (phone), `trading-post-opening-a-sack.png` (the reveal), `models-market.png` (the sacks and pieces).

## 1. The sacks

Three burlap sacks, each in an open crate on the counter, left to right as today: Oat, Corn, Barley.

| Part | Build (0.05 m cells) |
|---|---|
| Body | Round, 17 cells tall. Radius by height: 5.8, 6.6, 7.0, 7.2, 7.2, 7.1, 6.9, 6.6, 6.1, 5.4, 4.4, 3.2, 2.6, 2.6, 3.8, 4.2, 3.6: a full belly, a tied neck, a ruffled top |
| Weave | Rows alternate `hay −1` and `hay −2`, one cell each. That is the only texture: rows, never speckle |
| Tie | Rows 11 to 13 are a band of yarn in the sack's colour, with a bow on the front: a knot, two loops, two tails. Oat `scarfRed 0`, Corn `carrot 0`, Barley `giftGreen 0` |
| Patch | A cream patch 8 x 8 cells on the front with a 6 x 6 stencil in `ink 1`: a bomb (Oat), a burst (Corn), a music note (Barley) |
| Crate | 20 x 7 x 12 cells, boarded front, loose grain round the sack: oat `straw 2`, corn `brass 1`, barley `wood 2` |

## 2. Picking a sack

One sack is always picked (the Oat Sack at first). Pressing a sack or its tag picks it.

| Thing | Picked | Not picked |
|---|---|---|
| The sack and its crate | 0.12 m forward (200 ms) | back; tint 0.86 |
| Its tag | a lantern border | plain |
| The bench | shows what this sack holds | — |
| The odds board | names this sack | — |
| The button | "Open an Oat Sack" | — |

**Each sack's tag** hangs on yarn from the front beam, over its sack: a paper tag 152 x 52 (file `T7`), the sack's name in Fraunces 800 16, and under it "{Bomb skins}: {2} of {5} found" in Nunito 800 11. When every item in a sack is found: "All 5 found", in green with the tick.

## 3. The bench: what the picked sack holds

Every item the picked sack can give stands on the sample bench, in the catalogue's order, common first: the real model for a bomb skin or a fuse sound, the stand of `T3` for a burst. All are in full colour whether found or not: this is where you see what you could get. Five or fewer stand 0.72 m apart; six or seven share 3.6 m evenly.

Under each, hanging from the bench's front edge, a paper tag 116 x 44:
- the item's name, Fraunces 800 14;
- a rarity square (8 px) and the rarity word, Nunito 800 11;
- if found, the green tick after the word.

Pressing an item opens its close view (`T6` section 4).

## 4. The odds board

A chalk board on its own legs at the stall's right (1.0 x 1.4 m face, `iron −1`). In chalk (`#F3EEE6`):
- the picked sack's name, Fraunces 800 19; under it "The odds, every time", Nunito 800 12;
- four rows, 26 apart: a rarity square, the rarity word (Nunito 800 14) and its chance right-aligned (Fraunces 800 15). The chances are read from the same object the roll uses;
- a thin line; then "Rare or better / within {n} sacks" and "Legendary / within {n} sacks", from the player's own pity counters.

## 5. The button and opening a sack

One button, centred 772 from the top at 1440 x 900: a lantern tile 340 x 54 with the coin icon.

| State | Face | Words |
|---|---|---|
| You can afford it | lantern | "Open an Oat Sack" / "250 Wool Coins. One at a time." |
| You cannot | pale, not pressable | "Need 250 Wool Coins" / "You have {n}." |
| Everything in it is found | pale, not pressable | "All found" / "Nothing left to find in this sack." |

**The reveal** (1.6 s; any tap or key skips to the end). The four moments are in `reference/trading-post-opening-a-sack.png`.

| Time | What |
|---|---|
| 0 | The coins leave the wallet. The camera pushes in on the counter (A × 1.6 over 250 ms). The sack hops from its crate to the middle of the counter |
| 250 to 650 ms | Two shakes, 0.035 m side to side. **From 250 ms a light shines from the sack's neck in the item's own rarity colour** (grey, green, blue or gold), with three thin rays above it. The colour never changes during the reveal |
| 650 to 850 ms | The yarn bow unties: its tails fall, the band drops away |
| 850 to 1,250 ms | The item rises 0.5 m out of the neck and turns once |
| 1,600 ms | It lands beside the sack on a small stand. A tag flips up under it: the name, the rarity, and "New!" in green. Two tiles: "Wear it" (lantern) and "Done" (pale) |
| A duplicate | The tag says "You have this one". The item fades into coins that fall into the wallet chip over 400 ms, and "+{refund}" shows beside it. One tile: "Done" |

Kept from the Trading Post's rules: no near-miss, no slowing past other items, no "Open another" tile on the reveal, no sound or flash that is bigger for a rarer item than the light's colour already says. After "Done" the camera pulls back, the sack is back in its crate (it is never used up), and the tag counts are up to date.

## 6. Phones

- The stall fills a band across the top (the camera of `T1` section 7). The three sack tags are small name tags (92 x 22).
- Under it, one paper roll, full width less 28, that scrolls: "Inside the Oat Sack" and "2 of 5 found"; one row per item (30 high): the rarity square, the name (Fraunces 800 15), the rarity word, and "Found" with the tick; then "The odds, every time", the four chances on one line, and the two pity counts on the next. The roll's lower edge is cut in small teeth, like a till roll.
- The button is full width, pinned above the level strip.
