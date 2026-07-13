import { spawnSync } from "node:child_process";
import process from "node:process";
import { migrationDecision } from "./migration-policy.mjs";

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32"
  });

  if (result.status !== 0) process.exit(result.status ?? 1);
}

run("npx", ["prisma", "generate"]);

const migration = migrationDecision(process.env);
process.stdout.write(`${migration.message}\n`);
if (migration.action === "RUN") {
  run("node", ["scripts/check-migration-safety.mjs"]);
  run("node", ["scripts/migrate-production.mjs"]);
}

run("npx", ["next", "build"]);
