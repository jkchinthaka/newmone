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

const root = process.cwd();
loadEnvFile(path.join(root, ".env.render.local"));
loadEnvFile(path.join(root, ".env"));

const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
const npmShell = { shell: true };

run("typecheck", npmCmd, ["run", "typecheck"], {}, npmShell);
run("lint", npmCmd, ["run", "lint"], {}, npmShell);
run("test", npmCmd, ["run", "test"], {}, npmShell);
run("maintenance_reports_tests", npmCmd, [
  "run",
  "test",
  "--workspace",
  "@maintainpro/api",
  "--",
  "--runInBand",
  "test/maintenance-reports.spec.ts",
  "test/work-order-parts-governance.spec.ts",
  "test/work-orders-governance.spec.ts"
], {}, npmShell);
run("uat_010", npmCmd, ["run", "uat:010:validate"], {}, npmShell);
console.log("uat_011_validation=complete");
