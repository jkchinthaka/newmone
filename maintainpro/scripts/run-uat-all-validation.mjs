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

function runPhase(label, uatScript) {
  console.log(`PHASE=${label}`);
  const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
  const result = spawnSync(npmCmd, ["run", uatScript], {
    cwd: root,
    env: process.env,
    encoding: "utf8",
    stdio: "inherit",
    windowsHide: true,
    shell: process.platform === "win32"
  });
  if (result.status !== 0) {
    console.log(`${label}=FAIL`);
    process.exit(result.status ?? 1);
  }
  console.log(`${label}=PASS`);
}

const root = process.cwd();
loadEnvFile(path.join(root, ".env.render.local"));
loadEnvFile(path.join(root, ".env"));

const phases = [
  ["uat017", "uat:017:validate"],
  ["uat018", "uat:018:validate"],
  ["uat019", "uat:019:validate"],
  ["uat020", "uat:020:validate"],
  ["uat021", "uat:021:validate"],
  ["uat022", "uat:022:validate"],
  ["uat023", "uat:023:validate"],
  ["uat024", "uat:024:validate"],
  ["uat025", "uat:025:validate"],
  ["uat026", "uat:026:validate"],
  ["uat027", "uat:027:validate"]
];

for (const [label, script] of phases) {
  runPhase(label, script);
}

console.log("UAT_ALL_REGRESSION=PASS");
