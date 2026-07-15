# SwimSight

SwimSight is a private-by-default swim performance platform for competitive swimmers and coaches. It combines course-specific race history, personal bests, goal planning, meet preparation, transparent forecasts, team sharing, and a governed data foundation for future model research.

Production forecasts remain conservative and deterministic. SwimSight does **not** claim a trained machine-learning champion until a consented, immutable cohort and prospective evaluation pass the documented release gates. The public evidence state is available at `/validation`.

## Product Surfaces

- **Athlete workspace:** manual result entry, versioned spreadsheet import, PBs, progression, consistency, SPI, goals, meets, gym context, predictions, post-meet review, privacy controls, friends, and communities.
- **Coach workspace:** clubs, permission-reviewed pilot invitations, roster readiness, athlete PB/trend summaries, prediction availability, upcoming meets, and private notes.
- **Pilot enrollment:** expiring, use-limited invitations with the cohort, club, and exact sharing scopes disclosed before acceptance.
- **Internal readiness:** administrator-only raw, consent-eligible, statistically usable, coverage, pilot, evaluation, and immutable cohort status at `/internal/readiness`.
- **Public validation:** thresholded, source-backed, consented aggregate evidence and explicit limitations at `/validation`.

## Data Foundation v1

- Versioned `SWIMSIGHT_CANONICAL`, `GENERIC_RACE_CSV`, and SwimCloud-compatible user-export adapters.
- Preview, explicit column mapping, per-row validation, partial commit, idempotency, provenance, identity review, correction, unmerge, and rollback.
- Formula-injection, malformed encoding/CSV, future-date, duplicate, row, column, cell, and 1.5 MB upload protections.
- Separate versioned consent for personal analytics, model training, public research, and verified guardian authorization.
- Athlete-controlled coach grants for `RESULTS`, `GOALS`, `PREDICTIONS`, and `UPCOMING_MEETS`.
- Immutable cohort manifests with source hashes, consent/schema/importer versions, athlete-level splits, extraction cutoff, distributions, exclusion counts, and prediction-time histories.
- Strict post-meet matching that keeps subjective taper, effort, illness, injury, and usefulness feedback separate from official labels.
- Consent-dependent, allowlisted product events with 90-day expiry and no names, emails, race times, or free text.

## Stack

- Next.js 15 App Router, React, TypeScript, Tailwind CSS, Recharts
- PostgreSQL and Prisma ORM
- Clerk authentication with Google OAuth
- Vitest and Playwright
- Vercel, Vercel Web Analytics, and optional Upstash Redis rate limiting

## Local Setup

```bash
npm install
cp .env.example .env.local
npm run db:generate
npm run db:migrate
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Without Clerk or PostgreSQL configuration, the public site remains available while private account features fail closed.

Enable Google OAuth in Clerk under **User & Authentication > Social connections**. Use exact production domains and redirect allowlists.

### Required Production Secrets

```bash
DATABASE_URL="postgresql://..."
NEXT_PUBLIC_APP_URL="https://your-domain.example"
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_live_..."
CLERK_SECRET_KEY="sk_live_..."
ADMIN_EMAILS="trusted-admin@example.com"
TRAINING_PSEUDONYM_SECRET="independent-32-byte-or-longer-secret"
MODEL_GOVERNANCE_AUDIT_SECRET="independent-32-byte-or-longer-secret"
AUDIT_PSEUDONYM_SECRET="independent-32-byte-or-longer-secret"
ROSTER_IMPORT_SECRET="independent-32-byte-or-longer-secret"
CRON_SECRET="independent-random-secret"
UPSTASH_REDIS_REST_URL="https://..."
UPSTASH_REDIS_REST_TOKEN="..."
```

Never expose a server secret through `NEXT_PUBLIC_*`. Preview deployments never run migrations. Production builds run `prisma migrate deploy` under a PostgreSQL advisory lock and fail closed if migration deployment fails. See [Migration Safety](./docs/migration-safety.md).

## Spreadsheet Import

Use the dashboard’s **Import spreadsheet** workflow or `POST /api/import`.

```json
{
  "mode": "PREVIEW",
  "sourceName": "authorized-export.csv",
  "defaultResultKind": "OFFICIAL",
  "csv": "Date,Event,Time,Course,Meet Name,Result Kind\n2026-03-16,50 Free,25.56,LCM,Spring Meet,OFFICIAL"
}
```

The preview saves no race result. Review mapping, errors, duplicates, and athlete identity, then commit valid row IDs:

```json
{ "mode": "COMMIT", "batchId": "...", "rowIds": ["..."] }
```

`CORRECT_ROW`, `RESOLVE_IDENTITY`, and `ROLLBACK` are account-scoped modes on the same endpoint. The raw file is never retained. See the [canonical import specification](./docs/canonical-import-specification.md) and [example files](./docs/examples/).

## Important APIs

| Endpoint | Purpose |
| --- | --- |
| `GET /api/me` | Authenticated account and onboarding state |
| `GET /api/swims` / `POST /api/swims` | Account-scoped race history and manual entry |
| `GET /api/analytics` | Private athlete analytics and transparent predictions |
| `GET /api/import` / `POST /api/import` | Versioned import lifecycle |
| `GET|PATCH|DELETE /api/me/privacy` | Consent, training exclusion, and account deletion |
| `GET /api/me/export` | No-cache private account archive |
| `GET|POST|PATCH|DELETE /api/race-feedback` | Versioned subjective post-meet context |
| `GET|POST /api/pilots/enroll` | Invitation preview/acceptance and enrollment listing |
| `POST /api/coach/roster` | Permission-reviewed roster invitation import |
| `GET /api/coach/roster` | Grant-scoped coach athlete summaries |
| `GET|POST|DELETE /api/coach/notes` | Private coach notes, separate from labels |
| `GET|POST /api/admin/data-foundation` | Administrator readiness and cohort sealing |
| `/validation` | Public thresholded validation status page |

All private endpoints derive account ownership from Clerk. State changes require same-origin requests, strict schemas, bounded bodies, and rate limits. Administrator status is resolved server-side from `ADMIN_EMAILS`; users cannot promote themselves through profile or database role input.

## Privacy and Security

- Private data is no-cache and account-scoped.
- Coaches need team role, athlete membership, active share grant, and the resource’s exact scope.
- Imports, identity decisions, access events, prediction inputs, and research lineage have database-backed integrity controls.
- Account deletion first creates an external-identity tombstone, invalidates affected cohorts, deletes application data, and retries Clerk identity deletion through the protected cron route.
- Public counts and metrics are suppressed below their configured cohort/sample thresholds.
- Production must use Redis-backed distributed rate limiting; local in-memory limits are per process.
- No system is “unhackable.” Operational MFA, least privilege, secret rotation, dependency patching, backups, restore drills, alerting, and incident response remain required.

See [Security Model](./docs/security-model.md), [Privacy and Retention](./docs/privacy-retention.md), and [SECURITY.md](./SECURITY.md).

## Verification

```bash
npm run db:generate
npx prisma validate
npx tsc --noEmit
npm run lint
npm test
npm run build
npm run test:e2e
npm audit
```

Model evaluation reporting is non-training and can be regenerated with:

```bash
npm run model:report
```

## Documentation

- [Data Foundation Architecture](./docs/data-foundation-architecture.md)
- [Canonical Import Specification](./docs/canonical-import-specification.md)
- [Data Dictionary](./docs/data-dictionary.md)
- [Pilot Operations Guide](./docs/pilot-operations-guide.md)
- [Research Cohort Methodology](./docs/research-cohort-methodology.md)
- [Public Validation Methodology](./docs/public-validation-methodology.md)
- [Prediction Evaluation](./docs/prediction-evaluation.md)
- [Model Governance Policy](./docs/model-governance-policy.md)

## Repository Layout

```text
app/                  Next.js pages and API handlers
prisma/               Schema and expand-only migrations
src/components/       Product and operations UI
src/lib/imports/      Bounded parsers and versioned adapters
src/lib/services/     Account-scoped application services
docs/                 Contracts, methodology, examples, and operations
tests/unit/            Security, consent, import, cohort, and analytics tests
tests/e2e/             Desktop/mobile browser workflows
```

## Current Next Step

Run a small, consented longitudinal pilot and collect real future official outcomes. Do not fabricate athletes, readiness, retention, accuracy, or subgroup evidence. Seal a new cohort version only when the internal readiness surface and governance review support it.
