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
check("FIN-REC-001", /consumed_maintenance/.test(svc), "consumed_maintenance basis");
check("FIN-REC-002", /double-count/i.test(svc), "double-count prevention note");
check("FIN-REC-003", /finance\.consumed_maintenance/.test(svc), "finance.consumed_maintenance KPI key");
check("FIN-REC-004", /getFinancialTransactions/.test(svc), "financial transactions loader");


if (failed) process.exit(1);
console.log("\nAll financial-reconciliation-contract selftests passed.");
