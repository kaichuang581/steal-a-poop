# Lawyer brief

**Purpose.** Short facts and questions so a lawyer can give useful answers in one or two meetings. Hand over the files in this folder with it.

## What the product is

A free browser word game. Players sign in (email, Google, Meta), play alone or in rooms of 4 to 10, and use a room chat. No ads, no payments, no user-generated content other than nicknames and chat. Children may play. The operator is [name, country]. Launch countries: [list].

## What the system does that matters legally

- **Chat is pre-moderated.** Each message is checked before anyone sees it. A message that trips the check is held, the sender is suspended for [24 hours] at once, and the message goes to review by an AI model and then a person.
- **Stored records.** A held message is stored with the sender's id, the room, and the 20 messages before it. A permanent evidence snapshot is also stored.
- **Child safety.** A short list of grooming phrases triggers an urgent item. A person confirms before any report. The reporting to NCMEC is not connected; reports are currently stored and nothing is sent.
- **Age.** Intended rule: 13 or older may sign up; under 13 needs verifiable parental consent. Country is collected at sign-up and rules are applied per country.
- **AI.** An AI model sees the text of held messages. It cannot ban on its own: anything it is unsure of, and all child-safety items, go to a person.
- **Logs.** Server logs contain ids and timings, not message text.

## Questions, in order of importance

1. **Reporting duties.** In each launch country, what must we report about suspected child sexual abuse material or grooming, to whom, how fast, and what protections do we have for reporting? Do we need to register with NCMEC (US) or an equivalent before launch?
2. **Children's data.** Is "13 and over, parental consent under 13" lawful in each launch country? What counts as verifiable parental consent in each? Are there design duties (for example the UK Children's Code) that apply to a game with chat?
3. **Evidence.** How long must we keep evidence and reports, and are we allowed to keep them after an account is deleted? What are our duties about who may access them?
4. **Privacy policy.** Does `privacy-policy.md` cover what the law requires in each country (legal basis, rights, transfers, complaint authority)? What is missing?
5. **Terms.** Is the suspend-first rule, with review and appeal, enforceable and fair under consumer law? Can we ban an account on the basis of an AI-assisted review followed by a person?
6. **Liability.** What can we disclaim, and where are we not allowed to?
7. **AI processing.** Does sending message text to an AI provider need extra disclosure or a transfer mechanism?
8. **Chat as a risk.** Given children play, should chat be off by default for under-16s, or limited to quick phrases? What risk do we carry if chat stays free text?
9. **Retention table.** Please fill the `[decide]` cells in `data-retention.md`.
10. **Data subject requests.** Is `data-requests.md` an adequate procedure?
11. **Moderator welfare and access.** Any legal duties around staff who see this material, and who may be given access?

## Added with friends, leaderboards and coins

- Players find friends by a private code; there is no name search. Friends can invite each other to rooms and see who is online. A child
  waiting for a parent's consent cannot use friends.
- Public leaderboards show nicknames and scores. Players who needed a parent's consent are never shown.
- An in-game currency ("coins") is earned only by playing and spent only on cosmetic items. It cannot be bought with money, given or
  traded. There is no gambling-like mechanic.

Questions: (12) Does earned virtual currency used by children raise any rules (consumer protection, loot-box style rules, unfair
commercial practices) when no money is involved? (13) Are public leaderboards with nicknames acceptable for 13 to 17 year olds, and should
they default to hidden for teenagers? (14) Is a friend-code system enough protection against contact by strangers, or do you want friends
disabled for under-16s? (15) What should happen to coins and items when an account is closed by us for breaking the rules? (16) If someone deletes their account while suspended, we keep a one-way hash of their email for the length of the suspension (or 7 days for an open case) so they cannot simply start over. Is that a lawful basis, and is the period proportionate, given they asked for deletion?

## What we are not asking

We do not need advice on game design, pricing, or trademark right now.
