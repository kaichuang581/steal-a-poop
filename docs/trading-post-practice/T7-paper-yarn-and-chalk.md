# T7. Paper, yarn and chalk: this screen's interface pieces

Sizes are px at 1440 x 900. Fonts: Fraunces 800 for names, numbers and buttons; Nunito 800 for small labels (700 for the footer). Nothing under 11 px. Every icon is a grid in `X1` at 2 px. Corners are stepped in 2 px squares, never rounded. Colours: paper `#FFF6E0` with lip `#DCC9A0`; ink `#2B2230`; soft text `#6B5B4B`; yarn `scarfRed 0` with shade `scarfRed −2`; chalk `#F3EEE6`; wool and lantern are the kit's tokens. All pairs used for text pass 4.5 to 1 (`checks.py`).

## 1. The paper tag

The one surface for words in the Trading Post.
- A paper rectangle, its four corners stepped twice (2 px, 4 px), a 3 px lip under it in the lip colour, a one-pixel ink outline.
- A 4 x 4 ink hole at the top middle, and a 2 px yarn string from the hole straight up to the thing it hangs from (a beam, a bench edge, a step). A tag that is pinned or stands by itself has no hole or string.
- Picked: a 3 px lantern border round it.
- It hangs from a real point in the scene: project that point each frame and draw the tag under it.

## 2. The four tabs: tags on a yarn line

A line of red yarn (a 4 px shade line with a 2 px lighter line on it) runs across the top, from 60 left of the first tag to 60 right of the last, sagging 4 px. Four tags hang from it by small wooden pegs (8 x 14, `wood 1`): Feed Sacks (sack icon), Bell Shelf (bell), Missions (pinned slip), Barn Book (book). Each 156 x 40, 18 apart, icon then label in Fraunces 800 17.
- The tab you are at: lantern face, hanging 6 px lower.
- Moving: all four swing 6° once.
- Phones: 84 x 50, the icon above the label (Fraunces 800 12).
- These are real tabs for keyboards and screen readers (`role="tablist"`, arrow keys move between them).

## 3. The wallet and close

Top right, 18 from the edges, 8 apart, each a wool tile 34 high with a 4 px side: Wool Coins (the coin icon and the amount with thousands commas, Fraunces 800 18), Golden Bells (the bell icon and the amount), and close (the cross). When an amount changes it counts to the new value over 400 ms. "The Trading Post" is written top left in Fraunces 800 24, cream with a 2 px ink shadow (not shown on phones).

## 4. Buttons

A tile: a face, a 6 px darker side under it, an ink outline, a 2 px lighter line along the top. Lantern when it can be pressed; pale `#E9DDC3` with soft text when it cannot, and then it always says why. Pressed: the face drops 3 px onto its side. One main button per stop at most.

## 5. The level strip

One paper strip along the bottom, 1,040 wide (phones: full width less 36), 30 high, 58 from the bottom:
- a lantern block with "Level 4: Yearling" (Fraunces 800 14);
- a yarn-ball icon, then **a knitted row**: a bar 12 high whose filled part is drawn as stitches, a red block every 8 px with a darker "V" on it. It grows one stitch at a time; the empty part is plain pale paper, so empty reads as empty;
- "140 XP to level 5";
- the coin icon and "180 / 300 from games today".
Phones: the block and the knitted row only; "180 / 300 today" sits under the wallet in Nunito 800 11.

Under the strip, centred, Nunito 700 11, soft: "Only for show: nothing here changes how a game plays. Wool Coins and Golden Bells are earned by playing, never bought."

## 6. Chalk boards

Words on the odds board are chalk on `iron −1`. No panel, no border drawn by the interface: the board is a model, and the text is placed on its face by projecting the face's corners.

## 7. Rarity

One way everywhere: an 8 px square and the word. Common and Starter `#8E8A84`, Uncommon `#4E9A6A`, Rare `#4F86C6`, Legendary `#D9A02E`, Bell Shelf `#C98A1E`, Mission `#C8643C`. These are the game's existing rarity colours where it has them; keep the game's values if they differ. The reveal's light uses a paler tint of the same colour.

## 8. Sounds

Keep today's: a coin clink on spending coins, a burlap rustle on picking a sack, a bell on spending Bells, a page turn in the Barn Book. All obey mute.

## 9. Reach

Every pressable thing is at least 44 x 44 to the finger, has a visible lantern focus ring, and can be reached by Tab in reading order: tabs, the stop's items left to right, the main button, the wallet. Items in the scene are real buttons laid over their models.
