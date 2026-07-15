# Data Dictionary

This dictionary covers the Data Foundation v1 entities. The Prisma schema is the authoritative field-level contract.

| Entity | Purpose | Sensitive content | Retention/deletion behavior |
| --- | --- | --- | --- |
| `User` | Account profile, role, onboarding, consent state | Name, email, age, category, region | Deleted on account deletion |
| `SwimResult` | Official or training result | Race time, meet, event, date | Account-owned; deleted with user or import rollback |
| `ImportBatch` | Versioned preview/commit/rollback unit | Source filename and file hash, no raw file | Deleted with user |
| `ImportRow` | Row-level validation and provenance | Normalized result and source IDs | Deleted with batch |
| `ImportIdentityCandidate` | Reviewable athlete identity match | Source name, birth year, source athlete ID | Deleted with batch |
| `IdentityResolutionEvent` | Merge, reject, and unmerge history | Actor account ID | Deleted with candidate |
| `PredictionSnapshot` | Original immutable forecast and later evaluation | Feature snapshot and performance outcome | Deleted with user |
| `RaceFeedback` | Optional post-meet context | Illness, injury, taper, effort, note | Separate from official labels; versioned and user-deletable |
| `PilotCohort` | Controlled pilot definition | No athlete data | Administrator-managed |
| `PilotInvitation` | Hashed invitation token, limits, expiry | Creator reference; raw token is not stored | Revocable; deleted with cohort |
| `PilotEnrollment` | Athlete participation and withdrawal | Athlete/team relation | Deleted with athlete; withdrawal is preserved while account exists |
| `AthleteShareGrant` | Athlete-controlled coach scopes | Athlete/team relation | Withdrawable; deleted with athlete/team |
| `CoachNote` | Private coach note | Free-text note | Separate from race labels; deleted with athlete/team/author |
| `AccessAuditLog` | Allowed and denied athlete-data access | Pseudonyms and bounded metadata, no raw result | Referential IDs become null on account deletion; integrity record remains |
| `ProductAnalyticsEvent` | Privacy-conscious product usage | Allowlisted buckets only | 90-day expiry; deleted on account or analytics-consent withdrawal |
| `ResearchCohortManifest` | Immutable dataset version and hashes | Suppressed aggregate distributions | Invalidated, not rewritten, after source correction/withdrawal |
| `ResearchCohortRecord` | Lineage from manifest to source result | HMAC athlete pseudonym and feature snapshot | Deleted on consent withdrawal or account/result deletion; manifest invalidated |
| `AccountDeletionTombstone` | Prevent deleted Clerk identity from recreating data during retries | Clerk identifier | Completed tombstones retained 180 days, then purged |

## Classification

- **Direct identifiers:** name, email, Clerk ID. Never enter product analytics, model features, or public output.
- **Performance data:** time, event, course, date, meet, goals, predictions. Private by default.
- **Sensitive context:** illness, injury, notes. Optional, private, and excluded from training labels.
- **Operational pseudonyms:** HMAC values for access logs and cohort exports. Pseudonymization is not anonymization.
- **Public aggregate:** output meeting active research consent and minimum cohort/sample thresholds.
