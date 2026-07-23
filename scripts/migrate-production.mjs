import { spawnSync } from "node:child_process";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";
import { PrismaClient } from "@prisma/client";
import {
  MIGRATION_CONNECTION_ATTEMPTS,
  MIGRATION_LOCK_ID,
  assertMigrationSucceeded,
  isRetryableMigrationConnectionError,
  migrationDecision
} from "./migration-policy.mjs";

const decision = migrationDecision(process.env);
if (decision.action !== "RUN") throw new Error(`Migration runner refused to execute: ${decision.reason}`);

const prisma = new PrismaClient();

try {
  for (let attempt = 1; attempt <= MIGRATION_CONNECTION_ATTEMPTS; attempt += 1) {
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
      break;
    } catch (error) {
      const retryable = isRetryableMigrationConnectionError(error);
      if (!retryable || attempt === MIGRATION_CONNECTION_ATTEMPTS) throw error;

      const delayMs = 2 ** (attempt - 1) * 2_000;
      process.stderr.write(
        `Database connection unavailable during migration setup (attempt ${attempt}/${MIGRATION_CONNECTION_ATTEMPTS}); retrying in ${delayMs / 1_000}s.\n`
      );
      await delay(delayMs);
    }
  }
} finally {
  await prisma.$disconnect();
}
