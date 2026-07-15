# Security Model

## Assets and actors

Protected assets include account identity, race history, goals, predictions, context feedback, team membership, coach notes, consent, exports, and research lineage. Actors are unauthenticated visitors, athletes, coaches/team owners, trusted administrators, Clerk, PostgreSQL, Redis, and Vercel runtime operators.

## Implemented controls

- Clerk authentication with verified email selection.
- Server-derived account ownership on every private API.
- Trusted administrator resolution from `ADMIN_EMAILS`; untrusted stored `ADMIN` roles are demoted.
- Team membership, athlete membership, active share grant, and per-resource scope checks for coach access.
- Same-origin enforcement on state-changing requests and middleware bypass-header rejection.
- Strict Zod schemas, unknown-field rejection, normalized bounded text, bounded JSON bodies, and constrained identifiers.
- IP and authenticated-user rate limits with graceful `429` responses; Upstash provides distributed production enforcement.
- CSV size/row/column/cell limits, malformed encoding/quote rejection, formula rejection, future-date rejection, broad plausibility checks, idempotency, and review-required near matches.
- Source hashes, importer versions, append-only resolution/action history, hash-linked access audit entries, and immutable prediction input fields enforced by a database trigger.
- No-cache API/export responses, CSP, HSTS, frame denial, content sniffing prevention, and restricted browser permissions.
- Consent-filtered research extraction, minimum cohort suppression, 90-day product-event retention, export, withdrawal, and deletion workflows.
- Account-deletion tombstones prevent database resurrection while Clerk deletion is retried.

## Abuse cases covered by tests

Account-to-account object access, coach role escalation, owned-group self-join, revoked sharing, export ownership, consent withdrawal, formula injection, malformed/oversized import, duplicate poisoning, future dates, artifact hash mismatch, rate limiting, and small-cohort suppression are included in the release test suite.

## Honest limitations

- The in-memory rate limiter is per process. Production must configure Upstash Redis to resist serverless-instance bypass.
- CSP currently permits inline styles and scripts needed by the framework/Clerk integration; nonce-based CSP is a future hardening task.
- A verified guardian-consent workflow is not implemented, so minors remain blocked from training/public research instead of being self-certified.
- Application deletion cannot synchronously prove deletion from encrypted provider backups. Provider backup expiry and restore drills require operational evidence.
- Pseudonymized audit/cohort values are not anonymous. Secret access and database access remain high-trust operations.
- Hash chains expose tampering but do not prevent a database administrator from deleting an entire chain. Exporting signed audit checkpoints is future work.
- No system is unhackable. Dependency patching, secret rotation, access reviews, log monitoring, database backups, and incident response remain required.

## Production checklist

1. Restrict Vercel/Clerk/Neon/Upstash access with MFA and least privilege.
2. Keep all server secrets out of `NEXT_PUBLIC_*`; rotate any exposed key.
3. Configure Redis-backed limits, `CRON_SECRET`, and independent 32-byte pseudonym/import secrets.
4. Verify Clerk redirect allowlists and production domains.
5. Apply Prisma migrations before serving the new build.
6. Run dependency audit, unit/integration/e2e tests, and a restore drill.
7. Review denied access events and anomalous import failures.
