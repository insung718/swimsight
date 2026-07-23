export const MIGRATION_LOCK_ID = 741_913_207;
export const MIGRATION_CONNECTION_ATTEMPTS = 5;

export function containsDestructiveMigration(sql) {
  return /\b(DROP\s+(TABLE|COLUMN|TYPE)|TRUNCATE\s+TABLE|ALTER\s+COLUMN|RENAME\s+(COLUMN|TABLE))\b/i.test(sql);
}

export function assertMigrationSucceeded(status) {
  if (status !== 0) throw new Error(`Prisma migration failed with exit code ${status ?? "unknown"}.`);
}

export function isRetryableMigrationConnectionError(error) {
  if (!error || typeof error !== "object") return false;
  if (error.code === "P1001" || error.code === "P1002") return true;

  const message = "message" in error && typeof error.message === "string" ? error.message : "";
  return /\bP100[12]\b|can't reach database server|timed out while connecting/i.test(message);
}

export function migrationDecision(environment) {
  const vercelEnvironment = environment.VERCEL_ENV ?? "local";
  if (vercelEnvironment === "preview") {
    return {
      action: "SKIP",
      reason: "PREVIEW_BLOCKED",
      message: "Skipping Prisma migrations: preview deployments are never permitted to migrate a database."
    };
  }
  if (vercelEnvironment !== "production") {
    return {
      action: "SKIP",
      reason: "NON_PRODUCTION",
      message: "Skipping Prisma migrations: this is not a production deployment."
    };
  }
  if (!environment.DATABASE_URL) {
    throw new Error("Production deployment refused: DATABASE_URL is missing, so required migrations cannot be verified.");
  }
  return {
    action: "RUN",
    reason: "PRODUCTION_ONLY",
    message: "Running production migrations under a PostgreSQL advisory lock."
  };
}
