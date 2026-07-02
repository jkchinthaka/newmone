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

function assertDeliveryModuleExists() {
  console.log("STEP=uat026_backend_checks");
  const required = [
    "apps/api/src/modules/delivery-readiness/delivery-readiness.module.ts",
    "apps/api/src/modules/delivery-readiness/delivery-readiness.service.ts",
    "apps/api/src/modules/delivery-readiness/delivery.constants.ts",
    "apps/api/test/delivery-readiness.spec.ts",
    "apps/web/app/(dashboard)/delivery-readiness/page.tsx",
    "apps/web/components/delivery/delivery-dashboard-page.tsx",
    "apps/web/lib/delivery-api.ts",
    "scripts/run-uat-026-validation.mjs"
  ];
  const missing = required.filter((rel) => !existsSync(path.join(root, rel)));
  if (missing.length > 0) {
    console.log(`uat026_backend_checks=FAIL missing=${missing.join(",")}`);
    process.exit(1);
  }

  const schema = readFileSync(path.join(root, "prisma/schema.prisma"), "utf8");
  const categories = [
    "REQUIREMENTS",
    "CORE_FUNCTIONS",
    "VALIDATION",
    "UI_UX",
    "RESPONSIVE_DESIGN",
    "SECURITY",
    "DATABASE_DATA",
    "PERFORMANCE",
    "ERROR_HANDLING",
    "DEPLOYMENT",
    "USER_ROLES",
    "REPORTS",
    "NOTIFICATIONS",
    "BACKUP_RECOVERY",
    "DOCUMENTATION",
    "FINAL_DEMO",
    "CLIENT_SIGN_OFF"
  ];
  const missingCategories = categories.filter((c) => !schema.includes(c));
  if (missingCategories.length > 0) {
    console.log(`uat026_backend_checks=FAIL missing_categories=${missingCategories.join(",")}`);
    process.exit(1);
  }

  console.log("uat026_backend_checks=PASS");
}

const root = process.cwd();
loadEnvFile(path.join(root, ".env.render.local"));
loadEnvFile(path.join(root, ".env"));

const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
const npmShell = { shell: true };

run("uat026_db_generate", npmCmd, ["run", "db:generate"], {}, npmShell);
run("uat026_typecheck", npmCmd, ["run", "typecheck"], {}, npmShell);
run("uat026_lint", npmCmd, ["run", "lint"], {}, npmShell);
run("uat026_delivery_tests", npmCmd, [
  "run",
  "test",
  "--workspace",
  "@maintainpro/api",
  "--",
  "--runInBand",
  "test/delivery-readiness.spec.ts"
], {}, npmShell);
run("uat026_tests", npmCmd, ["run", "test"], {}, npmShell);
run("uat026_build", npmCmd, ["run", "build"], { NODE_ENV: "production" }, { ...npmShell, inherit: true });
run("uat026_cloudflare_build", npmCmd, ["run", "cloudflare:build"], { NODE_ENV: "production" }, { ...npmShell, inherit: true });
assertDeliveryModuleExists();
console.log("UAT-026 PASS");
