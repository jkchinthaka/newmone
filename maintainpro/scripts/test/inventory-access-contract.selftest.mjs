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

const c = readFileSync(path.join(root, "apps/api/src/modules/inventory/inventory.controller.ts"), "utf8");
check("INV-ACCESS-001", /INVENTORY_READ_ROLES/.test(c) && /INVENTORY_KEEPER/.test(c), "Keeper on inventory read roles");
check(
  "INV-ACCESS-002",
  /@Delete\("parts\/:id"\)[\s\S]{0,220}ASSET_MANAGER/.test(c) &&
    !/@Delete\("parts\/:id"\)[\s\S]{0,220}INVENTORY_KEEPER/.test(c),
  "Keeper excluded from delete"
);
check("INV-ACCESS-003", /stock-out[\s\S]{0,400}inventory\.stock_issue/.test(c), "Stock-out uses inventory.stock_issue");
const seed = readFileSync(path.join(root, "scripts/e2e-seed.mjs"), "utf8");
check("INV-ACCESS-004", /INVENTORY_KEEPER:[\s\S]{0,120}inventory\.manage/.test(seed), "E2E seed grants inventory.manage to keeper");
check("INV-ACCESS-005", /E2E-B-PART-/.test(seed), "Tenant B part seeded for isolation");
if (failed) process.exit(1);
console.log("\nAll inventory access contract selftests passed.");
