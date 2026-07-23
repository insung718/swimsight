import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  MIGRATION_CONNECTION_ATTEMPTS,
  MIGRATION_LOCK_ID,
  assertMigrationSucceeded,
  containsDestructiveMigration,
  isRetryableMigrationConnectionError,
  migrationDecision
} from "../../scripts/migration-policy.mjs";

const dataFoundationMigration = readFileSync(
  new URL("../../prisma/migrations/20260714090000_data_foundation_v1/migration.sql", import.meta.url),
  "utf8"
);
const raceLabMigration = readFileSync(
  new URL("../../prisma/migrations/20260715110000_race_lab_v1/migration.sql", import.meta.url),
  "utf8"
);
const raceLabOwnerMigration = readFileSync(
  new URL("../../prisma/migrations/20260719120000_race_lab_owner_invariants/migration.sql", import.meta.url),
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
    expect(MIGRATION_CONNECTION_ATTEMPTS).toBe(5);
    expect(migrationDecision({ VERCEL_ENV: "production", DATABASE_URL: "postgres://database" }).action).toBe("RUN");
  });

  it("retries only transient database connection failures", () => {
    expect(isRetryableMigrationConnectionError({ code: "P1001" })).toBe(true);
    expect(isRetryableMigrationConnectionError(new Error("P1002: timed out while connecting"))).toBe(true);
    expect(isRetryableMigrationConnectionError(new Error("Migration failed to apply cleanly"))).toBe(false);
    expect(isRetryableMigrationConnectionError(null)).toBe(false);
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

  it("keeps Race Lab expand-only and protects official provenance and saved snapshots", () => {
    expect(containsDestructiveMigration(raceLabMigration)).toBe(false);
    expect(raceLabMigration).toContain("Existing results, predictions, and goals remain unchanged.");
    expect(raceLabMigration).toContain('CREATE TRIGGER "RaceSplit_source_immutable"');
    expect(raceLabMigration).toContain('CREATE TRIGGER "RaceLabScenario_immutable_update"');
  });

  it("enforces Race Lab account ownership at the database boundary", () => {
    expect(containsDestructiveMigration(raceLabOwnerMigration)).toBe(false);
    expect(raceLabOwnerMigration).toContain('CREATE TRIGGER "RaceSplit_owner_match"');
    expect(raceLabOwnerMigration).toContain('CREATE TRIGGER "RaceLabScenario_owner_match"');
    expect(raceLabOwnerMigration).toContain('"userId" = NEW."userId"');
    expect(raceLabOwnerMigration).toContain('CREATE OR REPLACE FUNCTION "enforce_race_lab_scenario_immutability"');
    expect(raceLabOwnerMigration).toContain("(to_jsonb(NEW) - 'baseResultId') = (to_jsonb(OLD) - 'baseResultId')");
  });
});
