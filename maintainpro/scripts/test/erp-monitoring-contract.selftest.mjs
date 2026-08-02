#!/usr/bin/env node
import { readFileSync, existsSync } from "node:fs";
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
function read(rel) {
  const full = path.join(root, rel);
  if (!existsSync(full)) throw new Error("missing " + rel);
  return readFileSync(full, "utf8");
}


const erp = read("apps/api/src/modules/reports/erp-monitoring.service.ts");
const ctrl = read("apps/api/src/modules/reports/reports.controller.ts");
check("ERP-MON-001", /providerCategory/.test(erp), "providerCategory field");
check("ERP-MON-002", /MOCK/.test(erp) && /DISABLED/.test(erp), "provider categories");
check("ERP-MON-003", /getSafeSummary/.test(erp), "getSafeSummary");
check("ERP-MON-004", /erp-monitoring/.test(ctrl), "controller route");
check("ERP-MON-005", /coverageStatus/.test(erp), "coverageStatus on summary");


if (failed) process.exit(1);
console.log("\nAll erp-monitoring-contract selftests passed.");
