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
check("PO-RCV-001", /Over-receipt blocked/.test(svc), "over-receipt guard");
check("PO-RCV-002", /MovementType\.IN/.test(svc), "stock IN on accept");
check("PO-RCV-003", /Cannot set PARTIALLY_RECEIVED or RECEIVED via PATCH/.test(svc), "PATCH RECEIVED blocked");
check("PO-RCV-004", /purchase_orders\.receive/.test(ctrl) && /purchase-orders\/:id\/receipts/.test(ctrl), "receive route+perm");
check("PO-RCV-005", /purchaseReceiptIdempotency/.test(svc), "receipt idempotency");

if (failed) process.exit(1);
console.log("\nAll purchase-receiving-contract selftests passed.");