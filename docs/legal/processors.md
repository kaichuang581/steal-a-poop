# Processors and agreements: DRAFT

*Every company that touches player data needs an agreement. Check each against the provider's current terms.*

| Provider | What it handles | Data | Where stored | To do |
|---|---|---|---|---|
| Supabase (or chosen Postgres host) | Accounts, moderation tables | Everything in `data-retention.md` | [region] | Sign the data processing addendum; choose an EU or US region deliberately; enable backups |
| Fly.io (or chosen host) | The game server, memory state, logs | Chat in memory, IP addresses in logs | [region] | Sign the data processing addendum; confirm log retention; set `TRUST_PROXY` correctly |
| Anthropic | AI review of held messages | Message text, category, matched term, whether reported | [per Anthropic's terms] | Read the current data-use and retention terms. Confirm that content is not used to train models under your account type. Decide whether your privacy policy needs to name them |
| Google, Meta | Sign-in | Account id, display name, email | Their systems | Accept their developer terms; Meta requires app review and a published privacy policy URL |
| Email sender (to be chosen) | Verification, password reset, parent consent | Email addresses | [region] | Choose a provider; sign the addendum |
| Cloudflare (Turnstile) | Bot check on sign-up and password reset | IP address, browser signals | Cloudflare | Sign up for Turnstile; review its data terms; name it in the privacy policy |
| GitHub | Hosting the website, code | No player data | US | None for player data. Keep secrets out of the repository |
| NCMEC / other authorities | Receive child-safety reports | Evidence in reports | Their systems | Registration first; see `lawyer-brief.md` |

## Cross-border transfers

List the country of each provider's storage and the mechanism the lawyer accepts for each launch country.
