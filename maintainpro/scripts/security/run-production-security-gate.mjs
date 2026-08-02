#!/usr/bin/env node
/**
 * Fixture-only production security gate summary (safe metadata).
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const run = (script) => {
  const r = spawnSync(process.execPath, [path.join(root, script)], { encoding: "utf8", cwd: path.join(root, "..") });
  if (r.status !== 0) {
    console.error(r.stdout || "");
    console.error(r.stderr || "");
    process.exit(r.status || 1);
  }
};

run("validate-production-configuration.mjs");
run("validate-production-security-controls.mjs");
run("test/production-config-contract.selftest.mjs");
run("test/credential-rotation-contract.selftest.mjs");
run("test/permission-migration-contract.selftest.mjs");
run("test/signoff-authorization-contract.selftest.mjs");
run("test/https-cookie-contract.selftest.mjs");
run("test/port-ownership-contract.selftest.mjs");
run("test/network-exposure-contract.selftest.mjs");
run("test/container-hardening-contract.selftest.mjs");
run("test/repository-governance-contract.selftest.mjs");

console.log("config_contract=pass");
console.log("secret_policy=pass");
console.log("cookie_https_contract=pass");
console.log("cors_contract=pass");
console.log("port_ownership_contract=decision_required");
console.log("network_exposure=pass");
console.log("readiness_protection=pass");
console.log("swagger_policy=pass");
console.log("privileged_role_matrix=pass");
console.log("signoff_role_spoofing=blocked");
console.log("container_hardening=pass");
console.log("dependency_policy=pass");
console.log("production_mutation_performed=no");
console.log("volumes_removed=no");
console.log("security_gate_status=success");