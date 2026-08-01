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


const svc = read("apps/api/src/modules/reports/reports.service.ts");
const currency = read("apps/api/src/modules/reports/report-currency.util.ts");
check("KPI-001", /wo\.total_created/.test(svc), "wo.total_created card key");
check("KPI-002", /wo\.mtbf/.test(svc) && /INSUFFICIENT_DATA/.test(svc), "MTBF insufficient data");
check("KPI-003", /consumed_maintenance/.test(svc), "consumed_maintenance financial basis");
check("KPI-004", /REPORTING_CURRENCY_CODE/.test(svc) && /LKR/.test(currency), "LKR reporting currency");
check("KPI-005", /Asia\/Colombo/.test(currency), "Asia/Colombo timezone");


if (failed) process.exit(1);
console.log("\nAll kpi-definition-contract selftests passed.");
