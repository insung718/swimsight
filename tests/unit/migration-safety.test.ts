import { describe, expect, it } from "vitest";
import { MIGRATION_LOCK_ID, assertMigrationSucceeded, containsDestructiveMigration, migrationDecision } from "../../scripts/migration-policy.mjs";

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
});
