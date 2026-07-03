import { spawnSync } from "node:child_process";
import path from "node:path";
import { existsSync, readFileSync } from "node:fs";

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const i = trimmed.indexOf("=");
    if (i === -1) continue;
    const key = trimmed.slice(0, i).trim();
    if (!key || process.env[key]) continue;
    let value = trimmed.slice(i + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function run(label, command, args, extraEnv = {}, options = {}) {
  console.log(`STEP=${label}`);
  const stdio = options.inherit ? "inherit" : ["ignore", "pipe", "pipe"];
  const result = spawnSync(command, args, {
    cwd: root,
    env: { ...process.env, ...extraEnv },
    encoding: "utf8",
    stdio,
    windowsHide: true,
    maxBuffer: 50 * 1024 * 1024,
    shell: (options.shell ?? false) && process.platform === "win32"
  });
  if (!options.inherit && result.stdout?.trim()) console.log(result.stdout.trim());
  if (result.status !== 0) {
    console.log(`${label}=FAIL`);
    process.exit(result.status ?? 1);
  }
  console.log(`${label}=PASS`);
}

function assertModuleExists() {
  console.log("STEP=uat028_backend_checks");
  const required = [
    "apps/api/src/modules/go-live/go-live.module.ts",
    "apps/api/src/modules/go-live/pilot-rollout.service.ts",
    "apps/api/test/go-live-control.spec.ts",
    "apps/web/app/(dashboard)/go-live/page.tsx",
    "apps/web/lib/go-live-api.ts",
    "scripts/run-uat-028-validation.mjs"
  ];
  const schema = readFileSync(path.join(root, "prisma/schema.prisma"), "utf8");
  const schemaChecks = ["model PilotRollout", "model CutoverChecklistItem", "model RolloutWave", "model GoLiveDecision"];
  const missingSchema = schemaChecks.filter((token) => !schema.includes(token));
  const missing = required.filter((rel) => !existsSync(path.join(root, rel)));
  if (missing.length || missingSchema.length) {
    console.log(`uat028_backend_checks=FAIL missing=${[...missing, ...missingSchema].join(",")}`);
    process.exit(1);
  }
  console.log("uat028_backend_checks=PASS");
}

const root = process.cwd();
loadEnvFile(path.join(root, ".env.render.local"));
loadEnvFile(path.join(root, ".env"));
const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
const npmShell = { shell: true };

run("uat028_db_generate", npmCmd, ["run", "db:generate"], {}, npmShell);
run("uat028_typecheck", npmCmd, ["run", "typecheck"], {}, npmShell);
run("uat028_lint", npmCmd, ["run", "lint"], {}, npmShell);
run("uat028_ops_tests", npmCmd, ["run", "test", "--workspace", "@maintainpro/api", "--", "--runInBand", "test/go-live-control.spec.ts"], {}, npmShell);
run("uat028_tests", npmCmd, ["run", "test"], {}, npmShell);
run("uat028_build", npmCmd, ["run", "build"], { NODE_ENV: "production" }, { ...npmShell, inherit: true });
assertModuleExists();
console.log("UAT-028 PASS");
