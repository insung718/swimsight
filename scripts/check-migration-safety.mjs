import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { containsDestructiveMigration } from "./migration-policy.mjs";

const migrationsDirectory = path.resolve("prisma/migrations");
const directories = (await readdir(migrationsDirectory, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();
const violations = [];

for (const directory of directories) {
  const migrationPath = path.join(migrationsDirectory, directory, "migration.sql");
  const sql = await readFile(migrationPath, "utf8");
  if (containsDestructiveMigration(sql) && process.env.APPROVED_DESTRUCTIVE_MIGRATION !== directory) {
    violations.push(directory);
  }
}

if (violations.length) {
  throw new Error(`Destructive or contract-phase migrations require an explicit reviewed approval: ${violations.join(", ")}`);
}

process.stdout.write(`Migration safety check passed for ${directories.length} migration directories.\n`);
