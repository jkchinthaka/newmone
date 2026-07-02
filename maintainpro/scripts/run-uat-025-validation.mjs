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
  const useShell = options.shell ?? false;
  const stdio = options.inherit ? "inherit" : ["ignore", "pipe", "pipe"];
  const result = spawnSync(command, args, {
    cwd: root,
    env: { ...process.env, ...extraEnv },
    encoding: "utf8",
    stdio,
    windowsHide: true,
    maxBuffer: 50 * 1024 * 1024,
    shell: useShell && process.platform === "win32"
  });
  if (!options.inherit && result.stdout?.trim()) console.log(result.stdout.trim());
  if (!options.inherit && result.stderr?.trim() && result.status !== 0) {
    console.log(result.stderr.trim().slice(-1200));
  }
  if (result.status !== 0) {
    console.log(`${label}=FAIL`);
    process.exit(result.status ?? 1);
  }
  console.log(`${label}=PASS`);
}

function assertQaModuleExists() {
  console.log("STEP=uat025_module_checks");
  const required = [
    "apps/api/src/modules/qa/qa.module.ts",
    "apps/api/src/modules/qa/qa.controller.ts",
    "apps/api/src/modules/qa/qa-issues.service.ts",
    "apps/api/src/modules/qa/qa.constants.ts",
    "apps/api/test/qa-incidents.spec.ts",
    "apps/web/app/(dashboard)/qa/page.tsx",
    "apps/web/components/qa/qa-dashboard-page.tsx",
    "apps/web/lib/qa-api.ts",
    "scripts/run-uat-025-validation.mjs"
  ];
  const missing = required.filter((rel) => !existsSync(path.join(root, rel)));
  if (missing.length > 0) {
    console.log(`uat025_module_checks=FAIL missing=${missing.join(",")}`);
    process.exit(1);
  }

  const schema = readFileSync(path.join(root, "prisma/schema.prisma"), "utf8");
  const categories = [
    "REQUIREMENT_ERROR",
    "UI_UX_ERROR",
    "FRONTEND_ERROR",
    "BACKEND_ERROR",
    "DATABASE_ERROR",
    "AUTH_RBAC_ERROR",
    "API_INTEGRATION_ERROR",
    "DEPLOYMENT_ERROR",
    "PERFORMANCE_ERROR",
    "SECURITY_ERROR",
    "DATA_QUALITY_ERROR",
    "TESTING_QA_ERROR"
  ];
  const missingCategories = categories.filter((c) => !schema.includes(c));
  if (missingCategories.length > 0) {
    console.log(`uat025_module_checks=FAIL missing_categories=${missingCategories.join(",")}`);
    process.exit(1);
  }

  console.log("uat025_module_checks=PASS");
}

const root = process.cwd();
loadEnvFile(path.join(root, ".env.render.local"));
loadEnvFile(path.join(root, ".env"));

const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
const npmShell = { shell: true };

run("uat025_db_generate", npmCmd, ["run", "db:generate"], {}, npmShell);
run("uat025_typecheck", npmCmd, ["run", "typecheck"], {}, npmShell);
run("uat025_lint", npmCmd, ["run", "lint"], {}, npmShell);
run("uat025_qa_tests", npmCmd, [
  "run",
  "test",
  "--workspace",
  "@maintainpro/api",
  "--",
  "--runInBand",
  "test/qa-incidents.spec.ts"
], {}, npmShell);
run("uat025_tests", npmCmd, ["run", "test"], {}, npmShell);
run("uat025_build", npmCmd, ["run", "build"], { NODE_ENV: "production" }, { ...npmShell, inherit: true });
run("uat025_cloudflare_build", npmCmd, ["run", "cloudflare:build"], { NODE_ENV: "production" }, { ...npmShell, inherit: true });
assertQaModuleExists();
console.log("UAT-025 PASS");
