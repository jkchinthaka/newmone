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
check("PO-APR-001", /assertMakerCheckerSeparation/.test(svc), "maker-checker on approvals");
check("PO-APR-002", /both operational and finance/.test(svc), "dual-stage same actor blocked");
check("PO-APR-003", /notifyPurchaseOrderActor|createdById \|\|/.test(svc), "notify creator");
check("PO-APR-004", /FINANCE/.test(readFileSync(path.join(root, "apps/api/src/modules/inventory/inventory.controller.ts"), "utf8")), "FINANCE role on finance approve");

if (failed) process.exit(1);
console.log("\nAll purchase-order-approval-contract selftests passed.");