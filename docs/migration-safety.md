# Database Migration Safety Assessment

## Current controls

- `scripts/migration-policy.mjs` permits automatic migration only when Vercel identifies the deployment as `production`.
- Preview and local builds skip migration even when they can see a database URL.
- A production build without `DATABASE_URL` fails closed.
- `scripts/check-migration-safety.mjs` rejects drop, truncate, rename, and incompatible alter operations unless the exact migration directory receives an explicit reviewed approval.
- `scripts/migrate-production.mjs` holds a PostgreSQL transaction-scoped advisory lock while `prisma migrate deploy` runs. Concurrent deployments wait on the same lock.
- Production migration setup retries transient Prisma database connection failures with bounded exponential backoff. Schema, migration, and other non-connection failures still stop immediately.
- Prisma migration deployment is idempotent, and a non-zero migration exit stops the build before `next build`.
- Prediction Intelligence v3 is expand-only: it creates nullable columns, tables, enums, indexes, and foreign keys without dropping or renaming existing schema.

## Expand-and-contract procedure

1. **Expand:** add nullable columns or parallel tables and deploy code compatible with both schemas.
2. **Backfill:** run an observable, restartable, idempotent job outside request traffic.
3. **Switch:** move reads and writes after validation.
4. **Contract:** remove old structures in a later reviewed release with `APPROVED_DESTRUCTIVE_MIGRATION` set to that exact migration ID.

## Backup, rollback, and recovery

Before any production schema change, an operator must verify the database provider’s current backup or point-in-time recovery state and record the recovery window. If migration fails, deployment stops and the advisory lock is released. Prefer a forward-compatible corrective migration. Provider restore is an emergency procedure only after impact review.

SwimSight does **not** currently claim tested automated schema rollback or tested point-in-time restore. Those capabilities depend on the production database plan and require a separately documented restore drill. Setting an approval variable is not proof that a backup exists.

The migration policy, destructive-SQL detector, stable lock identifier, and failure propagation have automated tests. Actual two-deployment lock contention has not yet been exercised against the production PostgreSQL provider; run that staging drill before treating concurrency recovery as operationally proven.

## Recovery drill still required

Create a disposable database from the latest production backup, run migrations, validate row counts and constraints, then document restore time and owner. Until that drill is completed, recovery readiness remains an operational limitation.
