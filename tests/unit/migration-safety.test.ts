import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { MIGRATION_LOCK_ID, assertMigrationSucceeded, containsDestructiveMigration, migrationDecision } from "../../scripts/migration-policy.mjs";

const dataFoundationMigration = readFileSync(
  new URL("../../prisma/migrations/20260714090000_data_foundation_v1/migration.sql", import.meta.url),
  "utf8"
);

describe("production migration policy", () => {
  it("never permits a preview deployment to migrate even when it has a database URL", () => {
    expect(migrationDecision({ VERCEL_ENV: "preview", DATABASE_URL: "postgres://production" })).toMatchObject({ action: "SKIP", reason: "PREVIEW_BLOCKED" });
  });

  it("fails closed when a production deployment cannot run required migrations", () => {
    expect(() => migrationDecision({ VERCEL_ENV: "production" })).toThrow(/DATABASE_URL/);
  });

  it("uses one stable advisory lock identifier across concurrent production attempts", () => {
    expect(MIGRATION_LOCK_ID).toBe(741_913_207);
    expect(migrationDecision({ VERCEL_ENV: "production", DATABASE_URL: "postgres://database" }).action).toBe("RUN");
  });

  it("detects contract-phase migration statements", () => {
    expect(containsDestructiveMigration('ALTER TABLE "User" DROP COLUMN "legacy";')).toBe(true);
    expect(containsDestructiveMigration('ALTER TABLE "User" ADD COLUMN "newField" TEXT;')).toBe(false);
  });

  it("fails deployment when Prisma reports a migration error", () => {
    expect(() => assertMigrationSucceeded(1)).toThrow(/migration failed/i);
    expect(() => assertMigrationSucceeded(0)).not.toThrow();
  });

  it("keeps the data-foundation migration expand-only", () => {
    expect(containsDestructiveMigration(dataFoundationMigration)).toBe(false);
    expect(dataFoundationMigration).toContain("Existing race, account, consent, and prediction records remain unchanged.");
    expect(dataFoundationMigration).toContain('CREATE TABLE "AccountDeletionTombstone"');
  });

  it("enforces immutable cohort, provenance, access, and prediction-input records in PostgreSQL", () => {
    expect(dataFoundationMigration).toContain('CREATE TRIGGER "ImportActionLog_immutable_update"');
    expect(dataFoundationMigration).toContain('CREATE TRIGGER "IdentityResolutionEvent_immutable_update"');
    expect(dataFoundationMigration).toContain('CREATE TRIGGER "AccessAuditLog_immutable_update"');
    expect(dataFoundationMigration).toContain('CREATE TRIGGER "ResearchCohortManifest_immutable_metadata"');
    expect(dataFoundationMigration).toContain('CREATE TRIGGER "ResearchCohortRecord_immutable_rows"');
    expect(dataFoundationMigration).toContain('CREATE TRIGGER "PredictionSnapshot_immutable_input"');
  });
});
