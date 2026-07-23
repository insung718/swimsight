export const MIGRATION_LOCK_ID: number;
export const MIGRATION_CONNECTION_ATTEMPTS: number;
export function containsDestructiveMigration(sql: string): boolean;
export function assertMigrationSucceeded(status: number | null): void;
export function isRetryableMigrationConnectionError(error: unknown): boolean;
export function migrationDecision(environment: Record<string, string | undefined>): {
  action: "RUN" | "SKIP";
  reason: string;
  message: string;
};
