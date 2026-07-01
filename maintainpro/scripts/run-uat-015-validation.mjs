import { spawnSync, execSync } from "node:child_process";
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
    shell: options.shell ?? false
  });
  if (!options.inherit && result.stdout?.trim()) console.log(result.stdout.trim());
  if (!options.inherit && result.stderr?.trim() && result.status !== 0) {
    console.log(result.stderr.trim().slice(-1200));
  }
  if (result.status !== 0) {
    console.log(`${label}=FAIL`);
    if (options.allowRetry) {
      return false;
    }
    process.exit(result.status ?? 1);
  }
  console.log(`${label}=PASS`);
  return true;
}

function runExec(label, command, attempts = 1) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const step = `${label}${attempt > 1 ? `_retry_${attempt}` : ""}`;
    console.log(`STEP=${step}`);
    try {
      execSync(command, { cwd: root, stdio: "inherit", env: process.env, shell: true });
      console.log(`${step}=PASS`);
      return;
    } catch {
      console.log(`${step}=FAIL`);
      if (attempt < attempts) {
        console.log(`${label}=RETRY`);
        continue;
      }
      process.exit(1);
    }
  }
}

const root = process.cwd();
loadEnvFile(path.join(root, ".env.render.local"));
loadEnvFile(path.join(root, ".env"));

const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
const npmShell = { shell: true };

run("db_generate", npmCmd, ["run", "db:generate"], {}, npmShell);
run("typecheck", npmCmd, ["run", "typecheck"], {}, npmShell);
run("lint", npmCmd, ["run", "lint"], {}, npmShell);
run("taxonomy_tests", npmCmd, [
  "run",
  "test",
  "--workspace",
  "@maintainpro/api",
  "--",
  "--runInBand",
  "test/work-order-taxonomy.spec.ts",
  "test/work-order-queues.spec.ts"
], {}, npmShell);
runExec("api_build", "npm run build --workspace @maintainpro/api");
runExec("web_typecheck_build", "npm run typecheck --workspace @maintainpro/web");
run("test", npmCmd, ["run", "test"], {}, npmShell);

const optionalScripts = ["smoke:deploy"];

for (const script of optionalScripts) {
  const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
  if (pkg.scripts?.[script]) {
    run(script, npmCmd, ["run", script], {}, npmShell);
  } else {
    console.log(`STEP=${script}=SKIP (script not defined)`);
  }
}

console.log("uat_015_validation=complete");
