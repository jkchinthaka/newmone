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


const matrix = read("apps/api/src/modules/reports/report-access.matrix.ts");
const ctrl = read("apps/api/src/modules/reports/reports.controller.ts");
check("RPT-ACC-001", /financials/.test(matrix) && /INVENTORY_KEEPER/.test(matrix), "inventory keeper financials path");
check("RPT-ACC-002", /system-logs/.test(matrix) && /AUDIT_VIEW_PERMISSION/.test(matrix), "system-logs gated");
check("RPT-ACC-003", /TECHNICIAN:[\s\S]{0,80}operations/.test(matrix), "technician operations fallback");
check("RPT-ACC-004", /erp-monitoring/.test(ctrl), "erp-monitoring controller route");
check("RPT-ACC-005", /assertCanViewReportModule/.test(matrix), "assertCanViewReportModule export");


if (failed) process.exit(1);
console.log("\nAll report-access-contract selftests passed.");
