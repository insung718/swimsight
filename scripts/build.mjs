import { spawnSync } from "node:child_process";
import process from "node:process";

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32"
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run("npx", ["prisma", "generate"]);

if (process.env.DATABASE_URL && process.env.SKIP_PRISMA_MIGRATE !== "1") {
  run("npx", ["prisma", "migrate", "deploy"]);
} else {
  process.stdout.write("Skipping Prisma migrations because DATABASE_URL is not configured for this build.\n");
}

run("npx", ["next", "build"]);
