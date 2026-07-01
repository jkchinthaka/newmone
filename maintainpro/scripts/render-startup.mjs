import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const root = process.cwd();

if (process.env.MAINTAINPRO_RUN_STARTUP_SEED === "true") {
  const seedPath = path.join(root, "apps/api/dist/database/seed.js");
  if (existsSync(seedPath)) {
    console.log("[startup] MAINTAINPRO_RUN_STARTUP_SEED=true — running seed");
    const result = spawnSync(process.execPath, [seedPath], {
      cwd: root,
      env: process.env,
      encoding: "utf8",
      stdio: "inherit"
    });
    if (result.status !== 0) {
      console.error(`[startup] Seed failed with exit code ${result.status ?? "unknown"}`);
      process.exit(result.status ?? 1);
    }
    console.log("[startup] Seed completed successfully");
  } else {
    console.warn(`[startup] Seed file not found at ${seedPath} — skipping`);
  }
}

const apiEntry = path.join(root, "apps/api/dist/main.js");
const result = spawnSync(process.execPath, [apiEntry], {
  cwd: root,
  env: process.env,
  encoding: "utf8",
  stdio: "inherit"
});

process.exit(result.status ?? 1);
