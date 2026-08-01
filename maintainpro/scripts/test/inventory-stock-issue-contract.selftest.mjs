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
check("INV-STOCK-001", /Parts cannot be issued without a valid work order/.test(svc), "workOrderId required");
check("INV-STOCK-002", /quantityInStock:\s*\{\s*gte:\s*quantity/.test(svc), "atomic conditional decrement");
check("INV-STOCK-003", /inventoryStockIssueIdempotency/.test(svc), "idempotency record used");
check("INV-STOCK-004", /Stock quantity cannot go below 0/.test(svc), "negative stock blocked");
const schema = readFileSync(path.join(root, "prisma/schema.prisma"), "utf8");
check("INV-STOCK-005", /model InventoryStockIssueIdempotency/.test(schema), "idempotency model present");
check("INV-STOCK-006", /@@unique\(\[tenantId, key\]\)/.test(schema), "tenant-scoped unique key");
const web = readFileSync(path.join(root, "apps/web/components/inventory/api.ts"), "utf8");
check("INV-STOCK-007", /workOrderId/.test(web), "Web stock-out sends workOrderId");
if (failed) process.exit(1);
console.log("\nAll inventory stock-issue contract selftests passed.");
