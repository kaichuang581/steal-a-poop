# Legal and policy drafts

**Status: DRAFT. Not reviewed by a lawyer. Do not publish any of these as final.**

These were written so the product team has something concrete to take to a lawyer. They describe what the app
actually does (from the code in `server/`), and they mark every decision that a lawyer or the operator must make
with `[square brackets]`. Where the law is uncertain, the text says so rather than guessing.

| File | What it is | Who must act |
|---|---|---|
| `privacy-policy.md` | What data is collected, why, who processes it, how long it is kept, rights | Lawyer; operator fills in the brackets |
| `terms-of-service.md` | Rules of play, accounts, chat conduct, moderation and appeals | Lawyer |
| `child-safety-policy.md` | Public statement on children, grooming, reporting | Lawyer and the operator |
| `parental-consent-notice.md` | Text sent to a parent of a child under 13 | Lawyer (consent rules differ by country) |
| `data-retention.md` | Table of each data type, how long it is kept, and the open questions | Lawyer decides every "[decide]" row |
| `data-requests.md` | How to handle access, deletion and correction requests | Operator |
| `processors.md` | Every company that handles data, and what must be signed with each | Operator |
| `lawyer-brief.md` | The questions to ask, in order, with the facts behind them | Operator takes this to the lawyer |

## Facts the drafts rely on (check these still hold when you publish)

- Chat is checked before anyone sees it. A held message is kept with up to 20 earlier messages from the same room as context.
- Held messages, reports and appeals are stored with the sender's user id, room code and text (`server/chat.ts`, `moderation_items`).
- Each held message also gets a snapshot in `moderation_evidence`, which is append-only and never deleted by the application.
- Child-safety items are stored in `child_safety_reports` with a legal-hold flag. Nothing is reported to any authority yet (dry run).
- Moderator actions are logged in `moderation_audit` with ids and reasons, never message text.
- Blocks are stored in `user_blocks`.
- The game server keeps rooms and chat history in memory only, for the life of a room (chat history: last 50 messages per room).
- Sign-in is not built yet. The drafts describe the intended email, Google and Meta sign-in.
- Under-13 accounts need verifiable parental consent before chat or accounts work. This is not built yet.

## In the app

The three public documents are shown in the app and linked from the start screen footer and the chat rules:

- `#/legal/privacy` from `privacy-policy.md`
- `#/legal/terms` from `terms-of-service.md`
- `#/legal/child-safety` from `child-safety-policy.md`

The pages read these Markdown files directly, so editing a file changes the page on the next build. Anything in
`[square brackets]` is shown highlighted, with a count at the top of the page. While `LEGAL_REVIEWED` in
`src/config.ts` is `false`, every page also shows a red "DRAFT" banner. Set it to `true` only after a lawyer has
approved the text and every bracketed field is filled in.

The other files (`data-retention.md`, `data-requests.md`, `processors.md`, `lawyer-brief.md`,
`parental-consent-notice.md`) are internal and are not shown in the app.

## Still not done, and cannot be done by code

- A lawyer must review all of it. `lawyer-brief.md` lists the questions in priority order.
- The operator's name, address, contact, launch countries and retention periods must be filled in.
- Sign-in, the date-of-birth and country screens, and the parental-consent flow that these documents describe are not built.
  Until they are, the policies describe a product that does not fully exist yet.
- Nothing here has been checked against the law of any country.
