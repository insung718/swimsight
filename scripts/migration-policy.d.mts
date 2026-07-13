export const MIGRATION_LOCK_ID: number;
export function containsDestructiveMigration(sql: string): boolean;
export function assertMigrationSucceeded(status: number | null): void;
export function migrationDecision(environment: Record<string, string | undefined>): {
  action: "RUN" | "SKIP";
  reason: string;
  message: string;
};
