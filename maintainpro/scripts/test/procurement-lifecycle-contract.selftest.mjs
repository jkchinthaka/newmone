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
const ctrl = readFileSync(path.join(root, "apps/api/src/modules/inventory/inventory.controller.ts"), "utf8");
const schema = readFileSync(path.join(root, "prisma/schema.prisma"), "utf8");

check("PROC-LC-001", /createPurchaseOrder/.test(svc) && /createdById/.test(svc), "create sets createdById path");
check("PROC-LC-002", /calculatePurchaseOrderTotals|headerTotal/.test(svc), "server totals");
check("PROC-LC-003", /createPurchaseReceipt/.test(svc), "receipts endpoint path");
check("PROC-LC-004", /purchase_orders\.create/.test(ctrl) && /HttpCode\(HttpStatus\.CREATED\)/.test(ctrl), "create 201 + perm");
check("PROC-LC-005", /model PurchaseReceipt/.test(schema) && /@@unique\(\[tenantId, poNumber\]\)/.test(schema), "schema additive models");

if (failed) process.exit(1);
console.log("\nAll procurement-lifecycle-contract selftests passed.");