# Privacy, Consent, and Retention

## Consent purposes

SwimSight records separate, versioned consent for personal analytics, anonymized model training, public aggregate research, and guardian authorization. Training or research consent never follows automatically from personal analytics consent. Withdrawal is append-only in `ConsentEvent` and immediately excludes future training extraction.

Users under 18 require active guardian consent before model-training or public-research consent can be granted. Guardian consent cannot be self-certified through the athlete API. Users with unknown age are excluded from model-training extraction until age is resolved. No verified guardian workflow is implemented yet, so minor training and research participation remain unavailable rather than being inferred. This is a technical safeguard, not a substitute for jurisdiction-specific legal review.

## Data rights

- `GET /api/me/export` returns a machine-readable JSON export of account data.
- `DELETE /api/me/privacy` with `TRAINING_DATA` excludes future training use while retaining personal analytics.
- `DELETE /api/me/privacy` with `ACCOUNT` deletes the application record and cascaded data, then requests Clerk identity deletion.
- Race feedback supports edit history and soft deletion and remains physically separate from official labels.

## Pseudonymization and aggregates

Training extraction replaces account IDs with HMAC-SHA-256 pseudonyms using a server-only secret of at least 32 characters. The secret must never use a `NEXT_PUBLIC_` name or appear in browser bundles. Public research output is suppressed below 25 consented athletes and must not expose row-level pseudonyms.

Pseudonymization is not anonymization: authorized operators with the secret and source database may be able to link records. Access must remain limited and logged.

## Retention

Personal analytics data remains until the user deletes it or the account. Withdrawn training consent prevents future training extraction; it does not delete the user’s private analytics. Model artifacts already trained on previously consented data cannot selectively remove one contribution, so each dataset version must retain its consent snapshot and be retired or retrained when policy requires.

No automatic retention deletion schedule is implemented yet. Before public launch at scale, SwimSight must define jurisdiction-reviewed retention periods, backup expiry behavior, support ownership, and a completed identity-deletion retry process.
