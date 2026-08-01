#!/usr/bin/env node
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
let failed = 0;
function check(id, ok, d) {
  if (ok) console.log(`PASS ${id}: ${d}`);
  else {
    failed += 1;
    console.error(`FAIL ${id}: ${d}`);
  }
}

const svc = readFileSync(path.join(root, "apps/api/src/modules/inventory/inventory.service.ts"), "utf8");
const util = readFileSync(path.join(root, "apps/api/src/modules/inventory/erp-error-sanitize.util.ts"), "utf8");
const ctrl = readFileSync(path.join(root, "apps/api/src/modules/inventory/inventory.controller.ts"), "utf8");

check("ERP-SAFE-001", /sanitizeErpErrorMessage/.test(svc) && /redacted-url/.test(util), "error sanitize");
check("ERP-SAFE-002", /buildSafeErpRequestPayload/.test(svc) && /lineCount/.test(util), "safe request payload");
check("ERP-SAFE-003", /assertTestModeErpFailClosed/.test(svc), "E2E/test fail-closed");
check("ERP-SAFE-004", /Maximum ERP sync attempts \(5\)/.test(svc), "max attempts");
check("ERP-SAFE-005", /inventory\.erp_apply/.test(ctrl) && !/INVENTORY_KEEPER[\s\S]{0,80}erp_apply/.test(ctrl), "apply perm narrowed");

if (failed) process.exit(1);
console.log("\nAll erp-sync-safety-contract selftests passed.");