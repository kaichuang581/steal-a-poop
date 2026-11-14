# The Trading Post v2 for Claude Code: a second currency, Feed Sacks and the daily shelf

Version 1, 12 November 2026. Builds on the Trading Post that exists today (Wool Coins earned by play, a daily cap of 300 from games, levels, milestones, direct-price bomb skins, bursts and fuse sounds, streak-earned items). Cosmetics only: nothing here changes how a game plays.

Milestones: **T0** (rules and data), **T1** (Feed Sacks: odds, pity, duplicates, the reveal), **T2** (the daily shelf), **T3** (Golden Bells, the second currency, without payments), **T4** (payments: not approved; needs a parent account holder, a server and a legal check first).

---

## 0. For Brian

Save as `docs/PLAN_TRADING_POST_V2.md`, add the Part 1 block to `CLAUDE.md`, and paste:

```
Read @docs/PLAN_TRADING_POST_V2.md in full. Do Milestone T0: the catalogue fields, the rarity table, the pure modules and their tests. No screen changes. Stop there.
```

Then T1, T2 and T3, one per session. T4 waits for a separate decision.

---

## 1. Guardrail addition (append to CLAUDE.md)

```markdown
- Trading Post v2 (approved by Brian, 2026-11-12): docs/PLAN_TRADING_POST_V2.md.
  (a) Cosmetic only: nothing bought, earned or opened changes how any game plays.
  (b) Feed Sacks cost Wool Coins only. Golden Bells (the second currency) can never open, buy or discount a Feed Sack,
      directly or by conversion. The two currencies never convert into each other.
  (c) Every item that can come from a Feed Sack can also be bought directly at a fixed price; achievement items
      (streaks, milestones) are never in sacks and never for sale.
  (d) The odds are shown before every opening and are the real odds. The reveal shows the result honestly: no fake
      near-misses, no animation that suggests a better result than the one rolled.
  (e) No countdown timers, push notifications or "last chance" wording anywhere in the Trading Post.
```

---

## 2. The two currencies

| | Wool Coins (exists) | Golden Bells (new, T3) |
|---|---|---|
| How you get it | playing (daily cap of 300 from games), levels, milestones, duplicate refunds | T3: level-ups and rare achievements only (small amounts); T4 (if approved): bought |
| Spent on | direct shop items, the daily shelf, Feed Sacks | direct shop items and the Bell shelf only |
| Opens Feed Sacks | yes | **never** |
| Shown as | coin icon, as now | a small brass bell icon, with the real-money value beside every Bell price once T4 exists |

Why the split: random rewards are kept apart from anything that may one day cost real money. A child can never spend money, even indirectly, on a chance at an item.

The footer line stays true and is updated: "Only for show: nothing in the Trading Post changes how a game plays. Wool Coins are earned by playing, never bought. Feed Sacks only take Wool Coins."

---

## 3. Feed Sacks (Milestone T1)

A Feed Sack is a burlap sack from the farm that holds one random cosmetic from its season's pool.

### 3.1 Price and pool
- **Price:** 250 Wool Coins (about one good day of play). One sack at a time; no bundles, no "open 10".
- **Pool:** one pool per season (`src/skin/shop/sacks.ts`), listing item ids from the catalogue with a rarity. Every item in the pool also has a direct price in the shop (guardrail (c)).

### 3.2 Rarity and odds

| Rarity | Chance | Direct price of such items | Duplicate refund |
|---|---|---|---|
| Common | 62% | 300 to 400 | 60 coins |
| Uncommon | 28% | 450 to 600 | 120 coins |
| Rare | 8% | 700 to 900 | 250 coins |
| Legendary | 2% | 1,500 | 600 coins |

- The odds table is shown on the sack's card ("?" opens it) and again on the confirm step: "Common 62% · Uncommon 28% · Rare 8% · Legendary 2%. You can also buy any of these items directly."
- Within a rarity, every item has the same chance; the card lists them all with an "owned" tick.

### 3.3 Pity (guaranteed results)
- **Rare or better at least every 10 sacks.** Counter `sinceRare`; on the 10th sack without a rare or legendary, the roll is forced to rare-or-better (rare 80%, legendary 20%).
- **Legendary at least every 40 sacks.** Counter `sinceLegendary`.
- Both counters are shown on the sack card: "Rare or better within 4 sacks · Legendary within 31 sacks."
- Counters persist per player, never reset by time, and reset only when the guaranteed tier is actually received.

### 3.4 Duplicates
- A duplicate converts at once into the refund in 3.2, shown on the reveal: "You already have Ember. +120 Wool Coins."
- **No-duplicate rule for rare and legendary:** if the player owns every item of the rolled tier, the roll moves to the next tier down that still has an unowned item; if they own the whole pool, the sack is greyed out with "You have everything in this season's sack."

### 3.5 The reveal (honest)
- The sack sits on the counter, wobbles twice (0.6 s), and its string glows with the colour of the result's rarity from the first frame: grey common, green uncommon, blue rare, gold legendary. The item then pops out with its name and rarity.
- **There is no near-miss:** the animation never shows a better item passing by, never slows down near a legendary, and never shows "so close". The rarity colour is visible from the start, so the suspense is "what is it?", not "did I almost win?". Guardrail (d). Decision 8.1.
- A legendary gets a bigger effect (confetti in the season's colours, the fuse-sound chime) because it is genuinely rare, not to suggest that others nearly were.
- Under reduced motion: no wobble, the item appears at once.
- One button after the reveal: **Wear it** or **Done**. No "Open another" button on the reveal screen; the player returns to the shop first.

### 3.6 Randomness
- `crypto.getRandomValues`, not a seed the player could predict. The roll, the pity counters and the result are written in one step before the animation starts, so closing the tab mid-reveal never loses or repeats a result.

---

## 4. The daily shelf (Milestone T2)

A small shelf at the top of the shop: **four items a day at a lower price**.

- Rotates at local midnight (`localDateKey`, as Counting Sheep). The same four items for everyone that day: seeded from the date.
- **Discount:** 25% off the item's normal Wool Coin price (rounded to the nearest 10). Example: Ember, normally 400, is 300 today.
- **Only a discount:** every item on the shelf is always buyable at its normal price in its own section. Nothing appears only on the shelf, and nothing on the shelf is gone forever.
- Picks: never an owned item for this player if avoidable (re-draw from the pool for the player's view, still deterministic per player and date); at most one rare; no achievement items; no Feed Sacks (sacks are never discounted).
- **No countdown timer** and no "last chance" wording. The shelf says only "Today's shelf" and, in small type, "Changes at midnight."
- No notification or Home badge announces the shelf.

---

## 5. Golden Bells without payments (Milestone T3)

- Earned only in small amounts: 5 per level-up, 20 for each 7-night dream streak milestone, 10 for each milestone in the table. Shown next to Wool Coins in the header.
- A **Bell shelf**: a few cosmetics priced in Bells only (for example a brass bell collar, a golden quill burst). Direct purchase, fixed price, no randomness.
- Type-level separation: `type Currency = 'wool' | 'bells'`; `openSack(state)` takes only a `WoolBalance`; a test proves no code path spends Bells on a sack or converts between currencies.

---

## 6. Payments (Milestone T4, not approved)

Do not build until Brian decides, after these are in place:
- an adult account holder for the payment provider (a parent);
- a server that owns the Bell balance (local storage can be edited);
- parental consent for under-13s and a privacy policy (COPPA in the US; Canada's privacy rules);
- refunds handled within 48 hours, a monthly spending limit per account, and the real-money price shown beside every Bell price;
- a short check with a lawyer or legal clinic.

Feed Sacks stay Wool-only even then (guardrail (b)).

---

## 7. Files, data and tests

### 7.1 Files
- `src/skin/shop/catalog.ts`: add `rarity` and `inSack: boolean` to each item; `achievement` items keep `inSack: false`, no price.
- `src/skin/shop/sacks.ts`: pools and the odds table (single source for the UI and the roll).
- `src/skin/shop/roll.ts`: pure `rollSack(owned, counters, rand) -> { itemId, tier, duplicate, refund, counters }`.
- `src/skin/shop/shelf.ts`: pure `dailyShelf(dateKey, owned) -> { itemId, price }[]`.
- `src/skin/shop/wallet.ts`: balances for both currencies (`sap:wool`, `sap:bells`), pity counters (`sap:sack-pity`), a log of the last 50 openings (`sap:sack-log`) shown to the player as "Your sacks".
- UI: a Feed Sacks section and a Today's shelf section in the Trading Post, styled as the existing paper cards and wood signs.

### 7.2 Tests
1. Over 1,000,000 simulated rolls with no pity, tier frequencies are within 0.2 percentage points of the table.
2. No run of 10 sacks lacks a rare or better; no run of 40 lacks a legendary.
3. A duplicate grants exactly the refund for its tier and the item count does not change.
4. With every rare owned, a rare roll falls back to an unowned uncommon; with the pool complete, the sack cannot be opened.
5. Bells can never open a sack (type and runtime check); no function converts Wool to Bells or back.
6. The daily shelf is the same for a given date and player, changes on the next date, never includes an achievement item or a sack, and every price equals 75% of the normal price rounded to 10.
7. Closing the page during the reveal leaves exactly one result recorded.
8. The odds shown in the UI are read from `sacks.ts`, the same object the roll uses.

---

## 8. Decisions

| # | Decision | Alternative |
|---|---|---|
| 8.1 | **No near-miss effect.** Requested, but not built: a near-miss makes a loss look like an almost-win to push one more try, the gambling technique most clearly linked to compulsive play, and the players are children. The honest suspense of 3.5 replaces it | (not offered) |
| 8.2 | Sacks cost 250 Wool Coins, one at a time | 200 or 300; bundles are not offered |
| 8.3 | Pity at 10 (rare) and 40 (legendary) | 8 and 30 for kinder luck |
| 8.4 | Daily shelf discount 25%, four items | 20% or 30%; three or five items |
| 8.5 | Golden Bells earned only in T3; buying them waits for T4 | skip Bells entirely and keep one currency |
| 8.6 | No "Open another" button on the reveal | allow it |
