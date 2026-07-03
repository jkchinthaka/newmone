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
  console.log("STEP=uat029_backend_checks");
  const required = [
    "apps/api/src/modules/erp-integration/erp-integration.module.ts",
    "apps/api/src/modules/erp-integration/connectors/erp-connectors.ts",
    "apps/api/test/erp-integration.spec.ts",
    "apps/web/app/(dashboard)/erp/page.tsx",
    "apps/web/lib/erp-api.ts",
    "scripts/run-uat-029-validation.mjs"
  ];
  const schema = readFileSync(path.join(root, "prisma/schema.prisma"), "utf8");
  const schemaChecks = ["model ErpFieldMapping", "model ErpImportBatch", "model ErpReconciliationMismatch", "ERP_SYNC_MODE"];
  const envSchema = readFileSync(path.join(root, "apps/api/src/config/env.validation.ts"), "utf8");
  const missingSchema = schemaChecks.filter((token) => !(token.startsWith("ERP_") ? envSchema.includes(token) : schema.includes(token)));
  const missing = required.filter((rel) => !existsSync(path.join(root, rel)));
  if (missing.length || missingSchema.length) {
    console.log(`uat029_backend_checks=FAIL missing=${[...missing, ...missingSchema].join(",")}`);
    process.exit(1);
  }
  console.log("uat029_backend_checks=PASS");
}

const root = process.cwd();
loadEnvFile(path.join(root, ".env.render.local"));
loadEnvFile(path.join(root, ".env"));
const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
const npmShell = { shell: true };

run("uat029_db_generate", npmCmd, ["run", "db:generate"], {}, npmShell);
run("uat029_typecheck", npmCmd, ["run", "typecheck"], {}, npmShell);
run("uat029_lint", npmCmd, ["run", "lint"], {}, npmShell);
run("uat029_erp_tests", npmCmd, ["run", "test", "--workspace", "@maintainpro/api", "--", "--runInBand", "test/erp-integration.spec.ts"], {}, npmShell);
run("uat029_tests", npmCmd, ["run", "test"], {}, npmShell);
run("uat029_build", npmCmd, ["run", "build"], { NODE_ENV: "production", ERP_SYNC_MODE: "disabled" }, { ...npmShell, inherit: true });
assertModuleExists();
console.log("UAT-029 PASS");
