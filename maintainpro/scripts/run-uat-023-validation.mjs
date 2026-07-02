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

function assertDocsExist() {
  console.log("STEP=go_live_docs");
  const required = [
    "docs/go-live/pilot-rollout-plan.md",
    "docs/go-live/performance-test-report.md",
    "docs/go-live/backup-restore-test-report.md",
    "docs/go-live/security-review-report.md",
    "docs/go-live/management-sign-off.md",
    "docs/go-live/final-go-live-checklist.md",
    "docs/go-live/pilot-support-process.md",
    "docs/go-live/pilot-feedback-form.md",
    "docs/go-live/live-monitoring-plan.md",
    "docs/go-live/cutover-plan.md",
    "docs/go-live/training/technician-training.md",
    "docs/go-live/training/supervisor-training.md",
    "docs/go-live/training/storekeeper-training.md",
    "docs/go-live/training/manager-training.md",
    "docs/go-live/training/finance-training.md",
    "docs/go-live/training/security-training.md",
    "docs/go-live/training/admin-training.md",
    "docs/go-live/sop/work-order-create-sop.md",
    "docs/go-live/sop/work-order-assignment-sop.md",
    "docs/go-live/sop/technician-completion-sop.md",
    "docs/go-live/sop/supervisor-verification-sop.md",
    "docs/go-live/sop/parts-issue-return-sop.md",
    "docs/go-live/sop/vendor-repair-sop.md",
    "docs/go-live/sop/finance-invoice-approval-sop.md",
    "docs/go-live/sop/gate-restriction-sop.md",
    "docs/go-live/sop/admin-override-sop.md",
    "docs/go-live/sop/management-report-review-sop.md",
    "docs/go-live/sop/incident-reporting-sop.md",
    "docs/go-live/sop/change-request-sop.md"
  ];

  const missing = required.filter((rel) => !existsSync(path.join(root, rel)));
  if (missing.length > 0) {
    console.log(`go_live_docs=FAIL missing=${missing.join(",")}`);
    process.exit(1);
  }
  console.log(`go_live_docs=PASS count=${required.length}`);
}

const root = process.cwd();
loadEnvFile(path.join(root, ".env.render.local"));
loadEnvFile(path.join(root, ".env"));

const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
const npmShell = { shell: true };

assertDocsExist();
run("db_generate", npmCmd, ["run", "db:generate"], {}, npmShell);
run("typecheck", npmCmd, ["run", "typecheck"], {}, npmShell);
run("lint", npmCmd, ["run", "lint"], {}, npmShell);
run("go_live_readiness_tests", npmCmd, [
  "run",
  "test",
  "--workspace",
  "@maintainpro/api",
  "--",
  "--runInBand",
  "test/go-live-readiness.spec.ts",
  "test/security-rbac-audit.spec.ts",
  "test/fraud-control.spec.ts",
  "test/management-intelligence.spec.ts"
], {}, npmShell);
run("test", npmCmd, ["run", "test"], {}, npmShell);
run("build", npmCmd, ["run", "build"], { NODE_ENV: "production" }, { ...npmShell, inherit: true });
run("cloudflare_build", npmCmd, ["run", "cloudflare:build"], { NODE_ENV: "production" }, { ...npmShell, inherit: true });
run("performance_probe", process.execPath, ["scripts/run-uat-023-performance-probe.mjs"]);
run("smoke_deploy", process.execPath, ["scripts/run-smoke-with-staging-env.mjs"]);
console.log("uat_023_validation=complete");
