# Privacy policy: DRAFT

*Draft for lawyer review. Not for publication. Brackets must be filled in or removed.*

**Who we are.** [Operator legal name], [registered address], [contact email]. [If required in your countries: data protection officer or representative contact.]

**What this covers.** The game "Steal a Poop" (the website at [domain] and the multiplayer server at [server domain]).

## 1. What we collect

| What | Why | Source |
|---|---|---|
| Email address and password (stored as a hash, never in plain text) | Creating and protecting your account | You |
| Google or Meta account id and display name, if you sign in that way | Signing you in | Google / Meta |
| Nickname | Shown to other players | You |
| Date of birth or age band | To apply the age rules below | You |
| Country | To apply that country's rules | You (sign-up) |
| Parent's email, and the date the parent consented (under-13 accounts only) | Verifiable parental consent | You and your parent |
| Game results: points, words played, wins, steals, when a game finished | Stats, leaderboards, coin rewards and the Daily Table | The game |
| Your coin balance, the items you bought and which ones you wear | The shop (coins are earned by playing and cannot be bought) | The game |
| Your private friend code, and who you are friends with or have asked | Friends and invitations | You |
| Chat messages | Delivering chat to your room | You |
| Chat messages that break the rules, with up to 20 earlier messages from the same room, your user id and room code | Review, and the record needed for safety and legal reasons | Automatic filter and player reports |
| Reports you make about another player's message, and your note | Review of reports | You |
| Appeals you send | Review of your case | You |
| Blocks you make | So you do not see that person's messages | You |
| Moderation decisions about you, and who made them (moderator id, not their details) | Your case record | Our moderators |
| Your login session, kept in your browser's local storage so you stay signed in | Keeping you signed in | Supabase |
| The result of a bot check (Cloudflare Turnstile) when you sign up or reset a password | Stopping automated sign-ups | Cloudflare |
| Technical data: IP address for connection limits and abuse prevention, and error logs without message text | Keeping the service running and safe | Automatic |

We do not read or keep your email address in our own game database: it is held by our sign-in provider, and we keep only a one-way hash of it so that a banned person cannot sign up again.

We do **not** collect precise location, contacts, or device identifiers for advertising. We do **not** show advertising. [Confirm: no analytics cookies. If analytics are added, this section must change.]

## 2. Why we use it, and the legal basis

[Lawyer to confirm the legal basis for each row. Draft: contract (to run your account and games); legitimate interests (preventing abuse and keeping children safe, with the balance documented); legal obligation (reporting child-safety material where required); consent (parental consent for under-13s, and any optional features).]

## 3. Who we share it with

- **Other players** see your nickname, your chat messages, and what you wear (a name color, badge and title). Your wins and scores appear on public leaderboards unless you hide them. Players who needed a parent's permission are never shown on leaderboards. Your friends see whether you are online. Nobody sees your email, date of birth or country.
- **Our moderators** see the content of held messages and reports, your case history, and your country.
- **Service providers** that process data for us (see `processors.md`): database hosting, server hosting, the AI review service, and email.
- **Authorities.** Child-safety material is reported to the relevant body where the law requires it, after a person confirms the report. [Lawyer: list the bodies and the countries.]
- We do not sell personal data.

**The AI review service.** When a message is held, the message text and a few fields (category, the word the filter matched, and whether another player reported it) are sent to an AI model to help decide whether it breaks the rules. The AI's answer is one of: clear, suspend, ban, or escalate to a person. Nothing is banned on the AI's word alone; anything it cannot decide goes to a person. [Operator: confirm the AI provider's data terms.]

## 4. How long we keep it

See `data-retention.md`. In short: your account while it exists plus [N] days after deletion; moderation records and evidence for [period decided by the lawyer], even if you delete your account, because they may be needed for safety or legal reasons.

## 5. Your rights

Depending on where you live, you can ask to access, correct, delete or restrict your data, object to some uses, and withdraw consent. Send a request to [contact]. We reply within [N] days. Some records (moderation evidence, child-safety reports) cannot be deleted while a legal hold applies; we will tell you if this is the case. You may complain to your local data protection authority: [list for launch countries].

## 6. Children

- **Under 13:** an account needs verifiable parental consent. Until consent is given, the account cannot chat or store game results. [Lawyer: confirm the age for each country.]
- **13 and older:** [Lawyer: confirm any extra requirements, for example a higher age in some countries.]
- If we learn that a child has given us information without the right consent, we delete it, subject to any legal hold.

## 7. Security

Passwords are hashed. Data is encrypted in transit (HTTPS and secure WebSockets). Database access is restricted: moderation and block tables cannot be reached from the browser. No system is perfectly secure; if a breach affects you, we will tell you as the law requires.

## 8. International transfers

[Operator: list where each provider stores data. Lawyer: confirm the transfer mechanism.]

## 9. Changes

We will tell you before a material change, and we will ask for consent where the law requires it.

*Last updated: [date]*
