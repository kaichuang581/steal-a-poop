# Handling access, correction and deletion requests: DRAFT

**Who handles them.** [Named person], at [contact email]. Backup: [name].

## Steps

1. **Receive.** Log the date, the person's claim, and the country. Reply within [3] working days to say it was received.
2. **Verify identity.** Ask the sender to send the request from the account's email address. For a child's account, the parent who gave consent must send it. Do not hand over data to someone who cannot be verified.
3. **Decide the type:**
   - **Access (a copy):** use `npm run mod:export -- --user <id> --by <your moderator id>` for moderation data, plus an export from the accounts database. Review the file before sending: remove other people's personal data (other players' messages shown as context are other people's data).
   - **Correction:** fix account fields directly. Moderation records are not rewritten; add a note instead.
   - **Deletion:** delete the account and personal data as described in `data-retention.md`. Keep what the lawyer says must stay (evidence, reports) and tell the person plainly that some records remain and why.
   - **Withdraw parental consent:** close or limit the child's account the same day.
4. **Reply** within [30 days] (or the country's deadline). Say what was done and what was kept.
5. **Log** the outcome. Keep the log for [decide].

## Rules

- Never delete evidence or child-safety reports because a person asks. If a legal hold applies, say so.
- Never tell someone that a report was made to an authority if the law forbids it. [Lawyer: confirm.]
- Escalate anything involving a child's safety to the child-safety lead straight away.
