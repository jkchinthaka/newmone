#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scripts = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const run = (rel) => {
  const r = spawnSync(process.execPath, [path.join(scripts, rel)], {
    encoding: "utf8",
    cwd: path.join(scripts, "..")
  });
  if (r.status !== 0) {
    console.error(r.stdout || "");
    console.error(r.stderr || "");
    process.exit(r.status || 1);
  }
};

run("validate-e2e-uat-go-live-controls.mjs");
for (const t of [
  "test/uat-governance-contract.selftest.mjs",
  "test/go-live-decision-contract.selftest.mjs",
  "test/go-live-signoff-contract.selftest.mjs",
  "test/rollback-rehearsal-contract.selftest.mjs",
  "test/cutover-stage-contract.selftest.mjs"
]) {
  run(t);
}

console.log("uat_mechanics=pass");
console.log("synthetic_excluded_from_formal=yes");
console.log("training_mechanics=pass");
console.log("rollback_rehearsal=pass");
console.log("signoff_authorization=pass");
console.log("stale_signoff_rejected=yes");
console.log("open_p0_blocks_go=yes");
console.log("missing_real_evidence_blocks_go=yes");
console.log("recommended_decision=DELAYED");
console.log("production_deployment_performed=no");
console.log("volumes_removed=no");
console.log("uat_control_gate_status=success");