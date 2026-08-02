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


const util = read("apps/api/src/modules/reports/report-export-safety.util.ts");
const svc = read("apps/api/src/modules/reports/reports.service.ts");
check("EXP-SAFE-001", /neutralizeSpreadsheetValue/.test(util), "neutralizeSpreadsheetValue");
check("EXP-SAFE-002", /FORMULA_PREFIX/.test(util), "formula prefix guard");
check("EXP-SAFE-003", /contentDispositionAttachment/.test(util), "content-disposition helper");
check("EXP-SAFE-004", /neutralizeSpreadsheetValue/.test(svc), "export path uses neutralize");
check("EXP-SAFE-005", /writeAuditTrail/.test(svc), "export writes audit trail");


if (failed) process.exit(1);
console.log("\nAll report-export-safety-contract selftests passed.");
