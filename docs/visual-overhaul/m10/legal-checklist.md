# The legal pages: a checklist for Brian and Kai

Plan file 11, "The legal pages". This is for Brian and Kai to work through with a lawyer or a legal clinic. It is not
coder work: no coder edits `docs/legal/*`, `LEGAL_REVIEWED` in `src/config.ts` or `e2e/legal.spec.ts` (that test
checks the pages are marked draft, and stays as it is until step 5).

Counted on 2026-11-17 (milestone 10). Square brackets are the fields still to fill in.

| File | "Steal a Poop" | Bracketed fields |
|---|---|---|
| `privacy-policy.md` | 1 (line 7) | 19 |
| `terms-of-service.md` | 1 (line 9) | 14 |
| `parental-consent-notice.md` | 2 (lines 5 and 9) | 7 |
| `data-retention.md` | 0 | 17 |
| `data-requests.md` | 0 | 7 |
| `child-safety-policy.md` | 0 | 6 |
| `lawyer-brief.md` | 0 | 4 |
| `processors.md` | 0 | 4 |
| `README.md` | 0 | 3 (these describe the brackets; nothing to fill) |

## 1. The service's name
- [ ] "Steal a Poop" becomes "Fleeced" in every body: the four places in the table above.
- [ ] Check the page titles and any wording that describes the game (it is no longer "against bots" by default; real
      people come first, with farm sheep filling seats online).

## 2. Who runs it
- [ ] The operator's legal name, postal address and contact email in place of each bracketed field ("[Named person]",
      "[contact email]", "[name, country]", "[domain]", "[server domain]", "[date]").
- [ ] The launch countries ("[list]" in `lawyer-brief.md`).
- [ ] Every "[decide]" and "[Lawyer: confirm]" row, above all the retention table in `data-retention.md`.

## 3. What the site stores and counts
The policy must name each of these. None of them is in it today.
- [ ] The visit counter: one row per UTC day of numbers only (`site_visits`: visits and new browsers), a first-visit flag
      in the browser (`sap:seen`), a code in sessionStorage so a refresh is not a visit, and while a tab is on screen a
      ping every 45 s with a random per-tab code the server holds in memory for 90 s and never writes down
      (src/lib/visit.ts, server/ops/siteStats.ts; CLAUDE.md, the bullet on counting visits).
- [ ] The first-visit answers: country and age, kept in the browser for a guest (`sap:age-check`) and on the server for
      an account, with a `parental_consents` row (method `on_screen`, the time, a hash of the notice shown).
- [ ] Fonts: the game no longer fetches fonts from Google. They ship with the game (`public/fonts/`, plan file 17, C13),
      and the site's content policy no longer allows the two Google font hosts. If any draft mentions Google Fonts,
      take it out; the only Google use left is sign-in (`processors.md`).
- [ ] The device's own caches that are not player data, if the lawyer wants them named: `sap:gfx` (the graphics level
      this device settled on) and `sap:dpr:<scene>`.

## 4. The parent's agreement on screen
- [ ] A lawyer checks the on-screen agreement: the notice and the button "I, as a parent, agree to let my child play",
      shown only when the country's rules say the player is too young.
- [ ] A lawyer checks the age table, `CONSENT_RULES` in src/lib/ageRules.ts (EU and EEA by GDPR art. 8, UK 13, US 13,
      Quebec 14, KR and CN 14, IN and ZA 18, 13 elsewhere, never under 13). The code says: not legal advice, not checked.

## 5. Then, and only then
- [ ] Set `LEGAL_REVIEWED = true` in `src/config.ts`. That removes the DRAFT banner on the legal pages, and
      `e2e/legal.spec.ts` (which checks the banner) is changed in the same commit, by Brian's say-so.
