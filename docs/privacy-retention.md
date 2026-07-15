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

Personal analytics data remains until the user deletes the individual record or account. Withdrawn training consent prevents future training extraction; it does not remove private analytics. Model artifacts already trained on previously consented data cannot selectively remove one contribution, so each dataset version retains its consent snapshot and must be invalidated, retired, or retrained when policy requires.

- Raw import files are never retained. Normalized rows, hashes, mappings, importer versions, and review history remain with the account until rollback or account deletion.
- Product analytics contain only allowlisted categorical/bucketed properties, expire after 90 days, and are deleted immediately when personal-analytics consent is withdrawn.
- Completed external-identity deletion tombstones are retained for 180 days to prevent accidental account resurrection during Clerk retries, then purged by the protected maintenance job.
- Access audit records retain pseudonymized integrity evidence while direct relational identifiers are nulled on account deletion.
- Invalidated research manifests remain as provenance; associated athlete records are removed when consent, source data, or the account is withdrawn/deleted.

The protected cron route retries incomplete Clerk identity deletions and purges expired product events and completed tombstones. Application deletion cannot prove immediate erasure from encrypted provider backups; provider backup expiry, restore access, and legal retention still require documented operational controls and jurisdiction-specific review.
