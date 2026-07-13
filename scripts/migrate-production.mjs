import { spawnSync } from "node:child_process";
import process from "node:process";
import { PrismaClient } from "@prisma/client";
import { MIGRATION_LOCK_ID, assertMigrationSucceeded, migrationDecision } from "./migration-policy.mjs";

const decision = migrationDecision(process.env);
if (decision.action !== "RUN") throw new Error(`Migration runner refused to execute: ${decision.reason}`);

const prisma = new PrismaClient();

try {
  await prisma.$transaction(async (transaction) => {
    await transaction.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(${MIGRATION_LOCK_ID})`);
    const result = spawnSync("npx", ["prisma", "migrate", "deploy"], {
      stdio: "inherit",
      shell: process.platform === "win32",
      env: process.env
    });
    assertMigrationSucceeded(result.status);
  }, {
    isolationLevel: "Serializable",
    maxWait: 600_000,
    timeout: 900_000
  });
} finally {
  await prisma.$disconnect();
}
